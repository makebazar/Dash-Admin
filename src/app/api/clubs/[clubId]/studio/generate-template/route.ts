import { NextResponse } from "next/server";
import { requireClubFullAccess } from "@/lib/club-api-access";
import { getClubBrand } from "@/lib/studio-brand";
import { buildTemplate, MATERIAL_IDS } from "@/lib/studio-layout";

export const maxDuration = 90;
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ clubId: string }> }
) {
  try {
    const { clubId } = await params;
    await requireClubFullAccess(clubId);

    const body = await request.json();
    const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
    const format = typeof body?.format === "string" ? body.format : "post";
    const materialId = (MATERIAL_IDS as readonly string[]).includes(body?.materialId)
      ? body.materialId
      : undefined;
    const referenceImage =
      typeof body?.referenceImage === "string" && body.referenceImage.trim()
        ? body.referenceImage.trim()
        : undefined;

    if (!prompt && !referenceImage && !materialId) {
      return NextResponse.json(
        { error: "Укажите описание шаблона или прикрепите пример" },
        { status: 400 }
      );
    }

    const { design, polzaKey } = await getClubBrand(clubId);
    const geminiKey = process.env.GEMINI_API_KEY;

    if (!polzaKey && !geminiKey) {
      return NextResponse.json(
        { error: "Подключите ключ Polza.ai в настройках бренда или настройте GEMINI_API_KEY" },
        { status: 400 }
      );
    }

    const sys = design.system;
    const materialBrief = sys?.materials?.find((m) => m.id === materialId);
    const safeZone = sys?.layout?.safeZone || 6;
    const grid = sys?.layout?.grid || 12;
    const limits = sys?.typography?.limits || { displayMaxWords: 4, titleMaxWords: 8, bodyMaxChars: 120 };

    const systemPrompt = `Ты профессиональный арт-директор и ведущий графический дизайнер клуба "${design.brandName || "КЛУБ"}".
Твоя задача — спроектировать с нуля безупречный графический шаблон (DynamicTemplate), СТРОГО соблюдая Brand DNA клуба.

БРЕНД-СИСТЕМА КЛУБА (СТРОГИЕ ТОКЕНЫ):
- Цвета бренда:
  * Базовый фон: bgDark (${design.colors.bgDark})
  * Карточки и подложки: bgLight (${design.colors.bgLight})
  * Единственный акцент: accent (${design.colors.accent}) — СТРОГО не более 10% площади макета!
  * Основной текст: text (${design.colors.text}) — WCAG 7:1
  * Подписи и мета: muted (${design.colors.muted}) — WCAG 3.5:1
  * Текст на акцентной плашке: textOnAccent ("${design.colors.textOnAccent || "#FFFFFF"}")
- Шрифтовая пара (не смешивать другие!):
  * display: "${design.fonts.display}" — ТОЛЬКО для главного заголовка (role: "display").
  * condensed: "${design.fonts.condensed}" (или mono: "${design.fonts.mono}") — для ВСЕХ остальных узлов (title, body, caption, цифр, дат и бейджей).
- Единый радиус скругления: radius = ${design.radius || 12}px (использовать во всех shape, image и list.item).
- Сетка и безопасная зона: safeZone = ${safeZone}%, grid = ${grid} колонок.
- Лимиты длины текста: display <= ${limits.displayMaxWords} слов, title <= ${limits.titleMaxWords} слов, body <= ${limits.bodyMaxChars} символов.
${sys?.positioning ? `- Позиционирование: ${sys.positioning}` : ""}
${sys?.rules?.length ? `- Главные правила стиля:\n  * ${sys.rules.join("\n  * ")}` : ""}
${materialBrief ? `- Бриф материала (${materialBrief.id}):
  * Цель: ${materialBrief.goal}
  * Иерархия фокуса: ${materialBrief.hierarchy.join(" → ")}
  * Композиция: ${materialBrief.layout}
  * Ровно один акцент: ${materialBrief.accentUsage} (красить в 'accent' строго этот элемент!)
  * Тон: ${materialBrief.tone}` : ""}

СТРОГИЕ ПРАВИЛА ГРАФИЧЕСКОЙ ВЁРСТКИ (БЕЗ НАЛОЖЕНИЙ):
1. БЕЗОПАСНАЯ ЗОНА: Все видимые элементы (логотип, тексты, карточки, подвал) строго внутри safeZone:
   x >= ${safeZone}, y >= ${safeZone}, x + w <= ${100 - safeZone}, y + h <= ${100 - safeZone}.
   Только фоновая картинка/подложка может занимать 100x100%.
2. ВЕРТИКАЛЬНЫЙ РИТМ И ЗАЗОРЫ:
   - Между вертикально идущими блоками (логотип -> заголовок -> карточки -> подвал) оставляй зазор по Y не менее 3-4%!
   - Высота главного заголовка (display) при 2 строках: h не менее 18-24%.
   - Для display дефолтный текст не должен превышать ${limits.displayMaxWords} слов!
3. КАРТОЧКИ И ЧИСЛА:
   - Для повторяющихся элементов (список турниров, тарифов, преимуществ) используй тип "list". Координаты узлов внутри item — относительные в % (0-100% от ячейки).
   - Ширина плашек с цифрами (призовой фонд, даты, цены): w не менее 35-45%, чтобы цифры ("15 000 ₽") никогда не обрезались.
4. АКЦЕНТНЫЙ ЦВЕТ:
   - В макете должен быть ровно ОДИН акцентный визуальный триггер с color: "accent" или stroke: "accent" (${materialBrief?.accentUsage || "призовой фонд или главная цена"}).
   - Не крась заголовки или случайные строки в accent!
5. ПОДВАЛ (FOOTER):
   - Распределяй горизонтально: контакты/регламент слева (x: ${safeZone}, w: 60), QR-код справа (x: ${100 - safeZone - 14}, w: 14, h: 14).
6. ФОТО И ОВЕРЛЕЙ:
   - Любое фото (фоновое или декоративное) должно иметь overlay >= 0.5 (рецепт бренда: ${sys?.imagery?.overlay || "0.55"}).

Узлы макета (layout.nodes) могут быть следующих типов:
1. "logo": { "type": "logo", "x": ${safeZone}, "y": ${safeZone}, "w": 30, "h": 6, "align": "left" | "center" | "right" }
2. "shape": { "type": "shape", "fill": "bgDark" | "bgLight" | "accent", "opacity": 0.8, "radius": ${design.radius || 12}, "stroke": "accent", "x": ${safeZone}, "y": 20, "w": ${100 - 2 * safeZone}, "h": 50 }
3. "image": { "type": "image", "field": "photo_key", "radius": ${design.radius || 12}, "overlay": 0.5, "x": ${safeZone}, "y": 20, "w": ${100 - 2 * safeZone}, "h": 40 }
4. "text": { "type": "text", "field": "text_key", "role": "display" | "title" | "body" | "caption", "color": "text" | "accent" | "muted", "font": "display" | "condensed" | "mono", "align": "left" | "center" | "right", "valign": "top" | "middle" | "bottom", "uppercase": true | false, "lines": 1, "x": ${safeZone}, "y": 14, "w": ${100 - 2 * safeZone}, "h": 12 }
5. "list": { "type": "list", "field": "list_key", "columns": 1 | 2 | 3, "gap": 2, "max": 4, "x": ${safeZone}, "y": 32, "w": ${100 - 2 * safeZone}, "h": 48,
     "item": [ узел shape плашки ячейки, узлы text/image внутри ячейки (координаты x,y,w,h в % ОТ ЯЧЕЙКИ) ] }

Также опиши поля (fields) с человекопонятными русскими лейблами и готовыми реалистичными дефолтными текстами, не превышающими лимиты слов:
[
  { "key": "title", "label": "Заголовок", "type": "text", "default": "ТУРНИР DOTA 2" },
  { "key": "bg_img", "label": "Фоновое изображение", "type": "image", "default": "" },
  { "key": "items", "label": "Список турниров", "type": "list", "itemFields": [{ "key": "game", "label": "Игра", "type": "text" }, { "key": "prize", "label": "Приз", "type": "text" }], "default": [...] }
]

Верни СТРОГО валидный JSON без markdown:
{
  "template": {
    "id": "slug-name",
    "name": "Название шаблона",
    "description": "Краткое описание назначения шаблона",
    "materialId": "${materialId || "tournament"}",
    "layout": {
      "format": "${format}",
      "background": { "color": "bgDark", "image": "bg_image", "overlay": 0.6 },
      "nodes": [ ... ]
    },
    "fields": [ ... ]
  }
}`;

    const userPrompt = referenceImage
      ? `Пользователь прикрепил визуальный пример/референс макета.
ВНИМАТЕЛЬНО проанализируй графическую композицию на картинке-примере:
1. Изучи расположение элементов: логотип, бейджи, главный заголовок, подзаголовок, карточки/сетка цен или расписания, подвал.
2. Воссоздай точно такую же композиционную структуру и ритм блоков в схеме узлов (layout.nodes), сохранив удачные пропорции референса!
3. Заполни тексты реалистичным контентом по теме: "${prompt || "Стильный шаблон графического материала"}".
4. Стилизуй макет строго под цвета и шрифты нашего бренда. Формат холста: ${format}.`
      : `Создай шаблон для: "${prompt}". Формат: ${format}.`;

    let raw: string | null = null;

    if (polzaKey) {
      try {
        const contentParts: any[] = [];
        if (referenceImage) {
          contentParts.push({ type: "image_url", image_url: { url: referenceImage } });
        }
        contentParts.push({
          type: "text",
          text: `${systemPrompt}\n\n${userPrompt}`,
        });

        const res = await fetch("https://polza.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${polzaKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "anthropic/claude-haiku-5.5",
            messages: [{ role: "user", content: contentParts }],
            temperature: 0.3,
            max_tokens: 8192,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          raw = data.choices?.[0]?.message?.content || null;
        }
      } catch (err) {
        console.warn("Polza generate-template error:", err);
      }
    }

    if (!raw && geminiKey) {
      try {
        const geminiParts: any[] = [];
        if (referenceImage?.startsWith("data:")) {
          const m = referenceImage.match(/^data:([^;]+);base64,(.+)$/);
          if (m) geminiParts.push({ inlineData: { mimeType: m[1], data: m[2] } });
        } else if (referenceImage?.startsWith("http")) {
          const f = await fetch(referenceImage).catch(() => null);
          if (f?.ok) {
            geminiParts.push({
              inlineData: {
                mimeType: f.headers.get("content-type") || "image/jpeg",
                data: Buffer.from(await f.arrayBuffer()).toString("base64"),
              },
            });
          }
        }
        geminiParts.push({ text: `${systemPrompt}\n\n${userPrompt}` });

        const gRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: geminiParts }],
              generationConfig: {
                responseMimeType: "application/json",
                temperature: 0.3,
                maxOutputTokens: 8192,
              },
            }),
          }
        );
        if (gRes.ok) {
          const gData = await gRes.json();
          raw = gData.candidates?.[0]?.content?.parts?.[0]?.text || null;
        }
      } catch (err) {
        console.warn("Gemini generate-template error:", err);
      }
    }

    if (!raw) {
      return NextResponse.json(
        { error: "Не удалось сгенерировать шаблон через ИИ. Проверьте ключ." },
        { status: 502 }
      );
    }

    const clean = raw.replace(/```json/gi, "").replace(/```/gi, "").trim();
    const parsed = JSON.parse(clean);
    const candidate = parsed?.template || parsed;

    // Валидация и применение дизайнерских правил через studio-layout
    const result = buildTemplate(candidate, design);
    if (!result) {
      return NextResponse.json(
        { error: "ИИ сгенерировал невалидную схему макета" },
        { status: 422 }
      );
    }

    return NextResponse.json({
      template: result.template,
      issues: result.issues,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
