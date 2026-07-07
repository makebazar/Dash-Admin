import { NextResponse } from "next/server";
import { cookies } from "next/headers";

// GET /api/promo/auth/cookies — Get current session cookies to sync with local agent
export async function GET() {
  try {
    const cookieStore = await cookies();
    const playerId = cookieStore.get("promo_player_id")?.value;
    const activeClubId = cookieStore.get("promo_active_club_id")?.value;

    if (!playerId || !activeClubId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allCookies = cookieStore.getAll();
    const cookieString = allCookies.map(c => `${c.name}=${c.value}`).join("; ");

    return NextResponse.json({ cookies: cookieString });
  } catch (error) {
    console.error("Failed to get session cookies:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
