"use client";
import React from "react";
import { useRouter } from "next/navigation";
import { Trophy, Plus, Edit, Trash2 } from "lucide-react";
import { Tournament } from "../types";

interface TournamentHeaderProps {
  clubId: string;
  activeTournament: Tournament | null;
  onBack: () => void;
  onDelete: () => void;
}

export function TournamentHeader({
  clubId,
  activeTournament,
  onBack,
  onDelete,
}: TournamentHeaderProps) {
  const router = useRouter();

  return (
    <div className="flex justify-between items-center mb-8">
      <div>
        <h1 className="text-2xl font-black uppercase italic tracking-tight text-slate-900">
          Управление <span className="text-orange-500">Турнирами</span>
        </h1>
        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-0.5">
          Панель администратора клуба
        </p>
      </div>

      {!activeTournament ? (
        <button
          onClick={() => router.push(`/clubs/${clubId}/tournaments/create`)}
          className="bg-orange-500 hover:bg-orange-600 text-white font-black text-xs uppercase tracking-widest px-6 py-4 rounded-2xl transition-colors shadow-lg shadow-orange-500/10 flex items-center gap-2 cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Создать Турнир
        </button>
      ) : (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={onBack}
            className="text-xs text-slate-600 hover:text-slate-950 font-black uppercase tracking-widest bg-white border border-slate-200 px-6 py-4 rounded-2xl transition-colors shadow-sm cursor-pointer"
          >
            Назад к списку
          </button>
          <button
            onClick={() =>
              router.push(
                `/clubs/${clubId}/tournaments/create?editId=${activeTournament.id}`
              )
            }
            className="text-xs text-blue-600 hover:text-blue-950 font-black uppercase tracking-widest bg-white border border-blue-200 px-6 py-4 rounded-2xl transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <Edit className="w-4 h-4" /> Редактировать
          </button>
          <button
            onClick={onDelete}
            className="text-xs text-rose-600 hover:text-rose-950 font-black uppercase tracking-widest bg-white border border-rose-200 px-6 py-4 rounded-2xl transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <Trash2 className="w-4 h-4" /> Удалить
          </button>
        </div>
      )}
    </div>
  );
}
