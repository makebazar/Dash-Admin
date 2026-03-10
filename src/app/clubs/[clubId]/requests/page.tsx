"use client"

import { useState, useEffect, useTransition, use } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
    MessageSquare, Home, Users, Wallet, 
    MoreHorizontal, Clock, CheckCircle2, XCircle, 
    Monitor, User, Calendar, Filter, Send, Camera, X, Archive
} from "lucide-react"
import { getAllClubRequests, updateRequestStatus, addAdminMessage } from "./actions"
import { getRequestMessages, archiveRequest } from "@/app/employee/clubs/[clubId]/requests-actions"
import { 
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter 
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import Image from "next/image"

const CATEGORIES: Record<string, any> = {
    'HOUSEHOLD': { label: 'Хозяйственный', icon: Home, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    'HR': { label: 'Кадровый', icon: Users, color: 'text-purple-500', bg: 'bg-purple-500/10' },
    'FINANCIAL': { label: 'Финансовый', icon: Wallet, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    'OTHER': { label: 'Другое', icon: MoreHorizontal, color: 'text-slate-500', bg: 'bg-slate-500/10' },
}

const PRIORITIES: Record<string, any> = {
    'LOW': { label: 'Низкий', color: 'text-slate-500', bg: 'bg-slate-500/10' },
    'MEDIUM': { label: 'Средний', color: 'text-blue-500', bg: 'bg-blue-500/10' },
    'HIGH': { label: 'Высокий', color: 'text-orange-500', bg: 'bg-orange-500/10' },
    'URGENT': { label: 'Критичный', color: 'text-red-500', bg: 'bg-red-500/10' },
}

export default function RequestsPage({ params }: { params: Promise<{ clubId: string }> }) {
    const { clubId } = use(params)
    const [requests, setRequests] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isPending, startTransition] = useTransition()
    
    // Detail View State
    const [selectedRequest, setSelectedRequest] = useState<any>(null)
    const [messages, setMessages] = useState<any[]>([])
    const [newMessage, setNewMessage] = useState("")
    const [adminNotes, setAdminNotes] = useState("")
    const [filterStatus, setFilterStatus] = useState<string>("ALL")
    const [activeTab, setActiveTab] = useState<'ACTIVE' | 'ARCHIVE'>('ACTIVE')

    useEffect(() => {
        loadRequests()
    }, [clubId])

    useEffect(() => {
        if (selectedRequest) {
            loadMessages(selectedRequest.id)
        }
    }, [selectedRequest])

    useEffect(() => {
        const eventSource = new EventSource(`/api/clubs/${clubId}/requests/stream`)
        const onUpdate = () => {
            loadRequests(true)
            if (selectedRequest) {
                loadMessages(selectedRequest.id)
            }
        }
        eventSource.addEventListener("update", onUpdate)
        return () => {
            eventSource.removeEventListener("update", onUpdate)
            eventSource.close()
        }
    }, [clubId, selectedRequest?.id])

    const loadRequests = async (silent = false) => {
        if (!silent) setIsLoading(true)
        const data = await getAllClubRequests(clubId)
        setRequests(prev => {
            const prevKey = prev.map((r: any) => `${r.id}:${r.status}:${r.is_read_by_employee}:${r.is_archived}:${r.updated_at}`).join("|")
            const nextKey = data.map((r: any) => `${r.id}:${r.status}:${r.is_read_by_employee}:${r.is_archived}:${r.updated_at}`).join("|")
            return prevKey === nextKey ? prev : data
        })
        if (!silent) setIsLoading(false)
    }

    const loadMessages = async (requestId: number) => {
        const data = await getRequestMessages(requestId)
        setMessages(prev => {
            const prevKey = prev.map((m: any) => `${m.id}:${m.created_at}:${m.message}`).join("|")
            const nextKey = data.map((m: any) => `${m.id}:${m.created_at}:${m.message}`).join("|")
            return prevKey === nextKey ? prev : data
        })
    }

    const handleUpdateStatus = (status: string) => {
        if (!selectedRequest) return

        startTransition(async () => {
            try {
                await updateRequestStatus(clubId, selectedRequest.id, {
                    status: status as any,
                    admin_notes: adminNotes
                })
                setAdminNotes("")
                loadRequests()
                loadMessages(selectedRequest.id)
            } catch (e) {
                console.error(e)
                alert("Ошибка при обновлении статуса")
            }
        })
    }

    const handleSendMessage = () => {
        if (!newMessage.trim() || !selectedRequest) return

        startTransition(async () => {
            try {
                const res = await fetch('/api/auth/me')
                const me = await res.json()
                const adminId = me?.user?.id || me?.id || ""
                
                await addAdminMessage(clubId, selectedRequest.id, adminId, {
                    message: newMessage
                })
                setNewMessage("")
                loadMessages(selectedRequest.id)
            } catch (e) {
                console.error(e)
            }
        })
    }

    const handleArchive = async (requestId: number) => {
        if (!confirm("Перенести запрос в архив?")) return
        await archiveRequest(clubId, requestId)
        setSelectedRequest(null)
        loadRequests()
    }

    const filteredRequests = requests.filter(req => {
        const matchesTab = activeTab === 'ACTIVE' ? !req.is_archived : req.is_archived
        if (!matchesTab) return false
        
        if (filterStatus === "ALL") return true
        if (filterStatus === "OPEN") return req.status === 'PENDING' || req.status === 'IN_PROGRESS'
        return req.status === filterStatus
    })

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'PENDING': return <Badge variant="outline" className="bg-slate-500/10 text-slate-500 border-slate-500/20">Ожидает</Badge>
            case 'IN_PROGRESS': return <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20">В работе</Badge>
            case 'RESOLVED': return <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Решено</Badge>
            case 'REJECTED': return <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20">Отклонено</Badge>
            default: return null
        }
    }

    return (
        <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Обратная связь</h1>
                    <p className="text-muted-foreground">Управление сообщениями от сотрудников</p>
                </div>
                
                <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
                    <Button 
                        variant={activeTab === "ACTIVE" ? "default" : "outline"} 
                        size="sm" 
                        onClick={() => setActiveTab("ACTIVE")}
                        className="rounded-full px-6"
                    >
                        Активные
                    </Button>
                    <Button 
                        variant={activeTab === "ARCHIVE" ? "default" : "outline"} 
                        size="sm" 
                        onClick={() => setActiveTab("ARCHIVE")}
                        className="rounded-full px-6"
                    >
                        Архив
                    </Button>
                </div>
            </div>

            <div className="flex items-center gap-2 border-b pb-4 overflow-x-auto">
                <Button variant={filterStatus === "ALL" ? "secondary" : "ghost"} size="sm" onClick={() => setFilterStatus("ALL")} className="text-xs">Все</Button>
                <Button variant={filterStatus === "OPEN" ? "secondary" : "ghost"} size="sm" onClick={() => setFilterStatus("OPEN")} className="text-xs">Открытые</Button>
                <Button variant={filterStatus === "PENDING" ? "secondary" : "ghost"} size="sm" onClick={() => setFilterStatus("PENDING")} className="text-xs">Новые</Button>
                <Button variant={filterStatus === "RESOLVED" ? "secondary" : "ghost"} size="sm" onClick={() => setFilterStatus("RESOLVED")} className="text-xs">Решенные</Button>
            </div>

            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3].map(i => (
                        <Card key={i} className="animate-pulse h-48 bg-muted/50" />
                    ))}
                </div>
            ) : filteredRequests.length === 0 ? (
                <Card className="border-dashed flex flex-col items-center justify-center py-20">
                    <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mb-4 text-muted-foreground">
                        <MessageSquare className="h-8 w-8" />
                    </div>
                    <p className="text-lg font-medium text-muted-foreground">Сообщений не найдено</p>
                    <p className="text-sm text-muted-foreground/60">Здесь будут отображаться обращения сотрудников</p>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredRequests.map((req) => {
                        const cat = CATEGORIES[req.category]
                        const prio = PRIORITIES[req.priority]
                        return (
                            <Card 
                                key={req.id} 
                                className={cn(
                                    "cursor-pointer hover:border-primary/50 transition-all relative overflow-hidden",
                                    !req.is_read_by_employee && "ring-2 ring-purple-500/20 border-purple-500/50"
                                )}
                                onClick={() => {
                                    setSelectedRequest(req)
                                    setAdminNotes(req.admin_notes || "")
                                }}
                            >
                                {!req.is_read_by_employee && (
                                    <div className="absolute top-0 right-0 bg-purple-500 text-white text-[8px] px-2 py-0.5 font-bold rounded-bl-lg uppercase">
                                        Ответ сотрудника
                                    </div>
                                )}
                                <CardHeader className="p-4 pb-2 flex-row items-start justify-between space-y-0">
                                    <div className="flex items-center gap-2">
                                        <div className={cn("p-2 rounded-lg", cat.bg)}>
                                            <cat.icon className={cn("h-4 w-4", cat.color)} />
                                        </div>
                                        <div className="space-y-0.5">
                                            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">{cat.label}</p>
                                            <CardTitle className="text-sm truncate max-w-[150px]">{req.title}</CardTitle>
                                        </div>
                                    </div>
                                    {getStatusBadge(req.status)}
                                </CardHeader>
                                <CardContent className="p-4 pt-2 space-y-4">
                                    <p className="text-xs text-muted-foreground line-clamp-2 min-h-[2.5rem]">
                                        {req.description}
                                    </p>
                                    
                                    <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-2 border-t">
                                        <div className="flex items-center gap-1.5">
                                            <User className="h-3 w-3" />
                                            <span>{req.user_name}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <Calendar className="h-3 w-3" />
                                            <span>{new Date(req.created_at).toLocaleDateString('ru-RU')}</span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            )}

            {/* Detail Dialog */}
            <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
                <DialogContent className="max-w-3xl h-[90dvh] flex flex-col p-0 overflow-hidden">
                    {selectedRequest && (
                        <>
                            <DialogHeader className="p-6 pb-2 shrink-0">
                                <div className="flex items-center justify-between gap-4 mb-2">
                                    <div className="flex items-center gap-2">
                                        {getStatusBadge(selectedRequest.status)}
                                        <Badge variant="outline" className={cn(PRIORITIES[selectedRequest.priority].bg, PRIORITIES[selectedRequest.priority].color)}>
                                            {PRIORITIES[selectedRequest.priority].label}
                                        </Badge>
                                    </div>
                                    {!selectedRequest.is_archived && (
                                        <Button variant="ghost" size="sm" onClick={() => handleArchive(selectedRequest.id)} className="text-muted-foreground hover:text-red-500 h-8 text-[10px] uppercase font-bold">
                                            <Archive className="h-3.5 w-3.5 mr-1.5" />
                                            В архив
                                        </Button>
                                    )}
                                </div>
                                <DialogTitle className="text-xl">{selectedRequest.title}</DialogTitle>
                                <DialogDescription className="flex items-center gap-4 mt-2">
                                    <span className="flex items-center gap-1 font-bold text-foreground"><User className="h-3 w-3" /> {selectedRequest.user_name}</span>
                                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {new Date(selectedRequest.created_at).toLocaleString('ru-RU')}</span>
                                </DialogDescription>
                            </DialogHeader>

                            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-muted/10">
                                {/* Chat Thread */}
                                <div className="space-y-4">
                                    {messages.map((msg, idx) => {
                                        const isEmployee = msg.sender_id === selectedRequest.user_id
                                        return (
                                            <div key={msg.id} className={cn(
                                                "flex flex-col max-w-[85%]",
                                                !isEmployee ? "ml-auto items-end" : "mr-auto items-start"
                                            )}>
                                                <div className={cn(
                                                    "p-4 rounded-2xl text-sm shadow-sm border",
                                                    !isEmployee ? "bg-primary text-primary-foreground border-primary rounded-tr-none" : "bg-card border-border rounded-tl-none"
                                                )}>
                                                    <p className="whitespace-pre-wrap">{msg.message}</p>
                                                    {msg.photo_urls && msg.photo_urls.length > 0 && (
                                                        <div className="grid grid-cols-2 gap-2 mt-3">
                                                            {msg.photo_urls.map((url: string, i: number) => (
                                                                <a key={i} href={url} target="_blank" rel="noreferrer" className="relative h-32 w-full rounded-lg overflow-hidden border border-black/10">
                                                                    <Image src={url} alt="Attached" fill className="object-cover" />
                                                                </a>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                                <span className="text-[10px] text-muted-foreground mt-1.5 px-1">
                                                    {new Date(msg.created_at).toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
                                                </span>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>

                            <div className="p-6 border-t bg-card space-y-4 shrink-0">
                                <div className="flex gap-2">
                                    <Textarea 
                                        placeholder="Напишите сообщение сотруднику..."
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                        className="min-h-[80px] rounded-xl resize-none"
                                    />
                                    <Button 
                                        className="h-auto px-6 rounded-xl"
                                        onClick={handleSendMessage}
                                        disabled={isPending || !newMessage.trim()}
                                    >
                                        <Send className="h-5 w-5" />
                                    </Button>
                                </div>

                                <div className="flex items-center gap-2 pt-2 border-t">
                                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider mr-2">Изменить статус:</span>
                                    <Button size="sm" variant="outline" className="rounded-full text-[10px] uppercase font-bold border-blue-200 text-blue-600 hover:bg-blue-50" onClick={() => handleUpdateStatus('IN_PROGRESS')}>В работу</Button>
                                    <Button size="sm" variant="outline" className="rounded-full text-[10px] uppercase font-bold border-emerald-200 text-emerald-600 hover:bg-emerald-50" onClick={() => handleUpdateStatus('RESOLVED')}>Решено</Button>
                                    <Button size="sm" variant="outline" className="rounded-full text-[10px] uppercase font-bold border-red-200 text-red-600 hover:bg-red-50" onClick={() => handleUpdateStatus('REJECTED')}>Отклонить</Button>
                                </div>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
