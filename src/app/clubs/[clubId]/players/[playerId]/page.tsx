"use client";

import { useEffect, useState, use } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { 
    User, Phone, Wallet, Clock, Coins, 
    Calendar, AlertCircle, Loader2, ArrowLeft,
    CheckCircle, ShieldAlert, KeyRound, Save, Plus,
    Activity, Receipt, CreditCard
} from "lucide-react";

interface SessionLog {
    id: string;
    workstationId: number;
    startedAt: string;
    endedAt: string | null;
    status: string;
    totalAmount: number;
    paidAmount: number;
}

interface TransactionLog {
    id: string;
    type: string;
    amount: number;
    paymentMethod: string;
    description: string;
    createdAt: string;
}

interface PlayerDetails {
    id: string;
    phone: string | null;
    fullName: string;
    balance: number;
    bonusBalance: number;
    totalHours: number;
    totalSpent: number;
    visitsCount: number;
    tier: string;
    loyaltyTierId: number | null;
    promisedPaymentAllowed: boolean;
}

interface LoyaltyTier {
    id: number;
    name: string;
}

export default function PlayerDetailPage({ params }: { params: Promise<{ clubId: string; playerId: string }> }) {
    const { clubId, playerId } = use(params);
    const router = useRouter();
    
    const [player, setPlayer] = useState<PlayerDetails | null>(null);
    const [history, setHistory] = useState<{ sessions: SessionLog[]; transactions: TransactionLog[] }>({ sessions: [], transactions: [] });
    const [loyaltyTiers, setLoyaltyTiers] = useState<LoyaltyTier[]>([]);
    
    const [isLoading, setIsLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState("");
    const [successMsg, setSuccessMsg] = useState("");
    
    const [activeTab, setActiveTab] = useState<"logs" | "edit" | "actions">("logs");
    const [logsSubTab, setLogsSubTab] = useState<"transactions" | "sessions">("transactions");

    // Form inputs for editing profile
    const [editName, setEditName] = useState("");
    const [editPhone, setEditPhone] = useState("");
    const [editBalance, setEditBalance] = useState(0);
    const [editBonusBalance, setEditBonusBalance] = useState(0);
    const [editTierId, setEditTierId] = useState<string>("");
    const [editPromisedAllowed, setEditPromisedAllowed] = useState(false);

    // Form inputs for actions
    const [depositAmt, setDepositAmt] = useState("");
    const [depositMethod, setDepositMethod] = useState("cash");
    
    const [bonusAmt, setBonusAmt] = useState("");
    const [bonusComment, setBonusComment] = useState("");
    
    const [tempPin, setTempPin] = useState("");

    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (clubId && playerId) {
            loadData();
        }
    }, [clubId, playerId]);

    const loadData = async () => {
        setIsLoading(true);
        setErrorMsg("");
        try {
            const res = await fetch(`/api/clubs/${clubId}/players/${playerId}`);
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || "Ошибка загрузки данных");
            }
            if (data.player) {
                setPlayer(data.player);
                setHistory(data.history || { sessions: [], transactions: [] });
                setLoyaltyTiers(data.loyaltyTiers || []);
                
                // Initialize edit form
                setEditName(data.player.fullName || "");
                setEditPhone(data.player.phone || "");
                setEditBalance(data.player.balance || 0);
                setEditBonusBalance(data.player.bonusBalance || 0);
                setEditTierId(data.player.loyaltyTierId ? String(data.player.loyaltyTierId) : "");
                setEditPromisedAllowed(Boolean(data.player.promisedPaymentAllowed));
            }
        } catch (err: any) {
            setErrorMsg(err.message || "Не удалось загрузить данные клиента");
        } finally {
            setIsLoading(false);
        }
    };

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setErrorMsg("");
        setSuccessMsg("");
        try {
            const res = await fetch(`/api/clubs/${clubId}/players/${playerId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    fullName: editName,
                    phone: editPhone,
                    balance: editBalance,
                    bonusBalance: editBonusBalance,
                    loyaltyTierId: editTierId || null,
                    promisedPaymentAllowed: editPromisedAllowed
                })
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || "Ошибка обновления профиля");
            }
            setSuccessMsg("Профиль клиента успешно обновлен!");
            loadData();
        } catch (err: any) {
            setErrorMsg(err.message || "Не удалось обновить профиль");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDepositBalance = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!depositAmt || parseFloat(depositAmt) <= 0) return;
        setIsSubmitting(true);
        setErrorMsg("");
        setSuccessMsg("");
        try {
            const res = await fetch(`/api/clubs/${clubId}/players/${playerId}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "deposit",
                    amount: parseFloat(depositAmt),
                    paymentMethod: depositMethod
                })
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || "Ошибка пополнения баланса");
            }
            setSuccessMsg(`Баланс успешно пополнен на ${depositAmt} ₽!`);
            setDepositAmt("");
            loadData();
        } catch (err: any) {
            setErrorMsg(err.message || "Не удалось пополнить баланс");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDepositBonus = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!bonusAmt || parseFloat(bonusAmt) <= 0) return;
        setIsSubmitting(true);
        setErrorMsg("");
        setSuccessMsg("");
        try {
            const res = await fetch(`/api/clubs/${clubId}/players/${playerId}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "deposit-bonus",
                    amount: parseFloat(bonusAmt),
                    comment: bonusComment
                })
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || "Ошибка начисления бонусов");
            }
            setSuccessMsg(`Успешно начислено ${bonusAmt} бонусов!`);
            setBonusAmt("");
            setBonusComment("");
            loadData();
        } catch (err: any) {
            setErrorMsg(err.message || "Не удалось начислить бонусы");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleResetPin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!tempPin) return;
        setIsSubmitting(true);
        setErrorMsg("");
        setSuccessMsg("");
        try {
            const res = await fetch(`/api/clubs/${clubId}/players/${playerId}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "reset-pin",
                    tempPin
                })
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || "Ошибка сброса PIN-кода");
            }
            setSuccessMsg("Временный PIN-код успешно установлен!");
            setTempPin("");
            loadData();
        } catch (err: any) {
            setErrorMsg(err.message || "Не удалось сбросить PIN-код");
        } finally {
            setIsSubmitting(false);
        }
    };

    const getTxTypeLabel = (type: string) => {
        switch (type) {
            case "deposit": return "Пополнение баланса";
            case "bonus_deposit": return "Начисление бонусов";
            case "session_start": return "Запуск сессии";
            case "session_extension": return "Продление сессии";
            case "session_refund": return "Возврат средств";
            case "order_payment": return "Покупка товаров";
            default: return type;
        }
    };

    const formatDate = (dateValue: any) => {
        if (!dateValue) return "—";
        const isNumeric = /^\d+$/.test(String(dateValue));
        if (isNumeric) {
            return new Date(parseInt(String(dateValue))).toLocaleString('ru-RU');
        }
        const d = new Date(dateValue);
        return isNaN(d.getTime()) ? "—" : d.toLocaleString('ru-RU');
    };

    const formatPaymentMethod = (method: string) => {
        if (!method) return "—";
        const upper = method.toUpperCase();
        if (upper === "CASH") return "Наличные";
        if (upper === "CARD") return "Карта";
        if (upper === "QR") return "СБП (QR-код)";
        if (upper === "SYSTEM") return "Вручную (Панель)";
        if (upper === "BONUS") return "Бонусы";
        if (upper.includes("____") || upper.startsWith("*")) {
            const digits = upper.replace(/[^0-9]/g, '');
            if (digits) return `Карта (*${digits})`;
            return "Карта";
        }
        return method;
    };

    const getTxTypeColor = (type: string) => {
        if (type === "bonus_deposit") return "text-amber-600 bg-amber-50 border-amber-100";
        if (type === "deposit" || type === "session_refund") return "text-emerald-600 bg-emerald-50 border-emerald-100";
        return "text-slate-700 bg-slate-50 border-slate-100";
    };

    if (isLoading) {
        return (
            <PageShell maxWidth="7xl">
                <div className="flex h-[80vh] items-center justify-center">
                    <div className="flex flex-col items-center gap-3">
                        <Loader2 className="h-12 w-12 animate-spin text-indigo-600" />
                        <span className="text-base font-bold text-slate-500">Загрузка карточки клиента...</span>
                    </div>
                </div>
            </PageShell>
        );
    }

    if (!player) {
        return (
            <PageShell maxWidth="7xl">
                <div className="bg-red-50 border border-red-100 rounded-3xl p-8 max-w-2xl mx-auto mt-12 text-center">
                    <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-red-950">Клиент не найден</h2>
                    <p className="text-red-700 mt-2">{errorMsg || "Запрошенный пользователь не найден в системе DashLock."}</p>
                    <Button onClick={() => router.push(`/clubs/${clubId}/players`)} className="mt-6 bg-slate-900 text-white rounded-xl">
                        Вернуться к списку
                    </Button>
                </div>
            </PageShell>
        );
    }

    return (
        <PageShell maxWidth="7xl">
            <div className="space-y-6 pb-16">
                {/* Back Button & Notifications */}
                <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-3">
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-10 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl"
                            onClick={() => router.push(`/clubs/${clubId}/players`)}
                        >
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            К списку клиентов
                        </Button>
                    </div>

                    {successMsg && (
                        <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-2xl p-4 flex items-center gap-3 animate-fade-in">
                            <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />
                            <span className="font-semibold text-sm">{successMsg}</span>
                        </div>
                    )}

                    {errorMsg && (
                        <div className="bg-red-50 border border-red-100 text-red-800 rounded-2xl p-4 flex items-center gap-3 animate-fade-in">
                            <ShieldAlert className="h-5 w-5 text-red-500 shrink-0" />
                            <span className="font-semibold text-sm">{errorMsg}</span>
                        </div>
                    )}
                </div>

                {/* Grid Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                    
                    {/* Left Side: Summary & Quick Actions */}
                    <div className="space-y-6">
                        {/* Profile Summary Card */}
                        <div className="bg-white border border-slate-200 shadow-sm rounded-3xl p-6 relative">
                            <div className="text-center pb-6 border-b border-slate-100">
                                <div className="h-20 w-20 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 mx-auto mb-4 border border-indigo-100/50 shadow-sm">
                                    <User className="h-10 w-10" />
                                </div>
                                <h2 className="text-2xl font-black text-slate-900 leading-tight">{player.fullName}</h2>
                                <p className="text-sm font-mono text-slate-400 mt-1.5">{player.phone || 'Номер не указан'}</p>
                                <div className="mt-3.5 inline-block">
                                    <span className="px-3 py-1 text-xs font-bold bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-full">
                                        {player.tier}
                                    </span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-6">
                                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                                    <div className="text-xs text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1.5">
                                        <Wallet className="h-4 w-4 text-emerald-500" />
                                        Депозит
                                    </div>
                                    <div className="text-xl font-extrabold text-emerald-600 mt-1">{Math.round(player.balance)} ₽</div>
                                </div>
                                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                                    <div className="text-xs text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1.5">
                                        <Coins className="h-4 w-4 text-amber-500" />
                                        Бонусы
                                    </div>
                                    <div className="text-xl font-extrabold text-amber-600 mt-1">{Math.round(player.bonusBalance)} Б</div>
                                </div>
                                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                                    <div className="text-xs text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1.5">
                                        <Clock className="h-4 w-4 text-indigo-500" />
                                        Времени
                                    </div>
                                    <div className="text-xl font-extrabold text-slate-900 mt-1">{Math.round(player.totalHours)} ч</div>
                                </div>
                                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                                    <div className="text-xs text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1.5">
                                        <Receipt className="h-4 w-4 text-violet-500" />
                                        Потрачено
                                    </div>
                                    <div className="text-xl font-extrabold text-slate-900 mt-1">{Math.round(player.totalSpent)} ₽</div>
                                </div>
                            </div>
                        </div>

                        {/* Navigation Menu (Tabs selector) */}
                        <div className="bg-white border border-slate-200 shadow-sm rounded-3xl p-3 flex flex-col gap-1">
                            <button
                                onClick={() => setActiveTab("logs")}
                                className={`flex items-center gap-3 w-full p-3 rounded-2xl text-sm font-semibold transition-colors ${activeTab === "logs" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"}`}
                            >
                                <Activity className="h-4.5 w-4.5" />
                                Логи и история операций
                            </button>
                            <button
                                onClick={() => setActiveTab("edit")}
                                className={`flex items-center gap-3 w-full p-3 rounded-2xl text-sm font-semibold transition-colors ${activeTab === "edit" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"}`}
                            >
                                <User className="h-4.5 w-4.5" />
                                Редактировать профиль
                            </button>
                            <button
                                onClick={() => setActiveTab("actions")}
                                className={`flex items-center gap-3 w-full p-3 rounded-2xl text-sm font-semibold transition-colors ${activeTab === "actions" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"}`}
                            >
                                <Plus className="h-4.5 w-4.5" />
                                Быстрые действия
                            </button>
                        </div>
                    </div>

                    {/* Right Side: Tab Contents */}
                    <div className="lg:col-span-2 space-y-6">
                        
                        {/* Tab 1: LOGS */}
                        {activeTab === "logs" && (
                            <div className="bg-white border border-slate-200 shadow-sm rounded-3xl p-6 sm:p-8">
                                <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
                                    <h3 className="text-lg font-bold text-slate-900">История активности</h3>
                                    
                                    {/* Sub-tabs selector */}
                                    <div className="bg-slate-100 rounded-xl p-1 flex items-center gap-1">
                                        <button
                                            onClick={() => setLogsSubTab("transactions")}
                                            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${logsSubTab === "transactions" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
                                        >
                                            Транзакции
                                        </button>
                                        <button
                                            onClick={() => setLogsSubTab("sessions")}
                                            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${logsSubTab === "sessions" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
                                        >
                                            Сессии
                                        </button>
                                    </div>
                                </div>

                                {logsSubTab === "transactions" ? (
                                    history.transactions.length === 0 ? (
                                        <div className="text-center py-16 text-slate-400">
                                            <Receipt className="h-10 w-10 mx-auto mb-2 text-slate-300" />
                                            Транзакции отсутствуют
                                        </div>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left text-xs sm:text-sm border-collapse">
                                                <thead>
                                                    <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                                                        <th className="p-3">Описание</th>
                                                        <th className="p-3">Тип</th>
                                                        <th className="p-3">Способ</th>
                                                        <th className="p-3 text-right">Сумма</th>
                                                        <th className="p-3 text-right">Дата</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-50">
                                                    {history.transactions.map((tx) => (
                                                        <tr key={tx.id} className="hover:bg-slate-50/50">
                                                            <td className="p-3 font-semibold text-slate-800">{tx.description}</td>
                                                            <td className="p-3">
                                                                <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md border ${getTxTypeColor(tx.type)}`}>
                                                                    {getTxTypeLabel(tx.type)}
                                                                </span>
                                                            </td>
                                                            <td className="p-3 font-medium text-slate-500">{formatPaymentMethod(tx.paymentMethod)}</td>
                                                            <td className={`p-3 text-right font-bold ${tx.type === "bonus_deposit" ? "text-amber-600" : tx.type === "deposit" || tx.type === "session_refund" ? "text-emerald-600" : "text-slate-900"}`}>
                                                                {tx.amount} {tx.type === "bonus_deposit" ? "Б" : "₽"}
                                                            </td>
                                                            <td className="p-3 text-right text-slate-400">{formatDate(tx.createdAt)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )
                                ) : (
                                    history.sessions.length === 0 ? (
                                        <div className="text-center py-16 text-slate-400">
                                            <Clock className="h-10 w-10 mx-auto mb-2 text-slate-300" />
                                            Сессии запуск-стоп отсутствуют
                                        </div>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left text-xs sm:text-sm border-collapse">
                                                <thead>
                                                    <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                                                        <th className="p-3">ПК #</th>
                                                        <th className="p-3">Старт</th>
                                                        <th className="p-3">Завершение</th>
                                                        <th className="p-3">Статус</th>
                                                        <th className="p-3 text-right">Начислено</th>
                                                        <th className="p-3 text-right">Оплачено</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-50">
                                                    {history.sessions.map((s) => (
                                                        <tr key={s.id} className="hover:bg-slate-50/50">
                                                            <td className="p-3 font-bold text-indigo-600">Компьютер {s.workstationId}</td>
                                                            <td className="p-3 text-slate-500">{formatDate(s.startedAt)}</td>
                                                            <td className="p-3 text-slate-500">{s.endedAt ? formatDate(s.endedAt) : 'Активна'}</td>
                                                            <td className="p-3">
                                                                <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md ${s.status === 'completed' ? 'text-emerald-700 bg-emerald-50' : 'text-amber-700 bg-amber-50'}`}>
                                                                    {s.status === 'completed' ? 'Завершена' : s.status}
                                                                </span>
                                                            </td>
                                                            <td className="p-3 text-right font-bold text-slate-700">{s.totalAmount} ₽</td>
                                                            <td className="p-3 text-right font-bold text-slate-900">{s.paidAmount} ₽</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )
                                )}
                            </div>
                        )}

                        {/* Tab 2: EDIT PROFILE */}
                        {activeTab === "edit" && (
                            <div className="bg-white border border-slate-200 shadow-sm rounded-3xl p-6 sm:p-8">
                                <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-4 mb-6">
                                    Редактирование профиля клиента
                                </h3>

                                <form onSubmit={handleUpdateProfile} className="space-y-5">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="fullName" className="text-xs font-bold text-slate-500 uppercase">Полное имя</Label>
                                            <Input
                                                id="fullName"
                                                type="text"
                                                className="h-11 rounded-xl border-slate-200"
                                                value={editName}
                                                onChange={(e) => setEditName(e.target.value)}
                                                required
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="phone" className="text-xs font-bold text-slate-500 uppercase">Номер телефона</Label>
                                            <Input
                                                id="phone"
                                                type="text"
                                                className="h-11 rounded-xl border-slate-200"
                                                value={editPhone}
                                                onChange={(e) => setEditPhone(e.target.value)}
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="balance" className="text-xs font-bold text-slate-500 uppercase">Основной баланс (₽)</Label>
                                            <Input
                                                id="balance"
                                                type="number"
                                                className="h-11 rounded-xl border-slate-200"
                                                value={editBalance}
                                                onChange={(e) => setEditBalance(parseFloat(e.target.value) || 0)}
                                                required
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="bonusBalance" className="text-xs font-bold text-slate-500 uppercase">Бонусный баланс (Б)</Label>
                                            <Input
                                                id="bonusBalance"
                                                type="number"
                                                className="h-11 rounded-xl border-slate-200"
                                                value={editBonusBalance}
                                                onChange={(e) => setEditBonusBalance(parseFloat(e.target.value) || 0)}
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="loyaltyTier" className="text-xs font-bold text-slate-500 uppercase">Уровень лояльности</Label>
                                            <select
                                                id="loyaltyTier"
                                                className="flex h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-slate-900"
                                                value={editTierId}
                                                onChange={(e) => setEditTierId(e.target.value)}
                                            >
                                                <option value="">Без уровня</option>
                                                {loyaltyTiers.map(t => (
                                                    <option key={t.id} value={t.id}>{t.name}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="flex items-center gap-3 pt-6 sm:pt-8">
                                            <input
                                                id="promisedAllowed"
                                                type="checkbox"
                                                className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                                checked={editPromisedAllowed}
                                                onChange={(e) => setEditPromisedAllowed(e.target.checked)}
                                            />
                                            <Label htmlFor="promisedAllowed" className="text-sm font-semibold text-slate-700 cursor-pointer">
                                                Разрешить доверительный платеж
                                            </Label>
                                        </div>
                                    </div>

                                    <div className="pt-4 border-t border-slate-100 flex justify-end">
                                        <Button
                                            type="submit"
                                            disabled={isSubmitting}
                                            className="h-11 rounded-xl bg-slate-900 hover:bg-slate-800 text-white px-6 font-semibold flex items-center gap-2"
                                        >
                                            {isSubmitting ? (
                                                <Loader2 className="h-4.5 w-4.5 animate-spin" />
                                            ) : (
                                                <Save className="h-4.5 w-4.5" />
                                            )}
                                            Сохранить изменения
                                        </Button>
                                    </div>
                                </form>
                            </div>
                        )}

                        {/* Tab 3: QUICK ACTIONS */}
                        {activeTab === "actions" && (
                            <div className="space-y-6">
                                {/* Balance Deposit Card */}
                                <div className="bg-white border border-slate-200 shadow-sm rounded-3xl p-6 sm:p-8">
                                    <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-4 mb-5 flex items-center gap-2">
                                        <Wallet className="h-5 w-5 text-emerald-500" />
                                        Пополнение баланса (депозита)
                                    </h3>
                                    
                                    <form onSubmit={handleDepositBalance} className="space-y-4">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="depositAmount" className="text-xs font-bold text-slate-500 uppercase">Сумма пополнения (₽)</Label>
                                                <Input
                                                    id="depositAmount"
                                                    type="number"
                                                    placeholder="Введите сумму..."
                                                    className="h-11 rounded-xl border-slate-200"
                                                    value={depositAmt}
                                                    onChange={(e) => setDepositAmt(e.target.value)}
                                                    required
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="paymentMethod" className="text-xs font-bold text-slate-500 uppercase">Способ оплаты</Label>
                                                <div className="flex gap-2">
                                                    <Button
                                                        type="button"
                                                        variant={depositMethod === "cash" ? "default" : "outline"}
                                                        onClick={() => setDepositMethod("cash")}
                                                        className="flex-1 h-11 rounded-xl font-semibold"
                                                    >
                                                        Наличные
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant={depositMethod === "card" ? "default" : "outline"}
                                                        onClick={() => setDepositMethod("card")}
                                                        className="flex-1 h-11 rounded-xl font-semibold"
                                                    >
                                                        Карта
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>

                                        <Button
                                            type="submit"
                                            disabled={isSubmitting || !depositAmt}
                                            className="h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-2 px-6"
                                        >
                                            Пополнить баланс
                                        </Button>
                                    </form>
                                </div>

                                {/* Bonus Deposit Card */}
                                <div className="bg-white border border-slate-200 shadow-sm rounded-3xl p-6 sm:p-8">
                                    <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-4 mb-5 flex items-center gap-2">
                                        <Coins className="h-5 w-5 text-amber-500" />
                                        Начисление бонусных баллов
                                    </h3>
                                    
                                    <form onSubmit={handleDepositBonus} className="space-y-4">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="bonusAmount" className="text-xs font-bold text-slate-500 uppercase">Сумма бонусов (Б)</Label>
                                                <Input
                                                    id="bonusAmount"
                                                    type="number"
                                                    placeholder="Введите сумму бонусов..."
                                                    className="h-11 rounded-xl border-slate-200"
                                                    value={bonusAmt}
                                                    onChange={(e) => setBonusAmt(e.target.value)}
                                                    required
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="bonusComment" className="text-xs font-bold text-slate-500 uppercase">Комментарий к начислению</Label>
                                                <Input
                                                    id="bonusComment"
                                                    type="text"
                                                    placeholder="Причина начисления..."
                                                    className="h-11 rounded-xl border-slate-200"
                                                    value={bonusComment}
                                                    onChange={(e) => setBonusComment(e.target.value)}
                                                    required
                                                />
                                            </div>
                                        </div>

                                        <Button
                                            type="submit"
                                            disabled={isSubmitting || !bonusAmt}
                                            className="h-11 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold flex items-center gap-2 px-6"
                                        >
                                            Начислить бонусы
                                        </Button>
                                    </form>
                                </div>

                                {/* Security / Reset PIN Card */}
                                <div className="bg-white border border-slate-200 shadow-sm rounded-3xl p-6 sm:p-8">
                                    <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-4 mb-5 flex items-center gap-2">
                                        <KeyRound className="h-5 w-5 text-indigo-500" />
                                        Сброс или установка PIN-кода
                                    </h3>
                                    
                                    <form onSubmit={handleResetPin} className="space-y-4">
                                        <div className="max-w-md space-y-2">
                                            <Label htmlFor="tempPin" className="text-xs font-bold text-slate-500 uppercase">Временный PIN-код (для входа на ПК)</Label>
                                            <div className="flex gap-2">
                                                <Input
                                                    id="tempPin"
                                                    type="text"
                                                    maxLength={4}
                                                    placeholder="4 цифры, например: 1234"
                                                    className="h-11 rounded-xl border-slate-200 font-mono text-center tracking-widest text-lg"
                                                    value={tempPin}
                                                    onChange={(e) => setTempPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                                                    required
                                                />
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    onClick={() => setTempPin(Math.floor(1000 + Math.random() * 9000).toString())}
                                                    className="h-11 rounded-xl font-semibold px-4 shrink-0"
                                                >
                                                    Сгенерировать
                                                </Button>
                                            </div>
                                        </div>

                                        <Button
                                            type="submit"
                                            disabled={isSubmitting || tempPin.length < 4}
                                            className="h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold flex items-center gap-2 px-6"
                                        >
                                            Установить PIN-код
                                        </Button>
                                    </form>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </PageShell>
    );
}
