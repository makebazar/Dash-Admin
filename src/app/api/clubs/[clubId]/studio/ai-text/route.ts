import { NextResponse } from "next/server";
import { requireClubFullAccess } from "@/lib/club-api-access";
import { getClubBrand } from "@/lib/studio-brand";
import { MATERIAL_IDS, type MaterialId } from "@/lib/studio-types";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ clubId: string }> }) {
  try {
    const { clubId } = await params;
    await requireClubFullAccess(clubId);
    const body = await request.json();
    const promptType = body?.type || "quotes";
    const customPrompt = body?.prompt || "";
    const requestedMatId: MaterialId | undefined = (MATERIAL_IDS as readonly string[]).includes(body?.materialId)
      ? body.materialId
      : (MATERIAL_IDS as readonly string[]).includes(promptType)
      ? (promptType as MaterialId)
      : undefined;

    const { design, polzaKey } = await getClubBrand(clubId);
    const geminiKey = process.env.GEMINI_API_KEY;

    const sys = design.system;
    const materialBrief = requestedMatId ? sys?.materials?.find((m) => m.id === requestedMatId) : undefined;
    const limits = sys?.typography?.limits || { displayMaxWords: 4, titleMaxWords: 8, bodyMaxChars: 120 };

    const systemPrompt = `Ты профессиональный креативный SMM-копирайтер и бренд-стратег клуба "${design.brandName || "КЛУБ"}".
Твоя задача — сгенерировать тексты для публикации строго по Brand DNA клуба.

СТРОГИЕ ПРАВИЛА БРЕНД-СИСТЕМЫ:
1. ГОЛОС И ТОНАЛЬНОСТЬ:
   - Тон бренда: ${sys?.voice?.tone || design.tone || "живой, уверенный, современный геймерский"}.
   - Характер: ${sys?.personality?.join(", ") || "дерзкий, технологичный"}.
   ${sys?.positioning ? `- Позиционирование: ${sys.positioning}` : ""}
   ${sys?.voice?.dos?.length ? `- ЧТО ДЕЛАТЬ В ТЕКСТАХ (ОБЯЗАТЕЛЬНО):\n  * ${sys.voice.dos.join("\n  * ")}` : ""}
   ${sys?.voice?.donts?.length ? `- ЧЕГО ИЗБЕГАТЬ (СТРОЖАЙШЕ):\n  * ${sys.voice.donts.join("\n  * ")}` : ""}
   - Без мата, без банальных занудных клише.

2. ЖЕСТКИЕ ЛИМИТЫ ДЛИНЫ (ЧТОБЫ НЕ ЛОМАТЬ ВЁРСТКУ):
   - Главный заголовок ("title"): СТРОГО не более ${limits.displayMaxWords} слов! Ёмкий, ударный, в верхнем регистре.
   - Подзаголовок / надпись ("kicker"): СТРОГО не более ${limits.titleMaxWords} слов.
   - Каждый пункт списка ("items"): СТРОГО не более ${limits.bodyMaxChars} символов.

3. ИЕРАРХИЯ И АКЦЕНТ:
   ${materialBrief ? `- Бриф материала (${materialBrief.id}): цель="${materialBrief.goal}".` : ""}
   ${materialBrief ? `- Иерархия внимания: ${materialBrief.hierarchy.join(" → ")}.` : ""}
   ${materialBrief ? `- Правило акцента: ${materialBrief.accentUsage}. Ровно ОДИН ключевой триггер несёт главную ценность!` : ""}

Отвечай СТРОГО валидным JSON без markdown:
{
  "title": "ГЛАВНЫЙ ЗАГОЛОВОК (до ${limits.displayMaxWords} слов)",
  "kicker": "Подзаголовок или надпись над заголовком (до ${limits.titleMaxWords} слов)",
  "items": [
    "Пункт 1 (до ${limits.bodyMaxChars} символов)",
    "Пункт 2...",
    "Пункт 3..."
  ],
  "accentItem": "Тот самый единственный акцентный элемент (напр. '50 000 ₽' или '1+1=3')"
}`;

    let userInstruction = "";
    if (requestedMatId === "tournament" || promptType === "tournaments") {
      userInstruction = `Придумай заголовок и 3-4 турнира для анонса в клубе (дисциплина, призовой фонд, формат). ${customPrompt ? `Пожелания: ${customPrompt}` : ""}`;
    } else if (requestedMatId === "promo" || promptType === "promo") {
      userInstruction = `Придумай название акции и 3 ключевых выгоды/условия акции для гостей клуба. ${customPrompt ? `Пожелания: ${customPrompt}` : ""}`;
    } else if (requestedMatId === "tariffs" || promptType === "tariffs") {
      userInstruction = `Придумай заголовок и 3-4 ключевых тарифа/пакета времени клуба с ценами и преимуществами. ${customPrompt ? `Пожелания: ${customPrompt}` : ""}`;
    } else if (requestedMatId === "meme" || promptType === "quotes") {
      userInstruction = `Придумай цепляющий заголовок и 5-6 смешных/жизненных геймерских фраз для серии постов. ${customPrompt ? `Тема: ${customPrompt}` : "Тема: фразы в компьютерном клубе"}`;
    } else {
      userInstruction = customPrompt || "Придумай заголовок и 3 коротких тезиса для клубного объявления.";
    }

    let raw: string | null = null;

    if (polzaKey) {
      try {
        const res = await fetch("https://polza.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${polzaKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "anthropic/claude-haiku-5.5",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userInstruction },
            ],
            temperature: 0.5,
            max_tokens: 4096,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          raw = data.choices?.[0]?.message?.content || null;
        }
      } catch (err) {
        console.warn("Polza ai-text error:", err);
      }
    }

    if (!raw && geminiKey) {
      try {
        const gRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: `${systemPrompt}\n\n${userInstruction}` }] }],
              generationConfig: {
                responseMimeType: "application/json",
                temperature: 0.5,
                maxOutputTokens: 4096,
              },
            }),
          }
        );
        if (gRes.ok) {
          const gData = await gRes.json();
          raw = gData.candidates?.[0]?.content?.parts?.[0]?.text || null;
        }
      } catch (err) {
        console.warn("Gemini ai-text error:", err);
      }
    }

    if (raw) {
      const clean = raw.replace(/```json/gi, "").replace(/```/gi, "").trim();
      try {
        const parsed = JSON.parse(clean);
        return NextResponse.json(parsed);
      } catch {
        return NextResponse.json({ raw });
      }
    }

    // Запасной генератор, если ИИ недоступен
    if (requestedMatId === "tournament" || promptType === "tournaments") {
      return NextResponse.json({
        title: "ТУРНИР DOTA 2",
        kicker: "АРЕНА КЛУБА · 5X5",
        items: ["DOTA 2 — 50 000 ₽", "CS2 — 70 000 ₽", "VALORANT — 30 000 ₽"],
        accentItem: "50 000 ₽",
      });
    }

    return NextResponse.json({
      title: "НОЧНОЙ ПАКЕТ",
      kicker: "С 22:00 ДО 08:00",
      items: ["STANDARD — 450 ₽", "BOOTCAMP — 650 ₽", "VIP LOUNGE — 850 ₽"],
      accentItem: "450 ₽",
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Internal Server Error" },
      { status: typeof e?.status === "number" ? e.status : 500 }
    );
  }
}
