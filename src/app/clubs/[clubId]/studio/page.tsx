"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import {
  Download,
  Save,
  Sparkles,
  LayoutTemplate,
  Type,
  Image as ImageIcon,
  Palette,
  Plus,
  Trash2,
  RefreshCw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Check,
  AlertCircle,
  UploadCloud,
  Wand2,
  X,
  Upload,
  LayoutGrid,
  Layers,
  Columns,
  MessageSquare,
  Sparkle,
  Sliders,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  type BrandDesign,
  type FormatId,
  type StudioPost,
  type StudioAsset,
  type DynamicTemplate,
  type PostData,
  FORMATS,
  DEFAULT_DESIGN,
  MATERIAL_IDS,
  MATERIAL_LABELS,
  type MaterialId,
} from "@/lib/studio-types";
import { buildTemplate, defaultsOf } from "@/lib/studio-layout";
import { PostCanvas } from "./_components/PostCanvas";
import { TemplateContentEditor } from "./_components/TemplateContentEditor";
import { BrandSystemPanel, EMPTY_BRIEF, type BrandBrief } from "./_components/BrandSystemPanel";
import type { AuditIssue } from "@/lib/studio-brand-rules";

type StudioTab = "templates" | "content" | "ai" | "library" | "brand";

const DISPLAY_FONTS = ["Unbounded", "Russo One", "Rubik", "Montserrat", "Bebas Neue", "Oswald"];
const CONDENSED_FONTS = ["Oswald", "Bebas Neue", "Roboto Condensed", "Russo One"];
const MONO_FONTS = ["JetBrains Mono", "IBM Plex Mono", "Roboto Mono", "Fira Code"];

