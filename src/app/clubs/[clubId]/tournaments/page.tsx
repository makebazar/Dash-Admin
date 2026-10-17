"use client";
import React from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Loader2, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

import {
  Tournament,
  Competitor,
  Match,
  Payout,
  RulesTemplate,
  DashMatchAgentInfo,
  ActiveCs2MatchInfo,
  TournamentParticipant,
  PromoTeam,
} from "./types";
import { TournamentHeader } from "./components/TournamentHeader";
import { TournamentList } from "./components/TournamentList";
import { ParticipantsTab } from "./components/ParticipantsTab";
import { ParticipantModal } from "./components/ParticipantModal";
import { TeamsTab } from "./components/TeamsTab";
import { TeamModal } from "./components/TeamModal";
import { RulesTemplatesTab } from "./components/RulesTemplatesTab";
import { RulesTemplateModal } from "./components/RulesTemplateModal";
import { TournamentDetailHeader } from "./components/TournamentDetailHeader";
import { TournamentBracket } from "./components/TournamentBracket";
import { CompetitorsList } from "./components/CompetitorsList";
import { PrizePoolLedger } from "./components/PrizePoolLedger";
import { TournamentInfoTab } from "./components/TournamentInfoTab";
import { MatchControlModal } from "./components/MatchControlModal";
import { UnpaidPromptModal } from "./components/UnpaidPromptModal";
import { RebuildBracketModal } from "./components/RebuildBracketModal";
import { DashMatchServerTab } from "./components/DashMatchServerTab";
import { TournamentSettingsTab } from "./components/TournamentSettingsTab";

