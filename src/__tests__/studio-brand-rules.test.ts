import { describe, it, expect } from "vitest";
import { contrast, ensureContrast, auditBrand, buildImagePrompt } from "@/lib/studio-brand-rules";
import { DEFAULT_DESIGN, sanitizeDesign, MATERIAL_IDS } from "@/lib/studio-types";

describe("studio brand rules", () => {
  it("contrast: black/white = 21", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 0);
  });

  it("ensureContrast лечит тёмно-серый текст на тёмном фоне", () => {
    const fixed = ensureContrast("#222222", "#111111", 7);
    expect(contrast(fixed, "#111111")).toBeGreaterThanOrEqual(7);
  });

  it("auditBrand чинит контраст и мелкие шрифты", () => {
    const d = sanitizeDesign({
      ...DEFAULT_DESIGN,
      colors: { ...DEFAULT_DESIGN.colors, text: "#222222" },
      system: { typography: { scale: { display: 50, title: 40, body: 20, caption: 14 } } },
    });
    const { design, issues } = auditBrand(d);
    expect(contrast(design.colors.text, design.colors.bgDark)).toBeGreaterThanOrEqual(7);
    expect(design.system!.typography.scale.display).toBeGreaterThanOrEqual(96);
    expect(issues.some((i) => i.level === "fix")).toBe(true);
  });

  it("sanitizeSystem всегда отдаёт все типы материалов", () => {
    const d = sanitizeDesign({ system: { materials: [{ id: "promo", goal: "x" }, { id: "evil" }] } });
    expect(d.system!.materials.map((m) => m.id)).toEqual([...MATERIAL_IDS]);
  });

  it("auditBrand рассчитывает textOnAccent по WCAG контрасту", () => {
    // Жёлтый фон -> контрастнее чёрный текст
    const yellowBrand = sanitizeDesign({
      ...DEFAULT_DESIGN,
      colors: { ...DEFAULT_DESIGN.colors, accent: "#FFD92E" },
    });
    const resYellow = auditBrand(yellowBrand);
    expect(resYellow.design.colors.textOnAccent).toBe("#000000");

    // Тёмно-синий акцент на светлом фоне -> контрастнее белый текст поверх акцента
    const blueBrand = sanitizeDesign({
      ...DEFAULT_DESIGN,
      colors: { ...DEFAULT_DESIGN.colors, bgDark: "#FFFFFF", accent: "#1E3A8A" },
    });
    const resBlue = auditBrand(blueBrand);
    expect(resBlue.design.colors.textOnAccent).toBe("#FFFFFF");
  });

  it("sanitizeDesign сохраняет limits и imagePromptStyle", () => {
    const custom = sanitizeDesign({
      ...DEFAULT_DESIGN,
      system: {
        typography: {
          limits: { displayMaxWords: 3, titleMaxWords: 6, bodyMaxChars: 90 },
        },
        imagery: {
          imagePromptStyle: "dark cyberpunk club, volumetric rim lights",
        },
      },
    });
    expect(custom.system?.typography.limits?.displayMaxWords).toBe(3);
    expect(custom.system?.typography.limits?.titleMaxWords).toBe(6);
    expect(custom.system?.imagery.imagePromptStyle).toContain("dark cyberpunk club");
  });

  it("buildImagePrompt для cutout формирует точную формулу с RGBA прозрачностью и margins", () => {
    const prompt = buildImagePrompt({
      userPrompt: "Киберспортсмен в худи с наушниками",
      mode: "cutout",
      design: DEFAULT_DESIGN,
      withMascot: false,
    });

    expect(prompt.startsWith("This is an RGBA image with transparency.")).toBe(true);
    expect(prompt).toContain("A single isolated cutout subject: Киберспортсмен в худи с наушниками");
    expect(prompt).toContain("the entire silhouette is fully contained inside the frame with clean empty margin space around all edges, no cropped parts");
    expect(prompt).toContain("No floor, no cast shadow, no smoke, no particles, no environment, no text");
    expect(prompt.endsWith("The image has alpha channel and the background is transparent.")).toBe(true);
  });

  it("buildImagePrompt для background формирует сцену с пустым центром под текст", () => {
    const prompt = buildImagePrompt({
      userPrompt: "Турнирная киберарена",
      mode: "background",
      design: {
        ...DEFAULT_DESIGN,
        colors: { ...DEFAULT_DESIGN.colors, bgDark: "#0B0E14", accent: "#FFD92E" },
      },
    });

    expect(prompt).toContain("Атмосферный фон высокой четкости для киберспортивного постера: Турнирная киберарена");
    expect(prompt).toContain("свободное незагруженное темное пространство в центре и верхней части кадра");
    expect(prompt).toContain("#0B0E14");
    expect(prompt).toContain("#FFD92E");
    expect(prompt).toContain("без людей по центру, без текста, без букв");
  });
});


