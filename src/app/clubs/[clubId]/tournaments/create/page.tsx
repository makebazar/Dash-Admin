"use client";

import React, { useState, useEffect, useMemo, use } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Trophy,
  Calendar,
  DollarSign,
  Users,
  ShieldAlert,
  Save,
  Trash2,
  Plus,
  ArrowLeft,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Gamepad2,
  FileText,
  Layers,
  Award,
  Swords,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const CS2_5V5_MAP_POOL = [
  "de_mirage",
  "de_dust2",
  "de_inferno",
  "de_nuke",
  "de_anubis",
  "de_ancient",
  "de_vertigo",
];

export const CS2_WINGMAN_MAP_POOL = [
  "de_inferno",
  "de_vertigo",
  "de_nuke",
  "de_overpass",
  "de_anubis",
  "de_mirage",
  "de_dust2",
];

export const CS2_AIM_1V1_MAP_POOL = [
  "aim_redline",
  "aim_map",
  "awp_lego_2",
  "aim_ak47",
  "aim_headshot",
  "aim_dust2",
  "aim_pistol_cs2",
];

export interface CS2MapItem {
  id: string;
  label: string;
  categories: ("5v5" | "wingman" | "1v1")[];
  badge: string;
}

export const CS2_ALL_MAPS: CS2MapItem[] = [
  // 5v5 & Wingman Maps (CS2 competitive & wingman rotation)
  { id: "de_mirage", label: "Mirage", categories: ["5v5", "wingman"], badge: "5x5 / 2x2" },
  { id: "de_dust2", label: "Dust II", categories: ["5v5", "wingman"], badge: "5x5 / 2x2" },
  { id: "de_inferno", label: "Inferno", categories: ["5v5", "wingman"], badge: "5x5 / 2x2" },
  { id: "de_nuke", label: "Nuke", categories: ["5v5", "wingman"], badge: "5x5 / 2x2" },
  { id: "de_anubis", label: "Anubis", categories: ["5v5", "wingman"], badge: "5x5 / 2x2" },
  { id: "de_vertigo", label: "Vertigo", categories: ["5v5", "wingman"], badge: "5x5 / 2x2" },
  { id: "de_overpass", label: "Overpass", categories: ["5v5", "wingman"], badge: "5x5 / 2x2" },
  { id: "de_ancient", label: "Ancient", categories: ["5v5"], badge: "5x5" },
  { id: "de_train", label: "Train", categories: ["5v5"], badge: "5x5" },
  { id: "cs_office", label: "Office", categories: ["5v5"], badge: "5x5" },
  { id: "cs_italy", label: "Italy", categories: ["5v5"], badge: "5x5" },

  // 1v1 Aim & Duels
  { id: "aim_redline", label: "Aim Redline", categories: ["1v1"], badge: "1x1" },
  { id: "aim_map", label: "Aim Map", categories: ["1v1"], badge: "1x1" },
  { id: "awp_lego_2", label: "AWP Lego 2", categories: ["1v1"], badge: "1x1" },
  { id: "aim_ak47", label: "Aim AK47", categories: ["1v1"], badge: "1x1" },
  { id: "aim_headshot", label: "Aim Headshot", categories: ["1v1"], badge: "1x1" },
  { id: "aim_dust2", label: "Aim Dust2", categories: ["1v1"], badge: "1x1" },
  { id: "aim_pistol_cs2", label: "Aim Pistol", categories: ["1v1"], badge: "1x1" },
  { id: "aim_aztec", label: "Aim Aztec", categories: ["1v1"], badge: "1x1" },
];

function getCountFromLabel(label: string): number {
  if (!label) return 1;
  const match = label.match(/(\d+)\s*-\s*(\d+)/);
  if (match) {
    const start = parseInt(match[1], 10);
    const end = parseInt(match[2], 10);
    if (!isNaN(start) && !isNaN(end) && end >= start) {
      return end - start + 1;
    }
  }
  return 1;
}

function autoBalancePlacements(
  currentPlacements: any[],
  totalCashPool: number,
  entryFeeTotal: number
) {
  if (!currentPlacements || currentPlacements.length === 0)
    return currentPlacements;
  const totalSlotsCount = currentPlacements.reduce(
    (acc, p) => acc + getCountFromLabel(p.label),
    0
  );
  if (totalSlotsCount === 0) return currentPlacements;

  let weights: number[] = [];
  let currentPlace = 1;
  currentPlacements.forEach((p) => {
    const count = getCountFromLabel(p.label);
    let groupWeightSum = 0;
    for (let i = 0; i < count; i++) {
      groupWeightSum += 1 / Math.pow(currentPlace, 1.15);
      currentPlace++;
    }
    weights.push(groupWeightSum);
  });

  const sumWeights = weights.reduce((a, b) => a + b, 0);
  let rawPercents = weights.map((w) => (w / sumWeights) * 100);

  let roundedPercents = rawPercents.map((pct, idx) => {
    const count = getCountFromLabel(currentPlacements[idx].label);
    const perSlot = pct / count;
    return Math.max(1, Math.round(perSlot));
  });

  let sumAllocated = roundedPercents.reduce(
    (acc, perSlot, idx) =>
      acc + perSlot * getCountFromLabel(currentPlacements[idx].label),
    0
  );

  let diff = 100 - sumAllocated;
  if (diff !== 0 && roundedPercents.length > 0) {
    const topCount = getCountFromLabel(currentPlacements[0].label);
    const adjust = Math.floor(diff / topCount);
    roundedPercents[0] = Math.max(1, roundedPercents[0] + adjust);
  }

  return currentPlacements.map((p, idx) => ({
    ...p,
    cashPct: roundedPercents[idx],
  }));
}

