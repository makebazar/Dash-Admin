import { describe, it, expect } from "vitest";
import { buildTemplate, fitFontSize, defaultsOf, typeSpec } from "@/lib/studio-layout";
import { DEFAULT_DESIGN, sanitizeDesign } from "@/lib/studio-types";

describe("studio layout & design rules", () => {
  const brand = sanitizeDesign({
    ...DEFAULT_DESIGN,
    brandName: "CYBER ARENA",
    colors: {
      bgDark: "#0B0E14",
      bgLight: "#F0F2F5",
      accent: "#FFD92E",
      text: "#FFFFFF",
      muted: "#8C93A0",
    },
    system: {
      source: "scratch",
      positioning: "Киберарена премиум класса",
      personality: ["дерзкий", "технологичный"],
      voice: { tone: "профессиональный", dos: [], donts: [] },
      typography: {
        scale: { display: 120, title: 72, body: 36, caption: 26 },
        uppercase: true,
        tracking: 2,
        lineHeight: 1.1,
      },
      layout: { grid: 12, density: "balanced", alignment: "left", safeZone: 6 },
      imagery: { style: "dark cyber", overlay: "gradient", mascotUsage: "none" },
      rules: ["Акцент не более 10%"],
      materials: [],
    },
  });

  it("fitFontSize decreases font size to avoid overflow", () => {
    const longText = "ОЧЕНЬ ДЛИННЫЙ ЗАГОЛОВОК ДЛЯ ТУРНИРА ПО КИБЕРСПОРТУ";
    const fitted = fitFontSize(longText, 300, 80, 120, {
      lineHeight: 1.1,
      maxLines: 2,
      uppercase: true,
      tracking: 2,
      minSize: 20,
    });
    expect(fitted).toBeLessThan(120);
    expect(fitted).toBeGreaterThanOrEqual(20);
  });

  it("buildTemplate enforces safeZone and contrast on custom layout schema", () => {
    const rawTemplate = {
      id: "tournament-card",
      name: "Афиша турнира",
      description: "Турнир месяца",
      materialId: "tournament",
      layout: {
        format: "post",
        background: { color: "bgDark", overlay: 0 },
        nodes: [
          // Text lying outside safe zone (x=1) -> should be snapped
          {
            type: "text",
            field: "title",
            role: "display",
            color: "text",
            font: "display",
            x: 1,
            y: 2,
            w: 80,
            h: 15,
            lines: 1,
          },
          // Text on image with low overlay -> should trigger fix for overlay
          {
            type: "image",
            field: "banner",
            x: 6,
            y: 25,
            w: 88,
            h: 40,
            radius: 12,
            overlay: 0.1,
          },
          {
            type: "text",
            field: "prize",
            role: "title",
            color: "accent",
            font: "condensed",
            x: 8,
            y: 30,
            w: 40,
            h: 10,
            lines: 1,
          },
        ],
      },
      fields: [
        { key: "title", label: "Заголовок турнира", type: "text", default: "LAN DOTA 2" },
        { key: "prize", label: "Призовой фонд", type: "text", default: "100 000 ₽" },
      ],
    };

    const res = buildTemplate(rawTemplate, brand);
    expect(res).not.toBeNull();
    const { template, issues } = res!;

    expect(template.id).toBe("tournament-card");
    expect(template.layout.nodes[0].x).toBeGreaterThanOrEqual(6); // snapped to safe zone
    expect(issues.some((i) => i.level === "fix" || i.level === "warn")).toBe(true);

    const defaults = defaultsOf(template.fields);
    expect(defaults.title).toBe("LAN DOTA 2");
    expect(defaults.prize).toBe("100 000 ₽");
  });

  it("buildTemplate rejects invalid or old-style template structures", () => {
    const invalid = { id: "old", archetype: "stacked-rows" };
    expect(buildTemplate(invalid, brand)).toBeNull();
  });

  it("fitFontSize ensures single-line text does not exceed box width", () => {
    const prize = "15 000 ₽";
    const fitted = fitFontSize(prize, 150, 40, 72, {
      lineHeight: 1.1,
      maxLines: 1,
      uppercase: false,
      tracking: 0,
      minSize: 10,
    });
    // Должно уменьшиться так, чтобы 8 символов гарантированно поместились в 150px
    expect(fitted).toBeLessThanOrEqual(30);
    expect(fitted).toBeGreaterThanOrEqual(10);
  });

  it("buildTemplate automatically resolves collision between overlapping text nodes", () => {
    const collidingTemplate = {
      id: "collision-test",
      name: "Тест наложений",
      layout: {
        format: "post",
        background: { color: "bgDark", overlay: 0 },
        nodes: [
          { type: "text", field: "title", role: "display", color: "text", font: "display", x: 6, y: 10, w: 88, h: 15, lines: 2 },
          // Node starting at y: 15 (inside title's y: 10..25 range)
          { type: "text", field: "subtitle", role: "title", color: "muted", font: "condensed", x: 6, y: 15, w: 88, h: 6, lines: 1 },
        ],
      },
      fields: [
        { key: "title", label: "Заголовок", type: "text", default: "ТУРНИР" },
        { key: "subtitle", label: "Подзаголовок", type: "text", default: "DOTA 2" },
      ],
    };

    const res = buildTemplate(collidingTemplate, brand);
    expect(res).not.toBeNull();
    const nodes = res!.template.layout.nodes;
    const title = nodes.find((n: any) => n.field === "title")!;
    const subtitle = nodes.find((n: any) => n.field === "subtitle")!;

    // Subtitle must be pushed below title (title.y + title.h + gap)
    expect(subtitle.y).toBeGreaterThanOrEqual(title.y + title.h);
    expect(res!.issues.some((i) => i.level === "fix" && i.text.includes("сдвинут вниз"))).toBe(true);
  });
});

