"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Zap,
  LayoutDashboard,
  Users,
  LogOut,
  User,
  Store,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface UserData {
  id: string;
  full_name: string;
  is_super_admin: boolean;
}

const NAV_ITEMS = [
  { label: "Обзор", href: "/dashadmin-x", icon: LayoutDashboard },
  { label: "Пользователи", href: "/dashadmin-x/users", icon: Users },
  { label: "Клубы", href: "/dashadmin-x/clubs", icon: Store },
  { label: "Роли", href: "/dashadmin-x/roles", icon: Shield },
];

export default function DashAdminXLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      if (res.ok) {
        if (data.user?.legal_acceptance_required) {
          router.push("/legal-consent");
          return;
        }
        if (!data.user?.is_super_admin) {
          router.push("/dashboard");
          return;
        }
        setUserData(data.user);
      } else {
        router.push("/login");
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
      router.push("/login");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen bg-[#FAFAFA] items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-slate-200 border-t-slate-900 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#FAFAFA]">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 bottom-0 w-64 bg-white border-r border-slate-200 flex flex-col">
        {/* Logo */}
        <div className="h-20 flex items-center px-6 border-b border-slate-100">
          <Link href="/dashadmin-x" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-black">
              <Zap className="h-4 w-4 text-white fill-current" />
            </div>
            <span className="text-lg font-bold tracking-tight text-slate-900">
              DashAdmin
            </span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashadmin-x" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                  isActive
                    ? "bg-slate-100 text-slate-900"
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-50",
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User section */}
        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center gap-3 px-3 py-2.5 mb-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100">
              <User className="h-4 w-4 text-slate-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">
                {userData?.full_name || "Администратор"}
              </p>
              <p className="text-xs text-slate-500">Super Admin</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-all"
          >
            <LogOut className="h-5 w-5" />
            <span>Выйти</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 ml-64">
        <div className="min-h-screen">{children}</div>
      </main>
    </div>
  );
}
