"use client";

import React from "react";
import { motion, Variants } from "framer-motion";
import { Ticket, ArrowRight, Gamepad2, Gift, Zap, Star } from "lucide-react";
import Link from "next/link";

interface LandingViewProps {
  clubId: string | null;
  clubName: string | null;
  action?: string | null;
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.1,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 300, damping: 24 },
  },
};

export const LandingView = ({ clubId, clubName, action }: LandingViewProps) => {
  return (
    <div className="relative min-h-dvh bg-[#050505] text-white flex flex-col items-center justify-center p-6 text-center font-sans overflow-hidden">
      {/* Dynamic Background */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.2, 0.15, 0.2],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-[20%] -left-[10%] w-75 h-75 sm:w-125 sm:h-125 bg-orange-600/30 rounded-full blur-[100px]"
        />
        <motion.div
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.15, 0.2, 0.15],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1,
          }}
          className="absolute top-[60%] -right-[20%] w-62.5 h-62.5 sm:w-100 sm:h-100 bg-red-600/30 rounded-full blur-[100px]"
        />
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 max-w-md w-full flex flex-col items-center justify-center h-full my-auto py-10"
      >
        {/* Logo/Icon */}
        <motion.div variants={itemVariants} className="relative mb-8">
          <div className="absolute inset-0 bg-orange-500/20 blur-xl rounded-full" />
          <div className="w-24 h-24 sm:w-28 sm:h-28 bg-linear-to-br from-[#1a1a1a] to-[#0a0a0a] rounded-[2.5rem] flex items-center justify-center border border-white/10 shadow-2xl relative z-10">
            <Ticket className="w-12 h-12 sm:w-14 sm:h-14 text-orange-500 rotate-12" />
          </div>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="absolute -top-2 -right-2 w-8 h-8 bg-[#151515] rounded-full border border-white/10 flex items-center justify-center z-20 shadow-lg"
          >
            <Star className="w-4 h-4 text-yellow-500" />
          </motion.div>
        </motion.div>

        {/* Club Badge */}
        {clubName && (
          <motion.div
            variants={itemVariants}
            className="inline-block mb-6 bg-orange-500/10 px-4 py-1.5 rounded-full border border-orange-500/30 backdrop-blur-md"
          >
            <span className="text-[10px] sm:text-xs font-black text-orange-500 uppercase tracking-[0.2em]">
              {clubName}
            </span>
          </motion.div>
        )}

        <motion.h1
          variants={itemVariants}
          className="text-5xl sm:text-6xl font-black uppercase italic tracking-tighter mb-4 leading-[1.1]"
        >
          Игровая <br />
          <span className="text-transparent bg-clip-text bg-linear-to-r from-orange-400 to-red-500">
            Зона
          </span>
        </motion.h1>

        <motion.p
          variants={itemVariants}
          className="text-gray-400 text-sm sm:text-base mb-10 leading-relaxed font-medium px-4"
        >
          Играй в мини-игры, побеждай в квестах и обменивай билеты на реальные
          призы прямо в клубе.
        </motion.p>

        {/* Features Chips */}
        <motion.div
          variants={itemVariants}
          className="flex flex-wrap justify-center gap-3 mb-12"
        >
          <div className="flex items-center gap-2 px-4 py-2.5 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-sm">
            <Gamepad2 className="w-4 h-4 text-orange-400" />
            <span className="text-[10px] font-black uppercase tracking-widest text-white/90">
              7+ Игр
            </span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2.5 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-sm">
            <Gift className="w-4 h-4 text-orange-400" />
            <span className="text-[10px] font-black uppercase tracking-widest text-white/90">
              Призы
            </span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2.5 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-sm">
            <Zap className="w-4 h-4 text-orange-400" />
            <span className="text-[10px] font-black uppercase tracking-widest text-white/90">
              Бонусы
            </span>
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="w-full">
          <Link
            href={`/promo/login?${new URLSearchParams({
              ...(clubId && { clubId }),
              ...(action && { action }),
            }).toString()}`}
            className="group relative flex items-center justify-center w-full bg-linear-to-r from-orange-500 to-red-600 text-white py-5 rounded-[2rem] font-black text-xl transition-all active:scale-[0.98] shadow-[0_20px_40px_rgba(234,88,12,0.3)] overflow-hidden"
          >
            {/* Shimmer Effect */}
            <div className="absolute inset-0 w-[200%] h-full bg-linear-to-r from-transparent via-white/20 to-transparent -translate-x-[150%] group-hover:translate-x-[50%] transition-transform duration-1000 ease-in-out" />

            <span className="relative z-10 tracking-wide">НАЧАТЬ ИГРАТЬ</span>
            <ArrowRight className="ml-3 w-6 h-6 group-hover:translate-x-1 transition-transform relative z-10" />
          </Link>
        </motion.div>

        {!clubId && (
          <motion.p
            variants={itemVariants}
            className="mt-8 text-white/30 text-[10px] font-black uppercase tracking-[0.2em] leading-loose"
          >
            Чтобы привязаться к клубу, <br /> отсканируйте QR на столе
          </motion.p>
        )}
      </motion.div>

      {/* Footer Decoration */}
      <div className="absolute bottom-6 left-0 right-0 text-center pointer-events-none">
        <div className="text-[9px] font-black text-white/10 uppercase tracking-[0.5em]">
          DashAdmin Gamification
        </div>
      </div>
    </div>
  );
};
