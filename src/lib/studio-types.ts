/**
 * Чистые типы и константы дизайн-кода и студии постов.
 * Безопасны для использования как на клиенте ("use client"), так и на сервере.
 * Не содержит зависимостей от pg, fs или Node.js.
 */

import { MATERIAL_IDS, buildTemplate, type MaterialId } from "./studio-layout";

export type ColorRole = "text" | "accent" | "muted" | "bgDark" | "bgLight";
export type TextRole = "display" | "title" | "body" | "caption";
export type FontRole = "display" | "condensed" | "mono";

/** Координаты и размеры — в % холста (в элементах списка — в % ячейки) */
type Box = { x: number; y: number; w: number; h: number };
export type TextNode = Box & {
  type: "text";
  field: string;
  role: TextRole;
  color: ColorRole;
  font: FontRole;
  align: "left" | "center" | "right";
  valign: "top" | "middle" | "bottom";
  uppercase: boolean;
  lines: number; // макс. строк, 0 — без ограничения
};
export type ImageNode = Box & { type: "image"; field: string; radius: number; overlay: number };
export type ShapeNode = Box & { type: "shape"; fill: ColorRole; opacity: number; radius: number; stroke?: ColorRole };
export type LogoNode = Box & { type: "logo"; align: "left" | "center" | "right" };
export type SimpleNode = TextNode | ImageNode | ShapeNode | LogoNode;
export type ListNode = Box & {
  type: "list";
  field: string;
  columns: number;
  gap: number;
  max: number;
  item: SimpleNode[]; // макет одной ячейки списка
};
export type LayoutNode = SimpleNode | ListNode;

export type TemplateLayout = {
  format: FormatId;
  background: { color: "bgDark" | "bgLight" | "accent"; image?: string; overlay: number };
  nodes: LayoutNode[];
};

/** Поле данных шаблона — по ним строится форма редактирования */
export type FieldDef = {
  key: string;
  label: string;
  type: "text" | "longtext" | "image" | "list";
  itemFields?: FieldDef[];
  default?: any;
};

export type DynamicTemplate = {
  id: string;
  name: string;
  description: string;
  materialId?: MaterialId;
  layout: TemplateLayout;
  fields: FieldDef[];
};

/** Данные поста: ключ поля → строка или массив объектов (для списков) */
export type PostData = Record<string, any>;

export { MATERIAL_IDS };
export type { MaterialId };

export const MATERIAL_LABELS: Record<MaterialId, string> = {
  tournament: "Турниры",
  promo: "Акции",
  announcement: "Анонсы / открытие",
  tariffs: "Тарифы",
  meme: "Мемы / фразы",
};

export type MaterialBrief = {
  id: MaterialId;
  goal: string; // зачем материал
  hierarchy: string[]; // что видно 1-м, 2-м, 3-м взглядом
  layout: string; // композиционный принцип
  accentUsage: string; // как использовать акцентный цвет
  tone: string; // голос для этого материала
};

export type TypographyLimits = {
  displayMaxWords: number;
  titleMaxWords: number;
  bodyMaxChars: number;
};

/** Бренд-система: правила, по которым потом строятся все шаблоны */
export type BrandSystem = {
  source: "references" | "scratch";
  positioning: string;
  personality: string[]; // 3–5 прилагательных
  voice: { tone: string; dos: string[]; donts: string[] };
  typography: {
    scale: { display: number; title: number; body: number; caption: number }; // px для холста 1080 по ширине
    uppercase: boolean;
    tracking: number; // em * 100
    lineHeight: number;
    limits?: TypographyLimits;
  };
  layout: { grid: number; density: "airy" | "balanced" | "dense"; alignment: "left" | "center"; safeZone: number };
  imagery: {
    style: string;
    overlay: string;
    imagePromptStyle?: string;
    mascotUsage: string;
  };
  rules: string[]; // жёсткие правила использования стиля
  materials: MaterialBrief[];
};

export type BrandDesign = {
  system?: BrandSystem;
  brandName: string;
  colors: {
    bgDark: string;
    bgLight: string;
    accent: string;
    text: string;
    muted: string;
    textOnAccent?: string;
  };
  fonts: { display: string; condensed: string; mono: string };
  radius: number;
  padding: number;
  mascot: string; // текстовое описание маскота (для ИИ-генерации)
  tone: string; // тон и правила (для ИИ-генерации)
  logoUrl?: string; // загруженный логотип
  mascotUrl?: string; // основной стикер маскота с прозрачным фоном
  referenceImages?: string[]; // референсы, по которым был создан дизайн-код
  templates?: DynamicTemplate[]; // Сгенерированные по референсам или ИИ шаблоны
};

export const DEFAULT_DESIGN: BrandDesign = {
  brandName: "",
  colors: {
    bgDark: "#111827",
    bgLight: "#F3F4F6",
    accent: "#3B82F6",
    text: "#FFFFFF",
    muted: "#9CA3AF",
    textOnAccent: "#FFFFFF",
  },
  fonts: { display: "Rubik", condensed: "Roboto Condensed", mono: "JetBrains Mono" },
  radius: 12,
  padding: 48,
  mascot: "",
  tone: "",
  logoUrl: "",
  mascotUrl: "",
  referenceImages: [],
  templates: [],
};

export const FORMATS = {
  post: { label: "Пост 1:1", ratio: "1:1", width: 1080, height: 1080 },
  story: { label: "Сторис 9:16", ratio: "9:16", width: 1080, height: 1920 },
  screen: { label: "Экран 16:9", ratio: "16:9", width: 1920, height: 1080 },
} as const;

export type FormatId = keyof typeof FORMATS;

