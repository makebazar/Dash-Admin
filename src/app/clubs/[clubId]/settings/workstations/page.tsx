"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Plus, Monitor, Trash2, ArrowLeft, LayoutGrid } from "lucide-react"
import Link from "next/link"

interface Workstation {
    id: string
    name: string
    zone: string
    is_active: boolean
}

export default function WorkstationsPage() {
    const { clubId } = useParams()
    const [workstations, setWorkstations] = useState<Workstation[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [newName, setNewName] = useState("")
    const [newZone, setNewZone] = useState("General")

    useEffect(() => {
        fetchWorkstations()
    }, [clubId])

    const fetchWorkstations = async () => {
        try {
            const res = await fetch(`/api/clubs/${clubId}/workstations`)
            const data = await res.json()
            if (res.ok && Array.isArray(data)) {
                setWorkstations(data)
            }
        } catch (error) {
            console.error(error)
        } finally {
            setIsLoading(false)
        }
    }

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newName) return

        setIsSaving(true)
        try {
            const res = await fetch(`/api/clubs/${clubId}/workstations`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: newName, zone: newZone })
            })

            if (res.ok) {
                setNewName("")
                fetchWorkstations()
            }
        } catch (error) {
            console.error(error)
        } finally {
            setIsSaving(false)
        }
    }

    if (isLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>

    return (
        <div className="p-8 max-w-5xl mx-auto space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <Link href={`/dashboard`} className="mb-2 flex items-center text-sm text-muted-foreground hover:text-foreground">
                        <ArrowLeft className="mr-1 h-4 w-4" /> Назад в дашборд
                    </Link>
                    <h1 className="text-3xl font-bold">Инвентаризация ПК</h1>
                    <p className="text-muted-foreground">Управление списком игровых мест в клубе</p>
                </div>
            </div>

            <div className="grid gap-8 md:grid-cols-3">
                <Card className="md:col-span-1 h-fit sticky top-8">
                    <CardHeader>
                        <CardTitle>Добавить место</CardTitle>
                        <CardDescription>Зарегистрируйте новый ПК в системе</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleAdd} className="space-y-4">
                            <div className="space-y-2">
                                <Label>Название ПК</Label>
                                <Input
                                    placeholder="Напр., PC-01"
                                    value={newName}
                                    onChange={e => setNewName(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Зона / Зал</Label>
                                <Input
                                    placeholder="Напр., VIP"
                                    value={newZone}
                                    onChange={e => setNewZone(e.target.value)}
                                />
                            </div>
                            <Button type="submit" className="w-full" disabled={isSaving}>
                                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                                Добавить
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                <Card className="md:col-span-2">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>Зарегистрированные ПК</CardTitle>
                                <CardDescription>Всего мест: {workstations.length}</CardDescription>
                            </div>
                            <LayoutGrid className="h-5 w-5 text-muted-foreground" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {workstations.map(ws => (
                                <div key={ws.id} className="flex flex-col items-center justify-center p-4 rounded-xl border bg-card hover:border-primary/50 transition-all group relative">
                                    <Monitor className="h-8 w-8 mb-2 text-primary/80" />
                                    <span className="font-bold text-lg">{ws.name}</span>
                                    <span className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">{ws.zone}</span>

                                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button className="text-muted-foreground hover:text-red-500">
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {workstations.length === 0 && (
                                <div className="col-span-full py-12 text-center text-muted-foreground border-2 border-dashed rounded-xl">
                                    Список пуст. Добавьте первый ПК слева.
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
