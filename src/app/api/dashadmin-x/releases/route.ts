import { NextRequest, NextResponse } from "next/server";
import { query } from "@/db";
import { cookies } from "next/headers";
import { isSuperAdmin } from "@/lib/admin";
import { verifySessionValue } from "@/lib/session";
import { uploadFileToS3 } from "@/lib/s3";
import { ensureReleasesTable } from "@/lib/releases";
import crypto from "crypto";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes for large binary uploads

// Ensure current user is Super Admin
async function ensureSuperAdmin() {
  try {
    const rawCookie = (await cookies()).get("session_user_id")?.value;
    if (!rawCookie) {
      return {
        ok: false as const,
        response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      };
    }

    const userId = verifySessionValue(rawCookie) || rawCookie;
    if (!userId) {
      return {
        ok: false as const,
        response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      };
    }

    const adminCheck = await query(
      `SELECT is_super_admin, phone_number FROM users WHERE id = $1`,
      [userId]
    );

    const user = adminCheck.rows[0];
    const canAccess = isSuperAdmin(
      user?.is_super_admin,
      userId,
      user?.phone_number
    );

    if (!canAccess) {
      return {
        ok: false as const,
        response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      };
    }

    return { ok: true as const, userId };
  } catch (err: any) {
    console.error("SuperAdmin check failed:", err);
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Auth verification failed" }, { status: 401 }),
    };
  }
}

