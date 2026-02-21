"use client"

import { useState, useTransition } from "react"
import { Plus, Pencil, Trash2, FolderTree } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { createCategory, updateCategory, deleteCategory, Category } from "../actions"
import { useParams } from "next/navigation"

interface CategoriesTabProps {
    categories: Category[]
    currentUserId: string
}

export function CategoriesTab({ categories, currentUserId }: CategoriesTabProps) {
    const params = useParams()
    const clubId = params.clubId as string
    
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingCategory, setEditingCategory] = useState<Partial<Category> | null>(null)
    const [isPending, startTransition] = useTransition()

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!editingCategory?.name) return

        startTransition(async () => {
            try {
                if (editingCategory.id) {
                    await updateCategory(editingCategory.id, clubId, currentUserId, {
                        name: editingCategory.name!,
                        description: editingCategory.description,
                        parent_id: editingCategory.parent_id
                    })
                } else {
                    await createCategory(clubId, currentUserId, {
                        name: editingCategory.name!,
                        description: editingCategory.description,
                        parent_id: editingCategory.parent_id
                    })
                }
                setIsDialogOpen(false)
                setEditingCategory(null)
            } catch (err: any) {
                console.error(err)
                alert(err.message || "Ошибка при сохранении")
            }
        })
    }

    const handleDelete = (id: number) => {
        if (!confirm("Вы уверены?")) return
        startTransition(async () => {
            try {
                await deleteCategory(id, clubId, currentUserId)
            } catch (err: any) {
                alert(err.message)
            }
        })
    }

    const openCreate = () => {
        setEditingCategory({ name: '', description: '', parent_id: null })
        setIsDialogOpen(true)
    }

    const openEdit = (cat: Category) => {
        setEditingCategory(cat)
        setIsDialogOpen(true)
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center bg-white p-4 rounded-lg border shadow-sm">
                <h3 className="font-medium flex items-center gap-2">
                    <FolderTree className="h-4 w-4" />
                    Категории товаров
                </h3>
                <Button onClick={openCreate}>
                    <Plus className="mr-2 h-4 w-4" />
                    Создать категорию
                </Button>
            </div>

            <div className="rounded-md border bg-white">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Название</TableHead>
                            <TableHead>Описание</TableHead>
                            <TableHead>Родительская категория</TableHead>
                            <TableHead className="text-right">Товаров</TableHead>
                            <TableHead className="w-[100px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {categories.map(cat => (
                            <TableRow key={cat.id}>
                                <TableCell className="font-medium">{cat.name}</TableCell>
                                <TableCell className="text-muted-foreground text-sm max-w-xs truncate">
                                    {cat.description || "—"}
                                </TableCell>
                                <TableCell>
                                    {cat.parent_name ? (
                                        <span className="bg-slate-100 px-2 py-1 rounded text-xs text-slate-600">
                                            {cat.parent_name}
                                        </span>
                                    ) : "—"}
                                </TableCell>
                                <TableCell className="text-right">{cat.products_count}</TableCell>
                                <TableCell>
                                    <div className="flex justify-end gap-2">
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(cat)}>
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => handleDelete(cat.id)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                        {categories.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                    Категорий нет
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingCategory?.id ? 'Редактирование категории' : 'Новая категория'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSave} className="space-y-4">
                        <div className="space-y-2">
                            <Label>Название <span className="text-red-500">*</span></Label>
                            <Input 
                                value={editingCategory?.name || ''} 
                                onChange={e => setEditingCategory(prev => ({ ...prev!, name: e.target.value }))}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Родительская категория</Label>
                            <Select 
                                value={editingCategory?.parent_id?.toString() || "none"} 
                                onValueChange={v => setEditingCategory(prev => ({ ...prev!, parent_id: v === "none" ? null : Number(v) }))}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Без родителя" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Корень (Без родителя)</SelectItem>
                                    {categories
                                        .filter(c => c.id !== editingCategory?.id) // Prevent self-parenting in UI
                                        .map(c => (
                                            <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                                        ))
                                    }
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Описание</Label>
                            <Textarea 
                                value={editingCategory?.description || ''} 
                                onChange={e => setEditingCategory(prev => ({ ...prev!, description: e.target.value }))}
                            />
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Отмена</Button>
                            <Button type="submit" disabled={isPending}>Сохранить</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    )
}
