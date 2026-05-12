import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();

    // Clear cookies
    cookieStore.delete("promo_player_id");
    cookieStore.delete("promo_active_club_id");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Promo Logout Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
