import { NextResponse } from "next/server";
import { query } from "@/db";
import { requireClubFullAccess } from "@/lib/club-api-access";
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

    // 2. Generate 6-digit code
    const randomCode = Math.floor(100000 + Math.random() * 900000).toString();
    const token = crypto.randomBytes(32).toString("hex");

    // Valid for 30 minutes
    const insertRes = await query(
      `INSERT INTO club_cs2_pairing_codes (club_id, code, token, expires_at)
       VALUES ($1, $2, $3, NOW() + INTERVAL '30 minutes')
       RETURNING code, expires_at`,
      [parsedClubId, randomCode, token]
    );

    return NextResponse.json({
      success: true,
      code: insertRes.rows[0].code,
      expires_at: insertRes.rows[0].expires_at,
      message: "Введите этот 6-значный код в консоли DashMatch (пункт 1)",
    });
  } catch (error: any) {
    const status = error?.status;
    if (status) {
      return NextResponse.json({ error: status === 401 ? "Unauthorized" : "Forbidden" }, { status });
    }
    console.error("[CS2 Gen Pair Code Error]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
