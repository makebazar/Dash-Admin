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
    const matchId = body.match_id;
    const status = body.status;
    const port = body.port;
    const serverIp = body.server_ip;

    if (matchId) {
      if (port) {
        await query(
          `UPDATE club_cs2_matches SET status = COALESCE($1, status), port = $2, server_ip = COALESCE($3, server_ip), updated_at = NOW() WHERE id = $4 AND club_id = $5`,
          [status, port, serverIp, matchId, parsedClubId]
        );
      } else {
        await query(
          `UPDATE club_cs2_matches SET status = COALESCE($1, status), updated_at = NOW() WHERE id = $2 AND club_id = $3`,
          [status, matchId, parsedClubId]
        );
      }

      // Notify tournament lobby in real time
      const cleanMatchId = String(matchId).replace("dm-tourney-", "").replace("dm-", "");
      const numMatchId = parseInt(cleanMatchId, 10);
      if (!isNaN(numMatchId)) {
        const lowerStatus = String(status).toLowerCase();
        if (["running", "warmup", "knife", "live", "ready"].includes(lowerStatus)) {
          await query(
            `UPDATE tournament_matches SET status = 'LIVE' WHERE id = $1 AND status != 'FINISHED'`,
            [numMatchId]
          ).catch(() => {});
        } else if (lowerStatus === "starting") {
          await query(
            `UPDATE tournament_matches SET status = 'STARTING' WHERE id = $1 AND status != 'FINISHED'`,
            [numMatchId]
          ).catch(() => {});
        }
      }
      await query(`SELECT pg_notify('match_lobby_updates', $1)`, [cleanMatchId]).catch(() => {});
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[CS2 Match Status Update Error]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
