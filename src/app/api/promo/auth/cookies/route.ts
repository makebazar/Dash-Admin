import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  extractClientIp,
  getAgentSessionByIp,
  isPromoSessionValid,
  registerBrowserSession,
} from "@/lib/promo-session";

export const dynamic = "force-dynamic";

function sanitizeCookieValue(val?: string): string | null {
  if (!val) return null;
  let decoded = val;
  try {
    decoded = decodeURIComponent(val);
  } catch {
    decoded = val;
  }
  let clean = decoded.trim().replace(/^s:/, "").replace(/^"|"$/g, "");
  if (clean.includes(".")) {
    clean = clean.split(".")[0];
  }
  return clean || null;
}

// GET /api/promo/auth/cookies — Get current session cookies to sync with local agent
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const fromAgent = searchParams.get("fromAgent") === "1" || request.headers.get("x-dashfrag-agent") === "1";
    const clientIp = extractClientIp(request);

    if (fromAgent) {
      // Agents running on PCs in a club network should NEVER automatically inherit
      // sessions based on public WAN IP, because all PCs share the exact same WAN IP.
      // Sessions are strictly pushed to each PC's agent locally via localhost:3033/promo/set-cookies.
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const cookieStore = await cookies();
    const rawPlayerId = cookieStore.get("promo_player_id")?.value;
    const rawActiveClubId = cookieStore.get("promo_active_club_id")?.value;
    const rawToken = cookieStore.get("promo_player_token")?.value;

    const playerId = sanitizeCookieValue(rawPlayerId);
    const activeClubId = sanitizeCookieValue(rawActiveClubId);
    const token = sanitizeCookieValue(rawToken);

    if (!playerId || !activeClubId || !isPromoSessionValid(cookieStore, playerId, false)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parts = [
      `promo_player_id=${playerId}`,
      `promo_active_club_id=${activeClubId}`,
    ];
    if (token) {
      parts.push(`promo_player_token=${token}`);
    }

    const cookieString = parts.join("; ");
    registerBrowserSession(playerId, clientIp, cookieString);

    return NextResponse.json({ cookies: cookieString, playerId, activeClubId });
  } catch (error) {
    console.error("Failed to get session cookies:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
