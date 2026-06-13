import React, { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Gamepad2, ShoppingCart, User, Package } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

function BottomNavContent({ cartCount = 0 }: { cartCount?: number }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isShop = pathname === "/promo" && searchParams.get("tab") === "shop";
  const isGames = pathname === "/promo" && !isShop;
  const isQuests = pathname === "/promo/quests";
  const isCases = pathname === "/promo/cases";
  const isProfile = pathname === "/promo/profile";

  const [activeQuestsCount, setActiveQuestsCount] = useState<number>(0);
  const [hasCases, setHasCases] = useState<boolean>(false);

  useEffect(() => {
    async function fetchQuestsCount() {
      try {
        const res = await fetch("/api/promo/player/quests");
        if (res.ok) {
          const data = await res.json();
          const loadedQuests = data.quests || [];
          // Count quests that are active (in progress) and not locked (progress > 0)
          const active = loadedQuests.filter(
            (q: any) =>
              q.status !== "completed" &&
              q.status !== "claimed" &&
              q.status !== "pending_verification" &&
              !q.is_level_locked &&
              (q.current_progress || 0) > 0
          );
          setActiveQuestsCount(active.length);
        }
      } catch (err) {
        console.error("Failed to fetch active quests count in BottomNav", err);
      }
    }

    async function checkCases() {
      try {
        const res = await fetch("/api/promo/cases");
        if (res.ok) {
          const data = await res.json();
          setHasCases((data.cases || []).length > 0);
        }
      } catch (err) {
        console.error("Failed to check cases count in BottomNav", err);
      }
    }

    fetchQuestsCount();
    checkCases();
  }, [pathname]); // Fetch count when switching tabs to stay updated

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-xl border border-white/10 rounded-full px-6 sm:px-8 py-4 flex items-center gap-6 sm:gap-8 shadow-2xl z-50">
      <Link href="/promo" className={cn("transition-colors", isGames ? "text-orange-500" : "text-gray-500 hover:text-white")}>
        <Gamepad2 className="w-6 h-6" />
      </Link>
      <Link href="/promo/quests" className={cn("relative transition-colors text-[10px] font-black uppercase tracking-[0.2em] italic px-1 flex items-center gap-1", isQuests ? "text-orange-500" : "text-gray-500 hover:text-white")}>
        Квесты
        {activeQuestsCount > 0 && (
          <motion.span
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="absolute -top-1.5 -right-3 w-3.5 h-3.5 bg-orange-500 text-white rounded-full text-[7px] flex items-center justify-center font-black not-italic shadow-[0_0_10px_rgba(249,115,22,0.4)]"
          >
            {activeQuestsCount}
          </motion.span>
        )}
      </Link>
      {(hasCases || isCases) && (
        <Link href="/promo/cases" className={cn("relative transition-colors text-[10px] font-black uppercase tracking-[0.2em] italic px-1 flex items-center gap-1", isCases ? "text-orange-500" : "text-gray-500 hover:text-white")}>
          Кейсы
        </Link>
      )}
      <Link href="/promo?tab=shop" className={cn("relative transition-colors", isShop ? "text-orange-500" : "text-gray-500 hover:text-white")}>
        <ShoppingCart className="w-6 h-6" />
        {cartCount > 0 && (
          <span className="absolute -top-2 -right-2 w-4 h-4 bg-orange-500 rounded-full text-[8px] flex items-center justify-center text-white font-black">
            {cartCount}
          </span>
        )}
      </Link>
      <Link href="/promo/profile" className={cn("transition-colors", isProfile ? "text-orange-500" : "text-gray-500 hover:text-white")}>
        <User className="w-6 h-6" />
      </Link>
    </div>
  );
}

export function BottomNav({ cartCount = 0 }: { cartCount?: number }) {
  return (
    <Suspense fallback={null}>
      <BottomNavContent cartCount={cartCount} />
    </Suspense>
  );
}
