"use client";

import { useEffect, useState, use } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { 
    Search, User, Phone, Wallet, Clock, Coins, 
    Calendar, AlertCircle, Loader2, ArrowRight
} from "lucide-react";

interface Player {
    id: string;
    phone: string | null;
    full_name: string;
    balance: number;
    bonus_balance: number;
    total_hours: number;
    total_spent: number;
    updated_at: string;
    tier: string;
    visits_count: number;
}

export default function PlayersPage({ params }: { params: Promise<{ clubId: string }> }) {
    const { clubId } = use(params);
    const router = useRouter();
    const [players, setPlayers] = useState<Player[]>([]);
    const [search, setSearch] = useState("");
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (clubId) {
            fetchPlayers();
        }
    }, [clubId]);

    const fetchPlayers = async (searchVal = "") => {
        setIsLoading(true);
        try {
            const url = `/api/clubs/${clubId}/players${searchVal ? `?search=${encodeURIComponent(searchVal)}` : ""}`;
            const res = await fetch(url);
            const data = await res.json();
            if (res.ok && Array.isArray(data.players)) {
                setPlayers(data.players);
            }
        } catch (error) {
            console.error("Error fetching players:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        fetchPlayers(search);
    };

    // Calculate quick stats from loaded players list
    const totalPlayers = players.length;
    const totalDeposits = players.reduce((sum, p) => sum + (p.balance || 0), 0);
    const totalBonuses = players.reduce((sum, p) => sum + (p.bonus_balance || 0), 0);

    const getTierBadgeClass = (tier: string) => {
        const lower = tier.toLowerCase();
        if (lower.includes('gold') || lower.includes('золот')) {
            return 'bg-amber-100 text-amber-800 border-amber-200';
        } else if (lower.includes('silver') || lower.includes('серебр')) {
            return 'bg-slate-100 text-slate-700 border-slate-200';
        } else if (lower.includes('bronze') || lower.includes('бронз')) {
            return 'bg-orange-100 text-orange-800 border-orange-200';
        }
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
    };

    return (
        <PageShell maxWidth="7xl">
            <div className="space-y-8 pb-12 max-w-full">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">
                            База клиентов
                        </h1>
                        <p className="text-slate-500 text-lg mt-1">
                            Управление клиентами, балансами и статистикой посещений в реальном времени
                        </p>
                    </div>
                </div>

                {/* Quick Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Всего клиентов в списке</p>
                        <h3 className="text-2xl font-bold text-slate-950 mt-1">{totalPlayers}</h3>
                    </div>
                    <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Общий баланс (депозиты)</p>
                        <h3 className="text-2xl font-bold text-emerald-600 mt-1">{Math.round(totalDeposits).toLocaleString()} ₽</h3>
                    </div>
                    <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Общие бонусы</p>
                        <h3 className="text-2xl font-bold text-amber-600 mt-1">{Math.round(totalBonuses).toLocaleString()} Б</h3>
                    </div>
                </div>

                {/* Main Card */}
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8">
                    {/* Search and Filters */}
                    <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3 mb-6">
                        <div className="relative flex-1">
                            <Input
                                type="text"
                                className="h-12 rounded-xl pl-4 border-slate-200 focus:ring-slate-900 text-base"
                                placeholder="Поиск по имени или номеру телефона..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                        <Button type="submit" className="h-12 rounded-xl bg-slate-900 hover:bg-slate-800 text-white px-6 text-base font-semibold">
                            Найти клиента
                        </Button>
                    </form>

                    {isLoading ? (
                        <div className="flex h-72 items-center justify-center">
                            <div className="flex flex-col items-center gap-2">
                                <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
                                <span className="text-sm font-semibold text-slate-500">Загрузка клиентов...</span>
                            </div>
                        </div>
                    ) : players.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <p className="text-lg font-bold text-slate-900">Игроки не найдены</p>
                            <p className="text-slate-500 mt-1">Попробуйте изменить поисковый запрос или обновить страницу</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto border border-slate-100 rounded-2xl">
                            <table className="w-full text-left border-collapse text-sm">
                                <thead>
                                    <tr className="bg-slate-50/75 border-b border-slate-100 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                                        <th className="p-4">ФИО Игрока</th>
                                        <th className="p-4">Телефон</th>
                                        <th className="p-4">Уровень</th>
                                        <th className="p-4 text-right">Визиты</th>
                                        <th className="p-4 text-right">Сыграно времени</th>
                                        <th className="p-4 text-right">Депозит</th>
                                        <th className="p-4 text-right">Бонусы</th>
                                        <th className="p-4 text-right">Расходы</th>
                                        <th className="p-4 text-right">Действия</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {players.map((p) => (
                                        <tr 
                                            key={p.id}
                                            className="hover:bg-slate-50/50 cursor-pointer transition-colors"
                                            onClick={() => router.push(`/clubs/${clubId}/players/${p.id}`)}
                                        >
                                            <td className="p-4 font-bold text-slate-900">
                                                {p.full_name}
                                            </td>
                                            <td className="p-4 text-slate-500 font-mono">{p.phone || '—'}</td>
                                            <td className="p-4">
                                                <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${getTierBadgeClass(p.tier)}`}>
                                                    {p.tier}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right font-medium text-slate-700">{p.visits_count}</td>
                                            <td className="p-4 text-right font-medium text-slate-700">{Math.round(p.total_hours)} ч</td>
                                            <td className="p-4 text-right text-emerald-600 font-bold">{Math.round(p.balance)} ₽</td>
                                            <td className="p-4 text-right text-amber-600 font-bold">{Math.round(p.bonus_balance)} Б</td>
                                            <td className="p-4 text-right font-bold text-slate-900">{Math.round(p.total_spent)} ₽</td>
                                            <td className="p-4 text-right">
                                                <Button 
                                                    variant="ghost" 
                                                    size="sm" 
                                                    className="h-8 text-indigo-600 hover:text-indigo-900 hover:bg-indigo-50 rounded-lg flex items-center gap-1 ml-auto"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        router.push(`/clubs/${clubId}/players/${p.id}`);
                                                    }}
                                                >
                                                    Профиль
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </PageShell>
    );
}

