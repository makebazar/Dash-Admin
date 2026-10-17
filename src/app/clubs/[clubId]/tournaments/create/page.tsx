"use client";

import React, { useState, useEffect, useMemo, useCallback, use } from "react";
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
import { Button } from "@/components/ui/button";

const CS2_5V5_MAP_POOL = [
  "de_mirage",
  "de_dust2",
  "de_inferno",
  "de_nuke",
  "de_anubis",
  "de_ancient",
  "de_vertigo",
];

const CS2_WINGMAN_MAP_POOL = [
  "de_inferno",
  "de_vertigo",
  "de_nuke",
  "de_overpass",
];

const CS2_AIM_1V1_MAP_POOL = [
  "aim_redline",
  "aim_map",
  "awp_lego_2",
  "aim_ak47",
  "aim_headshot",
  "aim_dust2",
  "aim_pistol_cs2",
];

interface CS2MapItem {
  id: string;
  label: string;
  categories: ("5v5" | "wingman" | "1v1")[];
  badge: string;
  isWorkshop?: boolean;
  imageUrl?: string | null;
  description?: string;
}

const CS2_ALL_MAPS: CS2MapItem[] = [
  // 5v5 Competitive Maps & Genuine CS2 Wingman Maps
  { id: "de_mirage", label: "Mirage", categories: ["5v5"], badge: "5x5", imageUrl: "/images/maps/de_mirage.png" },
  { id: "de_dust2", label: "Dust II", categories: ["5v5"], badge: "5x5", imageUrl: "/images/maps/de_dust2.png" },
  { id: "de_inferno", label: "Inferno", categories: ["5v5", "wingman"], badge: "5x5 / 2x2", imageUrl: "/images/maps/de_inferno.png" },
  { id: "de_nuke", label: "Nuke", categories: ["5v5", "wingman"], badge: "5x5 / 2x2", imageUrl: "/images/maps/de_nuke.png" },
  { id: "de_anubis", label: "Anubis", categories: ["5v5"], badge: "5x5", imageUrl: "/images/maps/de_anubis.png" },
  { id: "de_vertigo", label: "Vertigo", categories: ["5v5", "wingman"], badge: "5x5 / 2x2", imageUrl: "/images/maps/de_vertigo.png" },
  { id: "de_overpass", label: "Overpass", categories: ["5v5", "wingman"], badge: "5x5 / 2x2", imageUrl: "/images/maps/de_overpass.png" },
  { id: "de_ancient", label: "Ancient", categories: ["5v5"], badge: "5x5", imageUrl: "/images/maps/de_ancient.png" },
  { id: "de_train", label: "Train", categories: ["5v5"], badge: "5x5", imageUrl: "/images/maps/de_train.png" },
  { id: "cs_office", label: "Office", categories: ["5v5"], badge: "5x5", imageUrl: "/images/maps/cs_office.png" },
  { id: "cs_italy", label: "Italy", categories: ["5v5"], badge: "5x5", imageUrl: "/images/maps/cs_italy.png" },

  // 1v1 Aim & Duels
  { id: "aim_redline", label: "Aim Redline", categories: ["1v1"], badge: "1x1", imageUrl: "/images/maps/de_dust2.png" },
  { id: "aim_map", label: "Aim Map", categories: ["1v1"], badge: "1x1", imageUrl: "/images/maps/de_mirage.png" },
  { id: "awp_lego_2", label: "AWP Lego 2", categories: ["1v1"], badge: "1x1", imageUrl: "/images/maps/de_dust2.png" },
  { id: "aim_ak47", label: "Aim AK47", categories: ["1v1"], badge: "1x1", imageUrl: "/images/maps/de_inferno.png" },
  { id: "aim_headshot", label: "Aim Headshot", categories: ["1v1"], badge: "1x1", imageUrl: "/images/maps/de_nuke.png" },
  { id: "aim_dust2", label: "Aim Dust2", categories: ["1v1"], badge: "1x1", imageUrl: "/images/maps/de_dust2.png" },
  { id: "aim_pistol_cs2", label: "Aim Pistol", categories: ["1v1"], badge: "1x1", imageUrl: "/images/maps/de_anubis.png" },
  { id: "aim_aztec", label: "Aim Aztec", categories: ["1v1"], badge: "1x1", imageUrl: "/images/maps/de_ancient.png" },
];

