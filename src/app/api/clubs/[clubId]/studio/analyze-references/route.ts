import { NextResponse } from "next/server";
import { requireClubFullAccess } from "@/lib/club-api-access";
import { getClubBrand } from "@/lib/studio-brand";
import { sanitizeDesign, MATERIAL_IDS, MATERIAL_LABELS } from "@/lib/studio-types";
import { auditBrand } from "@/lib/studio-brand-rules";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

// Только шрифты с кириллицей, которые реально загружены в студии
const FONT_WHITELIST = {
  display: ["Unbounded", "Russo One", "Rubik", "Montserrat", "Bebas Neue", "Oswald"],
  condensed: ["Oswald", "Bebas Neue", "Roboto Condensed", "Russo One"],
  mono: ["JetBrains Mono", "IBM Plex Mono", "Roboto Mono", "Fira Code"],
};

const MATERIALS_LIST = MATERIAL_IDS.map((id) => `"${id}" (${MATERIAL_LABELS[id]})`).join(", ");

const SYSTEM_PROMPT = `Ты — ведущий арт-директор с 15-летним опытом в айдентике для игровой и киберспортивной индустрии.
Задача: создать БРЕНД-СИСТЕМУ (Brand DNA) клуба — строгий набор конкретных дизайн-токенов и правил, по которым будут автоматически строиться ВСЕ последующие графические материалы (макеты, шаблоны, копирайтинг, фоны и арты).
Никаких общих фраз и «воды» — каждый параметр должен быть числом, цветом или готовой инструкцией для кода.

СТРОГИЕ ПРАВИЛА ДИЗАЙН-ТОКЕНОВ:
1. ЦВЕТОВАЯ МОДЕЛЬ И WCAG КОНТРАСТ:
   - "bgDark": базовый тёмный фон холста (глубокий тёмный оттенок, напр. #0B0E14, #0F172A).
   - "bgLight": контрастные подложки карточек и плашек (напр. #182030, #1E293B).
   - "accent": ЕДИНСТВЕННЫЙ акцентный цвет бренда (жёлтый, неоновый циан, лайм, оранжевый). Контраст с bgDark СТРОГО >= 4.5:1. В макетах занимает не более 10% площади!
   - "text": цвет главного текста. Контраст с bgDark СТРОГО >= 7:1 (чистый белый #FFFFFF или #F8FAFC).
   - "muted": цвет второстепенного текста, подписей и дат. Контраст с bgDark СТРОГО >= 3.5:1 (напр. #94A3B8, #8C93A0).
   - "textOnAccent": цвет текста на акцентной плашке/кнопке (#000000 или #FFFFFF) с максимальным WCAG контрастом к accent.

2. ТИПОГРАФИЧЕСКАЯ ПАРА И МАСШТАБ (для ширины 1080px):
   - В работе строго не более 2 шрифтовых семейств:
     "display" — для главного заголовка поста (Unbounded, Russo One, Rubik, Montserrat, Bebas Neue или Oswald).
     "condensed" — узкий гармоничный шрифт для всех подзаголовков, карточек, цифр, цен, дат и бейджей.
     "mono" — моноширинный акцентный шрифт для технической меты, тегов и слотов.
   - Шкала кеглей (scale): display >= 96, title >= 56, body >= 32, caption >= 24.
   - Жесткие лимиты длины текста (limits):
     displayMaxWords: максимум 4 слова в главном заголовке (иначе заголовок вызовет наложение).
     titleMaxWords: максимум 8 слов в подзаголовке.
     bodyMaxChars: максимум 120 символов в описании карточки/тезиса.

3. АНГЛОЯЗЫЧНЫЙ СТИЛЬ ФОНА И ОВЕРЛЕЙ (imagePromptStyle & overlay):
   - "imagePromptStyle": готовый англоязычный промпт-хвост для генератора фонов (Midjourney / Qwen Image).
     Обязан содержать: визуальную среду клуба, тип освещения (volumetric rim lights, cinematic dark atmosphere), текстуры (brushed dark metal, graphite, matte polycarbonate), палитру (deep dark base with accent glow), требование "clean composition, vast empty negative space in center for typography, 8k render, photorealistic, no text, no watermark".
   - "overlay": точный CSS-рецепт затемнения фото под текст (напр. "linear-gradient(180deg, rgba(11,14,20,0.85) 0%, rgba(11,14,20,0.5) 100%)" или "rgba(11,14,20, 0.65)").

4. КОМПОЗИЦИОННЫЕ БРИФЫ ПО ВСЕМ 5 ТИПАМ МАТЕРИАЛОВ:
   Для каждого материала (${MATERIALS_LIST}) задай конкретику:
   - "goal": бизнес-цель публикации.
   - "hierarchy": массив из 3 элементов строго по порядку внимания: [1-й взгляд, 2-й взгляд, 3-й взгляд].
   - "layout": точная схема зон (шапка, заголовок, сетка карточек, подвал).
   - "accentUsage": ровно ОДИН элемент, который красится в accent (напр. "Только сумма призового фонда '50 000 ₽' и рамка первой карточки").
   - "tone": тональность подачи.

Верни СТРОГО валидный JSON без markdown:
{
  "brandName": "...",
  "colors": {
    "bgDark": "#RRGGBB",
    "bgLight": "#RRGGBB",
    "accent": "#RRGGBB",
    "text": "#RRGGBB",
    "muted": "#RRGGBB",
    "textOnAccent": "#000000 или #FFFFFF"
  },
  "fonts": {
    "display": одно из ${JSON.stringify(FONT_WHITELIST.display)},
    "condensed": одно из ${JSON.stringify(FONT_WHITELIST.condensed)},
    "mono": одно из ${JSON.stringify(FONT_WHITELIST.mono)}
  },
  "radius": число 0-24,
  "padding": число 24-64,
  "mascot": "детальное визуальное описание маскота или пустая строка",
  "tone": "краткий тон бренда",
  "system": {
    "positioning": "1-2 емких предложения: позиционирование клуба",
    "personality": ["3-5 прилагательных"],
    "voice": {
      "tone": "характер голоса",
      "dos": ["4 конкретных правила ЧТО делать в текстах"],
      "donts": ["4 конкретных запрета ЧЕГО избегать"]
    },
    "typography": {
      "scale": { "display": 120, "title": 72, "body": 36, "caption": 26 },
      "uppercase": true,
      "tracking": 0,
      "lineHeight": 1.1,
      "limits": { "displayMaxWords": 4, "titleMaxWords": 8, "bodyMaxChars": 120 }
    },
    "layout": { "grid": 12, "density": "airy|balanced|dense", "alignment": "left|center", "safeZone": 6 },
    "imagery": {
      "style": "описание стиля арта и фото по-русски",
      "overlay": "точный CSS-рецепт затемнения",
      "imagePromptStyle": "ready-to-use English prompt suffix for text-to-image generators",
      "mascotUsage": "правило размещения маскота"
    },
    "rules": [
      "Акцентный цвет занимает строго не более 10% площади макета",
      "Главный заголовок не превышает 4 слов",
      "Все видимые блоки строго внутри safeZone 6%",
      "Любое фото под текстом имеет оверлей не менее 50%",
      "Не более 3 размеров шрифта на одном макете"
    ],
    "materials": [
      {
        "id": "tournament",
        "goal": "...",
        "hierarchy": ["1. Дисциплина и статус турнира", "2. Призовой фонд", "3. Дата и регистрация"],
        "layout": "...",
        "accentUsage": "...",
        "tone": "..."
      }
    ]
  }
}`;

