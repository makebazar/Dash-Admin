import { NextResponse } from "next/server";
import { requireClubFullAccess } from "@/lib/club-api-access";
import { FORMATS, getClubBrand, type FormatId } from "@/lib/studio-brand";
import { buildImagePrompt } from "@/lib/studio-brand-rules";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

// Единственная модель: дешёвая и умеет прозрачный фон (docs: polza.ai/docs/gaidy/qwen-image-2.1).
const MODEL = "qwen/image-2.1";
const POLL_MS = 4000; // docs рекомендуют 3–5 с для изображений
const MAX_WAIT_MS = 100_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const errText = (j: any, status: number) => j?.error?.message || j?.message || `Polza.ai ответил ${status}`;

// body: { format, prompt, mode: "background" | "cutout", withMascot?, hd?, aspectRatio? }
// background — фон/сцена без текста; cutout — объект или маскот на прозрачном фоне (PNG).
// Надписи и логотип накладывает код-шаблон, поэтому ИИ просим их не рисовать.
export async function POST(request: Request, { params }: { params: Promise<{ clubId: string }> }) {
  try {
    const { clubId } = await params;
    await requireClubFullAccess(clubId);
    const body = await request.json();
    const formatKey = (body.format as FormatId) || "story";
    const fmt = FORMATS[formatKey] || FORMATS.story;
    const userPrompt = typeof body.prompt === "string" ? body.prompt.trim().slice(0, 1000) : "";
    if (!userPrompt) return NextResponse.json({ error: "Укажите описание для генерации" }, { status: 400 });
    const cutout = body.mode === "cutout";

    const { design, polzaKey, designSaved } = await getClubBrand(clubId);
    if (!polzaKey) return NextResponse.json({ error: "Сначала подключите API Polza.ai" }, { status: 400 });
    if (!designSaved) return NextResponse.json({ error: "Сначала сохраните дизайн-код" }, { status: 400 });

    const prompt = buildImagePrompt({
      userPrompt,
      mode: cutout ? "cutout" : "background",
      design,
      withMascot: !!body.withMascot,
    });

    const headers = { Authorization: `Bearer ${polzaKey}`, "Content-Type": "application/json" };
    const create = await fetch("https://polza.ai/api/v1/media", {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: MODEL,
        async: true,
        input: {
          prompt,
          aspect_ratio: body.aspectRatio || fmt.ratio,
          image_resolution: body.hd ? "2K" : "1K", // 2K вдвое дороже
          output_format: "png",
          background: cutout ? "transparent" : "opaque",
        },
      }),
    });
    const job = await create.json().catch(() => ({}));
    if (!create.ok || !job?.id) {
      return NextResponse.json({ error: errText(job, create.status) }, { status: 502 });
    }

    const deadline = Date.now() + MAX_WAIT_MS;
    while (Date.now() < deadline) {
      await sleep(POLL_MS);
      const st = await fetch(`https://polza.ai/api/v1/media/${job.id}`, { headers });
      const j = await st.json().catch(() => ({}));
      if (!st.ok) {
        console.error("[studio/generate] poll error:", st.status, j);
        return NextResponse.json({ error: errText(j, st.status) }, { status: 502 });
      }
      if (j.status === "completed") {
        const url = (Array.isArray(j.data) ? j.data[0]?.url : j.data?.url) || j.url || null;
        if (!url) {
          console.error("[studio/generate] completed without url:", j);
          return NextResponse.json({ error: "Polza.ai не вернул изображение" }, { status: 502 });
        }
        // результат живёт на CDN Polza.ai 7 дней
        return NextResponse.json({
          image: url,
          cost: j.usage?.cost_rub ?? j.usage?.cost ?? null,
          mode: cutout ? "cutout" : "background",
          targetField: body.targetField || null,
        });
      }
      if (j.status === "failed" || j.status === "cancelled") {
        console.error("[studio/generate] generation failed:", j);
        return NextResponse.json({ error: j.error?.message || "Генерация не удалась" }, { status: 502 });
      }
    }
    return NextResponse.json({ error: "Генерация идёт слишком долго, попробуйте ещё раз" }, { status: 504 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Internal Server Error" },
      { status: typeof e?.status === "number" ? e.status : 500 }
    );
  }
}
