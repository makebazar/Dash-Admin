import { NextResponse } from "next/server";
import { query } from "@/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const clubId = searchParams.get("clubId");

    if (!clubId) {
      return NextResponse.json(
        { error: "Club ID is required" },
        { status: 400 },
      );
    }

    const result = await query(
      `SELECT id, name, promo_settings FROM clubs WHERE id::text = $1 OR UPPER(public_id) = UPPER($1)`,
      [clubId],
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Club not found" }, { status: 404 });
    }

    const club = result.rows[0];

    return NextResponse.json({
      success: true,
      club: {
        id: club.id,
        name: club.name,
        settings: club.promo_settings,
      },
    });
  } catch (error) {
    console.error("Promo Public Info Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
