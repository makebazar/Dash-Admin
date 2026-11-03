"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useParams } from "next/navigation";
import { Loader2, Download } from "lucide-react";
import { FragTab } from "@/app/clubs/[clubId]/promo/_components/FragTab";

export default function DashFragPage() {
  const { clubId } = useParams();
  const [settings, setSettings] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSettings = async () => {
    try {
      const res = await fetch(`/api/clubs/${clubId}`);
      const data = await res.json();
      setSettings(data.club?.promo_settings || {});
    } catch (error) {
      console.error("Fetch Settings Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (clubId) {
      fetchSettings();
    }
  }, [clubId]);

  const saveSettings = async (newSettings: any) => {
    const res = await fetch(`/api/clubs/${clubId}/promo-settings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings: newSettings }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || "Не удалось сохранить настройки");
    }

    setSettings(newSettings);
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#FAFAFA] flex-col font-sans text-slate-900 selection:bg-black/10">
      <main className="mx-auto max-w-6xl w-full flex-1 px-4 sm:px-6 md:px-8 py-8 sm:py-12 md:py-16 space-y-6">
        {/* Header Section (matches /promo design code) */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-2">
          <div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-slate-900">
              DashFrag
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
              Киберспортивная аналитика, рейтинги игроков и авто-начисление бонусов за матчи
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <a
              href="/dashlock.zip"
              download
              className="inline-flex items-center gap-2 h-10 sm:h-11 rounded-xl px-4 border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 font-medium text-xs sm:text-sm transition-all shadow-xs cursor-pointer no-underline"
            >
              <span>Скачать Agent (.exe)</span>
            </a>
          </div>
        </div>

        <Suspense fallback={
          <div className="flex h-64 items-center justify-center bg-white border border-slate-200 rounded-[2.5rem]">
            <Loader2 className="w-8 h-8 animate-spin text-slate-900" />
          </div>
        }>
          <FragTab
            settings={settings}
            saveSettings={saveSettings}
            clubId={clubId as string}
          />
        </Suspense>
      </main>
    </div>
  );
}
