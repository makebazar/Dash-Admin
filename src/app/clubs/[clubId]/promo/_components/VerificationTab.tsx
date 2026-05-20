"use client";

import React, { useState, useEffect } from "react";
import { Loader2, Check, X, Eye, Clock, User, Target } from "lucide-react";
import { cn } from "@/lib/utils";

export function VerificationTab({ clubId }: { clubId: string }) {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  const fetchRequests = async () => {
    try {
      const res = await fetch(
        `/api/promo/admin/quests/verification?clubId=${clubId}`,
      );
      const data = await res.json();
      setRequests(data.requests || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [clubId]);

  const handleAction = async (
    requestId: string,
    action: "approve" | "reject",
  ) => {
    setProcessing(requestId);
    try {
      const res = await fetch("/api/promo/admin/quests/verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, action, clubId }),
      });
      if (res.ok) {
        fetchRequests();
      }
    } catch (e) {
      alert("Ошибка при обработке");
    } finally {
      setProcessing(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 p-8 rounded-[2.5rem] shadow-sm">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="font-black text-xl uppercase italic tracking-tight flex items-center gap-3">
              <Clock className="w-6 h-6 text-orange-500" />
              Проверка <span className="text-orange-500">Заданий</span>
            </h3>
            <p className="text-slate-500 text-sm font-medium mt-1">
              Рассмотрите доказательства выполнения квестов и начислите награды.
            </p>
          </div>
        </div>

        {requests.length === 0 ? (
          <div className="text-center py-20 text-slate-400 font-bold uppercase italic tracking-widest text-sm border-2 border-dashed border-slate-100 rounded-[2rem]">
            Нет заявок на проверку
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {requests.map((req) => (
              <div
                key={req.id}
                className="bg-slate-50 border border-slate-100 p-5 rounded-3xl flex flex-col gap-4 relative overflow-hidden"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-slate-100 shadow-sm">
                      <User className="w-5 h-5 text-slate-400" />
                    </div>
                    <div>
                      <div className="font-black text-xs text-slate-900 uppercase">
                        {req.player_name || "Гость"}
                      </div>
                      <div className="text-[10px] font-bold text-slate-400">
                        {req.player_phone}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-orange-500 tracking-tight">
                    <Target className="w-3 h-3" /> {req.quest_title}
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {req.reward_xp > 0 && (
                      <div className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-lg text-[9px] font-black uppercase tracking-tight border border-blue-100">
                        +{Math.floor(req.reward_xp)} XP
                      </div>
                    )}
                    {req.reward_tickets > 0 && (
                      <div className="px-2 py-0.5 bg-orange-50 text-orange-600 rounded-lg text-[9px] font-black uppercase tracking-tight border border-orange-100">
                        +{Math.floor(req.reward_tickets)} Билетов
                      </div>
                    )}
                    {req.reward_bonus_balance > 0 && (
                      <div className="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-lg text-[9px] font-black uppercase tracking-tight border border-emerald-100">
                        +{Math.floor(req.reward_bonus_balance)} ₽
                      </div>
                    )}
                  </div>
                </div>

                {req.verification_photo_url && (
                  <div
                    className="aspect-video bg-slate-200 rounded-2xl overflow-hidden relative group cursor-pointer"
                    onClick={() => setSelectedPhoto(req.verification_photo_url)}
                  >
                    <img
                      src={req.verification_photo_url}
                      className="w-full h-full object-cover transition-transform group-hover:scale-110"
                      alt="Proof"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Eye className="w-6 h-6 text-white" />
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    disabled={!!processing}
                    onClick={() => handleAction(req.id, "approve")}
                    className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
                  >
                    {processing === req.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Check className="w-3 h-3" />
                    )}
                    ОДОБРИТЬ
                  </button>
                  <button
                    disabled={!!processing}
                    onClick={() => handleAction(req.id, "reject")}
                    className="flex-1 bg-white border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                  >
                    <X className="w-3 h-3" />
                    ОТКЛОНИТЬ
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 bg-black/90 z-100 flex items-center justify-center p-10 cursor-zoom-out"
          onClick={() => setSelectedPhoto(null)}
        >
          <img
            src={selectedPhoto}
            className="max-w-full max-h-full rounded-2xl shadow-2xl"
            alt="Full Proof"
          />
          <button className="absolute top-8 right-8 text-white/50 hover:text-white transition-colors">
            <X className="w-8 h-8" />
          </button>
        </div>
      )}
    </div>
  );
}
