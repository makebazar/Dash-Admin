import { NextResponse } from "next/server";
import { query } from "@/db";
import { requireClubApiAccess } from "@/lib/club-api-access";
import { ensureMarketingSnapshotsTable } from "@/lib/marketing-db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ clubId: string }> }
) {
  try {
    const { clubId } = await params;
    await requireClubApiAccess(clubId);
    await ensureMarketingSnapshotsTable();

    const result = await query(
      `SELECT 
        id, 
        name, 
        period_start, 
        period_end, 
        file_names, 
        summary_metrics, 
        created_at,
        jsonb_array_length(COALESCE(guests_data, '[]'::jsonb)) as guests_count,
        jsonb_array_length(COALESCE(pc_data, '[]'::jsonb)) as pc_count
       FROM marketing_snapshots 
       WHERE club_id = $1 
       ORDER BY created_at DESC`,
      [clubId]
    );

    return NextResponse.json(result.rows);
  } catch (error: any) {
    console.error("Get marketing snapshots error:", error);
    const status = typeof error?.status === "number" ? error.status : 500;
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status }
    );
  }
}

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ clubId: string }> }
) {
  try {
    const { clubId } = await params;
    await requireClubApiAccess(clubId);
    await ensureMarketingSnapshotsTable();

    let body: any;
    try {
      body = await request.json();
    } catch (parseErr: any) {
      console.error("Snapshots POST JSON parse error:", parseErr);
      return NextResponse.json(
        { error: "Некорректный или слишком большой объем данных: " + (parseErr?.message || "ошибка парсинга") },
        { status: 400 }
      );
    }
    const {
      name,
      period_start,
      period_end,
      file_names,
      summary_metrics,
      guests_data,
      pc_data,
    } = body;

    if (!name || typeof name !== "string") {
      return NextResponse.json(
        { error: "Название среза обязательно" },
        { status: 400 }
      );
    }

    const insertResult = await query(
      `INSERT INTO marketing_snapshots (
        club_id, 
        name, 
        period_start, 
        period_end, 
        file_names, 
        summary_metrics, 
        guests_data, 
        pc_data
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, name, period_start, period_end, file_names, summary_metrics, created_at`,
      [
        clubId,
        name.trim(),
        period_start || null,
        period_end || null,
        file_names || [],
        JSON.stringify(summary_metrics || {}),
        JSON.stringify(guests_data || []),
        JSON.stringify(pc_data || []),
      ]
    );

    return NextResponse.json({
      success: true,
      snapshot: insertResult.rows[0],
    });
  } catch (error: any) {
    console.error("Create marketing snapshot error:", error);
    const status = typeof error?.status === "number" ? error.status : 500;
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status }
    );
  }
}
