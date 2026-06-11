"use client";
import React from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Trophy,
  Users,
  Plus,
  Coins,
  Settings,
  Tv,
  CheckCircle,
  Play,
  Square,
  RefreshCw,
  Award,
  ChevronRight,
  Loader2,
  FileText,
  UserCheck,
  Calendar,
  Save,
  ChevronLeft,
  Edit,
  Trash2,
  ShieldAlert,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const getCountFromLabel = (label: string): number => {
  if (!label) return 1;
  const rangeMatch = label.match(/(\d+)\s*-\s*(\d+)/);
  if (rangeMatch) {
    const start = parseInt(rangeMatch[1]);
    const end = parseInt(rangeMatch[2]);
    if (end >= start) {
      return (end - start) + 1;
    }
  }
  return 1;
};

const parsePrizeDistribution = (data: any) => {
  if (!data) {
    return {
      totalBonusPool: 0,
      placements: []
    };
  }
  if (Array.isArray(data.placements)) {
    return {
      totalBonusPool: data.totalBonusPool || 0,
      placements: data.placements.map((p: any) => ({
        ...p,
        cashPct: p.cashPct <= 1 ? Math.round(p.cashPct * 100) : p.cashPct,
        itemId: p.itemId || "",
        item: p.item || "",
        itemScope: p.itemScope || "player"
      }))
    };
  }
  const placements: any[] = [];
  const keys = Object.keys(data).filter(k => k !== "_meta");
  keys.sort((a, b) => parseInt(a) - parseInt(b));
  keys.forEach(key => {
    const item = data[key];
    placements.push({
      id: key,
      label: `${key} Место`,
      cashPct: Math.round((item.cashPct || 0) * 100),
      bonus: item.bonus || 0,
      item: item.item || "",
      itemId: item.itemId || "",
      itemScope: item.itemScope || "player"
    });
  });
  return {
    totalBonusPool: data._meta?.totalBonusPool || 0,
    placements
  };
};

const getPrizeSlotsList = (placements: any[]) => {
  const slots: any[] = [];
  placements.forEach((p, idx) => {
    const count = getCountFromLabel(p.label);
    for (let i = 0; i < count; i++) {
      slots.push({
        ...p,
        slotIndex: i,
        totalSlots: count,
        uniqueKey: `${p.label}-${i}`
      });
    }
  });
  return slots;
};

