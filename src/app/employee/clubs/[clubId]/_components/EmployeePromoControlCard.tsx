"use client";

import {
  useCallback,
  useEffect,
  useState,
  useTransition,
  useMemo,
} from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Gift,
  Copy,
  CheckCircle2,
  Loader2,
  User,
  X,
  Wallet,
  Search,
  Keyboard,
  Banknote,
  CreditCard,
  Ticket,
} from "lucide-react";
import { useSSE } from "@/hooks/use-pos-web-socket";
import {
  getPromoQueue,
  claimPromoItemSafe,
  getClubPromoSettings,
  bulkAccruePromoSafe,
  getRecentPromoAccruals,
  voidPromoAccrualSafe,
  getPendingQuestVerifications,
  verifyQuestSafe,
} from "@/app/clubs/[clubId]/inventory/actions";
import { normalizePhone } from "@/lib/phone-utils";
import { cn } from "@/lib/utils";
import { useUiDialogs } from "@/app/clubs/[clubId]/inventory/_components/useUiDialogs";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

export function EmployeePromoControlCard({
  clubId,
  userId,
  clubCode,
  enabled,
  timezone = "Europe/Moscow",
}: {
  clubId: string;
  userId: string;
  clubCode?: string;
  enabled: boolean;
  timezone?: string;
}) {
  const [promoQueue, setPromoQueue] = useState<any[]>([]);
  const [recentAccruals, setRecentAccruals] = useState<any[]>([]);
  const [checkedInPlayers, setCheckedInPlayers] = useState<any[]>([]);
  const [promoSettings, setPromoSettings] = useState<any>({});
  const [questRequests, setQuestRequests] = useState<any[]>([]);

  // ... (activeServiceRules unchanged)

  const activeServiceRules = useMemo(() => {
    const rules = promoSettings.service_rules || [];
    if (rules.length === 0) return [];

    // Get current time in club's timezone
    let clubTime: { day: number; time: number } | null = null;
    try {
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        hour: "numeric",
        minute: "numeric",
        hour12: false,
        weekday: "short",
      });
      const parts = formatter.formatToParts(new Date());
      const hour = parseInt(parts.find((p) => p.type === "hour")?.value || "0");
      const minute = parseInt(
        parts.find((p) => p.type === "minute")?.value || "0",
      );
      const weekdayStr = parts.find((p) => p.type === "weekday")?.value;
      const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      clubTime = {
        day: weekdays.indexOf(weekdayStr || ""),
        time: hour * 100 + minute,
      };
    } catch (e) {
      console.error("Failed to calculate club time", e);
    }

    return rules
      .filter((rule: any) => rule.is_active)
      .map((rule: any) => {
        if (!clubTime) return { ...rule, is_matching_schedule: true };

        const isDayMatch = rule.days.includes(clubTime.day);
        const [startH, startM] = rule.time_start.split(":").map(Number);
        const [endH, endM] = rule.time_end.split(":").map(Number);
        const startTime = startH * 100 + startM;
        const endTime = endH * 100 + endM;

        let isTimeMatch = false;
        if (startTime <= endTime) {
          isTimeMatch = clubTime.time >= startTime && clubTime.time <= endTime;
        } else {
          isTimeMatch = clubTime.time >= startTime || clubTime.time <= endTime;
        }

        return {
          ...rule,
          is_matching_schedule: isDayMatch && isTimeMatch,
        };
      })
      .sort((a: any, b: any) => {
        if (a.is_matching_schedule && !b.is_matching_schedule) return -1;
        if (!a.is_matching_schedule && b.is_matching_schedule) return 1;
        return 0;
      });
  }, [promoSettings.service_rules, timezone]);

  // Unified Dialog State
  const [isAccrualDialogOpen, setIsAccrualDialogOpen] = useState(false);
  const [accrualPlayer, setAccrualPlayer] = useState<any>(null);
  const [accrualTopupAmount, setAccrualTopupAmount] = useState("");
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [isAccruing, setIsAccruing] = useState(false);

  // Search State
  const [promoSearchQuery, setPromoSearchQuery] = useState("");
  const [promoSearchResults, setPromoSearchResults] = useState<any[]>([]);
  const [isSearchingPromo, setIsSearchingPromo] = useState(false);

  // UI helpers
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const { confirmAction, showMessage, Dialogs } = useUiDialogs();

  const refresh = useCallback(async () => {
    if (!enabled || !clubId) return;
    try {
      const [queue, settings, history, verifications] = await Promise.all([
        getPromoQueue(clubId, userId),
        getClubPromoSettings(clubId, userId),
        getRecentPromoAccruals(clubId),
        getPendingQuestVerifications(clubId, userId),
      ]);
      setPromoQueue(queue);
      setPromoSettings(settings);
      setRecentAccruals(history);
      setQuestRequests(verifications);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [clubId, enabled, userId]);

  // Web socket handling
  const handleWebSocketMessage = useCallback(
    (message: any) => {
      if (message.type === "PROMO_QUEUE_UPDATED") {
        refresh();
      }

      if (message.type === "PLAYER_CHECKIN" && message.player) {
        if (message.player.intent && message.player.intent !== "topup") return;

        setCheckedInPlayers((prev) => {
          const filtered = prev.filter((p) => p.id !== message.player.id);
          return [
            { ...message.player, timestamp: Date.now() },
            ...filtered,
          ].slice(0, 5);
        });

        if (isAccrualDialogOpen && !accrualPlayer) {
          setAccrualPlayer(message.player);
        }

        showMessage({
          title: "🔔 Гость подошел",
          description: `${message.player.full_name} сканировал QR`,
        });
      }
    },
    [isAccrualDialogOpen, accrualPlayer, refresh, showMessage],
  );

  useSSE(handleWebSocketMessage);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Load from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(`checkedInPlayers_${clubId}`);
      if (saved) {
        try {
          setCheckedInPlayers(JSON.parse(saved));
        } catch (e) {
          console.error(
            "Failed to parse checkedInPlayers from localStorage",
            e,
          );
        }
      }
    }
  }, [clubId]);

  // Save to localStorage when checkedInPlayers changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(
        `checkedInPlayers_${clubId}`,
        JSON.stringify(checkedInPlayers),
      );
    }
  }, [checkedInPlayers, clubId]);

  const handleClaimItem = async (itemId: number, label: string) => {
    const ok = await confirmAction({
      title: "Выдача",
      description: `Подтвердите выдачу: ${label}`,
      confirmText: "Выдано",
      cancelText: "Отмена",
    });
    if (!ok) return;

    startTransition(async () => {
      const res = await claimPromoItemSafe(clubId, userId, itemId);
      if (res.ok) {
        showMessage({ title: "Успешно", description: "Статус обновлен" });
        refresh();
      } else {
        showMessage({ title: "Ошибка", description: res.error });
      }
    });
  };

  const handleBulkAccrue = async () => {
    if (!accrualPlayer) return;
    const topupAmount = Number(accrualTopupAmount) || 0;
    if (topupAmount <= 0 && selectedServiceIds.length === 0) return;

    setIsAccruing(true);
    try {
      const res = await bulkAccruePromoSafe(clubId, userId, {
        player_id: accrualPlayer.id,
        topup_amount: topupAmount,
        service_rule_ids: selectedServiceIds,
      });

      if (res.ok) {
        showMessage({
          title: "✅ Начислено",
          description: "Операции успешно выполнены",
        });
        setIsAccrualDialogOpen(false);
        setAccrualPlayer(null);
        setAccrualTopupAmount("");
        setSelectedServiceIds([]);
        refresh();
      } else {
        showMessage({ title: "Ошибка", description: res.error });
      }
    } catch (e) {
      showMessage({
        title: "Ошибка",
        description: "Не удалось выполнить начисление",
      });
    } finally {
      setIsAccruing(false);
    }
  };

  const handleVoidAccrual = async (historyId: string, label: string) => {
    const ok = await confirmAction({
      title: "Аннулирование",
      description: `Вы уверены, что хотите отменить начисление: ${label}? Это действие удалит выданные билеты.`,
      confirmText: "Да, отменить",
      cancelText: "Нет",
    });
    if (!ok) return;

    startTransition(async () => {
      const res = await voidPromoAccrualSafe(clubId, userId, historyId);
      if (res.ok) {
        showMessage({ title: "Отменено", description: "Запись аннулирована" });
        refresh();
      } else {
        showMessage({ title: "Ошибка", description: res.error });
      }
    });
  };

  const [processingQuest, setProcessingQuest] = useState<string | null>(null);
  const handleVerifyQuest = async (
    requestId: string,
    action: "approve" | "reject",
    questTitle: string,
  ) => {
    const ok = await confirmAction({
      title: action === "approve" ? "Подтверждение" : "Отклонение",
      description: `${action === "approve" ? "Подтвердить" : "Отклонить"} выполнение задания: ${questTitle}?`,
      confirmText: action === "approve" ? "Да, подтверждаю" : "Да, отклонить",
      cancelText: "Отмена",
    });
    if (!ok) return;

    setProcessingQuest(requestId);
    try {
      const res = await verifyQuestSafe(clubId, userId, requestId, action);
      if (res.ok) {
        showMessage({ title: "Успешно", description: "Задание обработано" });
        refresh();
      } else {
        showMessage({
          title: "Ошибка",
          description: res.error || "Не удалось обработать запрос",
        });
      }
    } catch (e) {
      showMessage({ title: "Ошибка", description: "Ошибка сети" });
    } finally {
      setProcessingQuest(null);
    }
  };

  const searchPlayersByPhone = async (phone: string) => {
    if (phone.length < 4) {
      setPromoSearchResults([]);
      return;
    }
    setIsSearchingPromo(true);
    try {
      const res = await fetch(
        `/api/promo/admin/players?clubId=${clubId}&phone=${phone}`,
      );
      const data = await res.json();
      setPromoSearchResults(data.players || []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearchingPromo(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showMessage({ title: "Скопировано", description: `${label}: ${text}` });
  };

  if (!enabled) return null;

  return (
    <Card className="overflow-hidden border-border bg-card shadow-none">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <Ticket className="w-4 h-4 text-orange-500" />
            Лояльность
          </h2>
          <div className="flex items-center gap-2">
            {clubCode && (
              <div
                onClick={() => copyToClipboard(clubCode, "Код клуба")}
                className="group cursor-pointer flex items-center gap-1.5 px-2.5 h-8 bg-zinc-100 dark:bg-zinc-800 border border-border rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700"
                title="Нажмите, чтобы скопировать код для входа"
              >
                <span className="text-[10px] font-black uppercase tracking-tighter text-muted-foreground group-hover:text-foreground">
                  Код:
                </span>
                <span className="text-[11px] font-black text-foreground">
                  {clubCode}
                </span>
                <Copy className="w-3 h-3 text-muted-foreground opacity-50 group-hover:opacity-100" />
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-xl bg-orange-500/10 border-orange-500/20 text-orange-500 hover:bg-orange-500/20 text-[10px] font-black uppercase shadow-none"
              onClick={() => setIsAccrualDialogOpen(true)}
            >
              <Wallet className="w-3.5 h-3.5 mr-2" />
              Начислить
            </Button>
          </div>
        </div>

        {/* Checked-in Players */}
        {checkedInPlayers.length > 0 && (
          <div className="space-y-2">
            <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-1">
              Недавние чекины
            </div>
            <div className="flex flex-wrap gap-2">
              {checkedInPlayers.map((p) => (
                <div key={p.id} className="group relative">
                  <button
                    onClick={() => {
                      setAccrualPlayer(p);
                      setIsAccrualDialogOpen(true);
                    }}
                    className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-xl text-[10px] font-bold border border-border flex items-center gap-2"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    {p.full_name}
                  </button>
                  <button
                    onClick={() =>
                      setCheckedInPlayers((prev) =>
                        prev.filter((item) => item.id !== p.id),
                      )
                    }
                    className="absolute -top-1 -right-1 w-4 h-4 bg-zinc-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quest Verifications */}
        {questRequests.length > 0 && (
          <div className="space-y-3">
            <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-2">
              <CheckCircle2 className="w-3 h-3 text-orange-500" />
              Проверка заданий ({questRequests.length})
            </div>
            <div className="space-y-2">
              {questRequests.map((req) => (
                <div
                  key={req.id}
                  className="p-3 rounded-2xl border border-orange-500/20 bg-orange-500/5 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-bold text-xs text-orange-600 dark:text-orange-400 truncate">
                        {req.quest_title}
                      </div>
                      <div className="text-[10px] font-bold text-foreground mt-0.5">
                        {req.player_name || "Гость"}
                      </div>
                    </div>
                    {req.verification_photo_url && (
                      <div
                        className="w-10 h-10 rounded-lg overflow-hidden border border-border cursor-pointer hover:scale-110 transition-transform"
                        onClick={() =>
                          window.open(req.verification_photo_url, "_blank")
                        }
                      >
                        <img
                          src={req.verification_photo_url}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={() =>
                        handleVerifyQuest(req.id, "approve", req.quest_title)
                      }
                      disabled={!!processingQuest}
                      className="flex-1 h-8 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold text-[10px] shadow-none"
                    >
                      {processingQuest === req.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        "ОДОБРИТЬ"
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() =>
                        handleVerifyQuest(req.id, "reject", req.quest_title)
                      }
                      disabled={!!processingQuest}
                      className="h-8 w-8 p-0 rounded-xl text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 shadow-none"
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Promo Queue */}
        {promoQueue.length > 0 && (
          <div className="space-y-3">
            <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-1">
              Очередь выдачи
            </div>
            {promoQueue.map((item) => (
              <div
                key={item.id}
                className="p-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-xs text-emerald-600 dark:text-emerald-400 truncate">
                      {item.prize_name}
                    </div>
                    <div className="text-[10px] font-bold text-foreground mt-0.5">
                      {item.player_name}
                    </div>
                  </div>
                  <Badge className="bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[8px] uppercase font-black px-1.5 h-4">
                    Ожидает
                  </Badge>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() =>
                      copyToClipboard(
                        normalizePhone(item.player_phone),
                        "Телефон",
                      )
                    }
                    className="flex items-center gap-1.5 px-2 py-1 bg-background hover:bg-muted rounded-lg text-[9px] font-bold border border-border"
                  >
                    <Copy className="w-2.5 h-2.5" />
                    {normalizePhone(item.player_phone)}
                  </button>
                  {item.withdraw_amount > 0 && (
                    <button
                      onClick={() =>
                        copyToClipboard(String(item.withdraw_amount), "Сумма")
                      }
                      className="flex items-center gap-1.5 px-2 py-1 bg-background hover:bg-muted rounded-lg text-[9px] font-bold border border-border"
                    >
                      <Copy className="w-2.5 h-2.5" />
                      {item.withdraw_amount} ₽
                    </button>
                  )}
                </div>

                <Button
                  onClick={() => handleClaimItem(item.id, item.prize_name)}
                  disabled={isPending}
                  className="w-full h-8 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold text-[10px] shadow-none"
                >
                  {isPending ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="w-3 h-3 mr-2" />
                      ПОДТВЕРДИТЬ ВЫДАЧУ
                    </>
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Recent Accruals */}
        {recentAccruals.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-border">
            <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-1">
              Последние начисления
            </div>
            <div className="space-y-1 max-h-55 overflow-y-auto pr-1 custom-scrollbar">
              {recentAccruals.map((h) => {
                const isVoided = h.game_type.endsWith("_VOIDED");
                const amount = h.result_data.amount;
                const ruleName = h.result_data.rule_name;
                const label = amount ? `${amount} ₽` : ruleName;

                return (
                  <div
                    key={h.id}
                    className={cn(
                      "flex items-center justify-between p-2 rounded-xl text-[10px] group",
                      isVoided
                        ? "bg-zinc-50 dark:bg-zinc-900/50 opacity-50 grayscale"
                        : "bg-zinc-50/50 dark:bg-zinc-900/30 hover:bg-zinc-100 dark:hover:bg-zinc-800",
                    )}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-foreground truncate">
                          {h.player_name}
                        </span>
                        {!isVoided && (
                          <span className="text-[8px] px-1 bg-orange-500/10 text-orange-500 rounded font-black">
                            +{h.total_tickets}
                          </span>
                        )}
                      </div>
                      <div className="text-[9px] text-muted-foreground flex items-center gap-1 mt-0.5">
                        <span className="font-medium">{label}</span>
                        <span>•</span>
                        <span>
                          {format(new Date(h.created_at), "HH:mm", {
                            locale: ru,
                          })}
                        </span>
                      </div>
                    </div>
                    {!isVoided && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 rounded-lg opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500 shadow-none"
                        onClick={() => handleVoidAccrual(h.id, label)}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Unified Accrual Cart Dialog */}
        <Dialog
          open={isAccrualDialogOpen}
          onOpenChange={(open) => {
            setIsAccrualDialogOpen(open);
            if (!open) {
              setAccrualPlayer(null);
              setAccrualTopupAmount("");
              setSelectedServiceIds([]);
            }
          }}
        >
          <DialogContent className="bg-zinc-950 border-zinc-800 sm:max-w-2xl rounded-3xl p-0 overflow-hidden text-white flex flex-col max-h-[90vh] shadow-none">
            <DialogHeader className="p-6 border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-500/20 rounded-xl flex items-center justify-center">
                  <Wallet className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-black uppercase italic tracking-tight">
                    Центр <span className="text-orange-500">Начислений</span>
                  </DialogTitle>
                  <DialogDescription className="text-zinc-500 text-xs">
                    Пополнение баланса и выдача билетов за услуги
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
              {!accrualPlayer ? (
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={promoSearchQuery}
                      onChange={(e) => {
                        setPromoSearchQuery(e.target.value);
                        searchPlayersByPhone(e.target.value);
                      }}
                      placeholder="Поиск по телефону или QR..."
                      className="h-12 pl-10 bg-zinc-900 border-zinc-800 rounded-xl text-white shadow-none"
                      autoFocus
                    />
                    {isSearchingPromo && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  {promoSearchResults.length > 0 && (
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-none">
                      {promoSearchResults.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => {
                            setAccrualPlayer(p);
                            setPromoSearchQuery("");
                            setPromoSearchResults([]);
                          }}
                          className="w-full text-left px-4 py-3 hover:bg-zinc-800 flex items-center justify-between border-b border-zinc-800/50 last:border-0"
                        >
                          <div className="min-w-0">
                            <div className="font-bold text-sm truncate">
                              {p.full_name}
                            </div>
                            <div className="text-[10px] text-zinc-500 font-mono">
                              {p.phone_number}
                            </div>
                          </div>
                          <div className="text-orange-500 font-black text-xs">
                            {Math.floor(p.bonus_balance || 0)} ₽
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-8">
                  {/* Selected Player Card */}
                  <div className="flex items-center justify-between bg-zinc-900 border border-zinc-800 p-4 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center">
                        <User className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <div className="font-bold text-sm">
                          {accrualPlayer.full_name}
                        </div>
                        <div className="text-[10px] text-zinc-500 font-mono">
                          {accrualPlayer.phone_number}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 rounded-lg text-zinc-400 hover:text-white shadow-none"
                      onClick={() => setAccrualPlayer(null)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Top-up Section */}
                  <div className="space-y-4">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                      <Banknote className="w-3 h-3" /> Пополнение баланса (₽)
                    </Label>
                    <div className="grid grid-cols-4 gap-2">
                      {[500, 1000, 2000, 5000].map((val) => (
                        <button
                          key={val}
                          onClick={() => setAccrualTopupAmount(String(val))}
                          className={cn(
                            "py-2 rounded-xl border text-xs font-black",
                            Number(accrualTopupAmount) === val
                              ? "bg-orange-500 border-orange-500 text-white"
                              : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700",
                          )}
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                    <Input
                      type="number"
                      value={accrualTopupAmount}
                      onChange={(e) => setAccrualTopupAmount(e.target.value)}
                      placeholder="Введите сумму..."
                      className="h-14 bg-zinc-900 border-zinc-800 rounded-2xl text-2xl font-black text-center text-orange-500 shadow-none"
                    />
                  </div>

                  {/* Services Section */}
                  <div className="space-y-4">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                      <Ticket className="w-3 h-3" /> Выбрать услуги
                    </Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {activeServiceRules.map((rule: any) => {
                        const isSelected = selectedServiceIds.includes(rule.id);
                        return (
                          <button
                            key={rule.id}
                            onClick={() => {
                              setSelectedServiceIds((prev) =>
                                prev.includes(rule.id)
                                  ? prev.filter((id) => id !== rule.id)
                                  : [...prev, rule.id],
                              );
                            }}
                            className={cn(
                              "flex flex-col items-start p-3 rounded-2xl border text-left relative",
                              isSelected
                                ? "bg-orange-500/10 border-orange-500 ring-1 ring-orange-500"
                                : "bg-zinc-900 border-zinc-800 text-zinc-400",
                            )}
                          >
                            <div className="flex justify-between w-full mb-1">
                              <span className="font-black uppercase italic text-[11px] leading-tight">
                                {rule.name}
                              </span>
                              <span className="text-orange-500 font-black text-xs">
                                +{rule.tickets}
                              </span>
                            </div>
                            <span className="text-[8px] font-bold uppercase tracking-widest opacity-60">
                              {rule.time_start} — {rule.time_end}
                            </span>
                            {!rule.is_matching_schedule && (
                              <Badge
                                variant="outline"
                                className="absolute -top-2 -right-1 text-[7px] h-4 bg-zinc-950 border-zinc-800 text-zinc-500 font-black shadow-none"
                              >
                                Вне графика
                              </Badge>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {accrualPlayer && (
              <div className="p-6 border-t border-white/5 bg-zinc-900/50">
                {/* Preview summary */}
                {(Number(accrualTopupAmount) > 0 ||
                  selectedServiceIds.length > 0) && (
                  <div className="mb-6 flex items-center justify-between p-4 bg-orange-500/10 border border-orange-500/20 rounded-2xl">
                    <div className="flex flex-col">
                      <span className="text-[8px] font-black uppercase tracking-widest text-orange-500 opacity-70">
                        Будет начислено:
                      </span>
                      <div className="flex items-center gap-3">
                        {Number(accrualTopupAmount) > 0 && (
                          <div className="flex items-center gap-1">
                            <span className="text-sm font-black text-white">
                              {accrualTopupAmount} ₽
                            </span>
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <Ticket className="w-3.5 h-3.5 text-orange-500" />
                          <span className="text-lg font-black text-orange-500">
                            +
                            {(Number(accrualTopupAmount) > 0
                              ? Math.floor(
                                  Number(accrualTopupAmount) /
                                    (promoSettings.topup_amount_step || 100),
                                ) * (promoSettings.topup_tickets_step || 1)
                              : 0) +
                              selectedServiceIds.reduce((acc, id) => {
                                const rule = activeServiceRules.find(
                                  (r: any) => r.id === id,
                                );
                                return acc + (rule?.tickets || 0);
                              }, 0)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <Button
                    variant="ghost"
                    onClick={() => setIsAccrualDialogOpen(false)}
                    className="flex-1 h-14 rounded-2xl font-black uppercase tracking-widest text-xs shadow-none"
                  >
                    Отмена
                  </Button>
                  <Button
                    onClick={handleBulkAccrue}
                    disabled={
                      (Number(accrualTopupAmount) <= 0 &&
                        selectedServiceIds.length === 0) ||
                      isAccruing
                    }
                    className="flex-3 h-14 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-black text-lg shadow-none"
                  >
                    {isAccruing ? (
                      <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                      "ПОДТВЕРДИТЬ"
                    )}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
        {Dialogs}
      </CardContent>
    </Card>
  );
}
