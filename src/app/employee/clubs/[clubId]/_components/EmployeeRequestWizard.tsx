"use client"

import { useState, useTransition, useEffect } from "react"
import { 
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter 
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { 
    Loader2, MessageSquare, Home, Users, Wallet, 
    ArrowLeft, ArrowRight, CheckCircle2, Clock,
    Monitor, MoreHorizontal, Camera, X, Plus
} from "lucide-react"
import { createEmployeeRequest, getEmployeeRequests, markRequestAsRead, getRequestMessages, addMessageToRequest, archiveRequest } from "../requests-actions"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import Image from "next/image"

interface EmployeeRequestWizardProps {
    isOpen: boolean
    onClose: () => void
    clubId: string
    userId: string
}

const CATEGORIES = [
    { id: 'HOUSEHOLD', label: 'Хозяйственный', icon: Home, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
    { id: 'HR', label: 'Кадровый', icon: Users, color: 'text-purple-400', bg: 'bg-purple-400/10' },
    { id: 'FINANCIAL', label: 'Финансовый', icon: Wallet, color: 'text-amber-400', bg: 'bg-amber-400/10' },
    { id: 'OTHER', label: 'Другое', icon: MoreHorizontal, color: 'text-slate-400', bg: 'bg-slate-400/10' },
]

const PRIORITIES = [
    { id: 'LOW', label: 'Низкий', color: 'text-slate-400' },
    { id: 'MEDIUM', label: 'Средний', color: 'text-blue-400' },
    { id: 'HIGH', label: 'Высокий', color: 'text-orange-400' },
    { id: 'URGENT', label: 'Критичный', color: 'text-red-400' },
]

export function EmployeeRequestWizard({ isOpen, onClose, clubId, userId }: EmployeeRequestWizardProps) {
    const [view, setView] = useState<'list' | 'create' | 'chat'>('list')
    const [activeTab, setActiveTab] = useState<'ACTIVE' | 'HISTORY'>('ACTIVE')
    const [step, setStep] = useState(1) // 1: Category, 2: Details
    const [requests, setRequests] = useState<any[]>([])
    const [selectedRequest, setSelectedRequest] = useState<any>(null)
    const [messages, setMessages] = useState<any[]>([])
    const [newMessage, setNewMessage] = useState("")
    const [isPending, startTransition] = useTransition()
    const [isUploading, setIsUploading] = useState(false)
    const [photoUrls, setPhotoUrls] = useState<string[]>([])
    
    // Form State
    const [formData, setFormData] = useState({
        category: '',
        priority: 'MEDIUM',
        title: '',
        description: '',
        workstation_id: ''
    })

    // Load requests
    useEffect(() => {
        if (isOpen) {
            loadRequests()
        }
    }, [isOpen, clubId, userId])

    // Reload when switching back to list
    useEffect(() => {
        if (isOpen && view === 'list') {
            loadRequests()
        }
    }, [view, isOpen])

    // Load messages when chat opens
    useEffect(() => {
        if (view === 'chat' && selectedRequest) {
            loadMessages(selectedRequest.id)
        }
    }, [view, selectedRequest])

    useEffect(() => {
        if (!isOpen) return
        const eventSource = new EventSource(`/api/clubs/${clubId}/requests/stream`)
        const onUpdate = () => {
            loadRequests()
            if (view === 'chat' && selectedRequest) {
                loadMessages(selectedRequest.id)
            }
        }
        eventSource.addEventListener("update", onUpdate)
        return () => {
            eventSource.removeEventListener("update", onUpdate)
            eventSource.close()
        }
    }, [isOpen, view, selectedRequest, clubId, userId])

    // Mark as read when list is opened
    useEffect(() => {
        if (isOpen && view === 'list' && Array.isArray(requests) && requests.some(r => !r.is_read_by_employee)) {
            const unread = requests.filter(r => !r.is_read_by_employee)
            unread.forEach(r => markRequestAsRead(clubId, r.id))
        }
    }, [isOpen, view, requests, clubId])

    const loadRequests = async () => {
        const data = await getEmployeeRequests(clubId, userId)
        setRequests(Array.isArray(data) ? data : [])
    }

    const loadMessages = async (requestId: number) => {
        const data = await getRequestMessages(requestId)
        setMessages(data)
    }

    const compressImage = async (file: File): Promise<Blob> => {
        return new Promise((resolve, reject) => {
            const img = new window.Image()
            const reader = new FileReader()
            reader.onload = (e) => { img.src = e.target?.result as string }
            img.onload = () => {
                const canvas = document.createElement('canvas')
                const ctx = canvas.getContext('2d')
                const MAX_WIDTH = 1200
                const MAX_HEIGHT = 1200
                let width = img.width
                let height = img.height
                if (width > height) {
                    if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH }
                } else {
                    if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT }
                }
                canvas.width = width
                canvas.height = height
                ctx?.drawImage(img, 0, 0, width, height)
                canvas.toBlob((blob) => {
                    if (blob) resolve(blob)
                    else reject(new Error('Canvas to Blob failed'))
                }, 'image/jpeg', 0.7)
            }
            reader.onerror = (err) => reject(err)
            reader.readAsDataURL(file)
        })
    }

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (!files || files.length === 0) return

        setIsUploading(true)
        try {
            const uploadPromises = Array.from(files).map(async (file) => {
                // Compress image
                const compressedBlob = await compressImage(file)
                const compressedFile = new File([compressedBlob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
                    type: 'image/jpeg'
                })

                const formData = new FormData()
                formData.append('file', compressedFile)
                const res = await fetch('/api/upload', { method: 'POST', body: formData })
                if (!res.ok) throw new Error('Upload failed')
                const data = await res.json()
                return data.url
            })
            const urls = await Promise.all(uploadPromises)
            setPhotoUrls(prev => [...prev, ...urls])
        } catch (error) {
            console.error('Failed to upload file:', error)
            alert('Не удалось загрузить фото')
        } finally {
            setIsUploading(false)
        }
    }

    const removePhoto = (urlToRemove: string) => {
        setPhotoUrls(prev => prev.filter(url => url !== urlToRemove))
    }

    const handleCreate = () => {
        if (!formData.category || !formData.title || !formData.description) return

        startTransition(async () => {
            try {
                await createEmployeeRequest(clubId, userId, {
                    ...formData,
                    workstation_id: formData.workstation_id ? parseInt(formData.workstation_id) : undefined,
                    photo_urls: photoUrls
                })
                
                // Switch to list but also load the newly created request
                setView('list')
                setStep(1)
                setFormData({ category: '', priority: 'MEDIUM', title: '', description: '', workstation_id: '' })
                setPhotoUrls([])
                loadRequests()
            } catch (e) {
                console.error(e)
                alert("Ошибка при создании запроса")
            }
        })
    }

    const handleSendMessage = () => {
        if (!newMessage.trim() && photoUrls.length === 0) return

        startTransition(async () => {
            try {
                await addMessageToRequest(clubId, selectedRequest.id, userId, {
                    message: newMessage,
                    photo_urls: photoUrls
                })
                setNewMessage("")
                setPhotoUrls([])
                loadMessages(selectedRequest.id)
            } catch (e) {
                console.error(e)
            }
        })
    }

    const handleArchive = async (requestId: number) => {
        if (!confirm("Завершить этот диалог и перенести в историю?")) return
        const res = await archiveRequest(clubId, requestId)
        if (res.success) {
            loadRequests()
            setView('list')
        }
    }

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'PENDING': return <Badge variant="outline" className="text-slate-400 border-slate-800">Ожидает</Badge>
            case 'IN_PROGRESS': return <Badge variant="outline" className="text-blue-400 border-blue-400/30 bg-blue-400/5">В работе</Badge>
            case 'RESOLVED': return <Badge variant="outline" className="text-emerald-400 border-emerald-400/30 bg-emerald-400/5 font-bold border-emerald-500">Решено</Badge>
            case 'REJECTED': return <Badge variant="outline" className="text-red-400 border-red-400/30 bg-red-400/5">Отклонено</Badge>
            default: return null
        }
    }

    const filteredRequests = requests.filter(r => {
        const archived = Boolean(r.is_archived)
        return activeTab === 'ACTIVE' ? !archived : archived
    })

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-none w-screen h-[100dvh] m-0 p-0 rounded-none bg-slate-950 border-none text-white overflow-hidden flex flex-col fixed inset-0 translate-x-0 translate-y-0 left-0 top-0">
                <DialogHeader className="px-5 py-4 md:px-6 md:py-5 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur flex-row items-center justify-between space-y-0 shrink-0">
                    <div className="space-y-0.5">
                        <DialogTitle className="flex items-center gap-2 text-lg md:text-xl font-semibold">
                            {view === 'chat' && (
                                <Button variant="ghost" size="icon" className="h-9 w-9 mr-1 rounded-full" onClick={() => setView('list')}>
                                    <ArrowLeft className="h-5 w-5" />
                                </Button>
                            )}
                            <MessageSquare className="h-5 w-5 text-purple-400" />
                            {view === 'list' ? "Обратная связь" : view === 'chat' ? selectedRequest?.title : "Новое сообщение"}
                        </DialogTitle>
                        <DialogDescription className="text-slate-400 text-xs md:text-sm">
                            {view === 'list' ? "Ваши обращения и ответы" : view === 'chat' ? `${CATEGORIES.find(c => c.id === selectedRequest?.category)?.label} • ${new Date(selectedRequest?.created_at).toLocaleDateString('ru-RU')}` : `Шаг ${step} из 2`}
                        </DialogDescription>
                    </div>
                    {view === 'chat' && (selectedRequest?.status === 'RESOLVED' || selectedRequest?.status === 'REJECTED') && !selectedRequest?.is_archived && (
                        <Button 
                            variant="outline"
                            size="sm" 
                            className="border-slate-700 h-9 text-xs uppercase font-bold rounded-full px-4"
                            onClick={() => handleArchive(selectedRequest.id)}
                        >
                            В историю
                        </Button>
                    )}
                </DialogHeader>

                {view === 'list' && (
                    <div className="flex px-4 pt-4 shrink-0 gap-2">
                        <button 
                            className={cn(
                                "flex-1 py-2 text-[10px] uppercase font-bold tracking-widest rounded-xl transition-all border",
                                activeTab === 'ACTIVE' ? "bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-500/20" : "bg-slate-900/50 border-slate-800 text-slate-500"
                            )}
                            onClick={() => setActiveTab('ACTIVE')}
                        >
                            Активные
                        </button>
                        <button 
                            className={cn(
                                "flex-1 py-2 text-[10px] uppercase font-bold tracking-widest rounded-xl transition-all border",
                                activeTab === 'HISTORY' ? "bg-slate-800 border-slate-700 text-white shadow-lg" : "bg-slate-900/50 border-slate-800 text-slate-500"
                            )}
                            onClick={() => setActiveTab('HISTORY')}
                        >
                            История
                        </button>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto p-4 w-full max-w-2xl mx-auto flex flex-col relative">
                    {view === 'list' ? (
                        <div className="space-y-3 pb-20">
                            {filteredRequests.length === 0 ? (
                                <div className="py-20 text-center space-y-4">
                                    <div className="h-16 w-16 bg-slate-900 rounded-full flex items-center justify-center mx-auto">
                                        <Clock className="h-8 w-8 text-slate-700" />
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-slate-400 font-medium">
                                            {activeTab === 'ACTIVE' ? "Сообщений пока нет" : "История пуста"}
                                        </p>
                                        <p className="text-slate-600 text-xs">
                                            {activeTab === 'ACTIVE' ? "Здесь будет история вашего общения с руководством" : "Завершенные диалоги будут здесь"}
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                filteredRequests.map((req) => {
                                    const cat = CATEGORIES.find(c => c.id === req.category)
                                    return (
                                        <div 
                                            key={req.id} 
                                            className={cn(
                                                "p-4 border rounded-2xl space-y-3 relative overflow-hidden cursor-pointer active:scale-[0.98] transition-all",
                                                req.is_read_by_employee ? "bg-slate-900/50 border-slate-800" : "bg-purple-500/10 border-purple-500/50"
                                            )}
                                            onClick={() => {
                                                setSelectedRequest(req)
                                                setView('chat')
                                            }}
                                        >
                                            {!req.is_read_by_employee && (
                                                <div className="absolute top-0 right-0 px-2 py-0.5 bg-purple-500 text-[8px] font-bold text-white uppercase tracking-wider rounded-bl-lg">
                                                    Новое
                                                </div>
                                            )}
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="space-y-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        {cat && <cat.icon className={cn("h-3 w-3", cat.color)} />}
                                                        <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">{cat?.label}</span>
                                                    </div>
                                                    <h4 className="font-bold text-sm text-slate-200 truncate">{req.title}</h4>
                                                </div>
                                                {getStatusBadge(req.status)}
                                            </div>
                                            <p className="text-xs text-slate-400 line-clamp-2">{req.description}</p>
                                            
                                            <div className="pt-2 flex items-center justify-between border-t border-slate-800/50">
                                                <span className="text-[10px] text-slate-600">
                                                    {new Date(req.created_at).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                                <div className="flex items-center gap-2">
                                                    {req.workstation_name && (
                                                        <div className="flex items-center gap-1 text-[10px] text-blue-400 bg-blue-400/5 px-2 py-0.5 rounded-full border border-blue-400/20">
                                                            <Monitor className="h-2.5 w-2.5" />
                                                            {req.workstation_name}
                                                        </div>
                                                    )}
                                                    <ArrowRight className="h-3 w-3 text-slate-700" />
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })
                            )}

                            {/* Floating Create Button */}
                            <Button 
                                className="fixed bottom-24 right-6 h-14 w-14 rounded-full bg-purple-600 hover:bg-purple-700 shadow-2xl shadow-purple-500/40 z-10 p-0 flex items-center justify-center"
                                onClick={() => setView('create')}
                            >
                                <Plus className="h-6 w-6" />
                            </Button>
                        </div>
                    ) : view === 'chat' ? (
                        <div className="flex flex-col h-full">
                            <div className="flex-1 space-y-5 pb-4">
                                {messages.map((msg, idx) => {
                                    const isMe = msg.sender_id === userId
                                    return (
                                        <div key={msg.id} className={cn(
                                            "flex flex-col max-w-[90%] md:max-w-[80%]",
                                            isMe ? "ml-auto items-end" : "mr-auto items-start"
                                        )}>
                                            <div className={cn(
                                                "px-4 py-3.5 rounded-3xl text-base leading-relaxed shadow-lg",
                                                isMe ? "bg-purple-600 text-white rounded-tr-md shadow-purple-900/40" : "bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-md"
                                            )}>
                                                {!isMe && <p className="text-[10px] font-bold text-purple-400 uppercase mb-1.5">{msg.sender_name}</p>}
                                                <p className="whitespace-pre-wrap">{msg.message}</p>
                                                
                                                {msg.photo_urls && msg.photo_urls.length > 0 && (
                                                    <div className="grid grid-cols-2 gap-2 mt-3">
                                                        {msg.photo_urls.map((url: string, i: number) => (
                                                            <div key={i} className="relative h-28 w-full rounded-xl overflow-hidden border border-white/10">
                                                                <Image src={url} alt="Attached" fill className="object-cover" />
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            <span className="text-xs text-slate-500 mt-1.5 px-2">
                                                {new Date(msg.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {step === 1 ? (
                                <div className="space-y-4">
                                    <Label className="text-xs text-slate-500 uppercase font-bold tracking-wider">Выберите категорию</Label>
                                    <div className="grid grid-cols-1 gap-2">
                                        {CATEGORIES.map((cat) => (
                                            <button
                                                key={cat.id}
                                                className={cn(
                                                    "flex items-center gap-4 p-4 rounded-2xl border transition-all text-left",
                                                    formData.category === cat.id 
                                                        ? "bg-purple-600/20 border-purple-500" 
                                                        : "bg-slate-900/50 border-slate-800 hover:bg-slate-900"
                                                )}
                                                onClick={() => setFormData({ ...formData, category: cat.id })}
                                            >
                                                <div className={cn("p-3 rounded-xl", cat.bg)}>
                                                    <cat.icon className={cn("h-5 w-5", cat.color)} />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-sm text-white">{cat.label}</p>
                                                    <p className="text-[10px] text-slate-500">Нажмите, чтобы выбрать</p>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-5">
                                    <div className="space-y-2">
                                        <Label className="text-xs text-slate-500">Приоритет</Label>
                                        <div className="grid grid-cols-4 gap-2">
                                            {PRIORITIES.map((p) => (
                                                <button
                                                    key={p.id}
                                                    className={cn(
                                                        "py-2 px-1 rounded-lg border text-[10px] font-bold transition-all",
                                                        formData.priority === p.id 
                                                            ? "bg-slate-800 border-slate-600 text-white" 
                                                            : "bg-slate-900/50 border-slate-800 text-slate-500"
                                                    )}
                                                    onClick={() => setFormData({ ...formData, priority: p.id })}
                                                >
                                                    {p.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-xs text-slate-500">Тема (кратко)</Label>
                                        <Input 
                                            placeholder={
                                                formData.category === 'HOUSEHOLD' ? "Напр: Закончилось мыло" :
                                                formData.category === 'HR' ? "Напр: Запрос на отгул" :
                                                formData.category === 'FINANCIAL' ? "Напр: Вопрос по расчету премии" :
                                                "Напр: Ваша тема"
                                            }
                                            value={formData.title}
                                            onChange={e => setFormData({ ...formData, title: e.target.value })}
                                            className="bg-slate-900 border-slate-800 h-12 rounded-xl"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-xs text-slate-500">Суть проблемы</Label>
                                        <Textarea 
                                            placeholder="Опишите детали..."
                                            value={formData.description}
                                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                                            className="bg-slate-900 border-slate-800 min-h-[120px] rounded-xl resize-none"
                                        />
                                    </div>

                                    <div className="space-y-3">
                                        <Label className="text-xs text-slate-500">Фотографии</Label>
                                        <div className="flex flex-wrap gap-2">
                                            {photoUrls.map((url, i) => (
                                                <div key={i} className="relative h-20 w-20 rounded-xl overflow-hidden border border-slate-800 group">
                                                    <Image src={url} alt="Upload" fill className="object-cover" />
                                                    <button 
                                                        onClick={() => removePhoto(url)}
                                                        className="absolute top-1 right-1 p-1 bg-black/50 hover:bg-red-500 text-white rounded-full transition-colors"
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </button>
                                                </div>
                                            ))}
                                            <label className="h-20 w-20 rounded-xl border-2 border-dashed border-slate-800 bg-slate-900/50 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-900 transition-all group">
                                                <input 
                                                    type="file" 
                                                    accept="image/*" 
                                                    multiple 
                                                    className="hidden" 
                                                    onChange={handlePhotoUpload}
                                                    disabled={isUploading}
                                                />
                                                {isUploading ? (
                                                    <Loader2 className="h-5 w-5 text-purple-400 animate-spin" />
                                                ) : (
                                                    <>
                                                        <Camera className="h-5 w-5 text-slate-600 group-hover:text-purple-400 transition-colors" />
                                                        <span className="text-[8px] text-slate-600 mt-1 uppercase font-bold tracking-wider">Добавить</span>
                                                    </>
                                                )}
                                            </label>
                                        </div>
                                    </div>

                                </div>
                            )}
                        </div>
                    )}
                </div>

                <DialogFooter className="p-4 border-t border-slate-800 bg-slate-900/60 backdrop-blur shrink-0">
                    {view === 'list' ? (
                        <Button 
                            variant="outline" 
                            className="w-full h-12 border-slate-800 text-slate-400 rounded-xl"
                            onClick={onClose}
                        >
                            Закрыть
                        </Button>
                    ) : view === 'chat' ? (
                        <div className="w-full space-y-3">
                            {photoUrls.length > 0 && (
                                <div className="flex gap-2 overflow-x-auto pb-1">
                                    {photoUrls.map((url, i) => (
                                        <div key={i} className="relative h-14 w-14 rounded-xl overflow-hidden border border-slate-700 shrink-0">
                                            <Image src={url} alt="Attached" fill className="object-cover" />
                                            <button onClick={() => removePhoto(url)} className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 text-white flex items-center justify-center"><X className="h-2.5 w-2.5" /></button>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <div className="flex gap-2 w-full items-end rounded-2xl border border-slate-700/80 bg-slate-800/70 p-2 shadow-2xl shadow-black/30">
                                <label className="h-12 w-12 flex items-center justify-center bg-slate-900 rounded-xl cursor-pointer hover:bg-slate-700 shrink-0 border border-slate-700">
                                    <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} />
                                    {isUploading ? <Loader2 className="h-5 w-5 animate-spin text-purple-400" /> : <Camera className="h-5 w-5 text-slate-400" />}
                                </label>
                                <div className="flex-1 relative">
                                    <Textarea 
                                        placeholder="Напишите ответ..."
                                        value={newMessage}
                                        onChange={e => setNewMessage(e.target.value)}
                                        className="min-h-[52px] max-h-[140px] bg-slate-900 border-slate-700 rounded-xl py-3 px-4 text-base resize-none"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault()
                                                handleSendMessage()
                                            }
                                        }}
                                    />
                                </div>
                                <Button 
                                    className="h-12 w-12 rounded-xl bg-purple-600 hover:bg-purple-700 shrink-0 shadow-lg shadow-purple-900/40"
                                    onClick={handleSendMessage}
                                    disabled={isPending || (!newMessage.trim() && photoUrls.length === 0)}
                                >
                                    <ArrowRight className="h-5 w-5" />
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex gap-3 w-full">
                            <Button 
                                variant="outline" 
                                className="h-12 w-14 border-slate-800 text-slate-400 rounded-xl"
                                onClick={() => step === 1 ? setView('list') : setStep(1)}
                            >
                                <ArrowLeft className="h-5 w-5" />
                            </Button>
                            {step === 1 ? (
                                <Button 
                                    className="flex-1 h-12 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl"
                                    disabled={!formData.category}
                                    onClick={() => setStep(2)}
                                >
                                    Далее
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                            ) : (
                                <Button 
                                    className="flex-1 h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl"
                                    onClick={handleCreate}
                                    disabled={isPending || !formData.title || !formData.description}
                                >
                                    {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                                    Отправить сообщение
                                </Button>
                            )}
                        </div>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
