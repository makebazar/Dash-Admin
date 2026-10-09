"use client";

import React, { useState, useEffect } from "react";
import { 
  ShieldCheck, 
  ShieldAlert, 
  Wifi, 
  WifiOff, 
  FileCheck, 
  Gamepad2, 
  AlertTriangle, 
  UserCheck, 
  Minimize2, 
  RefreshCw,
  Download
} from "lucide-react";

interface AgentWidgetProps {
  clubId: string;
  playerName?: string;
  playerBalance?: number;
  matchesCount?: number;
}

export function AgentWidget({
  clubId,
  playerName = "Николай (MVP Клуба)",
  playerBalance = 1500,
  matchesCount = 24,
}: AgentWidgetProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [envData, setEnvData] = useState<{
    isClubNetwork: boolean;
    clientIp: string;
    clubName: string;
    gsiConfigStatus: string;
    agentVersion: string;
  } | null>(null);

  // Simulation states for process launch order detection
  const [gameLaunchedBeforeAgent, setGameLaunchedBeforeAgent] = useState(false);
  const [activeGame, setActiveGame] = useState<"CS2" | "Dota2" | null>(null);

  const checkEnvironment = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/promo/agent/check-environment?clubId=${clubId}`);
      if (res.ok) {
        const data = await res.json();
        setEnvData(data);
      }
    } catch (e) {
      console.error("Error checking environment:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkEnvironment();
  }, [clubId]);

  if (isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => setIsMinimized(false)}
          className="flex items-center gap-3 bg-slate-900 border border-slate-800 hover:border-slate-700 text-white px-4 py-3 rounded-2xl shadow-2xl transition-all cursor-pointer"
        >
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-bold uppercase tracking-wider">DashFrag Agent</span>
          <span className="bg-slate-800 text-slate-300 text-[10px] font-bold px-2 py-0.5 rounded-md">
            v1.4.0
          </span>
        </button>
      </div>
    );
  }

  const isNetworkOk = envData?.isClubNetwork ?? true;

  return (
    <div className="w-full max-w-sm bg-slate-950 border border-slate-800 rounded-3xl p-6 shadow-2xl text-white font-sans space-y-5 relative">
      {/* Top Bar / Header */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-2.5">
          <div className={`w-3 h-3 rounded-full ${gameLaunchedBeforeAgent ? "bg-amber-500 animate-ping" : isNetworkOk ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
          <div>
            <h4 className="text-sm font-bold uppercase tracking-wider leading-none text-white">
              DashFrag Agent
            </h4>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1 block">
              FACEIT AC Compatible • {envData?.agentVersion || "v1.4.0"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={checkEnvironment}
            disabled={isLoading}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-900 transition-colors cursor-pointer"
            title="Обновить статус"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={() => setIsMinimized(true)}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-900 transition-colors cursor-pointer"
            title="Свернуть в трей"
          >
            <Minimize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Warning Alert if Game Launched Before Agent */}
      {gameLaunchedBeforeAgent && (
        <div className="bg-amber-950/80 border border-amber-800/60 p-4 rounded-2xl text-amber-200 text-xs space-y-2">
          <div className="flex items-center gap-2 font-bold uppercase text-[11px] text-amber-400">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Обнаружен поздний запуск!</span>
          </div>
          <p className="text-[11px] leading-relaxed text-amber-200/90 font-medium">
            Игра была запущенa <strong>ДО</strong> агента. Пожалуйста, перезапустите CS2/Dota 2, чтобы статистика матча гарантированно засчиталась.
          </p>
        </div>
      )}

      {/* Section 1: Authenticated Player */}
      <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 font-bold text-sm shrink-0">
            {playerName.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span className="font-bold text-xs text-slate-100">{playerName}</span>
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mt-0.5">
              Квалификация: {matchesCount >= 20 ? "👑 MVP Клуба" : `${matchesCount}/20 каток`}
            </span>
          </div>
        </div>

        <div className="text-right shrink-0">
          <span className="text-[10px] text-slate-500 font-bold uppercase block">Баланс</span>
          <span className="text-xs font-bold text-emerald-400">{playerBalance} ₽</span>
        </div>
      </div>

      {/* Section 2: Environment System Diagnostics */}
      <div className="space-y-2.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block ml-1">
          Диагностика системы
        </span>

        {/* 1. Club Network Check */}
        <div className={`p-3.5 rounded-xl border flex items-center justify-between text-xs ${isNetworkOk ? "bg-slate-900/60 border-slate-800 text-slate-300" : "bg-rose-950/40 border-rose-900/60 text-rose-300"}`}>
          <div className="flex items-center gap-2.5">
            {isNetworkOk ? (
              <Wifi className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <WifiOff className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <div>
              <span className="font-bold block text-[11px]">
                {isNetworkOk ? "Сеть клуба подтверждена" : "Ошибка: Сеть клуба не обнаружена"}
              </span>
              <span className="text-[10px] text-slate-500 font-medium">
                IP: {envData?.clientIp || "127.0.0.1"} • {envData?.clubName || "Клуб"}
              </span>
            </div>
          </div>
          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${isNetworkOk ? "bg-emerald-950 text-emerald-400 border border-emerald-800/40" : "bg-rose-950 text-rose-400 border border-rose-800/40"}`}>
            {isNetworkOk ? "OK" : "Дом"}
          </span>
        </div>

        {/* 2. File Integrity GSI Check */}
        <div className="bg-slate-900/60 border border-slate-800 p-3.5 rounded-xl flex items-center justify-between text-xs text-slate-300">
          <div className="flex items-center gap-2.5">
            <FileCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <div>
              <span className="font-bold block text-[11px]">Конфигурация GSI и файлов</span>
              <span className="text-[10px] text-slate-500 font-medium">
                gamestate_integration_dashfrag.cfg
              </span>
            </div>
          </div>
          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-emerald-950 text-emerald-400 border border-emerald-800/40">
            Норма
          </span>
        </div>

        {/* 3. Game Launch Readiness */}
        <div className="bg-slate-900/60 border border-slate-800 p-3.5 rounded-xl flex items-center justify-between text-xs text-slate-300">
          <div className="flex items-center gap-2.5">
            <Gamepad2 className="w-4 h-4 text-indigo-400 shrink-0" />
            <div>
              <span className="font-bold block text-[11px]">
                {activeGame ? `Запущена игра: ${activeGame}` : "Готовность к игре"}
              </span>
              <span className="text-[10px] text-slate-500 font-medium">
                {activeGame ? "Идет фиксация результатов..." : "Ожидание запуска CS2 / Dota 2..."}
              </span>
            </div>
          </div>
          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-indigo-950 text-indigo-400 border border-indigo-800/40">
            {activeGame ? "Игра" : "Ожидание"}
          </span>
        </div>
      </div>

      {/* Control / Simulation Actions for Admin Testing */}
      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
        <button
          onClick={() => setGameLaunchedBeforeAgent(!gameLaunchedBeforeAgent)}
          className="text-[10px] font-bold text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
        >
          {gameLaunchedBeforeAgent ? "Сбросить предупреждение" : "Тест: запуск после игры"}
        </button>

        <a
          href="/dashlock.zip"
          download
          className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 px-3 py-1.5 rounded-xl transition-all no-underline"
        >
          <Download className="w-3 h-3" />
          Скачать .exe
        </a>
      </div>
    </div>
  );
}
