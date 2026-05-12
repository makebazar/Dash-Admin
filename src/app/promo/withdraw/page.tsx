"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Coins,
  Gamepad2,
  User,
  Wallet,
  ArrowRight,
  Loader2,
  History,
  Ticket,
} from "lucide-react";
import Link from "next/link";

export default function PromoWithdraw() {
  const [player, setPlayer] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [withdrawAmount, setWithdrawAmount] = useState<string>("");
  const [isClaiming, setIsClaiming] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const fetchData = async () => {
    try {
      const ts = Date.now();
      const [playerRes, historyRes] = await Promise.all([
        fetch(`/api/promo/player?t=${ts}`, { cache: "no-store" }),
        fetch(`/api/promo/player/bonus/history?t=${ts}`, { cache: "no-store" }),
      ]);

      if (playerRes.status === 401) {
        router.push("/promo");
        return;
      }

      const playerData = await playerRes.json();
      const historyData = await historyRes.json();

      setPlayer(playerData.player);
      setHistory(historyData.history || []);
    } catch (err) {
      console.error("Failed to fetch withdraw data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // SSE for real-time updates
    const eventSource = new EventSource(`/api/promo/player/stream`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "update" || event.type === "update") {
          fetchData();
        }
      } catch (e) {}
    };

    eventSource.addEventListener("update", () => {
      fetchData();
    });

    return () => {
      eventSource.close();
    };
  }, [router]);
  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(withdrawAmount);

    if (isNaN(amount) || amount <= 0) {
      setError("Введите корректную сумму");
      return;
    }

    if (amount > (player?.bonusBalance || 0)) {
      setError("Недостаточно бонусов на балансе");
      return;
    }

    setIsClaiming(true);
    setError("");

    try {
      const res = await fetch("/api/promo/player/bonus/claim", {
        method: "POST",
        body: JSON.stringify({ amount }),
      });
      const data = await res.json();

      if (data.success) {
        setWithdrawAmount("");
        await fetchData(); // Refresh balance and history
      } else {
        setError(data.error || "Ошибка при отправке запроса");
      }
    } catch (err) {
      setError("Ошибка соединения");
    } finally {
      setIsClaiming(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-yellow-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-6 pb-32 font-sans selection:bg-yellow-500/30">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="flex flex-col mb-10">
          <h1 className="text-2xl font-black uppercase italic tracking-tight mb-2">
            Зачисление <span className="text-yellow-500">Бонусов</span>
          </h1>
          <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">
            Переведи бонусы на клубный аккаунт
          </p>
        </div>

        {/* Balance Card */}
        <div className="bg-[#151515] border border-white/5 rounded-[2.5rem] p-8 mb-8 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
            <Coins className="w-24 h-24 text-yellow-500" />
          </div>
          <div className="relative z-10 flex flex-col gap-4">
            <div className="w-12 h-12 bg-yellow-500/20 rounded-2xl flex items-center justify-center">
              <Coins className="w-6 h-6 text-yellow-500" />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-1">
                Доступно для перевода
              </div>
              <div className="text-5xl font-black text-white tracking-tighter">
                {Math.floor(player?.bonusBalance || 0)}
              </div>
            </div>
          </div>
        </div>

        {/* Withdraw Form */}
        <form onSubmit={handleWithdraw} className="mb-12">
          <div className="flex items-center gap-4 mb-6">
            <h3 className="text-xs font-black uppercase tracking-[0.3em] text-white/30 whitespace-nowrap">
              Сумма перевода
            </h3>
            <div className="h-px w-full bg-white/5" />
          </div>

          <div className="relative mb-4">
            <input
              type="number"
              inputMode="numeric"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              placeholder="0"
              className="w-full bg-black border border-white/10 rounded-2xl py-5 px-6 text-2xl font-black tracking-wider text-white focus:border-yellow-500/50 outline-none transition-all"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex gap-2">
              <button
                type="button"
                onClick={() =>
                  setWithdrawAmount(
                    String(Math.floor(player?.bonusBalance || 0)),
                  )
                }
                className="bg-white/5 hover:bg-white/10 text-[10px] font-black uppercase tracking-widest text-yellow-500 px-3 py-2 rounded-xl transition-colors"
              >
                Всё
              </button>
            </div>
          </div>

          {/* Quick amounts */}
          <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
            {[50, 100, 300, 500].map((amount) => (
              <button
                key={amount}
                type="button"
                onClick={() => setWithdrawAmount(String(amount))}
                className="flex-none bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl px-4 py-2 text-xs font-black transition-colors"
              >
                +{amount}
              </button>
            ))}
          </div>

          {error && (
            <p className="text-red-500 text-[10px] font-black uppercase tracking-widest text-center mb-6">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={
              isClaiming || !withdrawAmount || parseFloat(withdrawAmount) <= 0
            }
            className="w-full bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 text-black py-5 rounded-2xl font-black text-lg flex items-center justify-center gap-3 transition-all active:scale-95 shadow-[0_10px_20px_rgba(234,179,8,0.2)]"
          >
            {isClaiming ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <>
                ПЕРЕВЕСТИ <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>

        {/* History */}
        <section>
          <div className="flex items-center gap-4 mb-6">
            <h3 className="text-xs font-black uppercase tracking-[0.3em] text-white/30 whitespace-nowrap">
              История
            </h3>
            <div className="h-px w-full bg-white/5" />
          </div>

          <div className="space-y-3">
            {history.length === 0 ? (
              <div className="text-center py-8 border border-white/5 rounded-3xl bg-white/5">
                <History className="w-8 h-8 text-gray-600 mx-auto mb-3 opacity-30" />
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                  Истории пока нет
                </p>
              </div>
            ) : (
              history.map((item, idx) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-[#151515] border border-white/5 rounded-2xl p-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-yellow-500/10 rounded-xl flex items-center justify-center">
                      <Wallet className="w-5 h-5 text-yellow-500" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-black uppercase tracking-tight">
                          Перевод
                        </div>
                        <span
                          className={cn(
                            "text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border",
                            item.status === "claimed"
                              ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                              : item.status === "canceled"
                                ? "bg-red-500/10 text-red-500 border-red-500/20"
                                : "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
                          )}
                        >
                          {item.statusLabel}
                        </span>
                      </div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mt-0.5">
                        {new Date(item.date).toLocaleDateString("ru-RU", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="text-lg font-black text-yellow-500">
                    -{item.amount}
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* Bottom Nav Simulation */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-xl border border-white/10 rounded-full px-8 py-4 flex items-center gap-10 shadow-2xl z-50">
        <Link
          href="/promo"
          className="text-gray-500 hover:text-white transition-colors"
        >
          <Gamepad2 className="w-6 h-6" />
        </Link>
        <Link
          href="/promo/accruals"
          className="text-gray-500 hover:text-white transition-colors"
        >
          <Ticket className="w-6 h-6" />
        </Link>
        <button className="text-yellow-500">
          <Wallet className="w-6 h-6" />
        </button>
        <Link
          href="/promo/profile"
          className="text-gray-500 hover:text-white transition-colors"
        >
          <User className="w-6 h-6" />
        </Link>
      </div>
    </div>
  );
}
