/**
 * Правила дизайнера для бренд-системы: контраст, масштаб шрифтов, поля.
 * Чистые функции — ИИ предлагает, код проверяет и чинит.
 */
import type { BrandDesign } from "./studio-types";

const lin = (c: number) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const toHex = (c: number[]) => "#" + c.map((x) => Math.round(x).toString(16).padStart(2, "0")).join("");

/** WCAG-контраст двух #RRGGBB (1..21) */
export function contrast(a: string, b: string): number {
  const L = (h: string) => {
    const [r, g, bl] = rgb(h);
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(bl);
  };
  const [hi, lo] = [L(a), L(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Двигаем цвет к белому/чёрному (по фону), пока не достигнем нужного контраста */
export function ensureContrast(fg: string, bg: string, min: number): string {
  if (contrast(fg, bg) >= min) return fg;
  const target = contrast("#ffffff", bg) >= contrast("#000000", bg) ? 255 : 0;
  const c = rgb(fg);
  for (let t = 0.05; t <= 1.0001; t += 0.05) {
    const next = toHex(c.map((x) => x + (target - x) * t));
    if (contrast(next, bg) >= min) return next;
  }
  return toHex([target, target, target]);
}

/** Минимальные размеры для читаемости на холсте 1080px по ширине */
export const MIN_TYPE = { display: 96, title: 56, body: 32, caption: 24 } as const;

export type AuditIssue = { level: "fix" | "warn"; text: string };

/** Проверка и авто-исправление дизайн-кода. Возвращает исправленную копию и список замечаний. */
export function auditBrand(d: BrandDesign): { design: BrandDesign; issues: AuditIssue[] } {
  const issues: AuditIssue[] = [];
  const c = { ...d.colors };

  const fix = (key: "text" | "accent" | "muted", min: number, label: string) => {
    const before = c[key];
    const after = ensureContrast(before, c.bgDark, min);
    if (after !== before) {
      c[key] = after;
      issues.push({ level: "fix", text: `${label} ${before} → ${after}: контраст с тёмным фоном был ниже ${min}:1` });
    }
  };
  fix("text", 7, "Цвет текста");
  fix("accent", 4.5, "Акцент");
  fix("muted", 3.5, "Второстепенный цвет");

  // Автоматический подбор цвета текста на акцентной плашке (WCAG)
  const contrastWhite = contrast("#FFFFFF", c.accent);
  const contrastBlack = contrast("#000000", c.accent);
  c.textOnAccent = contrastWhite >= contrastBlack ? "#FFFFFF" : "#000000";

  if (contrast(c.bgDark, c.bgLight) < 4.5)
    issues.push({ level: "warn", text: "Тёмный и светлый фон слишком близки — светлые материалы будут вялыми" });
  if (contrast(c.accent, c.text) < 1.5)
    issues.push({ level: "warn", text: "Акцент почти не отличается от цвета текста — он не будет выделять главное" });

  let system = d.system;
  if (system) {
    const t = { ...system.typography.scale };
    (Object.keys(MIN_TYPE) as (keyof typeof MIN_TYPE)[]).forEach((k) => {
      if (t[k] < MIN_TYPE[k]) {
        issues.push({ level: "fix", text: `Размер «${k}» ${t[k]}px → ${MIN_TYPE[k]}px: мелко для соцсетей` });
        t[k] = MIN_TYPE[k];
      }
    });
    // Иерархия обязана убывать
    if (!(t.display > t.title && t.title > t.body && t.body > t.caption))
      issues.push({ level: "warn", text: "Нарушена иерархия размеров: display > title > body > caption" });
    system = { ...system, typography: { ...system.typography, scale: t } };
  }

  return { design: { ...d, colors: c, system }, issues };
}

export type ImagePromptOptions = {
  userPrompt: string;
  mode: "cutout" | "background";
  design: BrandDesign;
  withMascot?: boolean;
  gaze?: "center" | "left" | "right";
  lighting?: "bright" | "dramatic";
  framing?: "waist" | "full" | "face";
};

/** Построитель промтов для Qwen Image 2.1: нативный ARGB вырез с альфа-каналом или свободный фон под верстку */
export function buildImagePrompt({
  userPrompt,
  mode,
  design,
  withMascot,
  gaze = "center",
  lighting = "bright",
  framing = "waist",
}: ImagePromptOptions): string {
  const sys = design.system;
  const rawImgStyle =
    sys?.imagery?.imagePromptStyle ||
    "dark cinematic esports lounge atmosphere, volumetric lighting, subtle rim light, deep graphite and matte black textures, octane render, clean negative space in center for text, photorealistic";
  // Убираем возможные флаги Midjourney (--ar, --style, --v), чтобы Qwen не рендерил их текстом
  const imgStyle = rawImgStyle.replace(/--[a-zA-Z]+\s+[^\s-]+/g, "").trim();
  const mascotRule = withMascot
    ? sys?.imagery?.mascotUsage || (design.mascot ? `Персонаж клуба: ${design.mascot}` : "")
    : "";

  if (mode === "cutout") {
    const subjectDesc = [
      userPrompt,
      withMascot && design.mascot ? `Club mascot: ${design.mascot}. ${mascotRule}` : "",
    ]
      .filter(Boolean)
      .join(". ");

    // Очищаем imageryStyle от упоминаний стен/интерьеров фона и флагов
    const rawStyle = sys?.imagery?.style || design.tone || "esports character 3D art, photorealistic";
    const imageryStyle =
      rawStyle
        .split(/(?:Фон|фон|Background|background)\s*[-—:]/)[0]
        .replace(/на\s+(?:т[её]мном|светлом|любом|ч[её]рном)?\s*фоне[,\.]?/gi, "")
        .replace(/--[a-zA-Z]+\s+[^\s-]+/g, "")
        .trim() || "esports character 3D art, photorealistic";

    const accentColor = design.colors.accent || "#3B82F6";

    const framingClause =
      framing === "full"
        ? "full-length body shot from head to toe"
        : framing === "face"
        ? "close-up portrait shot of head and shoulders"
        : "medium shot waist up";

    const gazeClause =
      gaze === "left"
        ? "three-quarter view facing left, looking towards the left side of frame"
        : gaze === "right"
        ? "three-quarter view facing right, looking towards the right side of frame"
        : "front view looking directly into camera";

    const lightingClause =
      lighting === "dramatic"
        ? `sculpted dark studio lighting with deep shadows and a sharp, thin rim light in ${accentColor} tracing the outer contour (do not render the color code as text)`
        : `bright professional studio key lighting illuminating the face and clothing clearly with rich natural skin tones and vibrant details, crisp vibrant rim light in ${accentColor} tracing the outer contour (do not render color code as text)`;

    return `This is an RGBA image with transparency. A single isolated cutout subject: ${subjectDesc}. Visual style and rendering: ${imageryStyle}. Composition: ${framingClause}, ${gazeClause}, the entire silhouette is fully contained inside the frame with clean empty margin space around all edges, no cropped parts. Lighting: ${lightingClause}. No floor, no cast shadow, no smoke, no particles, no environment, no text. The image has alpha channel and the background is transparent.`;
  }

  // Формула для фоновой сцены (mode === "background"):
  return [
    `Атмосферный фон высокой четкости для киберспортивного постера: ${userPrompt}.`,
    withMascot && design.mascot ? `Элементы тематики клуба: ${design.mascot}. ${mascotRule}` : "",
    `Стиль бренда ${design.brandName || "киберарены"}: ${sys?.imagery?.style || design.tone || "темная эстетичная киберарена"}.`,
    `Art Direction: ${imgStyle}.`,
    `Цветовая палитра: глубокий темный базовый тон ${design.colors.bgDark}, аккуратные световые акценты и контровой свет ${design.colors.accent}.`,
    "Композиция: свободное незагруженное темное пространство в центре и верхней части кадра для последующего наложения крупной типографики, глубокая перспектива, без людей по центру, без текста, без букв и водяных знаков.",
  ]
    .filter(Boolean)
    .join("\n");
}

