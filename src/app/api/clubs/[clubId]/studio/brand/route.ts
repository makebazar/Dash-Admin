import { NextResponse } from "next/server";
import { query } from "@/db";
import { requireClubApiAccess, requireClubFullAccess } from "@/lib/club-api-access";
import { ensureClubBrandTable, getClubBrand, maskKey, sanitizeDesign } from "@/lib/studio-brand";

const fail = (e: any) =>
  NextResponse.json(
    { error: e?.message || "Internal Server Error" },
    { status: typeof e?.status === "number" ? e.status : 500 }
  );

const state = (b: Awaited<ReturnType<typeof getClubBrand>>) => ({
  design: b.design,
  keyMask: maskKey(b.polzaKey),
  designSaved: b.designSaved,
});

// Ключ целиком на клиент не отдаём — только маску.
export async function GET(_req: Request, { params }: { params: Promise<{ clubId: string }> }) {
  try {
    const { clubId } = await params;
    await requireClubApiAccess(clubId);
    return NextResponse.json(state(await getClubBrand(clubId)));
  } catch (e) {
    return fail(e);
  }
}

// Шаги независимы: body.design — сохранить дизайн-код; body.polzaKey — "" удалить, строка сохранить.
export async function PUT(request: Request, { params }: { params: Promise<{ clubId: string }> }) {
  try {
    const { clubId } = await params;
    await requireClubFullAccess(clubId);
    await ensureClubBrandTable();
    const body = await request.json();

    await query(`INSERT INTO club_brand (club_id) VALUES ($1) ON CONFLICT DO NOTHING`, [clubId]);
    if (body.design) {
      await query(`UPDATE club_brand SET design = $2, updated_at = NOW() WHERE club_id = $1`, [
        clubId,
        JSON.stringify(sanitizeDesign(body.design)),
      ]);
    }
    if (typeof body.polzaKey === "string") {
      await query(`UPDATE club_brand SET polza_api_key = $2, updated_at = NOW() WHERE club_id = $1`, [
        clubId,
        body.polzaKey.trim() || null,
      ]);
    }
    return NextResponse.json(state(await getClubBrand(clubId)));
  } catch (e) {
    return fail(e);
  }
}

// Проверка сохранённого ключа через каталог моделей Polza.ai
export async function POST(_req: Request, { params }: { params: Promise<{ clubId: string }> }) {
  try {
    const { clubId } = await params;
    await requireClubFullAccess(clubId);
    const { polzaKey } = await getClubBrand(clubId);
    if (!polzaKey) return NextResponse.json({ ok: false, error: "Ключ не задан" }, { status: 400 });
    const res = await fetch("https://polza.ai/api/v1/models", {
      headers: { Authorization: `Bearer ${polzaKey}` },
    });
    return NextResponse.json(
      res.ok ? { ok: true } : { ok: false, error: `Polza.ai ответил ${res.status}` },
      { status: res.ok ? 200 : 400 }
    );
  } catch (e) {
    return fail(e);
  }
}
