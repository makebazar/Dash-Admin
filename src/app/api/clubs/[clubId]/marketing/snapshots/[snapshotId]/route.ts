import { NextResponse } from "next/server";
import { query } from "@/db";
import { requireClubApiAccess } from "@/lib/club-api-access";
import { ensureMarketingSnapshotsTable } from "@/lib/marketing-db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ clubId: string; snapshotId: string }> }
) {
  try {
    const { clubId, snapshotId } = await params;
    await requireClubApiAccess(clubId);
    await ensureMarketingSnapshotsTable();

    const result = await query(
      `SELECT * FROM marketing_snapshots WHERE id = $1 AND club_id = $2`,
      [snapshotId, clubId]
    );

    if ((result.rowCount || 0) === 0) {
      return NextResponse.json(
        { error: "Срез не найден" },
        { status: 404 }
      );
    }

    return NextResponse.json(result.rows[0]);
  } catch (error: any) {
    console.error("Get marketing snapshot by ID error:", error);
    const status = typeof error?.status === "number" ? error.status : 500;
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ clubId: string; snapshotId: string }> }
) {
  try {
    const { clubId, snapshotId } = await params;
    await requireClubApiAccess(clubId);
    await ensureMarketingSnapshotsTable();

    const result = await query(
      `DELETE FROM marketing_snapshots WHERE id = $1 AND club_id = $2 RETURNING id`,
      [snapshotId, clubId]
    );

    if ((result.rowCount || 0) === 0) {
      return NextResponse.json(
        { error: "Срез не найден" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, deletedId: snapshotId });
  } catch (error: any) {
    console.error("Delete marketing snapshot error:", error);
    const status = typeof error?.status === "number" ? error.status : 500;
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status }
    );
  }
}
