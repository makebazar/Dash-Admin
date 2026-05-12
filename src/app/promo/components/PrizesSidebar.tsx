"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Gift, X, Star, Coins, Ticket, Package } from "lucide-react";

interface Prize {
  id: string | number;
  name: string;
  type: string;
  value: string | number;
  probability?: string | number;
  win_condition?: {
    dice_sums?: number[];
    dice_double?: number | "any";
  };
}

interface PrizesSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  prizes: Prize[];
}

export const PrizesSidebar = ({
  isOpen,
  onClose,
  prizes,
}: PrizesSidebarProps) => {
  const getPrizeIcon = (type: string) => {
    switch (type) {
      case "virtual":
        return <Coins className="w-5 h-5 text-yellow-500" />;
      case "attempt":
        return <Ticket className="w-5 h-5 text-orange-500" />;
      case "bonus":
        return <Star className="w-5 h-5 text-purple-500" />;
      default:
        return <Package className="w-5 h-5 text-blue-500" />;
    }
  };

  const getPrizeTypeLabel = (type: string) => {
    switch (type) {
      case "virtual":
        return "Баланс";
      case "attempt":
        return "Попытки";
      case "bonus":
        return "Бонус";
      case "physical":
        return "Приз";
      default:
        return "Подарок";
    }
  };

  const renderWinCondition = (condition?: Prize["win_condition"]) => {
    if (!condition) return null;

    const parts = [];
    if (condition.dice_sums && condition.dice_sums.length > 0) {
      parts.push(`Сумма: ${condition.dice_sums.join(", ")}`);
    }
    if (condition.dice_double) {
      parts.push(
        condition.dice_double === "any"
          ? "Любой дубль"
          : `Дубль: ${condition.dice_double}-${condition.dice_double}`,
      );
    }

    if (parts.length === 0) return null;

    return (
      <div className="mt-2 flex flex-wrap gap-1">
        {parts.map((p, i) => (
          <span
            key={i}
            className="px-2 py-0.5 bg-white/10 rounded border border-white/5 text-[9px] font-bold text-gray-300 uppercase tracking-widest"
          >
            {p}
          </span>
        ))}
      </div>
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] pointer-events-auto"
          />

          {/* Sidebar */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 h-full w-full max-w-[320px] bg-[#0f0f0f] border-l border-white/10 shadow-2xl z-[70] flex flex-col pointer-events-auto"
          >
            <div className="p-6 flex items-center justify-between border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-500/20 rounded-xl flex items-center justify-center">
                  <Gift className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <h2 className="text-xl font-black uppercase italic tracking-tight text-white">
                    Призы
                  </h2>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                    Что можно выиграть
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-10 h-10 bg-white/5 hover:bg-white/10 rounded-xl flex items-center justify-center transition-colors text-white/50 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide">
              {prizes.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8">
                  <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mb-4 border border-white/10 opacity-20">
                    <Package className="w-8 h-8 text-white" />
                  </div>
                  <p className="text-gray-500 font-bold uppercase text-xs tracking-widest">
                    Призов пока нет
                  </p>
                </div>
              ) : (
                prizes.map((prize, idx) => (
                  <motion.div
                    key={prize.id || idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="p-4 bg-white/5 border border-white/10 rounded-2xl flex flex-col gap-2 group hover:bg-white/10 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-black/40 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                        {getPrizeIcon(prize.type)}
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-black text-white uppercase italic leading-tight">
                          {prize.name}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                            {getPrizeTypeLabel(prize.type)}
                          </span>
                          {prize.value && (
                            <>
                              <span className="w-1 h-1 bg-white/10 rounded-full" />
                              <span className="text-[10px] font-black text-orange-500 uppercase">
                                {prize.value}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    {renderWinCondition(prize.win_condition)}
                  </motion.div>
                ))
              )}
            </div>

            <div className="p-6 bg-linear-to-t from-black to-transparent">
              <p className="text-[10px] text-gray-600 font-bold text-center uppercase tracking-[0.2em] leading-relaxed">
                Испытай свою удачу <br /> и забирай награды!
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