export default function AdminTournaments() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const clubId = params.clubId as string;

  const urlTournamentId =
    searchParams.get("id") || searchParams.get("tournamentId") || "";
  const urlTab = searchParams.get("tab") || "";

  const [loading, setLoading] = React.useState(true);
  const [tournaments, setTournaments] = React.useState<Tournament[]>([]);
  const [activeTournament, setActiveTournament] =
    React.useState<Tournament | null>(null);
  const [competitors, setCompetitors] = React.useState<Competitor[]>([]);
  const [matches, setMatches] = React.useState<Match[]>([]);
  const [payouts, setPayouts] = React.useState<Payout[]>([]);
  const [dashmatchAgent, setDashmatchAgent] = React.useState<DashMatchAgentInfo | null>(null);
  const [activeCs2Matches, setActiveCs2Matches] = React.useState<ActiveCs2MatchInfo[]>([]);

  // Participants states
  const [participants, setParticipants] = React.useState<TournamentParticipant[]>([]);
  const [isLoadingParticipants, setIsLoadingParticipants] = React.useState(false);
  const [showParticipantModal, setShowParticipantModal] = React.useState(false);
  const [editingParticipant, setEditingParticipant] = React.useState<TournamentParticipant | null>(null);

  // Teams states
  const [teams, setTeams] = React.useState<PromoTeam[]>([]);
  const [isLoadingTeams, setIsLoadingTeams] = React.useState(false);
  const [showTeamModal, setShowTeamModal] = React.useState(false);
  const [editingTeam, setEditingTeam] = React.useState<PromoTeam | null>(null);

  // Rules Templates states
  const [rulesTemplates, setRulesTemplates] = React.useState<RulesTemplate[]>(
    []
  );
  const [mainTab, setMainTab] = React.useState<
    "tournaments" | "participants" | "teams" | "rules_templates" | "servers" | "settings"
  >(
    urlTab === "participants"
      ? "participants"
      : urlTab === "teams"
      ? "teams"
      : urlTab === "rules_templates"
      ? "rules_templates"
      : urlTab === "servers"
      ? "servers"
      : urlTab === "settings"
      ? "settings"
      : "tournaments"
  );
  const [showTemplateModal, setShowTemplateModal] = React.useState(false);
  const [templateFormId, setTemplateFormId] = React.useState<string | null>(
    null
  );
  const [templateFormName, setTemplateFormName] = React.useState("");
  const [templateFormDiscipline, setTemplateFormDiscipline] =
    React.useState("cs2");
  const [templateFormRules, setTemplateFormRules] = React.useState("");
  const [isSubmittingTemplate, setIsSubmittingTemplate] = React.useState(false);

  // Detail view inner tabs: "bracket" | "competitors" | "prizes" | "info"
  const [detailTab, setDetailTab] = React.useState<
    "bracket" | "competitors" | "prizes" | "info"
  >(() => {
    if (
      urlTab === "competitors" ||
      urlTab === "prizes" ||
      urlTab === "info" ||
      urlTab === "rules" ||
      urlTab === "bracket"
    ) {
      return urlTab === "rules" ? "info" : (urlTab as any);
    }
    return "bracket";
  });

  // Modals / forms
  const [showMatchModal, setShowMatchModal] = React.useState<Match | null>(
    null
  );
  const [isGeneratingBots, setIsGeneratingBots] = React.useState(false);
  const [isSimulatingMatches, setIsSimulatingMatches] = React.useState(false);

  // Unpaid prompt modal
  const [unpaidPromptModal, setUnpaidPromptModal] = React.useState<{
    unpaidList: Competitor[];
    paidList: Competitor[];
  } | null>(null);

  // Rebuild Bracket states
  const [showRebuildModal, setShowRebuildModal] = React.useState(false);
  const [rebuildBracketType, setRebuildBracketType] = React.useState<
    "single_elimination" | "double_elimination" | "round_robin"
  >("single_elimination");
  const [rebuildIncludeUnpaid, setRebuildIncludeUnpaid] = React.useState(false);
  const [isRebuildingBracket, setIsRebuildingBracket] = React.useState(false);

  // Helper to sync query parameters without full page reloads
  const updateUrl = React.useCallback(
    (newParams: Record<string, string | null>) => {
      if (typeof window === "undefined") return;
      const current = new URLSearchParams(window.location.search);
      Object.entries(newParams).forEach(([k, v]) => {
        if (v === null || v === undefined || v === "") {
          current.delete(k);
        } else {
          current.set(k, v);
        }
      });
      const qs = current.toString();
      const newUrl = `${window.location.pathname}${qs ? `?${qs}` : ""}`;
      window.history.replaceState(null, "", newUrl);
    },
    []
  );

  const fetchTournamentsList = async () => {
    try {
      const res = await fetch(`/api/clubs/${clubId}/tournaments`);
      const data = await res.json();
      setTournaments(data.tournaments || []);
      if (data.dashmatchAgent !== undefined) {
        setDashmatchAgent(data.dashmatchAgent);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchRulesTemplates = async (disc: string) => {
    try {
      const res = await fetch(
        `/api/clubs/${clubId}/tournaments?action=rules_templates&discipline=${disc}`
      );
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
      setDashmatchAgent(data.dashmatchAgent || null);
      setActiveCs2Matches(data.activeCs2Matches || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchParticipants = React.useCallback(async () => {
    try {
      setIsLoadingParticipants(true);
      const res = await fetch(`/api/clubs/${clubId}/tournaments?action=participants`);
      if (res.ok) {
        const data = await res.json();
        setParticipants(data.participants || []);
      }
    } catch (err) {
      console.error("Error fetching participants:", err);
    } finally {
      setIsLoadingParticipants(false);
    }
  }, [clubId]);

  const handleSaveParticipant = async (data: {
    id?: string;
    fullName: string;
    nickname?: string;
    phoneNumber: string;
    steamId?: string;
    faceitElo?: string;
    dotaMmr?: string;
    faceitLink?: string;
  }) => {
    const res = await fetch(`/api/clubs/${clubId}/tournaments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "save_participant",
        ...data,
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Не удалось сохранить участника");
    }
    await fetchParticipants();
  };

  const handleDeleteParticipant = async (id: string) => {
    if (!confirm("Вы действительно хотите отвязать участника от турнирной базы клуба?")) return;
    try {
      const res = await fetch(`/api/clubs/${clubId}/tournaments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete_participant",
          id,
        }),
      });
      if (res.ok) {
        await fetchParticipants();
      } else {
        alert("Не удалось отвязать участника");
      }
    } catch (e) {
      console.error(e);
      alert("Ошибка сети при удалении участника");
    }
  };

  const fetchTeams = React.useCallback(async () => {
    try {
      setIsLoadingTeams(true);
      const res = await fetch(`/api/clubs/${clubId}/tournaments?action=teams`);
      const data = await res.json();
      if (data.teams) {
        setTeams(data.teams);
      }
    } catch (err) {
      console.error("Error fetching teams:", err);
    } finally {
      setIsLoadingTeams(false);
    }
  }, [clubId]);

  const handleSaveTeam = async (data: {
    id?: number;
    name: string;
    tag?: string;
    formatType: string;
    captainPhone: string;
    members: string[];
  }) => {
    const res = await fetch(`/api/clubs/${clubId}/tournaments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "save_team",
        ...data,
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Не удалось сохранить команду");
    }
    await fetchTeams();
  };

  const handleDeleteTeam = async (id: number) => {
    if (!confirm("Вы действительно хотите удалить эту команду?")) return;
    try {
      const res = await fetch(`/api/clubs/${clubId}/tournaments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete_team",
          id,
        }),
      });
      if (res.ok) {
        await fetchTeams();
      } else {
        alert("Не удалось удалить команду");
      }
    } catch (e) {
      console.error(e);
      alert("Ошибка сети при удалении команды");
    }
  };

  const handleRequestRenameTeam = async (teamId: number, reason?: string) => {
    try {
      const res = await fetch(`/api/clubs/${clubId}/tournaments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "request_team_rename",
          teamId,
          reason,
        }),
      });
      if (res.ok) {
        await fetchTeams();
      } else {
        const err = await res.json();
        alert(err.error || "Не удалось отправить запрос на смену названия");
      }
    } catch (e) {
      console.error(e);
      alert("Ошибка при запросе смены названия");
    }
  };

  const handleCancelRenameTeam = async (teamId: number) => {
    try {
      const res = await fetch(`/api/clubs/${clubId}/tournaments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "cancel_team_rename",
          teamId,
        }),
      });
      if (res.ok) {
        await fetchTeams();
      } else {
        const err = await res.json();
        alert(err.error || "Не удалось отменить запрос");
      }
    } catch (e) {
      console.error(e);
      alert("Ошибка при отмене запроса");
    }
  };

  React.useEffect(() => {
    async function init() {
      setLoading(true);
      await fetchTournamentsList();
      if (urlTournamentId) {
        await fetchTournamentDetails(urlTournamentId);
      }
      if (urlTab === "rules_templates") {
        await fetchRulesTemplates("all");
      }
      if (urlTab === "participants") {
        await fetchParticipants();
      }
      if (urlTab === "teams") {
        await fetchTeams();
      }
      // Also fetch in background
      fetchParticipants();
      fetchTeams();
      setLoading(false);
    }
    init();

    // Background interval to keep agent status fresh in real-time
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/clubs/${clubId}/cs2/status`);
        if (res.ok) {
          const data = await res.json();
          if (data.agent) {
            setDashmatchAgent(data.agent);
          }
        }
      } catch (e) {
        // ignore background poll error
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [clubId, urlTournamentId, urlTab, fetchParticipants]);

  const handleDeleteTournament = async () => {
    if (!activeTournament) return;
    if (
      !confirm(
        `Вы действительно хотите удалить турнир "${activeTournament.name}"? Это действие необратимо и удалит все связанные матчи, регистрации и выплаты.`
      )
    )
      return;

    try {
      const res = await fetch(`/api/clubs/${clubId}/tournaments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete",
          id: activeTournament.id,
        }),
      });

      if (res.ok) {
        setActiveTournament(null);
        updateUrl({ id: null, tab: null });
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
    if (!activeTournament) return;
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

  const handleTogglePlayerPayment = async (
    competitorId: string,
    playerId: string,
    paid: boolean
  ) => {
    if (!activeTournament) return;
    try {
      const res = await fetch(`/api/clubs/${clubId}/tournaments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggle_player_payment",
          id: activeTournament.id,
          competitorId,
          playerId,
          paid,
        }),
      });
      if (res.ok) {
        await fetchTournamentDetails(activeTournament.id);
      } else {
        const errData = await res.json();
        alert(errData.error || "Ошибка при изменении статуса оплаты");
      }
    } catch (err) {
      console.error(err);
      alert("Ошибка сети при изменении статуса оплаты");
    }
  };

  const handleDeleteCompetitor = async (competitorId: string) => {
    if (!activeTournament) return;
    if (
      !confirm(
        "Вы уверены, что хотите удалить этого участника? Регистрация будет аннулирована."
      )
    )
      return;
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
    if (!activeTournament) return;
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

  const handleGenerateBots = async (count?: number) => {
    if (!activeTournament) return;
    setIsGeneratingBots(true);
    try {
      const res = await fetch(`/api/clubs/${clubId}/tournaments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate_bots",
          id: activeTournament.id,
          count: count || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        await fetchTournamentDetails(activeTournament.id);
        await fetchTournamentsList();
      } else {
        alert(data.error || "Ошибка при генерации ботов");
      }
    } catch (err) {
      console.error(err);
      alert("Ошибка сети при генерации ботов");
    } finally {
      setIsGeneratingBots(false);
    }
  };

  const handleClearBots = async () => {
    if (!activeTournament) return;
    if (!confirm("Удалить всех тестовых ботов из этого турнира?")) return;
    try {
      const res = await fetch(`/api/clubs/${clubId}/tournaments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "clear_bots",
          id: activeTournament.id,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        await fetchTournamentDetails(activeTournament.id);
        await fetchTournamentsList();
      } else {
        alert(data.error || "Не удалось удалить ботов");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSimulateMatches = async () => {
    if (!activeTournament) return;
    setIsSimulatingMatches(true);
    try {
      const res = await fetch(`/api/clubs/${clubId}/tournaments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "simulate_matches",
          id: activeTournament.id,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        await fetchTournamentDetails(activeTournament.id);
      } else {
        alert(data.error || "Не удалось смоделировать матчи");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSimulatingMatches(false);
    }
  };

  const handleStartTournament = async (forceIncludeAllUnpaid = false) => {
    if (!activeTournament) return;
    const mainComps = competitors.filter(
      (c) => c.payment_status !== "RESERVE"
    );
    const unpaidComps = mainComps.filter(
      (c) => c.payment_status === "PENDING_PAYMENT"
    );
    const paidComps = mainComps.filter((c) => c.payment_status === "PAID");

    if (unpaidComps.length > 0 && !forceIncludeAllUnpaid) {
      setUnpaidPromptModal({ unpaidList: unpaidComps, paidList: paidComps });
      return;
    }

    const effectiveCount =
      paidComps.length + (forceIncludeAllUnpaid ? unpaidComps.length : 0);
    if (effectiveCount < 2) {
      alert("Для старта турнира требуется минимум 2 участника!");
      return;
    }

    try {
      const res = await fetch(`/api/clubs/${clubId}/tournaments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start",
          id: activeTournament.id,
          includeAllUnpaid: forceIncludeAllUnpaid,
        }),
      });
      if (res.ok) {
        setUnpaidPromptModal(null);
        await fetchTournamentDetails(activeTournament.id);
        await fetchTournamentsList();
      } else {
        const data = await res.json();
        alert(data.error || "Ошибка старта турнира");
      }
    } catch (err) {
      console.error(err);
      alert("Ошибка сети при старте турнира");
    }
  };

  const handlePublishTournament = async () => {
    if (!activeTournament) return;
    try {
      const res = await fetch(`/api/clubs/${clubId}/tournaments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "publish",
          id: activeTournament.id,
        }),
      });
      if (res.ok) {
        await fetchTournamentDetails(activeTournament.id);
        await fetchTournamentsList();
      } else {
        const data = await res.json();
        alert(data.error || "Не удалось открыть регистрацию");
      }
    } catch (err) {
      console.error(err);
      alert("Ошибка сети");
    }
  };

  const handleRevertToDraft = async () => {
    if (!activeTournament) return;
    if (!confirm("Перевести турнир обратно в черновик? Игроки в промо-панели перестанут его видеть.")) return;
    try {
      const res = await fetch(`/api/clubs/${clubId}/tournaments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "revert_to_draft",
          id: activeTournament.id,
        }),
      });
      if (res.ok) {
        await fetchTournamentDetails(activeTournament.id);
        await fetchTournamentsList();
      } else {
        const data = await res.json();
        alert(data.error || "Не удалось перевести турнир в черновик");
      }
    } catch (err) {
      console.error(err);
      alert("Ошибка сети");
    }
  };

  const handleRebuildBracket = async () => {
    if (!activeTournament) return;
    setIsRebuildingBracket(true);
    try {
      const res = await fetch(`/api/clubs/${clubId}/tournaments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "rebuild_bracket",
          id: activeTournament.id,
          bracketType: rebuildBracketType,
          includeAllUnpaid: rebuildIncludeUnpaid,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setShowRebuildModal(false);
        await fetchTournamentDetails(activeTournament.id);
        await fetchTournamentsList();
        alert("Сетка турнира успешно пересобрана!");
      } else {
        alert(data.error || "Не удалось пересобрать сетку");
      }
    } catch (err) {
      console.error(err);
      alert("Ошибка сети при пересборке сетки");
    } finally {
      setIsRebuildingBracket(false);
    }
  };

  const handleConfirmPayout = async (
    competitorId: string,
    cashAmount: number,
    bonusAmount: number,
    itemDetails: string,
    slotUniqueName: string
  ) => {
    if (!activeTournament) return;
    const combinedItemDetails = itemDetails
      ? `${itemDetails} (${slotUniqueName})`
      : `(${slotUniqueName})`;

    if (
      !confirm(
        `Выплатить призовые: Наличные: ${cashAmount} ₽, Бонусы: ${bonusAmount} Б, Предметы: ${combinedItemDetails}?`
      )
    )
      return;

    try {
      const res = await fetch(`/api/clubs/${clubId}/tournaments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "payout",
          tournamentId: activeTournament.id,
          competitorId,
          amount: cashAmount,
          prizeType: "combined",
          bonusAmount: bonusAmount,
          itemDetails: combinedItemDetails,
        }),
      });
      if (res.ok) {
        await fetchTournamentDetails(activeTournament.id);
      }
    } catch (err) {
      console.error(err);
    }
  };

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
      const actionType = isEdit
        ? "update_rules_template"
        : "create_rules_template";

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
        alert(
          isEdit
            ? "Шаблон правил успешно обновлен!"
            : "Шаблон правил успешно создан!"
        );
        setShowTemplateModal(false);
        setTemplateFormId(null);
        setTemplateFormName("");
        setTemplateFormRules("");
        await fetchRulesTemplates(
          mainTab === "rules_templates" ? "all" : "cs2"
        );
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
        await fetchRulesTemplates(
          mainTab === "rules_templates" ? "all" : "cs2"
        );
      } else {
        alert("Не удалось удалить шаблон");
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#FAFAFA] flex-col font-sans text-slate-900 selection:bg-black/10">
      <main className="mx-auto max-w-6xl w-full flex-1 px-4 sm:px-6 md:px-8 py-8 sm:py-12 md:py-16">
        {/* 1. ROOT TOURNAMENTS LIST VIEW (When no active tournament is open) */}
        {!activeTournament && (
          <>
            <TournamentHeader
              clubId={clubId}
              activeTournament={null}
              onBack={() => {}}
              onDelete={() => {}}
            />

            {/* Root Main Tabs */}
            <div className="flex bg-white p-1.5 sm:p-2 rounded-2xl border border-slate-200 shadow-xs gap-1 sm:gap-2 mb-8 overflow-x-auto">
              <button
                onClick={() => {
                  setMainTab("tournaments");
                  updateUrl({ tab: null, id: null });
                }}
                className={cn(
                  "px-4 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all shrink-0 cursor-pointer flex items-center gap-2 whitespace-nowrap",
                  mainTab === "tournaments"
                    ? "bg-slate-900 text-white shadow-xs font-semibold"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                )}
              >
                <span>Список турниров</span>
                {tournaments.length > 0 && (
                  <span
                    className={cn(
                      "text-[10px] font-mono px-2 py-0.5 rounded-md font-bold",
                      mainTab === "tournaments"
                        ? "bg-white/20 text-white"
                        : "bg-slate-100 text-slate-600"
                    )}
                  >
                    {tournaments.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => {
                  setMainTab("participants");
                  fetchParticipants();
                  updateUrl({ tab: "participants", id: null });
                }}
                className={cn(
                  "px-4 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all shrink-0 cursor-pointer flex items-center gap-2 whitespace-nowrap",
                  mainTab === "participants"
                    ? "bg-slate-900 text-white shadow-xs font-semibold"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                )}
              >
                <span>Участники</span>
                {participants.length > 0 && (
                  <span
                    className={cn(
                      "text-[10px] font-mono px-2 py-0.5 rounded-md font-bold",
                      mainTab === "participants"
                        ? "bg-white/20 text-white"
                        : "bg-slate-100 text-slate-600"
                    )}
                  >
                    {participants.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => {
                  setMainTab("teams");
                  fetchTeams();
                  updateUrl({ tab: "teams", id: null });
                }}
                className={cn(
                  "px-4 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all shrink-0 cursor-pointer flex items-center gap-2 whitespace-nowrap",
                  mainTab === "teams"
                    ? "bg-slate-900 text-white shadow-xs font-semibold"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                )}
              >
                <span>Команды</span>
                {teams.length > 0 && (
                  <span
                    className={cn(
                      "text-[10px] font-mono px-2 py-0.5 rounded-md font-bold",
                      mainTab === "teams"
                        ? "bg-white/20 text-white"
                        : "bg-slate-100 text-slate-600"
                    )}
                  >
                    {teams.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => {
                  setMainTab("rules_templates");
                  fetchRulesTemplates("all");
                  updateUrl({ tab: "rules_templates", id: null });
                }}
                className={cn(
                  "px-4 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all shrink-0 cursor-pointer flex items-center gap-2 whitespace-nowrap",
                  mainTab === "rules_templates"
                    ? "bg-slate-900 text-white shadow-xs font-semibold"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                )}
              >
                <span>Шаблоны регламента</span>
                {rulesTemplates.length > 0 && (
                  <span
                    className={cn(
                      "text-[10px] font-mono px-2 py-0.5 rounded-md font-bold",
                      mainTab === "rules_templates"
                        ? "bg-white/20 text-white"
                        : "bg-slate-100 text-slate-600"
                    )}
                  >
                    {rulesTemplates.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => {
                  setMainTab("servers");
                  updateUrl({ tab: "servers", id: null });
                }}
                className={cn(
                  "px-4 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all shrink-0 cursor-pointer flex items-center gap-2 whitespace-nowrap",
                  mainTab === "servers"
                    ? "bg-slate-900 text-white shadow-xs font-semibold"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                )}
              >
                <span>DashMatch</span>
                <span
                  className={cn(
                    "w-2 h-2 rounded-full",
                    dashmatchAgent?.is_online ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                  )}
                />
              </button>

              <button
                onClick={() => {
                  setMainTab("settings");
                  updateUrl({ tab: "settings", id: null });
                }}
                className={cn(
                  "px-4 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all shrink-0 cursor-pointer flex items-center gap-2 whitespace-nowrap",
                  mainTab === "settings"
                    ? "bg-slate-900 text-white shadow-xs font-semibold"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                )}
              >
                <span>Настройки</span>
              </button>
            </div>

          {mainTab === "tournaments" && (
            <TournamentList
              tournaments={tournaments}
              onSelect={(t) => {
                updateUrl({ id: String(t.id), tab: "bracket" });
                setDetailTab("bracket");
                fetchTournamentDetails(t.id);
              }}
            />
          )}

          {mainTab === "participants" && (
            <ParticipantsTab
              clubId={clubId}
              participants={participants}
              isLoading={isLoadingParticipants}
              onAddParticipant={() => {
                setEditingParticipant(null);
                setShowParticipantModal(true);
              }}
              onEditParticipant={(p) => {
                setEditingParticipant(p);
                setShowParticipantModal(true);
              }}
              onDeleteParticipant={handleDeleteParticipant}
            />
          )}

          {mainTab === "teams" && (
            <TeamsTab
              clubId={clubId}
              teams={teams}
              isLoading={isLoadingTeams}
              onAddTeam={() => {
                setEditingTeam(null);
                setShowTeamModal(true);
              }}
              onEditTeam={(t) => {
                setEditingTeam(t);
                setShowTeamModal(true);
              }}
              onDeleteTeam={handleDeleteTeam}
            />
          )}

          {mainTab === "rules_templates" && (
            <RulesTemplatesTab
              templates={rulesTemplates}
              onCreate={() => {
                setTemplateFormId(null);
                setTemplateFormName("");
                setTemplateFormDiscipline("cs2");
                setTemplateFormRules("");
                setShowTemplateModal(true);
              }}
              onEdit={(temp) => {
                setTemplateFormId(temp.id);
                setTemplateFormName(temp.name);
                setTemplateFormDiscipline(temp.discipline);
                setTemplateFormRules(temp.rules_text);
                setShowTemplateModal(true);
              }}
              onDelete={handleDeleteRulesTemplate}
            />
          )}

          {mainTab === "servers" && (
            <DashMatchServerTab clubId={clubId} />
          )}

          {mainTab === "settings" && (
            <TournamentSettingsTab clubId={clubId} />
          )}
        </>
      )}

      {/* 2. TOURNAMENT MANAGEMENT DETAIL VIEW (Tabbed Layout) */}
      {activeTournament && (
        <div className="space-y-8">
          {/* Detail Header & Sub-Tabs Strip */}
          <TournamentDetailHeader
            clubId={clubId}
            tournament={activeTournament}
            competitors={competitors}
            matches={matches}
            payouts={payouts}
            activeTab={detailTab}
            onSelectTab={(tab) => {
              setDetailTab(tab);
              updateUrl({ tab });
            }}
            onBack={() => {
              setActiveTournament(null);
              updateUrl({ id: null, tab: null });
            }}
            onDelete={handleDeleteTournament}
            onStartTournament={() => handleStartTournament(false)}
            onPublish={handlePublishTournament}
            onRevertToDraft={handleRevertToDraft}
            onOpenRebuildModal={() => {
              setRebuildBracketType(
                activeTournament.config?.bracketType || "single_elimination"
              );
              setRebuildIncludeUnpaid(false);
              setShowRebuildModal(true);
            }}
            dashmatchAgent={dashmatchAgent}
          />

          {/* TAB 1: Сетка и Матчи */}
          {detailTab === "bracket" && (
            <TournamentBracket
              clubId={clubId}
              tournament={activeTournament}
              matches={matches}
              competitors={competitors}
              onOpenMatchModal={(m) => setShowMatchModal(m)}
              onStartTournament={() => handleStartTournament(false)}
              onPublishTournament={handlePublishTournament}
              onOpenRebuildModal={() => {
                setRebuildBracketType(
                  activeTournament.config?.bracketType || "single_elimination"
                );
                setRebuildIncludeUnpaid(false);
                setShowRebuildModal(true);
              }}
              onSimulateMatches={handleSimulateMatches}
              isSimulatingMatches={isSimulatingMatches}
              dashmatchAgent={dashmatchAgent}
              activeCs2Matches={activeCs2Matches}
            />
          )}

          {/* TAB 2: Участники и Взносы */}
          {detailTab === "competitors" && (
            <CompetitorsList
              tournament={activeTournament}
              competitors={competitors}
              onConfirmPayment={handleConfirmPayment}
              onTogglePlayerPayment={handleTogglePlayerPayment}
              onPromoteCompetitor={handlePromoteCompetitor}
              onDeleteCompetitor={handleDeleteCompetitor}
              onGenerateBots={handleGenerateBots}
              onClearBots={handleClearBots}
              isGeneratingBots={isGeneratingBots}
            />
          )}

          {/* TAB 3: Призовой фонд и Выплаты */}
          {detailTab === "prizes" && (
            <PrizePoolLedger
              tournament={activeTournament}
              competitors={competitors}
              payouts={payouts}
              onConfirmPayout={handleConfirmPayout}
            />
          )}

          {/* TAB 4: Регламент и Настройки */}
          {detailTab === "info" && (
            <TournamentInfoTab
              clubId={clubId}
              tournament={activeTournament}
              onDelete={handleDeleteTournament}
            />
          )}
        </div>
      )}

      {/* RULES TEMPLATE MODAL */}
      <RulesTemplateModal
        isOpen={showTemplateModal}
        onClose={() => setShowTemplateModal(false)}
        templateId={templateFormId}
        name={templateFormName}
        setName={setTemplateFormName}
        discipline={templateFormDiscipline}
        setDiscipline={setTemplateFormDiscipline}
        rules={templateFormRules}
        setRules={setTemplateFormRules}
        onSubmit={handleSaveOrUpdateRulesTemplate}
        isSubmitting={isSubmittingTemplate}
      />

      {/* PARTICIPANT MODAL */}
      <ParticipantModal
        isOpen={showParticipantModal}
        participant={editingParticipant}
        onClose={() => {
          setShowParticipantModal(false);
          setEditingParticipant(null);
        }}
        onSave={handleSaveParticipant}
        onDelete={handleDeleteParticipant}
      />

      {/* TEAM MODAL */}
      <TeamModal
        isOpen={showTeamModal}
        team={editingTeam}
        participants={participants}
        onClose={() => {
          setShowTeamModal(false);
          setEditingTeam(null);
        }}
        onSave={handleSaveTeam}
        onDelete={handleDeleteTeam}
        onRequestRename={handleRequestRenameTeam}
        onCancelRename={handleCancelRenameTeam}
      />

      {/* UNPAID PARTICIPANTS START PROMPT MODAL */}
      {unpaidPromptModal && (
        <UnpaidPromptModal
          isOpen={!!unpaidPromptModal}
          onClose={() => setUnpaidPromptModal(null)}
          unpaidList={unpaidPromptModal.unpaidList}
          paidList={unpaidPromptModal.paidList}
          onConfirmAndStartAll={async () => {
            await handleStartTournament(true);
          }}
          onStartPaidOnly={async () => {
            if (!activeTournament) return;
            if (
              confirm(
                `Запустить турнир только с оплатившими (${unpaidPromptModal.paidList.length} участников)? Неоплатившие заявки не попадут в турнирную сетку.`
              )
            ) {
              setUnpaidPromptModal(null);
              try {
                const res = await fetch(`/api/clubs/${clubId}/tournaments`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    action: "start",
                    id: activeTournament.id,
                    includeAllUnpaid: false,
                  }),
                });
                if (res.ok) {
                  await fetchTournamentDetails(activeTournament.id);
                  await fetchTournamentsList();
                } else {
                  const data = await res.json();
                  alert(data.error || "Ошибка старта турнира");
                }
              } catch (err) {
                console.error(err);
              }
            }
          }}
        />
      )}

      {/* REBUILD BRACKET MODAL */}
      <RebuildBracketModal
        isOpen={showRebuildModal}
        onClose={() => setShowRebuildModal(false)}
        bracketType={rebuildBracketType}
        setBracketType={setRebuildBracketType}
        includeUnpaid={rebuildIncludeUnpaid}
        setIncludeUnpaid={setRebuildIncludeUnpaid}
        onRebuild={handleRebuildBracket}
        isRebuilding={isRebuildingBracket}
        competitors={competitors}
      />

      {/* MATCH CONTROL MODAL */}
      {showMatchModal && activeTournament && (
        <MatchControlModal
          isOpen={!!showMatchModal}
          onClose={() => setShowMatchModal(null)}
          match={showMatchModal}
          tournament={activeTournament}
          competitors={competitors}
          clubId={clubId}
          onRefreshTournament={async () => {
            if (activeTournament) {
              await fetchTournamentDetails(activeTournament.id);
            }
          }}
          dashmatchAgent={dashmatchAgent}
          activeCs2Matches={activeCs2Matches}
        />
      )}
      </main>
    </div>
  );
}

