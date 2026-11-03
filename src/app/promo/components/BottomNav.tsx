import React, { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Gamepad2, User, Swords, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

function BottomNavContent() {
  const pathname = usePathname();
  const isGames = pathname === "/promo";
  const isCases = pathname === "/promo/cases";
  const isFrag = pathname === "/promo/frag";
  const isProfile = pathname === "/promo/profile";
  const isTournaments = pathname.startsWith("/promo/tournaments");

  const [hasCases, setHasCases] = useState<boolean>(false);
  const [hasFrag, setHasFrag] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    async function checkNavStatus() {
      try {
        const [casesRes, playerRes] = await Promise.all([
          fetch("/api/promo/cases").catch(() => null),
          fetch("/api/promo/player").catch(() => null),
        ]);
        if (!isMounted) return;
        if (casesRes && casesRes.ok) {
          const data = await casesRes.json();
          setHasCases((data.cases || []).length > 0);
        }
        if (playerRes && playerRes.ok) {
          const data = await playerRes.json();
          setHasFrag(Boolean(data.player?.settings?.frag?.is_active));
        }
      } catch (err) {
        console.error("Failed to check status in BottomNav", err);
      }
    }

    checkNavStatus();
    window.addEventListener("promo-player-updated", checkNavStatus);
    return () => {
      isMounted = false;
      window.removeEventListener("promo-player-updated", checkNavStatus);
    };
  }, [pathname]);

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-xl border border-white/10 rounded-full px-5 sm:px-7 py-3 flex items-center gap-5 sm:gap-7 shadow-2xl z-50">
      <Link href="/promo" className={cn("flex items-center justify-center w-7 h-7 transition-colors", isGames ? "text-orange-500" : "text-gray-500 hover:text-white")} title="Игры">
        <Gamepad2 className="w-5 h-5" />
      </Link>
      {(hasCases || isCases) && (
        <Link href="/promo/cases" className={cn("relative transition-colors text-[10px] font-black uppercase tracking-[0.2em] italic px-1 flex items-center gap-1", isCases ? "text-orange-500" : "text-gray-500 hover:text-white")}>
          Кейсы
        </Link>
      )}
      {(hasFrag || isFrag) && (
        <Link href="/promo/frag" className={cn("flex items-center justify-center w-7 h-7 transition-colors", isFrag ? "text-orange-500" : "text-gray-500 hover:text-white")} title="DashFrag">
          <Swords className="w-5 h-5" />
        </Link>
      )}
      <Link href="/promo/tournaments" className={cn("flex items-center justify-center w-7 h-7 transition-colors", isTournaments ? "text-orange-500" : "text-gray-500 hover:text-white")} title="Турниры">
        <Trophy className="w-5 h-5" />
      </Link>
      <Link href="/promo/profile" className={cn("flex items-center justify-center w-7 h-7 transition-colors", isProfile ? "text-orange-500" : "text-gray-500 hover:text-white")} title="Профиль">
        <User className="w-5 h-5" />
      </Link>
    </div>
  );
}

export function BottomNav({ cartCount = 0 }: { cartCount?: number }) {
  return (
    <Suspense fallback={null}>
      <BottomNavContent />
    </Suspense>
  );
}
