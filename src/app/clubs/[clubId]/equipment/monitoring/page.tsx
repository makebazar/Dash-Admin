"use client"

import { useEffect, useState, use } from "react"
import { useParams, useRouter } from "next/navigation"
import {
    Activity,
    Cpu,
    HardDrive,
    Copy,
    RefreshCw,
    AlertCircle,
    CheckCircle2,
    Crown,
    Unlink,
    Link2,
    Gamepad2,
    ChevronDown,
    ChevronUp,
    Search,
    BookOpen,
    ArrowLeft
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PageShell, PageHeader } from "@/components/layout/PageShell"
import Link from "next/link"

interface TelemetryDisk {
    name: string
    mount: string
    total_bytes: number
    free_bytes: number
}

interface TelemetryGpu {
    name: string
    temp: number
    usage: number
    memory_used: number
    memory_total: number
}

interface TelemetryData {
    cpu_model: string | null
    cpu_temp: number
    cpu_usage: number
    gpu_data: TelemetryGpu[] | string | null
    memory: { total_bytes: number; used_bytes: number } | string | null
    memory_usage: number
    disks: TelemetryDisk[] | string | null
    devices: any[] | string | null
    created_at: string
}

interface Workstation {
    id: string
    name: string
    zone: string
    binding_code: string | null
    agent_status: "ONLINE" | "OFFLINE"
    agent_last_seen: string | null
    is_master: boolean
    assigned_user_name?: string | null
}

interface GameStatus {
    game_name: string
    app_id: number
    installed_build: string | null
    ref_build: string | null
    is_update_required: boolean
    statusText: string
    statusCode: 'READY' | 'UPDATE_REQUIRED' | 'UPDATE_LAN' | 'INSTALL_LAN'
    canUpdate: boolean
    isCommandPending: boolean
}

