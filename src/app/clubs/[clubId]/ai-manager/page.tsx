"use client"

import { useState, useEffect, useRef } from "react"
import { useParams } from "next/navigation"
import { PageShell } from "@/components/layout/PageShell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sparkles, Send, Loader2, Bot, User, Trash2, Brain, Check, RefreshCw } from "lucide-react"

type Message = {
    role: "user" | "assistant" | "system"
    content: string
    created_at?: string
}

type Memory = {
    id: string
    category: string
    memory_value: string
    created_at: string
}

export default function AiManagerPage() {
    const params = useParams()
    const clubId = params.clubId as string

    const [messages, setMessages] = useState<Message[]>([])
    const [memories, setMemories] = useState<Memory[]>([])
    const [inputValue, setInputValue] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [isFetchingHistory, setIsFetchingHistory] = useState(true)
    const [activeTab, setActiveTab] = useState<"chat" | "memory">("chat")

    const chatEndRef = useRef<HTMLDivElement>(null)

    const fetchHistory = async () => {
        try {
            const res = await fetch(`/api/clubs/${clubId}/ai-manager/chat`)
            if (res.ok) {
                const data = await res.json()
                setMessages(data.messages || [])
                setMemories(data.memories || [])
            }
        } catch (err) {
            console.error(err)
        } finally {
            setIsFetchingHistory(false)
        }
    }

    useEffect(() => {
        fetchHistory()
    }, [clubId])

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [messages, isLoading])

    const handleSendMessage = async (textToSend?: string) => {
        const text = (textToSend || inputValue).trim()
        if (!text || isLoading) return

        const userMsg: Message = { role: "user", content: text }
        setMessages((prev) => [...prev, userMsg])
        setInputValue("")
        setIsLoading(true)

        try {
            const res = await fetch(`/api/clubs/${clubId}/ai-manager/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: text })
            })

            if (res.ok) {
                const data = await res.json()
                const assistantMsg: Message = { role: "assistant", content: data.reply }
                setMessages((prev) => [...prev, assistantMsg])

                if (data.memoryAdded) {
                    fetchHistory()
                }
            } else {
                setMessages((prev) => [
                    ...prev,
                    { role: "assistant", content: "⚠️ Произошла ошибка при запросе к AI-Управляющему." }
                ])
            }
        } catch (err) {
            console.error(err)
            setMessages((prev) => [
                ...prev,
                { role: "assistant", content: "⚠️ Ошибка сети при связи с сервером." }
            ])
        } finally {
            setIsLoading(false)
        }
    }

    const handleDeleteMemory = async (memoryId: string) => {
        try {
            const res = await fetch(`/api/clubs/${clubId}/ai-manager/chat?memoryId=${memoryId}`, {
                method: "DELETE"
            })
            if (res.ok) {
                setMemories((prev) => prev.filter((m) => m.id !== memoryId))
            }
        } catch (err) {
            console.error(err)
        }
    }

    const quickPrompts = [
        "Какая выручка за эту неделю?",
        "Кто работал вчера и сколько выручил?",
        "Покажи по дням за этот месяц",
        "Сравни этот месяц с прошлым",
        "Какой день на этой неделе был лучшим?",
        "Запомни: наш целевой план на день — 50 000 рублей",
    ]

    return (
        <PageShell maxWidth="6xl">
            <div className="flex flex-col h-[calc(100vh-140px)] min-h-[500px]">
                {/* Top Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
                            <Sparkles className="w-5 h-5 animate-pulse" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                                AI-Управляющий
                                <span className="bg-blue-50 text-blue-700 border border-blue-200/60 text-[11px] font-semibold px-2 py-0.5 rounded-full">
                                    Pro
                                </span>
                            </h1>
                            <p className="text-xs text-slate-500">Ваш цифровой ассистент с финансовой аналитикой и вечной памятью</p>
                        </div>
                    </div>

                    {/* Tabs switcher */}
                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl shrink-0 self-start sm:self-auto">
                        <button
                            onClick={() => setActiveTab("chat")}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
                                activeTab === "chat"
                                    ? "bg-white text-slate-900 shadow-xs"
                                    : "text-slate-500 hover:text-slate-800"
                            }`}
                        >
                            <Bot className="w-3.5 h-3.5" />
                            <span>Чат</span>
                        </button>
                        <button
                            onClick={() => setActiveTab("memory")}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
                                activeTab === "memory"
                                    ? "bg-white text-slate-900 shadow-xs"
                                    : "text-slate-500 hover:text-slate-800"
                            }`}
                        >
                            <Brain className="w-3.5 h-3.5 text-indigo-500" />
                            <span>Память ИИ ({memories.length})</span>
                        </button>
                    </div>
                </div>

                {/* TAB: CHAT */}
                {activeTab === "chat" ? (
                    <div className="flex-1 flex flex-col pt-4 overflow-hidden">
                        {/* Messages scroll container */}
                        <div className="flex-1 overflow-y-auto space-y-4 pr-2 no-scrollbar">
                            {isFetchingHistory ? (
                                <div className="h-full flex items-center justify-center text-xs text-slate-400 gap-2">
                                    <Loader2 className="w-4 h-4 animate-spin text-blue-500" /> Загрузка чата...
                                </div>
                            ) : messages.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center py-12 px-4 text-center">
                                    <div className="w-14 h-14 rounded-3xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4 border border-blue-100 shadow-xs">
                                        <Sparkles className="w-7 h-7" />
                                    </div>
                                    <h3 className="font-bold text-slate-900 text-lg mb-1">Задайте вопрос AI-Управляющему</h3>
                                    <p className="text-slate-500 text-xs max-w-md mb-6">
                                        Задавайте вопросы о выручке, наличных, сменах или попросите запомнить важное правило клуба.
                                    </p>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-lg">
                                        {quickPrompts.map((prompt, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => handleSendMessage(prompt)}
                                                className="text-left text-xs bg-slate-50 hover:bg-slate-100/80 border border-slate-200/80 text-slate-700 p-3 rounded-xl transition-all font-medium flex items-center justify-between group"
                                            >
                                                <span>{prompt}</span>
                                                <Send className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 transition-colors shrink-0 ml-2" />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {messages.map((msg, idx) => (
                                        <div
                                            key={idx}
                                            className={`flex gap-3 max-w-3xl ${
                                                msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
                                            }`}
                                        >
                                            <div
                                                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold ${
                                                    msg.role === "user"
                                                        ? "bg-slate-900 text-white"
                                                        : "bg-blue-600 text-white shadow-xs"
                                                }`}
                                            >
                                                {msg.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                                            </div>

                                            <div
                                                className={`p-4 rounded-2xl text-sm leading-relaxed ${
                                                    msg.role === "user"
                                                        ? "bg-blue-600 text-white rounded-tr-none font-medium"
                                                        : "bg-slate-50 border border-slate-200/80 text-slate-800 rounded-tl-none whitespace-pre-wrap"
                                                }`}
                                            >
                                                {msg.content}
                                            </div>
                                        </div>
                                    ))}

                                    {isLoading && (
                                        <div className="flex gap-3 mr-auto max-w-2xl items-center">
                                            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                                                <Bot className="w-4 h-4" />
                                            </div>
                                            <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl rounded-tl-none text-slate-500 text-xs flex items-center gap-2">
                                                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                                                <span>AI-Управляющий размышляет...</span>
                                            </div>
                                        </div>
                                    )}
                                    <div ref={chatEndRef} />
                                </>
                            )}
                        </div>

                        {/* Input Footer */}
                        <div className="pt-3 pb-1 border-t border-slate-200 shrink-0">
                            <form
                                onSubmit={(e) => {
                                    e.preventDefault()
                                    handleSendMessage()
                                }}
                                className="flex items-center gap-2 bg-slate-50 border border-slate-200/90 rounded-2xl p-1.5 focus-within:bg-white focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all shadow-xs"
                            >
                                <Input
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    placeholder="Спросите об отчетности или напишите: «Запомни: ...»"
                                    className="bg-transparent border-0 text-slate-900 placeholder:text-slate-400 focus-visible:ring-0 focus-visible:ring-offset-0 text-sm h-10 px-3"
                                    disabled={isLoading}
                                />
                                <Button
                                    type="submit"
                                    disabled={!inputValue.trim() || isLoading}
                                    className="bg-blue-600 hover:bg-blue-500 text-white rounded-xl h-10 px-4 transition-all shrink-0 shadow-xs"
                                >
                                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                </Button>
                            </form>
                        </div>
                    </div>
                ) : (
                    /* TAB: MEMORY MANAGER */
                    <div className="flex-1 pt-4 overflow-y-auto space-y-4 no-scrollbar">
                        <div className="flex items-center justify-between bg-slate-50 border border-slate-200 p-4 rounded-xl">
                            <div>
                                <h3 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
                                    <Brain className="w-4 h-4 text-indigo-600" />
                                    Вечная память клуба
                                </h3>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Всё, что ИИ запомнил из ваших сообщений со словом «Запомни: ...». Эти данные всегда учитываются при ответах.
                                </p>
                            </div>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={fetchHistory}
                                className="h-9 px-3 rounded-lg border-slate-200 text-slate-600 text-xs flex items-center gap-1.5"
                            >
                                <RefreshCw className="w-3.5 h-3.5" />
                                Обновить
                            </Button>
                        </div>

                        {memories.length === 0 ? (
                            <div className="py-12 text-center text-xs text-slate-400 italic border border-dashed border-slate-200 rounded-xl">
                                В памяти пока нет сохраненных фактов. Напишите в чат, например: <br />
                                <strong className="text-slate-600 font-medium not-italic mt-1 inline-block">«Запомни: наш целевой план выручки на день 50 000 рублей»</strong>
                            </div>
                        ) : (
                            <div className="space-y-2.5">
                                {memories.map((mem) => (
                                    <div
                                        key={mem.id}
                                        className="flex items-center justify-between p-4 bg-white border border-slate-200/90 rounded-xl shadow-xs hover:border-slate-300 transition-all"
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 text-xs mt-0.5">
                                                <Check className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-slate-800">{mem.memory_value}</p>
                                                <span className="text-[10px] text-slate-400">
                                                    Сохранено: {new Date(mem.created_at).toLocaleDateString('ru-RU')}
                                                </span>
                                            </div>
                                        </div>

                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-8 w-8 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg shrink-0"
                                            onClick={() => handleDeleteMemory(mem.id)}
                                            title="Удалить из памяти"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </PageShell>
    )
}
