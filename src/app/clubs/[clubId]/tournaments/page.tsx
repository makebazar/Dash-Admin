"use client";
import React from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

import {
  Tournament,
  Competitor,
  Match,
  Payout,
  RulesTemplate,
  DashMatchAgentInfo,
  ActiveCs2MatchInfo,
} from "./types";
import { TournamentHeader } from "./components/TournamentHeader";
import { TournamentList } from "./components/TournamentList";
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

  // Rules Templates states
  const [rulesTemplates, setRulesTemplates] = React.useState<RulesTemplate[]>(
    []
  );
  const [mainTab, setMainTab] = React.useState<
    "tournaments" | "rules_templates" | "servers"
  >(
    urlTab === "rules_templates"
      ? "rules_templates"
      : urlTab === "servers"
      ? "servers"
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
      setLoading(false);
    }
    init();
  }, [clubId, urlTournamentId, urlTab]);

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
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-slate-900 p-4 sm:p-8 space-y-8">
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
          <div className="flex gap-6 border-b border-slate-200 mb-8 overflow-x-auto">
            <button
              onClick={() => {
                setMainTab("tournaments");
                updateUrl({ tab: null, id: null });
              }}
              className={cn(
                "text-xs font-black uppercase tracking-widest pb-4 px-1 transition-all border-b-2 -mb-px cursor-pointer shrink-0",
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
                updateUrl({ tab: "rules_templates", id: null });
              }}
              className={cn(
                "text-xs font-black uppercase tracking-widest pb-4 px-1 transition-all border-b-2 -mb-px cursor-pointer shrink-0",
                mainTab === "rules_templates"
                  ? "border-orange-500 text-orange-500"
                  : "border-transparent text-slate-400 hover:text-slate-600"
              )}
            >
              Шаблоны регламента
            </button>
            <button
              onClick={() => {
                setMainTab("servers");
                updateUrl({ tab: "servers", id: null });
              }}
              className={cn(
                "text-xs font-black uppercase tracking-widest pb-4 px-1 transition-all border-b-2 -mb-px cursor-pointer shrink-0 flex items-center gap-2",
                mainTab === "servers"
                  ? "border-orange-500 text-orange-500"
                  : "border-transparent text-slate-400 hover:text-slate-600"
              )}
            >
              <span>Серверный агент DashMatch</span>
              <span
                className={cn(
                  "w-2 h-2 rounded-full",
                  dashmatchAgent?.is_online ? "bg-emerald-500" : "bg-amber-500"
                )}
              />
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
              tournament={activeTournament}
              matches={matches}
              competitors={competitors}
              onOpenMatchModal={(m) => setShowMatchModal(m)}
              onStartTournament={() => handleStartTournament(false)}
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
    </div>
  );
}
