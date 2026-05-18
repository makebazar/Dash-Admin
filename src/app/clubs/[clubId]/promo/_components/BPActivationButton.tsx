"use client";

import { activatePremiumBPAction } from "../actions";
import { useState } from "react";

interface BPActivationButtonProps {
  clubId: string;
  playerId: string;
  hasPremium: boolean;
  onActivated?: () => void;
  price?: number;
}

export function BPActivationButton({
  clubId,
  playerId,
  hasPremium,
  onActivated,
  price = 1000,
}: BPActivationButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleActivate = async () => {
    if (!confirm(`Игрок оплатил Боевой Пропуск (${price}₽)?`)) return;

    setLoading(true);
    try {
      const result = await activatePremiumBPAction(clubId, playerId);
      if (result.success) {
        alert("Battle Pass активирован!");
        onActivated?.();
      } else {
        alert(result.error || "Ошибка активации");
      }
    } catch (e: any) {
      alert(e.message || "Ошибка активации");
    } finally {
      setLoading(false);
    }
  };

  if (hasPremium) {
    return (
      <div className="inline-flex items-center px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-bold border border-amber-200">
        <span className="mr-1">🔥</span> PREMIUM BP
      </div>
    );
  }

  return (
    <button
      onClick={handleActivate}
      disabled={loading}
      className="inline-flex items-center px-4 py-2 bg-linear-to-r from-amber-500 to-orange-600 text-white rounded-lg hover:from-amber-600 hover:to-orange-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50 text-sm font-bold"
    >
      {loading ? (
        <span className="flex items-center">
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          Активация...
        </span>
      ) : (
        "Активировать BP"
      )}
    </button>
  );
}
