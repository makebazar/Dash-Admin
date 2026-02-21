"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Plus, Database, DollarSign, FileText, ToggleLeft } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface Metric {
    id: number
    key: string
    label: string
    type: 'MONEY' | 'NUMBER' | 'TEXT' | 'BOOLEAN'
    category: 'FINANCE' | 'OPERATIONS' | 'MARKETING'
    description: string
    is_required: boolean
}

export default function MetricsPage() {
    const [metrics, setMetrics] = useState<Metric[]>([])
    const [isOpen, setIsOpen] = useState(false)

    // New metric form state
    const [key, setKey] = useState('')
    const [label, setLabel] = useState('')
    const [type, setType] = useState('MONEY')
    const [category, setCategory] = useState('FINANCE')
    const [description, setDescription] = useState('')

    const fetchMetrics = async () => {
        const res = await fetch('/api/super-admin/metrics')
        const data = await res.json()
        if (data.metrics) setMetrics(data.metrics)
    }

    useEffect(() => {
        fetchMetrics()
    }, [])

    const handleCreate = async () => {
        const res = await fetch('/api/super-admin/metrics', {
            method: 'POST',
            body: JSON.stringify({ key, label, type, category, description })
        })
        if (res.ok) {
            setIsOpen(false)
            fetchMetrics()
            setKey('')
            setLabel('')
        }
    }

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'MONEY': return <DollarSign className="h-4 w-4" />
            case 'TEXT': return <FileText className="h-4 w-4" />
            case 'BOOLEAN': return <ToggleLeft className="h-4 w-4" />
            default: return <Database className="h-4 w-4" />
        }
    }

    return (
        <div className="p-8 max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white">System Metrics</h1>
                    <p className="text-zinc-400">Глобальный справочник переменных для отчетов</p>
                </div>

                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-red-600 hover:bg-red-700 text-white">
                            <Plus className="mr-2 h-4 w-4" />
                            Добавить метрику
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Новая системная метрика</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Key (ID)</Label>
                                    <Input placeholder="revenue_bar" value={key} onChange={e => setKey(e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Категория</Label>
                                    <select className="flex h-10 w-full rounded-md border border-input bg-background px-3" value={category} onChange={e => setCategory(e.target.value)}>
                                        <option value="FINANCE">Финансы</option>
                                        <option value="OPERATIONS">Операционка</option>
                                        <option value="MARKETING">Маркетинг</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Название (Label)</Label>
                                <Input placeholder="Выручка бар" value={label} onChange={e => setLabel(e.target.value)} />
                            </div>

                            <div className="space-y-2">
                                <Label>Тип данных</Label>
                                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3" value={type} onChange={e => setType(e.target.value)}>
                                    <option value="MONEY">Деньги (Валюта)</option>
                                    <option value="NUMBER">Число (Штуки/Часы)</option>
                                    <option value="TEXT">Текст</option>
                                    <option value="BOOLEAN">Да/Нет</option>
                                </select>
                            </div>

                            <div className="space-y-2">
                                <Label>Описание</Label>
                                <Input placeholder="Для чего это нужно..." value={description} onChange={e => setDescription(e.target.value)} />
                            </div>

                            <Button onClick={handleCreate} className="w-full bg-red-600 hover:bg-red-700 mt-2">Создать</Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid gap-4">
                {metrics.map((metric) => (
                    <Card key={metric.id} className="bg-zinc-900 border-zinc-800">
                        <CardContent className="flex items-center justify-between p-6">
                            <div className="flex items-start gap-4">
                                <div className="p-3 rounded-lg bg-zinc-800 text-zinc-400">
                                    {getTypeIcon(metric.type)}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="font-semibold text-lg text-white">{metric.label}</h3>
                                        <Badge variant="outline" className="text-xs border-zinc-700 text-zinc-500 font-mono">{metric.key}</Badge>
                                        <Badge className={`${metric.category === 'FINANCE' ? 'bg-green-900/30 text-green-400' : 'bg-blue-900/30 text-blue-400'} text-xs border-0`}>
                                            {metric.category}
                                        </Badge>
                                    </div>
                                    <p className="text-sm text-zinc-400">{metric.description}</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-4 text-sm text-zinc-500">
                                <span className="font-mono bg-zinc-950 px-2 py-1 rounded border border-zinc-800">{metric.type}</span>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    )
}