export type StudioPost = {
  id: string;
  club_id: number;
  title: string;
  template_id: string;
  format: FormatId;
  data: Record<string, any>;
  preview_url: string | null;
  created_at: string;
  updated_at: string;
};

export type StudioAsset = {
  id: string;
  club_id: number;
  type: "logo" | "mascot" | "background" | "photo";
  name: string;
  url: string;
  created_at: string;
};

const HEX = /^#[0-9a-fA-F]{6}$/;
const str = (v: unknown, fb: string, max = 500) =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : fb;
const num = (v: unknown, fb: number, min: number, max: number) =>
  typeof v === "number" && isFinite(v) ? Math.min(max, Math.max(min, v)) : fb;
const hex = (v: unknown, fb: string) => (typeof v === "string" && HEX.test(v) ? v : fb);

const strList = (v: unknown, max: number, len = 200) =>
  Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim()).map((x) => x.trim().slice(0, len)).slice(0, max) : [];
const oneOf = <T extends string>(v: unknown, opts: readonly T[], fb: T): T => (opts.includes(v as T) ? (v as T) : fb);

/** Валидация бренд-системы */
export function sanitizeSystem(s: any): BrandSystem | undefined {
  if (!s || typeof s !== "object") return undefined;
  const sc = s.typography?.scale ?? {};
  const given: any[] = Array.isArray(s.materials) ? s.materials : [];
  return {
    source: s.source === "scratch" ? "scratch" : "references",
    positioning: str(s.positioning, "", 400),
    personality: strList(s.personality, 5, 40),
    voice: {
      tone: str(s.voice?.tone, "", 400),
      dos: strList(s.voice?.dos, 6),
      donts: strList(s.voice?.donts, 6),
    },
    typography: {
      scale: {
        display: num(sc.display, 120, 40, 260),
        title: num(sc.title, 72, 24, 160),
        body: num(sc.body, 36, 16, 80),
        caption: num(sc.caption, 26, 12, 48),
      },
      uppercase: s.typography?.uppercase !== false,
      tracking: num(s.typography?.tracking, 0, -10, 30),
      lineHeight: num(s.typography?.lineHeight, 1.1, 0.8, 1.8),
      limits: {
        displayMaxWords: Math.round(num(s.typography?.limits?.displayMaxWords, 4, 1, 10)),
        titleMaxWords: Math.round(num(s.typography?.limits?.titleMaxWords, 8, 2, 20)),
        bodyMaxChars: Math.round(num(s.typography?.limits?.bodyMaxChars, 120, 30, 400)),
      },
    },
    layout: {
      grid: Math.round(num(s.layout?.grid, 12, 2, 12)),
      density: oneOf(s.layout?.density, ["airy", "balanced", "dense"], "balanced"),
      alignment: oneOf(s.layout?.alignment, ["left", "center"], "left"),
      safeZone: num(s.layout?.safeZone, 6, 3, 12),
    },
    imagery: {
      style: str(s.imagery?.style, "", 400),
      overlay: str(s.imagery?.overlay, "", 300),
      imagePromptStyle: str(s.imagery?.imagePromptStyle, "", 600),
      mascotUsage: str(s.imagery?.mascotUsage, "", 300),
    },
    rules: strList(s.rules, 10, 250),
    // Ровно по одному брифу на каждый тип материала — порядок и состав фиксирует код
    materials: MATERIAL_IDS.map((id) => {
      const m = given.find((x) => x?.id === id) ?? {};
      return {
        id,
        goal: str(m.goal, "", 300),
        hierarchy: strList(m.hierarchy, 5, 100),
        layout: str(m.layout, "", 400),
        accentUsage: str(m.accentUsage, "", 300),
        tone: str(m.tone, "", 300),
      };
    }),
  };
}

/** Валидация дизайн-кода */
export function sanitizeDesign(input: any): BrandDesign {
  const d = DEFAULT_DESIGN;
  const c = input?.colors ?? {};
  const f = input?.fonts ?? {};
  return {
    system: sanitizeSystem(input?.system),
    brandName: str(input?.brandName, d.brandName, 60),
    colors: {
      bgDark: hex(c.bgDark, d.colors.bgDark),
      bgLight: hex(c.bgLight, d.colors.bgLight),
      accent: hex(c.accent, d.colors.accent),
      text: hex(c.text, d.colors.text),
      muted: hex(c.muted, d.colors.muted),
      textOnAccent: hex(c.textOnAccent, "#FFFFFF"),
    },
    fonts: {
      display: str(f.display, d.fonts.display, 60),
      condensed: str(f.condensed, d.fonts.condensed, 60),
      mono: str(f.mono, d.fonts.mono, 60),
    },
    radius: num(input?.radius, d.radius, 0, 64),
    padding: num(input?.padding, d.padding, 8, 160),
    mascot: str(input?.mascot, d.mascot, 1000),
    tone: str(input?.tone, d.tone, 1000),
    logoUrl: typeof input?.logoUrl === "string" ? input.logoUrl : "",
    mascotUrl: typeof input?.mascotUrl === "string" ? input.mascotUrl : "",
    referenceImages: Array.isArray(input?.referenceImages)
      ? input.referenceImages.filter((x: any) => typeof x === "string").slice(0, 10)
      : [],
    templates: Array.isArray(input?.templates)
      ? input.templates
          .map((t: any) => buildTemplate(t, null)?.template)
          .filter((t: DynamicTemplate | undefined): t is DynamicTemplate => !!t)
          .slice(0, 30)
      : [],
  };
}

export const maskKey = (k: string | null) => (k ? `${k.slice(0, 4)}…${k.slice(-4)}` : null);
