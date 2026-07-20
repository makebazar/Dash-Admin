import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

function sanitizeCookieValue(val?: string): string | null {
  if (!val) return null;
  let clean = decodeURIComponent(val).trim().replace(/^s:/, '').replace(/^"|"$/g, '');
  if (clean.includes('.')) {
    clean = clean.split('.')[0];
  }
  return clean || null;
}

// GET /api/promo/auth/cookies — Get current session cookies to sync with local agent
export async function GET() {
  try {
    const cookieStore = await cookies();
    const rawPlayerId = cookieStore.get("promo_player_id")?.value;
    const rawActiveClubId = cookieStore.get("promo_active_club_id")?.value;

    const playerId = sanitizeCookieValue(rawPlayerId);
    const activeClubId = sanitizeCookieValue(rawActiveClubId);

    if (!playerId || !activeClubId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allCookies = cookieStore.getAll();
    const sanitizedCookieArray = allCookies.map(c => {
      const cleanVal = sanitizeCookieValue(c.value) || c.value;
      return `${c.name}=${cleanVal}`;
    });

    // Ensure promo_player_id and promo_active_club_id are clean
    if (!sanitizedCookieArray.some(c => c.startsWith("promo_player_id="))) {
      sanitizedCookieArray.push(`promo_player_id=${playerId}`);
    }
    if (!sanitizedCookieArray.some(c => c.startsWith("promo_active_club_id="))) {
      sanitizedCookieArray.push(`promo_active_club_id=${activeClubId}`);
    }

    const cookieString = sanitizedCookieArray.join("; ");

    return NextResponse.json({ cookies: cookieString, playerId, activeClubId });
  } catch (error) {
    console.error("Failed to get session cookies:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
