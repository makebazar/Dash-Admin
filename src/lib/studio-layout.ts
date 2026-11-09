/**
 * Схема макета шаблона и правила дизайнера.
 * ИИ предлагает макет (узлы с координатами в %), код его чистит:
 * привязка к модульной сетке и полям, контраст, оверлей на фото, переполнение текста, наложения.
 * Только `import type` из studio-types — циклов нет.
 */
import type {
  BrandDesign,
  ColorRole,
  DynamicTemplate,
  FieldDef,
  FormatId,
  LayoutNode,
  ListNode,
  SimpleNode,
  TemplateLayout,
  TextNode,
} from "./studio-types";
import { contrast, type AuditIssue } from "./studio-brand-rules";

export const MATERIAL_IDS = ["tournament", "promo", "announcement", "tariffs", "meme"] as const;
export type MaterialId = (typeof MATERIAL_IDS)[number];

export const FORMAT_PX: Record<FormatId, [number, number]> = {
  post: [1080, 1080],
  story: [1080, 1920],
  screen: [1920, 1080],
};

const ROLES: ColorRole[] = ["text", "accent", "muted", "bgDark", "bgLight"];
const TEXT_ROLES = ["display", "title", "body", "caption"] as const;
const FONTS = ["display", "condensed", "mono"] as const;
const KEY = /^[a-zA-Z][a-zA-Z0-9_]{0,30}$/;
const MAX_NODES = 40;
const MAX_ITEM_NODES = 12;

const num = (v: any, fb: number, lo: number, hi: number) =>
  typeof v === "number" && isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fb;
const pick = <T extends string>(v: any, opts: readonly T[], fb: T): T => (opts.includes(v) ? v : fb);
const key = (v: any): string | null => (typeof v === "string" && KEY.test(v) ? v : null);
const text = (v: any, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

// ---------------- Типографика и подгонка текста ----------------

export type TypeSpec = {
  scale: { display: number; title: number; body: number; caption: number };
  uppercase: boolean;
  tracking: number;
  lineHeight: number;
};

export function typeSpec(d: Pick<BrandDesign, "system">): TypeSpec {
  const t = d.system?.typography;
  return {
    scale: t?.scale ?? { display: 120, title: 72, body: 36, caption: 26 },
    uppercase: t?.uppercase ?? true,
    tracking: t?.tracking ?? 0,
    lineHeight: t?.lineHeight ?? 1.1,
  };
}

/** Сколько строк займёт текст при жадном переносе по словам */
function countLines(s: string, perLine: number): number {
  let lines = 0;
  for (const para of s.split("\n")) {
    let cur = 0;
    lines += 1;
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const len = word.length;
      if (cur === 0) cur = len;
      else if (cur + 1 + len <= perLine) cur += 1 + len;
      else {
        lines += 1;
        cur = len;
      }
      // слишком длинное слово переносится посимвольно
      if (len > perLine) lines += Math.ceil(len / perLine) - 1;
    }
  }
  return lines;
}

/**
 * Подбирает кегль, при котором текст помещается в блок.
 * Оценка ширины символа приблизительная — это страховка от переполнения, а не точная вёрстка.
 */
export function fitFontSize(
  s: string,
  boxW: number,
  boxH: number,
  size: number,
  o: { lineHeight: number; maxLines: number; uppercase: boolean; tracking: number; minSize: number }
): number {
  const str = o.uppercase ? s.toUpperCase() : s;
  for (let px = size; px >= o.minSize; px *= 0.94) {
    const cw = px * ((o.uppercase ? 0.74 : 0.62) + o.tracking / 100);
    if (o.maxLines === 1) {
      if (str.length * cw <= boxW && px * o.lineHeight <= boxH) return px;
    } else {
      const perLine = Math.max(1, Math.floor(boxW / cw));
      const lines = countLines(str, perLine);
      if ((!o.maxLines || lines <= o.maxLines) && lines * px * o.lineHeight <= boxH) return px;
    }
  }
  return o.minSize;
}

// ---------------- Санитайзер узлов ----------------

function box(r: any) {
  const w = num(r.w, 10, 1, 100);
  const h = num(r.h, 10, 1, 100);
  return { x: num(r.x, 0, 0, 100 - w), y: num(r.y, 0, 0, 100 - h), w, h };
}

