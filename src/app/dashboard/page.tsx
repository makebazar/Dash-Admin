"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Building2,
  Plus,
  Loader2,
  Trash2,
  AlertTriangle,
  LogOut,
  MoreVertical,
  Briefcase,
  Zap,
  ShieldAlert,
  User,
  Check,
  Menu,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";

interface Club {
  id: string;
  name: string;
  address: string | null;
  created_at: string;
  is_owner?: boolean;
  active_shift_user?: string | null;
}

interface UserData {
  id: string;
  full_name: string;
  subscription_plan: string;
  subscription_status: string;
  subscription_ends_at: string | null;
  subscription_limits: {
    max_clubs: number | null;
    max_employees_per_club: number | null;
    price_monthly: number;
  };
  is_super_admin: boolean;
}

interface SubscriptionPlanOption {
  id: number;
  code: string;
  name: string;
  tagline: string | null;
  description: string | null;
  features: string[];
  badge_text: string | null;
  badge_tone: "default" | "info" | "success" | "warning" | "danger";
  cta_text: string | null;
  card_theme: "light" | "dark" | "accent";
  display_order: number;
  is_highlighted: boolean;
  price_amount: string;
  period_unit: "day" | "month" | "year";
  period_value: number;
  is_active: boolean;
}

const STATUS_LABELS: Record<string, string> = {
  trialing: "Временный доступ",
  active: "Активна",
  expired: "Истекла",
  canceled: "Отменена",
};

const PERIOD_LABELS: Record<SubscriptionPlanOption["period_unit"], string> = {
  day: "дн",
  month: "мес",
  year: "год",
};

