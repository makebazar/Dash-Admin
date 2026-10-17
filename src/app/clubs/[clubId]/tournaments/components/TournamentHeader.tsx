"use client";
import React from "react";
import { useRouter } from "next/navigation";
import { Plus, Edit, Trash2, ArrowLeft } from "lucide-react";
import { Tournament } from "../types";
import { Button } from "@/components/ui/button";

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
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
      <div>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-slate-900">
          {activeTournament ? activeTournament.name : "Турниры"}
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
          {activeTournament
            ? "Управление турниром и турнирной сеткой"
            : "Управление киберспортивными турнирами и матчами клуба"}
        </p>
      </div>

      {!activeTournament ? (
        <div className="flex items-center gap-3">
          <Button
            onClick={() => router.push(`/clubs/${clubId}/tournaments/create`)}
            className="h-11 sm:h-12 rounded-xl px-4 sm:px-6 bg-black text-white hover:bg-slate-800 font-medium transition-all shadow-sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            <span>Создать турнир</span>
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={onBack}
            className="h-10 sm:h-11 rounded-xl px-4 border-slate-200 text-slate-700 hover:bg-slate-50 font-medium transition-all"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Назад к списку
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              router.push(
                `/clubs/${clubId}/tournaments/create?editId=${activeTournament.id}`
              )
            }
            className="h-10 sm:h-11 rounded-xl px-4 border-slate-200 text-slate-700 hover:bg-slate-50 font-medium transition-all"
          >
            <Edit className="w-4 h-4 mr-2 text-blue-600" />
            Редактировать
          </Button>
          <Button
            variant="outline"
            onClick={onDelete}
            className="h-10 sm:h-11 rounded-xl px-4 border-rose-200 text-rose-600 hover:bg-rose-50 font-medium transition-all"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Удалить
          </Button>
        </div>
      )}
    </div>
  );
}

