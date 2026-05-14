import React, { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Gamepad2, Target, ShoppingCart, User } from "lucide-react";
import { cn } from "@/lib/utils";

function BottomNavContent({ cartCount = 0 }: { cartCount?: number }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isShop = pathname === "/promo" && searchParams.get("tab") === "shop";
  const isGames = pathname === "/promo" && !isShop;
  const isQuests = pathname === "/promo/quests";
  const isProfile = pathname === "/promo/profile";

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-xl border border-white/10 rounded-full px-6 sm:px-8 py-4 flex items-center gap-6 sm:gap-8 shadow-2xl z-50">
      <Link href="/promo" className={cn("transition-colors", isGames ? "text-orange-500" : "text-gray-500 hover:text-white")}>
        <Gamepad2 className="w-6 h-6" />
      </Link>
      <Link href="/promo/quests" className={cn("transition-colors", isQuests ? "text-orange-500" : "text-gray-500 hover:text-white")}>
        <Target className="w-6 h-6" />
      </Link>
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
