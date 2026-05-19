"use client";

import React from "react";
import { motion } from "framer-motion";
import { Trophy, CheckCircle2, Trash2, User } from "lucide-react";
import { cn } from "@/lib/utils";

type QueueItem = {
  id: string;
  player_name: string;
  player_phone: string;
  prize_name: string;
  prize_type: string;
  status: "pending" | "claimed" | "canceled";
  created_at: string;
};

interface QueueTabProps {
  queue: QueueItem[];
  handleClaim: (id: string) => Promise<void>;
  handleCancel: (id: string) => Promise<void>;
}

export function QueueTab({ queue, handleClaim, handleCancel }: QueueTabProps) {
  return (
    <motion.div
      key="queue"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6"
    >
      <div className="bg-white border border-slate-200 rounded-[2.5rem] shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/20">
              <Trophy className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-black uppercase italic tracking-tight">
                Очередь <span className="text-orange-500">выдачи</span>
              </h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Призы, ожидающие подтверждения
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl">
            <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
              Live Stream
            </span>
          </div>
        </div>

        <div className="min-h-[400px]">
          {queue.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 space-y-4 opacity-30">
              <Trophy className="w-16 h-16 text-slate-300" />
              <p className="text-xs font-black uppercase italic tracking-widest text-slate-400">
                Очередь пуста
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {queue.map((item) => (
                <div
                  key={item.id}
                  className="group p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-slate-50/50 transition-colors"
                >
                  <div className="flex items-center gap-5">
                    <div className="w-14 h-14 bg-white border border-slate-200 rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                      <User className="w-6 h-6 text-slate-400" />
                    </div>
                    <div className="space-y-1">
                      <div className="font-black text-lg tracking-tight uppercase italic">
                        {item.player_name}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                          {item.player_phone}
                        </span>
                        <span className="text-[10px] font-medium text-slate-300">
                          {new Date(item.created_at).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-8">
                    <div className="text-right space-y-1">
                      <div className="flex items-center justify-end gap-2">
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest",
                            item.prize_type === "physical"
                              ? "bg-purple-100 text-purple-600"
                              : "bg-emerald-100 text-emerald-600",
                          )}
                        >
                          {item.prize_type === "physical"
                            ? "Товар"
                            : "Бонус"}
                        </span>
                      </div>
                      <div className="font-black text-xl italic text-slate-900 tracking-tight">
                        {item.prize_name}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleClaim(item.id)}
                        className="h-12 px-6 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl flex items-center gap-2 font-black uppercase italic text-xs transition-all active:scale-95"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Выдать
                      </button>
                      <button
                        onClick={() => handleCancel(item.id)}
                        className="h-12 w-12 bg-white border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200 rounded-2xl flex items-center justify-center transition-all active:scale-95"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