function sanitizeSimple(r: any, upper: boolean): SimpleNode | null {
  if (!r || typeof r !== "object") return null;
  const b = box(r);
  const align = pick(r.align, ["left", "center", "right"] as const, "left");
  switch (r.type) {
    case "text": {
      const field = key(r.field);
      if (!field) return null;
      return {
        type: "text",
        ...b,
        field,
        role: pick(r.role, TEXT_ROLES, "body"),
        color: pick(r.color, ROLES, "text"),
        font: pick(r.font, FONTS, "display"),
        align,
        valign: pick(r.valign, ["top", "middle", "bottom"] as const, "top"),
        uppercase: typeof r.uppercase === "boolean" ? r.uppercase : upper,
        lines: Math.round(num(r.lines, 1, 0, 8)),
      };
    }
    case "image": {
      const field = key(r.field);
      if (!field) return null;
      return { type: "image", ...b, field, radius: num(r.radius, 0, 0, 64), overlay: num(r.overlay, 0, 0, 1) };
    }
    case "shape":
      return {
        type: "shape",
        ...b,
        fill: pick(r.fill, ROLES, "bgDark"),
        opacity: num(r.opacity, 1, 0, 1),
        radius: num(r.radius, 0, 0, 64),
        stroke: ROLES.includes(r.stroke) ? r.stroke : undefined,
      };
    case "logo":
      return { type: "logo", ...b, align };
    default:
      return null;
  }
}

function sanitizeNode(r: any, upper: boolean): LayoutNode | null {
  if (r?.type !== "list") return sanitizeSimple(r, upper);
  const field = key(r.field);
  const item = (Array.isArray(r.item) ? r.item : [])
    .map((n: any) => sanitizeSimple(n, upper))
    .filter(Boolean)
    .slice(0, MAX_ITEM_NODES) as SimpleNode[];
  if (!field || !item.length) return null;
  return {
    type: "list",
    ...box(r),
    field,
    columns: Math.round(num(r.columns, 1, 1, 4)),
    gap: num(r.gap, 2, 0, 10),
    max: Math.round(num(r.max, 6, 1, 12)),
    item,
  };
}

// ---------------- Привязка к сетке и полям ----------------

function snap(n: LayoutNode, safe: number, grid: number): LayoutNode {
  const touches = n.x <= 1 || n.y <= 1 || n.x + n.w >= 99 || n.y + n.h >= 99;
  // фоновые картинки/плашки «в край» и тонкие линии не трогаем
  if ((n.type === "image" || n.type === "shape") && touches) return n;
  if (n.type === "shape" && (n.w < 4 || n.h < 4)) return n;

  const span = 100 - 2 * safe;
  const near = (v: number, d: number) => safe + Math.min(d, Math.max(0, Math.round((v - safe) / (span / d)))) * (span / d);
  const x0 = near(n.x, grid);
  let x1 = near(n.x + n.w, grid);
  if (x1 <= x0) x1 = Math.min(100 - safe, x0 + span / grid);

  // Для Y сохраняем точные отступы с шагом 0.5%, чтобы не склеивать соседние блоки
  const roundCoord = (v: number) => Math.round(v * 2) / 2;
  const y0 = Math.max(safe, Math.min(100 - safe - 2, roundCoord(n.y)));
  const h = Math.max(1, Math.min(100 - safe - y0, roundCoord(n.h)));
  return { ...n, x: Math.round(x0 * 10) / 10, y: y0, w: Math.round((x1 - x0) * 10) / 10, h };
}

const inside = (b: { x: number; y: number; w: number; h: number }, cx: number, cy: number) =>
  cx >= b.x && cx <= b.x + b.w && cy >= b.y && cy <= b.y + b.h;

/** Что лежит под точкой: цвет подложки и «голое» фото без достаточного оверлея */
function under(
  layout: TemplateLayout,
  colors: BrandDesign["colors"],
  upto: number,
  cx: number,
  cy: number
): { hex: string; bareImage: LayoutNode | "bg" | null } {
  const bg = layout.background;
  let hex = bg.color === "accent" ? colors.accent : colors[bg.color];
  let bare: LayoutNode | "bg" | null = null;
  if (bg.image) {
    if (bg.overlay < 0.35) bare = "bg";
    else hex = colors.bgDark;
  }
  for (let i = 0; i < upto; i++) {
    const n = layout.nodes[i];
    if (!inside(n, cx, cy)) continue;
    if (n.type === "shape" && n.opacity >= 0.6) {
      hex = colors[n.fill];
      bare = null;
    } else if (n.type === "image") {
      if (n.overlay < 0.35) bare = n;
      else {
        hex = colors.bgDark;
        bare = null;
      }
    }
  }
  return { hex, bareImage: bare };
}

