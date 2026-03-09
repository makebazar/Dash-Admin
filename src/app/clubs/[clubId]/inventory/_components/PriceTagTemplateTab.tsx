"use client"

import { useState, useRef, useEffect } from "react"
import { PriceTagTemplate, PriceTagSettings, updateInventorySettings, Product } from "../actions"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Trash2, Upload, Loader2, Type, Barcode, DollarSign, Move, AlignLeft, AlignCenter, AlignRight, Box, Type as WrapIcon, Scaling, Copy, Edit2, Check, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

import { Switch } from "@/components/ui/switch"
import { v4 as uuidv4 } from "uuid"

interface PriceTagTemplateTabProps {
    products: Product[]
    initialSettings?: PriceTagSettings
    onSave: (settings: PriceTagSettings) => void
    isPending: boolean
}

function getPreviewFieldText(
    product: Product | null,
    field: PriceTagTemplate['elements'][0]['field'],
    showDecimals: boolean
) {
    if (field === 'price') {
        const value = product?.selling_price ?? 999
        return showDecimals ? value.toFixed(2) : `${Math.round(value)}`
    }
    if (field === 'barcode') {
        return product?.barcode || product?.barcodes?.[0] || '1234567890'
    }
    return product?.name || 'Название товара'
}

function getAutoScaleFontSize(
    el: PriceTagTemplate['elements'][0],
    value: string
) {
    const width = el.width || 20
    const height = el.height || 10
    const viewBoxWidth = (width / height) * 100
    const safeLength = Math.max(1, value.length)
    return Math.min(95, viewBoxWidth / (safeLength * 0.55))
}

