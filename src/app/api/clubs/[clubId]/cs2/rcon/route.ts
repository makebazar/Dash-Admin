import { NextResponse } from "next/server";
import { query } from "@/db";
import { requireClubFullAccess } from "@/lib/club-api-access";
import { broadcastSseCommand } from "@/lib/cs2/sse";

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
    const matchId = String(body.match_id || "").trim();
    const command = String(body.command || "").trim();

    if (!matchId || !command) {
      return NextResponse.json(
        { error: "match_id и command обязательны" },
        { status: 400 }
      );
    }

    // 1. Ensure table column exists
    await query(`
      ALTER TABLE club_cs2_matches ADD COLUMN IF NOT EXISTS rcon_last_command VARCHAR(255);
      ALTER TABLE club_cs2_matches ADD COLUMN IF NOT EXISTS rcon_last_response TEXT;
    `).catch(() => {});

    // 2. Record command in match record
    await query(
      `UPDATE club_cs2_matches
       SET rcon_last_command = $1, rcon_last_response = 'Ожидание ответа сервера...', updated_at = NOW()
       WHERE id = $2 AND club_id = $3`,
      [command, matchId, parsedClubId]
    );

    // 3. Enqueue command for agent fallback
    await query(
      `INSERT INTO club_cs2_commands (club_id, command_type, match_id, payload, status)
       VALUES ($1, 'RCON_COMMAND', $2, $3, 'pending')`,
      [parsedClubId, matchId, JSON.stringify({ command })]
    );

    // 4. Send directly via SSE (0ms latency)
    broadcastSseCommand(parsedClubId, {
      type: "RCON_COMMAND",
      match_id: matchId,
      command: command,
    });

    return NextResponse.json({
      success: true,
      message: `RCON команда "${command}" отправлена на сервер!`,
    });
  } catch (error: any) {
    const status = error?.status;
    if (status) {
      return NextResponse.json({ error: status === 401 ? "Unauthorized" : "Forbidden" }, { status });
    }
    console.error("[CS2 RCON Error]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