const PRIORITY: ColorRole[] = ["text", "bgDark", "bgLight", "accent", "muted"];

function bestRole(want: ColorRole, backdrop: string, colors: BrandDesign["colors"], min: number): ColorRole {
  if (contrast(colors[want], backdrop) >= min) return want;
  const ok = PRIORITY.find((r) => contrast(colors[r], backdrop) >= min);
  if (ok) return ok;
  return [...ROLES].sort((a, b) => contrast(colors[b], backdrop) - contrast(colors[a], backdrop))[0];
}

// ---------------- Поля ----------------

function fieldFor(n: SimpleNode | ListNode, given: any): FieldDef | null {
  if (n.type !== "text" && n.type !== "image" && n.type !== "list") return null;
  const gf = Array.isArray(given) ? given.find((f: any) => f?.key === n.field) : undefined;
  const label = text(gf?.label, 60) || n.field;
  if (n.type === "image") return { key: n.field, label, type: "image", default: "" };
  if (n.type === "text")
    return { key: n.field, label, type: n.lines === 1 ? "text" : "longtext", default: text(gf?.default, 300) };

  const itemFields: FieldDef[] = [];
  for (const c of n.item) {
    const sub = Array.isArray(gf?.itemFields) ? gf.itemFields : undefined;
    const f = fieldFor(c, sub);
    if (f && !itemFields.some((x) => x.key === f.key)) itemFields.push(f);
  }
  const rows = Array.isArray(gf?.default) ? gf.default.slice(0, n.max) : [];
  return {
    key: n.field,
    label,
    type: "list",
    itemFields,
    default: rows.map((o: any) =>
      Object.fromEntries(itemFields.map((f) => [f.key, f.type === "image" ? "" : text(o?.[f.key], 200)]))
    ),
  };
}

export function deriveFields(layout: TemplateLayout, given: any): FieldDef[] {
  const out: FieldDef[] = [];
  const add = (f: FieldDef | null) => f && !out.some((x) => x.key === f.key) && out.push(f);
  if (layout.background.image)
    add({ key: layout.background.image, label: "Фон", type: "image", default: "" });
  layout.nodes.forEach((n) => add(fieldFor(n, given)));
  return out;
}

/** Значения по умолчанию из описания полей (глубокая копия) */
export function defaultsOf(fields: FieldDef[]): Record<string, any> {
  return JSON.parse(JSON.stringify(Object.fromEntries(fields.map((f) => [f.key, f.default ?? (f.type === "list" ? [] : "")]))));
}

// ---------------- Построитель шаблона ----------------

/**
 * raw → валидный шаблон. Если передан design — дополнительно применяются правила дизайнера
 * и возвращается список исправлений/замечаний. Шаблон без layout (старый формат) → null.
 */