export function PriceTagTemplateTab({ products, initialSettings, onSave, isPending }: PriceTagTemplateTabProps) {
    const [settings, setSettings] = useState<PriceTagSettings>(initialSettings || {
            templates: [{
                id: uuidv4(),
                name: 'Стандартный',
                width_mm: 58,
                height_mm: 40,
                elements: [
                    { id: '1', type: 'text', x: 5, y: 5, fontSize: 8, fontWeight: 'bold', field: 'name', width: 48, height: 12, wrap_text: true },
                    { id: '2', type: 'price', x: 5, y: 20, fontSize: 14, fontWeight: 'black', field: 'price', width: 48, height: 15 },
                    { id: '3', type: 'barcode', x: 5, y: 35, fontSize: 5, field: 'barcode', width: 48, height: 5 }
                ]
            }]
    })

    const [activeTemplateId, setActiveTemplateId] = useState<string>(
        settings.active_template_id || settings.templates[0]?.id || ''
    )

    const [isEditingName, setIsEditingName] = useState(false)
    const [tempName, setTempName] = useState('')

    const activeTemplate = settings.templates.find(t => t.id === activeTemplateId) || settings.templates[0]

    const updateActiveTemplate = (updates: Partial<PriceTagTemplate>) => {
        setSettings(prev => ({
            ...prev,
            templates: prev.templates.map(t => t.id === activeTemplateId ? { ...t, ...updates } : t)
        }))
    }

    const [isUploading, setIsUploading] = useState(false)
    const [selectedElementId, setSelectedElementId] = useState<string | null>(null)
    const [isDragging, setIsDragging] = useState(false)
    const [resizeHandle, setResizeHandle] = useState<string | null>(null)
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
    const containerRef = useRef<HTMLDivElement>(null)
    const [zoom, setZoom] = useState(6) 
    const [previewProduct, setPreviewProduct] = useState<Product | null>(products[0] || null)

    // Helper to inject fonts into the document
    useEffect(() => {
        const fontsToLoad = new Set<string>()
        settings.templates.forEach(tpl => {
            if (tpl.font_url) fontsToLoad.add(tpl.font_url)
            tpl.elements.forEach(el => {
                if (el.font_url) fontsToLoad.add(el.font_url)
                if (el.currency_font_url) fontsToLoad.add(el.currency_font_url)
            })
        })

        fontsToLoad.forEach(url => {
            const fontId = `font-${url.replace(/[^a-z0-9]/gi, '')}`
            if (!document.getElementById(fontId)) {
                const style = document.createElement('style')
                style.id = fontId
                style.innerHTML = `
                    @font-face {
                        font-family: '${fontId}';
                        src: url('${url}');
                    }
                `
                document.head.appendChild(style)
            }
        })
    }, [settings])

    const handleFileUpload = async (type: 'background' | 'font' | 'element-font' | 'currency-font', e: React.ChangeEvent<HTMLInputElement>, elementId?: string) => {
        const file = e.target.files?.[0]
        if (!file) return

        setIsUploading(true)
        const formData = new FormData()
        formData.append('file', file)

        try {
            const res = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            })
            
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({ error: 'Unknown error' }))
                throw new Error(errorData.error || `Upload failed with status ${res.status}`)
            }
            
            const data = await res.json()
            
            if (type === 'background') {
                updateActiveTemplate({ background_image_url: data.url })
            } else if (type === 'font') {
                updateActiveTemplate({ font_url: data.url })
            } else if (type === 'element-font' && elementId) {
                updateElement(elementId, { font_url: data.url, font_family: `font-${data.url.replace(/[^a-z0-9]/gi, '')}` })
            } else if (type === 'currency-font' && elementId) {
                updateElement(elementId, { currency_font_url: data.url, currency_font_family: `font-${data.url.replace(/[^a-z0-9]/gi, '')}` })
            }
        } catch (error) {
            console.error(error)
            alert('Ошибка при загрузке файла')
        } finally {
            setIsUploading(false)
        }
    }

    const addElement = (type: 'text' | 'price' | 'barcode') => {
        const newElement: PriceTagTemplate['elements'][0] = {
            id: Math.random().toString(36).substr(2, 9),
            type,
            x: 10,
            y: 10,
            width: 30,
            height: 10,
            fontSize: type === 'price' ? 10 : 6,
            fontWeight: type === 'price' ? 'black' : 'normal',
            field: type === 'text' ? 'name' : type === 'price' ? 'price' : 'barcode',
            wrap_text: type === 'text'
        }
        updateActiveTemplate({ elements: [...(activeTemplate?.elements || []), newElement] })
        setSelectedElementId(newElement.id)
    }

    const removeElement = (id: string) => {
        updateActiveTemplate({ elements: (activeTemplate?.elements || []).filter(e => e.id !== id) })
        if (selectedElementId === id) setSelectedElementId(null)
    }

    const updateElement = (id: string, updates: Partial<PriceTagTemplate['elements'][0]>) => {
        updateActiveTemplate({
            elements: (activeTemplate?.elements || []).map(e => e.id === id ? { ...e, ...updates } : e)
        })
    }

    const addTemplate = () => {
        const newTpl: PriceTagTemplate = {
            id: uuidv4(),
            name: `Шаблон ${settings.templates.length + 1}`,
            width_mm: 58,
            height_mm: 40,
            elements: [
                { id: uuidv4(), type: 'text', x: 5, y: 5, fontSize: 8, fontWeight: 'bold', field: 'name', width: 48, height: 12, wrap_text: true },
                { id: uuidv4(), type: 'price', x: 5, y: 20, fontSize: 14, fontWeight: 'black', field: 'price', width: 48, height: 15 }
            ]
        }
        setSettings(prev => ({
            ...prev,
            templates: [...prev.templates, newTpl]
        }))
        setActiveTemplateId(newTpl.id)
    }

    const duplicateTemplate = () => {
        if (!activeTemplate) return
        const newTpl: PriceTagTemplate = {
            ...activeTemplate,
            id: uuidv4(),
            name: `${activeTemplate.name} (копия)`
        }
        setSettings(prev => ({
            ...prev,
            templates: [...prev.templates, newTpl]
        }))
        setActiveTemplateId(newTpl.id)
    }

    const deleteTemplate = () => {
        if (settings.templates.length <= 1) return
        setSettings(prev => {
            const newTemplates = prev.templates.filter(t => t.id !== activeTemplateId)
            return {
                ...prev,
                templates: newTemplates
            }
        })
        setActiveTemplateId(settings.templates.find(t => t.id !== activeTemplateId)?.id || '')
    }

    const startEditingName = () => {
        setTempName(activeTemplate?.name || '')
        setIsEditingName(true)
    }

    const saveName = () => {
        updateActiveTemplate({ name: tempName })
        setIsEditingName(false)
    }

    const handleMouseDown = (e: React.MouseEvent, id: string) => {
        e.stopPropagation()
        setSelectedElementId(id)
        
        const el = activeTemplate?.elements.find(e => e.id === id)
        if (el && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect()
            const mouseX = (e.clientX - rect.left) / zoom
            const mouseY = (e.clientY - rect.top) / zoom
            
            // Calculate offset from the element's top-left corner
            setDragOffset({
                x: mouseX - el.x,
                y: mouseY - el.y
            })
            setIsDragging(true)
            setResizeHandle(null)
        }
    }

    const handleResizeMouseDown = (e: React.MouseEvent, id: string, handle: string) => {
        e.stopPropagation()
        setSelectedElementId(id)
        setResizeHandle(handle)
        setIsDragging(false)
    }

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!selectedElementId || !containerRef.current || !activeTemplate) return
            if (!isDragging && !resizeHandle) return

            const rect = containerRef.current.getBoundingClientRect()
            const mouseX = (e.clientX - rect.left) / zoom
            const mouseY = (e.clientY - rect.top) / zoom

            if (isDragging) {
                // New element position by subtracting the initial grab offset
                const x = mouseX - dragOffset.x
                const y = mouseY - dragOffset.y

                // Round to 0.5mm for better UX
                const roundedX = Math.round(x * 2) / 2
                const roundedY = Math.round(y * 2) / 2

                // Constraints
                const safeX = Math.max(0, Math.min(roundedX, activeTemplate.width_mm))
                const safeY = Math.max(0, Math.min(roundedY, activeTemplate.height_mm))

                updateElement(selectedElementId, { x: safeX, y: safeY })
            } else if (resizeHandle) {
                const el = activeTemplate.elements.find(e => e.id === selectedElementId)
                if (!el) return

                const handleLower = resizeHandle.toLowerCase()
                
                let newX = el.x
                let newY = el.y
                let newWidth = el.width || 20
                let newHeight = el.height || 10

                if (handleLower.includes('right')) {
                    newWidth = Math.max(5, mouseX - el.x)
                } else if (handleLower.includes('left')) {
                    const fixedRight = el.x + (el.width || 20)
                    newWidth = Math.max(5, fixedRight - mouseX)
                    newX = fixedRight - newWidth
                }

                if (handleLower.includes('bottom')) {
                    newHeight = Math.max(5, mouseY - el.y)
                } else if (handleLower.includes('top')) {
                    const fixedBottom = el.y + (el.height || 10)
                    newHeight = Math.max(5, fixedBottom - mouseY)
                    newY = fixedBottom - newHeight
                }

                updateElement(selectedElementId, { 
                    width: Math.round(newWidth * 2) / 2,
                    height: Math.round(newHeight * 2) / 2,
                    x: Math.round(newX * 2) / 2,
                    y: Math.round(newY * 2) / 2 
                })
            }
        }

        const handleMouseUp = (e: MouseEvent) => {
            setIsDragging(false)
            setResizeHandle(null)
        }

        if (isDragging || resizeHandle) {
            window.addEventListener('mousemove', handleMouseMove)
            window.addEventListener('mouseup', handleMouseUp)
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove)
            window.removeEventListener('mouseup', handleMouseUp)
        }
    }, [isDragging, resizeHandle, selectedElementId, zoom, activeTemplate, dragOffset])

    const alignElement = (id: string, alignment: 'left' | 'center' | 'right') => {
        const domEl = document.getElementById(`preview-el-${id}`)
        if (!domEl || !containerRef.current || !activeTemplate) return

        const elWidthMm = domEl.offsetWidth / zoom
        const canvasWidthMm = activeTemplate.width_mm

        let newX = 0
        if (alignment === 'left') newX = 0
        else if (alignment === 'center') newX = (canvasWidthMm - elWidthMm) / 2
        else if (alignment === 'right') newX = canvasWidthMm - elWidthMm

        updateElement(id, { x: Math.round(newX * 2) / 2 })
    }

    const alignElementVertical = (id: string, alignment: 'top' | 'middle' | 'bottom') => {
        const domEl = document.getElementById(`preview-el-${id}`)
        if (!domEl || !containerRef.current || !activeTemplate) return

        const elHeightMm = domEl.offsetHeight / zoom
        const canvasHeightMm = activeTemplate.height_mm

        let newY = 0
        if (alignment === 'top') newY = 0
        else if (alignment === 'middle') newY = (canvasHeightMm - elHeightMm) / 2
        else if (alignment === 'bottom') newY = canvasHeightMm - elHeightMm

        updateElement(id, { y: Math.round(newY * 2) / 2 })
    }

    if (!activeTemplate) return null

    return (
        <div className="space-y-6">
            {/* Template Selector */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center gap-6">
                    {/* Left: Dropdown */}
                    <div className="flex flex-col gap-1.5 shrink-0">
                        <Label className="text-[10px] uppercase text-slate-400 font-bold tracking-wider leading-none">Выберите шаблон</Label>
                        <Select value={activeTemplateId} onValueChange={setActiveTemplateId}>
                            <SelectTrigger className="h-9 w-[180px] bg-slate-50/50 border-slate-200 font-semibold text-slate-700 focus:ring-blue-500/20">
                                <SelectValue placeholder="Выберите шаблон" />
                            </SelectTrigger>
                            <SelectContent>
                                {settings.templates.map(t => (
                                    <SelectItem key={t.id} value={t.id} className="font-medium">
                                        {t.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Middle: Name & Divider */}
                    <div className="flex items-center gap-6 flex-1 border-l border-slate-100 pl-6 h-12">
                        <div className="flex flex-col gap-1.5 flex-1">
                            <Label className="text-[10px] uppercase text-slate-400 font-bold tracking-wider leading-none">Название шаблона</Label>
                            <div className="flex items-center gap-2 min-h-[36px]">
                                {isEditingName ? (
                                    <div className="flex items-center gap-1 flex-1 max-w-sm">
                                        <Input 
                                            value={tempName}
                                            onChange={(e) => setTempName(e.target.value)}
                                            className="h-8 bg-white border-blue-500 focus-visible:ring-blue-500/20"
                                            autoFocus
                                        />
                                        <Button size="icon" variant="ghost" onClick={saveName} className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50 shrink-0">
                                            <Check className="h-4 w-4" />
                                        </Button>
                                        <Button size="icon" variant="ghost" onClick={() => setIsEditingName(false)} className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50 shrink-0">
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="flex items-center group cursor-pointer" onClick={startEditingName}>
                                        <span className="text-sm font-black text-slate-700">{activeTemplate.name}</span>
                                        <Edit2 className="h-3.5 w-3.5 ml-2 text-slate-300 group-hover:text-blue-500 transition-colors" />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 pt-2 md:pt-0">
                        <Button variant="outline" size="sm" onClick={duplicateTemplate} className="h-9 px-4 text-xs font-bold text-slate-600 border-slate-200 hover:bg-slate-50 transition-all">
                            <Copy className="h-3.5 w-3.5 mr-2" /> Дублировать
                        </Button>
                        <Button variant="outline" size="sm" onClick={addTemplate} className="h-9 px-4 text-xs font-bold text-blue-600 border-blue-100 bg-blue-50/30 hover:bg-blue-50 transition-all">
                            <Plus className="h-3.5 w-3.5 mr-2" /> Новый
                        </Button>
                        {settings.templates.length > 1 && (
                            <Button variant="ghost" size="icon" onClick={deleteTemplate} className="h-9 w-9 text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-all">
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[600px]">
                {/* Left Panel: Properties */}
                <div className="lg:col-span-4 space-y-4 pr-2">
                    <Card className="border-slate-200 shadow-sm">
                        <CardHeader className="py-3">
                            <CardTitle className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                                <Move className="h-4 w-4 text-blue-500" />
                                Размеры и холст
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 pb-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] uppercase text-slate-400 font-bold">Ширина (мм)</Label>
                                    <Input 
                                        type="number" 
                                        value={activeTemplate.width_mm} 
                                        className="h-8 text-xs"
                                        onChange={(e) => updateActiveTemplate({ width_mm: Number(e.target.value) })}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] uppercase text-slate-400 font-bold">Высота (мм)</Label>
                                    <Input 
                                        type="number" 
                                        value={activeTemplate.height_mm} 
                                        className="h-8 text-xs"
                                        onChange={(e) => updateActiveTemplate({ height_mm: Number(e.target.value) })}
                                    />
                                </div>
                            </div>

                            <div className="space-y-3 pt-2 border-t border-slate-100">
                                <div className="flex items-center justify-between">
                                    <Label className="text-[10px] uppercase text-slate-400 font-bold">Фон и цвет</Label>
                                    <Input 
                                        type="color" 
                                        value={activeTemplate.background_color || "#ffffff"} 
                                        onChange={(e) => updateActiveTemplate({ background_color: e.target.value })}
                                        className="w-8 h-8 p-0.5 cursor-pointer border-none bg-transparent"
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm" className="flex-1 h-8 text-[10px] relative">
                                        {isUploading ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Upload className="h-3 w-3 mr-2" />}
                                        Загрузить фон
                                        <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => handleFileUpload('background', e)} />
                                    </Button>
                                    {activeTemplate.background_image_url && (
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-500" onClick={() => updateActiveTemplate({ background_image_url: undefined })}>
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                                <div className="space-y-0.5">
                                    <Label className="text-[10px] uppercase text-slate-400 font-bold">Показывать копейки</Label>
                                    <p className="text-[9px] text-slate-400">Формат: 999.00 ₽ или 999 ₽</p>
                                </div>
                                <Switch 
                                    checked={activeTemplate.show_decimals || false}
                                    onCheckedChange={(val) => updateActiveTemplate({ show_decimals: val })}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-slate-200 shadow-sm">
                        <CardHeader className="py-3 flex flex-row items-center justify-between space-y-0">
                            <CardTitle className="text-xs font-bold uppercase tracking-wider">Элементы</CardTitle>
                            <div className="flex gap-1">
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => addElement('text')} title="Текст">
                                    <Type className="h-3.5 w-3.5" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => addElement('price')} title="Цена">
                                    <DollarSign className="h-3.5 w-3.5" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => addElement('barcode')} title="Код">
                                    <Barcode className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto no-scrollbar">
                                {activeTemplate.elements.map((el) => (
                                    <div 
                                        key={el.id} 
                                        className={cn(
                                            "p-3 transition-colors cursor-pointer group",
                                            selectedElementId === el.id ? "bg-blue-50/50" : "hover:bg-slate-50"
                                        )}
                                        onClick={() => setSelectedElementId(el.id)}
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-[10px] font-black uppercase text-slate-500">
                                                {el.type === 'text' ? 'Текст' : el.type === 'price' ? 'Цена' : 'Код'}
                                            </span>
                                            <Button variant="ghost" size="icon" className="h-5 w-5 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => { e.stopPropagation(); removeElement(el.id); }}>
                                                <Trash2 className="h-3 w-3" />
                                            </Button>
                                        </div>
                                        
                                        {selectedElementId === el.id && (
                                            <div className="space-y-3 pt-1 animate-in fade-in slide-in-from-top-1 duration-200">
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div className="space-y-1">
                                                        <Label className="text-[9px] uppercase text-slate-400">Шрифт</Label>
                                                        <Input type="number" className="h-7 text-[10px]" value={el.fontSize} onChange={(e) => updateElement(el.id, { fontSize: Number(e.target.value) })} />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label className="text-[9px] uppercase text-slate-400">Данные</Label>
                                                        <Select value={el.field} onValueChange={(value) => updateElement(el.id, { field: value as any })}>
                                                            <SelectTrigger className="h-7 text-[10px] bg-white border-slate-200">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="name">Название</SelectItem>
                                                                <SelectItem value="price">Цена</SelectItem>
                                                                <SelectItem value="barcode">Штрих-код</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </div>

                                                <div className="space-y-2 pt-2 border-t border-slate-100">
                                                    <div className="space-y-1">
                                                        <Label className="text-[9px] uppercase text-slate-400">Файл шрифта (OTF/TTF)</Label>
                                                        <div className="flex gap-1">
                                                            <Input value={el.font_url ? "Загружен" : ""} readOnly placeholder="Не выбран" className="h-7 text-[9px] bg-slate-50" />
                                                            <Button variant="outline" size="icon" className="h-7 w-7 shrink-0 relative">
                                                                <Upload className="h-3 w-3" />
                                                                <input type="file" accept=".ttf,.otf,.woff,.woff2" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => handleFileUpload('element-font', e, el.id)} />
                                                            </Button>
                                                            {el.font_url && (
                                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-500" onClick={() => updateElement(el.id, { font_url: undefined, font_family: undefined })}>
                                                                    <Trash2 className="h-3 w-3" />
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {el.field === 'price' && (
                                                        <div className="space-y-1">
                                                            <Label className="text-[9px] uppercase text-slate-400 font-bold text-blue-600">Шрифт для символа ₽</Label>
                                                            <div className="flex gap-1">
                                                                <Input value={el.currency_font_url ? "Загружен" : ""} readOnly placeholder="Не выбран" className="h-7 text-[9px] bg-slate-50" />
                                                                <Button variant="outline" size="icon" className="h-7 w-7 shrink-0 relative">
                                                                    <Upload className="h-3 w-3" />
                                                                    <input type="file" accept=".ttf,.otf,.woff,.woff2" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => handleFileUpload('currency-font', e, el.id)} />
                                                                </Button>
                                                                {el.currency_font_url && (
                                                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-500" onClick={() => updateElement(el.id, { currency_font_url: undefined, currency_font_family: undefined })}>
                                                                        <Trash2 className="h-3 w-3" />
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="flex items-center gap-2 border-t border-slate-100 pt-2">
                                                    <div className="flex-1 space-y-1">
                                                        <Label className="text-[8px] uppercase text-slate-400 font-bold block">Режим текста</Label>
                                                        <div className="flex gap-1">
                                                            <Button 
                                                                variant={el.wrap_text ? "default" : "outline"} 
                                                                size="sm" 
                                                                className="h-7 px-2 text-[9px] flex-1"
                                                                onClick={() => updateElement(el.id, { wrap_text: !el.wrap_text, auto_scale: false })}
                                                            >
                                                                <WrapIcon className="h-3 w-3 mr-1" /> Перенос
                                                            </Button>
                                                            <Button 
                                                                variant={el.auto_scale ? "default" : "outline"} 
                                                                size="sm" 
                                                                className="h-7 px-2 text-[9px] flex-1"
                                                                onClick={() => updateElement(el.id, { auto_scale: !el.auto_scale, wrap_text: false })}
                                                            >
                                                                <Scaling className="h-3 w-3 mr-1" /> Авто-масштаб
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col gap-2 border-t border-slate-100 pt-2">
                                                    <div className="flex items-center gap-1">
                                                        <span className="text-[8px] uppercase text-slate-400 font-bold mr-1">X:</span>
                                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => alignElement(el.id, 'left')} title="По левому краю">
                                                            <AlignLeft className="h-3 w-3" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => alignElement(el.id, 'center')} title="По центру">
                                                            <AlignCenter className="h-3 w-3" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => alignElement(el.id, 'right')} title="По правому краю">
                                                            <AlignRight className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <span className="text-[8px] uppercase text-slate-400 font-bold mr-1">Y:</span>
                                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => alignElementVertical(el.id, 'top')} title="По верхнему краю">
                                                            <div className="rotate-90"><AlignRight className="h-3 w-3" /></div>
                                                        </Button>
                                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => alignElementVertical(el.id, 'middle')} title="По центру">
                                                            <div className="rotate-90"><AlignCenter className="h-3 w-3" /></div>
                                                        </Button>
                                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => alignElementVertical(el.id, 'bottom')} title="По нижнему краю">
                                                            <div className="rotate-90"><AlignLeft className="h-3 w-3" /></div>
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    <Button className="w-full h-10 font-bold text-xs" onClick={() => onSave({ ...settings, active_template_id: activeTemplateId })} disabled={isPending}>
                        {isPending ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : null}
                        Сохранить
                    </Button>
                </div>

                {/* Right Panel: Big Interactive Preview */}
                <div className="lg:col-span-8 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center p-4 relative overflow-auto no-scrollbar group">
                    <div className="absolute top-4 left-4 z-10 flex gap-2">
                    <div className="bg-white rounded-lg shadow-sm border p-1 flex items-center gap-1.5">
                        <Box className="h-3.5 w-3.5 text-slate-400 ml-1" />
                        <Select 
                            value={previewProduct?.id?.toString() || ""} 
                            onValueChange={(val) => {
                                const p = products.find(p => p.id === Number(val))
                                if (p) setPreviewProduct(p)
                            }}
                        >
                            <SelectTrigger className="h-7 border-none bg-transparent focus:ring-0 text-[10px] font-bold pr-2 min-w-[120px] max-w-[200px] shadow-none">
                                <SelectValue placeholder="Выбрать товар" />
                            </SelectTrigger>
                            <SelectContent>
                                {products.map(p => (
                                    <SelectItem key={p.id} value={p.id.toString()} className="text-[10px]">
                                        {p.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                    {/* Zoom Controls */}
                    <div className="absolute top-4 right-4 z-10 flex gap-2">
                        <div className="bg-white rounded-lg shadow-sm border p-1 flex items-center gap-2">
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px]" onClick={() => setZoom(Math.max(2, zoom - 1))}>-</Button>
                            <span className="text-[10px] font-bold w-10 text-center">{zoom * 100}%</span>
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px]" onClick={() => setZoom(Math.min(10, zoom + 1))}>+</Button>
                        </div>
                    </div>

                    {/* Canvas Container */}
                    <div 
                        ref={containerRef}
                        className="relative bg-white shadow-2xl transition-all duration-200 cursor-crosshair overflow-hidden border border-slate-200"
                        style={{ 
                            width: `${activeTemplate.width_mm * zoom}px`, 
                            height: `${activeTemplate.height_mm * zoom}px`,
                            backgroundColor: activeTemplate.background_color || '#ffffff',
                            backgroundImage: activeTemplate.background_image_url ? `url(${activeTemplate.background_image_url})` : 'none',
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            fontFamily: activeTemplate.font_family || 'sans-serif',
                            boxSizing: 'border-box'
                        }}
                    >
                        {/* Grid Lines (Optional) */}
                        <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: `radial-gradient(#000 1px, transparent 0)`, backgroundSize: `${zoom}px ${zoom}px` }} />

                        <div 
                            className="absolute inset-0" 
                            onClick={(e) => {
                                e.stopPropagation();
                                setSelectedElementId(null);
                            }}
                        />

                        {activeTemplate.elements.map((el) => (
                            <div 
                                key={el.id}
                                id={`preview-el-${el.id}`}
                                className={cn(
                                    "absolute select-none cursor-move transition-shadow",
                                    selectedElementId === el.id && "z-20"
                                )}
                                style={{ 
                                    left: `${el.x * zoom}px`, 
                                    top: `${el.y * zoom}px`,
                                    width: `${(el.width || 20) * zoom}px`,
                                    height: `${(el.height || 10) * zoom}px`,
                                    transform: 'translate(0, 0)'
                                }}
                                onMouseDown={(e) => handleMouseDown(e, el.id)}
                            >
                                {/* Text Container with clipping */}
                                <div 
                                    className={cn(
                                        "w-full h-full flex items-center justify-center text-center",
                                        selectedElementId === el.id && "ring-1 ring-blue-500 shadow-sm"
                                    )}
                                    style={{
                                        overflow: 'hidden',
                                        wordBreak: 'break-word',
                                        whiteSpace: el.wrap_text ? 'normal' : 'nowrap',
                                        fontSize: el.auto_scale ? 'inherit' : `${(el.fontSize || 12) * zoom}px`,
                                        fontWeight: el.fontWeight || 'normal',
                                        color: el.color || 'black',
                                        lineHeight: 1.1,
                                        boxSizing: 'border-box'
                                    }}
                                >
                                    <div className="w-full h-full flex items-center justify-center pointer-events-none">
                                        {el.auto_scale ? (
                                            <svg 
                                                viewBox={`0 0 ${((el.width || 20) / (el.height || 10)) * 100} 100`} 
                                                width="100%" 
                                                height="100%" 
                                                preserveAspectRatio="xMidYMid meet"
                                            >
                                                <text 
                                                    x="50%" 
                                                    y="50%" 
                                                    textAnchor="middle" 
                                                    dominantBaseline="central"
                                                    fill={el.color || 'black'}
                                                    fontWeight={el.fontWeight || 'normal'}
                                                    style={{ 
                                                        fontSize: getAutoScaleFontSize(
                                                            el,
                                                            `${getPreviewFieldText(previewProduct, el.field, !!activeTemplate.show_decimals)}${el.field === 'price' ? ' ₽' : ''}`
                                                        ),
                                                        fontFamily: el.font_family || activeTemplate.font_family || 'sans-serif' 
                                                    }}
                                                >
                                                    {el.field === 'price' ? (
                                                        <>
                                                            {getPreviewFieldText(previewProduct, 'price', !!activeTemplate.show_decimals)}
                                                            <tspan style={{ fontFamily: el.currency_font_family || el.font_family || activeTemplate.font_family || 'sans-serif' }}> ₽</tspan>
                                                        </>
                                                    ) : (
                                                        getPreviewFieldText(previewProduct, el.field, !!activeTemplate.show_decimals)
                                                    )}
                                                </text>
                                            </svg>
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center" style={{ fontFamily: el.font_family || activeTemplate.font_family || 'sans-serif' }}>
                                                {el.field === 'price' ? (
                                                    <>
                                                        {getPreviewFieldText(previewProduct, 'price', !!activeTemplate.show_decimals)}
                                                        <span style={{ fontFamily: el.currency_font_family || el.font_family || activeTemplate.font_family || 'sans-serif' }}> ₽</span>
                                                    </>
                                                ) : (
                                                    getPreviewFieldText(previewProduct, el.field, !!activeTemplate.show_decimals)
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                
                                {/* Resize Handles (Outside the clipped container) */}
                                {selectedElementId === el.id && (
                                    <>
                                        {/* Top-Left */}
                                        <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-blue-500 rounded-full cursor-nwse-resize z-30 hover:scale-125 transition-transform"
                                             onMouseDown={(e) => handleResizeMouseDown(e, el.id, 'topLeft')} />
                                        {/* Top-Right */}
                                        <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-blue-500 rounded-full cursor-nesw-resize z-30 hover:scale-125 transition-transform"
                                             onMouseDown={(e) => handleResizeMouseDown(e, el.id, 'topRight')} />
                                        {/* Bottom-Left */}
                                        <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-blue-500 rounded-full cursor-nesw-resize z-30 hover:scale-125 transition-transform"
                                             onMouseDown={(e) => handleResizeMouseDown(e, el.id, 'bottomLeft')} />
                                        {/* Bottom-Right */}
                                         <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-blue-500 rounded-full cursor-nwse-resize z-30 hover:scale-125 transition-transform"
                                              onMouseDown={(e) => handleResizeMouseDown(e, el.id, 'bottomRight')} />
                                         {/* Middle-Right */}
                                         <div className="absolute top-1/2 -translate-y-1/2 -right-1.5 w-2 h-2 bg-white border border-blue-500 rounded-sm cursor-ew-resize z-30"
                                              onMouseDown={(e) => handleResizeMouseDown(e, el.id, 'right')} />
                                         {/* Middle-Left */}
                                         <div className="absolute top-1/2 -translate-y-1/2 -left-1.5 w-2 h-2 bg-white border border-blue-500 rounded-sm cursor-ew-resize z-30"
                                              onMouseDown={(e) => handleResizeMouseDown(e, el.id, 'left')} />
                                         {/* Middle-Top */}
                                         <div className="absolute left-1/2 -translate-x-1/2 -top-1.5 w-2 h-2 bg-white border border-blue-500 rounded-sm cursor-ns-resize z-30"
                                              onMouseDown={(e) => handleResizeMouseDown(e, el.id, 'top')} />
                                         {/* Middle-Bottom */}
                                         <div className="absolute left-1/2 -translate-x-1/2 -bottom-1.5 w-2 h-2 bg-white border border-blue-500 rounded-sm cursor-ns-resize z-30"
                                              onMouseDown={(e) => handleResizeMouseDown(e, el.id, 'bottom')} />
                                    </>
                                 )}
                                
                                {/* Visual Guide Lines (Visible only when dragging) */}
                                {isDragging && selectedElementId === el.id && (
                                    <>
                                        {/* Distance to LEFT edge */}
                                        <div className="absolute top-1/2 -translate-y-1/2 border-t border-rose-500 z-30" 
                                             style={{ right: '100%', width: `${el.x * zoom}px` }}>
                                            <span className="absolute left-1/2 -translate-x-1/2 -top-4 bg-rose-500 text-white text-[8px] px-1 rounded font-black whitespace-nowrap">
                                                {el.x} mm
                                            </span>
                                        </div>
                                        
                                        {/* Distance to TOP edge */}
                                        <div className="absolute left-1/2 -translate-x-1/2 border-l border-rose-500 z-30" 
                                             style={{ bottom: '100%', height: `${el.y * zoom}px` }}>
                                            <span className="absolute top-1/2 -translate-y-1/2 -left-10 bg-rose-500 text-white text-[8px] px-1 rounded font-black whitespace-nowrap">
                                                {el.y} mm
                                            </span>
                                        </div>

                                        {/* Full crosshairs */}
                                        <div className="absolute left-[-2000px] right-[-2000px] top-1/2 h-px bg-rose-500/20 -z-10 pointer-events-none" />
                                        <div className="absolute top-[-2000px] bottom-[-2000px] left-1/2 w-px bg-rose-500/20 -z-10 pointer-events-none" />
                                    </>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Status Bar */}
                    <div className="absolute bottom-4 left-4 bg-white/80 backdrop-blur-sm rounded-full px-4 py-1.5 border shadow-sm text-[10px] font-medium text-slate-500 flex gap-4">
                        <span>{activeTemplate.width_mm} x {activeTemplate.height_mm} mm</span>
                        <span className="border-l pl-4">{activeTemplate.elements.length} элементов</span>
                        {selectedElementId && (
                            <span className="border-l pl-4 text-blue-600 font-bold uppercase tracking-wider">
                                Выбран: {activeTemplate.elements.find(e => e.id === selectedElementId)?.field}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
