const mqtt = require('mqtt');
const { Pool } = require('pg');

// Config from environment
const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
const MQTT_USERNAME = process.env.MQTT_USERNAME || 'dashadmin';
const MQTT_PASSWORD = process.env.MQTT_PASSWORD || 'changeme';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

console.log(`[${new Date().toISOString()}] MQTT Consumer starting...`);
console.log(`Broker: ${MQTT_BROKER_URL}`);

// Connect to MQTT
const client = mqtt.connect(MQTT_BROKER_URL, {
  username: MQTT_USERNAME,
  password: MQTT_PASSWORD,
  clientId: `dashadmin-consumer-${Date.now()}`,
  keepalive: 60,
  reconnectPeriod: 5000,
});

client.on('connect', () => {
  console.log(`[${new Date().toISOString()}] Connected to MQTT broker`);
  
  // Subscribe to all agent telemetry topics
  // Topic format: agent/{workstationId}/telemetry
  client.subscribe('agent/+/telemetry', { qos: 0 }, (err) => {
    if (err) {
      console.error('Subscribe error:', err);
      process.exit(1);
    }
    console.log('Subscribed to agent/+/telemetry');
  });
});

client.on('message', async (topic, message) => {
  const now = Date.now();
  
  try {
    // Parse topic: agent/{workstationId}/telemetry
    const topicParts = topic.split('/');
    if (topicParts.length !== 3 || topicParts[0] !== 'agent' || topicParts[2] !== 'telemetry') {
      console.warn(`Unexpected topic format: ${topic}`);
      return;
    }
    
    const workstationId = topicParts[1];
    const payload = JSON.parse(message.toString());
    
    console.log(`[${new Date().toISOString()}] Received telemetry from ${workstationId}`);
    
    // Process telemetry
    await processTelemetry(workstationId, payload);
    
  } catch (error) {
    console.error(`Error processing message from ${topic}:`, error.message);
  }
});

client.on('error', (error) => {
  console.error('MQTT error:', error);
});

client.on('offline', () => {
  console.warn('MQTT client offline');
});

// Process telemetry data
async function processTelemetry(workstationId, payload) {
  const { hostname, cpu, gpu_data, devices, memory, disks } = payload;
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Insert telemetry record
    await client.query(
      `INSERT INTO agent_telemetry 
       (workstation_id, hostname, cpu_temp, cpu_usage, cpu_model, gpu_data, devices, memory, disks)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        workstationId,
        hostname || null,
        cpu?.temp || 0,
        cpu?.usage || 0,
        cpu?.model_name || null,
        gpu_data ? JSON.stringify(gpu_data) : null,
        devices ? JSON.stringify(devices) : null,
        memory ? JSON.stringify(memory) : null,
        disks ? JSON.stringify(disks) : null
      ]
    );
    
    // Update workstation status
    await client.query(
      `UPDATE club_workstations 
       SET agent_last_seen = NOW(), 
           agent_status = 'ONLINE'
       WHERE id = $1`,
      [workstationId]
    );
    
    await client.query('COMMIT');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Database error:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down...');
  client.end();
  await pool.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nShutting down...');
  client.end();
  await pool.end();
  process.exit(0);
});