type Provider = (parts: { text?: string; image?: string }[]) => Promise<string | null>;

const parseJson = (raw: string) => JSON.parse(raw.replace(/```json/gi, "").replace(/```/g, "").trim());

const viaPolza =
  (key: string): Provider =>
  async (parts) => {
    const content = parts.map((p) =>
      p.image ? { type: "image_url", image_url: { url: p.image } } : { type: "text", text: p.text }
    );
    const res = await fetch("https://polza.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "anthropic/claude-haiku-5.5",
        messages: [{ role: "user", content }],
        temperature: 0.4,
        max_tokens: 8192,
      }),
    });
    if (!res.ok) return null;
    return (await res.json()).choices?.[0]?.message?.content ?? null;
  };

const viaGemini =
  (key: string): Provider =>
  async (parts) => {
    const out: any[] = [];
    for (const p of parts) {
      if (p.text) out.push({ text: p.text });
      else if (p.image?.startsWith("data:")) {
        const m = p.image.match(/^data:([^;]+);base64,(.+)$/);
        if (m) out.push({ inlineData: { mimeType: m[1], data: m[2] } });
      } else if (p.image?.startsWith("http")) {
        const f = await fetch(p.image).catch(() => null);
        if (f?.ok)
          out.push({
            inlineData: {
              mimeType: f.headers.get("content-type") || "image/jpeg",
              data: Buffer.from(await f.arrayBuffer()).toString("base64"),
            },
          });
      }
    }
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: out }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.4,
            maxOutputTokens: 8192,
          },
        }),
      }
    );
    if (!res.ok) {
      console.error("Gemini brand error:", await res.text());
      return null;
    }
    return (await res.json()).candidates?.[0]?.content?.parts?.[0]?.text ?? null;
  };

