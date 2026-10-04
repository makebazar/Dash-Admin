const http = require('http');
const path = require('path');
const { WebSocketServer } = require('ws');
const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;

// Global map to hold active WebSockets per club: clubId -> Set<WebSocket>
global.__cs2ClubSockets = global.__cs2ClubSockets || new Map();

function executeDb(queryText, params = []) {
  if (!DATABASE_URL) return Promise.resolve();
  const client = new Client({ connectionString: DATABASE_URL });
  return client.connect()
    .then(() => client.query(queryText, params))
    .then((res) => {
      client.end();
      return res;
    })
    .catch((err) => {
      console.error('[CS2 WS DB Error]', err.message);
      try { client.end(); } catch (e) {}
    });
}

const wss = new WebSocketServer({ noServer: true });

wss.on('connection', (ws, request, clubId) => {
  console.log(`[CS2 WS] Club #${clubId} agent connected via WebSocket!`);

  if (!global.__cs2ClubSockets.has(clubId)) {
    global.__cs2ClubSockets.set(clubId, new Set());
  }
  global.__cs2ClubSockets.get(clubId).add(ws);

  // Update DB agent status to online
  executeDb(
    `INSERT INTO club_cs2_agents (club_id, status, last_heartbeat, updated_at)
     VALUES ($1, 'online', NOW(), NOW())
     ON CONFLICT (club_id) DO UPDATE SET status = 'online', last_heartbeat = NOW(), updated_at = NOW()`,
    [clubId]
  );

  // Send ACK to agent
  ws.send(JSON.stringify({
    type: 'CONNECTED',
    club_id: clubId,
    timestamp: Date.now(),
    message: 'WebSocket connection to DashAdmin established successfully'
  }));

  // Handle incoming messages from agent
  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());

      if (msg.type === 'AGENT_CONNECTED' || msg.type === 'HEARTBEAT') {
        const data = msg.data || {};
        const instances = JSON.stringify(data.instances || []);
        executeDb(
          `UPDATE club_cs2_agents
           SET status = 'online',
               last_heartbeat = NOW(),
               instances_data = $1::jsonb,
               base_port = COALESCE($2, base_port),
               max_instances = COALESCE($3, max_instances),
               updated_at = NOW()
           WHERE club_id = $4`,
          [instances, data.base_port || 27015, data.max_instances || 4, clubId]
        );
      } else if (msg.type === 'MATCH_STARTED') {
        const data = msg.data || {};
        executeDb(
          `UPDATE club_cs2_matches
           SET status = 'live',
               port = $1,
               updated_at = NOW()
           WHERE id = $2 AND club_id = $3`,
          [data.port || 27015, data.match_id, clubId]
        );
      } else if (msg.type === 'MATCH_STOPPED') {
        const data = msg.data || {};
        executeDb(
          `UPDATE club_cs2_matches
           SET status = 'stopped',
               updated_at = NOW()
           WHERE id = $1 AND club_id = $2`,
          [data.match_id, clubId]
        );
      }
    } catch (e) {
      console.error('[CS2 WS Message Parse Error]', e);
    }
  });

  ws.on('close', () => {
    console.log(`[CS2 WS] Club #${clubId} agent disconnected.`);
    const set = global.__cs2ClubSockets.get(clubId);
    if (set) {
      set.delete(ws);
      if (set.size === 0) {
        global.__cs2ClubSockets.delete(clubId);
        executeDb(
          `UPDATE club_cs2_agents SET status = 'offline', updated_at = NOW() WHERE club_id = $1`,
          [clubId]
        );
      }
    }
  });

  ws.on('error', (err) => {
    console.error(`[CS2 WS Error Club #${clubId}]`, err.message);
  });
});

// Monkey-patch http.createServer before Next.js standalone runner calls it
const originalCreateServer = http.createServer;
http.createServer = function(...args) {
  const server = originalCreateServer.apply(this, args);

  server.on('upgrade', (request, socket, head) => {
    try {
      const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
      const match = url.pathname.match(/^\/api\/clubs\/(\d+)\/cs2\/ws/);

      if (match) {
        const clubId = parseInt(match[1], 10);
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request, clubId);
        });
        return;
      }
    } catch (err) {
      console.error('[CS2 WS Upgrade Error]', err);
    }

    // If not CS2 WS, destroy or pass through
    socket.destroy();
  });

  return server;
};

// Now launch Next.js standalone server
const standaloneServerPath = path.resolve(__dirname, '../server.js');
console.log('[CS2 WS] Starting Next.js with integrated CS2 WebSocket server from:', standaloneServerPath);
require(standaloneServerPath);
