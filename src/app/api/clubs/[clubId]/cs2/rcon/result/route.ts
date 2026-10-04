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
    const matchId = String(body.match_id || "").trim();
    const command = String(body.command || "").trim();
    const response = String(body.response || "").trim();
    const errorMsg = String(body.error || "").trim();

    const output = errorMsg ? `[Ошибка] ${errorMsg}` : (response || "[OK] Выполнено (пустой ответ)");

    await query(`
      ALTER TABLE club_cs2_matches ADD COLUMN IF NOT EXISTS rcon_last_command VARCHAR(255);
      ALTER TABLE club_cs2_matches ADD COLUMN IF NOT EXISTS rcon_last_response TEXT;
    `).catch(() => {});

    await query(
      `UPDATE club_cs2_matches
       SET rcon_last_command = $1, rcon_last_response = $2, updated_at = NOW()
       WHERE (id = $3 OR port = $4) AND club_id = $5`,
      [command, output, matchId, parseInt(matchId, 10) || 0, parsedClubId]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[CS2 RCON Result Error]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
