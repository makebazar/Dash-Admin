"use client";

import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export type TournamentTabType = "feed" | "team" | "profile" | "leaderboard";

interface TournamentsNavTabsProps {
  activeTab: TournamentTabType;
  onSelectTab: (tab: TournamentTabType) => void;
  selectedPlayerName?: string | null;
}

export function TournamentsNavTabs({
  activeTab,
  onSelectTab,
  selectedPlayerName,
}: TournamentsNavTabsProps) {
  const tabs: Array<{ id: TournamentTabType; label: string }> = [
    { id: "feed", label: "Турниры" },
    { id: "team", label: "Моя Команда" },
    { id: "profile", label: selectedPlayerName ? `Профиль (${selectedPlayerName})` : "Профиль" },
    { id: "leaderboard", label: "Лидерборд" },
  ];

  return (
    <div className="flex bg-white/5 p-1 rounded-2xl border border-white/5 max-w-xl relative">
      {tabs.map((tab) => {
        const isSelected = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onSelectTab(tab.id)}
            className={cn(
              "flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-colors relative z-10 truncate px-2",
              isSelected ? "text-white" : "text-gray-500 hover:text-white"
            )}
          >
            {isSelected && (
              <motion.span
                layoutId="tab-active-bg"
                className="absolute inset-0 bg-orange-500 rounded-xl shadow-lg shadow-orange-500/20"
                transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
              />
            )}
            <span className="relative z-10 truncate block">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
