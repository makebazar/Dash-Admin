import { NextResponse } from "next/server";
import { query } from "@/db";
import { requireClubFullAccess } from "@/lib/club-api-access";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ clubId: string }> }
) {
  try {
    const { clubId } = await params;
    await requireClubFullAccess(clubId);

    const parsedClubId = parseInt(clubId, 10);
    if (isNaN(parsedClubId)) {
      return NextResponse.json({ error: "Invalid club ID" }, { status: 400 });
    }

    // Ensure tables exist
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

      ALTER TABLE club_cs2_matches ADD COLUMN IF NOT EXISTS game_state VARCHAR(32) DEFAULT 'none';
      ALTER TABLE club_cs2_matches ADD COLUMN IF NOT EXISTS rcon_last_command VARCHAR(255);
      ALTER TABLE club_cs2_matches ADD COLUMN IF NOT EXISTS rcon_last_response TEXT;
      ALTER TABLE club_cs2_matches ADD COLUMN IF NOT EXISTS config_data JSONB DEFAULT '{}'::jsonb;
    `);

    // 1. Fetch agent state
    const agentRes = await query(
      `SELECT club_id, lan_ip, base_port, max_instances, instances_data, last_heartbeat,
              (last_heartbeat > NOW() - INTERVAL '15 seconds') as is_online
       FROM club_cs2_agents
       WHERE club_id = $1`,
      [parsedClubId]
    );

    let agentData = {
      is_online: false,
      lan_ip: "",
      base_port: 27015,
      max_instances: 4,
      instances: [] as any[],
      last_heartbeat: null as string | null,
    };

    if (agentRes.rowCount && agentRes.rowCount > 0) {
      const a = agentRes.rows[0];
      agentData = {
        is_online: Boolean(a.is_online),
        lan_ip: a.lan_ip || "",
        base_port: a.base_port || 27015,
        max_instances: a.max_instances || 4,
        instances: a.instances_data || [],
        last_heartbeat: a.last_heartbeat,
      };
    }

    // 2. Fetch matches (last 20)
    const matchesRes = await query(
      `SELECT id, map_name, match_format, team1_name, team2_name, status, port, server_ip,
              score1, score2, created_at,
              COALESCE(rcon_last_command, '') as rcon_last_command,
              COALESCE(rcon_last_response, '') as rcon_last_response,
              COALESCE(game_state, '') as game_state,
              COALESCE(config_data, '{}'::jsonb) as config_data
       FROM club_cs2_matches
       WHERE club_id = $1
       ORDER BY created_at DESC
       LIMIT 20`,
      [parsedClubId]
    );

    return NextResponse.json({
      success: true,
      agent: agentData,
      matches: matchesRes.rows || [],
    });
  } catch (error: any) {
    const status = error?.status;
    if (status) {
      return NextResponse.json({ error: status === 401 ? "Unauthorized" : "Forbidden" }, { status });
    }
    console.error("[CS2 Status Error]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
