"use client";

import React from "react";
import {
  CheckCircle2,
  Clock,
  Users,
  AlertCircle,
  Coins,
  ShieldCheck,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface TournamentNotificationData {
  type: "success" | "pending_payment" | "reserve" | "error" | "info";
  title: string;
  message: string;
  tournamentName?: string;
  entryFee?: number | string;
  actionText?: string;
}

interface TournamentNotificationModalProps {
  data: TournamentNotificationData | null;
  onClose: () => void;
}

export function TournamentNotificationModal({
  data,
  onClose,
}: TournamentNotificationModalProps) {
  if (!data) return null;

  const isPending = data.type === "pending_payment";
  const isSuccess = data.type === "success";
  const isReserve = data.type === "reserve";
  const isError = data.type === "error";

  const getIcon = () => {
    if (isSuccess) {
      return (
        <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/10 mx-auto">
          <CheckCircle2 className="w-8 h-8" />
        </div>
      );
    }
    if (isPending) {
      return (
        <div className="w-16 h-16 rounded-3xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400 shadow-lg shadow-orange-500/10 mx-auto">
          <Clock className="w-8 h-8" />
        </div>
      );
    }
    if (isReserve) {
      return (
        <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-500/10 mx-auto">
          <Users className="w-8 h-8" />
        </div>
      );
    }
    if (isError) {
      return (
        <div className="w-16 h-16 rounded-3xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shadow-lg shadow-rose-500/10 mx-auto">
          <AlertCircle className="w-8 h-8" />
        </div>
      );
    }
    return (
      <div className="w-16 h-16 rounded-3xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-lg shadow-blue-500/10 mx-auto">
        <ShieldCheck className="w-8 h-8" />
      </div>
    );
  };

  const getBadge = () => {
    if (isSuccess) {
      return (
        <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          Слот подтвержден
        </span>
      );
    }
    if (isPending) {
      return (
        <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20">
          Ожидает оплаты
        </span>
      );
    }
    if (isReserve) {
      return (
        <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
          Очередь резерва
        </span>
      );
    }
    if (isError) {
      return (
        <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
          Ошибка
        </span>
      );
    }
    return null;
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-[#121620] border border-white/10 rounded-[2.5rem] p-7 sm:p-8 shadow-2xl space-y-6 text-center text-white overflow-hidden">
        {/* Glow ambient background effect */}
        <div
          className={cn(
            "absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full blur-3xl pointer-events-none opacity-20",
            isSuccess && "bg-emerald-500",
            isPending && "bg-orange-500",
            isReserve && "bg-amber-500",
            isError && "bg-rose-500"
          )}
        />

        {/* Close icon in top corner */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-gray-500 hover:text-white p-2 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Status Icon */}
        <div className="pt-2">{getIcon()}</div>

        {/* Header & Badges */}
        <div className="space-y-2">
          {getBadge()}
          <h3 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-white mt-2">
            {data.title}
          </h3>
          <p className="text-xs sm:text-sm text-gray-300 font-medium leading-relaxed">
            {data.message}
          </p>
        </div>

        {/* Info card (if tournamentName or fee provided) */}
        {(data.tournamentName || data.entryFee) && (
          <div className="bg-black/40 border border-white/10 rounded-2xl p-4 text-left space-y-2 text-xs">
            {data.tournamentName && (
              <div className="flex justify-between items-center text-gray-400">
                <span>Турнир:</span>
                <span className="font-bold text-white truncate max-w-[200px]">
                  {data.tournamentName}
                </span>
              </div>
            )}
            {data.entryFee !== undefined && Number(data.entryFee) > 0 && (
              <div className="flex justify-between items-center text-gray-400 border-t border-white/5 pt-2">
                <span>Взнос к оплате:</span>
                <span className="font-black text-orange-400 flex items-center gap-1 font-mono text-sm">
                  <Coins className="w-3.5 h-3.5" />
                  {data.entryFee} ₽
                </span>
              </div>
            )}
            {isPending && (
              <div className="pt-2 border-t border-white/5 text-[11px] text-amber-300/90 font-medium flex items-center gap-1.5">
                <span>💡</span>
                <span>
                  Администратор подтвердит заявку сразу после оплаты на кассе.
                </span>
              </div>
            )}
          </div>
        )}

        {/* Action Button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={onClose}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-orange-500/20 transition-all active:scale-[0.98] cursor-pointer"
          >
            {data.actionText || "Понятно, спасибо"}
          </button>
        </div>
      </div>
    </div>
  );
}
