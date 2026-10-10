import { NextResponse } from "next/server";
import { query } from "@/db";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ clubId: string }> }
) {
  try {
    const { clubId } = await params;
    const parsedClubId = parseInt(clubId, 10);
    if (isNaN(parsedClubId)) {
      return NextResponse.json({ error: "Invalid club ID" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const lanIp = body.lan_ip || "";
    const basePort = body.base_port || 27015;
    const maxInstances = body.max_instances || 4;
    const instances = JSON.stringify(body.instances || []);
    const agentId = body.agent_id || (lanIp ? `agent_${lanIp.replace(/[^a-zA-Z0-9]/g, "_")}` : "default");

    // 1. Ensure required tables exist with multi-agent columns
    await query(`
      CREATE TABLE IF NOT EXISTS club_cs2_agents (
        club_id INT NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
        agent_id VARCHAR(64) DEFAULT 'default',
        status VARCHAR(32) DEFAULT 'online',
        lan_ip VARCHAR(64),
        base_port INT DEFAULT 27015,
        max_instances INT DEFAULT 4,
        instances_data JSONB DEFAULT '[]'::jsonb,
        last_heartbeat TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        PRIMARY KEY (club_id, agent_id)
      );
      ALTER TABLE club_cs2_agents ADD COLUMN IF NOT EXISTS agent_id VARCHAR(64) DEFAULT 'default';

      CREATE TABLE IF NOT EXISTS club_cs2_matches (
        id VARCHAR(64) PRIMARY KEY,
        club_id INT NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
        map_name VARCHAR(64) NOT NULL,
        match_format VARCHAR(16) DEFAULT '5v5',
        team1_name VARCHAR(64) DEFAULT 'Команда 1',
        team2_name VARCHAR(64) DEFAULT 'Команда 2',
        status VARCHAR(32) DEFAULT 'starting',
        port INT DEFAULT 27015,
        server_ip VARCHAR(64),
        agent_id VARCHAR(64) DEFAULT 'default',
        score1 INT DEFAULT 0,
        score2 INT DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      ALTER TABLE club_cs2_matches ADD COLUMN IF NOT EXISTS agent_id VARCHAR(64) DEFAULT 'default';

      CREATE TABLE IF NOT EXISTS club_cs2_commands (
        id SERIAL PRIMARY KEY,
        club_id INT NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
        agent_id VARCHAR(64),
        command_type VARCHAR(32) NOT NULL,
        match_id VARCHAR(64),
        payload JSONB DEFAULT '{}'::jsonb,
        status VARCHAR(32) DEFAULT 'pending',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      ALTER TABLE club_cs2_commands ADD COLUMN IF NOT EXISTS agent_id VARCHAR(64);
    `);

    // Safely update primary key on club_cs2_agents if needed
    await query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.table_constraints 
          WHERE table_name = 'club_cs2_agents' AND constraint_type = 'PRIMARY KEY' AND constraint_name = 'club_cs2_agents_pkey'
        ) THEN
          ALTER TABLE club_cs2_agents DROP CONSTRAINT club_cs2_agents_pkey;
          ALTER TABLE club_cs2_agents ADD PRIMARY KEY (club_id, agent_id);
        END IF;
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END $$;
    `).catch(() => {});

    // 2. Upsert agent state
    await query(
      `INSERT INTO club_cs2_agents (club_id, agent_id, status, lan_ip, base_port, max_instances, instances_data, last_heartbeat, updated_at)
       VALUES ($1, $2, 'online', $3, $4, $5, $6::jsonb, NOW(), NOW())
       ON CONFLICT (club_id, agent_id) DO UPDATE SET
         status = 'online',
         lan_ip = EXCLUDED.lan_ip,
         base_port = EXCLUDED.base_port,
         max_instances = EXCLUDED.max_instances,
         instances_data = EXCLUDED.instances_data,
         last_heartbeat = NOW(),
         updated_at = NOW()`,
      [parsedClubId, agentId, lanIp, basePort, maxInstances, instances]
    );

    // 3. Fetch pending commands for this agent or broadcast commands
    const cmdRes = await query(
      `SELECT id, command_type, match_id, payload
       FROM club_cs2_commands
       WHERE club_id = $1 AND status = 'pending' AND (agent_id = $2 OR agent_id IS NULL OR agent_id = 'default' OR (payload->>'agent_id') = $2)
       ORDER BY id ASC`,
      [parsedClubId, agentId]
    );

    const commands: any[] = [];
    if (cmdRes.rowCount && cmdRes.rowCount > 0) {
      const ids: number[] = [];
      for (const row of cmdRes.rows) {
        ids.push(row.id);
        const p = row.payload || {};
        commands.push({
          id: row.id,
          type: row.command_type,
          match_id: row.match_id,
          map_name: p.map_name || "de_dust2",
          match_format: p.match_format || "5v5",
          config_url: p.config_url || "",
          auth_token: p.auth_token || "",
          command: p.command || "",
        });
      }

      await query(
        `UPDATE club_cs2_commands SET status = 'delivered' WHERE id = ANY($1::int[])`,
        [ids]
      );
    }

    return NextResponse.json({
      success: true,
      commands,
    });
  } catch (error) {
    console.error("[CS2 Heartbeat Error]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
