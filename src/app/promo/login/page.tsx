"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Ticket, Phone, Lock, User, ArrowRight, Loader2 } from "lucide-react";

export default function PromoLogin() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [pin, setPin] = useState("");
  const [fullName, setFullName] = useState("");
  const [clubCode, setClubCode] = useState("");
  const [step, setStep] = useState<"phone" | "pin" | "register">("phone");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const clubId = searchParams.get("clubId");

  const formatPhoneInput = (value: string): string => {
    // Strip all non-digits
    let cleaned = value.replace(/\D/g, "");

    // If starts with 7 or 8, remove the country code prefix to format the rest
    if (cleaned.startsWith("7") || cleaned.startsWith("8")) {
      cleaned = cleaned.slice(1);
    }

    // Limit to 10 digits (main body of the Russian phone number)
    cleaned = cleaned.slice(0, 10);

    // Build the format "+7 (XXX) XXX-XX-XX"
    let formatted = "+7";
    if (cleaned.length > 0) {
      formatted += " (" + cleaned.slice(0, 3);
    }
    if (cleaned.length > 3) {
      formatted += ") " + cleaned.slice(3, 6);
    }
    if (cleaned.length > 6) {
      formatted += "-" + cleaned.slice(6, 8);
    }
    if (cleaned.length > 8) {
      formatted += "-" + cleaned.slice(8, 10);
    }

    return formatted;
  };

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const digitsOnly = phoneNumber.replace(/\D/g, "");
    if (digitsOnly.length < 11) {
      setError("Введите корректный номер телефона");
      return;
    }
    setError("");
    setLoading(true);

    try {
      const activeClubId = clubId || clubCode;
      const refCode = searchParams.get("ref");
      const body: any = { phoneNumber };
      if (activeClubId) body.clubId = activeClubId;
      if (refCode) body.refCode = refCode;

      const res = await fetch("/api/promo/auth/login", {
        method: "POST",
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (res.status !== 200 && !data.requiresRegistration) {
        let errorMsg = data.error || "Ошибка";
        if (errorMsg.includes("отсканировать QR-код")) {
          errorMsg = "Для регистрации необходимо ввести код клуба или отсканировать QR-код в клубе";
        }
        setError(errorMsg);
        setLoading(false);
        return;
      }

      if (data.requiresRegistration) {
        setStep("register");
      } else {
        setStep("pin");
      }
    } catch (err) {
      setError("Ошибка соединения");
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const activeClubId = clubId || clubCode;
      const refCode = searchParams.get("ref");
      const body: any = { phoneNumber, pin, fullName };
      if (activeClubId) body.clubId = activeClubId;
      if (refCode) body.refCode = refCode;

      const res = await fetch("/api/promo/auth/login", {
        method: "POST",
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (data.success) {
        const action = searchParams.get("action");
        if (action) {
          router.push(
            `/promo?${new URLSearchParams({
              ...(activeClubId && { clubId: activeClubId }),
              ...(action && { action }),
            }).toString()}`,
          );
        } else {
          router.push("/promo/profile");
        }
      } else {
        setError(data.error || "Ошибка авторизации");
      }
    } catch (err) {
      setError("Ошибка соединения");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-6 font-sans">
      <div className="w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="w-20 h-20 bg-orange-500/20 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(234,88,12,0.2)]">
            <Ticket className="w-10 h-10 text-orange-500 rotate-12" />
          </div>
          <h1 className="text-4xl font-black uppercase italic tracking-tighter mb-2">
            Игровая <span className="text-orange-500">Зона</span>
          </h1>
          <p className="text-gray-500 text-sm">
            Войдите, чтобы играть и выигрывать
          </p>
        </motion.div>

        <div className="bg-[#151515] border border-white/5 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden">
          <AnimatePresence mode="wait">
            {step === "phone" && (
              <motion.form
                key="phone"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onSubmit={handlePhoneSubmit}
                className="space-y-6"
              >
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 ml-4">
                    Номер телефона
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-600" />
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(formatPhoneInput(e.target.value))}
                      placeholder="+7 (999) 000-00-00"
                      className="w-full bg-black border border-white/10 rounded-2xl py-4 pl-14 pr-6 focus:border-orange-500/50 outline-none transition-all text-lg font-bold"
                      autoFocus
                    />
                  </div>
                </div>

                {error && (
                  <p className="text-red-500 text-xs text-center font-bold">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-orange-500 hover:bg-orange-600 py-5 rounded-2xl font-black text-xl flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50 shadow-[0_10px_20px_rgba(234,88,12,0.3)]"
                >
                  {loading ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <>
                      ПРОДОЛЖИТЬ <ArrowRight className="w-6 h-6" />
                    </>
                  )}
                </button>
              </motion.form>
            )}

            {(step === "pin" || step === "register") && (
              <motion.form
                key="auth"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onSubmit={handleAuth}
                className="space-y-6"
              >
                {step === "register" && (
                  <>
                    <div className="space-y-2 animate-in fade-in duration-300">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 ml-4">
                        Ваше Имя
                      </label>
                      <div className="relative">
                        <User className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-600" />
                        <input
                          type="text"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="Александр"
                          className="w-full bg-black border border-white/10 rounded-2xl py-4 pl-14 pr-6 focus:border-orange-500/50 outline-none transition-all text-lg font-bold"
                          autoFocus
                        />
                      </div>
                    </div>

                    {!clubId && !searchParams.get("ref") && (
                      <div className="space-y-2 animate-in fade-in duration-300">
                        <div className="flex justify-between items-center px-4">
                          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
                            Код клуба
                          </label>
                          <span className="text-[9px] font-black uppercase tracking-wider text-orange-500/60">
                            для новых игроков
                          </span>
                        </div>
                        <div className="relative">
                          <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-600" />
                          <input
                            type="text"
                            maxLength={4}
                            value={clubCode}
                            onChange={(e) => setClubCode(e.target.value.toUpperCase())}
                            placeholder="ABCD"
                            className="w-full bg-black border border-white/10 rounded-2xl py-4 pl-14 pr-6 focus:border-orange-500/50 outline-none transition-all text-lg font-bold tracking-[0.25em] uppercase"
                          />
                        </div>
                      </div>
                    )}
                  </>
                )}

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 ml-4">
                    {step === "register"
                      ? "Придумайте ПИН-код (4 цифры)"
                      : "Введите Ваш ПИН-код"}
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-600" />
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={4}
                      value={pin}
                      onChange={(e) => setPin(e.target.value)}
                      placeholder="••••"
                      className="w-full bg-black border border-white/10 rounded-2xl py-4 pl-14 pr-6 focus:border-orange-500/50 outline-none transition-all text-2xl font-black tracking-[0.5em]"
                      autoFocus={step === "pin"}
                    />
                  </div>
                </div>

                {error && (
                  <p className="text-red-500 text-xs text-center font-bold">
                    {error}
                  </p>
                )}

                <div className="flex flex-col gap-3">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-orange-500 hover:bg-orange-600 py-5 rounded-2xl font-black text-xl flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50 shadow-[0_10px_20px_rgba(234,88,12,0.3)]"
                  >
                    {loading ? (
                      <Loader2 className="w-6 h-6 animate-spin" />
                    ) : step === "register" ? (
                      "ЗАРЕГИСТРИРОВАТЬСЯ"
                    ) : (
                      "ВОЙТИ"
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep("phone")}
                    className="text-gray-600 text-[10px] font-black uppercase tracking-widest hover:text-white transition-colors"
                  >
                    Изменить номер
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </div>

        <p className="mt-8 text-center text-gray-700 text-[10px] font-bold uppercase tracking-widest leading-relaxed">
          Нажимая кнопку, вы соглашаетесь с условиями <br /> использования
          игрового сервиса
        </p>
      </div>
    </div>
  );
}
