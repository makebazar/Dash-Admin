"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
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
import { useSSE } from "@/hooks/usePOSWebSocket";
import {
  getPromoQueue,
  claimPromoItemSafe,
  topupPlayerBalanceSafe,
} from "@/app/clubs/[clubId]/inventory/actions";
import { normalizePhone } from "@/lib/phone-utils";
import { cn } from "@/lib/utils";
import { useUiDialogs } from "@/app/clubs/[clubId]/inventory/_components/useUiDialogs";

export function EmployeePromoControlCard({
  clubId,
  userId,
  clubCode,
  enabled,
}: {
  clubId: string;
  userId: string;
  clubCode?: string;
  enabled: boolean;
}) {
  const [promoQueue, setPromoQueue] = useState<any[]>([]);
  const [checkedInPlayers, setCheckedInPlayers] = useState<any[]>([]);

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

  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const { confirmAction, showMessage, Dialogs } = useUiDialogs();

  // Topup State
  const [isTopupDialogOpen, setIsTopupDialogOpen] = useState(false);
  const [topupPlayer, setTopupPlayer] = useState<any>(null);
  const [topupAmount, setTopupAmount] = useState("");
  const [topupPaymentType, setTopupPaymentType] = useState<
    "cash" | "card" | "other"
  >("cash");
  const [promoSearchQuery, setPromoSearchQuery] = useState("");
  const [promoSearchResults, setPromoSearchResults] = useState<any[]>([]);
  const [isSearchingPromo, setIsSearchingPromo] = useState(false);

  const refresh = useCallback(async () => {
    if (!enabled || !clubId) return;
    try {
      const queue = await getPromoQueue(clubId, userId);
      setPromoQueue(queue);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [clubId, enabled, userId]);

  const handleWebSocketMessage = useCallback(
    (message: any) => {
      if (message.type === "PROMO_QUEUE_UPDATED") {
        refresh();
      }

      if (message.type === "PLAYER_CHECKIN" && message.player) {
        setCheckedInPlayers((prev) => {
          const filtered = prev.filter((p) => p.id !== message.player.id);
          return [
            { ...message.player, timestamp: Date.now() },
            ...filtered,
          ].slice(0, 5);
        });

        if (isTopupDialogOpen && !topupPlayer) {
          setTopupPlayer(message.player);
        }

        showMessage({
          title: "🔔 Гость подошел",
          description: `${message.player.full_name} сканировал QR`,
        });
      }
    },
    [clubId, isTopupDialogOpen, refresh, showMessage, topupPlayer],
  );

  useSSE(handleWebSocketMessage);

  useEffect(() => {
    refresh();
  }, [refresh]);

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

  const handleTopupBalance = async () => {
    if (!topupPlayer || !topupAmount || Number(topupAmount) <= 0) return;

    startTransition(async () => {
      const result = await topupPlayerBalanceSafe(clubId, userId, {
        player_id: topupPlayer.id,
        amount: Number(topupAmount),
        payment_type: topupPaymentType as any,
      });

      if ((result as any).success) {
        showMessage({
          title: "✅ Баланс пополнен",
          description: `${topupPlayer.full_name}: +${Number(topupAmount).toLocaleString()} ₽`,
        });
        setIsTopupDialogOpen(false);
        setTopupPlayer(null);
        setTopupAmount("");
        refresh();
      } else {
        showMessage({
          title: "Ошибка",
          description: (result as any).error || "Ошибка пополнения",
        });
      }
    });
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
    <Card className="overflow-hidden border-border bg-card shadow-sm">
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
                className="group cursor-pointer flex items-center gap-1.5 px-2.5 h-8 bg-zinc-100 dark:bg-zinc-800 border border-border rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
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
              className="h-8 rounded-xl bg-orange-500/10 border-orange-500/20 text-orange-500 hover:bg-orange-500/20 text-[10px] font-black uppercase"
              onClick={() => setIsTopupDialogOpen(true)}
            >
              <Wallet className="w-3.5 h-3.5 mr-2" />
              Пополнить
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
                      setTopupPlayer(p);
                      setIsTopupDialogOpen(true);
                    }}
                    className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-xl text-[10px] font-bold transition-all border border-border flex items-center gap-2"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    {p.full_name}
                  </button>
                  <button
                    onClick={() =>
                      setCheckedInPlayers((prev) =>
                        prev.filter((item) => item.id !== p.id),
                      )
                    }
                    className="absolute -top-1 -right-1 w-4 h-4 bg-zinc-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Promo Queue */}
        <div className="space-y-3">
          {isLoading ? (
            <div className="flex h-10 items-center justify-center">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          ) : promoQueue.length === 0 ? (
            <div className="text-[10px] text-center py-2 text-muted-foreground italic">
              Очередь выдачи пуста
            </div>
          ) : (
            promoQueue.map((item) => (
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
                    className="flex items-center gap-1.5 px-2 py-1 bg-background hover:bg-muted rounded-lg text-[9px] font-bold transition-all border border-border"
                  >
                    <Copy className="w-2.5 h-2.5" />
                    {normalizePhone(item.player_phone)}
                  </button>
                  {item.withdraw_amount > 0 && (
                    <button
                      onClick={() =>
                        copyToClipboard(String(item.withdraw_amount), "Сумма")
                      }
                      className="flex items-center gap-1.5 px-2 py-1 bg-background hover:bg-muted rounded-lg text-[9px] font-bold transition-all border border-border"
                    >
                      <Copy className="w-2.5 h-2.5" />
                      {item.withdraw_amount} ₽
                    </button>
                  )}
                </div>

                <Button
                  onClick={() => handleClaimItem(item.id, item.prize_name)}
                  disabled={isPending}
                  className="w-full h-8 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold text-[10px]"
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
            ))
          )}
        </div>

        {/* Topup Dialog */}
        <Dialog open={isTopupDialogOpen} onOpenChange={setIsTopupDialogOpen}>
          <DialogContent className="bg-zinc-950 border-zinc-800 sm:max-w-md rounded-3xl p-6 text-white">
            <DialogHeader className="mb-4">
              <div className="w-12 h-12 bg-orange-500/20 rounded-2xl flex items-center justify-center mb-4">
                <Wallet className="w-6 h-6 text-orange-500" />
              </div>
              <DialogTitle className="text-2xl font-black uppercase italic tracking-tight">
                Пополнение <span className="text-orange-500">Баланса</span>
              </DialogTitle>
              <DialogDescription className="text-zinc-400">
                Пополните бонусный баланс гостя.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              {!topupPlayer ? (
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
                      className="h-12 pl-10 bg-zinc-900 border-zinc-800 rounded-xl text-white"
                    />
                    {isSearchingPromo && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  {promoSearchResults.length > 0 && (
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden max-h-48 overflow-y-auto">
                      {promoSearchResults.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => {
                            setTopupPlayer(p);
                            setPromoSearchQuery("");
                            setPromoSearchResults([]);
                          }}
                          className="w-full text-left px-4 py-3 hover:bg-zinc-800 flex items-center justify-between border-b border-zinc-800/50 last:border-0 transition-colors"
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
                <div className="space-y-6">
                  <div className="flex items-center justify-between bg-zinc-900 border border-zinc-800 p-4 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center">
                        <User className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <div className="font-bold text-sm">
                          {topupPlayer.full_name}
                        </div>
                        <div className="text-[10px] text-zinc-500 font-mono">
                          {topupPlayer.phone_number}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setTopupPlayer(null)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase text-zinc-500">
                        Сумма (₽)
                      </Label>
                      <Input
                        type="number"
                        value={topupAmount}
                        onChange={(e) => setTopupAmount(e.target.value)}
                        className="h-16 bg-zinc-900 border-zinc-800 rounded-2xl text-3xl font-black text-center text-orange-500"
                        autoFocus
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setTopupPaymentType("cash")}
                        className={cn(
                          "py-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-2",
                          topupPaymentType === "cash"
                            ? "border-emerald-500 bg-emerald-500/10 text-emerald-500"
                            : "border-zinc-800 bg-zinc-900 text-zinc-400",
                        )}
                      >
                        <Banknote className="w-3.5 h-3.5" /> Наличные
                      </button>
                      <button
                        onClick={() => setTopupPaymentType("card")}
                        className={cn(
                          "py-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-2",
                          topupPaymentType === "card"
                            ? "border-blue-500 bg-blue-500/10 text-blue-500"
                            : "border-zinc-800 bg-zinc-900 text-zinc-400",
                        )}
                      >
                        <CreditCard className="w-3.5 h-3.5" /> Карта
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <DialogFooter className="mt-8 gap-3 sm:gap-0">
              <Button
                variant="ghost"
                onClick={() => setIsTopupDialogOpen(false)}
                className="h-14 rounded-2xl"
              >
                Отмена
              </Button>
              <Button
                onClick={handleTopupBalance}
                disabled={
                  !topupPlayer ||
                  !topupAmount ||
                  Number(topupAmount) <= 0 ||
                  isPending
                }
                className="h-14 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-black text-lg px-8"
              >
                {isPending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  "ПОПОЛНИТЬ"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {Dialogs}
      </CardContent>
    </Card>
  );
}
