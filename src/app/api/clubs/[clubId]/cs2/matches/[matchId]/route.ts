import { NextResponse } from "next/server";
import { query } from "@/db";
import { requireClubFullAccess } from "@/lib/club-api-access";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ clubId: string; matchId: string }> }
) {
  try {
    const { clubId, matchId } = await params;
    await requireClubFullAccess(clubId);

    const parsedClubId = parseInt(clubId, 10);
    if (isNaN(parsedClubId)) {
      return NextResponse.json({ error: "Invalid club ID" }, { status: 400 });
    }

    // Update match status
    await query(
      `UPDATE club_cs2_matches SET status = 'stopped', updated_at = NOW() WHERE id = $1 AND club_id = $2`,
      [matchId, parsedClubId]
    );

    // Enqueue STOP_MATCH command
    await query(
      `INSERT INTO club_cs2_commands (club_id, command_type, match_id, payload, status)
       VALUES ($1, 'STOP_MATCH', $2, '{}'::jsonb, 'pending')`,
      [parsedClubId, matchId]
    );

    // Send directly over active WebSocket if connected
    const wsSet = (global as any).__cs2ClubSockets?.get(parsedClubId);
    if (wsSet && wsSet.size > 0) {
      const msg = JSON.stringify({
        type: "STOP_MATCH",
        match_id: matchId,
      });
      for (const ws of wsSet) {
        if (ws.readyState === 1) {
          try { ws.send(msg); } catch (e) {}
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: "Команда остановки матча отправлена на сервер!",
    });
  } catch (error: any) {
    const status = error?.status;
    if (status) {
      return NextResponse.json({ error: status === 401 ? "Unauthorized" : "Forbidden" }, { status });
    }
    console.error("[CS2 Stop Match Error]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ clubId: string; matchId: string }> }
) {
  return DELETE(request, { params });
}