export function buildTemplate(
  raw: any,
  design: BrandDesign | null
): { template: DynamicTemplate; issues: AuditIssue[] } | null {
  const rl = raw?.layout;
  if (!raw || !rl || !Array.isArray(rl.nodes)) return null;

  const issues: AuditIssue[] = [];
  const sys = design?.system;
  const safe = sys?.layout.safeZone ?? 6;
  const grid = sys?.layout.grid ?? 12;
  const spec = design ? typeSpec(design) : null;
  const upper = spec?.uppercase ?? true;

  const bgRaw = rl.background ?? {};
  const bgImage = key(bgRaw.image) ?? undefined;
  const layout: TemplateLayout = {
    format: pick(rl.format, ["post", "story", "screen"] as const, "post"),
    background: {
      color: pick(bgRaw.color, ["bgDark", "bgLight", "accent"] as const, "bgDark"),
      image: bgImage,
      overlay: num(bgRaw.overlay, bgImage ? 0.55 : 0, 0, 1),
    },
    nodes: rl.nodes
      .slice(0, MAX_NODES)
      .map((n: any) => sanitizeNode(n, upper))
      .filter(Boolean)
      .map((n: LayoutNode) => snap(n, safe, grid)),
  };
  if (!layout.nodes.length) return null;

  if (design) {
    const colors = design.colors;

    // 1. Фото под текстом без оверлея → поднимаем оверлей
    // 2. Контраст текста с подложкой
    const fixText = (n: TextNode, backdrop: string, label: string) => {
      const min = n.role === "display" || n.role === "title" ? 3 : 4.5;
      const role = bestRole(n.color, backdrop, colors, min);
      if (role !== n.color) {
        issues.push({ level: "fix", text: `«${label}»: цвет текста ${n.color} → ${role} (контраст с подложкой ниже ${min}:1)` });
        n.color = role;
      }
    };

    layout.nodes.forEach((n, i) => {
      const cx = n.x + n.w / 2;
      const cy = n.y + n.h / 2;
      const needsBackdrop = n.type === "text" || n.type === "list";
      if (!needsBackdrop) return;

      let u = under(layout, colors, i, cx, cy);
      if (u.bareImage) {
        if (u.bareImage === "bg") layout.background.overlay = 0.55;
        else if (u.bareImage.type === "image") u.bareImage.overlay = 0.55;
        issues.push({ level: "fix", text: "Текст лежит на фото без затемнения — добавлен оверлей 55%" });
        u = under(layout, colors, i, cx, cy);
      }
      if (n.type === "text") fixText(n, u.hex, n.field);
      else
        n.item.forEach((c) => {
          if (c.type !== "text") return;
          let hex = u.hex;
          for (const s of n.item) {
            if (s.type === "shape" && s.opacity >= 0.6 && inside(s, c.x + c.w / 2, c.y + c.h / 2)) hex = colors[s.fill];
          }
          fixText(c, hex, `${n.field}.${c.field}`);
        });
    });

    // 3. Переполнение текста (по значениям по умолчанию)
    const fields = deriveFields(layout, raw.fields);
    const [W, H] = FORMAT_PX[layout.format];
    const k = Math.min(W, H) / 1080;
    layout.nodes.forEach((n) => {
      if (n.type !== "text") return;
      const f = fields.find((x) => x.key === n.field);
      if (!f?.default) return;
      const size = spec!.scale[n.role] * k;
      const fitted = fitFontSize(f.default, (n.w / 100) * W, (n.h / 100) * H, size, {
        lineHeight: spec!.lineHeight,
        maxLines: n.lines,
        uppercase: n.uppercase,
        tracking: spec!.tracking,
        minSize: size * 0.5,
      });
      if (fitted < size * 0.7)
        issues.push({ level: "warn", text: `Текст «${f.label}» велик для блока — шрифт уменьшится до ${Math.round(fitted)}px` });
    });

    // 4. Наложение текстовых блоков и авто-раздвижение
    const texts = layout.nodes.filter((n): n is TextNode => n.type === "text");
    texts.sort((a, b) => a.y - b.y);
    for (let a = 0; a < texts.length; a++) {
      for (let b = a + 1; b < texts.length; b++) {
        const p = texts[a];
        const q = texts[b];
        const ox = Math.min(p.x + p.w, q.x + q.w) - Math.max(p.x, q.x);
        if (ox > 5) {
          const minQTop = p.y + p.h + 2;
          if (q.y < minQTop) {
            if (minQTop + q.h <= 100 - safe) {
              q.y = Math.round(minQTop * 10) / 10;
              issues.push({
                level: "fix",
                text: `Блок «${q.field}» сдвинут вниз для устранения наложения с «${p.field}»`,
              });
            } else {
              issues.push({ level: "warn", text: `Блоки «${p.field}» и «${q.field}» перекрываются` });
            }
          }
        }
      }
    }

    // 5. Иерархия
    const roles = new Set(texts.map((t) => t.role));
    if (!roles.has("display") && !roles.has("title"))
      issues.push({ level: "warn", text: "Нет главного заголовка (display/title) — теряется иерархия" });
    if (roles.size > 3)
      issues.push({ level: "warn", text: `Использовано ${roles.size} размеров текста — лучше не больше 3` });
  }

  const id = text(raw.id, 40).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || `t-${Date.now()}`;
  const template: DynamicTemplate = {
    id,
    name: text(raw.name, 80) || "Шаблон",
    description: text(raw.description, 200),
    materialId: (MATERIAL_IDS as readonly string[]).includes(raw.materialId) ? raw.materialId : undefined,
    layout,
    fields: deriveFields(layout, raw.fields),
  };
  return { template, issues };
}
