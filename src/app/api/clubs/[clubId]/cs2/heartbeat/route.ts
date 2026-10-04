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

    // 1. Ensure required tables exist
    await query(`
      CREATE TABLE IF NOT EXISTS club_cs2_agents (
        club_id INT PRIMARY KEY REFERENCES clubs(id) ON DELETE CASCADE,
        status VARCHAR(32) DEFAULT 'online',
        lan_ip VARCHAR(64),
        base_port INT DEFAULT 27015,
        max_instances INT DEFAULT 4,
        instances_data JSONB DEFAULT '[]'::jsonb,
        last_heartbeat TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

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
        score1 INT DEFAULT 0,
        score2 INT DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS club_cs2_commands (
        id SERIAL PRIMARY KEY,
        club_id INT NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
        command_type VARCHAR(32) NOT NULL,
        match_id VARCHAR(64),
        payload JSONB DEFAULT '{}'::jsonb,
        status VARCHAR(32) DEFAULT 'pending',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // 2. Upsert agent state
    await query(
      `INSERT INTO club_cs2_agents (club_id, status, lan_ip, base_port, max_instances, instances_data, last_heartbeat, updated_at)
       VALUES ($1, 'online', $2, $3, $4, $5::jsonb, NOW(), NOW())
       ON CONFLICT (club_id) DO UPDATE SET
         status = 'online',
         lan_ip = EXCLUDED.lan_ip,
         base_port = EXCLUDED.base_port,
         max_instances = EXCLUDED.max_instances,
         instances_data = EXCLUDED.instances_data,
         last_heartbeat = NOW(),
         updated_at = NOW()`,
      [parsedClubId, lanIp, basePort, maxInstances, instances]
    );

    // 3. Fetch pending commands
    const cmdRes = await query(
      `SELECT id, command_type, match_id, payload
       FROM club_cs2_commands
       WHERE club_id = $1 AND status = 'pending'
       ORDER BY id ASC`,
      [parsedClubId]
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
