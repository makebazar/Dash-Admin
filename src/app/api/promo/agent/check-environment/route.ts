import { NextResponse } from "next/server";
import { query } from "@/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const clubId = searchParams.get("clubId");

    // Extract client IP address from request headers
    const forwardedFor = request.headers.get("x-forwarded-for");
    const realIp = request.headers.get("x-real-ip");
    const cfIp = request.headers.get("cf-connecting-ip");
    const rawIp = cfIp || realIp || (forwardedFor ? forwardedFor.split(",")[0].trim() : "127.0.0.1");
    const clientIp = rawIp.replace(/^::ffff:/, "");

    if (!clubId) {
      return NextResponse.json({ error: "Club ID is required" }, { status: 400 });
    }

    // Fetch club info & promo_settings
    const clubRes = await query(
      `SELECT id, name, ip_address, promo_settings FROM clubs WHERE id = $1`,
      [clubId]
    );

    if (clubRes.rowCount === 0) {
      return NextResponse.json({ error: "Club not found" }, { status: 404 });
    }

    const club = clubRes.rows[0];
    const registeredClubIp = (club.ip_address || club.promo_settings?.club_ip || "").trim();

    // Check if client IP matches registered club IP
    let isClubNetwork = false;
    if (registeredClubIp) {
      isClubNetwork = (clientIp === registeredClubIp);
    } else {
      // If no IP is configured in settings yet, default to active
      isClubNetwork = true;
    }

    return NextResponse.json({
      isClubNetwork,
      clientIp,
      clubId: club.id,
      clubName: club.name,
      registeredClubIp: registeredClubIp || "Локальная сеть / Не задан",
      gsiConfigStatus: "ok",
      agentVersion: "1.4.0-stable",
    });
  } catch (error) {
    console.error("Agent environment check error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
