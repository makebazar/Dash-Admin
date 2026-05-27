"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  Settings,
  ExternalLink,
  History,
  ChevronRight,
  Globe,
  QrCode,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { QRCode } from "@/components/qr/QRCode";

interface GeneralTabProps {
  settings: any;
  saveSettings: (settings: any) => Promise<void>;
  clubId: string | string[];
}

export function GeneralTab({
  settings,
  saveSettings,
  clubId,
}: GeneralTabProps) {
  if (!settings) return null;

  const promoDomain = settings.domain
    ? settings.domain.startsWith("http")
      ? settings.domain
      : `https://${settings.domain}`
    : "https://game.mydashadmin.ru";

  const qrUrl = `${promoDomain}/promo?clubId=${clubId}&action=checkin`;

  return (
    <motion.div
      key="general"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-8"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Rules Setup */}
        <div className="bg-white border border-slate-200 p-8 rounded-[2.5rem] shadow-sm space-y-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center">
              <Settings className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl font-black uppercase italic">
              Базовые <span className="text-orange-500">правила</span>
            </h3>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 transition-all hover:bg-white hover:shadow-md group">
              <div>
                <div className="font-black italic uppercase text-xs tracking-tight">
                  Промо-система активна
                </div>
                <div className="text-[10px] font-bold text-slate-400 mt-0.5">
                  Глобальный переключатель всей системы
                </div>
              </div>
              <button
                onClick={() =>
                  saveSettings({
                    ...settings,
                    is_promo_active:
                      settings.is_promo_active !== false ? false : true,
                  })
                }
                className={cn(
                  "w-12 h-6 rounded-full relative transition-colors duration-300",
                  settings.is_promo_active !== false
                    ? "bg-emerald-500"
                    : "bg-slate-300",
                )}
              >
                <div
                  className={cn(
                    "absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300",
                    settings.is_promo_active !== false ? "left-7" : "left-1",
                  )}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 transition-all hover:bg-white hover:shadow-md group">
              <div>
                <div className="font-black italic uppercase text-xs tracking-tight">
                  Начисление билетов (Пополнения)
                </div>
                <div className="text-[10px] font-bold text-slate-400 mt-0.5">
                  Разрешить выдачу билетов за пополнение баланса
                </div>
              </div>
              <button
                onClick={() =>
                  saveSettings({
                    ...settings,
                    topup_accrual_enabled:
                      settings.topup_accrual_enabled !== false ? false : true,
                  })
                }
                className={cn(
                  "w-12 h-6 rounded-full relative transition-colors duration-300",
                  settings.topup_accrual_enabled !== false
                    ? "bg-orange-500"
                    : "bg-slate-300",
                )}
              >
                <div
                  className={cn(
                    "absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300",
                    settings.topup_accrual_enabled !== false
                      ? "left-7"
                      : "left-1",
                  )}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 transition-all hover:bg-white hover:shadow-md group">
              <div>
                <div className="font-black italic uppercase text-xs tracking-tight">
                  Начисление билетов (Бар)
                </div>
                <div className="text-[10px] font-bold text-slate-400 mt-0.5">
                  Разрешить выдачу билетов за покупки в баре
                </div>
              </div>
              <button
                onClick={() =>
                  saveSettings({
                    ...settings,
                    bar_accrual_enabled:
                      settings.bar_accrual_enabled !== false ? false : true,
                  })
                }
                className={cn(
                  "w-12 h-6 rounded-full relative transition-colors duration-300",
                  settings.bar_accrual_enabled !== false
                    ? "bg-orange-500"
                    : "bg-slate-300",
                )}
              >
                <div
                  className={cn(
                    "absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300",
                    settings.bar_accrual_enabled !== false
                      ? "left-7"
                      : "left-1",
                  )}
                />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">
                  Welcome билеты
                </label>
                <input
                  type="number"
                  value={settings.welcome_bonus_tickets ?? 0}
                  onChange={(e) =>
                    saveSettings({
                      ...settings,
                      welcome_bonus_tickets: parseInt(e.target.value),
                    })
                  }
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3.5 px-6 text-sm font-bold focus:bg-white focus:ring-2 focus:ring-orange-500/10 transition-all outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">
                  Множитель Бонусов (Бар)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={settings.bonus_price_multiplier ?? 2}
                  onChange={(e) =>
                    saveSettings({
                      ...settings,
                      bonus_price_multiplier: parseFloat(e.target.value),
                    })
                  }
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3.5 px-6 text-sm font-bold focus:bg-white focus:ring-2 focus:ring-orange-500/10 transition-all outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">
                  XP за каждые 100₽ (Global)
                </label>
                <input
                  type="number"
                  value={settings.xp_per_100_rub ?? 100}
                  onChange={(e) =>
                    saveSettings({
                      ...settings,
                      xp_per_100_rub: parseInt(e.target.value),
                    })
                  }
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3.5 px-6 text-sm font-bold focus:bg-white focus:ring-2 focus:ring-orange-500/10 transition-all outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">
                  XP за 1₽ (BattlePass)
                </label>
                <input
                  type="number"
                  value={settings.bp_xp_per_rub ?? 1}
                  onChange={(e) =>
                    saveSettings({
                      ...settings,
                      bp_xp_per_rub: parseInt(e.target.value),
                    })
                  }
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3.5 px-6 text-sm font-bold focus:bg-white focus:ring-2 focus:ring-orange-500/10 transition-all outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* BP and Domain Settings */}
        <div className="space-y-8">
          <div className="bg-white border border-slate-200 p-8 rounded-[2.5rem] shadow-sm space-y-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-500 rounded-2xl flex items-center justify-center">
                <Globe className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-black uppercase italic">
                Battle <span className="text-indigo-500">Pass</span> & Домен
              </h3>
            </div>

            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 transition-all hover:bg-white hover:shadow-md group">
                <div>
                  <div className="font-black italic uppercase text-xs tracking-tight">
                    Battle Pass активен
                  </div>
                  <div className="text-[10px] font-bold text-slate-400 mt-0.5">
                    Включить систему сезонов и уровней BP
                  </div>
                </div>
                <button
                  onClick={() =>
                    saveSettings({
                      ...settings,
                      bp_enabled: settings.bp_enabled !== false ? false : true,
                    })
                  }
                  className={cn(
                    "w-12 h-6 rounded-full relative transition-colors duration-300",
                    settings.bp_enabled !== false
                      ? "bg-indigo-500"
                      : "bg-slate-300",
                  )}
                >
                  <div
                    className={cn(
                      "absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300",
                      settings.bp_enabled !== false ? "left-7" : "left-1",
                    )}
                  />
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">
                  Цена Battle Pass (₽)
                </label>
                <input
                  type="number"
                  value={settings.bp_price ?? 1000}
                  onChange={(e) =>
                    saveSettings({
                      ...settings,
                      bp_price: parseInt(e.target.value),
                    })
                  }
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3.5 px-6 text-sm font-bold focus:bg-white focus:ring-2 focus:ring-orange-500/10 transition-all outline-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">
                  Собственный домен
                </label>
                <input
                  type="text"
                  placeholder="game.mydashadmin.ru"
                  value={settings.domain || ""}
                  onChange={(e) =>
                    saveSettings({
                      ...settings,
                      domain: e.target.value,
                    })
                  }
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3.5 px-6 text-sm font-bold focus:bg-white focus:ring-2 focus:ring-orange-500/10 transition-all outline-none"
                />
              </div>
            </div>
          </div>

          {/* Withdrawal Limits */}
          <div className="bg-white border border-slate-200 p-8 rounded-[2.5rem] shadow-sm space-y-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-orange-500 rounded-2xl flex items-center justify-center">
                <Settings className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-black uppercase italic">
                Лимиты на <span className="text-orange-500">вывод</span>
              </h3>
            </div>

            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 transition-all hover:bg-white hover:shadow-md group">
                <div>
                  <div className="font-black italic uppercase text-xs tracking-tight">
                    Лимиты активны
                  </div>
                  <div className="text-[10px] font-bold text-slate-400 mt-0.5">
                    Ограничить вывод бонусов процентом от пополнений за месяц
                  </div>
                </div>
                <button
                  onClick={() =>
                    saveSettings({
                      ...settings,
                      withdraw_limit_enabled:
                        settings.withdraw_limit_enabled === true ? false : true,
                    })
                  }
                  className={cn(
                    "w-12 h-6 rounded-full relative transition-colors duration-300",
                    settings.withdraw_limit_enabled === true
                      ? "bg-orange-500"
                      : "bg-slate-300",
                  )}
                >
                  <div
                    className={cn(
                      "absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300",
                      settings.withdraw_limit_enabled === true ? "left-7" : "left-1",
                    )}
                  />
                </button>
              </div>

              {settings.withdraw_limit_enabled === true && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">
                        Процент от пополнений (%)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="1000"
                        value={settings.withdraw_limit_percent ?? 50}
                        onChange={(e) =>
                          saveSettings({
                            ...settings,
                            withdraw_limit_percent: parseInt(e.target.value) || 50,
                          })
                        }
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3.5 px-6 text-sm font-bold focus:bg-white focus:ring-2 focus:ring-orange-500/10 transition-all outline-none"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">
                        % с Battle Pass (%)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="1000"
                        value={settings.withdraw_limit_percent_bp ?? 80}
                        onChange={(e) =>
                          saveSettings({
                            ...settings,
                            withdraw_limit_percent_bp: parseInt(e.target.value) || 80,
                          })
                        }
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3.5 px-6 text-sm font-bold focus:bg-white focus:ring-2 focus:ring-orange-500/10 transition-all outline-none"
                      />
                    </div>
                  </div>
                  <p className="text-[9px] font-bold text-slate-400 ml-4 leading-relaxed">
                    Установите увеличенный лимит вывода бонусов (например, 80%) для гостей, у которых приобретен Premium Battle Pass.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white border border-slate-200 p-8 rounded-[2.5rem] shadow-sm space-y-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-blue-500 rounded-2xl flex items-center justify-center">
                <ExternalLink className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-black uppercase italic">
                Быстрые <span className="text-blue-500">ссылки</span>
              </h3>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <a
                href={`${promoDomain}/?clubId=${clubId}`}
                target="_blank"
                className="flex items-center justify-between p-5 bg-blue-50 hover:bg-blue-100 rounded-[1.5rem] group transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-blue-500">
                    <History className="w-5 h-5" />
                  </div>
                  <div className="font-black italic uppercase text-xs tracking-tight text-blue-700">
                    Страница игрока
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-blue-400 group-hover:translate-x-1 transition-transform" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* QR Section */}
      <div className="bg-white border border-slate-200 p-8 rounded-[2.5rem] shadow-sm">
        <div className="flex flex-col md:flex-row gap-8 items-center">
          <div className="flex-1 space-y-4 text-center md:text-left">
            <div className="flex items-center gap-4 justify-center md:justify-start">
              <div className="w-12 h-12 bg-orange-500 rounded-2xl flex items-center justify-center">
                <QrCode className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-black uppercase italic">
                QR-код для <span className="text-orange-500">Активации</span>
              </h3>
            </div>
            <p className="text-slate-500 text-sm font-medium leading-relaxed max-w-md">
              Этот QR-код ведет на страницу регистрации и активации "Check-in".
              Разместите его у кассы, чтобы игроки могли быстро зайти в свой
              профиль и уведомить администратора о своем визите.
            </p>
            <div className="pt-2 text-xs font-mono text-slate-400 bg-slate-50 p-3 rounded-xl break-all">
              {qrUrl}
            </div>
          </div>

          <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
            <QRCode
              value={qrUrl}
              size={200}
              downloadable
              filename={`promo-activation-club-${clubId}`}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
