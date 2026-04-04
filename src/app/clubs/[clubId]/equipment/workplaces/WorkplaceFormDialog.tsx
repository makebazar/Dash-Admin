"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
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
    clubId: string
    open: boolean
    onOpenChange: (open: boolean) => void
    isSaving: boolean
    workplace: Partial<Workstation> | null
    createZoneLocked: string | null
    zones: string[]
    onSubmit: (workplace: Partial<Workstation>) => Promise<void> | void
}

export default function WorkplaceFormDialog({
    clubId,
    open,
    onOpenChange,
    isSaving,
    workplace,
    createZoneLocked,
    zones,
    onSubmit,
}: WorkplaceFormDialogProps) {
    const [draft, setDraft] = useState<Partial<Workstation> | null>(workplace)

    useEffect(() => {
        if (!open) return
        setDraft(workplace)
    }, [open, workplace])

    const handleSave = async (event: React.FormEvent) => {
        event.preventDefault()
        if (!draft?.name || !draft?.zone) return
        await onSubmit(draft)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[calc(100vw-1rem)] max-w-[425px]">
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
                            <Select
                                value={draft?.zone}
                                onValueChange={(value) => setDraft(prev => ({ ...prev, zone: value }))}
                            >
                                <SelectTrigger id="ws-zone">
                                    <SelectValue placeholder="Выберите зону" />
                                </SelectTrigger>
                                <SelectContent>
                                    {zones.map(zone => (
                                        <SelectItem key={zone} value={zone}>{zone}</SelectItem>
                                    ))}
                                    {draft?.zone && !zones.includes(draft.zone) ? (
                                        <SelectItem value={draft.zone}>{draft.zone}</SelectItem>
                                    ) : null}
                                </SelectContent>
                            </Select>
                        )}
                        {!createZoneLocked && (
                            <p className="text-xs text-muted-foreground">
                                Нужной зоны нет? Создайте её в{" "}
                                <Link href={`/clubs/${clubId}/equipment/settings?tab=zones`} className="font-medium text-primary hover:underline">
                                    настройках оборудования
                                </Link>
                                .
                            </p>
                        )}
                    </div>
                    <DialogFooter className="flex-col-reverse gap-2 pt-4 sm:flex-row sm:justify-end">
                        <Button type="button" variant="ghost" className="w-full sm:w-auto" onClick={() => onOpenChange(false)}>Отмена</Button>
                        <Button type="submit" disabled={isSaving} className="w-full bg-primary text-primary-foreground sm:w-auto">
                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Сохранить
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