export default function CreateTournamentPage({
  params,
}: {
  params: Promise<{ clubId: string }>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { clubId } = use(params);

  const editIdParam = searchParams.get("editId") || searchParams.get("id");
  const editTournamentId = editIdParam ? parseInt(editIdParam, 10) : null;

  const [wizardStep, setWizardStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [discipline, setDiscipline] = useState("cs2");
  const [type, setType] = useState("1vs1");
  const [startsAt, setStartsAt] = useState("");
  const [entryFee, setEntryFee] = useState(500);
  const [clubSharePct, setClubSharePct] = useState(20);
  const [maxParticipants, setMaxParticipants] = useState(16);
  const [prizePoolMode, setPrizePoolMode] = useState<"dynamic" | "fixed">(
    "dynamic"
  );
  const [fixedPrizeAmount, setFixedPrizeAmount] = useState(10000);
  const [rules, setRules] = useState("");
  const [entryFeeType, setEntryFeeType] = useState<"player" | "team">("player");
  const [autoDistributeBonuses, setAutoDistributeBonuses] = useState(true);
  const [bracketType, setBracketType] = useState<
    "single_elimination" | "double_elimination" | "round_robin"
  >("single_elimination");

  // Granular match formats
  const [matchFormat, setMatchFormat] = useState<"bo1" | "bo3" | "bo5">("bo1");
  const [semiFinalFormat, setSemiFinalFormat] = useState<
    "bo1" | "bo3" | "bo5"
  >("bo1");
  const [grandFinalFormat, setGrandFinalFormat] = useState<
    "bo1" | "bo3" | "bo5"
  >("bo3");
  const [mapPool, setMapPool] = useState<string[]>(CS2_5V5_MAP_POOL);
  const [mapFilter, setMapFilter] = useState<"all" | "5v5" | "wingman" | "1v1">("5v5");

  const filteredMaps = useMemo(() => {
    if (mapFilter === "all") return CS2_ALL_MAPS;
    return CS2_ALL_MAPS.filter((m) => m.categories.includes(mapFilter));
  }, [mapFilter]);

  // Placements & Item Pool
  const [placements, setPlacements] = useState<any[]>([
    { id: "1", label: "1 Место", cashPct: 60, bonus: 1000, item: "" },
    { id: "2", label: "2 Место", cashPct: 30, bonus: 500, item: "" },
    { id: "3", label: "3 Место", cashPct: 10, bonus: 250, item: "" },
  ]);
  const [totalBonusPool, setTotalBonusPool] = useState<number>(0);
  const [itemPool, setItemPool] = useState<
    Array<{ id: string; name: string; cost: number }>
  >([]);

  // Rules templates
  const [rulesTemplates, setRulesTemplates] = useState<any[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [newTemplateName, setNewTemplateName] = useState("");
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);

  // Load existing tournament for editing
  useEffect(() => {
    if (!editTournamentId) return;

    async function loadEditData() {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/clubs/${clubId}/tournaments?id=${editTournamentId}`
        );
        const data = await res.json();
        if (data.tournament) {
          const t = data.tournament;
          setName(t.name || "");
          setDiscipline(t.discipline || "cs2");
          setType(t.type || "1vs1");
          setEntryFee(parseFloat(t.entry_fee || 0));
          setClubSharePct(t.club_share_pct || 0);
          setRules(t.rules || "");
          setMaxParticipants(t.config?.maxParticipants || 16);
          setPrizePoolMode(t.prize_pool_mode || "dynamic");
          setFixedPrizeAmount(parseFloat(t.fixed_prize_amount || 0));
          setEntryFeeType(t.config?.entryFeeType || "player");
          setBracketType(t.config?.bracketType || "single_elimination");

          // Formats
          setMatchFormat(t.config?.matchFormat || "bo1");
          setSemiFinalFormat(
            t.config?.semiFinalFormat || t.config?.matchFormat || "bo1"
          );
          setGrandFinalFormat(
            t.config?.grandFinalFormat ||
              (t.config?.matchFormat === "bo1" ? "bo3" : "bo3")
          );

          if (t.config?.mapPool && Array.isArray(t.config.mapPool)) {
            setMapPool(t.config.mapPool);
          }
          if (t.config?.itemPool && Array.isArray(t.config.itemPool)) {
            setItemPool(t.config.itemPool);
          }

          if (t.starts_at) {
            const dt = new Date(t.starts_at);
            const pad = (n: number) => String(n).padStart(2, "0");
            const formatted = `${dt.getFullYear()}-${pad(
              dt.getMonth() + 1
            )}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(
              dt.getMinutes()
            )}`;
            setStartsAt(formatted);
          }

          if (t.prize_distribution) {
            if (Array.isArray(t.prize_distribution.placements)) {
              setPlacements(
                t.prize_distribution.placements.map((p: any) => ({
                  ...p,
                  cashPct:
                    p.cashPct <= 1 ? Math.round(p.cashPct * 100) : p.cashPct,
                }))
              );
              setTotalBonusPool(t.prize_distribution.totalBonusPool || 0);
            }
          }
        }
      } catch (err) {
        console.error("Failed to load tournament for edit", err);
      } finally {
        setLoading(false);
      }
    }

    loadEditData();
  }, [clubId, editTournamentId]);

  // Load Rules Templates
  useEffect(() => {
    async function loadTemplates() {
      try {
        const res = await fetch(
          `/api/clubs/${clubId}/tournaments?action=rules_templates&discipline=${discipline}`
        );
        const data = await res.json();
        setRulesTemplates(data.templates || []);
      } catch (err) {
        console.error("Failed to load rules templates", err);
      }
    }
    loadTemplates();
  }, [clubId, discipline]);

  // Format options
  const formatOptions = useMemo(() => {
    if (discipline === "cs2") {
      return [
        { id: "1vs1", name: "1vs1 Solo" },
        { id: "2vs2", name: "2vs2 Команды" },
        { id: "5vs5", name: "5vs5 Команды" },
        { id: "mix_2vs2", name: "Mix 2vs2 (Дуэты)" },
        { id: "mix_5vs5", name: "Mix (5x5 Сбалансированный)" },
      ];
    } else if (discipline === "fifa" || discipline === "ufc") {
      return [
        { id: "1vs1", name: "1vs1 Solo" },
        { id: "2vs2", name: "2vs2 Команды" },
      ];
    }
    return [{ id: "1vs1", name: "1vs1 Solo" }];
  }, [discipline]);

  useEffect(() => {
    const allowed = formatOptions.map((f) => f.id);
    if (!allowed.includes(type)) {
      setType(allowed[0] || "1vs1");
    }
  }, [discipline, formatOptions, type]);

  // Auto distribute bonuses
  const cashPctKey = placements.map((p) => p.cashPct).join(",");
  useEffect(() => {
    if (!autoDistributeBonuses || totalBonusPool <= 0) return;

    const totalCashPct = placements.reduce(
      (sum, p) => sum + (p.cashPct || 0) * getCountFromLabel(p.label),
      0
    );
    if (totalCashPct <= 0) return;

    let distributedSum = 0;
    const updated = placements.map((p) => {
      const share = (p.cashPct || 0) / totalCashPct;
      const calculatedBonus = Math.round(totalBonusPool * share);
      const count = getCountFromLabel(p.label);
      distributedSum += calculatedBonus * count;
      return {
        ...p,
        bonus: calculatedBonus,
      };
    });

    const remainder = totalBonusPool - distributedSum;
    if (remainder !== 0 && updated.length > 0) {
      const firstPlaceIdx = updated.findIndex((p) => p.label.includes("1"));
      if (firstPlaceIdx !== -1) {
        const count = getCountFromLabel(updated[firstPlaceIdx].label);
        updated[firstPlaceIdx].bonus += Math.round(remainder / count);
      }
    }

    const changed = updated.some(
      (p, idx) => p.bonus !== placements[idx]?.bonus
    );
    if (changed) {
      setPlacements(updated);
    }
  }, [totalBonusPool, cashPctKey, autoDistributeBonuses, placements]);

  // Calculations for Step 3
  const isTeamFormat = type === "2vs2" || type === "5vs5";
  const teamSize =
    type === "2vs2" || type === "mix_2vs2"
      ? 2
      : type === "5vs5" || type === "mix_5vs5"
      ? 5
      : 1;
  const feeMultiplier = isTeamFormat && entryFeeType === "player" ? teamSize : 1;
  const totalFeesCollected = maxParticipants * entryFee * feeMultiplier;
  const clubCommission = Math.round(
    totalFeesCollected * (clubSharePct / 100)
  );
  const estimatedPrizePool =
    prizePoolMode === "fixed"
      ? fixedPrizeAmount
      : totalFeesCollected - clubCommission;

  const totalItemsValue = useMemo(() => {
    return placements.reduce((sum, p) => {
      const matched = itemPool.find((item) => item.id === p.itemId);
      if (matched) {
        const count = getCountFromLabel(p.label);
        const itemMult =
          isTeamFormat && p.itemScope === "team"
            ? 1
            : isTeamFormat
            ? teamSize
            : 1;
        return sum + matched.cost * count * itemMult;
      }
      return sum;
    }, 0);
  }, [placements, itemPool, isTeamFormat, teamSize]);

  // Validation
  const getPrizeValidation = () => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const feePerComp = entryFee * feeMultiplier;

    const calculated = placements.map((p) => {
      const fraction = p.cashPct > 1 ? p.cashPct / 100 : p.cashPct;
      const slotCash = Math.round(estimatedPrizePool * fraction);
      const slotBonus = p.bonus || 0;
      const matched = itemPool.find((i) => i.id === p.itemId);
      const itemCost = matched ? matched.cost : 0;
      const totalVal = slotCash + slotBonus + itemCost;
      return {
        label: p.label,
        totalVal,
        cash: slotCash,
        bonus: slotBonus,
      };
    });

    const first = calculated.find((p) => p.label.includes("1"));
    if (first && first.totalVal <= feePerComp && feePerComp > 0) {
      errors.push(
        `Приз за 1 Место (${first.totalVal} ₽) должен быть больше взноса (${feePerComp} ₽)!`
      );
    }

    calculated.forEach((p) => {
      if (
        !p.label.includes("1") &&
        p.totalVal <= feePerComp &&
        p.totalVal > 0 &&
        feePerComp > 0
      ) {
        warnings.push(
          `Приз за ${p.label} (${p.totalVal} ₽) меньше взноса (${feePerComp} ₽).`
        );
      }
    });

    return { errors, warnings };
  };

  const handleSelectTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    if (!templateId) return;
    const found = rulesTemplates.find((t) => t.id === templateId);
    if (found) {
      setRules(found.rules_text);
    }
  };

  const handleSaveRulesTemplate = async () => {
    if (!newTemplateName.trim()) {
      alert("Введите название шаблона правил!");
      return;
    }
    if (!rules.trim()) {
      alert("Текст правил пуст!");
      return;
    }
    setIsSavingTemplate(true);
    try {
      const res = await fetch(
        `/api/clubs/${clubId}/tournaments?action=create_rules_template`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            discipline,
            name: newTemplateName.trim(),
            rulesText: rules.trim(),
          }),
        }
      );
      if (res.ok) {
        alert("Шаблон правил сохранен!");
        setNewTemplateName("");
        const resList = await fetch(
          `/api/clubs/${clubId}/tournaments?action=rules_templates&discipline=${discipline}`
        );
        const dataList = await resList.json();
        setRulesTemplates(dataList.templates || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      alert("Укажите название турнира!");
      setWizardStep(1);
      return;
    }

    const { errors } = getPrizeValidation();
    if (errors.length > 0) {
      alert(
        "Ошибки призового фонда:\n\n" +
          errors.join("\n") +
          "\n\nПожалуйста, исправьте их на Шаге 3."
      );
      setWizardStep(3);
      return;
    }

    setIsSaving(true);
    try {
      const prizeDistribution = {
        totalBonusPool,
        placements: placements.map((p) => ({
          ...p,
          cashPct: p.cashPct / 100,
        })),
      };

      const payload = {
        action: editTournamentId ? "edit" : "create",
        id: editTournamentId || undefined,
        name: name.trim(),
        discipline,
        type,
        entryFee,
        clubSharePct,
        prizeType: "combined",
        prizePoolMode,
        fixedPrizeAmount,
        prizeDistribution,
        rules: rules.trim(),
        startsAt: startsAt || null,
        settings: {
          maxParticipants: maxParticipants > 0 ? maxParticipants : null,
          entryFeeType,
          mapPool,
          itemPool,
          bracketType,
          matchFormat,
          semiFinalFormat,
          grandFinalFormat,
        },
      };

      const res = await fetch(`/api/clubs/${clubId}/tournaments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        const tournamentId = editTournamentId || data.tournament?.id;
        router.push(
          `/clubs/${clubId}/tournaments${
            tournamentId ? `?id=${tournamentId}` : ""
          }`
        );
      } else {
        const data = await res.json();
        alert(data.error || "Не удалось сохранить турнир");
      }
    } catch (err) {
      console.error(err);
      alert("Ошибка сети при сохранении турнира");
    } finally {
      setIsSaving(false);
    }
  };

  const steps = [
    { step: 1, title: "1. Основная информация", desc: "Название, дисциплина, даты" },
    { step: 2, title: "2. Сетка и форматы матчей", desc: "BO1/BO3 полуфиналов и финала" },
    { step: 3, title: "3. Взносы и призовой фонд", desc: "Калькулятор, бонусы и награды" },
    { step: 4, title: "4. Регламент и правила", desc: "Шаблоны правил" },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Top Header Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white border border-slate-200 rounded-[2rem] p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <Link
              href={`/clubs/${clubId}/tournaments`}
              className="p-3 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-950 rounded-2xl border border-slate-200 transition-colors shadow-sm"
              title="Назад к списку турниров"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-orange-500 block">
                {editTournamentId ? "Редактирование турнира" : "Создание турнира"}
              </span>
              <h1 className="text-2xl font-black uppercase italic tracking-tight text-slate-900 mt-0.5">
                {name ||
                  (editTournamentId
                    ? "Редактировать турнир"
                    : "Новый киберспортивный турнир")}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <Link
              href={`/clubs/${clubId}/tournaments`}
              className="px-5 py-3 rounded-2xl bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs uppercase tracking-wider transition-all border border-slate-200 shadow-sm text-center"
            >
              Отмена
            </Link>
            <button
              onClick={() => handleSubmit()}
              disabled={isSaving}
              className="px-7 py-3 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-orange-500/10 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>
                {isSaving
                  ? "Сохранение..."
                  : editTournamentId
                  ? "Сохранить изменения"
                  : "Создать турнир"}
              </span>
            </button>
          </div>
        </div>

        {/* Wizard Step Selector Tabs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {steps.map((s) => (
            <button
              key={s.step}
              type="button"
              onClick={() => setWizardStep(s.step)}
              className={cn(
                "p-4 rounded-2xl border text-left transition-all relative overflow-hidden cursor-pointer",
                wizardStep === s.step
                  ? "bg-white border-orange-500 shadow-sm ring-2 ring-orange-500/20"
                  : wizardStep > s.step
                  ? "bg-white border-emerald-200 hover:bg-slate-50 text-slate-800"
                  : "bg-white border-slate-200 hover:bg-slate-50 text-slate-400"
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <span
                  className={cn(
                    "text-xs font-black uppercase tracking-wider",
                    wizardStep === s.step
                      ? "text-orange-500"
                      : wizardStep > s.step
                      ? "text-slate-900 font-bold"
                      : "text-slate-500"
                  )}
                >
                  {s.title}
                </span>
                {wizardStep > s.step && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                )}
              </div>
              <span className="text-[11px] text-slate-400 font-medium block truncate">
                {s.desc}
              </span>
            </button>
          ))}
        </div>

        {/* Step Body Card */}
        <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-sm space-y-8">
          {/* STEP 1: Main Info */}
          {wizardStep === 1 && (
            <div className="space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <h3 className="text-lg font-black uppercase italic tracking-tight text-slate-900 flex items-center gap-2">
                  <Gamepad2 className="w-5 h-5 text-orange-500" />
                  Шаг 1: Основная информация
                </h3>
                <p className="text-xs text-slate-400 font-medium mt-1">
                  Задайте название, выберите дисциплину и формат участия игроков.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase tracking-wider text-slate-500">
                  Название турнира *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Colizeum CS2 Solo Cup #1..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 text-xs text-slate-900 font-bold focus:outline-none focus:border-orange-500 focus:bg-white transition-colors"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase tracking-wider text-slate-500 block">
                  Дисциплина турнира
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { id: "cs2", name: "Counter-Strike 2", badge: "Автосервер" },
                    { id: "fifa", name: "EA FC / FIFA", badge: "Ручной ввод" },
                    { id: "ufc", name: "UFC", badge: "Ручной ввод" },
                    { id: "dota2", name: "Dota 2", badge: "Ручной ввод" },
                  ].map((discItem) => (
                    <button
                      key={discItem.id}
                      type="button"
                      onClick={() => setDiscipline(discItem.id)}
                      className={cn(
                        "p-4 rounded-2xl border text-left transition-all flex flex-col justify-between gap-2 cursor-pointer",
                        discipline === discItem.id
                          ? "bg-slate-900 text-white border-slate-900 shadow-md"
                          : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100/60"
                      )}
                    >
                      <span className="text-xs font-black uppercase tracking-wider">
                        {discItem.name}
                      </span>
                      <span
                        className={cn(
                          "text-[9px] font-bold uppercase tracking-wider",
                          discipline === discItem.id
                            ? "text-orange-400"
                            : "text-slate-400"
                        )}
                      >
                        {discItem.badge}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase tracking-wider text-slate-500 block">
                  Формат участников
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {formatOptions.map((typeItem) => (
                    <button
                      key={typeItem.id}
                      type="button"
                      onClick={() => {
                        setType(typeItem.id);
                        if (!editTournamentId) {
                          if (typeItem.id === "1vs1") {
                            setMapPool(CS2_AIM_1V1_MAP_POOL);
                            setMapFilter("1v1");
                          } else if (
                            typeItem.id === "2vs2" ||
                            typeItem.id === "mix_2vs2"
                          ) {
                            setMapPool(CS2_WINGMAN_MAP_POOL);
                            setMapFilter("wingman");
                          } else {
                            setMapPool(CS2_5V5_MAP_POOL);
                            setMapFilter("5v5");
                          }
                        }
                      }}
                      className={cn(
                        "py-3.5 px-4 rounded-2xl border font-bold text-xs uppercase tracking-wider transition-all text-center cursor-pointer",
                        type === typeItem.id
                          ? "bg-slate-900 text-white border-slate-900 shadow-md"
                          : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100/60"
                      )}
                    >
                      {typeItem.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-orange-500" />
                  Дата и время старта
                </label>
                <input
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 text-xs text-slate-900 font-bold focus:outline-none focus:border-orange-500 focus:bg-white transition-colors"
                />
              </div>
            </div>
          )}

          {/* STEP 2: Bracket & Match Formats */}
          {wizardStep === 2 && (
            <div className="space-y-8">
              <div className="border-b border-slate-100 pb-4">
                <h3 className="text-lg font-black uppercase italic tracking-tight text-slate-900 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-orange-500" />
                  Шаг 2: Формат сетки и регламент матчей
                </h3>
                <p className="text-xs text-slate-400 font-medium mt-1">
                  Настройте тип турнирной сетки и режимы BO1/BO3/BO5 раздельно для
                  ранних стадий, полуфинала и финала.
                </p>
              </div>

              {/* Bracket Type */}
              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase tracking-wider text-slate-500 block">
                  Тип турнирной сетки
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    {
                      id: "single_elimination",
                      title: "Олимпийская сетка",
                      desc: "Single Elimination (на выбывание)",
                    },
                    {
                      id: "double_elimination",
                      title: "Double Elimination",
                      desc: "Верхняя и нижняя сетка (шанс в Losers)",
                    },
                    {
                      id: "round_robin",
                      title: "Групповой этап",
                      desc: "Round Robin (каждый с каждым в группах)",
                    },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setBracketType(item.id as any)}
                      className={cn(
                        "p-5 rounded-2xl border text-left transition-all flex flex-col justify-between gap-1.5 cursor-pointer",
                        bracketType === item.id
                          ? "bg-slate-900 text-white border-slate-900 shadow-md"
                          : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100/60"
                      )}
                    >
                      <span className="text-xs font-black uppercase tracking-wider">
                        {item.title}
                      </span>
                      <span
                        className={cn(
                          "text-[11px] font-medium",
                          bracketType === item.id
                            ? "text-slate-300"
                            : "text-slate-400"
                        )}
                      >
                        {item.desc}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Granular Match Formats */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-3xl p-6 space-y-6">
                <div className="flex items-center gap-2 border-b border-slate-200/60 pb-3">
                  <Swords className="w-4 h-4 text-orange-500" />
                  <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                    Режимы матчей (Количество карт)
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* 1. Regular / Early Rounds */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 block">
                      Ранние стадии и группы
                    </label>
                    <span className="text-[9px] text-slate-400 block -mt-1 mb-2">
                      1/16, 1/8, 1/4 финала
                    </span>
                    <div className="grid grid-cols-3 gap-1.5 bg-white p-1.5 rounded-2xl border border-slate-200">
                      {(["bo1", "bo3", "bo5"] as const).map((fmt) => (
                        <button
                          key={fmt}
                          type="button"
                          onClick={() => setMatchFormat(fmt)}
                          className={cn(
                            "py-2.5 rounded-xl font-black text-xs uppercase transition-all text-center cursor-pointer",
                            matchFormat === fmt
                              ? "bg-orange-500 text-white shadow-sm"
                              : "text-slate-400 hover:text-slate-800"
                          )}
                        >
                          {fmt.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 2. Semi-Finals */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 block">
                      Полуфиналы (1/2 финала)
                    </label>
                    <span className="text-[9px] text-slate-400 block -mt-1 mb-2">
                      Матчи за выход в финал
                    </span>
                    <div className="grid grid-cols-3 gap-1.5 bg-white p-1.5 rounded-2xl border border-slate-200">
                      {(["bo1", "bo3", "bo5"] as const).map((fmt) => (
                        <button
                          key={fmt}
                          type="button"
                          onClick={() => setSemiFinalFormat(fmt)}
                          className={cn(
                            "py-2.5 rounded-xl font-black text-xs uppercase transition-all text-center cursor-pointer",
                            semiFinalFormat === fmt
                              ? "bg-orange-500 text-white shadow-sm"
                              : "text-slate-400 hover:text-slate-800"
                          )}
                        >
                          {fmt.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 3. Grand Finals */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 block">
                      Гранд-Финал
                    </label>
                    <span className="text-[9px] text-slate-400 block -mt-1 mb-2">
                      Матч за чемпионский титул
                    </span>
                    <div className="grid grid-cols-3 gap-1.5 bg-white p-1.5 rounded-2xl border border-slate-200">
                      {(["bo1", "bo3", "bo5"] as const).map((fmt) => (
                        <button
                          key={fmt}
                          type="button"
                          onClick={() => setGrandFinalFormat(fmt)}
                          className={cn(
                            "py-2.5 rounded-xl font-black text-xs uppercase transition-all text-center cursor-pointer",
                            grandFinalFormat === fmt
                              ? "bg-orange-500 text-white shadow-sm"
                              : "text-slate-400 hover:text-slate-800"
                          )}
                        >
                          {fmt.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* CS2 Map Pool selection */}
              {discipline === "cs2" && (
                <div className="bg-slate-50 border border-slate-200/80 rounded-3xl p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/60 pb-4">
                    <div>
                      <span className="text-xs font-black uppercase tracking-wider text-slate-800 block">
                        Пул карт для CS2 Veto ({mapPool.length} выбрано)
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        Выберите карты для стадии банов и пиков (Veto) перед началом матча
                      </span>
                    </div>

                    {/* Quick Preset Buttons */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setMapPool(CS2_5V5_MAP_POOL);
                          setMapFilter("5v5");
                        }}
                        className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer shadow-2xs"
                      >
                        5x5 Premier ({CS2_5V5_MAP_POOL.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMapPool(CS2_WINGMAN_MAP_POOL);
                          setMapFilter("wingman");
                        }}
                        className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer shadow-2xs"
                      >
                        2x2 Напарники ({CS2_WINGMAN_MAP_POOL.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMapPool(CS2_AIM_1V1_MAP_POOL);
                          setMapFilter("1v1");
                        }}
                        className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer shadow-2xs"
                      >
                        1x1 Aim ({CS2_AIM_1V1_MAP_POOL.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMapPool(CS2_ALL_MAPS.map((m) => m.id));
                          setMapFilter("all");
                        }}
                        className="px-2.5 py-1 rounded-lg bg-orange-50 hover:bg-orange-100 border border-orange-200 text-orange-700 text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer"
                      >
                        Все ({CS2_ALL_MAPS.length})
                      </button>
                    </div>
                  </div>

                  {/* Filter Tabs */}
                  <div className="flex items-center gap-1.5 bg-slate-200/60 p-1 rounded-xl w-fit">
                    {[
                      { id: "all", label: `Все (${CS2_ALL_MAPS.length})` },
                      { id: "5v5", label: `5x5 Premier (${CS2_ALL_MAPS.filter((m) => m.categories.includes("5v5")).length})` },
                      { id: "wingman", label: `2x2 Напарники (${CS2_ALL_MAPS.filter((m) => m.categories.includes("wingman")).length})` },
                      { id: "1v1", label: `1x1 Aim (${CS2_ALL_MAPS.filter((m) => m.categories.includes("1v1")).length})` },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setMapFilter(tab.id as any)}
                        className={cn(
                          "px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer",
                          mapFilter === tab.id
                            ? "bg-white text-slate-900 shadow-2xs"
                            : "text-slate-500 hover:text-slate-900"
                        )}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Maps Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                    {filteredMaps.map((mapItem) => {
                      const isChecked = mapPool.includes(mapItem.id);
                      return (
                        <button
                          key={mapItem.id}
                          type="button"
                          onClick={() => {
                            if (isChecked) {
                              if (mapPool.length <= 1) {
                                alert("В пуле должна остаться минимум 1 карта!");
                                return;
                              }
                              setMapPool(
                                mapPool.filter((id) => id !== mapItem.id)
                              );
                            } else {
                              setMapPool([...mapPool, mapItem.id]);
                            }
                          }}
                          className={cn(
                            "py-2.5 px-3 rounded-xl border text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-between cursor-pointer",
                            isChecked
                              ? "bg-orange-50 text-orange-700 border-orange-300 shadow-2xs"
                              : "bg-white text-slate-500 border-slate-200 hover:text-slate-800 hover:border-slate-300"
                          )}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span
                              className={cn(
                                "text-[9px] font-extrabold px-1.5 py-0.5 rounded",
                                mapItem.categories.includes("1v1")
                                  ? "bg-purple-100 text-purple-700"
                                  : mapItem.categories.includes("wingman") && mapItem.categories.includes("5v5")
                                  ? "bg-blue-100 text-blue-700"
                                  : mapItem.categories.includes("wingman")
                                  ? "bg-indigo-100 text-indigo-700"
                                  : "bg-amber-100 text-amber-700"
                              )}
                            >
                              {mapItem.badge}
                            </span>
                            <span className="truncate">{mapItem.label}</span>
                          </div>
                          <span className="text-[11px] font-black ml-2 shrink-0">
                            {isChecked ? "✓" : "+"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Fees & Prize Pool */}
          {wizardStep === 3 && (
            <div className="space-y-8">
              <div className="border-b border-slate-100 pb-4">
                <h3 className="text-lg font-black uppercase italic tracking-tight text-slate-900 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-orange-500" />
                  Шаг 3: Взносы и призовой фонд
                </h3>
                <p className="text-xs text-slate-400 font-medium mt-1">
                  Задайте размер взноса, комиссию клуба и распределение денежных
                  призов, бонусов и девайсов.
                </p>
              </div>

              {/* Limits and Fees Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase tracking-wider text-slate-500">
                    Лимит слотов ({isTeamFormat ? "команд" : "игроков"})
                  </label>
                  <input
                    type="number"
                    min={2}
                    value={maxParticipants}
                    onChange={(e) =>
                      setMaxParticipants(parseInt(e.target.value, 10) || 2)
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 text-xs text-slate-900 font-bold focus:outline-none focus:border-orange-500 focus:bg-white transition-colors"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase tracking-wider text-slate-500">
                    {isTeamFormat
                      ? `Взнос ${
                          entryFeeType === "player" ? "с игрока" : "с команды"
                        } (₽)`
                      : "Взнос с игрока (₽)"}
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={entryFee}
                    onChange={(e) =>
                      setEntryFee(parseInt(e.target.value, 10) || 0)
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 text-xs text-slate-900 font-bold focus:outline-none focus:border-orange-500 focus:bg-white transition-colors"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase tracking-wider text-slate-500">
                    Доля клуба (% комиссии)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={clubSharePct}
                    onChange={(e) =>
                      setClubSharePct(parseInt(e.target.value, 10) || 0)
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 text-xs text-slate-900 font-bold focus:outline-none focus:border-orange-500 focus:bg-white transition-colors"
                  />
                </div>
              </div>

              {/* Team Entry Fee Mode */}
              {isTeamFormat && (
                <div className="bg-slate-50 border border-slate-200/80 p-5 rounded-2xl space-y-3">
                  <label className="text-[9px] font-black uppercase tracking-wider text-slate-500 block">
                    Как рассчитывать взнос для команды?
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setEntryFeeType("player")}
                      className={cn(
                        "py-3 rounded-xl border text-xs font-bold uppercase tracking-wider transition-all cursor-pointer",
                        entryFeeType === "player"
                          ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100/60"
                      )}
                    >
                      С каждого игрока ({entryFee} ₽ × {teamSize} ={" "}
                      {entryFee * teamSize} ₽)
                    </button>
                    <button
                      type="button"
                      onClick={() => setEntryFeeType("team")}
                      className={cn(
                        "py-3 rounded-xl border text-xs font-bold uppercase tracking-wider transition-all cursor-pointer",
                        entryFeeType === "team"
                          ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100/60"
                      )}
                    >
                      Фиксированно с команды ({entryFee} ₽ за всю команду)
                    </button>
                  </div>
                </div>
              )}

              {/* Prize Pool Mode & Bonus Pool */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase tracking-wider text-slate-500">
                    Режим формирования фонда наличных
                  </label>
                  <select
                    value={prizePoolMode}
                    onChange={(e) => setPrizePoolMode(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 text-xs text-slate-900 font-bold focus:outline-none focus:border-orange-500 focus:bg-white transition-colors"
                  >
                    <option value="dynamic">
                      Динамический (от взносов участников)
                    </option>
                    <option value="fixed">Фиксированный гарант клуба</option>
                  </select>
                </div>

                {prizePoolMode === "fixed" ? (
                  <div className="space-y-2">
                    <label className="text-[9px] font-black uppercase tracking-wider text-slate-500">
                      Сумма гаранта наличных (₽)
                    </label>
                    <input
                      type="number"
                      value={fixedPrizeAmount}
                      onChange={(e) =>
                        setFixedPrizeAmount(parseInt(e.target.value, 10) || 0)
                      }
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 text-xs text-slate-900 font-bold focus:outline-none focus:border-orange-500 focus:bg-white transition-colors"
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="text-[9px] font-black uppercase tracking-wider text-slate-500">
                      Бонусы клуба (дополнительный фонд)
                    </label>
                    <input
                      type="number"
                      value={totalBonusPool || ""}
                      onChange={(e) =>
                        setTotalBonusPool(parseInt(e.target.value, 10) || 0)
                      }
                      placeholder="Например: 10000"
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 text-xs text-slate-900 font-bold focus:outline-none focus:border-orange-500 focus:bg-white transition-colors"
                    />
                  </div>
                )}
              </div>

              {/* Calculations Overview Card */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-3xl p-6 space-y-3">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block border-b border-slate-200 pb-2">
                  Детализация призового фонда при заполненных слотах (
                  {maxParticipants} слотов)
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
                  <div>
                    <span className="text-[9px] uppercase font-bold text-slate-500 block">
                      Сбор взносов
                    </span>
                    <span className="text-base font-black text-slate-900">
                      {totalFeesCollected} ₽
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase font-bold text-slate-500 block">
                      Доля клуба ({clubSharePct}%)
                    </span>
                    <span className="text-base font-black text-rose-600">
                      -{clubCommission} ₽
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase font-bold text-slate-500 block">
                      Призовой фонд (Нал)
                    </span>
                    <span className="text-base font-black text-emerald-600">
                      {estimatedPrizePool} ₽
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase font-bold text-slate-500 block">
                      Общая ценность фонда
                    </span>
                    <span className="text-base font-black text-orange-500">
                      {estimatedPrizePool + totalBonusPool + totalItemsValue} ₽
                    </span>
                  </div>
                </div>
              </div>

              {/* Item Pool Management */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-3xl p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                    <Award className="w-4 h-4 text-orange-500" />
                    Пул призовых предметов и девайсов (Item Pool)
                  </span>
                </div>

                {itemPool.length > 0 && (
                  <div className="space-y-2">
                    {itemPool.map((item) => (
                      <div
                        key={item.id}
                        className="flex justify-between items-center bg-white border border-slate-100 rounded-xl px-4 py-2.5 text-xs"
                      >
                        <div>
                          <span className="font-bold text-slate-800 block">
                            {item.name}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {item.cost} ₽
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setItemPool(
                              itemPool.filter((i) => i.id !== item.id)
                            );
                            setPlacements(
                              placements.map((p) =>
                                p.itemId === item.id
                                  ? { ...p, itemId: "", item: "" }
                                  : p
                              )
                            );
                          }}
                          className="text-slate-400 hover:text-rose-600 p-1 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add new item */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-200/60">
                  <input
                    type="text"
                    id="new-item-name"
                    placeholder="Название приза (Клавиатура, мышь...)"
                    className="sm:col-span-2 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900"
                  />
                  <div className="flex gap-2">
                    <input
                      type="number"
                      id="new-item-cost"
                      placeholder="Цена ₽"
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const nInput = document.getElementById(
                          "new-item-name"
                        ) as HTMLInputElement;
                        const cInput = document.getElementById(
                          "new-item-cost"
                        ) as HTMLInputElement;
                        if (!nInput?.value.trim())
                          return alert("Введите название приза!");
                        const cost = parseInt(cInput?.value, 10) || 0;
                        setItemPool([
                          ...itemPool,
                          {
                            id: String(Date.now()),
                            name: nInput.value.trim(),
                            cost,
                          },
                        ]);
                        nInput.value = "";
                        cInput.value = "";
                      }}
                      className="px-4 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-black uppercase transition-all shrink-0 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Placements Config */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                    Распределение наград по местам
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const feeMult =
                        isTeamFormat && entryFeeType === "player"
                          ? teamSize
                          : 1;
                      const feePerComp = entryFee * feeMult;
                      const balanced = autoBalancePlacements(
                        placements,
                        estimatedPrizePool,
                        feePerComp
                      );
                      setPlacements(balanced);
                    }}
                    className="px-3.5 py-1.5 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-emerald-700 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer"
                  >
                    Автобаланс долей
                  </button>
                </div>

                <div className="space-y-3">
                  {placements.map((p, idx) => {
                    const count = getCountFromLabel(p.label);
                    const slotCash = Math.round(
                      estimatedPrizePool * ((p.cashPct || 0) / 100)
                    );

                    return (
                      <div
                        key={p.id || idx}
                        className="bg-slate-50 border border-slate-200/60 p-5 rounded-2xl space-y-4"
                      >
                        <div className="flex justify-between items-center gap-4">
                          <input
                            type="text"
                            value={p.label}
                            onChange={(e) => {
                              const updated = [...placements];
                              updated[idx].label = e.target.value;
                              setPlacements(updated);
                            }}
                            className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-black text-slate-900"
                          />
                          <div className="flex items-center gap-4">
                            <span className="text-xs font-black text-emerald-600">
                              {count > 1
                                ? `По ${slotCash} ₽ (всего ${
                                    slotCash * count
                                  } ₽)`
                                : `${slotCash} ₽`}
                            </span>
                            {placements.length > 1 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setPlacements(
                                    placements.filter((_, i) => i !== idx)
                                  )
                                }
                                className="text-slate-400 hover:text-rose-600 transition-colors p-1 cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="text-[9px] uppercase font-black text-slate-500 block mb-1">
                              Доля наличных (% на слот)
                            </label>
                            <input
                              type="number"
                              value={p.cashPct || 0}
                              onChange={(e) => {
                                const updated = [...placements];
                                updated[idx].cashPct =
                                  parseInt(e.target.value, 10) || 0;
                                setPlacements(updated);
                              }}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-bold"
                            />
                          </div>

                          <div>
                            <label className="text-[9px] uppercase font-black text-slate-500 block mb-1">
                              Бонусы клуба (Б на слот)
                            </label>
                            <input
                              type="number"
                              value={p.bonus || 0}
                              onChange={(e) => {
                                const updated = [...placements];
                                updated[idx].bonus =
                                  parseInt(e.target.value, 10) || 0;
                                setPlacements(updated);
                              }}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-bold"
                            />
                          </div>

                          <div>
                            <label className="text-[9px] uppercase font-black text-slate-500 block mb-1">
                              Призовой девайс
                            </label>
                            <select
                              value={p.itemId || ""}
                              onChange={(e) => {
                                const updated = [...placements];
                                const selectedId = e.target.value;
                                updated[idx].itemId = selectedId;
                                const matched = itemPool.find(
                                  (i) => i.id === selectedId
                                );
                                updated[idx].item = matched ? matched.name : "";
                                setPlacements(updated);
                              }}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-bold"
                            >
                              <option value="">Без предмета</option>
                              {itemPool.map((item) => (
                                <option key={item.id} value={item.id}>
                                  {item.name} ({item.cost} ₽)
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex gap-3 justify-center pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      const last =
                        placements[placements.length - 1]?.label || "0";
                      const match = last.match(/(\d+)/g);
                      const next = match
                        ? parseInt(match[match.length - 1], 10) + 1
                        : placements.length + 1;
                      setPlacements([
                        ...placements,
                        {
                          id: String(Date.now()),
                          label: `${next} Место`,
                          cashPct: 0,
                          bonus: 0,
                          item: "",
                        },
                      ]);
                    }}
                    className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
                  >
                    + Добавить место
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const last =
                        placements[placements.length - 1]?.label || "0";
                      const match = last.match(/(\d+)/g);
                      const start = match
                        ? parseInt(match[match.length - 1], 10) + 1
                        : 4;
                      setPlacements([
                        ...placements,
                        {
                          id: String(Date.now()),
                          label: `${start}-${start + 2} Место`,
                          cashPct: 0,
                          bonus: 0,
                          item: "",
                        },
                      ]);
                    }}
                    className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
                  >
                    + Добавить диапазон
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Rules & Templates */}
          {wizardStep === 4 && (
            <div className="space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <h3 className="text-lg font-black uppercase italic tracking-tight text-slate-900 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-orange-500" />
                  Шаг 4: Регламент и правила турнира
                </h3>
                <p className="text-xs text-slate-400 font-medium mt-1">
                  Напишите регламент турнира или выберите готовый шаблон.
                </p>
              </div>

              {rulesTemplates.length > 0 && (
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase tracking-wider text-slate-500 block">
                    Выбрать готовый шаблон правил
                  </label>
                  <select
                    value={selectedTemplateId}
                    onChange={(e) => handleSelectTemplate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 text-xs text-slate-900 font-bold"
                  >
                    <option value="">-- Выберите шаблон правил --</option>
                    {rulesTemplates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase tracking-wider text-slate-500 block">
                  Текст правил и регламента
                </label>
                <textarea
                  value={rules}
                  onChange={(e) => setRules(e.target.value)}
                  rows={8}
                  placeholder="1. Общие положения...&#10;2. Запрещенные действия...&#10;3. Порядок решения спорных ситуаций..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs text-slate-900 focus:outline-none focus:border-orange-500 focus:bg-white transition-colors leading-relaxed font-medium"
                />
              </div>

              {/* Save as Template */}
              <div className="bg-slate-50 border border-slate-200/80 p-5 rounded-2xl space-y-3">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 block">
                  Сохранить эти правила как шаблон для будущих турниров
                </span>
                <div className="flex gap-3">
                  <input
                    type="text"
                    placeholder="Название шаблона (например: Стандарт CS2 5x5 Colizeum)"
                    value={newTemplateName}
                    onChange={(e) => setNewTemplateName(e.target.value)}
                    className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900"
                  />
                  <button
                    type="button"
                    onClick={handleSaveRulesTemplate}
                    disabled={isSavingTemplate}
                    className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 shrink-0 cursor-pointer"
                  >
                    <Save className="w-4 h-4 text-orange-400" />
                    <span>Сохранить шаблон</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Wizard Bottom Navigation Buttons */}
          <div className="flex justify-between items-center pt-6 border-t border-slate-100">
            {wizardStep > 1 ? (
              <button
                type="button"
                onClick={() => setWizardStep(wizardStep - 1)}
                className="px-6 py-3.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Назад</span>
              </button>
            ) : (
              <div />
            )}

            {wizardStep < 4 ? (
              <button
                type="button"
                onClick={() => setWizardStep(wizardStep + 1)}
                className="px-8 py-3.5 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-black text-xs uppercase tracking-widest transition-all shadow-md shadow-orange-500/10 flex items-center gap-2 cursor-pointer"
              >
                <span>Далее</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleSubmit()}
                disabled={isSaving}
                className="px-10 py-4 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-orange-500/20 flex items-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>
                  {isSaving
                    ? "Сохранение..."
                    : editTournamentId
                    ? "Сохранить изменения"
                    : "Создать турнир"}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
