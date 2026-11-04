import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { revokePromoSession } from "@/lib/promo-session";

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const playerId = cookieStore.get("promo_player_id")?.value;
    const token = cookieStore.get("promo_player_token")?.value;

    revokePromoSession(playerId, token);

    // Clear cookies explicitly
    cookieStore.delete({ name: "promo_player_id", path: "/" });
    cookieStore.delete({ name: "promo_active_club_id", path: "/" });
    cookieStore.delete({ name: "promo_player_token", path: "/" });

    const response = NextResponse.json({ success: true });
    response.cookies.delete("promo_player_id");
    response.cookies.delete("promo_active_club_id");
    response.cookies.delete("promo_player_token");

    return response;
  } catch (error) {
    console.error("Promo Logout Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
