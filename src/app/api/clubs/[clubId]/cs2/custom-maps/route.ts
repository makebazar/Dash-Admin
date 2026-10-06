import { NextResponse } from "next/server";
import { query } from "@/db";
import { requireClubFullAccess } from "@/lib/club-api-access";

async function ensureTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS club_cs2_custom_maps (
      id SERIAL PRIMARY KEY,
      club_id INT NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
      map_id VARCHAR(64) NOT NULL,
      name VARCHAR(128) NOT NULL,
      description TEXT,
      match_format VARCHAR(16) DEFAULT 'all',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_club_cs2_custom_maps_club_id ON club_cs2_custom_maps(club_id);
  `);
}

export async function GET(
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

    await ensureTable();

    const res = await query(
      `SELECT id, map_id, name, description, match_format, created_at 
       FROM club_cs2_custom_maps 
       WHERE club_id = $1 
       ORDER BY id DESC`,
      [parsedClubId]
    );

    return NextResponse.json({ maps: res.rows });
  } catch (error) {
    console.error("Error fetching custom maps:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

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

    const body = await request.json();
    const { map_id, name, description, match_format } = body;

    const cleanMapId = String(map_id || "").trim().replace(/[^0-9]/g, "");
    const cleanName = String(name || "").trim();

    if (!cleanMapId) {
      return NextResponse.json({ error: "ID карты из Steam Workshop обязателен (только цифры)" }, { status: 400 });
    }

    if (!cleanName) {
      return NextResponse.json({ error: "Название карты обязательно" }, { status: 400 });
    }

    await ensureTable();

    const res = await query(
      `INSERT INTO club_cs2_custom_maps (club_id, map_id, name, description, match_format)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        parsedClubId,
        cleanMapId,
        cleanName,
        description ? String(description).trim() : "Карта из Steam Workshop",
        match_format || "all",
      ]
    );

    return NextResponse.json({ success: true, map: res.rows[0] });
  } catch (error) {
    console.error("Error creating custom map:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
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

    const { searchParams } = new URL(request.url);
    const mapRecordId = parseInt(searchParams.get("id") || "", 10);

    if (isNaN(mapRecordId)) {
      return NextResponse.json({ error: "Invalid map record ID" }, { status: 400 });
    }

    await ensureTable();

    await query(
      `DELETE FROM club_cs2_custom_maps WHERE id = $1 AND club_id = $2`,
      [mapRecordId, parsedClubId]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting custom map:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