/** Бриф «с нуля» → текст для модели */
function briefText(b: any): string {
  const f = (k: string, label: string) => (typeof b?.[k] === "string" && b[k].trim() ? `${label}: ${b[k].trim().slice(0, 600)}` : "");
  return [
    f("brandName", "Название клуба"),
    f("niche", "Тип клуба / ниша"),
    f("audience", "Аудитория"),
    f("vibe", "Настроение и характер"),
    f("colors", "Пожелания по цветам"),
    f("avoid", "Чего избегать"),
  ]
    .filter(Boolean)
    .join("\n");
}

export async function POST(request: Request, { params }: { params: Promise<{ clubId: string }> }) {
  try {
    const { clubId } = await params;
    await requireClubFullAccess(clubId);

    const body = await request.json();
    const images: string[] = Array.isArray(body?.images) ? body.images.slice(0, 5) : [];
    const brief = briefText(body?.brief);
    const source = images.length ? "references" : "scratch";

    if (!images.length && !brief) {
      return NextResponse.json(
        { error: "Загрузите референсы или опишите клуб в брифе" },
        { status: 400 }
      );
    }

    const { polzaKey, design: current } = await getClubBrand(clubId);
    const parts: { text?: string; image?: string }[] = [{ text: SYSTEM_PROMPT }];
    if (brief) parts.push({ text: `БРИФ КЛИЕНТА:\n${brief}` });
    if (images.length) parts.push({ text: `РЕФЕРЕНСЫ (${images.length} шт.):` });
    images.forEach((image) => parts.push({ image }));

    const providers: Provider[] = [];
    if (polzaKey) providers.push(viaPolza(polzaKey));
    if (process.env.GEMINI_API_KEY) providers.push(viaGemini(process.env.GEMINI_API_KEY));

    for (const run of providers) {
      let raw: string | null = null;
      try {
        raw = await run(parts);
        if (!raw) continue;
        const parsed = parseJson(raw);
        parsed.system = { ...parsed.system, source };
        const fresh = sanitizeDesign(parsed);
        // Шрифты — только из белого списка
        (Object.keys(FONT_WHITELIST) as (keyof typeof FONT_WHITELIST)[]).forEach((k) => {
          if (!FONT_WHITELIST[k].includes(fresh.fonts[k])) fresh.fonts[k] = FONT_WHITELIST[k][0];
        });
        // Шаблоны, логотип и референсы не трогаем — это не часть анализа
        const merged = {
          ...fresh,
          brandName: fresh.brandName || current.brandName,
          logoUrl: current.logoUrl,
          mascotUrl: current.mascotUrl,
          templates: current.templates,
          referenceImages: images.length ? images : current.referenceImages,
        };
        const { design, issues } = auditBrand(merged);
        return NextResponse.json({ design, issues });
      } catch (err) {
        console.warn("Brand analysis: bad provider output", raw?.slice(0, 300), err);
      }
    }

    return NextResponse.json(
      { error: "Не удалось создать бренд-систему через ИИ. Проверьте API-ключ и повторите." },
      { status: 502 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Internal Server Error" },
      { status: typeof e?.status === "number" ? e.status : 500 }
    );
  }
}