export default function AdminTournaments() {
  const params = useParams();
  const clubId = params.clubId as string;

  const [loading, setLoading] = React.useState(true);
  const [tournaments, setTournaments] = React.useState<any[]>([]);
  const [activeTournament, setActiveTournament] = React.useState<any>(null);
  const [competitors, setCompetitors] = React.useState<any[]>([]);
  const [matches, setMatches] = React.useState<any[]>([]);
  const [payouts, setPayouts] = React.useState<any[]>([]);

  // Modals / forms
  const [showCreateModal, setShowCreateModal] = React.useState(false);
  const [wizardStep, setWizardStep] = React.useState(1);
  const [showMatchModal, setShowMatchModal] = React.useState<any>(null);
  
  // Reusable Rules Templates
  const [rulesTemplates, setRulesTemplates] = React.useState<any[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = React.useState("");
  const [newTemplateName, setNewTemplateName] = React.useState("");
  const [isSavingTemplate, setIsSavingTemplate] = React.useState(false);

  // Rules template editor states (outside wizard)
  const [mainTab, setMainTab] = React.useState<"tournaments" | "rules_templates">("tournaments");
  const [showTemplateForm, setShowTemplateForm] = React.useState(false);
  const [templateFormId, setTemplateFormId] = React.useState<string | null>(null);
  const [templateFormName, setTemplateFormName] = React.useState("");
  const [templateFormDiscipline, setTemplateFormDiscipline] = React.useState("cs2");
  const [templateFormRules, setTemplateFormRules] = React.useState("");
  const [isSubmittingTemplate, setIsSubmittingTemplate] = React.useState(false);

  // Create Form States
  const [name, setName] = React.useState("");
  const [discipline, setDiscipline] = React.useState("cs2");
  const [type, setType] = React.useState("1vs1");

  const getFormatOptions = React.useCallback(() => {
    if (discipline === "cs2") {
      return [
        { id: "1vs1", name: "1vs1 Solo" },
        { id: "2vs2", name: "2vs2 Team" },
        { id: "5vs5", name: "5vs5 Team" },
        { id: "mix_2vs2", name: "Mix 2vs2" },
        { id: "mix_5vs5", name: "Mix 5vs5" },
      ];
    } else if (discipline === "fifa") {
      return [
        { id: "1vs1", name: "1vs1 Solo" },
        { id: "2vs2", name: "2vs2 Team" },
      ];
    } else {
      return [
        { id: "1vs1", name: "1vs1 Solo" },
      ];
    }
  }, [discipline]);

  const formatTypeLabel = (tType: string) => {
    const mapping: Record<string, string> = {
      "solo": "Solo",
      "team": "Team 5x5",
      "mix": "Mix ELO",
      "1vs1": "1vs1 Solo",
      "2vs2": "2vs2 Team",
      "5vs5": "5vs5 Team",
      "mix_2vs2": "Mix 2vs2",
      "mix_5vs5": "Mix 5vs5",
    };
    return mapping[tType] || tType;
  };

  React.useEffect(() => {
    const allowed = getFormatOptions().map(opt => opt.id);
    if (!allowed.includes(type)) {
      setType(allowed[0] || "1vs1");
    }
  }, [discipline, getFormatOptions, type]);
  const [startsAt, setStartsAt] = React.useState("");
  const [entryFee, setEntryFee] = React.useState(500);
  const [clubSharePct, setClubSharePct] = React.useState(20);
  const [maxParticipants, setMaxParticipants] = React.useState(16);
  const [prizePoolMode, setPrizePoolMode] = React.useState("dynamic");
  const [fixedPrizeAmount, setFixedPrizeAmount] = React.useState(10000);
  const [rules, setRules] = React.useState("");
  const [entryFeeType, setEntryFeeType] = React.useState<"player" | "team">("player");
  const [autoDistributeBonuses, setAutoDistributeBonuses] = React.useState(true);

  // Dynamic placements state
  const [placements, setPlacements] = React.useState<any[]>([
    { id: "1", label: "1 Место", cashPct: 60, bonus: 1000, item: "" },
    { id: "2", label: "2 Место", cashPct: 30, bonus: 500, item: "" },
    { id: "3", label: "3 Место", cashPct: 10, bonus: 250, item: "" }
  ]);
  const [totalBonusPool, setTotalBonusPool] = React.useState<number>(0);
  const [itemPool, setItemPool] = React.useState<Array<{id: string, name: string, cost: number}>>([]);
  const [selectedWinners, setSelectedWinners] = React.useState<Record<string, string>>({});
  const [editTournamentId, setEditTournamentId] = React.useState<number | null>(null);
  const [expandedTeams, setExpandedTeams] = React.useState<Record<string, boolean>>({});

  // Score Entry
  const [score1, setScore1] = React.useState(0);
  const [score2, setScore2] = React.useState(0);
  const [isSubmittingScore, setIsSubmittingScore] = React.useState(false);

  // CS2 server state
  const [isSyncingStats, setIsSyncingStats] = React.useState(false);
  const [isManagingServer, setIsManagingServer] = React.useState(false);

  const fetchTournamentsList = async () => {
    try {
      const res = await fetch(`/api/clubs/${clubId}/tournaments`);
      const data = await res.json();
      setTournaments(data.tournaments || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchRulesTemplates = async (disc: string) => {
    try {
      const res = await fetch(`/api/clubs/${clubId}/tournaments?action=rules_templates&discipline=${disc}`);
      const data = await res.json();
      setRulesTemplates(data.templates || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchTournamentDetails = async (id: string | number) => {
    try {
      const res = await fetch(`/api/clubs/${clubId}/tournaments?id=${id}`);
      const data = await res.json();
      setActiveTournament(data.tournament);
      setCompetitors(data.competitors || []);
      setMatches(data.matches || []);
      setPayouts(data.payouts || []);
    } catch (err) {
      console.error(err);
    }
  };

  React.useEffect(() => {
    async function init() {
      setLoading(true);
      await fetchTournamentsList();
      setLoading(false);
    }
    init();
  }, [clubId]);

  React.useEffect(() => {
    if (clubId && discipline) {
      fetchRulesTemplates(discipline);
      setSelectedTemplateId("");
    }
  }, [clubId, discipline]);

  // Handle selected template application
  const handleSelectTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    if (!templateId) return;
    const found = rulesTemplates.find(t => t.id === templateId);
    if (found) {
      setRules(found.rules_text);
    }
  };

  // Save rules as template
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
      const res = await fetch(`/api/clubs/${clubId}/tournaments?action=create_rules_template`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          discipline,
          name: newTemplateName.trim(),
          rulesText: rules.trim(),
        }),
      });
      if (res.ok) {
        alert("Шаблон правил успешно сохранен!");
        setNewTemplateName("");
        await fetchRulesTemplates(discipline);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingTemplate(false);
    }
  };

  // Save or update rules template (from templates tab or inline edit)
  const handleSaveOrUpdateRulesTemplate = async () => {
    if (!templateFormName.trim()) {
      alert("Введите название шаблона правил!");
      return;
    }
    if (!templateFormRules.trim()) {
      alert("Текст правил пуст!");
      return;
    }
    setIsSubmittingTemplate(true);
    try {
      const isEdit = !!templateFormId;
      const endpoint = `/api/clubs/${clubId}/tournaments`;
      const actionType = isEdit ? "update_rules_template" : "create_rules_template";
      
      const payload: any = {
        action: actionType,
        name: templateFormName.trim(),
        rulesText: templateFormRules.trim(),
      };
      
      if (isEdit) {
        payload.templateId = templateFormId;
      } else {
        payload.discipline = templateFormDiscipline;
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        alert(isEdit ? "Шаблон правил успешно обновлен!" : "Шаблон правил успешно создан!");
        setShowTemplateForm(false);
        setTemplateFormId(null);
        setTemplateFormName("");
        setTemplateFormRules("");
        await fetchRulesTemplates(mainTab === "rules_templates" ? "all" : discipline);
      } else {
        const errData = await res.json();
        alert(errData.error || "Ошибка при сохранении шаблона");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingTemplate(false);
    }
  };

  // Delete rules template
  const handleDeleteRulesTemplate = async (templateId: string) => {
    if (!confirm("Вы уверены, что хотите удалить этот шаблон?")) return;
    try {
      const res = await fetch(`/api/clubs/${clubId}/tournaments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete_rules_template",
          templateId,
        }),
      });
      if (res.ok) {
        alert("Шаблон успешно удален!");
        await fetchRulesTemplates(mainTab === "rules_templates" ? "all" : discipline);
      } else {
        alert("Не удалось удалить шаблон");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const cashPctKey = placements.map(p => p.cashPct).join(",");

  React.useEffect(() => {
    if (!autoDistributeBonuses) return;
    
    const totalCashPct = placements.reduce((sum, p) => sum + (p.cashPct || 0) * getCountFromLabel(p.label), 0);
    if (totalCashPct <= 0) return;

    let distributedSum = 0;
    const updated = placements.map((p) => {
      const share = (p.cashPct || 0) / totalCashPct;
      const calculatedBonus = Math.round(totalBonusPool * share);
      
      const count = getCountFromLabel(p.label);
      distributedSum += calculatedBonus * count;
      
      return {
        ...p,
        bonus: calculatedBonus
      };
    });

    const remainder = totalBonusPool - distributedSum;
    if (remainder !== 0 && updated.length > 0) {
      const firstPlaceIdx = updated.findIndex(p => p.label.includes("1"));
      if (firstPlaceIdx !== -1) {
        const count = getCountFromLabel(updated[firstPlaceIdx].label);
        updated[firstPlaceIdx].bonus += Math.round(remainder / count);
      }
    }

    const changed = updated.some((p, idx) => p.bonus !== placements[idx]?.bonus);
    if (changed) {
      setPlacements(updated);
    }
  }, [totalBonusPool, cashPctKey, autoDistributeBonuses, placements]);

  const getPrizeValidation = () => {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    const isTeam = type === "2vs2" || type === "5vs5";
    const tSize = type === "2vs2" || type === "mix_2vs2" ? 2 : (type === "5vs5" || type === "mix_5vs5" ? 5 : 1);
    const feeType = entryFeeType;
    const mult = (isTeam && feeType === "player") ? tSize : 1;
    const feePerComp = entryFee * mult;

    const calculatedPrizes = placements.map(p => {
      const cashPctFraction = p.cashPct > 1 ? p.cashPct / 100 : p.cashPct;
      const slotCash = Math.round(estimatedPrizePool * cashPctFraction);
      const slotBonus = p.bonus || 0;
      
      const matchedItem = itemPool.find(item => item.id === p.itemId);
      let itemMultiplier = 1;
      if (isTeam) {
        itemMultiplier = p.itemScope === "team" ? 1 : tSize;
      }
      const itemCost = matchedItem ? matchedItem.cost * itemMultiplier : 0;
      
      const totalVal = slotCash + slotBonus + itemCost;
      return {
        label: p.label,
        totalVal,
        cash: slotCash,
        bonus: slotBonus,
        cashPct: p.cashPct,
        itemCost
      };
    });

    // 1. Check 1st place covers fee
    const firstPlace = calculatedPrizes.find(p => p.label.includes("1"));
    if (firstPlace) {
      if (firstPlace.totalVal <= feePerComp && feePerComp > 0) {
        errors.push(`Критическая ошибка: Приз за 1 Место (${firstPlace.totalVal} ₽) должен быть больше взноса за участие (${feePerComp} ₽)!`);
      }
    }

    // 2. Check other places cover fee (warning)
    calculatedPrizes.forEach(p => {
      if (!p.label.includes("1") && p.totalVal <= feePerComp && p.totalVal > 0 && feePerComp > 0) {
        warnings.push(`Предупреждение: Приз за ${p.label} (${p.totalVal} ₽) меньше или равен взносу за участие (${feePerComp} ₽).`);
      }
    });

    // 3. Hierarchy Check (index i < j means higher place vs lower place)
    for (let i = 0; i < calculatedPrizes.length; i++) {
      for (let j = i + 1; j < calculatedPrizes.length; j++) {
        if (calculatedPrizes[i].totalVal < calculatedPrizes[j].totalVal) {
          errors.push(`Критическая ошибка: Приз за ${calculatedPrizes[i].label} (${calculatedPrizes[i].totalVal} ₽) меньше, чем за ${calculatedPrizes[j].label} (${calculatedPrizes[j].totalVal} ₽)!`);
          break;
        }
      }
    }

    return { errors, warnings };
  };

  const autoBalancePlacements = (currentPlacements: any[], prizePool: number, fee: number) => {
    if (currentPlacements.length === 0) return currentPlacements;
    if (prizePool <= 0) {
      const updated = [...currentPlacements];
      if (updated.length === 1) {
        updated[0].cashPct = 100;
      } else if (updated.length === 2) {
        updated[0].cashPct = 70;
        updated[1].cashPct = 30;
      } else if (updated.length >= 3) {
        updated[0].cashPct = 60;
        updated[1].cashPct = 30;
        updated[2].cashPct = 10;
        for (let i = 3; i < updated.length; i++) updated[i].cashPct = 0;
      }
      return updated;
    }

    const n = currentPlacements.length;
    const updated = currentPlacements.map(p => ({ ...p, cashPct: 0 }));

    if (n === 1) {
      updated[0].cashPct = 100;
    } else if (n === 2) {
      if (prizePool * 0.4 >= fee) {
        updated[0].cashPct = 60;
        updated[1].cashPct = 40;
      } else {
        const firstShare = Math.min(1, Math.max(0.7, fee / prizePool));
        updated[0].cashPct = Math.round(firstShare * 100);
        updated[1].cashPct = 100 - updated[0].cashPct;
      }
    } else {
      if (prizePool * 0.15 >= fee) {
        updated[0].cashPct = 55;
        updated[1].cashPct = 30;
        updated[2].cashPct = 15;
      } else if (prizePool * 0.3 >= fee) {
        updated[0].cashPct = 70;
        updated[1].cashPct = 30;
        updated[2].cashPct = 0;
      } else {
        updated[0].cashPct = 100;
        updated[1].cashPct = 0;
        updated[2].cashPct = 0;
      }
      
      for (let i = 3; i < updated.length; i++) {
        updated[i].cashPct = 0;
      }
    }

    const sum = updated.reduce((s, p) => s + p.cashPct, 0);
    if (sum !== 100 && updated.length > 0) {
      updated[0].cashPct += (100 - sum);
    }

    return updated;
  };

  // Actions
  const handleCreateTournament = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const { errors } = getPrizeValidation();
    if (errors.length > 0) {
      alert("Невозможно сохранить турнир из-за критических ошибок призового фонда:\n\n" + errors.join("\n"));
      return;
    }

    const prizeDistribution = {
      totalBonusPool,
      placements: placements.map(p => ({
        ...p,
        cashPct: p.cashPct / 100
      }))
    };

    try {
      const res = await fetch(`/api/clubs/${clubId}/tournaments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: editTournamentId ? "edit" : "create",
          id: editTournamentId,
          name,
          discipline,
          type,
          entryFee,
          clubSharePct,
          prizeType: "combined", // Set to combined format
          prizePoolMode,
          fixedPrizeAmount,
          prizeDistribution,
          rules,
          startsAt: startsAt || null,
          settings: {
            maxParticipants: maxParticipants > 0 ? maxParticipants : null,
            entryFeeType,
            mapPool: ["de_mirage", "de_dust2", "de_inferno", "de_nuke", "de_anubis", "de_ancient", "de_vertigo"],
            itemPool
          }
        }),
      });
      if (res.ok) {
        setShowCreateModal(false);
        setWizardStep(1);
        setName("");
        setRules("");
        setMaxParticipants(16);
        setStartsAt("");
        setTotalBonusPool(0);
        setEntryFeeType("player");
        setItemPool([]);
        setAutoDistributeBonuses(true);
        setPlacements([
          { id: "1", label: "1 Место", cashPct: 60, bonus: 1000, item: "" },
          { id: "2", label: "2 Место", cashPct: 30, bonus: 500, item: "" },
          { id: "3", label: "3 Место", cashPct: 10, bonus: 250, item: "" }
        ]);
        setEditTournamentId(null);
        if (editTournamentId) {
          await fetchTournamentDetails(editTournamentId);
        }
        await fetchTournamentsList();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleEditTournamentOpen = () => {
    if (!activeTournament) return;
    
    setEditTournamentId(activeTournament.id);
    setName(activeTournament.name);
    setDiscipline(activeTournament.discipline);
    setType(activeTournament.type);
    setEntryFee(parseFloat(activeTournament.entry_fee || 0));
    setClubSharePct(activeTournament.club_share_pct || 0);
    setRules(activeTournament.rules || "");
    setMaxParticipants(activeTournament.config?.maxParticipants || 16);
    
    if (activeTournament.starts_at) {
      const dt = new Date(activeTournament.starts_at);
      const pad = (n: number) => String(n).padStart(2, '0');
      const formatted = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
      setStartsAt(formatted);
    } else {
      setStartsAt("");
    }
    
    const { totalBonusPool: activeBonusPool, placements: activePlacements } = parsePrizeDistribution(activeTournament.prize_distribution);
    setPrizePoolMode(activeTournament.prize_pool_mode || "dynamic");
    setFixedPrizeAmount(parseFloat(activeTournament.fixed_prize_amount || 0));
    setTotalBonusPool(activeBonusPool);
    setEntryFeeType(activeTournament.config?.entryFeeType || "player");
    setItemPool(activeTournament.config?.itemPool || []);
    setPlacements(activePlacements.length > 0 ? activePlacements : [
      { id: "1", label: "1 Место", cashPct: 60, bonus: 1000, item: "" },
      { id: "2", label: "2 Место", cashPct: 30, bonus: 500, item: "" },
      { id: "3", label: "3 Место", cashPct: 10, bonus: 250, item: "" }
    ]);
    
    setWizardStep(1);
    setShowCreateModal(true);
  };

  const handleDeleteTournament = async () => {
    if (!activeTournament) return;
    if (!confirm(`Вы действительно хотите удалить турнир "${activeTournament.name}"? Это действие необратимо и удалит все связанные матчи, регистрации и выплаты.`)) return;

    try {
      const res = await fetch(`/api/clubs/${clubId}/tournaments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete",
          id: activeTournament.id
        })
      });
      
      if (res.ok) {
        setActiveTournament(null);
        await fetchTournamentsList();
      } else {
        const data = await res.json();
        alert(data.error || "Не удалось удалить турнир");
      }
    } catch (err) {
      console.error(err);
      alert("Ошибка сети при удалении");
    }
  };

  const handleConfirmPayment = async (competitorId: string) => {
    try {
      const res = await fetch(`/api/clubs/${clubId}/tournaments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "confirm_payment",
          id: activeTournament.id,
          competitorId,
        }),
      });
      if (res.ok) {
        await fetchTournamentDetails(activeTournament.id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteCompetitor = async (competitorId: string) => {
    if (!confirm("Вы уверены, что хотите удалить этого участника? Регистрация будет аннулирована.")) return;
    try {
      const res = await fetch(`/api/clubs/${clubId}/tournaments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete_competitor",
          id: activeTournament.id,
          competitorId,
        }),
      });
      if (res.ok) {
        await fetchTournamentDetails(activeTournament.id);
      } else {
        const data = await res.json();
        alert(data.error || "Ошибка при удалении участника");
      }
    } catch (err) {
      console.error(err);
      alert("Ошибка сети");
    }
  };

  const handlePromoteCompetitor = async (competitorId: string) => {
    try {
      const res = await fetch(`/api/clubs/${clubId}/tournaments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "promote_competitor",
          id: activeTournament.id,
          competitorId,
        }),
      });
      if (res.ok) {
        await fetchTournamentDetails(activeTournament.id);
      } else {
        const data = await res.json();
        alert(data.error || "Ошибка при переводе в основу");
      }
    } catch (err) {
      console.error(err);
      alert("Ошибка сети");
    }
  };

  const handleStartTournament = async () => {
    if (!confirm("Вы уверены, что хотите запустить турнир? Сетки будут сформированы автоматически!")) return;
    try {
      const res = await fetch(`/api/clubs/${clubId}/tournaments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start",
          id: activeTournament.id,
        }),
      });
      if (res.ok) {
        await fetchTournamentDetails(activeTournament.id);
      } else {
        const data = await res.json();
        alert(data.error || "Ошибка старта турнира");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleFinishMatch = async () => {
    if (score1 === score2) {
      alert("Ничья невозможна в соревновательном формате!");
      return;
    }
    setIsSubmittingScore(true);
    try {
      const res = await fetch(`/api/clubs/${clubId}/tournaments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "finish_match",
          matchId: showMatchModal.id,
          score1,
          score2,
        }),
      });
      if (res.ok) {
        setShowMatchModal(null);
        await fetchTournamentDetails(activeTournament.id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingScore(false);
    }
  };

  const handleSyncCS2Stats = async (matchId: string) => {
    setIsSyncingStats(true);
    try {
      const res = await fetch(`/api/clubs/${clubId}/tournaments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "sync_match_stats",
          matchId,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        alert("Статистика матча успешно синхронизирована! ELO игроков пересчитаны.");
        setShowMatchModal(null);
        await fetchTournamentDetails(activeTournament.id);
      } else {
        alert(data.error || "Не удалось получить логи завершения матча");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSyncingStats(false);
    }
  };

  // Combined Payout confirmation
  const handleConfirmPayout = async (competitorId: string, cashAmount: number, bonusAmount: number, itemDetails: string, slotUniqueName: string) => {
    const combinedItemDetails = itemDetails 
      ? `${itemDetails} (${slotUniqueName})` 
      : `(${slotUniqueName})`;
      
    if (!confirm(`Выплатить призовые: Наличные: ${cashAmount} ₽, Бонусы: ${bonusAmount} Б, Предметы: ${combinedItemDetails}?`)) return;
    try {
      const res = await fetch(`/api/clubs/${clubId}/tournaments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "payout",
          tournamentId: activeTournament.id,
          competitorId,
          amount: cashAmount,       // Saved as primary ledger amount
          prizeType: "combined",    // Combined payout
          bonusAmount: bonusAmount, // Split & credited to player balances
          itemDetails: combinedItemDetails, // Text details of items
        }),
      });
      if (res.ok) {
        await fetchTournamentDetails(activeTournament.id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  // Helper variables for step 3 calculations
  const teamSize = type === "2vs2" || type === "mix_2vs2" ? 2 : (type === "5vs5" || type === "mix_5vs5" ? 5 : 1);
  const isTeamFormat = type === "2vs2" || type === "5vs5";
  const feeMultiplier = (isTeamFormat && entryFeeType === "player") ? teamSize : 1;

  const totalFeesCollected = maxParticipants * entryFee * feeMultiplier;
  const clubCommission = Math.round(totalFeesCollected * (clubSharePct / 100));
  const estimatedPrizePool = prizePoolMode === "fixed" ? fixedPrizeAmount : totalFeesCollected - clubCommission;

  const totalItemsValue = placements.reduce((sum, p) => {
    const matched = itemPool.find(item => item.id === p.itemId);
    if (matched) {
      const count = getCountFromLabel(p.label);
      const isTeam = type === "2vs2" || type === "5vs5";
      const tSize = type === "2vs2" || type === "mix_2vs2" ? 2 : (type === "5vs5" || type === "mix_5vs5" ? 5 : 1);
      const itemMultiplier = isTeam && p.itemScope === "team" ? 1 : (isTeam ? tSize : 1);
      return sum + (matched.cost * count * itemMultiplier);
    }
    return sum;
  }, 0);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-8">
      {/* HEADER */}
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-orange-100 rounded-2xl">
            <Trophy className="w-8 h-8 text-orange-500" />
          </div>
          <div>
            <h1 className="text-2xl font-black uppercase italic tracking-tight text-slate-900">
              Управление <span className="text-orange-500">Турнирами</span>
            </h1>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-0.5">
              Панель администратора клуба
            </p>
          </div>
        </div>
        {!activeTournament ? (
          <button
            onClick={() => {
              setEditTournamentId(null);
              setWizardStep(1);
              setName("");
              setRules("");
              setMaxParticipants(16);
              setStartsAt("");
              setTotalBonusPool(0);
              setEntryFee(500);
              setClubSharePct(20);
              setEntryFeeType("player");
              setAutoDistributeBonuses(true);
              setPrizePoolMode("dynamic");
              setFixedPrizeAmount(10000);
              setItemPool([]);
              setPlacements([
                { id: "1", label: "1 Место", cashPct: 60, bonus: 1000, item: "" },
                { id: "2", label: "2 Место", cashPct: 30, bonus: 500, item: "" },
                { id: "3", label: "3 Место", cashPct: 10, bonus: 250, item: "" }
              ]);
              setShowCreateModal(true);
            }}
            className="bg-orange-500 hover:bg-orange-600 text-white font-black text-xs uppercase tracking-widest px-6 py-4 rounded-2xl transition-colors shadow-lg shadow-orange-500/10 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Создать Турнир
          </button>
        ) : (
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setActiveTournament(null)}
              className="text-xs text-slate-600 hover:text-slate-950 font-black uppercase tracking-widest bg-white border border-slate-200 px-6 py-4 rounded-2xl transition-colors shadow-sm"
            >
              Назад к списку
            </button>
            <button
              onClick={handleEditTournamentOpen}
              className="text-xs text-blue-600 hover:text-blue-950 font-black uppercase tracking-widest bg-white border border-blue-200 px-6 py-4 rounded-2xl transition-colors shadow-sm flex items-center gap-1.5"
            >
              <Edit className="w-4 h-4" /> Редактировать
            </button>
            <button
              onClick={handleDeleteTournament}
              className="text-xs text-rose-600 hover:text-rose-950 font-black uppercase tracking-widest bg-white border border-rose-200 px-6 py-4 rounded-2xl transition-colors shadow-sm flex items-center gap-1.5"
            >
              <Trash2 className="w-4 h-4" /> Удалить
            </button>
          </div>
        )}
      </div>

      {/* MAIN TABS */}
      {!activeTournament && (
        <div className="flex gap-6 border-b border-slate-200 mb-8">
          <button
            onClick={() => setMainTab("tournaments")}
            className={cn(
              "text-xs font-black uppercase tracking-widest pb-4 px-1 transition-all border-b-2 -mb-px",
              mainTab === "tournaments"
                ? "border-orange-500 text-orange-500"
                : "border-transparent text-slate-400 hover:text-slate-600"
            )}
          >
            Список турниров
          </button>
          <button
            onClick={() => {
              setMainTab("rules_templates");
              fetchRulesTemplates("all");
            }}
            className={cn(
              "text-xs font-black uppercase tracking-widest pb-4 px-1 transition-all border-b-2 -mb-px",
              mainTab === "rules_templates"
                ? "border-orange-500 text-orange-500"
                : "border-transparent text-slate-400 hover:text-slate-600"
            )}
          >
            Шаблоны регламента
          </button>
        </div>
      )}

      {/* TOURNAMENTS LIST VIEW */}
      {!activeTournament && mainTab === "tournaments" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tournaments.map((t) => (
            <div
              key={t.id}
              onClick={() => fetchTournamentDetails(t.id)}
              className="bg-white border border-slate-200/80 hover:border-orange-500/30 rounded-[2rem] p-6 cursor-pointer hover:bg-slate-50 transition-all shadow-sm group"
            >
              <div className="flex justify-between items-start gap-4 mb-4">
                <span className="text-xs font-black text-orange-500 uppercase tracking-widest italic">
                  {t.discipline.toUpperCase()}
                </span>
                <span
                  className={cn(
                    "text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full border",
                    t.status === "ACTIVE"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : t.status === "REGISTRATION"
                      ? "bg-blue-50 text-blue-700 border-blue-200"
                      : "bg-slate-100 text-slate-600 border-slate-200"
                  )}
                >
                  {t.status === "ACTIVE" ? "Идет игра" : t.status === "REGISTRATION" ? "Регистрация" : t.status}
                </span>
              </div>

              <h3 className="text-lg font-black uppercase italic tracking-tight mb-2 truncate text-slate-900">
                {t.name}
              </h3>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-6">
                Формат: {formatTypeLabel(t.type)} • Взнос: {t.entry_fee > 0 ? `${t.entry_fee} ₽` : "0 ₽"}
                {t.starts_at && ` • Старт: ${new Date(t.starts_at).toLocaleDateString('ru-RU')} ${new Date(t.starts_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`}
              </p>

              <div className="pt-4 border-t border-slate-100 flex justify-between items-center text-xs font-bold text-slate-500">
                <span>Детали турнира</span>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-orange-500 transition-colors" />
              </div>
            </div>
          ))}
          {tournaments.length === 0 && (
            <div className="col-span-full text-center py-20 text-slate-400 bg-white border border-slate-200/60 rounded-[2rem] text-sm">
              Турниров не найдено. Создайте свой первый турнир!
            </div>
          )}
        </div>
      )}

      {/* RULES TEMPLATES TAB VIEW */}
      {!activeTournament && mainTab === "rules_templates" && (
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-white border border-slate-200/80 p-4 rounded-2xl shadow-sm">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
              Всего шаблонов регламента: {rulesTemplates.length}
            </span>
            <button
              onClick={() => {
                setTemplateFormId(null);
                setTemplateFormName("");
                setTemplateFormDiscipline("cs2");
                setTemplateFormRules("");
                setShowTemplateForm(true);
              }}
              className="bg-slate-900 hover:bg-slate-800 text-white font-black text-[10px] uppercase tracking-widest px-4 py-2.5 rounded-xl transition-all flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Создать шаблон
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rulesTemplates.map((temp) => (
              <div
                key={temp.id}
                className="bg-white border border-slate-200/80 rounded-[2rem] p-6 shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-[10px] font-black bg-slate-100 text-slate-600 uppercase tracking-widest px-2.5 py-1 rounded">
                      {temp.discipline.toUpperCase()}
                    </span>
                  </div>
                  <h3 className="text-md font-black uppercase text-slate-800 tracking-tight mb-2">
                    {temp.name}
                  </h3>
                  <p className="text-xs text-slate-500 line-clamp-4 leading-relaxed mb-6 whitespace-pre-wrap">
                    {temp.rules_text}
                  </p>
                </div>
                <div className="pt-4 border-t border-slate-100 flex gap-2 justify-end">
                  <button
                    onClick={() => {
                      setTemplateFormId(temp.id);
                      setTemplateFormName(temp.name);
                      setTemplateFormDiscipline(temp.discipline);
                      setTemplateFormRules(temp.rules_text);
                      setShowTemplateForm(true);
                    }}
                    className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-all border border-slate-100"
                    title="Редактировать"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteRulesTemplate(temp.id)}
                    className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-all border border-slate-100"
                    title="Удалить"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}

            {rulesTemplates.length === 0 && (
              <div className="col-span-full text-center py-20 text-slate-400 bg-white border border-slate-200/60 rounded-[2rem] text-sm">
                Шаблонов не найдено. Создайте свой первый шаблон!
              </div>
            )}
          </div>
        </div>
      )}

      {/* CREATE/EDIT TEMPLATE MODAL */}
      {showTemplateForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/70">
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-2xl space-y-6 text-slate-900">
              <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                <h3 className="text-lg font-black uppercase italic tracking-tight text-slate-900">
                  {templateFormId ? "Редактировать" : "Создать"} <span className="text-orange-500">Шаблон</span>
                </h3>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-500">Название шаблона</label>
                  <input
                    type="text"
                    required
                    value={templateFormName}
                    onChange={(e) => setTemplateFormName(e.target.value)}
                    placeholder="Например: Стандарт CS2 5x5"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs text-slate-900 focus:outline-none"
                  />
                </div>

                {!templateFormId && (
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-500">Дисциплина</label>
                    <select
                      value={templateFormDiscipline}
                      onChange={(e) => setTemplateFormDiscipline(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs text-slate-900 focus:outline-none"
                    >
                      <option value="cs2">CS2</option>
                      <option value="fifa">FIFA</option>
                      <option value="ufc">UFC</option>
                    </select>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-500">Текст правил регламента</label>
                  <textarea
                    value={templateFormRules}
                    onChange={(e) => setTemplateFormRules(e.target.value)}
                    rows={8}
                    placeholder="Введите правила..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs text-slate-900 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowTemplateForm(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-black text-xs uppercase tracking-widest px-5 py-3.5 rounded-2xl transition-colors"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={handleSaveOrUpdateRulesTemplate}
                  disabled={isSubmittingTemplate}
                  className="bg-orange-500 hover:bg-orange-600 text-white font-black text-xs uppercase tracking-widest px-6 py-4 rounded-2xl transition-colors shadow-lg shadow-orange-500/20"
                >
                  {isSubmittingTemplate ? <Loader2 className="w-4 h-4 animate-spin" /> : "Сохранить"}
                </button>
              </div>
          </div>
        </div>
      )}

      {/* DETAIL VIEW */}
      {activeTournament && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Tournament Panel */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 space-y-6 shadow-sm">
              <div className="flex justify-between items-start flex-wrap gap-4">
                <div>
                  <h2 className="text-2xl font-black uppercase italic tracking-tight text-slate-900">
                    {activeTournament.name}
                  </h2>
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">
                    Статус: <span className="text-orange-500">{activeTournament.status}</span> • Тип: {activeTournament.type} • Слоты: {competitors.filter(c => c.payment_status !== 'RESERVE').length} / {activeTournament.config?.maxParticipants || "∞"}
                    {competitors.some(c => c.payment_status === 'RESERVE') && ` • Резерв: ${competitors.filter(c => c.payment_status === 'RESERVE').length}`}
                    {activeTournament.starts_at && ` • Старт: ${new Date(activeTournament.starts_at).toLocaleString('ru-RU')}`}
                  </p>
                </div>
                {activeTournament.status === "REGISTRATION" && (
                  <button
                    onClick={handleStartTournament}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-widest px-6 py-4 rounded-2xl transition-colors shadow-lg shadow-emerald-600/10"
                  >
                    Запустить Турнир
                  </button>
                )}
              </div>

              {/* Tournament Grid matches */}
              {activeTournament.status === "ACTIVE" && (
                <div className="space-y-8 pt-4 border-t border-slate-100">
                  <h3 className="text-md font-black uppercase italic tracking-tight text-slate-800">
                    Сетка матчей (Кликните для управления)
                  </h3>
                  
                  {/* 1. Group Stage */}
                  {(() => {
                    const groupStageMatches = matches.filter(m => m.round === 0);
                    const groupsMap: Record<string, any[]> = {};
                    groupStageMatches.forEach(m => {
                      const groupLabel = m.result?.group || "A";
                      if (!groupsMap[groupLabel]) groupsMap[groupLabel] = [];
                      groupsMap[groupLabel].push(m);
                    });

                    if (Object.keys(groupsMap).length === 0) return null;

                    return (
                      <div className="space-y-4">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">
                          Групповой этап
                        </span>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {Object.keys(groupsMap).sort().map((groupLabel) => {
                            const groupMatches = groupsMap[groupLabel];
                            return (
                              <div key={groupLabel} className="bg-slate-50 border border-slate-200/60 p-5 rounded-[2rem] space-y-4">
                                <div className="font-black uppercase text-xs text-orange-500 tracking-wider">
                                  Группа {groupLabel}
                                </div>
                                <div className="space-y-3">
                                  {groupMatches.map((m) => {
                                    const compA = competitors.find(c => c.id === m.competitor_a_id);
                                    const compB = competitors.find(c => c.id === m.competitor_b_id);

                                    return (
                                      <div
                                        key={m.id}
                                        onClick={() => {
                                          setScore1(m.score1 || 0);
                                          setScore2(m.score2 || 0);
                                          setShowMatchModal(m);
                                        }}
                                        className="flex justify-between items-center gap-3 bg-white border border-slate-200/60 p-3 rounded-2xl text-xs cursor-pointer hover:bg-slate-50 transition-colors"
                                      >
                                        <div className="flex-grow grid grid-cols-2 gap-2 font-bold text-slate-700">
                                          <div className="flex justify-between items-center bg-slate-50/50 p-2 rounded-xl border border-slate-200/40">
                                            <span className="truncate pr-1">{compA?.display_name || "Ожидает..."}</span>
                                            <span className="font-black text-orange-500">{m.score1}</span>
                                          </div>
                                          <div className="flex justify-between items-center bg-slate-50/50 p-2 rounded-xl border border-slate-200/40">
                                            <span className="truncate pr-1">{compB?.display_name || "Ожидает..."}</span>
                                            <span className="font-black text-orange-500">{m.score2}</span>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {/* 2. Playoff Bracket (Horizontal scrollable columns) */}
                  {(() => {
                    const playoffMatches = matches.filter(m => m.round >= 1);
                    const roundsMap: Record<number, any[]> = {};
                    playoffMatches.forEach(m => {
                      if (!roundsMap[m.round]) roundsMap[m.round] = [];
                      roundsMap[m.round].push(m);
                    });
                    const sortedRounds = Object.keys(roundsMap).map(Number).sort((a, b) => a - b);

                    if (sortedRounds.length === 0) return null;

                    return (
                      <div className="space-y-4">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">
                          Сетка плей-офф
                        </span>
                        <div className="overflow-x-auto py-4 flex gap-6 select-none custom-scrollbar">
                          {sortedRounds.map((roundNum) => {
                            const roundMatches = roundsMap[roundNum];
                            const maxR = Math.max(...sortedRounds);
                            let roundTitle = `Раунд ${roundNum}`;
                            if (roundNum === maxR) roundTitle = "Финал";
                            else if (roundNum === maxR - 1) roundTitle = "Полуфинал";
                            else if (roundNum === maxR - 2) roundTitle = "1/4 финала";
                            else if (roundNum === maxR - 3) roundTitle = "1/8 финала";

                            return (
                              <div key={roundNum} className="flex flex-col gap-4 min-w-[260px] w-[280px] shrink-0">
                                <div className="text-center font-black uppercase text-[10px] tracking-wider text-slate-500 bg-slate-100 border border-slate-200 py-2 rounded-xl">
                                  {roundTitle}
                                </div>
                                <div className="flex flex-col justify-around flex-grow gap-4">
                                  {roundMatches.map((m) => {
                                    const compA = competitors.find(c => c.id === m.competitor_a_id);
                                    const compB = competitors.find(c => c.id === m.competitor_b_id);

                                    return (
                                      <div
                                        key={m.id}
                                        onClick={() => {
                                          setScore1(m.score1 || 0);
                                          setScore2(m.score2 || 0);
                                          setShowMatchModal(m);
                                        }}
                                        className={cn(
                                          "bg-white border p-4 rounded-[2rem] space-y-3 shadow-xs relative transition-all cursor-pointer hover:border-orange-500/30",
                                          m.status === "FINISHED" 
                                            ? "border-slate-200 opacity-80" 
                                            : (m.status === "LIVE" ? "border-red-400/50 shadow-md shadow-red-500/5 animate-pulse" : "border-slate-200")
                                        )}
                                      >
                                        <div className="flex justify-between items-center text-[8px] font-black uppercase tracking-wider text-slate-400">
                                          <span>Матч #{m.id}</span>
                                          <span className={cn(
                                            m.status === "FINISHED" ? "text-slate-400" : (m.status === "live" ? "text-red-500" : "text-blue-500")
                                          )}>
                                            {m.status === "scheduled" ? "ожидание" : (m.status === "live" ? "в игре" : m.status.toLowerCase())}
                                          </span>
                                        </div>

                                        <div className="space-y-1.5">
                                          <div className={cn(
                                            "flex justify-between items-center p-2 rounded-xl text-xs font-bold transition-colors",
                                            m.winner_competitor_id === m.competitor_a_id ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-50 text-slate-700 border border-slate-100"
                                          )}>
                                            <span className="truncate flex-1 pr-2">
                                              {compA?.display_name || "Ожидает пару..."}
                                            </span>
                                            <span className="font-black text-sm">{m.score1}</span>
                                          </div>

                                          <div className={cn(
                                            "flex justify-between items-center p-2 rounded-xl text-xs font-bold transition-colors",
                                            m.winner_competitor_id === m.competitor_b_id ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-50 text-slate-700 border border-slate-100"
                                          )}>
                                            <span className="truncate flex-1 pr-2">
                                              {compB?.display_name || "Ожидает пару..."}
                                            </span>
                                            <span className="font-black text-sm">{m.score2}</span>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar: Registration payments and stats */}
          <div className="space-y-6">
            {/* Competitor Payment Ledger */}
            <div className="bg-white border border-slate-200 rounded-[2rem] p-6 space-y-6 shadow-sm">
              <h3 className="text-md font-black uppercase italic tracking-tight text-slate-900">
                Регистрации и Взносы
              </h3>
              <div className="space-y-6 max-h-[36rem] overflow-y-auto pr-2 custom-scrollbar">
                
                {/* 1. Основной состав */}
                <div className="space-y-3">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">
                    Основной состав ({competitors.filter(c => c.payment_status !== "RESERVE").length} / {activeTournament.config?.maxParticipants || "∞"})
                  </span>
                  {competitors.filter(c => c.payment_status !== "RESERVE").length === 0 ? (
                    <p className="text-slate-400 text-xs text-center py-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">Основной состав пуст</p>
                  ) : (
                    competitors.filter(c => c.payment_status !== "RESERVE").map((c) => {
                      const isTeam = c.type === "TEAM";
                      const hasMembers = isTeam && c.team_members && Array.isArray(c.team_members);
                      const isExpanded = !!expandedTeams[c.id];

                      return (
                        <div
                          key={c.id}
                          className="bg-slate-50 rounded-2xl border border-slate-200/60 overflow-hidden"
                        >
                          <div
                            onClick={() => {
                              if (hasMembers) {
                                setExpandedTeams(prev => ({ ...prev, [c.id]: !prev[c.id] }));
                              }
                            }}
                            className={cn(
                              "flex justify-between items-center p-3.5",
                              hasMembers && "cursor-pointer hover:bg-slate-100/60 transition-colors"
                            )}
                          >
                            <div className="flex-1 min-w-0 pr-2">
                              <div className="flex items-center gap-1.5">
                                {isTeam && (
                                  c.team_logo ? (
                                    <img src={c.team_logo} alt={c.display_name} className="w-4.5 h-4.5 rounded-full object-cover shrink-0 border border-slate-200" />
                                  ) : (
                                    <Users className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                                  )
                                )}
                                <span className="text-xs font-bold block truncate text-slate-800">
                                  {c.display_name}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className={cn(
                                  "text-[7px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border",
                                  isTeam ? "bg-orange-50 text-orange-600 border-orange-200" : "bg-slate-100 text-slate-500 border-slate-200"
                                )}>
                                  {isTeam ? "Команда" : "Свободный Агент"}
                                </span>
                                {hasMembers && (
                                  <span className="text-[8px] text-slate-400 font-bold uppercase">
                                    {isExpanded ? "Свернуть" : `Состав (${c.team_members.length})`}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {c.payment_status === "PENDING_PAYMENT" ? (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleConfirmPayment(c.id);
                                  }}
                                  className="bg-orange-500 hover:bg-orange-600 text-white font-black text-[9px] uppercase tracking-widest px-3 py-1.5 rounded-lg transition-colors shadow-sm"
                                >
                                  Оплатить
                                </button>
                              ) : (
                                <span className="text-[8px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-700 border border-emerald-200/60 px-2 py-1 rounded">
                                  Оплачено
                                </span>
                              )}
                              {(activeTournament.status === "REGISTRATION" || activeTournament.status === "DRAFT") && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteCompetitor(c.id);
                                  }}
                                  className="text-slate-400 hover:text-red-600 p-1 rounded-md hover:bg-slate-200/50 transition-colors"
                                  title="Удалить участника"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          {isExpanded && hasMembers && (
                            <div className="border-t border-slate-200/60 bg-white/50 p-3.5 space-y-2.5">
                              {c.team_members.map((m: any) => (
                                <div
                                  key={m.id}
                                  className="flex justify-between items-center text-[11px] bg-white border border-slate-200/60 p-2.5 rounded-xl shadow-xs"
                                >
                                  <div>
                                    <span className="font-bold text-slate-800 block">{m.fullName}</span>
                                    <span className="text-[9px] text-slate-400 font-medium">{m.phoneNumber}</span>
                                  </div>
                                  <span className="font-black italic text-orange-500 shrink-0">
                                    {m.elo} ELO
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* 2. Очередь ожидания (Резерв) */}
                <div className="space-y-3 pt-3 border-t border-slate-200/60">
                  <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 block">
                    Очередь ожидания (Резерв) ({competitors.filter(c => c.payment_status === "RESERVE").length})
                  </span>
                  {competitors.filter(c => c.payment_status === "RESERVE").length === 0 ? (
                    <p className="text-slate-400 text-xs text-center py-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">В резерве никого нет</p>
                  ) : (
                    competitors.filter(c => c.payment_status === "RESERVE").map((c, index) => {
                      const isTeam = c.type === "TEAM";
                      const hasMembers = isTeam && c.team_members && Array.isArray(c.team_members);
                      const isExpanded = !!expandedTeams[c.id];

                      return (
                        <div
                          key={c.id}
                          className="bg-amber-50/20 rounded-2xl border border-amber-200/40 overflow-hidden"
                        >
                          <div
                            onClick={() => {
                              if (hasMembers) {
                                setExpandedTeams(prev => ({ ...prev, [c.id]: !prev[c.id] }));
                              }
                            }}
                            className={cn(
                              "flex justify-between items-center p-3.5",
                              hasMembers && "cursor-pointer hover:bg-amber-100/20 transition-colors"
                            )}
                          >
                            <div className="flex-1 min-w-0 pr-2">
                              <div className="flex items-center gap-1.5">
                                {isTeam && (
                                  c.team_logo ? (
                                    <img src={c.team_logo} alt={c.display_name} className="w-4.5 h-4.5 rounded-full object-cover shrink-0 border border-slate-200" />
                                  ) : (
                                    <Users className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                  )
                                )}
                                <span className="text-xs font-bold block truncate text-slate-800">
                                  {c.display_name}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-[7px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border bg-amber-50 text-amber-700 border-amber-200">
                                  Резерв #{index + 1}
                                </span>
                                {hasMembers && (
                                  <span className="text-[8px] text-amber-600 font-bold uppercase">
                                    {isExpanded ? "Свернуть" : `Состав (${c.team_members.length})`}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {(activeTournament.status === "REGISTRATION" || activeTournament.status === "DRAFT") && (
                                <>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handlePromoteCompetitor(c.id);
                                    }}
                                    className="bg-amber-500 hover:bg-amber-600 text-white font-black text-[9px] uppercase tracking-widest px-2.5 py-1.5 rounded-lg transition-colors shadow-sm"
                                    title="Перевести в основу как неоплаченную заявку"
                                  >
                                    В основу
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleConfirmPayment(c.id);
                                    }}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[9px] uppercase tracking-widest px-2.5 py-1.5 rounded-lg transition-colors shadow-sm"
                                    title="Оплатить взнос и перевести в основу"
                                  >
                                    Оплатить
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteCompetitor(c.id);
                                    }}
                                    className="text-slate-400 hover:text-red-600 p-1 rounded-md hover:bg-slate-200/50 transition-colors"
                                    title="Удалить из резерва"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>

                          {isExpanded && hasMembers && (
                            <div className="border-t border-amber-100 bg-white/50 p-3.5 space-y-2.5">
                              {c.team_members.map((m: any) => (
                                <div
                                  key={m.id}
                                  className="flex justify-between items-center text-[11px] bg-white border border-slate-200/60 p-2.5 rounded-xl shadow-xs"
                                >
                                  <div>
                                    <span className="font-bold text-slate-800 block">{m.fullName}</span>
                                    <span className="text-[9px] text-slate-400 font-medium">{m.phoneNumber}</span>
                                  </div>
                                  <span className="font-black italic text-orange-500 shrink-0">
                                    {m.elo} ELO
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

              </div>
            </div>

            {/* Prize pool calculator and Payouts */}
            <div className="bg-white border border-slate-200 rounded-[2rem] p-6 space-y-6 shadow-sm">
              <h3 className="text-md font-black uppercase italic tracking-tight text-slate-900">
                Призовой фонд
              </h3>
              
              {/* Calculations card */}
              <div className="bg-slate-50 border border-slate-200/60 p-4 rounded-2xl space-y-3">
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-200/60 pb-1.5 flex justify-between">
                  <span>Режим: {activeTournament.prize_pool_mode === "fixed" ? "Фиксированный" : "Динамический"}</span>
                  <span className="text-orange-500">Доля клуба: {activeTournament.club_share_pct || 0}%</span>
                </div>

                <div className="space-y-2 text-xs font-bold text-slate-600">
                  {activeTournament.type === "2vs2" || activeTournament.type === "5vs5" ? (
                    <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                      <span>Расчет взноса:</span>
                      <span className="text-slate-700">
                        {activeTournament.config?.entryFeeType === "team" ? "С команды" : "С игрока"}
                      </span>
                    </div>
                  ) : null}

                  {activeTournament.prize_pool_mode === "dynamic" ? (
                    <>
                      {(() => {
                        const isTeam = activeTournament.type === "2vs2" || activeTournament.type === "5vs5";
                        const tSize = activeTournament.type === "2vs2" || activeTournament.type === "mix_2vs2" ? 2 : (activeTournament.type === "5vs5" || activeTournament.type === "mix_5vs5" ? 5 : 1);
                        const feeType = activeTournament.config?.entryFeeType || "player";
                        const mult = (isTeam && feeType === "player") ? tSize : 1;
                        const feePerComp = parseFloat(activeTournament.entry_fee || 0) * mult;
                        
                        const paidComps = competitors.filter(x => x.payment_status === "PAID").length;
                        const maxS = activeTournament.config?.maxParticipants || 16;
                        const share = activeTournament.club_share_pct || 0;

                        const actPool = Math.round(paidComps * feePerComp * (1 - share / 100));
                        const planPool = Math.round(maxS * feePerComp * (1 - share / 100));

                        return (
                          <>
                            <div className="flex justify-between">
                              <span>Оплачено взносов:</span>
                              <span className="text-slate-900">
                                {paidComps} × {feePerComp} ₽
                              </span>
                            </div>
                            
                            <div className="flex justify-between text-[11px] font-black border-t border-dashed border-slate-200 pt-2 text-slate-800">
                              <span>Фактический нал. фонд (сейчас):</span>
                              <span className="text-emerald-600">{actPool} ₽</span>
                            </div>

                            <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                              <span>Планируемый нал. фонд (макс):</span>
                              <span>{planPool} ₽</span>
                            </div>
                          </>
                        );
                      })()}
                    </>
                  ) : (
                    <div className="space-y-1 text-xs font-bold text-slate-600">
                      <div className="flex justify-between">
                        <span>Фиксированная сумма:</span>
                        <span className="text-emerald-600 font-extrabold">{activeTournament.fixed_prize_amount} ₽</span>
                      </div>
                    </div>
                  )}

                  {(() => {
                    const { totalBonusPool: activeBonusPool } = parsePrizeDistribution(activeTournament.prize_distribution);
                    if (activeBonusPool > 0) {
                      return (
                        <div className="flex justify-between text-[11px] font-black border-t border-dashed border-slate-200 pt-2 text-slate-800">
                          <span>Бонусный фонд клуба:</span>
                          <span className="text-blue-600">{activeBonusPool} Б</span>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              </div>

              {/* Placements prize list */}
              <div className="space-y-3">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                  Распределение призов
                </span>
                
                {(() => {
                  const { totalBonusPool: activeBonusPool, placements: activePlacements } = parsePrizeDistribution(activeTournament.prize_distribution);
                  const prizeSlots = getPrizeSlotsList(activePlacements);
                  
                  if (prizeSlots.length === 0) {
                    return (
                      <p className="text-slate-400 text-xs text-center py-4">
                        Настройки призов не найдены.
                      </p>
                    );
                  }

                  const entryFee = parseFloat(activeTournament.entry_fee || 0);
                  const paidCompsCount = competitors.filter(x => x.payment_status === "PAID").length;
                  const maxSlots = activeTournament.config?.maxParticipants || 16;
                  
                  const isTeam = activeTournament.type === "2vs2" || activeTournament.type === "5vs5";
                  const tSize = activeTournament.type === "2vs2" || activeTournament.type === "mix_2vs2" ? 2 : (activeTournament.type === "5vs5" || activeTournament.type === "mix_5vs5" ? 5 : 1);
                  const feeType = activeTournament.config?.entryFeeType || "player";
                  const mult = (isTeam && feeType === "player") ? tSize : 1;
                  const feePerComp = entryFee * mult;

                  const actualPool = activeTournament.prize_pool_mode === "fixed"
                    ? parseFloat(activeTournament.fixed_prize_amount || 0)
                    : (paidCompsCount * feePerComp) * (1 - (activeTournament.club_share_pct || 0) / 100);

                  const plannedPool = activeTournament.prize_pool_mode === "fixed"
                    ? parseFloat(activeTournament.fixed_prize_amount || 0)
                    : (maxSlots * feePerComp) * (1 - (activeTournament.club_share_pct || 0) / 100);

                  return prizeSlots.map((slot) => {
                    const slotUniqueName = slot.totalSlots > 1 ? `${slot.label} #${slot.slotIndex + 1}` : slot.label;
                    const payoutForSlot = payouts.find(p => p.item_details && p.item_details.includes(`(${slotUniqueName})`));
                    
                    const cashPctFraction = slot.cashPct > 1 ? slot.cashPct / 100 : slot.cashPct;
                    const actualRewardCash = Math.round(actualPool * cashPctFraction);
                    const plannedRewardCash = Math.round(plannedPool * cashPctFraction);
                    
                    let winnerComp = null;
                    if (payoutForSlot) {
                      winnerComp = competitors.find(c => c.id === payoutForSlot.competitor_id);
                    }

                    return (
                      <div
                        key={slot.uniqueKey}
                        className="bg-slate-50 p-4 rounded-2xl border border-slate-200/60 space-y-3"
                      >
                        <div className="flex justify-between items-start flex-wrap gap-2">
                          <div>
                            <span className="text-xs font-black block text-slate-800">
                              {slotUniqueName}
                            </span>
                            <div className="text-[10px] space-y-1 text-slate-500 font-bold uppercase mt-1">
                              {(actualRewardCash > 0 || plannedRewardCash > 0) && (
                                <div className="text-emerald-600">
                                  Наличные: <span className="font-extrabold">{actualRewardCash} ₽</span> 
                                  <span className="text-[9px] text-slate-400 lowercase ml-1">
                                    (план: {plannedRewardCash} ₽)
                                  </span>
                                </div>
                              )}
                              {slot.bonus > 0 && (
                                <div className="text-blue-600">
                                  Бонусы: <span className="font-extrabold">{slot.bonus} Б</span>
                                </div>
                              )}
                              {slot.item && (() => {
                                const matchedItem = activeTournament.config?.itemPool?.find((i: any) => i.id === slot.itemId);
                                const isTeam = activeTournament.type === "2vs2" || activeTournament.type === "5vs5";
                                const scopeString = isTeam 
                                  ? (slot.itemScope === "team" ? " (на команду)" : " (каждому игроку)") 
                                  : "";
                                const costString = matchedItem ? ` (ценность ${matchedItem.cost} ₽)` : "";
                                return (
                                  <div className="text-amber-600">
                                    Предмет: <span className="font-extrabold">{slot.item}{scopeString}{costString}</span>
                                  </div>
                                );
                              })()}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {payoutForSlot ? (
                              <div className="text-right">
                                <span className="text-[10px] font-black block text-slate-800">
                                  Победитель: {winnerComp?.display_name || "Удален"}
                                </span>
                                <span className="text-[8px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded mt-1 inline-block">
                                  Выдано
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                {activeTournament.status === "ACTIVE" && (
                                  <>
                                    <select
                                      value={selectedWinners[slot.uniqueKey] || ""}
                                      onChange={(e) => setSelectedWinners({
                                        ...selectedWinners,
                                        [slot.uniqueKey]: e.target.value
                                      })}
                                      className="bg-white border border-slate-200 rounded-xl px-2 py-1.5 text-[11px] text-slate-900 focus:outline-none w-[150px] font-bold"
                                    >
                                      <option value="">Кто выиграл?</option>
                                      {competitors
                                        .filter(c => c.payment_status === "PAID")
                                        .filter(c => !payouts.some(p => p.competitor_id === c.id))
                                        .map(c => (
                                          <option key={c.id} value={c.id}>{c.display_name}</option>
                                        ))
                                      }
                                    </select>
                                    <button
                                      onClick={() => {
                                        const competitorId = selectedWinners[slot.uniqueKey];
                                        if (!competitorId) {
                                          alert("Выберите победителя из списка");
                                          return;
                                        }
                                        handleConfirmPayout(competitorId, actualRewardCash, slot.bonus, slot.item, slotUniqueName);
                                      }}
                                      disabled={!selectedWinners[slot.uniqueKey]}
                                      className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:hover:bg-orange-500 text-white font-black text-[9px] uppercase tracking-widest px-3 py-2 rounded-lg transition-colors shadow-sm"
                                    >
                                      Выдать
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}

                {competitors.length === 0 && (
                  <p className="text-slate-400 text-xs text-center py-4">
                    Зарегистрируйте участников для расчета распределения
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CREATE TOURNAMENT MODAL (WIZARD FLOW) */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/70">
          <div className="w-full max-w-xl bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto custom-scrollbar text-slate-900">
              {/* Wizard Steps indicator */}
              <div className="pb-4 border-b border-slate-100 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-black uppercase italic tracking-tight text-slate-900">
                    {editTournamentId ? "Редактировать" : "Создать"} <span className="text-orange-500">Турнир</span>
                  </h3>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    Шаг {wizardStep} из 4
                  </span>
                </div>
                
                {/* Visual Timeline */}
                <div className="flex items-center justify-between relative mt-2 px-2">
                  <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-slate-100 -translate-y-1/2 z-0" />
                  <div
                    className="absolute left-0 top-1/2 h-0.5 bg-orange-500 -translate-y-1/2 z-0 transition-all duration-300"
                    style={{ width: `${((wizardStep - 1) / 3) * 100}%` }}
                  />
                  {[
                    { step: 1, label: "Общие" },
                    { step: 2, label: "Взносы" },
                    { step: 3, label: "Призы" },
                    { step: 4, label: "Регламент" },
                  ].map((s) => (
                    <button
                      key={s.step}
                      type="button"
                      onClick={() => {
                        if (s.step < wizardStep || (s.step > wizardStep && name.trim())) {
                          setWizardStep(s.step);
                        }
                      }}
                      className="relative z-10 flex flex-col items-center gap-1.5 focus:outline-none"
                    >
                      <div
                        className={cn(
                          "w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black transition-all border-2",
                          wizardStep === s.step
                            ? "bg-orange-500 border-orange-500 text-white shadow-lg shadow-orange-500/20 scale-110"
                            : wizardStep > s.step
                            ? "bg-orange-50 border-orange-500 text-orange-500"
                            : "bg-white border-slate-200 text-slate-400"
                        )}
                      >
                        {wizardStep > s.step ? "✓" : s.step}
                      </div>
                      <span
                        className={cn(
                          "text-[9px] font-black uppercase tracking-wider transition-colors",
                          wizardStep === s.step
                            ? "text-orange-500"
                            : wizardStep > s.step
                            ? "text-slate-700"
                            : "text-slate-400"
                        )}
                      >
                        {s.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* STEP 1: General Info */}
              {wizardStep === 1 && (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-500">Название турнира</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Colizeum CS2 Solo Cup..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs text-slate-900 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[9px] font-black uppercase text-slate-500 block">Дисциплина</label>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { id: "cs2", name: "CS2 (Авто)" },
                        { id: "fifa", name: "FIFA (Ручной)" },
                        { id: "ufc", name: "UFC (Ручной)" },
                      ].map((discItem) => (
                        <button
                          key={discItem.id}
                          type="button"
                          onClick={() => setDiscipline(discItem.id)}
                          className={cn(
                            "py-3 px-4 rounded-xl border font-bold text-xs uppercase tracking-wider transition-all text-center",
                            discipline === discItem.id
                              ? "bg-slate-900 text-white border-slate-900 shadow-md"
                              : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100/60"
                          )}
                        >
                          {discItem.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[9px] font-black uppercase text-slate-500 block">Формат участников</label>
                    <div className="grid grid-cols-2 gap-3">
                      {getFormatOptions().map((typeItem) => (
                        <button
                          key={typeItem.id}
                          type="button"
                          onClick={() => setType(typeItem.id)}
                          className={cn(
                            "py-3 px-4 rounded-xl border font-bold text-xs uppercase tracking-wider transition-all text-center",
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

                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-500 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" /> Расписание: Дата и время начала
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={startsAt}
                      onChange={(e) => setStartsAt(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs text-slate-900 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* STEP 2: Fees and Limits */}
              {wizardStep === 2 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-500">Лимит слотов (участников/команд)</label>
                      <input
                        type="number"
                        min={2}
                        value={maxParticipants}
                        onChange={(e) => setMaxParticipants(parseInt(e.target.value) || 0)}
                        placeholder="Например: 16"
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs text-slate-900 focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-500">
                        {type === "2vs2" || type === "5vs5"
                          ? `Взнос ${entryFeeType === "player" ? "с игрока" : "с команды"} (₽)`
                          : "Взнос с участника (₽)"
                        }
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={entryFee}
                        onChange={(e) => setEntryFee(parseInt(e.target.value) || 0)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs text-slate-900 focus:outline-none"
                      />
                    </div>
                  </div>

                  {(type === "2vs2" || type === "5vs5") && (
                    <div className="space-y-1 bg-slate-50 border border-slate-200/60 p-4 rounded-2xl space-y-2">
                      <label className="text-[9px] font-black uppercase text-slate-500 block">Как рассчитывать взнос для команды?</label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setEntryFeeType("player")}
                          className={cn(
                            "py-2 px-3 rounded-xl border font-bold text-xs uppercase tracking-wider transition-all text-center",
                            entryFeeType === "player"
                              ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100/60"
                          )}
                        >
                          С игрока
                        </button>
                        <button
                          type="button"
                          onClick={() => setEntryFeeType("team")}
                          className={cn(
                            "py-2 px-3 rounded-xl border font-bold text-xs uppercase tracking-wider transition-all text-center",
                            entryFeeType === "team"
                              ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100/60"
                          )}
                        >
                          С команды
                        </button>
                      </div>
                      <span className="text-[9px] text-slate-400 block font-bold mt-1">
                        {entryFeeType === "player" 
                          ? `Команда из ${type === "2vs2" ? "2" : "5"} человек заплатит в сумме ${entryFee * (type === "2vs2" ? 2 : 5)} ₽ за участие`
                          : `Команда заплатит ровно ${entryFee} ₽ за участие`
                        }
                      </span>
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-500">Доля клуба с взносов (%)</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={clubSharePct}
                      onChange={(e) => setClubSharePct(parseInt(e.target.value) || 0)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs text-slate-900 focus:outline-none"
                    />
                    <span className="text-[9px] text-slate-400 block mt-1">
                      Комиссия, которая отчисляется клубу. Остальная сумма идет в призовой фонд.
                    </span>
                  </div>
                </div>
              )}

              {/* STEP 3: Combined Prize Pool & Distribution */}
              {wizardStep === 3 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-500">Режим фонда наличных</label>
                      <select
                        value={prizePoolMode}
                        onChange={(e) => setPrizePoolMode(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs text-slate-900 focus:outline-none"
                      >
                        <option value="dynamic">Динамический (от взносов)</option>
                        <option value="fixed">Фиксированный (гарант клуба)</option>
                      </select>
                    </div>

                    {prizePoolMode === "fixed" ? (
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-slate-500">Сумма гаранта (₽)</label>
                        <input
                          type="number"
                          value={fixedPrizeAmount}
                          onChange={(e) => setFixedPrizeAmount(parseInt(e.target.value) || 0)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs text-slate-900 focus:outline-none"
                        />
                      </div>
                    ) : (
                      <div className="space-y-1 flex items-end">
                        <div className="text-[10px] text-slate-500 font-bold bg-slate-100 p-3.5 rounded-2xl w-full border border-slate-200/60 text-center">
                          Ориентировочный фонд: <span className="text-orange-500 font-black">{estimatedPrizePool} ₽</span>
                        </div>
                      </div>
                    )}

                    <div className="space-y-1 col-span-2">
                      <label className="text-[9px] font-black uppercase text-slate-500">Выделенные бонусы клуба (общий фонд)</label>
                      <input
                        type="number"
                        value={totalBonusPool || ""}
                        onChange={(e) => setTotalBonusPool(parseInt(e.target.value) || 0)}
                        placeholder="Например: 10000 (оставьте 0, если бонусов нет)"
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs text-slate-900 focus:outline-none"
                      />
                    </div>

                    {totalBonusPool > 0 && (
                      <div className="col-span-2 pt-1">
                        <label className="flex items-center gap-2 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={autoDistributeBonuses}
                            onChange={(e) => setAutoDistributeBonuses(e.target.checked)}
                            className="accent-orange-500 w-4 h-4 rounded"
                          />
                          <span className="text-[10px] text-slate-500 font-bold uppercase group-hover:text-slate-800 transition-colors">
                            Распределять бонусы пропорционально долям наличных
                          </span>
                        </label>
                      </div>
                    )}
                  </div>

                  {/* visual calculations card */}
                  <div className="bg-slate-50 border border-slate-200/80 rounded-3xl p-5 space-y-2.5 shadow-sm">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block border-b border-slate-200 pb-1.5">
                      Детализация расчетов при полных слотах
                    </span>
                    <div className="grid grid-cols-2 gap-y-2 text-xs font-bold text-slate-600">
                      <div>Макс. слотов ({isTeamFormat ? "команд" : "игроков"}):</div>
                      <div className="text-right text-slate-900">{maxParticipants}</div>

                      {isTeamFormat ? (
                        <>
                          <div>Взнос:</div>
                          <div className="text-right text-slate-900">
                            {entryFeeType === "player" 
                              ? `${entryFee} ₽ с игрока (по ${entryFee * teamSize} ₽ с команды)`
                              : `${entryFee} ₽ с команды`
                            }
                          </div>
                        </>
                      ) : (
                        <>
                          <div>Взнос с игрока:</div>
                          <div className="text-right text-slate-900">{entryFee} ₽</div>
                        </>
                      )}

                      <div>Собрано взносов (грязными):</div>
                      <div className="text-right text-slate-900 font-extrabold text-slate-800">
                        {totalFeesCollected} ₽
                        <span className="text-[10px] text-slate-400 font-normal block">
                          ({maxParticipants} {isTeamFormat ? "команд" : "игроков"}
                          {isTeamFormat && entryFeeType === "player" ? ` × ${teamSize} игроков` : ""}
                          {` × ${entryFee} ₽`})
                        </span>
                      </div>

                      <div>Доля клуба ({clubSharePct}%):</div>
                      <div className="text-right text-rose-600">-{clubCommission} ₽</div>

                      <div className="border-t border-dashed border-slate-200 pt-2 text-xs font-black text-slate-800">
                        Итоговый призовой фонд (нал):
                      </div>
                      <div className="border-t border-dashed border-slate-200 pt-2 text-right text-xs font-black text-emerald-600">
                        {estimatedPrizePool} ₽
                      </div>

                      {totalBonusPool > 0 && (
                        <>
                          <div className="border-t border-dashed border-slate-200 pt-2 text-xs font-black text-slate-800">
                            Бонусный фонд клуба:
                          </div>
                          <div className="border-t border-dashed border-slate-200 pt-2 text-right text-xs font-black text-blue-600">
                            {totalBonusPool} Б
                          </div>
                        </>
                      )}

                      {totalItemsValue > 0 && (
                        <>
                          <div className="border-t border-dashed border-slate-200 pt-2 text-xs font-black text-slate-800">
                            Призовые предметы:
                          </div>
                          <div className="border-t border-dashed border-slate-200 pt-2 text-right text-xs font-black text-amber-600">
                            {totalItemsValue} ₽
                          </div>
                        </>
                      )}

                      <div className="border-t border-solid border-slate-200 pt-2 text-xs font-black text-slate-900">
                        Общий призовой фонд (всего):
                      </div>
                      <div className="border-t border-solid border-slate-200 pt-2 text-right text-xs font-black text-orange-600">
                        {estimatedPrizePool + totalBonusPool + totalItemsValue} ₽
                      </div>
                    </div>
                  </div>

                  {/* Блок управления пулом предметов */}
                  <div className="bg-slate-50 border border-slate-200/80 rounded-3xl p-5 space-y-4 shadow-sm">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block border-b border-slate-200 pb-1.5 flex items-center gap-1.5">
                      <Award className="w-3.5 h-3.5 text-orange-500" />
                      Пул призовых предметов (Item Pool)
                    </span>
                    
                    {/* Список добавленных предметов */}
                    {itemPool.length > 0 ? (
                      <div className="space-y-2 max-h-[150px] overflow-y-auto pr-2 custom-scrollbar">
                        {itemPool.map((item) => (
                          <div key={item.id} className="flex justify-between items-center bg-white border border-slate-100 rounded-xl px-3.5 py-2 text-xs">
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-800">{item.name}</span>
                              <span className="text-[10px] text-slate-500 font-semibold">{item.cost} ₽</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                // Remove item
                                const updatedPool = itemPool.filter(i => i.id !== item.id);
                                setItemPool(updatedPool);
                                
                                // Reset itemId/item on any placement referencing this deleted item
                                const updatedPlacements = placements.map(p => {
                                  if (p.itemId === item.id) {
                                    return { ...p, itemId: "", item: "" };
                                  }
                                  return p;
                                });
                                setPlacements(updatedPlacements);
                              }}
                              className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-[10px] text-slate-400 font-bold uppercase text-center py-2">
                        Пул предметов пуст. Добавьте ценные призы ниже.
                      </div>
                    )}

                    {/* Форма быстрого добавления предмета */}
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/50">
                      <div className="space-y-1">
                        <label className="text-[8px] text-slate-400 font-black uppercase">Название приза</label>
                        <input
                          type="text"
                          id="new-item-name"
                          placeholder="Клавиатура Keychron K2..."
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-900"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[8px] text-slate-400 font-black uppercase">Стоимость (₽)</label>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            id="new-item-cost"
                            placeholder="5000"
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-900"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const nameInput = document.getElementById("new-item-name") as HTMLInputElement;
                              const costInput = document.getElementById("new-item-cost") as HTMLInputElement;
                              if (!nameInput || !costInput) return;
                              const nameVal = nameInput.value.trim();
                              const costVal = parseInt(costInput.value) || 0;
                              if (!nameVal) {
                                alert("Введите название приза!");
                                return;
                              }
                              if (costVal <= 0) {
                                alert("Введите корректную стоимость приза!");
                                return;
                              }
                              
                              // Add new item to itemPool state
                              setItemPool(prev => [...prev, { id: String(Date.now()), name: nameVal, cost: costVal }]);
                              
                              // Reset fields
                              nameInput.value = "";
                              costInput.value = "";
                            }}
                            className="bg-orange-500 hover:bg-orange-600 text-white font-black text-xs px-3.5 rounded-xl transition-colors flex items-center justify-center shrink-0"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {(() => {
                    const totalCashPct = placements.reduce((sum, p) => sum + (p.cashPct || 0) * getCountFromLabel(p.label), 0);
                    const totalDistributedBonuses = placements.reduce((sum, p) => sum + (p.bonus || 0) * getCountFromLabel(p.label), 0);

                    return (
                      <>
                        {totalCashPct > 100 && (
                          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-[10px] text-rose-700 font-bold flex items-start gap-2 shadow-sm">
                            <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                            <div>
                              Сумма долей наличных ({totalCashPct}%) превышает 100%! Отрегулируйте доли.
                            </div>
                          </div>
                        )}
                        {totalCashPct < 100 && (
                          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-[10px] text-amber-700 font-bold flex items-start gap-2 shadow-sm">
                            <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                            <div>
                              Сумма долей наличных ({totalCashPct}%) меньше 100%. Осталось распределить {100 - totalCashPct}%.
                            </div>
                          </div>
                        )}
                        {totalBonusPool > 0 && totalDistributedBonuses !== totalBonusPool && (
                          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-[10px] text-rose-700 font-bold flex items-start gap-2 shadow-sm">
                            <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                            <div>
                              Сумма распределенных бонусов ({totalDistributedBonuses} Б) не совпадает с общим бонусным фондом ({totalBonusPool} Б)!
                            </div>
                          </div>
                        )}

                        <div className="w-full h-px bg-slate-100 my-2" />

                        {/* Combined Placement distributions */}
                        <div className="space-y-3 max-h-[30vh] overflow-y-auto pr-2 custom-scrollbar">
                          {placements.map((p, idx) => {
                            const count = getCountFromLabel(p.label);
                            const isRange = count > 1;
                            const slotCash = Math.round(estimatedPrizePool * ((p.cashPct || 0) / 100));
                            const totalCash = slotCash * count;
                            const totalBonus = (p.bonus || 0) * count;

                            return (
                              <div key={p.id || idx} className="bg-slate-50 border border-slate-200/60 p-4 rounded-2xl space-y-3 relative">
                                <div className="flex justify-between items-center gap-4">
                                  <div className="flex-1">
                                    <label className="text-[8px] text-slate-400 font-black uppercase">Название места / диапазона</label>
                                    <input
                                      type="text"
                                      value={p.label}
                                      onChange={(e) => {
                                        const updated = [...placements];
                                        updated[idx].label = e.target.value;
                                        setPlacements(updated);
                                      }}
                                      placeholder="1 Место или 4-6 Место..."
                                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-900 font-bold"
                                    />
                                  </div>
                                  
                                  <div className="text-right flex flex-col justify-end">
                                    <span className="text-[9px] text-slate-400 font-bold uppercase">
                                      {count > 1 ? `${count} участников` : "1 участник"}
                                    </span>
                                    <span className="text-[10px] font-black text-emerald-600">
                                      {isRange ? `По ${slotCash} ₽ (всего ${totalCash} ₽)` : `Нал: ${slotCash} ₽`}
                                    </span>
                                    {p.bonus > 0 && (
                                      <span className="text-[10px] font-black text-blue-600">
                                        {isRange ? `По ${p.bonus} Б (всего ${totalBonus} Б)` : `Бонус: ${p.bonus} Б`}
                                      </span>
                                    )}
                                  </div>

                                  {placements.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const updated = placements.filter((_, i) => i !== idx);
                                        setPlacements(updated);
                                      }}
                                      className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>

                                <div className="grid grid-cols-3 gap-2">
                                  <div>
                                    <label className="text-[8px] text-slate-400 font-black uppercase">Нал (%) на слот</label>
                                    <input
                                      type="number"
                                      value={p.cashPct || 0}
                                      onChange={(e) => {
                                        const updated = [...placements];
                                        updated[idx].cashPct = parseInt(e.target.value) || 0;
                                        setPlacements(updated);
                                      }}
                                      className="w-full bg-white border border-slate-200 rounded-xl px-2 py-1 text-xs text-slate-900"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[8px] text-slate-400 font-black uppercase">Бонусы (Б) на слот</label>
                                    <input
                                      type="number"
                                      disabled={autoDistributeBonuses}
                                      value={p.bonus || 0}
                                      onChange={(e) => {
                                        const updated = [...placements];
                                        updated[idx].bonus = parseInt(e.target.value) || 0;
                                        setPlacements(updated);
                                      }}
                                      className="w-full disabled:bg-slate-100 disabled:text-slate-400 bg-white border border-slate-200 rounded-xl px-2 py-1 text-xs text-slate-900"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[8px] text-slate-400 font-black uppercase">Предмет на слот</label>
                                    <select
                                      value={p.itemId || ""}
                                      onChange={(e) => {
                                        const updated = [...placements];
                                        const selectedId = e.target.value;
                                        updated[idx].itemId = selectedId;
                                        const matched = itemPool.find(item => item.id === selectedId);
                                        updated[idx].item = matched ? matched.name : "";
                                        if (!updated[idx].itemScope) {
                                          updated[idx].itemScope = "player";
                                        }
                                        setPlacements(updated);
                                      }}
                                      className="w-full bg-white border border-slate-200 rounded-xl px-2 py-1.5 text-xs text-slate-900 focus:outline-none"
                                    >
                                      <option value="">Без предмета</option>
                                      {itemPool.map((item) => (
                                        <option key={item.id} value={item.id}>
                                          {item.name} ({item.cost} ₽)
                                        </option>
                                      ))}
                                    </select>
                                    {isTeamFormat && p.itemId && (
                                      <div className="mt-1 flex items-center gap-1.5">
                                        <span className="text-[8px] text-slate-400 font-bold uppercase">Выдача:</span>
                                        <select
                                          value={p.itemScope || "player"}
                                          onChange={(e) => {
                                            const updated = [...placements];
                                            updated[idx].itemScope = e.target.value;
                                            setPlacements(updated);
                                          }}
                                          className="bg-white border border-slate-200 rounded-lg px-1 py-0.5 text-[9px] text-slate-950 font-bold focus:outline-none"
                                        >
                                          <option value="player">Каждому</option>
                                          <option value="team">На команду</option>
                                        </select>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <div className="flex gap-2 justify-center pt-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => {
                              const lastLabel = placements[placements.length - 1]?.label || "0 Место";
                              const matches = lastLabel.match(/(\d+)/g);
                              let nextPlace = 1;
                              if (matches && matches.length > 0) {
                                const lastNum = parseInt(matches[matches.length - 1]);
                                nextPlace = lastNum + 1;
                              }
                              setPlacements([
                                ...placements,
                                { id: String(Date.now()), label: `${nextPlace} Место`, cashPct: 0, bonus: 0, item: "" }
                              ]);
                            }}
                            className="border border-slate-200 hover:bg-slate-100 text-slate-600 font-black text-[10px] uppercase tracking-widest px-4 py-2 rounded-xl transition-colors"
                          >
                            + Место
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const lastLabel = placements[placements.length - 1]?.label || "0 Место";
                              const matches = lastLabel.match(/(\d+)/g);
                              let start = 4;
                              let end = 6;
                              if (matches && matches.length > 0) {
                                const lastNum = parseInt(matches[matches.length - 1]);
                                start = lastNum + 1;
                                end = start + 2;
                              }
                              setPlacements([
                                ...placements,
                                { id: String(Date.now()), label: `${start}-${end} Место`, cashPct: 0, bonus: 0, item: "" }
                              ]);
                            }}
                            className="border border-slate-200 hover:bg-slate-100 text-slate-600 font-black text-[10px] uppercase tracking-widest px-4 py-2 rounded-xl transition-colors"
                          >
                            + Диапазон
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const isTeam = type === "2vs2" || type === "5vs5";
                              const tSize = type === "2vs2" || type === "mix_2vs2" ? 2 : (type === "5vs5" || type === "mix_5vs5" ? 5 : 1);
                              const feeType = entryFeeType;
                              const mult = (isTeam && feeType === "player") ? tSize : 1;
                              const feePerComp = entryFee * mult;

                              const balanced = autoBalancePlacements(placements, estimatedPrizePool, feePerComp);
                              setPlacements(balanced);
                            }}
                            className="bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-emerald-700 font-black text-[10px] uppercase tracking-widest px-4 py-2 rounded-xl transition-colors flex items-center gap-1 shadow-sm"
                          >
                            📊 Автобаланс долей
                          </button>
                        </div>

                        {(() => {
                          const { errors, warnings } = getPrizeValidation();
                          if (errors.length === 0 && warnings.length === 0) return null;
                          return (
                            <div className="mt-4 space-y-2">
                              {errors.map((err, idx) => (
                                <div key={`err-${idx}`} className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-[10px] text-rose-700 font-bold flex items-start gap-2 shadow-sm">
                                  <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                                  <div>{err}</div>
                                </div>
                              ))}
                              {warnings.map((warn, idx) => (
                                <div key={`warn-${idx}`} className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-[10px] text-amber-700 font-bold flex items-start gap-2 shadow-sm">
                                  <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                                  <div>{warn}</div>
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                      </>
                    );
                  })()}
                </div>
              )}

              {/* STEP 4: Rules & Templates Management */}
              {wizardStep === 4 && (
                <div className="space-y-4">
                  {/* Load Template block */}
                  {rulesTemplates.length > 0 && (
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black uppercase text-slate-500">Использовать готовый шаблон правил</label>
                      <select
                        value={selectedTemplateId}
                        onChange={(e) => handleSelectTemplate(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs text-slate-900 focus:outline-none"
                      >
                        <option value="">-- Выберите шаблон --</option>
                        {rulesTemplates.map((t) => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-500">Текст регламента/правил</label>
                    <textarea
                      value={rules}
                      onChange={(e) => setRules(e.target.value)}
                      rows={5}
                      placeholder="Запрещены скрипты, использование багов. Опоздание на 15 минут — дисквалификация..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs text-slate-900 focus:outline-none"
                    />
                  </div>

                  {/* Save rules as template widget */}
                  <div className="bg-slate-50 border border-slate-200/60 p-4 rounded-2xl space-y-3">
                    <span className="text-[9px] font-black uppercase text-slate-500 block">Сохранить правила как шаблон для последующих турниров</span>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Название шаблона (например: Стандарт CS2 5x5)"
                        value={newTemplateName}
                        onChange={(e) => setNewTemplateName(e.target.value)}
                        className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs"
                      />
                      <button
                        type="button"
                        onClick={handleSaveRulesTemplate}
                        disabled={isSavingTemplate}
                        className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-1"
                      >
                        <Save className="w-3.5 h-3.5" /> Сохранить
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation buttons */}
              <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                {wizardStep > 1 ? (
                  <button
                    type="button"
                    onClick={() => setWizardStep(wizardStep - 1)}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs uppercase tracking-widest px-5 py-3.5 rounded-2xl transition-all flex items-center gap-1"
                  >
                    <ChevronLeft className="w-4 h-4" /> Назад
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-black text-xs uppercase tracking-widest px-5 py-3.5 rounded-2xl transition-all"
                  >
                    Отмена
                  </button>
                )}

                {wizardStep < 4 ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (wizardStep === 2) {
                        const isTeam = type === "2vs2" || type === "5vs5";
                        const tSize = type === "2vs2" || type === "mix_2vs2" ? 2 : (type === "5vs5" || type === "mix_5vs5" ? 5 : 1);
                        const feeType = entryFeeType;
                        const mult = (isTeam && feeType === "player") ? tSize : 1;
                        const feePerComp = entryFee * mult;

                        const totalFees = maxParticipants * entryFee * mult;
                        const comm = Math.round(totalFees * (clubSharePct / 100));
                        const estPool = prizePoolMode === "fixed" ? fixedPrizeAmount : totalFees - comm;

                        const balanced = autoBalancePlacements(placements, estPool, feePerComp);
                        setPlacements(balanced);
                      }
                      if (wizardStep === 3) {
                        const { errors } = getPrizeValidation();
                        if (errors.length > 0) {
                          alert("Пожалуйста, исправьте ошибки призового фонда перед продолжением:\n\n" + errors.join("\n"));
                          return;
                        }
                      }
                      setWizardStep(wizardStep + 1);
                    }}
                    className="bg-orange-500 hover:bg-orange-600 text-white font-black text-xs uppercase tracking-widest px-6 py-4 rounded-2xl transition-all shadow-md shadow-orange-500/10"
                  >
                    Далее
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleCreateTournament}
                    className="bg-orange-500 hover:bg-orange-600 text-white font-black text-xs uppercase tracking-widest px-6 py-4 rounded-2xl transition-all shadow-lg shadow-orange-500/20"
                  >
                    {editTournamentId ? "Сохранить" : "Создать Турнир"}
                  </button>
                )}
              </div>
          </div>
        </div>
      )}

      {/* MATCH CONTROL MODAL */}
      {showMatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/70">
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-2xl space-y-6 text-slate-900">
              <div className="text-center border-b border-slate-100 pb-4">
                <h3 className="text-lg font-black uppercase italic tracking-tight text-slate-900">
                  Управление <span className="text-orange-500">Матчем</span>
                </h3>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1 block">
                  Раунд: {showMatchModal.round === 0 ? "Групповой" : showMatchModal.round} • Дисциплина: {activeTournament.discipline.toUpperCase()}
                </span>
              </div>

              {/* RENDER FOR CS2 AUTOMATED SERVER */}
              {activeTournament.discipline === "cs2" ? (
                <div className="space-y-6">
                  {/* CS2 Server Status widget */}
                  <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200/60 space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-700">Сервер CS2</span>
                      <span
                        className={cn(
                          "text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded border",
                          showMatchModal.cs2_server_id
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-rose-50 text-rose-700 border-rose-200"
                        )}
                      >
                        {showMatchModal.cs2_server_id ? "Активен" : "Не запущен"}
                      </span>
                    </div>

                    {showMatchModal.cs2_server_id ? (
                      <div className="space-y-4 pt-2">
                        <div className="flex gap-2">
                          <button
                            onClick={async () => {
                              setIsManagingServer(true);
                              await fetch(`/api/clubs/${clubId}/tournaments`, {
                                method: "POST",
                                body: JSON.stringify({ action: "send_rcon", matchId: showMatchModal.id, command: "css_restart" }),
                              });
                              setIsManagingServer(false);
                            }}
                            className="flex-1 bg-slate-100 hover:bg-slate-200 border border-slate-200 p-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-colors flex items-center justify-center gap-1.5 text-slate-700"
                          >
                            <RefreshCw className="w-3.5 h-3.5" /> Рестарт
                          </button>
                          <button
                            onClick={async () => {
                              setIsManagingServer(true);
                              // Calls agent stop server
                              await fetch(`/api/clubs/${clubId}/tournaments`, {
                                method: "POST",
                                body: JSON.stringify({ action: "stop_server", matchId: showMatchModal.id }),
                              });
                              setIsManagingServer(false);
                            }}
                            className="flex-1 bg-rose-50 hover:bg-rose-100 border border-rose-200 p-3 rounded-xl font-black text-[10px] uppercase tracking-widest text-rose-600 transition-colors flex items-center justify-center gap-1.5"
                          >
                            <Square className="w-3.5 h-3.5" /> Выключить
                          </button>
                        </div>

                        {/* ELO Sync button */}
                        <button
                          onClick={() => handleSyncCS2Stats(showMatchModal.id)}
                          disabled={isSyncingStats}
                          className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-black text-xs uppercase tracking-widest py-4 rounded-2xl transition-colors shadow-lg shadow-orange-500/10 flex items-center justify-center gap-2"
                        >
                          {isSyncingStats ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            "Завершить матч и загрузить ELO"
                          )}
                        </button>
                      </div>
                    ) : (
                      <p className="text-slate-400 text-xs text-center py-4 leading-relaxed">
                        Сервер автоматически запустится, как только игроки завершат Map Veto в лобби матча.
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                // RENDER FOR MANUAL GAME ENTRY (FIFA/UFC)
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-6 bg-slate-50 p-6 rounded-3xl border border-slate-200/60">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block text-center">
                        {competitors.find(c => c.id === showMatchModal.competitor_a_id)?.display_name || "Команда А"}
                      </label>
                      <input
                        type="number"
                        value={score1}
                        onChange={(e) => setScore1(parseInt(e.target.value) || 0)}
                        className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-center font-black text-lg text-slate-900 focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block text-center">
                        {competitors.find(c => c.id === showMatchModal.competitor_b_id)?.display_name || "Команда Б"}
                      </label>
                      <input
                        type="number"
                        value={score2}
                        onChange={(e) => setScore2(parseInt(e.target.value) || 0)}
                        className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-center font-black text-lg text-slate-900 focus:outline-none"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleFinishMatch}
                    disabled={isSubmittingScore}
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black text-xs uppercase tracking-widest py-4.5 rounded-2xl transition-colors shadow-lg shadow-orange-500/10 flex items-center justify-center gap-2"
                  >
                    {isSubmittingScore ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      "Сохранить Результат"
                    )}
                  </button>
                </div>
              )}

              <button
                onClick={() => setShowMatchModal(null)}
                className="w-full text-center text-slate-400 hover:text-slate-950 text-[10px] font-black uppercase tracking-widest transition-colors py-2"
              >
                Закрыть окно
              </button>
          </div>
        </div>
      )}
    </div>
  );
}
