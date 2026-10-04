import { NextResponse } from "next/server";
import { query } from "@/db";
import crypto from "crypto";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rawCode = String(body?.code || "").trim().replace(/[-\s]/g, "");

    if (!rawCode || rawCode.length < 1 || rawCode.length > 10) {
      return NextResponse.json(
        { error: "Код привязки должен содержать от 1 до 6 цифр" },
        { status: 400 }
      );
    }

    // 1. Ensure table exists
    await query(`
      CREATE TABLE IF NOT EXISTS club_cs2_pairing_codes (
        id SERIAL PRIMARY KEY,
        club_id INT NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
        code VARCHAR(10) NOT NULL,
        token VARCHAR(64) NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // 2. Check dynamic pairing codes first
    const pairRes = await query(
      `SELECT p.club_id, p.token, c.name as club_name
       FROM club_cs2_pairing_codes p
       JOIN clubs c ON c.id = p.club_id
       WHERE p.code = $1 AND p.expires_at > NOW()
       ORDER BY p.created_at DESC
       LIMIT 1`,
      [rawCode]
    );

    if (pairRes.rowCount && pairRes.rowCount > 0) {
      const match = pairRes.rows[0];
      // Clean up used code
      await query(`DELETE FROM club_cs2_pairing_codes WHERE code = $1`, [rawCode]);

      return NextResponse.json({
        success: true,
        club_id: match.club_id,
        club_name: match.club_name,
        club_token: match.token,
        cloud_ws_url: `wss://mydashadmin.ru/api/clubs/${match.club_id}/cs2/ws`,
      });
    }

    // 3. Fallback: Direct Club ID match (e.g. "000001" or "1" for Club #1)
    const numericId = parseInt(rawCode, 10);
    if (!isNaN(numericId) && numericId > 0) {
      const clubRes = await query(
        `SELECT id, name FROM clubs WHERE id = $1 LIMIT 1`,
        [numericId]
      );

      if (clubRes.rowCount && clubRes.rowCount > 0) {
        const club = clubRes.rows[0];
        const generatedToken = crypto.createHash("sha256")
          .update(`cs2_club_${club.id}_dashadmin_secret`)
          .digest("hex");

        return NextResponse.json({
          success: true,
          club_id: club.id,
          club_name: club.name,
          club_token: generatedToken,
          cloud_ws_url: `wss://mydashadmin.ru/api/clubs/${club.id}/cs2/ws`,
        });
      }
    }

    return NextResponse.json(
      { error: "Неверный или истекший код привязки. Проверьте код в панели mydashadmin.ru" },
      { status: 404 }
    );
  } catch (error: any) {
    console.error("[CS2 Pairing Error]", error);
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера привязки: " + (error?.message || "Unknown") },
      { status: 500 }
    );
  }
}