export default function MonitoringPage() {
    const params = useParams()
    const router = useRouter()
    const clubId = params.clubId as string

    const [workstations, setWorkstations] = useState<Workstation[]>([])
    const [telemetry, setTelemetry] = useState<Record<string, TelemetryData>>({})
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState("")
    const [filterZone, setFilterZone] = useState<string>("ALL")
    const [filterStatus, setFilterStatus] = useState<string>("ALL")
    const [expandedWorkstation, setExpandedWorkstation] = useState<string | null>(null)
    const [workstationGames, setWorkstationGames] = useState<Record<string, GameStatus[]>>({})
    const [loadingGames, setLoadingGames] = useState<Record<string, boolean>>({})
    const [copiedId, setCopiedId] = useState<string | null>(null)
    const [updatingGames, setUpdatingGames] = useState<Record<string, boolean>>({})
    const [actionLoading, setActionLoading] = useState<string | null>(null)
    const [showHelp, setShowHelp] = useState(false)

    useEffect(() => {
        fetchWorkstations()
        const interval = setInterval(fetchWorkstations, 15000) // Poll every 15s
        return () => clearInterval(interval)
    }, [clubId])

    const fetchWorkstations = async () => {
        try {
            const res = await fetch(`/api/clubs/${clubId}/workstations`, { cache: 'no-store' })
            const data = await res.json()
            if (Array.isArray(data)) {
                setWorkstations(data)
                // Fetch telemetry for active ones
                data.forEach(ws => {
                    if (ws.agent_status === 'ONLINE' || ws.agent_last_seen) {
                        fetchTelemetry(ws.id)
                    }
                })
            }
        } catch (error) {
            console.error("Error fetching workstations:", error)
        } finally {
            setLoading(false)
        }
    }

    const fetchTelemetry = async (wsId: string) => {
        try {
            const res = await fetch(`/api/agents/telemetry/${wsId}`, { cache: 'no-store' })
            const data = await res.json()
            if (data.latest) {
                setTelemetry(prev => ({
                    ...prev,
                    [wsId]: data.latest
                }))
            }
        } catch (error) {
            console.error(`Error fetching telemetry for ${wsId}:`, error)
        }
    }

    const fetchGames = async (wsId: string) => {
        setLoadingGames(prev => ({ ...prev, [wsId]: true }))
        try {
            const res = await fetch(`/api/clubs/${clubId}/workstations/${wsId}/games`, { cache: 'no-store' })
            const data = await res.json()
            if (data.games) {
                setWorkstationGames(prev => ({ ...prev, [wsId]: data.games }))
            }
        } catch (error) {
            console.error(`Error fetching games for ${wsId}:`, error)
        } finally {
            setLoadingGames(prev => ({ ...prev, [wsId]: false }))
        }
    }

    const toggleRow = (wsId: string) => {
        if (expandedWorkstation === wsId) {
            setExpandedWorkstation(null)
        } else {
            setExpandedWorkstation(wsId)
            fetchGames(wsId)
        }
    }

    const handleGenerateBindingCode = async (wsId: string) => {
        setActionLoading(wsId + '_bind')
        try {
            const res = await fetch(`/api/clubs/${clubId}/workstations`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    workstation_id: wsId,
                    action: 'generate_binding_code'
                })
            })
            if (res.ok) {
                fetchWorkstations()
            }
        } catch (error) {
            console.error("Error generating binding code:", error)
        } finally {
            setActionLoading(null)
        }
    }

    const handleUnbind = async (wsId: string) => {
        if (!confirm("Вы уверены, что хотите отвязать этого агента? Его текущая конфигурация на ПК сбросится.")) return
        setActionLoading(wsId + '_unbind')
        try {
            const res = await fetch(`/api/agents/unbind`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ workstation_id: wsId })
            })
            if (res.ok) {
                setTelemetry(prev => {
                    const copy = { ...prev }
                    delete copy[wsId]
                    return copy
                })
                fetchWorkstations()
            }
        } catch (error) {
            console.error("Error unbinding workstation:", error)
        } finally {
            setActionLoading(null)
        }
    }

    const handleToggleMaster = async (wsId: string) => {
        setActionLoading(wsId + '_master')
        try {
            const res = await fetch(`/api/clubs/${clubId}/workstations`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    workstation_id: wsId,
                    action: 'toggle_master'
                })
            })
            if (res.ok) {
                fetchWorkstations()
            }
        } catch (error) {
            console.error("Error toggling master status:", error)
        } finally {
            setActionLoading(null)
        }
    }

    const handleUpdateGame = async (wsId: string, appId: number, gameName: string) => {
        const key = `${wsId}_${appId}`
        setUpdatingGames(prev => ({ ...prev, [key]: true }))
        try {
            const res = await fetch(`/api/agents/commands`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    workstation_id: wsId,
                    type: 'update_game',
                    payload: { app_id: appId }
                })
            })
            if (res.ok) {
                alert(`Команда обновления для "${gameName}" успешно отправлена агенту!`)
                fetchGames(wsId)
            }
        } catch (error) {
            console.error("Error queueing game update:", error)
        } finally {
            setUpdatingGames(prev => ({ ...prev, [key]: false }))
        }
    }

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text)
        setCopiedId(text)
        setTimeout(() => setCopiedId(null), 2000)
    }

    // Helper functions to parse JSON telemetry safely
    const parseGpu = (gpuVal: any): TelemetryGpu[] => {
        if (!gpuVal) return []
        if (typeof gpuVal === 'string') {
            try { return JSON.parse(gpuVal) } catch { return [] }
        }
        return Array.isArray(gpuVal) ? gpuVal : []
    }

    const parseDisk = (diskVal: any): TelemetryDisk[] => {
        if (!diskVal) return []
        if (typeof diskVal === 'string') {
            try { return JSON.parse(diskVal) } catch { return [] }
        }
        return Array.isArray(diskVal) ? diskVal : []
    }

    const formatBytes = (bytes: number): string => {
        if (bytes <= 0) return "N/A"
        const gb = bytes / 1024 / 1024 / 1024
        return `${gb.toFixed(1)} GB`
    }

    // Filtering logic
    const zones = Array.from(new Set(workstations.map(ws => ws.zone))).filter(Boolean)
    
    const filteredWorkstations = workstations.filter(ws => {
        const matchesSearch = ws.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (ws.zone && ws.zone.toLowerCase().includes(searchQuery.toLowerCase()))
        const matchesZone = filterZone === "ALL" || ws.zone === filterZone
        const matchesStatus = filterStatus === "ALL" ||
            (filterStatus === "ONLINE" && ws.agent_status === "ONLINE") ||
            (filterStatus === "OFFLINE" && ws.agent_status === "OFFLINE")
        return matchesSearch && matchesZone && matchesStatus
    })

    const onlineCount = workstations.filter(ws => ws.agent_status === 'ONLINE').length
    const masterPc = workstations.find(ws => ws.is_master)

    return (
        <PageShell maxWidth="7xl">
            {/* Breadcrumbs / Header navigation */}
            <div className="mb-4">
                <Link href={`/clubs/${clubId}/equipment`} className="inline-flex items-center text-xs font-semibold text-muted-foreground hover:text-foreground gap-1.5">
                    <ArrowLeft className="h-3 w-3" /> Назад в Оборудование
                </Link>
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                <PageHeader
                    title="Мониторинг Агентов"
                    description="Отслеживание статуса игровых ПК в реальном времени, управление эталонным ПК и обновление игр по локальной сети."
                />
                <div className="flex gap-2">
                    <Button 
                        variant="outline" 
                        onClick={() => setShowHelp(!showHelp)}
                        className="rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs gap-1.5"
                    >
                        <BookOpen className="h-4 w-4" /> Инструкция по установке
                    </Button>
                    <Button 
                        onClick={fetchWorkstations}
                        disabled={loading}
                        variant="outline"
                        className="rounded-xl border-slate-200 hover:bg-slate-50 p-2.5 h-auto flex items-center justify-center"
                    >
                        <RefreshCw className={`h-4 w-4 text-slate-700 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
            </div>

            {/* Help / Installation section */}
            {showHelp && (
                <Card className="border-dashed border-primary/40 bg-primary/[0.02] mb-6 overflow-hidden animate-in fade-in duration-300">
                    <CardContent className="p-6">
                        <h3 className="font-extrabold text-sm text-primary mb-2 flex items-center gap-2">
                            <Activity className="h-4 w-4" /> Как подключить игровой компьютер (Агент)?
                        </h3>
                        <ol className="list-decimal list-inside text-xs text-muted-foreground space-y-2 mt-2 leading-relaxed">
                            <li>Скачайте и запустите <strong>DashAdminAgent.exe</strong> на игровом ПК.</li>
                            <li>Вставьте URL сервера управления (этой панели): <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-[10px] font-bold">{typeof window !== 'undefined' ? window.location.origin : 'http://ваш-сервер:3000'}</code></li>
                            <li>Скопируйте 6-значный <strong>код привязки</strong> нужного рабочего места из списка ниже и введите его в окне Агента.</li>
                            <li>Нажмите кнопку <strong>«Подключить»</strong> в Агенте. ПК мгновенно появится в сети и пришлет системную телеметрию!</li>
                            <li><strong>Эталонный ПК (Master PC)</strong>: Выберите один мощный ПК, отметьте его «Короной» в панели и включите галочку «Эталонная машина» в его Агенте. Все остальные ПК будут автоматически скачивать обновления с него со скоростью до 1 Гб/с!</li>
                        </ol>
                    </CardContent>
                </Card>
            )}

            {/* Core Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <Card className="border-none shadow-xs bg-white rounded-2xl overflow-hidden">
                    <CardContent className="p-5 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Всего рабочих мест</p>
                            <h3 className="text-2xl font-black mt-1">{workstations.length}</h3>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-xl text-slate-500">
                            <Activity className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-xs bg-white rounded-2xl overflow-hidden">
                    <CardContent className="p-5 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">В сети (Агенты)</p>
                            <h3 className="text-2xl font-black mt-1 text-emerald-600 flex items-center gap-2">
                                {onlineCount}
                                <span className="relative flex h-3 w-3">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                                </span>
                            </h3>
                        </div>
                        <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
                            <CheckCircle2 className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-xs bg-white rounded-2xl overflow-hidden">
                    <CardContent className="p-5 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Не подключено</p>
                            <h3 className="text-2xl font-black mt-1 text-slate-500">{workstations.length - onlineCount}</h3>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-xl text-slate-400">
                            <AlertCircle className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-xs bg-white rounded-2xl overflow-hidden">
                    <CardContent className="p-5 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Эталонный ПК</p>
                            <h3 className="text-sm font-black mt-2 text-amber-600 truncate max-w-[170px] flex items-center gap-1">
                                {masterPc ? (
                                    <>
                                        <Crown className="h-4 w-4 shrink-0 text-amber-500 fill-amber-500" />
                                        {masterPc.name} <span className="text-[10px] text-slate-400 font-medium">({masterPc.zone})</span>
                                    </>
                                ) : "Не назначен"}
                            </h3>
                        </div>
                        <div className="p-3 bg-amber-50 rounded-xl text-amber-600">
                            <Crown className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filter and Search Panel */}
            <div className="bg-white rounded-2xl p-4 shadow-xs mb-6 border border-slate-100 flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="relative w-full md:max-w-xs">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Поиск по названию или зоне..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-slate-500 focus:border-slate-500 transition-all font-medium text-slate-900"
                    />
                </div>

                <div className="flex flex-wrap gap-2 w-full md:w-auto justify-end">
                    <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-200">
                        <button
                            onClick={() => setFilterStatus("ALL")}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${filterStatus === 'ALL' ? 'bg-white text-black shadow-xs' : 'text-slate-500 hover:text-black'}`}
                        >
                            Все
                        </button>
                        <button
                            onClick={() => setFilterStatus("ONLINE")}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${filterStatus === 'ONLINE' ? 'bg-white text-emerald-600 shadow-xs' : 'text-slate-500 hover:text-black'}`}
                        >
                            В сети
                        </button>
                        <button
                            onClick={() => setFilterStatus("OFFLINE")}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${filterStatus === 'OFFLINE' ? 'bg-white text-slate-700 shadow-xs' : 'text-slate-500 hover:text-black'}`}
                        >
                            Оффлайн
                        </button>
                    </div>

                    {zones.length > 0 && (
                        <select
                            value={filterZone}
                            onChange={(e) => setFilterZone(e.target.value)}
                            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-1"
                        >
                            <option value="ALL">Все зоны</option>
                            {zones.map(z => <option key={z} value={z}>{z}</option>)}
                        </select>
                    )}
                </div>
            </div>

            {/* Workstations Grid list */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <RefreshCw className="h-8 w-8 animate-spin text-slate-300" />
                </div>
            ) : filteredWorkstations.length === 0 ? (
                <Card className="border-dashed border-slate-200 rounded-2xl py-12 flex flex-col items-center justify-center">
                    <AlertCircle className="h-10 w-10 text-slate-300 mb-2" />
                    <p className="text-sm font-bold text-slate-500">Рабочие места не найдены</p>
                    <p className="text-xs text-slate-400 mt-1">Попробуйте изменить параметры поиска или фильтров.</p>
                </Card>
            ) : (
                <div className="space-y-4">
                    {filteredWorkstations.map(ws => {
                        const tel = telemetry[ws.id]
                        const isExpanded = expandedWorkstation === ws.id
                        const gpus = tel ? parseGpu(tel.gpu_data) : []
                        const disks = tel ? parseDisk(tel.disks) : []

                        return (
                            <Card 
                                key={ws.id}
                                className={`border transition-all overflow-hidden rounded-2xl ${
                                    isExpanded 
                                        ? 'border-slate-300 shadow-md ring-1 ring-slate-100' 
                                        : 'border-slate-100 hover:border-slate-300 shadow-xs bg-white'
                                }`}
                            >
                                <CardContent className="p-0">
                                    {/* Main Row summary card header */}
                                    <div 
                                        onClick={() => toggleRow(ws.id)}
                                        className="p-5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/[0.4] select-none transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            {/* Status Dot */}
                                            <div className="relative flex">
                                                {ws.agent_status === 'ONLINE' ? (
                                                    <span className="relative flex h-3.5 w-3.5">
                                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                        <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
                                                    </span>
                                                ) : (
                                                    <span className="h-3.5 w-3.5 rounded-full bg-slate-300"></span>
                                                )}
                                            </div>

                                            <div>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h4 className="font-extrabold text-sm text-slate-900">{ws.name}</h4>
                                                    {ws.zone && (
                                                        <Badge variant="secondary" className="text-[10px] font-bold py-0 bg-slate-100 text-slate-600 rounded-sm">
                                                            {ws.zone}
                                                        </Badge>
                                                    )}
                                                    {ws.is_master && (
                                                        <Badge className="text-[10px] font-bold py-0 bg-amber-500 hover:bg-amber-600 text-white rounded-sm gap-1">
                                                            <Crown className="h-3 w-3 fill-white" /> ЭТАЛОННЫЙ ПК
                                                        </Badge>
                                                    )}
                                                </div>
                                                <p className="text-[10px] text-muted-foreground mt-0.5">
                                                    {ws.agent_status === 'ONLINE' 
                                                        ? 'Агент в сети' 
                                                        : ws.agent_last_seen 
                                                            ? `Был в сети: ${new Date(ws.agent_last_seen).toLocaleTimeString('ru-RU', {hour: '2-digit', minute:'2-digit'})}` 
                                                            : 'Агент не подключен'}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Telemetry live status bar */}
                                        {ws.agent_status === 'ONLINE' && tel ? (
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full lg:w-auto flex-1 px-0 lg:px-8">
                                                {/* CPU */}
                                                <div className="min-w-[90px]">
                                                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
                                                        <span>CPU</span>
                                                        <span>{Number(tel.cpu_usage).toFixed(0)}%</span>
                                                    </div>
                                                    <div className="w-full bg-slate-100 h-1.5 rounded-full mt-1 overflow-hidden">
                                                        <div 
                                                            className={`h-full rounded-full transition-all duration-500 ${
                                                                tel.cpu_usage > 85 ? 'bg-rose-500' : tel.cpu_usage > 60 ? 'bg-amber-500' : 'bg-emerald-500'
                                                            }`}
                                                            style={{ width: `${tel.cpu_usage}%` }}
                                                        ></div>
                                                    </div>
                                                </div>

                                                {/* GPU */}
                                                <div className="min-w-[90px]">
                                                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
                                                        <span>GPU</span>
                                                        <span>{gpus[0] ? `${Number(gpus[0].usage).toFixed(0)}%` : 'N/A'}</span>
                                                    </div>
                                                    <div className="w-full bg-slate-100 h-1.5 rounded-full mt-1 overflow-hidden">
                                                        <div 
                                                            className={`h-full rounded-full transition-all duration-500 ${
                                                                gpus[0] && gpus[0].usage > 85 ? 'bg-rose-500' : gpus[0] && gpus[0].usage > 60 ? 'bg-amber-500' : 'bg-emerald-500'
                                                            }`}
                                                            style={{ width: `${gpus[0] ? gpus[0].usage : 0}%` }}
                                                        ></div>
                                                    </div>
                                                </div>

                                                {/* Temp */}
                                                <div>
                                                    <p className="text-[10px] font-bold text-slate-400">Темп. CPU / GPU</p>
                                                    <p className="text-xs font-extrabold text-slate-700 mt-0.5">
                                                        {Number(tel.cpu_temp) > 0 ? `${Number(tel.cpu_temp).toFixed(0)}°C` : 'N/A'} / {gpus[0] && Number(gpus[0].temp) > 0 ? `${Number(gpus[0].temp).toFixed(0)}°C` : 'N/A'}
                                                    </p>
                                                </div>

                                                {/* RAM */}
                                                <div className="min-w-[90px]">
                                                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
                                                        <span>ОЗУ</span>
                                                        <span>{tel.memory_usage ? `${Number(tel.memory_usage).toFixed(0)}%` : 'N/A'}</span>
                                                    </div>
                                                    <div className="w-full bg-slate-100 h-1.5 rounded-full mt-1 overflow-hidden">
                                                        <div 
                                                            className="h-full rounded-full bg-blue-500 transition-all duration-500"
                                                            style={{ width: `${tel.memory_usage || 0}%` }}
                                                        ></div>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex-1 text-center lg:text-left text-xs font-semibold text-slate-400 px-0 lg:px-8">
                                                {ws.binding_code ? (
                                                    <span className="flex items-center gap-1.5">
                                                        Код привязки: <code className="bg-slate-50 border border-slate-200 px-2 py-0.5 text-xs text-slate-900 rounded font-mono font-bold tracking-wider">{ws.binding_code}</code>
                                                        <Button 
                                                            onClick={(e) => { e.stopPropagation(); copyToClipboard(ws.binding_code || "") }}
                                                            variant="ghost" 
                                                            size="icon" 
                                                            className="h-6 w-6 text-slate-400 hover:text-black rounded-lg"
                                                            title="Копировать код"
                                                        >
                                                            <Copy className="h-3 w-3" />
                                                        </Button>
                                                        {copiedId === ws.binding_code && <span className="text-[10px] text-emerald-600 font-bold">Скопировано!</span>}
                                                    </span>
                                                ) : "Код привязки не сгенерирован"}
                                            </div>
                                        )}

                                        {/* Actions buttons right side */}
                                        <div className="flex items-center gap-2 self-stretch lg:self-auto justify-end w-full lg:w-auto" onClick={(e) => e.stopPropagation()}>
                                            {/* Designate Master crown */}
                                            <Button
                                                onClick={() => handleToggleMaster(ws.id)}
                                                disabled={actionLoading !== null}
                                                variant="ghost"
                                                size="icon"
                                                className={`h-9 w-9 rounded-xl transition-all border ${
                                                    ws.is_master 
                                                        ? 'bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-600' 
                                                        : 'hover:bg-slate-50 border-slate-100 hover:border-slate-300 text-slate-400 hover:text-slate-700'
                                                }`}
                                                title={ws.is_master ? "Снять статус эталонного ПК" : "Сделать эталонным ПК"}
                                            >
                                                <Crown className={`h-4 w-4 ${ws.is_master ? 'fill-amber-500' : ''}`} />
                                            </Button>

                                            {/* Bind/Unbind */}
                                            {ws.binding_code && !tel ? (
                                                <Button
                                                    onClick={() => handleGenerateBindingCode(ws.id)}
                                                    disabled={actionLoading !== null}
                                                    variant="outline"
                                                    className="rounded-xl border-slate-200 font-bold text-xs hover:bg-slate-50 h-9"
                                                >
                                                    Обновить код
                                                </Button>
                                            ) : !ws.binding_code && !tel ? (
                                                <Button
                                                    onClick={() => handleGenerateBindingCode(ws.id)}
                                                    disabled={actionLoading !== null}
                                                    variant="outline"
                                                    className="rounded-xl border-slate-200 font-bold text-xs hover:bg-slate-50 gap-1.5 h-9"
                                                >
                                                    <Link2 className="h-3.5 w-3.5" /> Создать код
                                                </Button>
                                            ) : (
                                                <Button
                                                    onClick={() => handleUnbind(ws.id)}
                                                    disabled={actionLoading !== null}
                                                    variant="outline"
                                                    className="rounded-xl border-rose-200 text-rose-600 font-bold text-xs hover:bg-rose-50 gap-1.5 h-9"
                                                >
                                                    <Unlink className="h-3.5 w-3.5" /> Отвязать
                                                </Button>
                                            )}

                                            {/* Collapse chevron icon */}
                                            <div className="text-slate-400 ml-1">
                                                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Expanded Section with Telemetry Details & Game Updates */}
                                    {isExpanded && (
                                        <div className="border-t border-slate-100 bg-slate-50/[0.4] p-5">
                                            <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                                                
                                                {/* Left details - System Telemetry specs */}
                                                <div className="md:col-span-4 space-y-4">
                                                    <div>
                                                        <h5 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                                            <Cpu className="h-3.5 w-3.5 text-slate-500" /> Железо и Система
                                                        </h5>
                                                        <div className="bg-white rounded-xl border border-slate-100 p-3 space-y-2 text-xs">
                                                            {tel ? (
                                                                <>
                                                                    <div>
                                                                        <span className="text-slate-400 font-medium">Процессор:</span>
                                                                        <p className="font-extrabold text-slate-700 mt-0.5">{tel.cpu_model || 'Unknown CPU'}</p>
                                                                    </div>
                                                                    {gpus.map((gpu, index) => (
                                                                        <div key={index} className="pt-1.5 border-t border-slate-100">
                                                                            <span className="text-slate-400 font-medium">Видеокарта {index + 1}:</span>
                                                                            <p className="font-extrabold text-slate-700 mt-0.5">{gpu.name}</p>
                                                                            <p className="text-[10px] text-slate-500 mt-0.5">
                                                                                Загрузка: {Number(gpu.usage).toFixed(0)}% · Темп: {Number(gpu.temp).toFixed(0)}°C · Видеопамять: {formatBytes(gpu.memory_used)} / {formatBytes(gpu.memory_total)}
                                                                            </p>
                                                                        </div>
                                                                    ))}
                                                                    {tel.memory && typeof tel.memory === 'object' && (
                                                                        <div className="pt-1.5 border-t border-slate-100">
                                                                            <span className="text-slate-400 font-medium">Оперативная память (RAM):</span>
                                                                            <p className="font-extrabold text-slate-700 mt-0.5">
                                                                                {formatBytes((tel.memory as any).used_bytes)} / {formatBytes((tel.memory as any).total_bytes)} ({Number(tel.memory_usage || 0).toFixed(0)}%)
                                                                            </p>
                                                                        </div>
                                                                    )}
                                                                </>
                                                            ) : (
                                                                <p className="text-slate-400 italic">Телеметрия недоступна, так как агент оффлайн.</p>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Storage / Disks space details */}
                                                    {tel && disks.length > 0 && (
                                                        <div>
                                                            <h5 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                                                <HardDrive className="h-3.5 w-3.5 text-slate-500" /> Накопители
                                                            </h5>
                                                            <div className="bg-white rounded-xl border border-slate-100 p-3 space-y-2.5">
                                                                {disks.map((d, index) => {
                                                                    const used = d.total_bytes - d.free_bytes
                                                                    const pct = d.total_bytes > 0 ? (used / d.total_bytes) * 100 : 0
                                                                    return (
                                                                        <div key={index} className="text-xs">
                                                                            <div className="flex justify-between items-center font-bold mb-1">
                                                                                <span className="text-slate-700">{d.name} ({d.mount})</span>
                                                                                <span className="text-slate-400 font-medium">{formatBytes(d.free_bytes)} свободно из {formatBytes(d.total_bytes)}</span>
                                                                            </div>
                                                                            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                                                                <div 
                                                                                    className={`h-full rounded-full ${pct > 90 ? 'bg-rose-500' : pct > 75 ? 'bg-amber-500' : 'bg-blue-500'}`}
                                                                                    style={{ width: `${pct}%` }}
                                                                                ></div>
                                                                            </div>
                                                                        </div>
                                                                    )
                                                                })}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Right details - Steam game updates and LAN Sync */}
                                                <div className="md:col-span-8">
                                                    <h5 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                                        <Gamepad2 className="h-3.5 w-3.5 text-slate-500" /> Игры и обновление (Steam)
                                                    </h5>

                                                    {loadingGames[ws.id] ? (
                                                        <div className="flex items-center justify-center p-8 bg-white border border-slate-100 rounded-xl">
                                                            <RefreshCw className="h-5 w-5 animate-spin text-slate-300" />
                                                        </div>
                                                    ) : !workstationGames[ws.id] || workstationGames[ws.id].length === 0 ? (
                                                        <div className="bg-white border border-slate-100 rounded-xl p-6 text-center text-xs text-slate-400">
                                                            Нет данных по установленным играм. Агент сканирует игры раз в 5 минут или при запуске.
                                                        </div>
                                                    ) : (
                                                        <div className="bg-white border border-slate-100 rounded-xl overflow-hidden divide-y divide-slate-100">
                                                            {workstationGames[ws.id].map(game => {
                                                                const isUpdating = updatingGames[`${ws.id}_${game.app_id}`] || game.isCommandPending
                                                                
                                                                let statusColor = "bg-emerald-100 text-emerald-800 border-emerald-200"
                                                                if (game.statusCode === 'UPDATE_LAN') statusColor = "bg-amber-100 text-amber-800 border-amber-200"
                                                                if (game.statusCode === 'INSTALL_LAN') statusColor = "bg-cyan-100 text-cyan-800 border-cyan-200"
                                                                if (game.statusCode === 'UPDATE_REQUIRED') statusColor = "bg-rose-100 text-rose-800 border-rose-200"

                                                                return (
                                                                    <div key={game.app_id} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                                                                        <div className="space-y-0.5">
                                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                                <span className="font-extrabold text-slate-800">{game.game_name}</span>
                                                                                <span className="text-[10px] text-slate-400 font-semibold font-mono">AppID: {game.app_id}</span>
                                                                                <Badge variant="outline" className={`text-[9px] font-bold px-1.5 py-0 rounded ${statusColor}`}>
                                                                                    {game.statusText}
                                                                                </Badge>
                                                                            </div>
                                                                            <p className="text-[10px] text-slate-500 font-medium">
                                                                                Локально: <span className="font-bold">{game.installed_build || 'Не установлена'}</span>
                                                                                {game.ref_build && (
                                                                                    <> · На эталоне: <span className="font-bold text-slate-700">{game.ref_build}</span></>
                                                                                )}
                                                                            </p>
                                                                        </div>

                                                                        <div onClick={(e) => e.stopPropagation()}>
                                                                            {game.canUpdate && (
                                                                                <Button
                                                                                    onClick={() => handleUpdateGame(ws.id, game.app_id, game.game_name)}
                                                                                    disabled={isUpdating || ws.agent_status !== 'ONLINE'}
                                                                                    variant="outline"
                                                                                    size="sm"
                                                                                    className={`rounded-lg font-bold text-[11px] gap-1 px-3 py-1.5 h-auto transition-all ${
                                                                                        game.statusCode === 'INSTALL_LAN'
                                                                                            ? 'border-cyan-200 text-cyan-600 hover:bg-cyan-50'
                                                                                            : game.statusCode === 'UPDATE_LAN'
                                                                                                ? 'border-amber-200 text-amber-600 hover:bg-amber-50'
                                                                                                : 'border-rose-200 text-rose-600 hover:bg-rose-50'
                                                                                    }`}
                                                                                >
                                                                                    {isUpdating ? (
                                                                                        <>
                                                                                            <RefreshCw className="h-3 w-3 animate-spin" /> Обновляется...
                                                                                        </>
                                                                                    ) : game.statusCode === 'INSTALL_LAN' ? (
                                                                                        "Скачать по LAN"
                                                                                    ) : (
                                                                                        "Обновить по LAN"
                                                                                    )}
                                                                                </Button>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                )
                                                            })}
                                                        </div>
                                                    )}
                                                </div>

                                            </div>
                                        </div>
                                    )}

                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            )}
        </PageShell>
    )
}