export default function StudioPage() {
  const { clubId } = useParams<{ clubId: string }>();

  // Дизайн-код клуба
  const [design, setDesign] = useState<BrandDesign>(DEFAULT_DESIGN);
  const [keyMask, setKeyMask] = useState<string | null>(null);
  const [keyInput, setKeyInput] = useState("");

  // Текущий пост
  const [currentPostId, setCurrentPostId] = useState<string | null>(null);
  const [postTitle, setPostTitle] = useState("");
  const [templateId, setTemplateId] = useState<string>("");
  const [format, setFormat] = useState<FormatId>("post");
  const [templateData, setTemplateData] = useState<Record<string, PostData>>({});

  // ИИ Генератор новых шаблонов
  const [templatePrompt, setTemplatePrompt] = useState("");
  const [templateRefImage, setTemplateRefImage] = useState<string | null>(null);
  const templateFileInputRef = useRef<HTMLInputElement>(null);
  const [generatingTemplate, setGeneratingTemplate] = useState(false);
  const [generatingMaterial, setGeneratingMaterial] = useState<string | null>(null);

  // Списки
  const [savedPosts, setSavedPosts] = useState<StudioPost[]>([]);
  const [assets, setAssets] = useState<StudioAsset[]>([]);

  // UI стейты
  const [activeTab, setActiveTab] = useState<StudioTab>("content");
  const [scale, setScale] = useState(0.48);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // ИИ Генератор (Qwen Image 2.1)
  const [aiMode, setAiMode] = useState<"background" | "cutout">("background");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiHd, setAiHd] = useState(false);
  const [aiWithMascot, setAiWithMascot] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiResultImage, setAiResultImage] = useState<string | null>(null);

  // Референсы для ИИ-анализа стиля
  const [refImages, setRefImages] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [logoLoading, setLogoLoading] = useState(false);
  const [brief, setBrief] = useState<BrandBrief>(EMPTY_BRIEF);
  const [auditIssues, setAuditIssues] = useState<AuditIssue[]>([]);

  // Реф для скачивания PNG
  const canvasRef = useRef<HTMLDivElement>(null);

  // Загрузка начальных данных
  const loadBrand = useCallback(async () => {
    try {
      const res = await fetch(`/api/clubs/${clubId}/studio/brand`);
      const data = await res.json();
      if (res.ok && data.design) {
        setDesign(data.design);
        if (Array.isArray(data.design.referenceImages) && data.design.referenceImages.length > 0) {
          setRefImages(data.design.referenceImages);
        }
        if (Array.isArray(data.design.templates) && data.design.templates.length > 0) {
          data.design.templates.forEach((t: DynamicTemplate) => {
            setTemplateData((prev) => ({
              ...prev,
              [t.id]: prev[t.id] || (t.fields ? defaultsOf(t.fields) : {}),
            }));
          });
          setTemplateId((prev) => prev || data.design.templates[0].id);
          setPostTitle((prev) => prev || data.design.templates[0].name);
        }
        setKeyMask(data.keyMask);
      }
    } catch (e) {
      console.error("Failed to load brand:", e);
    }
  }, [clubId]);

  const loadPosts = useCallback(async () => {
    try {
      const res = await fetch(`/api/clubs/${clubId}/studio/posts`);
      const data = await res.json();
      if (res.ok && data.posts) {
        setSavedPosts(data.posts);
      }
    } catch (e) {
      console.error("Failed to load posts:", e);
    }
  }, [clubId]);

  const loadAssets = useCallback(async () => {
    try {
      const res = await fetch(`/api/clubs/${clubId}/studio/assets`);
      const data = await res.json();
      if (res.ok && data.assets) {
        setAssets(data.assets);
      }
    } catch (e) {
      console.error("Failed to load assets:", e);
    }
  }, [clubId]);

  useEffect(() => {
    loadBrand();
    loadPosts();
    loadAssets();
  }, [loadBrand, loadPosts, loadAssets]);

  // Адаптивный масштаб холста при смене формата
  useEffect(() => {
    if (format === "story") setScale(0.32);
    else if (format === "screen") setScale(0.38);
    else setScale(0.48);
  }, [format]);

  // Все доступные шаблоны клуба
  const allTemplates = useMemo<DynamicTemplate[]>(() => {
    const list: DynamicTemplate[] = [];
    const seen = new Set<string>();

    for (const t of design.templates || []) {
      if (t?.id && !seen.has(t.id)) {
        seen.add(t.id);
        const built = buildTemplate(t, design);
        list.push(built ? built.template : t);
      }
    }
    return list;
  }, [design]);

  // Активный шаблон и данные поста
  const currentTemplate = allTemplates.find((t) => t.id === templateId) || null;
  const currentData: PostData =
    templateData[templateId] ||
    (currentTemplate ? defaultsOf(currentTemplate.fields) : {});

  // Быстрое обновление данных активного шаблона
  const updateCurrentData = (patch: Partial<PostData>) => {
    setTemplateData((prev) => ({
      ...prev,
      [templateId]: { ...currentData, ...patch },
    }));
  };

  // Обработка загрузки референсов
  const handleRefUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const remainingSlots = 5 - refImages.length;
    if (remainingSlots <= 0) {
      setMsg({ ok: false, text: "Максимум 5 референсов" });
      return;
    }
    const filesToProcess = files.slice(0, remainingSlots);
    filesToProcess.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          setRefImages((prev) => [...prev, reader.result as string].slice(0, 5));
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeRefImage = (index: number) => {
    setRefImages((prev) => prev.filter((_, i) => i !== index));
  };

  // Создание бренд-системы: по референсам и/или брифу
  const runReferenceAnalysis = async () => {
    setIsAnalyzing(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/clubs/${clubId}/studio/analyze-references`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: refImages, brief }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка анализа");

      setDesign(data.design as BrandDesign);
      setAuditIssues(data.issues || []);
      setMsg({
        ok: true,
        text: `Бренд-система «${data.design.brandName || "клуба"}» создана. Не забудьте сохранить дизайн-код.`,
      });
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleTemplateRefUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setMsg({ ok: false, text: "Выберите изображение (PNG, JPG, WebP)" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setTemplateRefImage(reader.result);
        setMsg({ ok: true, text: "Пример макета прикреплен!" });
      }
    };
    reader.readAsDataURL(file);
  };

  // Генерация нового шаблона через ИИ (по материалу или произвольному описанию)
  const generateAiTemplate = async (matId?: MaterialId, customPrompt?: string) => {
    const p = (customPrompt || templatePrompt).trim();
    if (!p && !matId && !templateRefImage) return;

    const label = matId ? MATERIAL_LABELS[matId] : "Шаблон";
    const promptToSend =
      p ||
      (templateRefImage
        ? "Шаблон по прикрепленному примеру"
        : `Стильный шаблон графического материала: ${label}`);

    setGeneratingTemplate(true);
    if (matId) setGeneratingMaterial(matId);
    setMsg(null);
    try {
      const res = await fetch(`/api/clubs/${clubId}/studio/generate-template`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: promptToSend,
          format,
          materialId: matId,
          referenceImage: templateRefImage || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const newT: DynamicTemplate = data.template;
      const updatedTemplates = [...(design.templates || []).filter((x) => x.id !== newT.id), newT];
      const updatedDesign: BrandDesign = { ...design, templates: updatedTemplates };

      setDesign(updatedDesign);
      await saveBrand({ templates: updatedTemplates });

      setTemplateId(newT.id);
      setPostTitle(newT.name);
      setTemplateData((prev) => ({
        ...prev,
        [newT.id]: defaultsOf(newT.fields),
      }));
      setTemplatePrompt("");
      setTemplateRefImage(null);
      if (templateFileInputRef.current) templateFileInputRef.current.value = "";
      setActiveTab("content");

      const issuesCount = Array.isArray(data.issues) ? data.issues.length : 0;
      setMsg({
        ok: true,
        text: `Шаблон «${newT.name}» создан с нуля по правилам бренда!${issuesCount > 0 ? ` (исправлено замечаний: ${issuesCount})` : ""}`,
      });
    } catch (e: any) {
      setMsg({ ok: false, text: "Ошибка создания шаблона: " + e.message });
    } finally {
      setGeneratingTemplate(false);
      setGeneratingMaterial(null);
    }
  };

  const deleteCustomTemplate = async (tid: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Удалить этот шаблон?")) return;
    const updated = (design.templates || []).filter((t) => t.id !== tid);
    const updatedDesign: BrandDesign = { ...design, templates: updated };
    setDesign(updatedDesign);
    await saveBrand({ templates: updated });
    if (templateId === tid) {
      setTemplateId("");
    }
  };

  // Загрузка логотипа клуба
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    setLogoLoading(true);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDesign((prev) => ({ ...prev, logoUrl: data.url }));
      setMsg({ ok: true, text: "Логотип загружен!" });
    } catch (err: any) {
      setMsg({ ok: false, text: "Ошибка загрузки: " + err.message });
    } finally {
      setLogoLoading(false);
    }
  };

  // Сохранение дизайн-кода
  const saveBrand = async (extra: { polzaKey?: string; templates?: DynamicTemplate[] } = {}) => {
    setLoading(true);
    setMsg(null);
    try {
      const updatedDesign: BrandDesign = {
        ...design,
        ...(extra.templates ? { templates: extra.templates } : {}),
        referenceImages: refImages,
      };
      const res = await fetch(`/api/clubs/${clubId}/studio/brand`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ design: updatedDesign, polzaKey: extra.polzaKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDesign(data.design);
      if (Array.isArray(data.design.referenceImages)) {
        setRefImages(data.design.referenceImages);
      }
      setKeyMask(data.keyMask);
      setKeyInput("");
      setMsg({ ok: true, text: "Дизайн-код клуба сохранён!" });
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setLoading(false);
    }
  };

  // Проверка ключа Polza.ai
  const testKey = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/clubs/${clubId}/studio/brand`, { method: "POST" });
      const data = await res.json();
      setMsg({
        ok: data.ok,
        text: data.ok ? "Ключ Polza.ai успешно проверен!" : data.error || "Ошибка проверки",
      });
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setLoading(false);
    }
  };

  // Сохранение поста в базу клуба
  const saveCurrentPost = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/clubs/${clubId}/studio/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: currentPostId,
          title: postTitle,
          template_id: templateId,
          format,
          data: currentData,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCurrentPostId(data.post.id);
      setMsg({ ok: true, text: "Пост сохранён в библиотеку клуба!" });
      loadPosts();
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setLoading(false);
    }
  };

  // Загрузка сохраненного поста
  const openSavedPost = (post: StudioPost) => {
    setCurrentPostId(post.id);
    setPostTitle(post.title);
    setTemplateId(post.template_id);
    setFormat(post.format);
    if (post.data) {
      setTemplateData((prev) => ({
        ...prev,
        [post.template_id]: { ...prev[post.template_id], ...(post.data as any) },
      }));
    }
    setActiveTab("content");
  };

  // Удаление поста
  const deletePost = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Удалить этот пост?")) return;
    try {
      const res = await fetch(`/api/clubs/${clubId}/studio/posts?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        if (currentPostId === id) setCurrentPostId(null);
        loadPosts();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Скачивание ультра-чёткого PNG через html-to-image
  const downloadPng = async () => {
    if (!canvasRef.current) return;
    setLoading(true);
    try {
      const { toPng } = await import("html-to-image");
      const node = document.getElementById("studio-export-target");
      if (!node) throw new Error("Элемент холста не найден");

      const fmt = FORMATS[format];
      const originalTransform = node.style.transform;
      node.style.transform = "none";

      const dataUrl = await toPng(node, {
        width: fmt.width,
        height: fmt.height,
        pixelRatio: 1,
        cacheBust: true,
      });

      node.style.transform = originalTransform;

      const link = document.createElement("a");
      const safeBrand = (design.brandName || "club").toLowerCase().replace(/[^a-zа-я0-9]+/gi, "-");
      const safeTitle = postTitle.toLowerCase().replace(/[^a-zа-я0-9]+/gi, "-");
      link.download = `${safeBrand}-${templateId}-${format}-${safeTitle}.png`;
      link.href = dataUrl;
      link.click();
      setMsg({ ok: true, text: "PNG изображение успешно сохранено!" });
    } catch (e: any) {
      setMsg({ ok: false, text: "Ошибка скачивания: " + e.message });
    } finally {
      setLoading(false);
    }
  };

  // ИИ Генерация через Qwen Image 2.1
  const runAiGeneration = async () => {
    if (!aiPrompt.trim()) return;
    setAiGenerating(true);
    setMsg(null);
    setAiResultImage(null);
    try {
      const res = await fetch(`/api/clubs/${clubId}/studio/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          format,
          prompt: aiPrompt,
          mode: aiMode,
          withMascot: aiWithMascot,
          hd: aiHd,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAiResultImage(data.image);
      setMsg({ ok: true, text: "Изображение успешно сгенерировано!" });
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setAiGenerating(false);
    }
  };

  // Применить сгенерированное изображение к текущему шаблону
  const applyGeneratedImage = () => {
    if (!aiResultImage) return;
    if (currentTemplate) {
      const imgFields = currentTemplate.fields.filter((f) => f.type === "image");
      const bgImgKey = currentTemplate.layout.background.image;

      let targetKey: string | null = null;
      if (aiMode === "cutout") {
        const cutoutField = imgFields.find((f) => {
          const k = f.key.toLowerCase();
          const l = f.label.toLowerCase();
          return (
            k.includes("player") ||
            k.includes("photo") ||
            k.includes("mascot") ||
            k.includes("character") ||
            k.includes("cutout") ||
            l.includes("игрок") ||
            l.includes("фото") ||
            l.includes("маскот") ||
            l.includes("персонаж")
          );
        });
        targetKey =
          cutoutField?.key ||
          imgFields.find((f) => f.key !== bgImgKey)?.key ||
          imgFields[0]?.key ||
          null;
      } else {
        const bgField = imgFields.find((f) => {
          const k = f.key.toLowerCase();
          const l = f.label.toLowerCase();
          return k.includes("bg") || k.includes("background") || l.includes("фон");
        });
        targetKey = bgImgKey || bgField?.key || imgFields[0]?.key || null;
      }

      if (targetKey) {
        updateCurrentData({ [targetKey]: aiResultImage });
      }
    }
    setActiveTab("content");
    setMsg({ ok: true, text: "Изображение применено к шаблону!" });
  };

  // Сохранить сгенерированное в библиотеку ассетов клуба
  const saveAiImageToLibrary = async () => {
    if (!aiResultImage) return;
    try {
      await fetch(`/api/clubs/${clubId}/studio/assets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: aiMode === "cutout" ? "mascot" : "background",
          name: aiPrompt.slice(0, 40) || "AI арт",
          url: aiResultImage,
        }),
      });
      loadAssets();
      setMsg({ ok: true, text: "Сохранено в библиотеку ассетов!" });
    } catch (err) {
      console.error(err);
    }
  };

  // Загрузка своего файла (фото/лого) с диска
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);

    setLoading(true);
    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      await fetch(`/api/clubs/${clubId}/studio/assets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "photo",
          name: file.name,
          url: data.url,
        }),
      });
      loadAssets();
      setMsg({ ok: true, text: "Файл загружен в библиотеку!" });
    } catch (err: any) {
      setMsg({ ok: false, text: "Ошибка загрузки: " + err.message });
    } finally {
      setLoading(false);
    }
  };

  // ИИ Генерация текстов / фраз
  const generateAiText = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/clubs/${clubId}/studio/ai-text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: templateId,
          prompt: postTitle || "Заголовок и тезисы",
          materialId: currentTemplate?.materialId,
        }),
      });
      const data = await res.json();
      if (res.ok && data) {
        const patch: Record<string, any> = {};
        if (data.title) patch.title = data.title;
        updateCurrentData(patch);
        setMsg({
          ok: true,
          text: `ИИ сгенерировал свежие идеи текстов!`,
        });
      }
    } catch (e: any) {
      setMsg({ ok: false, text: "Ошибка генерации текстов: " + e.message });
    } finally {
      setLoading(false);
    }
  };

  const fontsUrl =
    "https://fonts.googleapis.com/css2?" +
    [design.fonts.display, design.fonts.condensed, design.fonts.mono]
      .map((f) => `family=${encodeURIComponent(f)}:wght@400;700;800;900&subset=cyrillic`)
      .join("&") +
    "&display=swap";

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-slate-50 text-slate-900 overflow-hidden select-none">
      <link rel="stylesheet" href={fontsUrl} />

      {/* 1. ВЕРХНИЙ ТУЛБАР (СВЕТЛЫЙ) */}
      <header className="h-14 border-b border-slate-200 bg-white px-4 flex items-center justify-between shrink-0 z-30 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 font-black text-xs md:text-sm tracking-wider mr-2 text-slate-900">
            <span className="w-2.5 h-2.5 rounded-full bg-[#FFD92E] ring-2 ring-amber-400/40 animate-pulse" />
            <span style={{ fontFamily: "var(--font-display)" }}>СТУДИЯ ПОСТОВ</span>
          </div>

          <Input
            value={postTitle}
            onChange={(e) => setPostTitle(e.target.value)}
            className="h-8 w-52 md:w-72 bg-slate-50 border-slate-200 text-xs font-semibold text-slate-800 focus:bg-white focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
            placeholder="Название поста..."
          />
        </div>

        {/* Выбор формата */}
        <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
          {(["post", "story", "screen"] as FormatId[]).map((f) => (
            <button
              key={f}
              onClick={() => setFormat(f)}
              className={cn(
                "px-3 py-1 rounded-md text-xs font-bold transition-all",
                format === f
                  ? "bg-[#FFD92E] text-slate-950 shadow-sm"
                  : "text-slate-600 hover:text-slate-950 hover:bg-slate-200/60"
              )}
            >
              {FORMATS[f].label}
            </button>
          ))}
        </div>

        {/* Действия: Сохранить и Скачать */}
        <div className="flex items-center gap-2">
          {msg && (
            <span
              className={cn(
                "text-xs px-2.5 py-1 rounded-md flex items-center gap-1 font-semibold",
                msg.ok ? "text-emerald-700 bg-emerald-50 border border-emerald-200" : "text-rose-700 bg-rose-50 border border-rose-200"
              )}
            >
              {msg.ok ? <Check className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
              {msg.text}
            </span>
          )}

          <Button
            size="sm"
            variant="outline"
            disabled={loading}
            onClick={saveCurrentPost}
            className="h-8 bg-white border-slate-200 hover:bg-slate-50 text-slate-700 text-xs gap-1.5 shadow-sm"
          >
            <Save className="w-3.5 h-3.5 text-slate-500" />
            Сохранить
          </Button>

          <Button
            size="sm"
            disabled={loading}
            onClick={downloadPng}
            className="h-8 bg-[#FFD92E] text-slate-950 hover:bg-[#ffe156] font-black text-xs gap-1.5 shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            Скачать PNG
          </Button>
        </div>
      </header>

      {/* ОСНОВНОЙ РАБОЧИЙ ЭКРАН */}
      <div className="flex flex-1 overflow-hidden">
        {/* НАВИГАЦИОННАЯ КОЛОНКА ВКЛАДОК (СВЕТЛАЯ) */}
        <aside className="w-16 border-r border-slate-200 bg-white flex flex-col items-center py-3 gap-2 shrink-0 z-20 shadow-sm">
          <TabButton
            active={activeTab === "templates"}
            onClick={() => setActiveTab("templates")}
            icon={<LayoutTemplate className="w-5 h-5" />}
            label="Шаблоны"
          />
          <TabButton
            active={activeTab === "content"}
            onClick={() => setActiveTab("content")}
            icon={<Type className="w-5 h-5" />}
            label="Контент"
          />
          <TabButton
            active={activeTab === "ai"}
            onClick={() => setActiveTab("ai")}
            icon={<Sparkles className="w-5 h-5 text-amber-500" />}
            label="ИИ Арт"
          />
          <TabButton
            active={activeTab === "library"}
            onClick={() => setActiveTab("library")}
            icon={<ImageIcon className="w-5 h-5" />}
            label="Медиа"
          />
          <div className="my-auto" />
          <TabButton
            active={activeTab === "brand"}
            onClick={() => setActiveTab("brand")}
            icon={<Palette className="w-5 h-5 text-amber-500" />}
            label="Бренд"
          />
        </aside>

        {/* ПАНЕЛЬ НАСТРОЙКИ АКТИВНОЙ ВКЛАДКИ (СВЕТЛАЯ) */}
        <div className="w-80 md:w-96 border-r border-slate-200 bg-white overflow-y-auto p-4 shrink-0 flex flex-col gap-4 text-slate-800">
          {/* 1. ВКЛАДКА ШАБЛОНЫ И ПОСТЫ */}
          {activeTab === "templates" && (
            <div className="space-y-4">
              {/* Генератор шаблонов по описанию через ИИ */}
              <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/70 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-amber-400/30 flex items-center justify-center text-amber-700">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-xs">
                      Генератор шаблонов с нуля
                    </h3>
                    <p className="text-[11px] text-slate-600">
                      ИИ строит сетку и макет по правилам бренда и выбранному материалу
                    </p>
                  </div>
                </div>

                {/* Быстрые кнопки по типам материалов бренда */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                    Сгенерировать по типу материала
                  </label>
                  <div className="flex flex-wrap gap-1">
                    {MATERIAL_IDS.map((m) => (
                      <button
                        key={m}
                        type="button"
                        disabled={generatingTemplate}
                        onClick={() => generateAiTemplate(m)}
                        className={cn(
                          "h-7 px-2.5 rounded-lg border text-xs font-bold transition-all flex items-center gap-1",
                          generatingMaterial === m
                            ? "bg-amber-100 border-amber-400 text-amber-900"
                            : "bg-white border-amber-200 hover:border-amber-400 hover:bg-amber-50/80 text-slate-800"
                        )}
                      >
                        {generatingMaterial === m ? (
                          <RefreshCw className="w-3 h-3 animate-spin text-amber-600" />
                        ) : (
                          <Sparkles className="w-3 h-3 text-amber-500" />
                        )}
                        {MATERIAL_LABELS[m]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Прикрепление примера / референса */}
                <div className="space-y-1.5 pt-1 border-t border-amber-200/60">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1">
                      <ImageIcon className="w-3 h-3 text-amber-600" />
                      Пример / референс (картинка)
                    </label>
                    {templateRefImage && (
                      <button
                        type="button"
                        onClick={() => {
                          setTemplateRefImage(null);
                          if (templateFileInputRef.current) templateFileInputRef.current.value = "";
                        }}
                        className="text-[10px] text-red-500 hover:text-red-700 font-semibold flex items-center gap-0.5 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                        Удалить
                      </button>
                    )}
                  </div>

                  <input
                    ref={templateFileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleTemplateRefUpload}
                  />

                  {templateRefImage ? (
                    <div className="relative rounded-lg border border-amber-300 bg-amber-100/60 p-2 flex items-center gap-2.5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={templateRefImage}
                        alt="Пример"
                        className="w-12 h-12 object-cover rounded-md border border-amber-200 shrink-0 shadow-xs"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-slate-900 truncate">Пример прикреплен</div>
                        <div className="text-[10px] text-slate-600 leading-tight">
                          ИИ проанализирует сетку и повторит композицию образца
                        </div>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => templateFileInputRef.current?.click()}
                      className="w-full py-2 px-3 rounded-lg border border-dashed border-amber-300 hover:border-amber-400 bg-white/70 hover:bg-white text-slate-600 hover:text-slate-900 text-xs transition-all flex items-center justify-center gap-2 group cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5 text-amber-500 group-hover:scale-110 transition-transform" />
                      <span>Прикрепить картинку-пример (афиша, баннер)</span>
                    </button>
                  )}
                </div>

                <div className="space-y-1.5 pt-1 border-t border-amber-200/60">
                  <label className="text-[10px] font-semibold text-slate-600 block">
                    {templateRefImage ? "Пожелания или текст (опционально):" : "Или укажите свою идею макета:"}
                  </label>
                  <Input
                    value={templatePrompt}
                    onChange={(e) => setTemplatePrompt(e.target.value)}
                    placeholder={
                      templateRefImage
                        ? "Например: Адаптируй под турнир по Dota 2 с призом 50 000 ₽..."
                        : "Например: Афиша лана по Valorant 5x5 на 50 000 ₽..."
                    }
                    className="h-8 text-xs bg-white border-slate-200"
                    onKeyDown={(e) => e.key === "Enter" && generateAiTemplate()}
                  />
                  <Button
                    size="sm"
                    onClick={() => generateAiTemplate()}
                    disabled={generatingTemplate || (!templatePrompt.trim() && !templateRefImage)}
                    className="w-full h-8 bg-[#FFD92E] text-slate-950 font-black text-xs hover:bg-[#ffe156] gap-1.5 shadow-xs"
                  >
                    {generatingTemplate && !generatingMaterial ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Проектирую макет...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        {templateRefImage
                          ? "Спроектировать шаблон по примеру"
                          : "Спроектировать произвольный макет"}
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Доступные шаблоны ({allTemplates.length})
                </h2>
                {allTemplates.length === 0 ? (
                  <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-400">
                    Шаблонов пока нет. Сгенерируйте один из материалов выше!
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2 max-h-[380px] overflow-y-auto pr-1">
                    {allTemplates.map((tpl) => {
                      const isCurrent = templateId === tpl.id;
                      const matLabel = tpl.materialId
                        ? MATERIAL_LABELS[tpl.materialId]
                        : tpl.layout?.format?.toUpperCase() || "МАКЕТ";

                      return (
                        <div
                          key={tpl.id}
                          onClick={() => {
                            setTemplateId(tpl.id);
                            setPostTitle(tpl.name);
                            if (!templateData[tpl.id]) {
                              setTemplateData((prev) => ({
                                ...prev,
                                [tpl.id]: defaultsOf(tpl.fields),
                              }));
                            }
                            setActiveTab("content");
                          }}
                          className={cn(
                            "p-3 rounded-xl border text-left transition-all flex flex-col gap-1 cursor-pointer group relative",
                            isCurrent
                              ? "border-amber-400 bg-amber-50/70 shadow-sm ring-1 ring-amber-400"
                              : "border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 font-bold text-sm text-slate-900 truncate">
                              <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                              <span className="truncate">{tpl.name}</span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-1.5 py-0.5 rounded border border-slate-200">
                                {matLabel}
                              </span>
                              <button
                                onClick={(e) => deleteCustomTemplate(tpl.id, e)}
                                className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 p-0.5 transition-opacity"
                                title="Удалить шаблон"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          {tpl.description && (
                            <p className="text-xs text-slate-500 leading-snug line-clamp-2">
                              {tpl.description}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Сохраненные посты клуба */}
              <div className="pt-3 border-t border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Сохранённые посты ({savedPosts.length})
                  </h3>
                </div>
                {savedPosts.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Нет сохраненных постов</p>
                ) : (
                  <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
                    {savedPosts.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => openSavedPost(p)}
                        className={cn(
                          "group p-2 rounded-lg border text-xs cursor-pointer flex items-center justify-between transition-all",
                          currentPostId === p.id
                            ? "bg-amber-50 border-amber-300 text-slate-900 font-semibold"
                            : "bg-slate-50/80 border-slate-200 hover:border-slate-300 text-slate-700 hover:bg-white"
                        )}
                      >
                        <div className="truncate flex-1 pr-2">
                          <div className="font-semibold truncate">{p.title}</div>
                          <div className="text-[10px] text-slate-500 uppercase">
                            {p.template_id} · {p.format}
                          </div>
                        </div>
                        <button
                          onClick={(e) => deletePost(p.id, e)}
                          className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 2. ВКЛАДКА РЕДАКТИРОВАНИЕ КОНТЕНТА */}
          {activeTab === "content" && (
            <TemplateContentEditor
              template={currentTemplate}
              data={currentData}
              assets={assets}
              clubId={clubId}
              format={format}
              design={design}
              onChange={updateCurrentData}
              onGenerateText={generateAiText}
              onAssetSaved={loadAssets}
            />
          )}
          {/* 3. ВКЛАДКА ИИ ГЕНЕРАТОР (Qwen Image 2.1) */}
          {activeTab === "ai" && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Генератор артов · Qwen 2.1
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Генерирует фоны и маскотов без фона через Polza.ai
                </p>
              </div>

              {/* Выбор режима */}
              <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  onClick={() => setAiMode("background")}
                  className={cn(
                    "p-1.5 rounded-lg text-xs font-bold transition-all text-center",
                    aiMode === "background"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  Фон / Сцена
                </button>
                <button
                  onClick={() => setAiMode("cutout")}
                  className={cn(
                    "p-1.5 rounded-lg text-xs font-bold transition-all text-center",
                    aiMode === "cutout"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  Без фона (PNG)
                </button>
              </div>

              <div>
                <label className="text-xs text-slate-600 block mb-1 font-medium">Описание для ИИ</label>
                <Textarea
                  rows={3}
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder={
                    aiMode === "cutout"
                      ? "Маскот в черной маске с мегафоном в руках, жестикулирует"
                      : "Неоновый геймерский клуб, киберпанк, темная атмосфера, свободный центр"
                  }
                  className="text-xs bg-white border-slate-200"
                />
              </div>

              <div className="flex items-center gap-4 text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={aiWithMascot}
                    onChange={(e) => setAiWithMascot(e.target.checked)}
                    className="rounded border-slate-300 text-amber-500 focus:ring-amber-400"
                  />
                  <span>Маскот {design.brandName || "бренда"}</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={aiHd}
                    onChange={(e) => setAiHd(e.target.checked)}
                    className="rounded border-slate-300 text-amber-500 focus:ring-amber-400"
                  />
                  <span>2K HD</span>
                </label>
              </div>

              <Button
                onClick={runAiGeneration}
                disabled={aiGenerating || !aiPrompt.trim()}
                className="w-full h-9 bg-[#FFD92E] text-slate-950 font-black text-xs hover:bg-[#ffe156] gap-2 shadow-sm"
              >
                {aiGenerating ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Генерирую изображение...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    Сгенерировать
                  </>
                )}
              </Button>

              {/* Результат генерации */}
              {aiResultImage && (
                <div className="space-y-2 pt-2 border-t border-slate-200">
                  <div className="text-xs font-bold text-slate-600">Результат:</div>
                  <div
                    className="rounded-lg border border-slate-200 overflow-hidden max-h-48 flex items-center justify-center bg-slate-50"
                    style={{
                      backgroundImage:
                        "repeating-conic-gradient(#e2e8f0 0% 25%, transparent 0% 50%)",
                      backgroundSize: "16px 16px",
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={aiResultImage}
                      alt="Generated"
                      className="max-h-48 object-contain"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      size="sm"
                      onClick={applyGeneratedImage}
                      className="h-8 text-xs bg-slate-900 text-white font-bold hover:bg-slate-800"
                    >
                      Применить в пост
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={saveAiImageToLibrary}
                      className="h-8 text-xs border-slate-300 hover:bg-slate-100 bg-white"
                    >
                      В библиотеку
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 4. ВКЛАДКА БИБЛИОТЕКА МЕДИА */}
          {activeTab === "library" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Медиатека клуба
                </h2>
                <label className="cursor-pointer">
                  <span className="h-7 px-2.5 rounded-md bg-slate-100 hover:bg-slate-200 border border-slate-200 text-xs font-bold flex items-center gap-1.5 text-slate-800 transition-all">
                    <UploadCloud className="w-3.5 h-3.5 text-slate-600" /> Загрузить
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {assets.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                  Загрузите фото клуба или сгенерируйте через ИИ
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {assets.map((asset) => (
                    <div
                      key={asset.id}
                      onClick={() => {
                        if (currentData.archetype === "split-vertical") {
                          updateCurrentData({ sideImage: asset.url });
                        } else if (currentData.archetype === "quote-mascot") {
                          updateCurrentData({ mascotImage: asset.url });
                        } else if (currentData.archetype === "stacked-rows" && currentData.rows && currentData.rows.length > 0) {
                          const rows = [...currentData.rows];
                          rows[0] = { ...rows[0], bgImage: asset.url };
                          updateCurrentData({ rows });
                        } else {
                          updateCurrentData({ bgImage: asset.url });
                        }
                        setActiveTab("content");
                      }}
                      className="group relative rounded-lg border border-slate-200 hover:border-amber-400 overflow-hidden aspect-video cursor-pointer bg-slate-100 shadow-sm"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={asset.url}
                        alt={asset.name}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-[11px] font-bold text-white transition-all">
                        Применить
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 5. ВКЛАДКА ДИЗАЙН-КОД КЛУБА */}
          {activeTab === "brand" && (
            <div className="space-y-4 text-xs">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Дизайн-код клуба
                </h2>
                <p className="text-slate-500 mt-0.5">
                  Создайте уникальный стиль по референсам или настройте вручную
                </p>
              </div>

              <BrandSystemPanel
                design={design}
                refImages={refImages}
                brief={brief}
                issues={auditIssues}
                busy={isAnalyzing}
                onBrief={setBrief}
                onUpload={handleRefUpload}
                onRemoveRef={removeRefImage}
                onRun={runReferenceAnalysis}
              />
              {/* Логотип клуба */}
              <div className="space-y-1.5 pt-1">
                <label className="text-slate-600 block font-medium">Логотип клуба</label>
                <div className="flex items-center gap-2">
                  {design.logoUrl ? (
                    <div className="w-12 h-10 rounded-lg border border-slate-200 bg-slate-100 flex items-center justify-center p-1 shrink-0 overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={design.logoUrl} alt="Logo" className="max-h-full max-w-full object-contain" />
                    </div>
                  ) : (
                    <div className="w-12 h-10 rounded-lg border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center text-slate-400 text-[10px] shrink-0">
                      Нет
                    </div>
                  )}

                  <label className="cursor-pointer flex-1">
                    <span className="h-8 px-3 rounded-md bg-white hover:bg-slate-50 border border-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 text-slate-700 transition-all">
                      {logoLoading ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-500" />
                      ) : (
                        <UploadCloud className="w-3.5 h-3.5 text-slate-500" />
                      )}
                      {design.logoUrl ? "Заменить логотип" : "Загрузить лого (PNG)"}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                      disabled={logoLoading}
                    />
                  </label>

                  {design.logoUrl && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setDesign({ ...design, logoUrl: "" })}
                      className="h-8 px-2 text-slate-400 hover:text-red-500"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Имя бренда */}
              <div>
                <label className="text-slate-600 block mb-1 font-medium">Имя бренда</label>
                <Input
                  value={design.brandName}
                  onChange={(e) => setDesign({ ...design, brandName: e.target.value })}
                  placeholder="Например, COLIZEUM или CyberX"
                  className="h-8 text-xs bg-white border-slate-200 font-bold"
                />
              </div>

              {/* Палитра */}
              <div>
                <label className="text-slate-500 block mb-1.5 font-bold uppercase text-[11px]">
                  Фирменные цвета
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ["bgDark", "Тёмный фон"],
                    ["accent", "Главный акцент"],
                    ["bgLight", "Светлый фон"],
                    ["text", "Цвет текста"],
                    ["muted", "Второстепенный"],
                  ].map(([key, label]) => (
                    <div
                      key={key}
                      className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-lg border border-slate-200"
                    >
                      <input
                        type="color"
                        value={(design.colors as any)[key] || "#000000"}
                        onChange={(e) =>
                          setDesign({
                            ...design,
                            colors: { ...design.colors, [key]: e.target.value },
                          })
                        }
                        className="w-7 h-7 rounded border-0 cursor-pointer bg-transparent shrink-0"
                      />
                      <div className="truncate">
                        <div className="text-[10px] text-slate-500">{label}</div>
                        <div className="font-mono text-[11px] font-bold text-slate-800">
                          {(design.colors as any)[key]}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Шрифты */}
              <div className="space-y-2">
                <label className="text-slate-500 block font-bold uppercase text-[11px]">Шрифты</label>
                <div>
                  <span className="text-[10px] text-slate-500">Заголовки</span>
                  <select
                    value={design.fonts.display}
                    onChange={(e) =>
                      setDesign({
                        ...design,
                        fonts: { ...design.fonts, display: e.target.value },
                      })
                    }
                    className="w-full h-8 rounded-md bg-white border border-slate-200 px-2 text-xs text-slate-900"
                  >
                    {DISPLAY_FONTS.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500">Акцентный (узкий)</span>
                  <select
                    value={design.fonts.condensed}
                    onChange={(e) =>
                      setDesign({
                        ...design,
                        fonts: { ...design.fonts, condensed: e.target.value },
                      })
                    }
                    className="w-full h-8 rounded-md bg-white border border-slate-200 px-2 text-xs text-slate-900"
                  >
                    {CONDENSED_FONTS.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500">Моноширинный (теги, даты)</span>
                  <select
                    value={design.fonts.mono}
                    onChange={(e) =>
                      setDesign({
                        ...design,
                        fonts: { ...design.fonts, mono: e.target.value },
                      })
                    }
                    className="w-full h-8 rounded-md bg-white border border-slate-200 px-2 text-xs text-slate-900"
                  >
                    {MONO_FONTS.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Описание маскота и тон бренда */}
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <div>
                  <label className="text-slate-600 block mb-1 font-medium">
                    Маскот клуба (для ИИ артов)
                  </label>
                  <Textarea
                    rows={2}
                    value={design.mascot}
                    onChange={(e) => setDesign({ ...design, mascot: e.target.value })}
                    placeholder="Например: Робот в киберпанк худи с золотым логотипом"
                    className="text-xs bg-white border-slate-200"
                  />
                </div>
                <div>
                  <label className="text-slate-600 block mb-1 font-medium">
                    Тон и стиль бренда
                  </label>
                  <Input
                    value={design.tone}
                    onChange={(e) => setDesign({ ...design, tone: e.target.value })}
                    placeholder="Дерзкий киберспорт, контрастный неон, минимализм"
                    className="h-8 text-xs bg-white border-slate-200"
                  />
                </div>
              </div>

              {/* API Polza.ai */}
              <div className="pt-3 border-t border-slate-200 space-y-2">
                <label className="text-slate-500 block font-bold uppercase text-[11px]">
                  Подключение Polza.ai
                </label>
                <p className="text-[11px] text-slate-500">
                  {keyMask ? `Сохранён ключ: ${keyMask}` : "Ключ не задан"}
                </p>
                <Input
                  type="password"
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  placeholder="Вставьте sk-..."
                  className="h-8 text-xs bg-white border-slate-200"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={!keyInput.trim() || loading}
                    onClick={() => saveBrand({ polzaKey: keyInput })}
                    className="h-7 text-xs bg-slate-900 text-white font-bold hover:bg-slate-800"
                  >
                    Сохранить ключ
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!keyMask || loading}
                    onClick={testKey}
                    className="h-7 text-xs border-slate-300 bg-white hover:bg-slate-50 text-slate-700"
                  >
                    Проверить
                  </Button>
                </div>
              </div>

              <Button
                onClick={() => saveBrand()}
                disabled={loading}
                className="w-full h-9 bg-[#FFD92E] text-slate-950 font-black text-xs hover:bg-[#ffe156] mt-4 shadow-sm"
              >
                Сохранить дизайн-код
              </Button>
            </div>
          )}
        </div>

        {/* ЦЕНТРАЛЬНАЯ РАБОЧАЯ ОБЛАСТЬ (СВЕТЛАЯ, С ФОНОМ ДЛЯ ХОЛСТА) */}
        <main className="flex-1 bg-slate-100 relative overflow-auto flex items-center justify-center p-8 shadow-inner">
          {/* Баннер-подсказка, если бренд еще не настроен */}
          {!design.brandName && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white/95 border border-amber-300 shadow-lg rounded-xl px-4 py-2.5 flex items-center gap-3 z-20 backdrop-blur max-w-md">
              <Sparkles className="w-5 h-5 text-amber-500 shrink-0" />
              <div className="text-xs">
                <div className="font-bold text-slate-900">Стиль клуба ещё не создан</div>
                <div className="text-slate-500">Загрузите 1–5 референсов, и ИИ создаст дизайн-код 1-в-1</div>
              </div>
              <Button
                size="sm"
                onClick={() => setActiveTab("brand")}
                className="h-7 text-xs bg-[#FFD92E] text-slate-950 hover:bg-[#ffe156] font-bold shrink-0 ml-1"
              >
                Настроить
              </Button>
            </div>
          )}

          {/* Плавающий зум-контрол */}
          <div className="absolute bottom-6 right-6 flex items-center bg-white/95 border border-slate-200 rounded-xl p-1 shadow-xl backdrop-blur z-20">
            <button
              onClick={() => setScale((s) => Math.max(0.2, s - 0.05))}
              className="p-1.5 hover:bg-slate-100 rounded text-slate-600 hover:text-slate-950 transition-colors"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="px-2 font-mono text-xs text-slate-700 font-semibold">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={() => setScale((s) => Math.min(1, s + 0.05))}
              className="p-1.5 hover:bg-slate-100 rounded text-slate-600 hover:text-slate-950 transition-colors"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => setScale(format === "story" ? 0.32 : format === "screen" ? 0.38 : 0.48)}
              className="p-1.5 hover:bg-slate-100 rounded text-slate-600 hover:text-slate-950 border-l border-slate-200 ml-1 transition-colors"
              title="Fit"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Холст PostCanvas */}
          {currentTemplate ? (
            <div className="transition-all duration-200 ease-out drop-shadow-2xl">
              <PostCanvas
                ref={canvasRef}
                template={currentTemplate}
                format={format}
                data={currentData}
                design={design}
                scale={scale}
              />
            </div>
          ) : (
            <div className="text-center text-sm text-slate-400 max-w-xs">
              Шаблонов пока нет. Сначала создайте бренд-систему, затем шаблоны.
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center w-12 h-12 rounded-xl transition-all gap-1",
        active
          ? "bg-[#FFD92E] text-slate-950 shadow-sm"
          : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
      )}
    >
      {icon}
      <span className="text-[9px] font-bold tracking-tight">{label}</span>
    </button>
  );
}