// GET: list releases
export async function GET() {
  try {
    const auth = await ensureSuperAdmin();
    if (!auth.ok) return auth.response;

    await ensureReleasesTable();

    const res = await query(
      `SELECT id, app_name, version, download_url, file_size_bytes, original_filename,
              checksum_sha256, changelog, is_active, created_at
       FROM app_releases
       WHERE app_name = 'dashfrag'
       ORDER BY created_at DESC`
    );

    return NextResponse.json({
      releases: res.rows.map((row) => ({
        id: row.id,
        appName: row.app_name,
        version: row.version,
        downloadUrl: row.download_url,
        fileSizeBytes: row.file_size_bytes ? Number(row.file_size_bytes) : null,
        originalFilename: row.original_filename,
        checksumSha256: row.checksum_sha256,
        changelog: row.changelog,
        isActive: Boolean(row.is_active),
        createdAt: row.created_at,
      })),
    });
  } catch (err: any) {
    console.error("Failed to list releases:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}

// POST: upload and publish new release
export async function POST(req: NextRequest) {
  try {
    const auth = await ensureSuperAdmin();
    if (!auth.ok) return auth.response;

    await ensureReleasesTable();

    const contentType = req.headers.get("content-type") || "";

    // 1. Direct JSON link (admin pastes ready download URL)
    if (contentType.includes("application/json")) {
      const body = await req.json();
      const version = body.version?.trim();
      const downloadUrl = body.downloadUrl?.trim();
      const changelog = body.changelog?.trim() || "";
      const originalFilename = body.filename?.trim() || `DashFrag-${version}.exe`;
      const fileSizeBytes = body.fileSizeBytes ? Number(body.fileSizeBytes) : null;
      const isActive = body.isActive !== false;

      if (!downloadUrl) {
        return NextResponse.json({ error: "Укажите прямую ссылку на скачивание" }, { status: 400 });
      }
      if (!version) {
        return NextResponse.json({ error: "Укажите номер версии" }, { status: 400 });
      }

      if (isActive) {
        await query(`UPDATE app_releases SET is_active = false WHERE app_name = 'dashfrag'`);
      }

      const insertRes = await query(
        `INSERT INTO app_releases (
           app_name, version, download_url, file_size_bytes, original_filename, changelog, is_active
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        ["dashfrag", version, downloadUrl, fileSizeBytes, originalFilename, changelog, isActive]
      );

      const created = insertRes.rows[0];
      return NextResponse.json({
        success: true,
        release: {
          id: created.id,
          appName: created.app_name,
          version: created.version,
          downloadUrl: created.download_url,
          fileSizeBytes: created.file_size_bytes ? Number(created.file_size_bytes) : null,
          originalFilename: created.original_filename,
          checksumSha256: created.checksum_sha256,
          changelog: created.changelog,
          isActive: Boolean(created.is_active),
          createdAt: created.created_at,
        },
      });
    }

    // 2. Direct binary octet-stream upload (bypasses FormData undici parser)
    if (contentType.includes("application/octet-stream")) {
      const searchParams = req.nextUrl.searchParams;
      const rawVersion = req.headers.get("x-version") || searchParams.get("version") || "";
      const rawFilename = req.headers.get("x-filename") || searchParams.get("filename") || "";
      const rawChangelog = req.headers.get("x-changelog") || searchParams.get("changelog") || "";
      const rawIsActive = req.headers.get("x-is-active") || searchParams.get("isActive") || "true";

      const version = decodeURIComponent(rawVersion).trim();
      const originalFilename = decodeURIComponent(rawFilename).trim() || `DashFrag-${version}.exe`;
      const changelog = decodeURIComponent(rawChangelog).trim();
      const isActive = rawIsActive !== "false" && rawIsActive !== "0";

      if (!version) {
        return NextResponse.json({ error: "Укажите номер версии" }, { status: 400 });
      }

      const arrayBuffer = await req.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const fileSizeBytes = buffer.length;

      if (fileSizeBytes === 0) {
        return NextResponse.json({ error: "Получен пустой файл" }, { status: 400 });
      }

      const expectedSize = req.headers.get("x-expected-size") || searchParams.get("expectedSize");
      if (expectedSize && Number(expectedSize) > 0 && Number(expectedSize) !== fileSizeBytes) {
        return NextResponse.json(
          {
            error: `Файл повреждён при передаче: исходный размер ${expectedSize} байт, а сервер получил только ${fileSizeBytes} байт. Загрузка отменена.`,
          },
          { status: 400 }
        );
      }

      const checksumSha256 = crypto.createHash("sha256").update(buffer).digest("hex");

      const downloadUrl = await uploadFileToS3(
        buffer,
        originalFilename,
        "application/octet-stream",
        "releases/dashfrag",
        {
          contentDisposition: `attachment; filename="${encodeURIComponent(originalFilename)}"`,
        }
      );

      if (isActive) {
        await query(`UPDATE app_releases SET is_active = false WHERE app_name = 'dashfrag'`);
      }

      const insertRes = await query(
        `INSERT INTO app_releases (
           app_name, version, download_url, file_size_bytes, original_filename,
           checksum_sha256, changelog, is_active
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, app_name, version, download_url, file_size_bytes, original_filename,
                   checksum_sha256, changelog, is_active, created_at`,
        [
          "dashfrag",
          version,
          downloadUrl,
          fileSizeBytes,
          originalFilename,
          checksumSha256,
          changelog,
          isActive,
        ]
      );

      const created = insertRes.rows[0];
      return NextResponse.json({
        success: true,
        release: {
          id: created.id,
          appName: created.app_name,
          version: created.version,
          downloadUrl: created.download_url,
          fileSizeBytes: Number(created.file_size_bytes),
          originalFilename: created.original_filename,
          checksumSha256: created.checksum_sha256,
          changelog: created.changelog,
          isActive: Boolean(created.is_active),
          createdAt: created.created_at,
        },
      });
    }

    // 3. Fallback: multipart/form-data
    let file: File | null = null;
    let version = "";
    let changelog = "";
    let isActive = true;

    try {
      const formData = await req.formData();
      file = formData.get("file") as File | null;
      version = (formData.get("version") as string)?.trim() || "";
      changelog = (formData.get("changelog") as string)?.trim() || "";
      isActive = formData.get("isActive") === "true" || formData.get("isActive") === "1";
    } catch (e: any) {
      console.warn("req.formData() failed, falling back:", e.message);
      return NextResponse.json(
        { error: "Ошибка парсинга файла. Попробуйте обновить страницу или загрузить повторно." },
        { status: 400 }
      );
    }

    if (!file) {
      return NextResponse.json({ error: "Файл не передан" }, { status: 400 });
    }

    if (!version) {
      return NextResponse.json({ error: "Укажите номер версии" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const originalFilename = file.name || `DashFrag-${version}.exe`;
    const mimeType = file.type || "application/octet-stream";
    const fileSizeBytes = buffer.length;

    const checksumSha256 = crypto.createHash("sha256").update(buffer).digest("hex");

    const downloadUrl = await uploadFileToS3(
      buffer,
      originalFilename,
      mimeType,
      "releases/dashfrag",
      {
        contentDisposition: `attachment; filename="${encodeURIComponent(originalFilename)}"`,
      }
    );

    if (isActive) {
      await query(`UPDATE app_releases SET is_active = false WHERE app_name = 'dashfrag'`);
    }

    const insertRes = await query(
      `INSERT INTO app_releases (
         app_name, version, download_url, file_size_bytes, original_filename,
         checksum_sha256, changelog, is_active
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, app_name, version, download_url, file_size_bytes, original_filename,
                 checksum_sha256, changelog, is_active, created_at`,
      [
        "dashfrag",
        version,
        downloadUrl,
        fileSizeBytes,
        originalFilename,
        checksumSha256,
        changelog,
        isActive,
      ]
    );

    const created = insertRes.rows[0];

    return NextResponse.json({
      success: true,
      release: {
        id: created.id,
        appName: created.app_name,
        version: created.version,
        downloadUrl: created.download_url,
        fileSizeBytes: Number(created.file_size_bytes),
        originalFilename: created.original_filename,
        checksumSha256: created.checksum_sha256,
        changelog: created.changelog,
        isActive: Boolean(created.is_active),
        createdAt: created.created_at,
      },
    });
  } catch (err: any) {
    console.error("Release upload failed:", err);
    return NextResponse.json({ error: err.message || "Ошибка загрузки релиза" }, { status: 500 });
  }
}
