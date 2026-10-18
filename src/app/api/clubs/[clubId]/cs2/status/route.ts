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

      ALTER TABLE club_cs2_agents ADD COLUMN IF NOT EXISTS dota_bots JSONB DEFAULT '[]'::jsonb;
      ALTER TABLE club_cs2_agents ADD COLUMN IF NOT EXISTS dota_total_bots INT DEFAULT 0;
      ALTER TABLE club_cs2_agents ADD COLUMN IF NOT EXISTS dota_available_bots INT DEFAULT 0;
    `);

    // 1. Fetch agent state (pick freshest active agent for this club)
    const agentRes = await query(
      `SELECT club_id, lan_ip, base_port, max_instances, instances_data, dota_bots, dota_total_bots, dota_available_bots, last_heartbeat,
              (last_heartbeat > NOW() - INTERVAL '60 seconds') as is_online
       FROM club_cs2_agents
       WHERE club_id = $1
       ORDER BY last_heartbeat DESC
       LIMIT 1`,
      [parsedClubId]
    );

    const activeDotaRes = await query(
      `SELECT count(*)::int as count FROM club_dota_matches WHERE club_id = $1 AND status IN ('starting', 'lobby_ready', 'live')`,
      [parsedClubId]
    ).catch(() => ({ rows: [{ count: 0 }] }));
    const activeDotaCount = activeDotaRes.rows[0]?.count || 0;

    let agentData = {
      is_online: false,
      lan_ip: "",
      base_port: 27015,
      max_instances: 4,
      instances: [] as any[],
      dota_total_bots: 0,
      dota_available_bots: 0,
      dota_bots: [] as any[],
      last_heartbeat: null as string | null,
    };

    if (agentRes.rowCount && agentRes.rowCount > 0) {
      const a = agentRes.rows[0];
      const isOnline = Boolean(a.is_online);
      const reportedTotal = typeof a.dota_total_bots === "number" && a.dota_total_bots > 0
        ? a.dota_total_bots
        : (Array.isArray(a.dota_bots) && a.dota_bots.length > 0 ? a.dota_bots.length : 1);
      const reportedAvailable = typeof a.dota_available_bots === "number" ? a.dota_available_bots : reportedTotal;
      const computedAvailable = Math.max(0, reportedTotal - activeDotaCount);
      const effectiveAvailable = isOnline
        ? Math.min(reportedAvailable, computedAvailable)
        : 0;

      agentData = {
        is_online: isOnline,
        lan_ip: a.lan_ip || "",
        base_port: a.base_port || 27015,
        max_instances: a.max_instances || 4,
        instances: a.instances_data || [],
        dota_total_bots: reportedTotal,
        dota_available_bots: effectiveAvailable,
        dota_bots: a.dota_bots || [],
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

    // 3. Fetch Dota matches (last 20)
    const dotaMatchesRes = await query(
      `SELECT id, tournament_match_id, lobby_id, game_name, game_mode, server_region, status,
              team1_name, team2_name, score1, score2, bot_id, created_at, updated_at
       FROM club_dota_matches
       WHERE club_id = $1
       ORDER BY updated_at DESC
       LIMIT 20`,
      [parsedClubId]
    ).catch(() => ({ rows: [] }));

    return NextResponse.json({
      success: true,
      agent: agentData,
      matches: matchesRes.rows || [],
      dota_matches: dotaMatchesRes.rows || [],
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
