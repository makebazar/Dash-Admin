import { NextRequest, NextResponse } from "next/server";
import { query } from "@/db";
import { cookies } from "next/headers";
import { isSuperAdmin } from "@/lib/admin";
import { uploadFileToS3 } from "@/lib/s3";
import crypto from "crypto";

export const dynamic = "force-dynamic";

// Ensure current user is Super Admin
async function ensureSuperAdmin() {
  const userId = (await cookies()).get("session_user_id")?.value;
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

  const canAccess = isSuperAdmin(
    adminCheck.rows[0]?.is_super_admin,
    userId,
    adminCheck.rows[0]?.phone_number
  );

  if (!canAccess) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { ok: true as const, userId };
}

// GET: list releases
export async function GET() {
  try {
    const auth = await ensureSuperAdmin();
    if (!auth.ok) return auth.response;

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

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const version = (formData.get("version") as string)?.trim();
    const changelog = (formData.get("changelog") as string)?.trim() || "";
    const isActive = formData.get("isActive") === "true" || formData.get("isActive") === "1";

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

    // Checksum
    const checksumSha256 = crypto.createHash("sha256").update(buffer).digest("hex");

    // Upload to S3 with friendly attachment filename
    const downloadUrl = await uploadFileToS3(
      buffer,
      originalFilename,
      mimeType,
      "releases/dashfrag",
      {
        contentDisposition: `attachment; filename="${encodeURIComponent(originalFilename)}"`,
      }
    );

    // If active, deactivate previous active releases
    if (isActive) {
      await query(
        `UPDATE app_releases SET is_active = false WHERE app_name = 'dashfrag'`
      );
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