const CS2_NOMINATIONS = [
  {
    id: "mvp",
    enabled: false,
    label: "MVP Турнира",
    description: "Игрок с наивысшим общим рейтингом Rating 2.0 за весь турнир",
    icon: "👑",
    cashAmount: 0,
    bonusAmount: 500,
    item: "",
  },
  {
    id: "headshot",
    enabled: false,
    label: "Headshot King",
    description: "Игрок с самым высоким процентом попаданий в голову (% HS)",
    icon: "🎯",
    cashAmount: 0,
    bonusAmount: 300,
    item: "",
  },
  {
    id: "damage",
    enabled: false,
    label: "Damage Leader",
    description: "Игрок с наибольшим средним уроном за раунд (ADR)",
    icon: "💣",
    cashAmount: 0,
    bonusAmount: 300,
    item: "",
  },
  {
    id: "clutch",
    enabled: false,
    label: "Clutch Master",
    description: "Игрок, выигравший больше всего клатчей (1vX)",
    icon: "🛡️",
    cashAmount: 0,
    bonusAmount: 300,
    item: "",
  },
  {
    id: "entry",
    enabled: false,
    label: "First Blood King",
    description: "Игрок с наибольшим количеством открывающих фрагов (First Kills)",
    icon: "⚡",
    cashAmount: 0,
    bonusAmount: 300,
    item: "",
  },
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
  const [mapFilter, setMapFilter] = useState<"all" | "5v5" | "wingman" | "1v1" | "workshop">("5v5");
  const [customClubMaps, setCustomClubMaps] = useState<any[]>([]);

  // Dota 2 settings
  const [dotaGameMode, setDotaGameMode] = useState<"CM" | "1V1MID" | "AP" | "TURBO">("CM");
  const [dotaServerRegion, setDotaServerRegion] = useState<"STOCKHOLM" | "EUROPE">("STOCKHOLM");

  // Fetch club workshop maps
  const fetchClubCustomMaps = useCallback(async () => {
    try {
      const res = await fetch(`/api/clubs/${clubId}/cs2/custom-maps`);
      if (res.ok) {
        const data = await res.json();
        setCustomClubMaps(data.maps || []);
      }
    } catch (err) {
      console.error("Error fetching custom maps:", err);
    }
  }, [clubId]);

  useEffect(() => {
    fetchClubCustomMaps();
  }, [fetchClubCustomMaps]);

  const allCombinedMaps = useMemo(() => {
    const customItems: CS2MapItem[] = (customClubMaps || []).map((cm: any) => ({
      id: cm.map_id,
      label: cm.name,
      categories: cm.match_format === "all" ? ["5v5", "wingman", "1v1"] : [cm.match_format],
      badge: "Workshop",
      isWorkshop: true,
      imageUrl: cm.image_url,
      description: cm.description,
    }));
    return [...CS2_ALL_MAPS, ...customItems];
  }, [customClubMaps]);

  const filteredMaps = useMemo(() => {
    if (mapFilter === "all") return allCombinedMaps;
    if (mapFilter === "workshop") return allCombinedMaps.filter((m) => m.isWorkshop);
    return allCombinedMaps.filter((m) => m.categories.includes(mapFilter as any));
  }, [mapFilter, allCombinedMaps]);

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

  // Tournament Nominations & Special Awards
  const [nominations, setNominations] = useState<
    Array<{
      id: string;
      enabled: boolean;
      label: string;
      description: string;
      icon: string;
      cashAmount: number;
      bonusAmount: number;
      item: string;
    }>
  >(CS2_NOMINATIONS);

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
          const cfg = t.config?.settings || t.config || {};
          setEntryFeeType(cfg.entryFeeType || "player");
          setBracketType(cfg.bracketType || "single_elimination");

          // Formats
          setMatchFormat(cfg.matchFormat || cfg.match_format || "bo1");
          setSemiFinalFormat(
            cfg.semiFinalFormat || cfg.semi_final_format || cfg.matchFormat || "bo1"
          );
          setGrandFinalFormat(
            cfg.grandFinalFormat || cfg.grand_final_format || (cfg.matchFormat === "bo1" ? "bo3" : "bo3")
          );

          if (cfg.mapPool && Array.isArray(cfg.mapPool)) {
            setMapPool(cfg.mapPool);
          }
          if (cfg.itemPool && Array.isArray(cfg.itemPool)) {
            setItemPool(cfg.itemPool);
          }
          if (cfg.gameMode) {
            setDotaGameMode(cfg.gameMode);
          }
          if (cfg.serverRegion) {
            setDotaServerRegion(cfg.serverRegion);
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
            if (t.discipline === "cs2" && Array.isArray(t.prize_distribution.nominations) && t.prize_distribution.nominations.length > 0) {
              setNominations(t.prize_distribution.nominations);
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

  // Club Disciplines
  const [clubDisciplines, setClubDisciplines] = useState<any[]>([]);

  useEffect(() => {
    async function loadDisciplines() {
      try {
        const res = await fetch(`/api/clubs/${clubId}/tournaments?action=disciplines`);
        if (res.ok) {
          const data = await res.json();
          if (data.disciplines && data.disciplines.length > 0) {
            setClubDisciplines(data.disciplines);
          }
        }
      } catch (e) {
        console.error("Failed to load disciplines:", e);
      }
    }
    loadDisciplines();
  }, [clubId]);

  const displayDisciplines = useMemo(() => {
    if (clubDisciplines.length > 0) {
      return clubDisciplines.map((d) => ({
        id: d.key,
        name: d.name,
        badge: d.badge || (d.is_system ? "Автосервер" : "Ручной ввод"),
        formats: d.formats || [],
        is_system: d.is_system,
      }));
    }
    return [
      { id: "cs2", name: "Counter-Strike 2", badge: "Автосервер", formats: ["1vs1", "2vs2", "5vs5", "mix_2vs2", "mix_5vs5"], is_system: true },
      { id: "fifa", name: "EA FC / FIFA", badge: "Ручной ввод", formats: ["1vs1", "2vs2"], is_system: false },
      { id: "ufc", name: "UFC", badge: "Ручной ввод", formats: ["1vs1"], is_system: false },
      { id: "dota2", name: "Dota 2", badge: "Автосервер", formats: ["5vs5", "1vs1", "mix_5vs5"], is_system: true },
    ];
  }, [clubDisciplines]);

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
    const curDisc = displayDisciplines.find((d) => d.id === discipline);
    if (discipline === "cs2") {
      return [
        { id: "1vs1", name: "1vs1 Solo" },
        { id: "2vs2", name: "2vs2 Команды" },
        { id: "5vs5", name: "5vs5 Команды" },
        { id: "mix_2vs2", name: "Mix 2vs2 (Дуэты)" },
        { id: "mix_5vs5", name: "Mix (5x5 Сбалансированный)" },
      ];
    } else if (discipline === "dota2") {
      return [
        { id: "5vs5", name: "5vs5 Командный" },
        { id: "1vs1", name: "1vs1 Solo Mid" },
        { id: "mix_5vs5", name: "Mix 5vs5" },
      ];
    } else if (curDisc && Array.isArray(curDisc.formats) && curDisc.formats.length > 0) {
      const formatNames: Record<string, string> = {
        "1vs1": "1vs1 Solo",
        "2vs2": "2vs2 Команды",
        "3vs3": "3vs3 Команды",
        "4vs4": "4vs4 Команды",
        "5vs5": "5vs5 Команды",
        mix_2vs2: "Mix 2vs2 (Дуэты)",
        mix_5vs5: "Mix 5vs5 (Сбалансированный)",
      };
      return curDisc.formats.map((f: string) => ({
        id: f,
        name: formatNames[f] || f.toUpperCase(),
      }));
    } else if (discipline === "fifa" || discipline === "ufc") {
      return [
        { id: "1vs1", name: "1vs1 Solo" },
        { id: "2vs2", name: "2vs2 Команды" },
      ];
    }
    return [{ id: "1vs1", name: "1vs1 Solo" }];
  }, [discipline, displayDisciplines]);

  // Handlers for switching discipline and format
  const handleDisciplineChange = (newDiscipline: string) => {
    setDiscipline(newDiscipline);
    if (!editTournamentId) {
      if (newDiscipline === "dota2") {
        if (type === "1vs1") {
          setDotaGameMode("1V1MID");
        } else if (type === "5vs5" || type === "mix_5vs5") {
          if (dotaGameMode === "1V1MID") setDotaGameMode("CM");
        } else {
          setType("5vs5");
          setDotaGameMode("CM");
        }
      } else if (newDiscipline === "cs2") {
        if (type === "1vs1") {
          setMapPool(CS2_AIM_1V1_MAP_POOL);
          setMapFilter("1v1");
        } else if (type === "2vs2" || type === "mix_2vs2") {
          setMapPool(CS2_WINGMAN_MAP_POOL);
          setMapFilter("wingman");
        } else {
          setMapPool(CS2_5V5_MAP_POOL);
          setMapFilter("5v5");
        }
      }
    }
  };

  const handleTypeChange = (newType: string) => {
    setType(newType);
    if (!editTournamentId) {
      if (discipline === "dota2") {
        if (newType === "1vs1") {
          setDotaGameMode("1V1MID");
        } else {
          if (dotaGameMode === "1V1MID") {
            setDotaGameMode("CM");
          }
        }
      } else if (discipline === "cs2") {
        if (newType === "1vs1") {
          setMapPool(CS2_AIM_1V1_MAP_POOL);
          setMapFilter("1v1");
        } else if (newType === "2vs2" || newType === "mix_2vs2") {
          setMapPool(CS2_WINGMAN_MAP_POOL);
          setMapFilter("wingman");
        } else {
          setMapPool(CS2_5V5_MAP_POOL);
          setMapFilter("5v5");
        }
      }
    }
  };

  useEffect(() => {
    const allowed = formatOptions.map((f) => f.id);
    if (!allowed.includes(type)) {
      const nextType = allowed[0] || "1vs1";
      setType(nextType);
      if (discipline === "dota2") {
        if (nextType === "1vs1") {
          setDotaGameMode("1V1MID");
        } else {
          setDotaGameMode("CM");
        }
      }
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
        nominations: discipline === "cs2" ? nominations : [],
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
          mapPool: discipline === "cs2" ? mapPool : [],
          customMaps: discipline === "cs2" ? customClubMaps : [],
          itemPool,
          bracketType,
          matchFormat,
          semiFinalFormat,
          grandFinalFormat,
          gameMode: discipline === "dota2" ? dotaGameMode : undefined,
          serverRegion: discipline === "dota2" ? dotaServerRegion : undefined,
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
      <div className="flex min-h-screen bg-[#FAFAFA] items-center justify-center">
        <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#FAFAFA] flex-col font-sans text-slate-900 selection:bg-black/10">
      <main className="mx-auto max-w-6xl w-full flex-1 px-4 sm:px-6 md:px-8 py-8 sm:py-12 md:py-16 space-y-8">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-2">
          <div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-slate-900">
              {editTournamentId ? "Редактирование турнира" : "Создание турнира"}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
              {name.trim() ||
                (editTournamentId
                  ? "Настройка параметров турнира"
                  : "Пошаговая настройка киберспортивного турнира")}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              onClick={() => router.push(`/clubs/${clubId}/tournaments`)}
              className="h-10 sm:h-11 rounded-xl px-4 border-slate-200 text-slate-700 hover:bg-slate-50 font-medium transition-all"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Отмена
            </Button>
            <Button
              onClick={() => handleSubmit()}
              disabled={isSaving}
              className="h-10 sm:h-11 rounded-xl px-5 bg-black text-white hover:bg-slate-800 font-medium transition-all shadow-sm"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              <span>
                {isSaving
                  ? "Сохранение..."
                  : editTournamentId
                  ? "Сохранить изменения"
                  : "Создать турнир"}
              </span>
            </Button>
          </div>
        </div>

        {/* Wizard Step Selector Tabs */}
        <div className="flex bg-white p-1.5 sm:p-2 rounded-2xl border border-slate-200 shadow-xs gap-1 sm:gap-2 overflow-x-auto">
          {steps.map((s) => (
            <button
              key={s.step}
              type="button"
              onClick={() => setWizardStep(s.step)}
              className={cn(
                "flex-1 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all shrink-0 cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap",
                wizardStep === s.step
                  ? "bg-slate-900 text-white shadow-xs font-semibold"
                  : wizardStep > s.step
                  ? "text-slate-800 hover:text-slate-900 hover:bg-slate-50 font-medium"
                  : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
              )}
            >
              {wizardStep > s.step && (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              )}
              <span>{s.title}</span>
            </button>
          ))}
        </div>

        {/* Step Body Card */}
        <div className="bg-white border border-slate-200 rounded-2xl sm:rounded-3xl p-6 sm:p-8 shadow-xs space-y-8">
          {/* STEP 1: Main Info */}
          {wizardStep === 1 && (
            <div className="space-y-6">
              <div className="border-b border-slate-100 pb-5">
                <h2 className="text-xl font-bold tracking-tight text-slate-900">
                  Основная информация
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 font-normal mt-1">
                  Задайте название, выберите дисциплину и формат участия игроков.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700 block">
                  Название турнира *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={
                    discipline === "dota2"
                      ? type === "1vs1"
                        ? "Например: Colizeum Dota 2 Solo Mid Cup #1"
                        : "Например: Colizeum Dota 2 Team Cup #1"
                      : discipline === "cs2"
                      ? type === "1vs1"
                        ? "Например: Colizeum CS2 Solo Cup #1"
                        : "Например: Colizeum CS2 5x5 Cup #1"
                      : `Например: Colizeum ${displayDisciplines.find(d => d.id === discipline)?.name || ""} Cup #1`
                  }
                  className="w-full bg-slate-50/50 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all font-normal"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700 block">
                  Дисциплина турнира
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {displayDisciplines.map((discItem) => (
                    <button
                      key={discItem.id}
                      type="button"
                      onClick={() => handleDisciplineChange(discItem.id)}
                      className={cn(
                        "p-4 rounded-xl border text-left transition-all flex flex-col justify-between gap-1.5 cursor-pointer",
                        discipline === discItem.id
                          ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                      )}
                    >
                      <span className="text-sm font-semibold">
                        {discItem.name}
                      </span>
                      <span
                        className={cn(
                          "text-xs font-medium",
                          discipline === discItem.id
                            ? "text-slate-300"
                            : "text-slate-400"
                        )}
                      >
                        {discItem.is_system ? "Системная" : discItem.badge || "Дисциплина"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700 block">
                  Формат участников
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {formatOptions.map((typeItem) => (
                    <button
                      key={typeItem.id}
                      type="button"
                      onClick={() => handleTypeChange(typeItem.id)}
                      className={cn(
                        "py-3 px-4 rounded-xl border text-sm font-medium transition-all text-center cursor-pointer",
                        type === typeItem.id
                          ? "bg-slate-900 text-white border-slate-900 shadow-xs font-semibold"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                      )}
                    >
                      {typeItem.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700 block">
                  Дата и время старта
                </label>
                <input
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  className="w-full sm:max-w-xs bg-slate-50/50 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all font-normal"
                />
              </div>
            </div>
          )}

          {/* STEP 2: Bracket & Match Formats */}
          {wizardStep === 2 && (
            <div className="space-y-8">
              <div className="border-b border-slate-100 pb-5">
                <h2 className="text-xl font-bold tracking-tight text-slate-900">
                  Формат сетки и регламент матчей
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 font-normal mt-1">
                  Настройте тип турнирной сетки и режимы BO1/BO3/BO5 раздельно для
                  ранних стадий, полуфинала и финала.
                </p>
              </div>

              {/* Bracket Type */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700 block">
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
                        "p-4 sm:p-5 rounded-xl border text-left transition-all flex flex-col justify-between gap-1.5 cursor-pointer",
                        bracketType === item.id
                          ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                      )}
                    >
                      <span className="text-sm font-semibold">
                        {item.title}
                      </span>
                      <span
                        className={cn(
                          "text-xs font-normal",
                          bracketType === item.id
                            ? "text-slate-300"
                            : "text-slate-500"
                        )}
                      >
                        {item.desc}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Granular Match Formats */}
              <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-5 sm:p-6 space-y-5">
                <div className="border-b border-slate-200/60 pb-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                    {discipline === "cs2"
                      ? "Формат серий (Количество карт в матче)"
                      : discipline === "dota2"
                      ? "Формат серий (Количество игр в матче)"
                      : "Формат матчей"}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* 1. Regular / Early Rounds */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-700 block">
                      Ранние стадии и группы
                    </label>
                    <span className="text-[11px] text-slate-400 block -mt-1 mb-2">
                      {discipline === "dota2" ? "Матчи сетки до полуфиналов" : "1/16, 1/8, 1/4 финала"}
                    </span>
                    <div className="grid grid-cols-3 gap-1 bg-white p-1 rounded-xl border border-slate-200">
                      {(["bo1", "bo3", "bo5"] as const).map((fmt) => (
                        <button
                          key={fmt}
                          type="button"
                          onClick={() => setMatchFormat(fmt)}
                          className={cn(
                            "py-2 rounded-lg text-xs font-medium transition-all text-center cursor-pointer",
                            matchFormat === fmt
                              ? "bg-slate-900 text-white shadow-xs font-semibold"
                              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                          )}
                        >
                          {fmt.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 2. Semi-Finals */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-700 block">
                      Полуфиналы (1/2 финала)
                    </label>
                    <span className="text-[11px] text-slate-400 block -mt-1 mb-2">
                      {discipline === "dota2" ? "Серии за выход в финал" : "Матчи за выход в финал"}
                    </span>
                    <div className="grid grid-cols-3 gap-1 bg-white p-1 rounded-xl border border-slate-200">
                      {(["bo1", "bo3", "bo5"] as const).map((fmt) => (
                        <button
                          key={fmt}
                          type="button"
                          onClick={() => setSemiFinalFormat(fmt)}
                          className={cn(
                            "py-2 rounded-lg text-xs font-medium transition-all text-center cursor-pointer",
                            semiFinalFormat === fmt
                              ? "bg-slate-900 text-white shadow-xs font-semibold"
                              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                          )}
                        >
                          {fmt.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 3. Grand Finals */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-700 block">
                      Гранд-Финал
                    </label>
                    <span className="text-[11px] text-slate-400 block -mt-1 mb-2">
                      {discipline === "dota2" ? "Финальная серия за чемпионство" : "Матч за чемпионский титул"}
                    </span>
                    <div className="grid grid-cols-3 gap-1 bg-white p-1 rounded-xl border border-slate-200">
                      {(["bo1", "bo3", "bo5"] as const).map((fmt) => (
                        <button
                          key={fmt}
                          type="button"
                          onClick={() => setGrandFinalFormat(fmt)}
                          className={cn(
                            "py-2 rounded-lg text-xs font-medium transition-all text-center cursor-pointer",
                            grandFinalFormat === fmt
                              ? "bg-slate-900 text-white shadow-xs font-semibold"
                              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
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
                <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-5 sm:p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/60 pb-4">
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-800 block">
                        Пул карт для CS2 Veto ({mapPool.length} выбрано)
                      </span>
                      <span className="text-xs text-slate-500 font-normal">
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
                        className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium transition-all cursor-pointer shadow-xs"
                      >
                        5x5 Premier ({CS2_5V5_MAP_POOL.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMapPool(CS2_WINGMAN_MAP_POOL);
                          setMapFilter("wingman");
                        }}
                        className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium transition-all cursor-pointer shadow-xs"
                      >
                        2x2 Напарники ({CS2_WINGMAN_MAP_POOL.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMapPool(CS2_AIM_1V1_MAP_POOL);
                          setMapFilter("1v1");
                        }}
                        className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium transition-all cursor-pointer shadow-xs"
                      >
                        1x1 Aim ({CS2_AIM_1V1_MAP_POOL.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMapPool(CS2_ALL_MAPS.map((m) => m.id));
                          setMapFilter("all");
                        }}
                        className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium transition-all cursor-pointer shadow-xs"
                      >
                        Все ({CS2_ALL_MAPS.length})
                      </button>
                    </div>
                  </div>

                  {/* Filter Tabs */}
                  <div className="flex items-center gap-1 bg-slate-200/60 p-1 rounded-xl w-fit flex-wrap">
                    {[
                      { id: "all", label: `Все (${allCombinedMaps.length})` },
                      { id: "5v5", label: `5x5 Premier (${allCombinedMaps.filter((m) => m.categories.includes("5v5")).length})` },
                      { id: "wingman", label: `2x2 Напарники (${allCombinedMaps.filter((m) => m.categories.includes("wingman")).length})` },
                      { id: "1v1", label: `1x1 Aim (${allCombinedMaps.filter((m) => m.categories.includes("1v1")).length})` },
                      { id: "workshop", label: `Workshop (${customClubMaps.length})` },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setMapFilter(tab.id as any)}
                        className={cn(
                          "px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer",
                          mapFilter === tab.id
                            ? "bg-white text-slate-900 shadow-xs font-semibold"
                            : "text-slate-600 hover:text-slate-900"
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
                            "py-2.5 px-3.5 rounded-xl border text-xs font-medium transition-all flex items-center justify-between cursor-pointer",
                            isChecked
                              ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                              : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"
                          )}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span
                              className={cn(
                                "text-[10px] font-mono px-1.5 py-0.5 rounded",
                                isChecked
                                  ? "bg-white/20 text-white"
                                  : "bg-slate-100 text-slate-600"
                              )}
                            >
                              {mapItem.badge}
                            </span>
                            <span className="truncate">{mapItem.label}</span>
                          </div>
                          <span
                            className={cn(
                              "text-xs font-semibold ml-2 shrink-0",
                              isChecked ? "text-emerald-400" : "text-slate-400"
                            )}
                          >
                            {isChecked ? "✓" : "+"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Dota 2 Lobby Settings */}
              {discipline === "dota2" && (
                <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-5 sm:p-6 space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/60 pb-4">
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-800 block">
                        Настройки лобби Dota 2 (Автоматический бот DashMatch)
                      </span>
                      <span className="text-xs text-slate-500 font-normal">
                        Бот создаст закрытое лобби на серверах Valve, разошлет инвайты игрокам по Steam ID и запустит матч
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Game Mode */}
                    {type === "1vs1" ? (
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-700 block">
                          Игровой режим (Game Mode)
                        </label>
                        <div className="p-4 rounded-xl border border-slate-900 bg-slate-900 text-white flex flex-col justify-between gap-2 shadow-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold">1v1 Solo Mid</span>
                            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-white/20 text-white font-semibold">
                              Зафиксировано форматом 1vs1
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-300 font-normal leading-relaxed">
                            Дуэль 1 на 1 по центру (Solo Mid). Победа присуждается при совершении 2 убийств или уничтожении первой башни соперника.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-700 block">
                          Игровой режим (Game Mode)
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          {[
                            { id: "CM", label: "Captains Mode", desc: "Пики и баны капитанов" },
                            { id: "AP", label: "All Pick", desc: "Свободный выбор" },
                            { id: "TURBO", label: "Turbo", desc: "Ускоренный темп" },
                          ].map((m) => (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => setDotaGameMode(m.id as any)}
                              className={cn(
                                "p-3 rounded-xl border text-left transition-all flex flex-col justify-between gap-1 cursor-pointer",
                                dotaGameMode === m.id
                                  ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                              )}
                            >
                              <span className="text-xs font-semibold">{m.label}</span>
                              <span
                                className={cn(
                                  "text-[11px] font-normal",
                                  dotaGameMode === m.id
                                    ? "text-slate-300"
                                    : "text-slate-500"
                                )}
                              >
                                {m.desc}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Server Region */}
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-slate-700 block">
                        Регион серверов Valve
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: "STOCKHOLM", label: "Стокгольм (Россия / СНГ)", desc: "Минимальный пинг для РФ и СНГ" },
                          { id: "EUROPE", label: "Западная Европа", desc: "Люксембург / Европа" },
                        ].map((r) => (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => setDotaServerRegion(r.id as any)}
                            className={cn(
                              "p-3 rounded-xl border text-left transition-all flex flex-col justify-between gap-1 cursor-pointer",
                              dotaServerRegion === r.id
                                ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                            )}
                          >
                            <span className="text-xs font-semibold">{r.label}</span>
                            <span className={cn("text-[11px] font-normal", dotaServerRegion === r.id ? "text-slate-300" : "text-slate-500")}>{r.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Fees & Prize Pool */}
          {wizardStep === 3 && (
            <div className="space-y-8">
              <div className="border-b border-slate-100 pb-5">
                <h2 className="text-xl font-bold tracking-tight text-slate-900">
                  Взносы и призовой фонд
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 font-normal mt-1">
                  Задайте размер взноса, комиссию клуба и распределение денежных
                  призов, бонусов и девайсов.
                </p>
              </div>

              {/* Limits and Fees Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-700 block">
                    Лимит слотов ({isTeamFormat ? "команд" : "игроков"})
                  </label>
                  <input
                    type="number"
                    min={2}
                    value={maxParticipants}
                    onChange={(e) =>
                      setMaxParticipants(parseInt(e.target.value, 10) || 2)
                    }
                    className="w-full bg-slate-50/50 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all font-normal"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-700 block">
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
                    className="w-full bg-slate-50/50 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all font-normal"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-700 block">
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
                    className="w-full bg-slate-50/50 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all font-normal"
                  />
                </div>
              </div>

              {/* Team Entry Fee Mode */}
              {isTeamFormat && (
                <div className="bg-slate-50/70 border border-slate-200/80 p-5 rounded-2xl space-y-3">
                  <label className="text-xs font-semibold text-slate-700 block">
                    Как рассчитывать взнос для команды?
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setEntryFeeType("player")}
                      className={cn(
                        "py-3 rounded-xl border text-xs font-medium transition-all cursor-pointer",
                        entryFeeType === "player"
                          ? "bg-slate-900 text-white border-slate-900 shadow-xs font-semibold"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                      )}
                    >
                      С каждого игрока ({entryFee} ₽ × {teamSize} ={" "}
                      {entryFee * teamSize} ₽)
                    </button>
                    <button
                      type="button"
                      onClick={() => setEntryFeeType("team")}
                      className={cn(
                        "py-3 rounded-xl border text-xs font-medium transition-all cursor-pointer",
                        entryFeeType === "team"
                          ? "bg-slate-900 text-white border-slate-900 shadow-xs font-semibold"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
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
                  <label className="text-xs font-semibold text-slate-700 block">
                    Режим формирования фонда наличных
                  </label>
                  <select
                    value={prizePoolMode}
                    onChange={(e) => setPrizePoolMode(e.target.value as any)}
                    className="w-full bg-slate-50/50 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all font-normal"
                  >
                    <option value="dynamic">
                      Динамический (от взносов участников)
                    </option>
                    <option value="fixed">Фиксированный гарант клуба</option>
                  </select>
                </div>

                {prizePoolMode === "fixed" ? (
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-700 block">
                      Сумма гаранта наличных (₽)
                    </label>
                    <input
                      type="number"
                      value={fixedPrizeAmount}
                      onChange={(e) =>
                        setFixedPrizeAmount(parseInt(e.target.value, 10) || 0)
                      }
                      className="w-full bg-slate-50/50 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all font-normal"
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-700 block">
                      Бонусы клуба (дополнительный фонд)
                    </label>
                    <input
                      type="number"
                      value={totalBonusPool || ""}
                      onChange={(e) =>
                        setTotalBonusPool(parseInt(e.target.value, 10) || 0)
                      }
                      placeholder="Например: 10000"
                      className="w-full bg-slate-50/50 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all font-normal"
                    />
                  </div>
                )}
              </div>

              {/* Calculations Overview Card */}
              <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-5 sm:p-6 space-y-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block border-b border-slate-200 pb-2">
                  Детализация призового фонда при заполненных слотах (
                  {maxParticipants} слотов)
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
                  <div>
                    <span className="text-xs font-medium text-slate-500 block">
                      Сбор взносов
                    </span>
                    <span className="text-lg sm:text-xl font-bold tracking-tight text-slate-900">
                      {totalFeesCollected} ₽
                    </span>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-slate-500 block">
                      Доля клуба ({clubSharePct}%)
                    </span>
                    <span className="text-lg sm:text-xl font-bold tracking-tight text-rose-600">
                      -{clubCommission} ₽
                    </span>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-slate-500 block">
                      Призовой фонд (Нал)
                    </span>
                    <span className="text-lg sm:text-xl font-bold tracking-tight text-emerald-600">
                      {estimatedPrizePool} ₽
                    </span>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-slate-500 block">
                      Общая ценность фонда
                    </span>
                    <span className="text-lg sm:text-xl font-bold tracking-tight text-slate-900">
                      {estimatedPrizePool + totalBonusPool + totalItemsValue} ₽
                    </span>
                  </div>
                </div>
              </div>

              {/* Item Pool Management */}
              <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-800">
                    Пул призовых предметов и девайсов (Item Pool)
                  </span>
                </div>

                {itemPool.length > 0 && (
                  <div className="space-y-2">
                    {itemPool.map((item) => (
                      <div
                        key={item.id}
                        className="flex justify-between items-center bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs"
                      >
                        <div>
                          <span className="font-semibold text-slate-900 block">
                            {item.name}
                          </span>
                          <span className="text-slate-500 font-normal">
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
                    className="sm:col-span-2 bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                  <div className="flex gap-2">
                    <input
                      type="number"
                      id="new-item-cost"
                      placeholder="Цена ₽"
                      className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                    />
                    <Button
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
                      className="h-9 px-3 bg-black hover:bg-slate-800 text-white rounded-xl text-xs font-medium transition-all shrink-0 cursor-pointer shadow-xs"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Placements Config */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-800">
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
                    className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-medium transition-all cursor-pointer shadow-xs"
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
                        className="bg-slate-50/70 border border-slate-200/80 p-4 sm:p-5 rounded-2xl space-y-3"
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
                            className="bg-white border border-slate-200 rounded-xl px-3.5 py-1.5 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                          />
                          <div className="flex items-center gap-4">
                            <span className="text-xs font-bold text-emerald-600">
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
                            <label className="text-[11px] font-medium text-slate-600 block mb-1">
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
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-semibold focus:outline-none focus:ring-1 focus:ring-slate-900"
                            />
                          </div>

                          <div>
                            <label className="text-[11px] font-medium text-slate-600 block mb-1">
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
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-semibold focus:outline-none focus:ring-1 focus:ring-slate-900"
                            />
                          </div>

                          <div>
                            <label className="text-[11px] font-medium text-slate-600 block mb-1">
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
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-semibold focus:outline-none focus:ring-1 focus:ring-slate-900"
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
                  <Button
                    type="button"
                    variant="outline"
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
                    className="h-10 rounded-xl px-4 border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-medium transition-all"
                  >
                    + Добавить место
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
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
                    className="h-10 rounded-xl px-4 border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-medium transition-all"
                  >
                    + Добавить диапазон
                  </Button>
                </div>
              </div>

              {/* Tournament Nominations & Special Awards (CS2 only) */}
              {discipline === "cs2" && (
                <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-5 sm:p-6 space-y-4">
                  <div className="border-b border-slate-200/60 pb-3">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-900 block">
                      Номинации турнира (MVP и спецнаграды)
                    </span>
                    <p className="text-xs text-slate-500 font-normal mt-0.5">
                      Включите дополнительные номинации по итогам турнира и укажите награды за индивидуальное мастерство на основе игровой статистики CS2.
                    </p>
                  </div>

                  <div className="space-y-3">
                    {nominations.map((nom, nIdx) => (
                      <div
                        key={nom.id}
                        className={cn(
                          "rounded-xl border p-4 transition-all space-y-3",
                          nom.enabled
                            ? "bg-white border-slate-300 shadow-xs"
                            : "bg-slate-100/50 border-slate-200 opacity-60"
                        )}
                      >
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2.5">
                            <span className="text-xl shrink-0">{nom.icon}</span>
                            <div>
                              <span className="text-xs font-semibold text-slate-900 block">
                                {nom.label}
                              </span>
                              <span className="text-[11px] text-slate-500 font-normal">
                                {nom.description}
                              </span>
                            </div>
                          </div>

                          <label className="flex items-center gap-2 cursor-pointer select-none">
                            <span className="text-xs font-medium text-slate-600">
                              {nom.enabled ? "Включена" : "Выключена"}
                            </span>
                            <input
                              type="checkbox"
                              checked={nom.enabled}
                              onChange={(e) => {
                                const updated = [...nominations];
                                updated[nIdx].enabled = e.target.checked;
                                setNominations(updated);
                              }}
                              className="w-4 h-4 text-slate-900 rounded border-slate-300 focus:ring-slate-900 cursor-pointer"
                            />
                          </label>
                        </div>

                        {nom.enabled && (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
                            <div>
                              <label className="text-[11px] font-medium text-slate-600 block mb-1">
                                Денежный приз (₽)
                              </label>
                              <input
                                type="number"
                                min={0}
                                placeholder="0 ₽"
                                value={nom.cashAmount || 0}
                                onChange={(e) => {
                                  const updated = [...nominations];
                                  updated[nIdx].cashAmount = parseInt(e.target.value, 10) || 0;
                                  setNominations(updated);
                                }}
                                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-semibold focus:outline-none focus:ring-1 focus:ring-slate-900"
                              />
                            </div>

                            <div>
                              <label className="text-[11px] font-medium text-slate-600 block mb-1">
                                Бонусы клуба (Б)
                              </label>
                              <input
                                type="number"
                                min={0}
                                placeholder="0 Б"
                                value={nom.bonusAmount || 0}
                                onChange={(e) => {
                                  const updated = [...nominations];
                                  updated[nIdx].bonusAmount = parseInt(e.target.value, 10) || 0;
                                  setNominations(updated);
                                }}
                                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-semibold focus:outline-none focus:ring-1 focus:ring-slate-900"
                              />
                            </div>

                            <div>
                              <label className="text-[11px] font-medium text-slate-600 block mb-1">
                                Материальный приз / подарок
                              </label>
                              <input
                                type="text"
                                placeholder="Например: Мерч или 5 часов VIP"
                                value={nom.item || ""}
                                onChange={(e) => {
                                  const updated = [...nominations];
                                  updated[nIdx].item = e.target.value;
                                  setNominations(updated);
                                }}
                                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-normal focus:outline-none focus:ring-1 focus:ring-slate-900"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 4: Rules & Templates */}
          {wizardStep === 4 && (
            <div className="space-y-6">
              <div className="border-b border-slate-100 pb-5">
                <h2 className="text-xl font-bold tracking-tight text-slate-900">
                  Регламент и правила турнира
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 font-normal mt-1">
                  Напишите регламент турнира или выберите готовый шаблон.
                </p>
              </div>

              {rulesTemplates.length > 0 && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-700 block">
                    Выбрать готовый шаблон правил
                  </label>
                  <select
                    value={selectedTemplateId}
                    onChange={(e) => handleSelectTemplate(e.target.value)}
                    className="w-full bg-slate-50/50 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all font-normal"
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
                <label className="text-xs font-semibold text-slate-700 block">
                  Текст правил и регламента
                </label>
                <textarea
                  value={rules}
                  onChange={(e) => setRules(e.target.value)}
                  rows={8}
                  placeholder={
                    discipline === "dota2"
                      ? "1. Регламент матчей Dota 2 (выбор стороны Radiant/Dire, право первого пика)...\n2. Правила пауз (максимум 10 минут суммарно на команду)...\n3. Порядок действий при дисконнектах и спорных ситуациях...\n4. Запрещенное ПО, читы и неспортивное поведение..."
                      : discipline === "cs2"
                      ? "1. Общие положения матчей CS2 (стадия Veto, ножевой раунд, овертаймы MR3)...\n2. Паузы: тактические и технические...\n3. Запрещенные действия, скрипты и читы...\n4. Порядок решения спорных ситуаций..."
                      : "1. Общие положения регламента...\n2. Правила проведения матчей...\n3. Запрещенные действия...\n4. Порядок решения спорных ситуаций..."
                  }
                  className="w-full bg-slate-50/50 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-xl p-4 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all leading-relaxed font-normal"
                />
              </div>

              {/* Save as Template */}
              <div className="bg-slate-50/70 border border-slate-200/80 p-5 rounded-2xl space-y-3">
                <span className="text-xs font-semibold text-slate-700 block">
                  Сохранить эти правила как шаблон для будущих турниров
                </span>
                <div className="flex gap-3">
                  <input
                    type="text"
                    placeholder={
                      discipline === "dota2"
                        ? "Название шаблона (например: Стандарт Dota 2 5x5 Colizeum)"
                        : discipline === "cs2"
                        ? "Название шаблона (например: Стандарт CS2 5x5 Colizeum)"
                        : `Название шаблона (например: Регламент ${displayDisciplines.find(d => d.id === discipline)?.name || ""})`
                    }
                    value={newTemplateName}
                    onChange={(e) => setNewTemplateName(e.target.value)}
                    className="flex-1 bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 font-normal"
                  />
                  <Button
                    type="button"
                    onClick={handleSaveRulesTemplate}
                    disabled={isSavingTemplate}
                    className="h-9 px-4 bg-black hover:bg-slate-800 text-white rounded-xl text-xs font-medium transition-all flex items-center gap-2 shrink-0 cursor-pointer shadow-xs"
                  >
                    <Save className="w-4 h-4 text-slate-400" />
                    <span>Сохранить шаблон</span>
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Wizard Bottom Navigation Buttons */}
          <div className="flex justify-between items-center pt-6 border-t border-slate-100">
            {wizardStep > 1 ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setWizardStep(wizardStep - 1)}
                className="h-10 sm:h-11 rounded-xl px-5 border-slate-200 text-slate-700 hover:bg-slate-50 font-medium transition-all"
              >
                <ChevronLeft className="w-4 h-4 mr-1.5" />
                <span>Назад</span>
              </Button>
            ) : (
              <div />
            )}

            {wizardStep < 4 ? (
              <Button
                type="button"
                onClick={() => setWizardStep(wizardStep + 1)}
                className="h-10 sm:h-11 rounded-xl px-6 bg-black text-white hover:bg-slate-800 font-medium transition-all shadow-sm"
              >
                <span>Далее</span>
                <ChevronRight className="w-4 h-4 ml-1.5" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={() => handleSubmit()}
                disabled={isSaving}
                className="h-10 sm:h-11 rounded-xl px-7 bg-black text-white hover:bg-slate-800 font-medium transition-all shadow-sm"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                )}
                <span>
                  {isSaving
                    ? "Сохранение..."
                    : editTournamentId
                    ? "Сохранить изменения"
                    : "Создать турнир"}
                </span>
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
