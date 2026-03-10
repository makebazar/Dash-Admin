"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import { BookOpen, ChevronDown, Search, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"

interface Category {
    id: number
    parent_id: number | null
    name: string
    description: string | null
}

interface Article {
    id: number
    category_id: number
    title: string
    content: string
    updated_at: string
}

export default function EmployeeKnowledgeBasePage() {
    const { clubId } = useParams()
    const [categories, setCategories] = useState<Category[]>([])
    const [articles, setArticles] = useState<Article[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState("")
    const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null)
    const [selectedArticleId, setSelectedArticleId] = useState<number | null>(null)

    useEffect(() => {
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
            } finally {
                setIsLoading(false)
            }
        }

        fetchData()
    }, [clubId])

    const filteredArticles = useMemo(
        () => articles.filter(a =>
            a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            a.content.toLowerCase().includes(searchQuery.toLowerCase())
        ),
        [articles, searchQuery]
    )

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

    const renderCategoryTree = (parentId: number | null = null, depth = 0) => {
        const filtered = categories.filter(c => c.parent_id === parentId && isCategoryVisible(c.id))

        return filtered.map(cat => {
            const hasChildren = categories.some(c => c.parent_id === cat.id)
            const catArticles = filteredArticles.filter(a => a.category_id === cat.id)

            return (
                <div key={cat.id} className="flex flex-col">
                    <div
                        className={cn(
                            "flex items-center justify-between py-2 px-3 rounded-lg cursor-pointer transition-colors",
                            selectedCategoryId === cat.id && selectedArticleId === null ? "bg-indigo-50 text-indigo-700" : "hover:bg-slate-50"
                        )}
                        style={{ paddingLeft: `${depth * 16 + 12}px` }}
                        onClick={() => {
                            setSelectedCategoryId(cat.id)
                            setSelectedArticleId(null)
                        }}
                    >
                        <div className="flex items-center gap-2 overflow-hidden">
                            {hasChildren ? <ChevronDown className="h-4 w-4 shrink-0" /> : <div className="w-4" />}
                            <BookOpen className={cn("h-4 w-4 shrink-0", selectedCategoryId === cat.id && selectedArticleId === null ? "text-indigo-600" : "text-slate-400")} />
                            <span className="truncate text-sm font-medium">{cat.name}</span>
                        </div>
                    </div>

                    <>
                        {renderCategoryTree(cat.id, depth + 1)}
                        {catArticles.map(art => (
                            <div
                                key={art.id}
                                className={cn(
                                    "flex items-center justify-between py-1.5 px-3 ml-6 rounded-md cursor-pointer text-sm transition-colors",
                                    selectedArticleId === art.id ? "bg-indigo-50 text-indigo-700 font-medium" : "hover:bg-slate-50 text-slate-600"
                                )}
                                style={{ paddingLeft: `${(depth + 1) * 16 + 12}px` }}
                                onClick={() => {
                                    setSelectedCategoryId(cat.id)
                                    setSelectedArticleId(art.id)
                                }}
                            >
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <div className="w-4 h-[1px] bg-slate-200" />
                                    <span className="truncate">{art.title}</span>
                                </div>
                            </div>
                        ))}
                    </>
                </div>
            )
        })
    }

    const selectedArticle = articles.find(a => a.id === selectedArticleId)
    const selectedCategory = categories.find(c => c.id === selectedCategoryId)

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-50/30">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
        )
    }

    return (
        <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-slate-50/30">
            <div className="w-80 border-r bg-white flex flex-col shrink-0">
                <div className="p-4 space-y-4">
                    <h2 className="text-lg font-bold flex items-center gap-2">
                        <BookOpen className="h-5 w-5 text-indigo-600" />
                        База знаний
                    </h2>
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Поиск..."
                            className="pl-9 bg-slate-50 border-none"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>
                <div className="flex-1 px-2 overflow-y-auto">
                    <div className="py-2">{renderCategoryTree()}</div>
                </div>
            </div>

            <div className="flex-1 flex flex-col overflow-hidden bg-white">
                {selectedArticle ? (
                    <div className="flex-1 flex flex-col overflow-hidden">
                        <div className="border-b px-8 py-4 bg-white shrink-0">
                            <h1 className="text-2xl font-bold text-slate-900">{selectedArticle.title}</h1>
                            <p className="text-sm text-slate-500 mt-1">
                                {new Date(selectedArticle.updated_at).toLocaleString("ru-RU")}
                            </p>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            <div className="px-8 py-8 max-w-4xl mx-auto prose prose-slate max-w-none">
                                <div className="kb-content" dangerouslySetInnerHTML={{ __html: selectedArticle.content }} />
                            </div>
                        </div>
                    </div>
                ) : selectedCategory ? (
                    <div className="flex-1 flex flex-col overflow-hidden p-8">
                        <h1 className="text-2xl font-bold text-slate-900">{selectedCategory.name}</h1>
                        {selectedCategory.description && (
                            <p className="text-sm text-slate-500 mt-1">{selectedCategory.description}</p>
                        )}
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 text-center">
                        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                            <BookOpen className="h-10 w-10" />
                        </div>
                        <h3 className="text-lg font-medium text-slate-900 mb-1">База знаний</h3>
                        <p className="max-w-xs">Выберите категорию или статью в левом меню</p>
                    </div>
                )}
            </div>

            <style jsx global>{`
                .kb-content img {
                    max-width: 100%;
                    height: auto;
                    border-radius: 0.5rem;
                    margin: 1.5rem 0;
                }
            `}</style>
        </div>
    )
}
