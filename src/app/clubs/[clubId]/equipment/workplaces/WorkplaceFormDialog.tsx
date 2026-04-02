"use client"

import { useEffect, useState } from "react"
import { FolderPlus, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import type { Workstation } from "./types"

interface WorkplaceFormDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    isSaving: boolean
    workplace: Partial<Workstation> | null
    createZoneLocked: string | null
    zones: string[]
    onSubmit: (workplace: Partial<Workstation>) => Promise<void> | void
}

export default function WorkplaceFormDialog({
    open,
    onOpenChange,
    isSaving,
    workplace,
    createZoneLocked,
    zones,
    onSubmit,
}: WorkplaceFormDialogProps) {
    const [draft, setDraft] = useState<Partial<Workstation> | null>(workplace)
    const [isNewZoneDialogOpen, setIsNewZoneDialogOpen] = useState(false)
    const [newZoneName, setNewZoneName] = useState("")

    useEffect(() => {
        if (!open) return
        setDraft(workplace)
        setIsNewZoneDialogOpen(false)
        setNewZoneName("")
    }, [open, workplace])

    const handleSave = async (event: React.FormEvent) => {
        event.preventDefault()
        if (!draft?.name || !draft?.zone) return
        await onSubmit(draft)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{draft?.id ? "Редактировать место" : "Новое рабочее место"}</DialogTitle>
                    <DialogDescription>
                        Укажите название (например, PC-01) и зону (Vip, Standard, Boot-camp).
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSave} className="space-y-4 pt-4">
                    <div className="space-y-2">
                        <Label htmlFor="ws-name">Название места</Label>
                        <Input
                            id="ws-name"
                            placeholder="PC-01"
                            value={draft?.name || ""}
                            onChange={(e) => setDraft(prev => ({ ...prev, name: e.target.value }))}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="ws-zone">Игровая зона</Label>
                        {createZoneLocked && !draft?.id ? (
                            <Input id="ws-zone" value={createZoneLocked} disabled />
                        ) : (
                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <Select
                                        value={draft?.zone}
                                        onValueChange={(value) => setDraft(prev => ({ ...prev, zone: value }))}
                                    >
                                        <SelectTrigger id="ws-zone">
                                            <SelectValue placeholder="Выберите зону" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {zones.length > 0 ? zones.map(zone => (
                                                <SelectItem key={zone} value={zone}>{zone}</SelectItem>
                                            )) : (
                                                <SelectItem value="General">General</SelectItem>
                                            )}
                                            {draft?.zone && !zones.includes(draft.zone) ? (
                                                <SelectItem value={draft.zone}>{draft.zone}</SelectItem>
                                            ) : null}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <Dialog open={isNewZoneDialogOpen} onOpenChange={setIsNewZoneDialogOpen}>
                                    <DialogTrigger asChild>
                                        <Button type="button" variant="outline" size="icon" title="Новая зона">
                                            <FolderPlus className="h-4 w-4" />
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                        <DialogHeader>
                                            <DialogTitle>Добавить новую зону</DialogTitle>
                                        </DialogHeader>
                                        <div className="py-4">
                                            <Input
                                                id="new-zone"
                                                placeholder="Название зоны (например, PS5 Zone)"
                                                value={newZoneName}
                                                onChange={(e) => setNewZoneName(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key !== "Enter" || !newZoneName) return
                                                    e.preventDefault()
                                                    setDraft(prev => ({ ...prev, zone: newZoneName }))
                                                    setIsNewZoneDialogOpen(false)
                                                    setNewZoneName("")
                                                }}
                                            />
                                        </div>
                                        <DialogFooter>
                                            <Button type="button" variant="ghost" onClick={() => setIsNewZoneDialogOpen(false)}>Отмена</Button>
                                            <Button
                                                type="button"
                                                className="bg-primary text-primary-foreground"
                                                onClick={() => {
                                                    if (!newZoneName) return
                                                    setDraft(prev => ({ ...prev, zone: newZoneName }))
                                                    setIsNewZoneDialogOpen(false)
                                                    setNewZoneName("")
                                                }}
                                            >
                                                Сохранить
                                            </Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            </div>
                        )}
                    </div>
                    <DialogFooter className="pt-4">
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Отмена</Button>
                        <Button type="submit" disabled={isSaving} className="bg-primary text-primary-foreground">
                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Сохранить
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
