import { NextRequest, NextResponse } from "next/server";
import { query } from "@/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const res = await query(
      `SELECT id, version, download_url, original_filename, file_size_bytes
       FROM app_releases
       WHERE app_name = 'dashfrag' AND is_active = true
       ORDER BY created_at DESC
       LIMIT 1`
    );

    if (res.rowCount === 0) {
      return new NextResponse(
        "Релиз DashFrag пока не опубликован в панели администратора.",
        { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } }
      );
    }

    const release = res.rows[0];

    const isJson = req.nextUrl.searchParams.get("json") === "true";
    if (isJson) {
      return NextResponse.json({
        url: release.download_url,
        version: release.version,
        filename: release.original_filename,
        size: release.file_size_bytes,
      });
    }

    // Redirect to direct S3 download URL
    return NextResponse.redirect(release.download_url, {
      status: 302,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (err: any) {
    console.error("Download route error:", err);
    return new NextResponse("Ошибка при получении ссылки на скачивание.", {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}