export default function DashboardPage() {
  const router = useRouter();
  const [clubs, setClubs] = useState<Club[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [clubToDelete, setClubToDelete] = useState<Club | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [hasEmployeeClubs, setHasEmployeeClubs] = useState(false);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [planOptions, setPlanOptions] = useState<SubscriptionPlanOption[]>([]);
  const [selectedPlan, setSelectedPlan] = useState("");
  const [isPlansLoading, setIsPlansLoading] = useState(true);
  const [isChangingPlan, setIsChangingPlan] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [selectedClubId, setSelectedClubId] = useState<string | null>(null);
  const [clubSubscription, setClubSubscription] = useState<{
    subscription_plan: string;
    subscription_status: string;
    subscription_ends_at: string | null;
  } | null>(null);

  // Profile settings states
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSavingName, setIsSavingName] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [nameSuccess, setNameSuccess] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  // Form state
  const [clubName, setClubName] = useState("");
  const [address, setAddress] = useState("");
  const hasActiveSubscription = true; // Subscriptions are club-level, so club creation is always permitted
  const clubLimit = userData?.subscription_limits?.max_clubs ?? null;
  const reachedClubLimit = clubLimit !== null && clubs.length >= clubLimit;
  const isCreateClubDisabled = reachedClubLimit;
  const currentPlanOption = planOptions.find(
    (plan) => plan.code === clubSubscription?.subscription_plan,
  );

  useEffect(() => {
    fetchClubs();
    fetchUserData();
  }, []);

  useEffect(() => {
    if (selectedClubId) {
      fetchPlanOptions(selectedClubId);
    } else if (clubs.length > 0) {
      const ownerClubs = clubs.filter((c) => c.is_owner);
      if (ownerClubs.length > 0) {
        setSelectedClubId(ownerClubs[0].id);
      }
    }
  }, [selectedClubId, clubs]);

  const fetchUserData = async () => {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      if (res.ok) {
        if (data.user?.legal_acceptance_required) {
          router.push("/legal-consent");
          return;
        }
        setUserData(data.user);
        setFullName(data.user?.full_name || "");
        if (data.employeeClubs && data.employeeClubs.length > 0) {
          setHasEmployeeClubs(true);
        }
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
    }
  };

  const fetchPlanOptions = async (clubId: string) => {
    setIsPlansLoading(true);
    try {
      const res = await fetch(`/api/subscription/self?clubId=${clubId}`);
      const data = await res.json();
      if (res.ok) {
        const plansWithDiscount = (data.plans || []).map((p: any) => ({
          ...p,
          price_amount: p.current_price || p.price_amount,
        }));
        setPlanOptions(plansWithDiscount);
        setClubSubscription(data.current);
        setSelectedPlan(data.current?.subscription_plan || "");
      } else {
        setPlanOptions([]);
      }
    } catch (error) {
      console.error("Error fetching subscription plans:", error);
      setPlanOptions([]);
    } finally {
      setIsPlansLoading(false);
    }
  };

  const fetchClubs = async () => {
    try {
      const res = await fetch("/api/clubs");
      const data = await res.json();
      if (res.ok) {
        setClubs(data.clubs);
      }
    } catch (error) {
      console.error("Error fetching clubs:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateClub = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    try {
      const res = await fetch("/api/clubs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: clubName, address }),
      });
      const data = await res.json();
      if (res.ok) {
        setIsModalOpen(false);
        setClubName("");
        setAddress("");
        fetchClubs();
      } else {
        alert(data.error || "Не удалось создать клуб");
      }
    } catch (error) {
      console.error("Error creating club:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteClub = async () => {
    if (!clubToDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/clubs?id=${clubToDelete.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setIsDeleteModalOpen(false);
        setClubToDelete(null);
        fetchClubs();
      }
    } catch (error) {
      console.error("Error deleting club:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleChangeSubscription = async (planCode: string) => {
    if (!selectedClubId) return;
    setIsChangingPlan(true);
    try {
      const res = await fetch("/api/subscription/self", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_code: planCode, club_id: selectedClubId }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const cp = (window as any).cp;
        if (!cp) {
          alert("Не удалось загрузить платежный виджет CloudPayments. Пожалуйста, перезагрузите страницу и попробуйте снова.");
          setIsChangingPlan(false);
          return;
        }

        // Map billing period to CloudPayments recurrent structure
        let cpInterval = "Month";
        let cpPeriod = 1;

        if (data.plan.period_unit === "day") {
          cpInterval = "Day";
          cpPeriod = Number(data.plan.period_value || 1);
        } else if (data.plan.period_unit === "week") {
          cpInterval = "Week";
          cpPeriod = Number(data.plan.period_value || 1);
        } else if (data.plan.period_unit === "year") {
          cpInterval = "Month";
          cpPeriod = Number(data.plan.period_value || 1) * 12; // 1 year = 12 months
        } else {
          cpInterval = "Month";
          cpPeriod = Number(data.plan.period_value || 1);
        }

        const widget = new cp.CloudPayments();
        widget.pay('charge', {
          publicId: data.publicId || data.publicTerminalId, // Mandatory Public ID
          description: `Оплата тарифа "${data.plan.name}" для клуба`,
          amount: Number(data.plan.amount),
          currency: 'RUB',
          invoiceId: data.order_id.toString(),
          accountId: userData?.id || '',
          phone: data.phone_number,
          
          // Root level receipt fallback (for start() and direct integration)
          receipt: data.receipt,
          
          // Root level fallback
          recurrent: {
            interval: cpInterval,
            period: cpPeriod
          },
          
          data: {
            customerReceipt: data.receipt, // CloudKassir 54-ФЗ
            CustomerReceipt: data.receipt,
            
            // All API and SDK casing variations to ensure 100% gateway compatibility
            cloudpayments: {
              recurrent: {
                interval: cpInterval,
                period: cpPeriod
              },
              customerReceipt: data.receipt,
              CustomerReceipt: data.receipt
            },
            cloudPayments: {
              recurrent: {
                interval: cpInterval,
                period: cpPeriod
              },
              customerReceipt: data.receipt,
              CustomerReceipt: data.receipt
            },
            recurrent: {
              interval: cpInterval,
              period: cpPeriod
            }
          }
        }, {
          onSuccess: async (options: any) => {
            console.log("Успешный платеж CloudPayments:", options);
            // После закрытия успешного платежного виджета обновляем данные
            await fetchPlanOptions(selectedClubId);
            await fetchUserData();
          },
          onFail: (reason: any, options: any) => {
            console.log("Платеж отклонен или виджет закрыт:", reason, options);
          }
        });
      } else {
        alert(data.error || "Не удалось создать заказ на подписку");
      }
    } catch (error) {
      console.error("Error changing subscription:", error);
    } finally {
      setIsChangingPlan(false);
    }
  };

  const handleUpdateName = async () => {
    setIsSavingName(true);
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: fullName }),
      });
      if (res.ok) {
        setNameSuccess(true);
        setTimeout(() => setNameSuccess(false), 3000);
        fetchUserData();
      }
    } catch (error) {
      console.error("Error updating name:", error);
    } finally {
      setIsSavingName(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (password !== confirmPassword) {
      setPasswordError("Пароли не совпадают");
      return;
    }
    setIsSavingPassword(true);
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        setPasswordSuccess(true);
        setPassword("");
        setConfirmPassword("");
        setTimeout(() => setPasswordSuccess(false), 3000);
      }
    } catch (error) {
      console.error("Error updating password:", error);
    } finally {
      setIsSavingPassword(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <>
      <Script
        src="https://widget.cloudpayments.ru/bundles/cloudpayments.js"
        strategy="lazyOnload"
      />
      <div className="min-h-screen bg-slate-50/50">
      <header className="sticky top-0 z-30 w-full border-b border-slate-200 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-black text-white">
              <Zap className="h-6 w-6 fill-current text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              DashAdmin
            </h1>
          </div>

          <div className="flex items-center gap-4 sm:gap-6 text-sm font-medium">
            {userData?.is_super_admin && (
              <Link
                href="/dashadmin-x"
                className="text-red-600 hover:text-red-700 transition-colors flex items-center gap-2"
                title="Панель управления"
              >
                <ShieldAlert className="h-5 w-5 sm:h-4 sm:w-4" />
                <span className="hidden md:inline">Панель управления</span>
              </Link>
            )}
            {hasEmployeeClubs && (
              <Link
                href="/employee/dashboard"
                className="text-purple-600 hover:text-purple-700 transition-colors flex items-center gap-2"
                title="Выйти на смену"
              >
                <Briefcase className="h-5 w-5 sm:h-4 sm:w-4" />
                <span className="hidden md:inline">Выйти на смену</span>
              </Link>
            )}
            <button
              onClick={() => setIsProfileModalOpen(true)}
              className="text-slate-500 hover:text-slate-700 transition-colors flex items-center gap-2"
              title="Профиль"
            >
              <User className="h-5 w-5 sm:h-4 sm:w-4" />
              <span className="hidden md:inline">Профиль</span>
            </button>
            <button
              onClick={handleLogout}
              className="text-slate-500 hover:text-slate-700 transition-colors flex items-center gap-2"
              title="Выйти"
            >
              <LogOut className="h-5 w-5 sm:h-4 sm:w-4" />
              <span className="hidden md:inline">Выйти</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h2 className="text-4xl font-bold tracking-tight text-slate-900 mb-2">
              Мои клубы
            </h2>
            <p className="text-lg text-slate-500">
              Управляйте вашими компьютерными клубами и их показателями
            </p>
          </div>
          <Button
            onClick={() => setIsModalOpen(true)}
            className="h-12 rounded-xl bg-black text-white hover:bg-slate-800 transition-all gap-2 px-6 shadow-sm"
          >
            <Plus className="h-5 w-5" />
            Добавить клуб
          </Button>
        </div>

        {/* Section: Clubs Grid */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 mb-20">
          {clubs.map((club) => (
            <Link
              key={club.id}
              href={`/clubs/${club.id}`}
              className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white transition-all hover:border-black hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
            >
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      ВЫРУЧКА ЗА МЕСЯЦ
                    </p>
                    <p className="text-2xl font-bold text-slate-900">
                      {new Number(
                        (club as any).monthly_revenue || 0,
                      ).toLocaleString("ru-RU")}{" "}
                      ₽
                    </p>
                  </div>
                  {club.active_shift_user && (
                    <div className="text-right space-y-1 pr-2">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        НА СМЕНЕ
                      </p>
                      <p className="text-sm font-bold text-slate-700">
                        {club.active_shift_user}
                      </p>
                    </div>
                  )}
                  {club.is_owner && (
                    <div onClick={(e) => e.preventDefault()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            className="h-8 w-8 rounded-lg p-0 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl">
                          <DropdownMenuItem
                            className="text-red-600 focus:text-red-600 rounded-lg cursor-pointer"
                            onClick={() => {
                              setClubToDelete(club);
                              setIsDeleteModalOpen(true);
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Удалить клуб
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 group-hover:text-black transition-colors">
                      {club.name}
                    </h3>
                    <p className="text-sm text-slate-500 line-clamp-1">
                      {club.address || "Адрес не указан"}
                    </p>
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-emerald-500" />
                      <span className="text-xs font-medium text-slate-600">
                        Активна
                      </span>
                      {(club as any).subscription_ends_at && (
                        <span className="text-[10px] text-slate-400 ml-1">
                          • до{" "}
                          {new Date(
                            (club as any).subscription_ends_at,
                          ).toLocaleDateString("ru-RU", {
                            day: "numeric",
                            month: "short",
                          })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Link>
          ))}
        </div>

        {/* Section: Subscription */}
        <div>
          <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight mb-2">
                Тарифный план
              </h2>
              <p className="text-slate-500">Управление подписками клубов</p>
            </div>

            {clubs.filter((c) => c.is_owner).length > 0 && (
              <div className="min-w-50">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                  Выберите клуб
                </Label>
                <select
                  value={selectedClubId || ""}
                  onChange={(e) => setSelectedClubId(e.target.value)}
                  className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-black transition-all appearance-none cursor-pointer"
                >
                  {clubs
                    .filter((c) => c.is_owner)
                    .map((club) => (
                      <option key={club.id} value={club.id}>
                        {club.name}
                      </option>
                    ))}
                </select>
              </div>
            )}
          </div>

          {clubs.filter((c) => c.is_owner).length > 0 && (
            <div className="mb-8 bg-blue-50 border border-blue-100 rounded-2xl p-4 flex gap-4 items-start">
              <div className="p-2 bg-blue-100 rounded-xl text-blue-700 shrink-0">
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-blue-900">
                  Выгодные условия для сетей
                </h4>
                <p className="text-sm text-blue-800 mt-1">
                  Первый активный клуб в сети оплачивается по базовому тарифу.
                  На <strong>все последующие клубы</strong> автоматически
                  действует постоянная скидка 50%.
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-start">
            {/* Current Status */}
            <div className="w-full lg:w-1/3 rounded-2xl border border-slate-200 bg-white p-8">
              <p className="text-sm font-medium text-slate-500 mb-2">
                Текущий статус
              </p>
              <div className="flex items-center gap-3 mb-8">
                <div
                  className={`h-2 w-2 rounded-full ${clubSubscription?.subscription_status === "active" || clubSubscription?.subscription_status === "trialing" ? "bg-emerald-500" : "bg-red-500"}`}
                />
                <span className="text-lg font-semibold">
                  {STATUS_LABELS[
                    clubSubscription?.subscription_status || "trialing"
                  ] || "Временный доступ"}
                </span>
                <span className="ml-auto rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                  {currentPlanOption
                    ? currentPlanOption.name
                    : clubSubscription?.subscription_plan === "trial"
                      ? "Пробный период"
                      : "Неизвестный тариф"}
                </span>
              </div>

              <p className="text-sm font-medium text-slate-500 mb-2">
                Оплачено до
              </p>
              <p className="text-lg font-semibold mb-8">
                {clubSubscription?.subscription_ends_at
                  ? new Date(
                      clubSubscription.subscription_ends_at,
                    ).toLocaleDateString("ru-RU", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })
                  : "Бессрочно"}
              </p>

              <div className="pt-8 border-t border-slate-100">
                <p className="text-sm font-medium text-slate-500 mb-2">
                  Текущий платеж
                </p>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold tracking-tight">
                    {clubSubscription?.subscription_plan === "trial"
                      ? "0"
                      : Number(
                          currentPlanOption?.price_amount || 0,
                        ).toLocaleString("ru-RU")}{" "}
                    ₽
                  </span>
                  <span className="text-slate-500 font-medium">
                    /{" "}
                    {clubSubscription?.subscription_plan === "trial"
                      ? "14 дн"
                      : currentPlanOption
                        ? PERIOD_LABELS[currentPlanOption.period_unit]
                        : "мес"}
                  </span>
                </div>
              </div>
            </div>

            {/* Plans Selection */}
            <div className="w-full lg:w-2/3">
              {isPlansLoading ? (
                <div className="h-48 flex items-center justify-center rounded-2xl border border-slate-200 bg-white">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                </div>
              ) : planOptions.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">
                  Нет доступных тарифов
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {planOptions.map((plan) => {
                    const isSelected = selectedPlan === plan.code;
                    return (
                      <div
                        key={plan.id}
                        className={`relative flex flex-col rounded-2xl border p-6 transition-all ${
                          plan.card_theme === "dark"
                            ? "bg-slate-900 border-slate-900 text-white"
                            : isSelected
                              ? "bg-white border-black shadow-[0_8px_30px_rgb(0,0,0,0.08)]"
                              : "bg-white border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        {plan.is_highlighted && (
                          <div className="absolute -top-3 left-6">
                            <span className="rounded-full bg-blue-600 px-3 py-1 text-xs font-bold tracking-wide text-white">
                              Популярный
                            </span>
                          </div>
                        )}

                        <div className="mb-6">
                          <h3 className="text-2xl font-bold tracking-tight mb-1">
                            {plan.name}
                          </h3>
                          <p
                            className={`text-sm ${plan.card_theme === "dark" ? "text-slate-400" : "text-slate-500"}`}
                          >
                            {plan.description || plan.tagline}
                          </p>
                        </div>

                        <div className="mb-8 flex items-baseline gap-1">
                          <span className="text-3xl font-bold tracking-tight">
                            {Number(plan.price_amount || 0).toLocaleString(
                              "ru-RU",
                            )}{" "}
                            ₽
                          </span>
                          <span
                            className={`text-sm font-medium ${plan.card_theme === "dark" ? "text-slate-400" : "text-slate-500"}`}
                          >
                            / {plan.period_value}{" "}
                            {PERIOD_LABELS[plan.period_unit]}
                          </span>
                        </div>

                        <div className="flex-1 space-y-3 mb-8">
                          {(plan.features || []).map((feature, idx) => (
                            <div
                              key={`${plan.code}-${idx}`}
                              className="flex items-start gap-3"
                            >
                              <Check
                                className={`h-5 w-5 shrink-0 ${plan.card_theme === "dark" ? "text-blue-400" : "text-black"}`}
                              />
                              <span
                                className={`text-sm leading-tight ${plan.card_theme === "dark" ? "text-slate-300" : "text-slate-600"}`}
                              >
                                {feature}
                              </span>
                            </div>
                          ))}
                        </div>

                        <Button
                          className={`w-full h-12 rounded-xl font-medium text-base transition-all ${
                            plan.card_theme === "dark"
                              ? "bg-white text-black hover:bg-slate-200"
                              : isSelected
                                ? "bg-slate-100 text-slate-400 cursor-default hover:bg-slate-100"
                                : "bg-black text-white hover:bg-slate-800"
                          }`}
                          onClick={() => {
                            if (!isSelected)
                              handleChangeSubscription(plan.code);
                          }}
                          disabled={isChangingPlan || isSelected}
                        >
                          {isChangingPlan && selectedPlan === plan.code ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                          ) : isSelected ? (
                            "Текущий тариф"
                          ) : (
                            plan.cta_text || "Выбрать тариф"
                          )}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Modals */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-106.25 rounded-2xl p-8 border-slate-200">
          <DialogHeader className="mb-6">
            <DialogTitle className="text-2xl font-bold">Новый клуб</DialogTitle>
            <DialogDescription className="text-slate-500">
              Введите название и адрес вашего клуба
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateClub} className="space-y-6">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Название
              </Label>
              <Input
                value={clubName}
                onChange={(e) => setClubName(e.target.value)}
                className="h-12 rounded-xl border-slate-200 bg-slate-50 focus-visible:ring-1 focus-visible:ring-black focus-visible:bg-white text-base transition-all"
                placeholder="Например, Colizeum Савушкина"
                required
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Адрес
              </Label>
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="h-12 rounded-xl border-slate-200 bg-slate-50 focus-visible:ring-1 focus-visible:ring-black focus-visible:bg-white text-base transition-all"
                placeholder="ул. Савушкина 5"
              />
            </div>
            <DialogFooter className="pt-4">
              <Button
                type="submit"
                disabled={isCreating}
                className="w-full h-12 rounded-xl bg-black text-white hover:bg-slate-800 transition-all font-bold text-base shadow-sm"
              >
                {isCreating ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  "Создать клуб"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl border-slate-200">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Удалить клуб?
            </DialogTitle>
            <DialogDescription className="text-slate-500 pt-2">
              Это действие необратимо. Все данные клуба{" "}
              <b>{clubToDelete?.name}</b> будут полностью удалены.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 pt-6">
            <Button
              variant="outline"
              className="flex-1 h-12 rounded-xl border-slate-200 hover:bg-slate-50 font-semibold"
              onClick={() => setIsDeleteModalOpen(false)}
            >
              Отмена
            </Button>
            <Button
              variant="destructive"
              className="flex-1 h-12 rounded-xl bg-red-600 hover:bg-red-700 font-semibold shadow-sm"
              onClick={handleDeleteClub}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                "Удалить"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Profile Modal */}
      <Dialog open={isProfileModalOpen} onOpenChange={setIsProfileModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl border-slate-200 p-8">
          <DialogHeader className="mb-6">
            <DialogTitle className="text-2xl font-bold">
              Настройки профиля
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-8">
            <div className="space-y-4">
              <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                Личные данные
              </Label>
              <div className="flex gap-2">
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="h-12 rounded-xl border-slate-200 bg-slate-50 focus-visible:ring-1 focus-visible:ring-black text-base"
                  placeholder="Ваше имя"
                />
                <Button
                  onClick={handleUpdateName}
                  disabled={isSavingName}
                  className="h-12 rounded-xl bg-black px-6"
                >
                  {isSavingName ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "ОК"
                  )}
                </Button>
              </div>
              {nameSuccess && (
                <p className="text-xs text-emerald-600 font-medium">
                  Имя обновлено
                </p>
              )}
            </div>

            <div className="space-y-4 pt-4 border-t border-slate-100">
              <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                Смена пароля
              </Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 rounded-xl border-slate-200 bg-slate-50 focus-visible:ring-1 focus-visible:ring-black text-base"
                placeholder="Новый пароль"
              />
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="h-12 rounded-xl border-slate-200 bg-slate-50 focus-visible:ring-1 focus-visible:ring-black text-base"
                placeholder="Подтвердите пароль"
              />
              {passwordError && (
                <p className="text-xs text-red-500 font-medium">
                  {passwordError}
                </p>
              )}
              <Button
                onClick={handleUpdatePassword}
                disabled={isSavingPassword || !password}
                className="w-full h-12 rounded-xl bg-black font-bold shadow-sm"
              >
                {isSavingPassword ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Обновить пароль"
                )}
              </Button>
              {passwordSuccess && (
                <p className="text-xs text-emerald-600 font-medium text-center">
                  Пароль успешно изменен
                </p>
              )}
            </div>

            <div className="pt-4">
              <Button
                variant="outline"
                className="w-full h-12 rounded-xl border-slate-200 text-slate-500 hover:bg-slate-50"
                onClick={() => setIsProfileModalOpen(false)}
              >
                Закрыть
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </>
  );
}
