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
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-2">
          <div className="space-y-1">
            <h1 className="text-4xl font-black tracking-tight text-slate-900 uppercase italic">
              Dash<span className="text-indigo-600">Frag</span>
            </h1>
            <p className="text-slate-500 font-semibold text-sm">
              Модуль киберспортивной аналитики, турниров и авто-начислений бонусов за фраги
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <a
              href="/dashlock.zip"
              download
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer no-underline shadow-xs"
            >
              <Download className="w-4 h-4" />
              Скачать Agent (.exe)
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
      </div>
    </div>
  );
}
