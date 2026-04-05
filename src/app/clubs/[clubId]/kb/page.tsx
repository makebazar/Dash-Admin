"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import {
    Plus,
    FolderPlus,
    Search,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    MoreVertical,
    Pencil,
    Trash2,
    BookOpen,
    Loader2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { RichTextEditor } from "@/components/ui/rich-text-editor"
import { Separator } from "@/components/ui/separator"

interface Category {
    id: number
    parent_id: number | null
    name: string
    description: string | null
    icon: string | null
    order: number
}

interface Article {
    id: number
    category_id: number
    title: string
    content: string
    order: number
    author_name?: string
    updated_at: string
}

export default function KnowledgeBasePage() {
    const { clubId } = useParams()
    const [categories, setCategories] = useState<Category[]>([])
    const [articles, setArticles] = useState<Article[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isFullAccess, setIsFullAccess] = useState(false)
    const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null)
    const [selectedArticleId, setSelectedArticleId] = useState<number | null>(null)
    const [searchQuery, setSearchQuery] = useState("")

    // Category form
    const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false)
    const [editingCategory, setEditingCategory] = useState<Category | null>(null)
    const [categoryForm, setCategoryForm] = useState({
        name: "",
        description: "",
        parent_id: null as number | null,
    })

    // Article form
    const [isArticleDialogOpen, setIsArticleDialogOpen] = useState(false)
    const [editingArticle, setEditingArticle] = useState<Article | null>(null)
    const [articleForm, setArticleForm] = useState({
        title: "",
        content: "",
        category_id: null as number | null,
    })

    const articleTemplates = [
        {
            key: "pc-startup",
            label: "Запуск игровых ПК",
            title: "Регламент запуска игровых ПК",
            content: `<h2>Цель</h2><p>Обеспечить корректный запуск всех рабочих мест перед открытием клуба.</p><h2>Порядок действий</h2><ol><li>Проверить питание на стойке и сетевые фильтры.</li><li>Запустить ПК и убедиться, что ОС загружается без ошибок.</li><li>Открыть игровой лаунчер и проверить обновления.</li><li>Проверить периферию: клавиатура, мышь, гарнитура.</li><li>Проверить подключение к интернету на тестовом ресурсе.</li></ol><h2>Критерий готовности</h2><p>Все рабочие места доступны для бронирования и входа гостей.</p>`
        },
        {
            key: "network-incident",
            label: "Сбой сети",
            title: "Действия при сбое сети",
            content: `<h2>Симптомы</h2><ul><li>Нет доступа к интернету на нескольких ПК.</li><li>Не работают онлайн-игры и авторизация.</li></ul><h2>Первичная диагностика</h2><ol><li>Проверить статус роутера и коммутатора.</li><li>Перезапустить сетевое оборудование по регламенту.</li><li>Проверить кабельные соединения в проблемной зоне.</li></ol><h2>Эскалация</h2><p>Если проблема не устранена за 15 минут, сообщить старшему администратору и провайдеру.</p><h2>Фиксация инцидента</h2><p>Записать время начала, действия и время восстановления.</p>`
        },
        {
            key: "cleaning-standard",
            label: "Обслуживание зоны",
            title: "Стандарт обслуживания игровой зоны",
            content: `<h2>Периодичность</h2><p>Проверка и обслуживание выполняются в начале смены и каждые 2 часа.</p><h2>Что проверяем</h2><ul><li>Чистота столов и поверхностей.</li><li>Состояние гарнитур и амбушюр.</li><li>Кабели и коннекторы без повреждений.</li><li>Работа подсветки и мониторов.</li></ul><h2>Действия при отклонениях</h2><p>Проблемные места помечаются как временно недоступные и передаются в техподдержку.</p>`
        }
    ]

    useEffect(() => {
        fetchPermissions()
        fetchData()
    }, [clubId])

    const fetchPermissions = async () => {
        try {
            const res = await fetch(`/api/clubs/${clubId}/my-permissions`)
            const data = await res.json()
            setIsFullAccess(data.isFullAccess || data.permissions?.manage_kb)
        } catch (error) {
            console.error("Error fetching permissions:", error)
        }
    }

    const fetchData = async () => {
        setIsLoading(true)
        try {
            const [catsRes, artsRes] = await Promise.all([
                fetch(`/api/clubs/${clubId}/kb/categories`),
                fetch(`/api/clubs/${clubId}/kb/articles`)
            ])
            const catsData = await catsRes.json()
            const artsData = await artsRes.json()
            setCategories(catsData.categories || [])
            setArticles(artsData.articles || [])
        } catch (error) {
            console.error("Error fetching KB data:", error)
        } finally {
            setIsLoading(false)
        }
    }

    // Filtered articles based on search
    const filteredArticles = articles.filter(a => 
        a.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        a.content.toLowerCase().includes(searchQuery.toLowerCase())
    )

    // A category should be visible if it matches the search, or has a child category/article that matches
    const isCategoryVisible = (catId: number): boolean => {
        if (!searchQuery) return true
        
        const cat = categories.find(c => c.id === catId)
        if (cat?.name.toLowerCase().includes(searchQuery.toLowerCase())) return true

        const hasMatchingArticle = articles.some(a => a.category_id === catId && (
            a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            a.content.toLowerCase().includes(searchQuery.toLowerCase())
        ))
        if (hasMatchingArticle) return true

        const childCategories = categories.filter(c => c.parent_id === catId)
        return childCategories.some(child => isCategoryVisible(child.id))
    }

    const handleSaveCategory = async () => {
        const method = editingCategory ? 'PUT' : 'POST'
        const url = editingCategory 
            ? `/api/clubs/${clubId}/kb/categories/${editingCategory.id}` 
            : `/api/clubs/${clubId}/kb/categories`
        
        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(categoryForm)
            })
            if (res.ok) {
                setIsCategoryDialogOpen(false)
                fetchData()
            }
        } catch (error) {
            console.error("Error saving category:", error)
        }
    }

    const handleDeleteCategory = async (id: number) => {
        if (!confirm("Вы уверены, что хотите удалить эту категорию? Все подкатегории и статьи будут также удалены.")) return
        try {
            const res = await fetch(`/api/clubs/${clubId}/kb/categories/${id}`, { method: 'DELETE' })
            if (res.ok) fetchData()
        } catch (error) {
            console.error("Error deleting category:", error)
        }
    }

    const handleSaveArticle = async () => {
        const method = editingArticle ? 'PUT' : 'POST'
        const url = editingArticle 
            ? `/api/clubs/${clubId}/kb/articles/${editingArticle.id}` 
            : `/api/clubs/${clubId}/kb/articles`
        
        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...articleForm,
                    category_id: articleForm.category_id || selectedCategoryId
                })
            })
            if (res.ok) {
                setIsArticleDialogOpen(false)
                fetchData()
            }
        } catch (error) {
            console.error("Error saving article:", error)
        }
    }

    const handleDeleteArticle = async (id: number) => {
        if (!confirm("Вы уверены, что хотите удалить эту статью?")) return
        try {
            const res = await fetch(`/api/clubs/${clubId}/kb/articles/${id}`, { method: 'DELETE' })
            if (res.ok) {
                fetchData()
                if (selectedArticleId === id) setSelectedArticleId(null)
            }
        } catch (error) {
            console.error("Error deleting article:", error)
        }
    }

    const renderCategoryTree = (parentId: number | null = null, depth = 0) => {
        const filtered = categories.filter(c => c.parent_id === parentId && isCategoryVisible(c.id))
        
        return filtered.map(cat => {
            const isExpanded = true
            const hasChildren = categories.some(c => c.parent_id === cat.id)
            const catArticles = filteredArticles.filter(a => a.category_id === cat.id)
            
            return (
                <div key={cat.id} className="flex flex-col">
                    <div 
                        className={cn(
                            "group flex items-center justify-between py-2 px-3 rounded-lg cursor-pointer transition-colors",
                            selectedCategoryId === cat.id && selectedArticleId === null ? "bg-indigo-50 text-indigo-700" : "hover:bg-slate-50"
                        )}
                        style={{ paddingLeft: `${depth * 16 + 12}px` }}
                        onClick={() => {
                            setSelectedCategoryId(cat.id)
                            setSelectedArticleId(null)
                        }}
                    >
                        <div className="flex items-center gap-2 overflow-hidden">
                            {hasChildren ? (
                                isExpanded ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />
                            ) : (
                                <div className="w-4" />
                            )}
                            <BookOpen className={cn("h-4 w-4 shrink-0", selectedCategoryId === cat.id && selectedArticleId === null ? "text-indigo-600" : "text-slate-400")} />
                            <span className="truncate text-sm font-medium">{cat.name}</span>
                        </div>

                        {isFullAccess && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100">
                                        <MoreVertical className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => {
                                        setEditingCategory(cat)
                                        setCategoryForm({ name: cat.name, description: cat.description || "", parent_id: cat.parent_id })
                                        setIsCategoryDialogOpen(true)
                                    }}>
                                        <Pencil className="mr-2 h-4 w-4" /> Изменить
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => {
                                        setCategoryForm({ name: "", description: "", parent_id: cat.id })
                                        setEditingCategory(null)
                                        setIsCategoryDialogOpen(true)
                                    }}>
                                        <FolderPlus className="mr-2 h-4 w-4" /> Подкатегория
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => {
                                        setArticleForm({ title: "", content: "", category_id: cat.id })
                                        setEditingArticle(null)
                                        setIsArticleDialogOpen(true)
                                    }}>
                                        <Plus className="mr-2 h-4 w-4" /> Добавить статью
                                    </DropdownMenuItem>
                                    <DropdownMenuItem className="text-red-600" onClick={() => handleDeleteCategory(cat.id)}>
                                        <Trash2 className="mr-2 h-4 w-4" /> Удалить
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                    </div>

                    {isExpanded && (
                        <>
                            {renderCategoryTree(cat.id, depth + 1)}
                            {catArticles.map(art => (
                                <div
                                    key={art.id}
                                    className={cn(
                                        "group flex items-center justify-between py-1.5 px-3 ml-6 rounded-md cursor-pointer text-sm transition-colors",
                                        selectedArticleId === art.id ? "bg-indigo-50 text-indigo-700 font-medium" : "hover:bg-slate-50 text-slate-600"
                                    )}
                                    style={{ paddingLeft: `${(depth + 1) * 16 + 12}px` }}
                                    onClick={() => {
                                        setSelectedArticleId(art.id)
                                    }}
                                >
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        <div className="w-4 h-[1px] bg-slate-200" />
                                        <span className="truncate">{art.title}</span>
                                    </div>
                                    
                                    {isFullAccess && (
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100">
                                                    <MoreVertical className="h-3 w-3" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => {
                                                    setEditingArticle(art)
                                                    setArticleForm({ title: art.title, content: art.content, category_id: art.category_id })
                                                    setIsArticleDialogOpen(true)
                                                }}>
                                                    <Pencil className="mr-2 h-4 w-4" /> Изменить
                                                </DropdownMenuItem>
                                                <DropdownMenuItem className="text-red-600" onClick={() => handleDeleteArticle(art.id)}>
                                                    <Trash2 className="mr-2 h-4 w-4" /> Удалить
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    )}
                                </div>
                            ))}
                        </>
                    )}
                </div>
            )
        })
    }

    const selectedArticle = articles.find(a => a.id === selectedArticleId)
    const selectedCategory = categories.find(c => c.id === selectedCategoryId)
    const selectedArticleCategory = selectedArticle
        ? categories.find(c => c.id === selectedArticle.category_id) ?? null
        : null

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-50/30">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
        )
    }

    const sidebarContent = (
        <div className="flex flex-col h-full w-full min-w-0">
            <div className="p-4 space-y-4">
                <div className="flex items-center justify-between gap-3">
                    <h2 className="text-lg font-bold flex items-center gap-2 min-w-0">
                        <BookOpen className="h-5 w-5 text-indigo-600 shrink-0" />
                        <span className="truncate">База знаний</span>
                    </h2>
                    {isFullAccess && (
                        <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => {
                            setEditingCategory(null)
                            setCategoryForm({ name: "", description: "", parent_id: null })
                            setIsCategoryDialogOpen(true)
                        }}>
                            <Plus className="h-4 w-4" />
                        </Button>
                    )}
                </div>

                <div className="relative w-full min-w-0">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                        placeholder="Поиск..."
                        className="pl-9 bg-slate-50 border-none shadow-none w-full max-w-full"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            <div className="flex-1 px-2 overflow-y-auto">
                <div className="py-2">
                    {renderCategoryTree()}
                </div>
            </div>
        </div>
    )

    const mobileStartContent = (
        <div className="md:hidden flex-1 overflow-y-auto">
            <div className="border-b bg-white px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <h1 className="text-xl font-bold text-slate-900">База знаний</h1>
                        <p className="mt-1 text-sm text-slate-500">Выберите раздел или найдите нужную инструкцию</p>
                    </div>
                    {isFullAccess && (
                        <Button
                            size="icon"
                            variant="outline"
                            className="h-10 w-10 shrink-0 rounded-xl"
                            onClick={() => {
                                setEditingCategory(null)
                                setCategoryForm({ name: "", description: "", parent_id: null })
                                setIsCategoryDialogOpen(true)
                            }}
                        >
                            <Plus className="h-4 w-4" />
                        </Button>
                    )}
                </div>

                <div className="relative mt-4 w-full min-w-0">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <Input
                        placeholder="Поиск по статьям и разделам"
                        className="h-11 rounded-xl border-slate-200 pl-9"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            <div className="px-2 py-2">
                <div className="bg-white">
                    {renderCategoryTree()}
                </div>
            </div>
        </div>
    )

    return (
        <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-slate-50/30">
            <div className="hidden md:flex w-80 border-r bg-white shrink-0 overflow-x-hidden">
                {sidebarContent}
            </div>

            <div className="flex-1 flex flex-col overflow-hidden bg-white">
                    {isArticleDialogOpen ? (
                        <div className="flex-1 flex flex-col overflow-hidden">
                            <div className="border-b px-4 md:px-8 py-4 bg-white shrink-0">
                                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <div className="flex-1 min-w-0">
                                            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500 md:hidden">
                                                Заголовок статьи
                                            </div>
                                            <Input
                                                value={articleForm.title}
                                                onChange={(e) => setArticleForm({ ...articleForm, title: e.target.value })}
                                                placeholder="Заголовок статьи..."
                                                className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 text-xl font-bold shadow-none focus-visible:ring-0 placeholder:text-slate-300 md:border-none md:bg-transparent md:px-0 md:text-2xl"
                                            />
                                        </div>
                                    </div>
                                    <div className="hidden gap-2 md:flex">
                                        <Button variant="ghost" onClick={() => setIsArticleDialogOpen(false)}>
                                            Отмена
                                        </Button>
                                        <Button
                                            onClick={handleSaveArticle}
                                            disabled={!articleForm.title || !articleForm.content}
                                            className="bg-indigo-600 hover:bg-indigo-700 text-white"
                                        >
                                            Сохранить
                                        </Button>
                                    </div>
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 pb-28 md:p-8">
                                <div className="max-w-4xl mx-auto">
                                    <RichTextEditor
                                        value={articleForm.content}
                                        onChange={(content) => setArticleForm({ ...articleForm, content })}
                                        className="min-h-[420px] md:min-h-[500px]"
                                        compactToolbar
                                    />
                                </div>
                            </div>
                        </div>
                    ) : selectedArticle ? (
                        <div className="flex-1 flex flex-col overflow-hidden">
                            <div className="border-b px-4 md:px-8 py-4 flex items-start justify-between gap-3 bg-white shrink-0">
                                <div className="flex items-start gap-3 min-w-0">
                                    <div className="min-w-0">
                                        <h1 className="text-xl md:text-2xl font-bold text-slate-900 break-words">{selectedArticle.title}</h1>
                                        <p className="text-sm text-slate-500 flex flex-wrap items-center gap-2 mt-1">
                                            <span>{new Date(selectedArticle.updated_at).toLocaleDateString()}</span>
                                            {selectedArticle.author_name && (
                                                <>
                                                    <span className="w-1 h-1 bg-slate-300 rounded-full" />
                                                    <span>{selectedArticle.author_name}</span>
                                                </>
                                            )}
                                        </p>
                                    </div>
                                </div>
                                {isFullAccess && (
                                    <div className="hidden gap-2 shrink-0 md:flex">
                                        <Button variant="outline" size="sm" onClick={() => {
                                            setEditingArticle(selectedArticle)
                                            setArticleForm({
                                                title: selectedArticle.title,
                                                content: selectedArticle.content,
                                                category_id: selectedArticle.category_id
                                            })
                                            setIsArticleDialogOpen(true)
                                        }}>
                                            <Pencil className="h-4 w-4 mr-2" />
                                            Редактировать
                                        </Button>
                                    </div>
                                )}
                            </div>
                            <div className="flex-1 overflow-y-auto">
                                <div className="px-4 pb-28 pt-8 md:px-8 md:py-12 max-w-4xl mx-auto prose prose-slate max-w-none">
                                    <div
                                        className="kb-content animate-in fade-in slide-in-from-bottom-2 duration-500"
                                        dangerouslySetInnerHTML={{ __html: selectedArticle.content }}
                                    />

                                    <Separator className="my-8 md:my-12" />
                                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between text-xs text-slate-400">
                                        <span>Последнее обновление: {new Date(selectedArticle.updated_at).toLocaleString('ru-RU')}</span>
                                        <span>ID: {selectedArticle.id}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : selectedCategory ? (
                        <div className="flex-1 flex flex-col overflow-hidden">
                            <div className="border-b px-4 md:px-8 py-4 flex items-start justify-between gap-3 bg-white shrink-0">
                                <div className="flex items-start gap-3 min-w-0">
                                    <div className="min-w-0">
                                        <h1 className="text-xl md:text-2xl font-bold text-slate-900 break-words">{selectedCategory.name}</h1>
                                        {selectedCategory.description && (
                                            <p className="text-sm text-slate-500 mt-1 break-words">{selectedCategory.description}</p>
                                        )}
                                    </div>
                                </div>
                                {isFullAccess && (
                                    <div className="hidden md:flex gap-2 shrink-0">
                                        <Button variant="outline" size="sm" onClick={() => {
                                            setCategoryForm({ name: "", description: "", parent_id: selectedCategory.id })
                                            setEditingCategory(null)
                                            setIsCategoryDialogOpen(true)
                                        }}>
                                            <FolderPlus className="h-4 w-4 mr-2" />
                                            Добавить подкатегорию
                                        </Button>
                                        <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => {
                                            setArticleForm({ title: "", content: "", category_id: selectedCategory.id })
                                            setEditingArticle(null)
                                            setIsArticleDialogOpen(true)
                                        }}>
                                            <Plus className="h-4 w-4 mr-2" />
                                            Добавить статью
                                        </Button>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="outline" size="sm">
                                                    Шаблоны
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                {articleTemplates.map((template) => (
                                                    <DropdownMenuItem key={template.key} onClick={() => {
                                                        setArticleForm({
                                                            title: template.title,
                                                            content: template.content,
                                                            category_id: selectedCategory.id
                                                        })
                                                        setEditingArticle(null)
                                                        setIsArticleDialogOpen(true)
                                                    }}>
                                                        {template.label}
                                                    </DropdownMenuItem>
                                                ))}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                )}
                            </div>
                            <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 md:py-8">
                                <div className="max-w-4xl mx-auto pb-24 md:pb-0">
                                    <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">Статьи в категории</h3>
                                    <div className="space-y-2">
                                        {articles.filter(a => a.category_id === selectedCategory.id).length === 0 ? (
                                            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-slate-500">
                                                В этой категории пока нет статей
                                            </div>
                                        ) : (
                                            articles
                                                .filter(a => a.category_id === selectedCategory.id)
                                                .map(article => (
                                                    <button
                                                        key={article.id}
                                                        className="w-full text-left rounded-lg border px-4 py-3 hover:bg-slate-50 transition-colors"
                                                        onClick={() => {
                                                            setSelectedArticleId(article.id)
                                                        }}
                                                    >
                                                        <div className="font-medium text-slate-900">{article.title}</div>
                                                        <div className="text-xs text-slate-500 mt-1">
                                                            Обновлено: {new Date(article.updated_at).toLocaleDateString("ru-RU")}
                                                        </div>
                                                    </button>
                                                ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <>
                            {mobileStartContent}
                            <div className="hidden md:flex flex-1 flex-col items-center justify-center text-slate-400 p-6 md:p-8 text-center">
                                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4">
                                    <BookOpen className="h-10 w-10" />
                                </div>
                                <h3 className="text-lg font-medium text-slate-900 mb-1">База знаний клуба</h3>
                                <p className="max-w-xs">Выберите статью в боковом меню или создайте новую категорию для начала работы</p>
                                {isFullAccess && (
                                    <Button variant="outline" className="mt-6" onClick={() => {
                                        setEditingCategory(null)
                                        setCategoryForm({ name: "", description: "", parent_id: null })
                                        setIsCategoryDialogOpen(true)
                                    }}>
                                        <Plus className="h-4 w-4 mr-2" />
                                        Создать категорию
                                    </Button>
                                )}
                            </div>
                        </>
                    )}
                </div>

                {selectedArticle && (
                    <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden">
                        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                className="h-11 w-full justify-center"
                                onClick={() => {
                                    setSelectedArticleId(null)
                                    setSelectedCategoryId(selectedArticleCategory?.id ?? null)
                                }}
                            >
                                <ChevronLeft className="mr-2 h-4 w-4" />
                                {selectedArticleCategory ? "К разделу" : "К разделам"}
                            </Button>
                            {isFullAccess && (
                                <Button
                                    type="button"
                                    className="h-11 w-full justify-center bg-indigo-600 text-white hover:bg-indigo-700"
                                    onClick={() => {
                                        setEditingArticle(selectedArticle)
                                        setArticleForm({
                                            title: selectedArticle.title,
                                            content: selectedArticle.content,
                                            category_id: selectedArticle.category_id
                                        })
                                        setIsArticleDialogOpen(true)
                                    }}
                                >
                                    <Pencil className="mr-2 h-4 w-4" />
                                    Редактировать
                                </Button>
                            )}
                        </div>
                    </div>
                )}

                {selectedCategory && !selectedArticle && (
                    <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden">
                        <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_minmax(0,1fr)_44px] items-stretch gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                className="h-11 w-full justify-center"
                                onClick={() => {
                                    setSelectedCategoryId(null)
                                    setSelectedArticleId(null)
                                }}
                            >
                                <ChevronLeft className="mr-2 h-4 w-4" />
                                К разделам
                            </Button>
                            {isFullAccess && (
                                <>
                                    <Button
                                        type="button"
                                        className="h-11 w-full justify-center bg-indigo-600 text-white hover:bg-indigo-700"
                                        onClick={() => {
                                            setArticleForm({ title: "", content: "", category_id: selectedCategory.id })
                                            setEditingArticle(null)
                                            setIsArticleDialogOpen(true)
                                        }}
                                    >
                                        <Plus className="mr-2 h-4 w-4" />
                                        Статья
                                    </Button>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button type="button" variant="outline" size="icon" className="h-11 w-11 justify-center rounded-md">
                                                <MoreVertical className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" side="top">
                                            <DropdownMenuItem onClick={() => {
                                                setCategoryForm({ name: "", description: "", parent_id: selectedCategory.id })
                                                setEditingCategory(null)
                                                setIsCategoryDialogOpen(true)
                                            }}>
                                                <FolderPlus className="mr-2 h-4 w-4" /> Подкатегория
                                            </DropdownMenuItem>
                                            {articleTemplates.map((template) => (
                                                <DropdownMenuItem key={template.key} onClick={() => {
                                                    setArticleForm({
                                                        title: template.title,
                                                        content: template.content,
                                                        category_id: selectedCategory.id
                                                    })
                                                    setEditingArticle(null)
                                                    setIsArticleDialogOpen(true)
                                                }}>
                                                    {template.label}
                                                </DropdownMenuItem>
                                            ))}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {isArticleDialogOpen && (
                    <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden">
                        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                className="h-11 w-full justify-center"
                                onClick={() => setIsArticleDialogOpen(false)}
                            >
                                Отмена
                            </Button>
                            <Button
                                type="button"
                                className="h-11 w-full justify-center bg-indigo-600 text-white hover:bg-indigo-700"
                                onClick={handleSaveArticle}
                                disabled={!articleForm.title || !articleForm.content}
                            >
                                Сохранить
                            </Button>
                        </div>
                    </div>
                )}

            <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingCategory ? "Изменить категорию" : "Новая категория"}</DialogTitle>
                        <DialogDescription>
                            Категории помогают организовать статьи по темам и подтемам.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="cat-name">Название</Label>
                            <Input
                                id="cat-name"
                                value={categoryForm.name}
                                onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                                placeholder="Напр: Регламент запуска игровых ПК"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="cat-desc">Описание (необязательно)</Label>
                            <Input
                                id="cat-desc"
                                value={categoryForm.description}
                                onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCategoryDialogOpen(false)}>Отмена</Button>
                        <Button onClick={handleSaveCategory} disabled={!categoryForm.name}>Сохранить</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <style jsx global>{`
                .kb-content img {
                    max-width: 100%;
                    height: auto;
                    border-radius: 0.5rem;
                    margin: 1.5rem 0;
                }
                .kb-content h1 { font-size: 2rem; font-weight: 700; margin-bottom: 1.5rem; }
                .kb-content h2 { font-size: 1.5rem; font-weight: 600; margin-top: 2rem; margin-bottom: 1rem; }
                .kb-content h3 { font-size: 1.25rem; font-weight: 600; margin-top: 1.5rem; margin-bottom: 0.75rem; }
                .kb-content p { margin-bottom: 1rem; line-height: 1.6; }
                .kb-content ul, .kb-content ol { margin-left: 1.5rem; margin-bottom: 1rem; }
                .kb-content li { margin-bottom: 0.5rem; }
            `}</style>
        </div>
    )
}
