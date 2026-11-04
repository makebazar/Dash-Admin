import { NextResponse } from "next/server";
import { query } from "@/db";
import { ensureReleasesTable } from "@/lib/releases";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureReleasesTable();

    const res = await query(
      `SELECT id, app_name, version, download_url, file_size_bytes, original_filename, changelog, created_at
       FROM app_releases
       WHERE app_name = 'dashfrag' AND is_active = true
       ORDER BY created_at DESC
       LIMIT 1`
    );

    if (res.rowCount === 0) {
      return NextResponse.json({ release: null });
    }

    const row = res.rows[0];
    return NextResponse.json({
      release: {
        id: row.id,
        appName: row.app_name,
        version: row.version,
        downloadUrl: row.download_url,
        fileSizeBytes: row.file_size_bytes ? Number(row.file_size_bytes) : null,
        originalFilename: row.original_filename,
        changelog: row.changelog,
        createdAt: row.created_at,
      },
    });
  } catch (err: any) {
    console.error("Failed to get frag release:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
