import { NextResponse } from "next/server";
import { query } from "@/db";
import { requireClubFullAccess } from "@/lib/club-api-access";
import { broadcastSseCommand } from "@/lib/cs2/sse";
import crypto from "crypto";

export async function POST(
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

    const body = await request.json().catch(() => ({}));
    const mapName = (body.map_name || "de_dust2").trim();
    const matchFormat = (body.format || "5v5").trim();
    const team1Name = (body.team1_name || "Команда 1").trim();
    const team2Name = (body.team2_name || "Команда 2").trim();
    const knifeRound = Boolean(body.knife_round ?? true);
    const practiceMode = Boolean(body.practice_mode ?? false);
    const friendlyFire = Boolean(body.friendly_fire ?? false);
    const botTest = Boolean(body.bot_test ?? false);
    const team1Players = body.team1_players || {};
    const team2Players = body.team2_players || {};

    const configData = {
      knife_round: knifeRound,
      practice_mode: practiceMode,
      friendly_fire: friendlyFire,
      bot_test: botTest,
      team1_players: team1Players,
      team2_players: team2Players,
    };

    // 1. Check agent state to get IP and free port
    const agentRes = await query(
      `SELECT lan_ip, base_port, max_instances, instances_data,
              (last_heartbeat > NOW() - INTERVAL '30 seconds') as is_online
       FROM club_cs2_agents
       WHERE club_id = $1`,
      [parsedClubId]
    );

    const agent = agentRes.rows[0];
    const serverIp = agent?.lan_ip || "127.0.0.1";
    const basePort = agent?.base_port || 27015;

    // Generate unique short match ID
    const matchId = `dm-${Date.now().toString(36)}-${crypto.randomBytes(3).toString("hex")}`;

    // Ensure config_data column exists
    await query(`
      ALTER TABLE club_cs2_matches ADD COLUMN IF NOT EXISTS config_data JSONB DEFAULT '{}'::jsonb;
    `).catch(() => {});

    // 2. Insert match record
    await query(
      `INSERT INTO club_cs2_matches (id, club_id, map_name, match_format, team1_name, team2_name, status, port, server_ip, config_data)
       VALUES ($1, $2, $3, $4, $5, $6, 'starting', $7, $8, $9::jsonb)`,
      [matchId, parsedClubId, mapName, matchFormat, team1Name, team2Name, basePort, serverIp, JSON.stringify(configData)]
    );

    // 3. Enqueue START_MATCH command for the agent
    const configUrl = `https://mydashadmin.ru/api/clubs/${parsedClubId}/cs2/matches/${matchId}/config`;

    await query(
      `INSERT INTO club_cs2_commands (club_id, command_type, match_id, payload, status)
       VALUES ($1, 'START_MATCH', $2, $3, 'pending')`,
      [
        parsedClubId,
        matchId,
        JSON.stringify({
          map_name: mapName,
          config_url: configUrl,
          auth_token: `secret_${matchId}`,
        }),
      ]
    );

    // 4. Send directly over active SSE connection if agent is connected
    broadcastSseCommand(parsedClubId, {
      type: "START_MATCH",
      match_id: matchId,
      map_name: mapName,
      config_url: configUrl,
      auth_token: `secret_${matchId}`,
    });

    return NextResponse.json({
      success: true,
      match_id: matchId,
      server_ip: serverIp,
      port: basePort,
      connect_command: `connect ${serverIp}:${basePort}`,
      message: "Команда запуска матча отправлена на сервер клуба!",
    });
  } catch (error: any) {
    const status = error?.status;
    if (status) {
      return NextResponse.json({ error: status === 401 ? "Unauthorized" : "Forbidden" }, { status });
    }
    console.error("[CS2 Launch Match Error]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

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

    const matchesRes = await query(
      `SELECT * FROM club_cs2_matches WHERE club_id = $1 ORDER BY created_at DESC LIMIT 30`,
      [parsedClubId]
    );

    return NextResponse.json({
      success: true,
      matches: matchesRes.rows || [],
    });
  } catch (error: any) {
    const status = error?.status;
    if (status) {
      return NextResponse.json({ error: status === 401 ? "Unauthorized" : "Forbidden" }, { status });
    }
    console.error("[CS2 Get Matches Error]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
