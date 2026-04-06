"use client"

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { Loader2, ShoppingCart, Trash2, CreditCard, Banknote, History, X, Search, Keyboard, ArrowLeft, Wallet } from "lucide-react"
import { useUiDialogs } from "@/app/clubs/[clubId]/inventory/_components/useUiDialogs"
import { useSSE } from "@/hooks/usePOSWebSocket"
import {
    createShiftReceiptSafe,
    getProductByBarcode,
    getProducts,
    getSalarySaleCandidates,
    getShiftReceipts,
    voidShiftReceiptSafe,
    returnReceiptItemSafe,
    type Product,
    type SalarySaleCandidate,
    type ShiftReceipt,
    type ShiftReceiptPaymentType
} from "@/app/clubs/[clubId]/inventory/actions"

interface EmployeeSalesWizardProps {
    clubId: string
    userId: string
    activeShiftId?: string
    inventorySettings?: {
        employee_allowed_warehouse_ids?: number[]
    }
    onExit?: () => void
}

export function EmployeeSalesWizard({ clubId, userId, activeShiftId, onExit }: EmployeeSalesWizardProps) {
    const [isPending, startTransition] = useTransition()
    const [allProducts, setAllProducts] = useState<Product[]>([])
    const [receipts, setReceipts] = useState<ShiftReceipt[]>([])
    const [salarySaleCandidates, setSalarySaleCandidates] = useState<SalarySaleCandidate[]>([])
    const { confirmAction, showMessage, Dialogs } = useUiDialogs()

    const inputRef = useRef<HTMLInputElement | null>(null)
    const paymentRef = useRef<HTMLDivElement | null>(null)
    const [inputValue, setInputValue] = useState("")
    const [selectedSuggestionIdx, setSelectedSuggestionIdx] = useState(0)

    const [cart, setCart] = useState<{ product_id: number; name: string; quantity: number; price: number }[]>([])
    const [selectedCartProductId, setSelectedCartProductId] = useState<number | null>(null)
    const [paymentType, setPaymentType] = useState<ShiftReceiptPaymentType>('cash')
    const [cashAmount, setCashAmount] = useState<string>("")
    const [cardAmount, setCardAmount] = useState<string>("")
    const [cashReceived, setCashReceived] = useState<string>("")
    const [receiptNotes, setReceiptNotes] = useState<string>("")
    const [salaryTargetUserId, setSalaryTargetUserId] = useState<string>("")

    // Return/Refund State
    const [isReturnDialogOpen, setIsReturnDialogOpen] = useState(false)
    const [selectedReceipt, setSelectedReceipt] = useState<ShiftReceipt | null>(null)
    const [returnItemId, setReturnItemId] = useState<number | null>(null)
    const [returnQuantity, setReturnQuantity] = useState("1")
    const [returnReason, setReturnReason] = useState("")

    useEffect(() => {
        document.body.style.overflow = 'hidden'
        document.body.style.position = 'fixed'
        document.body.style.width = '100%'
        document.body.style.height = '100%'
        
        // Создаем невидимый input который всегда в фокусе
        const hiddenInput = document.createElement('input')
        hiddenInput.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0;width:1px;height:1px;'
        document.body.appendChild(hiddenInput)
        
        // Всегда держим фокус на этом input
        const keepFocus = () => {
            // Не перехватываем фокус если пользователь печатает в видимом input
            const activeElement = document.activeElement as HTMLElement
            if (activeElement && activeElement.tagName === 'INPUT' && activeElement !== hiddenInput) {
                return // Пользователь печатает в видимом input - не мешаем
            }
            if (activeElement !== hiddenInput && !isReturnDialogOpen) {
                hiddenInput.focus()
            }
        }
        
        // Фокус при клике в любом месте (кроме input)
        document.addEventListener('click', keepFocus)
        
        // Первоначальный фокус
        setTimeout(() => hiddenInput.focus(), 100)
        
        return () => {
            document.body.style.overflow = ''
            document.body.style.position = ''
            document.body.style.width = ''
            document.body.style.height = ''
            document.body.removeChild(hiddenInput)
            document.removeEventListener('click', keepFocus)
        }
    }, [isReturnDialogOpen])

    const refresh = useCallback(async () => {
        if (!activeShiftId) return
        const [p, r, candidates] = await Promise.all([
            getProducts(clubId),
            getShiftReceipts(clubId, userId, activeShiftId),
            getSalarySaleCandidates(clubId)
        ])
        setAllProducts(p)
        setReceipts(r)
        setSalarySaleCandidates(candidates)
    }, [activeShiftId, clubId, userId])

    // Обработка WebSocket сообщений
    const handleWebSocketMessage = useCallback((message: any) => {
        console.log('[POS] WebSocket message:', message)
        
        if (message.type === 'RECEIPT_CREATED' || message.type === 'RECEIPT_VOIDED') {
            // Обновляем только чеки, не загружая весь каталог
            if (activeShiftId) {
                getShiftReceipts(clubId, userId, activeShiftId)
                    .then(setReceipts)
                    .catch(console.error)
            }
        }
        
        if (message.type === 'STOCK_UPDATED') {
            // Обновляем остатки конкретного товара в кэше
            setAllProducts(prev => prev.map(p => 
                p.id === message.productId 
                    ? { ...p, current_stock: message.newStock }
                    : p
            ))
        }
    }, [activeShiftId, clubId, userId])

    // SSE подключение (вместо polling)
    const { isConnected } = useSSE(handleWebSocketMessage)

    useEffect(() => {
        refresh().catch(console.error)
    }, [refresh])

    // Убрали polling interval - теперь только WebSocket
    // Оставили refresh при фокусе для надежности
    useEffect(() => {
        const onFocus = () => refresh().catch(console.error)
        window.addEventListener('focus', onFocus)

        return () => {
            window.removeEventListener('focus', onFocus)
        }
    }, [refresh])

    useEffect(() => {
        setTimeout(() => inputRef.current?.focus(), 50)
    }, [])

    const cartTotal = useMemo(() => {
        return cart.reduce((acc, i) => acc + (i.quantity * i.price), 0)
    }, [cart])

    const selectedCartIndex = useMemo(() => {
        if (!selectedCartProductId) return -1
        return cart.findIndex(i => i.product_id === selectedCartProductId)
    }, [cart, selectedCartProductId])

    const receiptTotalForShift = useMemo(() => {
        return receipts
            .filter(r => !r.voided_at && r.counts_in_revenue !== false)
            .reduce((acc, r) => acc + (Number(r.total_amount || 0) - Number(r.total_refund_amount || 0)), 0)
    }, [receipts])

    const addToCart = useCallback((product: any, quantityToAdd: number) => {
        const price = Number(product.selling_price || 0)
        setCart(prev => {
            const idx = prev.findIndex(i => i.product_id === product.id)
            if (idx === -1) return [...prev, { product_id: product.id, name: product.name, quantity: quantityToAdd, price }]
            const next = [...prev]
            next[idx] = { ...next[idx], quantity: next[idx].quantity + quantityToAdd }
            return next
        })
        setSelectedCartProductId(product.id)
    }, [])

    const isInStock = useCallback((p: Product) => {
        const stock = Number((p as any).total_stock ?? p.current_stock ?? 0)
        return Number.isFinite(stock) && stock > 0
    }, [])

    // USB Scanner - глобальный обработчик (должен быть после addToCart)
    const [barcodeBuffer, setBarcodeBuffer] = useState("")
    const lastKeyTime = useRef<number>(0)
    const [isScanning, setIsScanning] = useState(false)

    useEffect(() => {
        // Глобальный обработчик клавиатуры для USB сканера
        // Работает даже когда фокус не на input
        const handleGlobalKeydown = async (e: KeyboardEvent) => {
            // Игнорируем если фокус в textarea
            const target = e.target as HTMLElement
            if (target.tagName === 'TEXTAREA') return
            
            // Если фокус в основном input поиска - даем работать обычному обработчику
            if (inputRef.current && target === inputRef.current) return

            // USB сканер вводит символы очень быстро (интервал < 30ms)
            const now = Date.now()
            const timeDiff = now - lastKeyTime.current
            lastKeyTime.current = now

            // Enter от сканера (после штрих-кода)
            if (e.key === 'Enter' && barcodeBuffer.length > 3) {
                e.preventDefault()
                e.stopPropagation()
                const barcode = barcodeBuffer.trim()
                setBarcodeBuffer("")
                setIsScanning(false)

                // Ищем товар по штрих-коду
                try {
                    const product = await getProductByBarcode(clubId, barcode)
                    if (product && isInStock(product)) {
                        addToCart(product, 1)
                        showMessage({
                            title: "📦 Товар добавлен",
                            description: `${product.name} × 1`
                        })
                    } else if (product) {
                        showMessage({
                            title: "⚠️ Нет остатка",
                            description: `${product.name} отсутствует на доступном складе POS`
                        })
                    } else {
                        showMessage({
                            title: "❌ Товар не найден",
                            description: `Штрих-код: ${barcode}`
                        })
                    }
                } catch (error) {
                    console.error('[USB Scanner] Error:', error)
                }
                return
            }

            // Если это не первый символ и прошло мало времени - это сканер
            if (timeDiff < 30 && timeDiff > 0) {
                if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
                    setBarcodeBuffer(prev => prev + e.key)
                    setIsScanning(true)
                }
            } else {
                // Первый символ или прошло много времени - сбрасываем буфер
                if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
                    setBarcodeBuffer(e.key)
                    setIsScanning(true)
                }
            }
        }

        window.addEventListener('keydown', handleGlobalKeydown, true) // useCapture=true

        return () => {
            window.removeEventListener('keydown', handleGlobalKeydown, true)
        }
    }, [clubId, isReturnDialogOpen, addToCart, showMessage, isInStock])

    const inStockProducts = useMemo(() => {
        return allProducts.filter(isInStock)
    }, [allProducts, isInStock])

    const suggestions = useMemo(() => {
        const qRaw = inputValue.trim().toLowerCase()
        if (!qRaw) return [] as Product[]

        const en = "`qwertyuiop[]asdfghjkl;'zxcvbnm,./"
        const ru = "ёйцукенгшщзхъфывапролджэячсмитьбю."

        const swapLayout = (s: string) => {
            let out = ""
            for (const ch of s) {
                const lower = ch.toLowerCase()
                const enIdx = en.indexOf(lower)
                if (enIdx !== -1) {
                    out += ru[enIdx]
                    continue
                }
                const ruIdx = ru.indexOf(lower)
                if (ruIdx !== -1) {
                    out += en[ruIdx]
                    continue
                }
                out += lower
            }
            return out
        }

        const qSwapped = swapLayout(qRaw)
        const variants = qSwapped !== qRaw ? [qRaw, qSwapped] : [qRaw]

        const hits: { p: Product; score: number }[] = []
        for (const p of inStockProducts) {
            const name = p.name.toLowerCase()
            let bestIdx = Number.POSITIVE_INFINITY
            let bestVariantLen = 0

            for (const v of variants) {
                const idx = name.indexOf(v)
                if (idx === -1) continue
                if (idx < bestIdx) {
                    bestIdx = idx
                    bestVariantLen = v.length
                }
            }

            if (!Number.isFinite(bestIdx)) continue
            const score = (bestIdx === 0 ? 1000 : 0) + (bestVariantLen >= 3 ? 50 : 0) - bestIdx
            hits.push({ p, score })
        }
        hits.sort((a, b) => b.score - a.score)
        return hits.slice(0, 8).map(x => x.p)
    }, [inStockProducts, inputValue])

    useEffect(() => {
        setSelectedSuggestionIdx(0)
    }, [inputValue])

    const tryAddByBarcode = useCallback(async (barcode: string) => {
        const code = barcode.trim()
        if (!code) return false
        try {
            const product = await getProductByBarcode(clubId, code)
            if (!product) return false
            if (!isInStock(product)) return false
            addToCart(product, 1)
            return true
        } catch {
            return false
        }
    }, [clubId, isInStock])

    const handleInputEnter = async () => {
        if (!activeShiftId) return
        const v = inputValue.trim()
        if (!v) return

        const looksLikeBarcode = /^[0-9]{6,32}$/.test(v)
        if (looksLikeBarcode) {
            const ok = await tryAddByBarcode(v)
            if (ok) {
                setInputValue("")
                inputRef.current?.focus()
                return
            }
            const product = await getProductByBarcode(clubId, v).catch(() => null)
            if (product) {
                showMessage({ title: "Нет остатка", description: `${product.name} отсутствует на доступном складе POS` })
            } else {
                showMessage({ title: "Не найдено", description: "Штрихкод не найден в каталоге" })
            }
        }

        if (suggestions.length > 0) {
            const idx = Math.min(Math.max(selectedSuggestionIdx, 0), suggestions.length - 1)
            addToCart(suggestions[idx], 1)
            setInputValue("")
        }

        inputRef.current?.focus()
    }

    const updateCartQty = (productId: number, nextQty: number) => {
        setCart(prev => prev.map(i => (i.product_id === productId ? { ...i, quantity: Math.max(1, nextQty) } : i)))
    }

    const removeCartItem = (productId: number) => {
        setCart(prev => prev.filter(i => i.product_id !== productId))
    }

    const finalizeReceipt = () => {
        if (!activeShiftId) return
        if (cart.length === 0) return

        const total = cartTotal
        let cash = Number(cashAmount || 0)
        let card = Number(cardAmount || 0)

        if (paymentType === 'salary') {
            if (!salaryTargetUserId) {
                showMessage({ title: "Выберите сотрудника", description: "Для продажи в счет ЗП нужно выбрать сотрудника с активной сменой" })
                return
            }
        } else if (paymentType === 'mixed') {
            const hasCash = cashAmount.trim() !== ""
            const hasCard = cardAmount.trim() !== ""
            if (!hasCash && !hasCard) {
                cash = total
                card = 0
            } else if (hasCash && !hasCard) {
                card = Math.max(0, total - cash)
            } else if (!hasCash && hasCard) {
                cash = Math.max(0, total - card)
            }
            const sum = Math.round((cash + card) * 100) / 100
            const t = Math.round(total * 100) / 100
            if (sum !== t) {
                showMessage({ title: "Проверка оплаты", description: "Сумма наличных + карта должна равняться итогу" })
                return
            }
        }

        startTransition(async () => {
            const result = await createShiftReceiptSafe(clubId, userId, {
                shift_id: activeShiftId,
                payment_type: paymentType,
                items: cart.map(i => ({ product_id: i.product_id, quantity: i.quantity })),
                cash_amount: paymentType === 'mixed' ? cash : undefined,
                card_amount: paymentType === 'mixed' ? card : undefined,
                notes: receiptNotes || undefined,
                salary_target_user_id: paymentType === 'salary' ? salaryTargetUserId : undefined
            })
            if (!result.ok) {
                showMessage({ title: "Ошибка", description: result.error || "Ошибка пробития" })
                return
            }
            try {
                setCart([])
                setSelectedCartProductId(null)
                setReceiptNotes("")
                setCashAmount("")
                setCardAmount("")
                setCashReceived("")
                setSalaryTargetUserId("")
                await refresh()
                inputRef.current?.focus()
            } catch (e: any) {
                showMessage({ title: "Ошибка", description: e?.message || "Ошибка обновления POS" })
            }
        })
    }

    const cancelReceipt = (id: number) => {
        if (!activeShiftId) return
        startTransition(async () => {
            const ok = await confirmAction({
                title: "Отмена чека",
                description: `Отменить чек #${id}?`,
                confirmText: "Отменить",
                cancelText: "Не отменять"
            })
            if (!ok) return

            const result = await voidShiftReceiptSafe(clubId, userId, id)
            if (!result.ok) {
                showMessage({ title: "Ошибка", description: result.error || "Ошибка отмены" })
                return
            }

            try {
                await refresh()
            } catch (e: any) {
                showMessage({ title: "Ошибка", description: e?.message || "Ошибка отмены" })
            }
        })
    }

    const openReturnDialog = (receipt: ShiftReceipt, itemId: number) => {
        setSelectedReceipt(receipt)
        setReturnItemId(itemId)
        setReturnQuantity("1")
        setReturnReason("")
        setIsReturnDialogOpen(true)
    }

    const handleReturnReceipt = () => {
        if (!selectedReceipt || !returnItemId || !returnQuantity) return
        
        startTransition(async () => {
            const result = await returnReceiptItemSafe(
                clubId,
                userId,
                selectedReceipt.id,
                returnItemId,
                Number(returnQuantity),
                returnReason || "Возврат товара"
            )
            if (!result.ok) {
                showMessage({ title: "Ошибка", description: result.error || "Ошибка возврата" })
                return
            }

            try {
                setIsReturnDialogOpen(false)
                await refresh()
                showMessage({ 
                    title: "Возврат оформлен", 
                    description: `Товар возвращен на склад. Сумма возврата: ${Number(result.refundAmount || 0).toLocaleString('ru-RU')} ₽` 
                })
            } catch (e: any) {
                showMessage({ title: "Ошибка", description: e?.message || "Ошибка возврата" })
            }
        })
    }

    const handleExit = () => {
        setCart([])
        setInputValue("")
        setReceiptNotes("")
        setCashAmount("")
        setCardAmount("")
        setCashReceived("")
        if (onExit) onExit()
        else window.history.back()
    }

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            const el = document.activeElement as HTMLElement | null
            const isInInput = el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA' || (el?.getAttribute('role') === 'textbox')

            if (e.key === 'F2') {
                e.preventDefault()
                paymentRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
                return
            }

            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault()
                finalizeReceipt()
                return
            }

            if (!isInInput) {
                if (e.key === 'Delete' && selectedCartProductId) {
                    e.preventDefault()
                    removeCartItem(selectedCartProductId)
                    return
                }

                if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                    if (cart.length === 0) return
                    e.preventDefault()
                    const idx = cart.findIndex(i => i.product_id === selectedCartProductId)
                    const nextIdx = e.key === 'ArrowUp'
                        ? Math.max(0, (idx === -1 ? 0 : idx - 1))
                        : Math.min(cart.length - 1, (idx === -1 ? 0 : idx + 1))
                    setSelectedCartProductId(cart[nextIdx].product_id)
                    return
                }

                if ((e.key === '+' || e.key === '=' || e.code === 'NumpadAdd') && selectedCartProductId) {
                    e.preventDefault()
                    const item = cart.find(i => i.product_id === selectedCartProductId)
                    if (!item) return
                    updateCartQty(selectedCartProductId, item.quantity + 1)
                    return
                }

                if ((e.key === '-' || e.code === 'NumpadSubtract') && selectedCartProductId) {
                    e.preventDefault()
                    const item = cart.find(i => i.product_id === selectedCartProductId)
                    if (!item) return
                    const next = item.quantity - 1
                    if (next <= 0) removeCartItem(selectedCartProductId)
                    else updateCartQty(selectedCartProductId, next)
                    return
                }
            }

            if (e.key === 'Escape') {
                if (inputValue.trim()) {
                    e.preventDefault()
                    setInputValue("")
                    inputRef.current?.focus()
                    return
                }
            }
        }

        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [cart, inputValue, selectedCartProductId, cartTotal, paymentType, cashAmount, cardAmount, receiptNotes])

    useEffect(() => {
        if (cart.length === 0) return
        if (selectedCartProductId && cart.some(i => i.product_id === selectedCartProductId)) return
        setSelectedCartProductId(cart[cart.length - 1].product_id)
    }, [cart, selectedCartProductId])

    const changeDue = useMemo(() => {
        if (paymentType !== 'cash') return 0
        const received = Number(cashReceived || 0)
        if (!Number.isFinite(received)) return 0
        return Math.max(0, Math.round((received - cartTotal) * 100) / 100)
    }, [paymentType, cashReceived, cartTotal])

    useEffect(() => {
        if (paymentType !== 'mixed') return
        if (cartTotal <= 0) return

        const cashStr = cashAmount.trim()
        const cardStr = cardAmount.trim()
        const cash = Number(cashStr || 0)
        const card = Number(cardStr || 0)

        if (cashStr !== "" && cardStr === "") {
            const remainder = Math.max(0, Math.round((cartTotal - cash) * 100) / 100)
            setCardAmount(String(remainder))
            return
        }
        if (cardStr !== "" && cashStr === "") {
            const remainder = Math.max(0, Math.round((cartTotal - card) * 100) / 100)
            setCashAmount(String(remainder))
            return
        }
    }, [paymentType, cartTotal])

    return (
        <>
            <div className="min-h-screen bg-slate-950 text-white flex flex-col">
                <div className="p-4 border-b border-slate-800 flex items-start justify-between gap-3 sticky top-0 bg-slate-950 z-50">
                    <div className="space-y-0.5">
                        <div className="flex items-center gap-2 text-xl font-black">
                            <ShoppingCart className="h-4 w-4 text-emerald-400" />
                            Касса (Смена)
                        </div>
                        <div className="text-slate-400 text-sm leading-tight">
                            Собирайте чек, выбирайте оплату, пробивайте. Остатки спишутся при завершении смены.
                        </div>
                    </div>
                    <Button
                        variant="outline"
                        className="h-12 border-slate-800 bg-slate-900/50 hover:bg-slate-800 rounded-xl shrink-0 text-base"
                        onClick={handleExit}
                    >
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Назад
                    </Button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 w-full max-w-7xl mx-auto space-y-6">
                    {!activeShiftId ? (
                        <div className="text-base text-slate-400">Нет активной смены</div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-4 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div className="text-xs text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                                <Search className="h-3 w-3" />
                                                Поиск / Сканер
                                                <span className={cn(
                                                    "ml-2 px-1.5 py-0.5 rounded text-[9px] font-bold",
                                                    isConnected ? "bg-green-900/50 text-green-400 border border-green-800" : "bg-amber-900/50 text-amber-400 border border-amber-800"
                                                )}>
                                                    {isConnected ? '● LIVE' : '● RECONNECTING'}
                                                </span>
                                                {isScanning && (
                                                    <span className="ml-2 px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-900/50 text-blue-400 border border-blue-800 animate-pulse">
                                                        📷 СКАНИРОВАНИЕ
                                                    </span>
                                                )}
                                            </div>
                                            <Badge className="bg-slate-800 text-slate-300 border-slate-700 text-xs px-2 py-1">Enter</Badge>
                                        </div>
                                        <Input
                                            ref={inputRef}
                                            value={inputValue}
                                            onChange={e => setInputValue(e.target.value)}
                                            onKeyDown={e => {
                                                if (e.key === "Enter") {
                                                    e.preventDefault()
                                                    handleInputEnter()
                                                } else if (e.key === "ArrowDown") {
                                                    if (suggestions.length > 0) {
                                                        e.preventDefault()
                                                        setSelectedSuggestionIdx(i => Math.min(suggestions.length - 1, i + 1))
                                                    }
                                                } else if (e.key === "ArrowUp") {
                                                    if (suggestions.length > 0) {
                                                        e.preventDefault()
                                                        setSelectedSuggestionIdx(i => Math.max(0, i - 1))
                                                    }
                                                }
                                            }}
                                            placeholder="Сканируйте штрихкод или начните вводить название"
                                            className="bg-slate-950 border-slate-800 h-14 rounded-xl font-mono text-lg"
                                            disabled={isPending}
                                        />
                                        {suggestions.length > 0 && inputValue.trim() !== "" && (
                                            <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
                                                {suggestions.map((p, idx) => (
                                                    <button
                                                        key={p.id}
                                                        type="button"
                                                        className={cn(
                                                            "w-full text-left px-3 py-2 text-[11px] hover:bg-slate-900 flex items-center justify-between",
                                                            idx === selectedSuggestionIdx ? "bg-slate-900" : ""
                                                        )}
                                                        onMouseEnter={() => setSelectedSuggestionIdx(idx)}
                                                        onClick={() => {
                                                            addToCart(p, 1)
                                                            setInputValue("")
                                                            inputRef.current?.focus()
                                                        }}
                                                    >
                                                        <span className="truncate pr-3">{p.name}</span>
                                                        <span className="text-slate-500 shrink-0">{Number(p.selling_price || 0)} ₽</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                        <div className="flex items-center justify-between text-xs text-slate-500 px-0.5">
                                            <div className="flex items-center gap-2">
                                                <Keyboard className="h-3 w-3" />
                                                F2: оплата · Ctrl+Enter: пробить · Del: удалить · +/-: кол-во
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-slate-900/30 border border-slate-800 rounded-xl overflow-hidden">
                                        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                                            <div className="text-base font-black text-white/90 flex items-center gap-2">
                                                <ShoppingCart className="h-5 w-5 text-emerald-400" />
                                                Текущий чек
                                            </div>
                                            <Badge className="bg-emerald-500/20 text-emerald-200 border-emerald-500/30 text-base px-3 py-1">
                                                {cartTotal.toLocaleString()} ₽
                                            </Badge>
                                        </div>
                                        <div className="p-2">
                                            {cart.length === 0 ? (
                                                    <div className="p-6 text-base text-slate-400">Пусто</div>
                                            ) : (
                                                <Table>
                                                    <TableBody>
                                                        {cart.map(i => (
                                                            <TableRow
                                                                key={i.product_id}
                                                                className={cn(
                                                                    "border-slate-800 hover:bg-slate-900/50 cursor-pointer",
                                                                    i.product_id === selectedCartProductId ? "bg-slate-900/70" : ""
                                                                )}
                                                                onClick={() => setSelectedCartProductId(i.product_id)}
                                                            >
                                                                <TableCell className="py-3">
                                                                    <div className="flex items-center justify-between gap-3">
                                                                        <div className="min-w-0">
                                                                            <div className="text-base font-bold truncate">{i.name}</div>
                                                                            <div className="text-xs text-slate-500 truncate">{i.quantity} × {i.price} ₽</div>
                                                                        </div>
                                                                        <div className="flex items-center gap-2">
                                                                            <Input
                                                                                type="number"
                                                                                min="1"
                                                                                value={String(i.quantity)}
                                                                                onChange={e => updateCartQty(i.product_id, parseInt(e.target.value || "1"))}
                                                                                className={cn("w-24 h-11 bg-slate-950 border-slate-800 text-right font-black text-base")}
                                                                                disabled={isPending}
                                                                            />
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="icon"
                                                                                className="h-9 w-9 text-red-300 hover:text-white hover:bg-red-500/20"
                                                                                onClick={() => removeCartItem(i.product_id)}
                                                                                disabled={isPending}
                                                                            >
                                                                                <Trash2 className="h-4 w-4" />
                                                                            </Button>
                                                                        </div>
                                                                    </div>
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            )}
                                        </div>
                                        {cart.length > 0 && (
                                            <div className="px-4 py-2 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-500">
                                                <span>Выбрано: {selectedCartIndex === -1 ? "—" : `${selectedCartIndex + 1}/${cart.length}`}</span>
                                                <Button
                                                    variant="ghost"
                                                                className="h-10 text-xs text-slate-300 hover:bg-slate-800"
                                                    onClick={() => {
                                                        startTransition(async () => {
                                                            const ok = await confirmAction({
                                                                title: "Очистить чек",
                                                                description: "Очистить текущий чек?",
                                                                confirmText: "Очистить",
                                                                cancelText: "Отмена"
                                                            })
                                                            if (!ok) return
                                                            setCart([])
                                                            setSelectedCartProductId(null)
                                                            setCashAmount("")
                                                            setCardAmount("")
                                                            setCashReceived("")
                                                            setReceiptNotes("")
                                                            inputRef.current?.focus()
                                                        })
                                                    }}
                                                    disabled={isPending}
                                                >
                                                    Очистить
                                                </Button>
                                            </div>
                                        )}
                                    </div>

                                    <div ref={paymentRef} className="bg-slate-900/30 border border-slate-800 rounded-xl p-4 space-y-3">
                                        <div className="text-xs text-slate-400 uppercase tracking-wider">Оплата</div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <div className="space-y-2">
                                                <Label className="text-sm text-slate-300">Тип оплаты</Label>
                                                <Select value={paymentType} onValueChange={(v: any) => {
                                                    setPaymentType(v)
                                                    if (v !== 'mixed') {
                                                        setCashAmount("")
                                                        setCardAmount("")
                                                    }
                                                    if (v !== 'cash') {
                                                        setCashReceived("")
                                                    }
                                                    if (v !== 'salary') {
                                                        setSalaryTargetUserId("")
                                                    }
                                                }}>
                                                    <SelectTrigger className="bg-slate-950 border-slate-800 h-12 rounded-xl text-base">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="cash">
                                                            <div className="flex items-center gap-2"><Banknote className="h-4 w-4" /> Наличные</div>
                                                        </SelectItem>
                                                        <SelectItem value="card">
                                                            <div className="flex items-center gap-2"><CreditCard className="h-4 w-4" /> Карта</div>
                                                        </SelectItem>
                                                        <SelectItem value="mixed">
                                                            <div className="flex items-center gap-2"><CreditCard className="h-4 w-4" /> Смешанная</div>
                                                        </SelectItem>
                                                        <SelectItem value="salary">
                                                            <div className="flex items-center gap-2"><Wallet className="h-4 w-4" /> В счет ЗП</div>
                                                        </SelectItem>
                                                        <SelectItem value="other">Другое</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-sm text-slate-300">Комментарий (опц.)</Label>
                                                <Input
                                                    value={receiptNotes}
                                                    onChange={e => setReceiptNotes(e.target.value)}
                                                    className="bg-slate-950 border-slate-800 h-12 rounded-xl text-base"
                                                    disabled={isPending}
                                                />
                                            </div>
                                        </div>
                                        {paymentType === 'salary' && (
                                            <div className="space-y-3">
                                                <div className="space-y-2">
                                                    <Label className="text-sm text-slate-300">На кого записать покупку</Label>
                                                    <Select value={salaryTargetUserId} onValueChange={setSalaryTargetUserId}>
                                                        <SelectTrigger className="bg-slate-950 border-slate-800 h-12 rounded-xl text-base">
                                                            <SelectValue placeholder="Выберите сотрудника со сменами в этом месяце" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {salarySaleCandidates.map((candidate) => (
                                                                <SelectItem key={candidate.id} value={candidate.id}>
                                                                    {candidate.full_name} · {candidate.role} · доступно {candidate.available_amount.toLocaleString('ru-RU')} ₽
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-100">
                                                    Этот чек спишет товар как продажу, но не попадет в обычную выручку. Сумма запишется в покупки бара выбранного сотрудника за текущий месяц.
                                                </div>
                                            </div>
                                        )}
                                        {paymentType === 'cash' && (
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-2">
                                                    <Label className="text-sm text-slate-300">Получено</Label>
                                                    <Input
                                                        value={cashReceived}
                                                        onChange={e => setCashReceived(e.target.value)}
                                                        type="number"
                                                        className="bg-slate-950 border-slate-800 h-12 rounded-xl text-base"
                                                        disabled={isPending}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label className="text-sm text-slate-300">Сдача</Label>
                                                    <div className="h-12 rounded-xl border border-slate-800 bg-slate-950 flex items-center justify-between px-3">
                                                        <span className="text-sm text-slate-500">к выдаче</span>
                                                        <span className="text-lg font-black text-emerald-300">{changeDue.toLocaleString()} ₽</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        {paymentType === 'mixed' && (
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-2">
                                                    <Label className="text-xs text-slate-400">Нал</Label>
                                                    <Input
                                                        value={cashAmount}
                                                        onChange={e => setCashAmount(e.target.value)}
                                                        type="number"
                                                        className="bg-slate-950 border-slate-800 h-11 rounded-xl"
                                                        disabled={isPending}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label className="text-xs text-slate-400">Карта</Label>
                                                    <Input
                                                        value={cardAmount}
                                                        onChange={e => setCardAmount(e.target.value)}
                                                        type="number"
                                                        className="bg-slate-950 border-slate-800 h-11 rounded-xl"
                                                        disabled={isPending}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                        <Button
                                            onClick={finalizeReceipt}
                                            disabled={isPending || cart.length === 0}
                                            className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 rounded-xl font-black text-lg"
                                        >
                                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                            Пробить чек ({cartTotal.toLocaleString()} ₽)
                                        </Button>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-4">
                                        <div className="flex items-center justify-between">
                                            <div className="text-base font-black text-white/90 flex items-center gap-2">
                                                <History className="h-5 w-5 text-blue-400" />
                                                История за смену
                                            </div>
                                            <Badge className="bg-blue-500/20 text-blue-200 border-blue-500/30 text-base px-3 py-1">
                                                {receiptTotalForShift.toLocaleString()} ₽
                                            </Badge>
                                        </div>
                                    </div>

                                    <div className="bg-slate-900/30 border border-slate-800 rounded-xl overflow-hidden">
                                        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                                            <div className="text-[11px] font-bold text-white/80">Чеки</div>
                                            <Button
                                                variant="ghost"
                                                className="h-8 text-[10px] text-slate-300 hover:bg-slate-800"
                                                onClick={() => refresh()}
                                                disabled={isPending}
                                            >
                                                Обновить
                                            </Button>
                                        </div>
                                        <div className="p-2 max-h-[70vh] overflow-y-auto">
                                            {receipts.length === 0 ? (
                                                <div className="p-4 text-[11px] text-slate-400">Пока нет чеков</div>
                                            ) : (
                                                <div className="space-y-2">
                                                    {receipts.filter(r => !r.voided_at).map(r => (
                                                        <div key={r.id} className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/30">
                                                            <div className="p-3 flex items-center justify-between gap-3">
                                                                <div className="min-w-0">
                                                                    <div className="text-[11px] font-bold truncate">Чек #{r.id}</div>
                                                                    <div className="text-[9px] text-slate-500 truncate">
                                                                        {new Date(r.created_at).toLocaleTimeString()} · {r.payment_type === 'salary' ? 'В СЧЕТ ЗП' : r.payment_type.toUpperCase()} · {r.total_amount} ₽
                                                                        {(r.total_refund_amount || 0) > 0 && (
                                                                             <span className="text-amber-400 ml-1">
                                                                                 (возврат: {(r.total_refund_amount || 0)} ₽, итог: {r.total_amount - (r.total_refund_amount || 0)} ₽)
                                                                             </span>
                                                                         )}
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    {r.committed_at ? (
                                                                        <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">Проведен</Badge>
                                                                    ) : (
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            className="h-9 w-9 text-red-300 hover:text-white hover:bg-red-500/20"
                                                                            onClick={() => cancelReceipt(r.id)}
                                                                            disabled={isPending}
                                                                            title="Отменить"
                                                                        >
                                                                            <X className="h-4 w-4" />
                                                                        </Button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            {r.items?.length > 0 && (
                                                                <div className="px-3 pb-3 space-y-1">
                                                                    {r.items.map(it => {
                                                                        const isFullyReturned = (it.available_qty || 0) <= 0
                                                                        const returnedQty = it.returned_qty || 0
                                                                        
                                                                        return (
                                                                            <div key={it.id} className="flex justify-between items-center text-[10px] text-slate-400">
                                                                                <span className="truncate pr-2">{it.product_name}</span>
                                                                                <div className="flex items-center gap-2 shrink-0">
                                                                                    <span className={isFullyReturned ? "line-through text-slate-600" : ""}>
                                                                                        {it.quantity} × {it.selling_price_snapshot} ₽
                                                                                    </span>
                                                                                    {returnedQty > 0 && (
                                                                                        <span className="text-[9px] text-slate-500">
                                                                                            (возвращено: {returnedQty})
                                                                                        </span>
                                                                                    )}
                                                                                    {!isFullyReturned ? (
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() => openReturnDialog(r, it.id)}
                                                                                            className="text-[9px] text-amber-400 hover:text-amber-300 hover:bg-amber-500/20 px-1.5 py-0.5 rounded transition-colors"
                                                                                            title="Вернуть товар"
                                                                                            disabled={isPending}
                                                                                        >
                                                                                            Возврат
                                                                                        </button>
                                                                                    ) : (
                                                                                        <span className="text-[9px] text-green-500 font-bold">
                                                                                            ✓
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        )
                                                                    })}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Return Dialog */}
            <Dialog open={isReturnDialogOpen} onOpenChange={setIsReturnDialogOpen}>
                <DialogContent className="bg-slate-950 border-slate-800 text-white max-w-md">
                    <DialogHeader>
                        <DialogTitle>Возврат товара</DialogTitle>
                        <DialogDescription className="text-slate-400">
                            {selectedReceipt?.items?.find(i => i.id === returnItemId)?.product_name}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                            <div className="text-xs text-slate-400 mb-1">Доступно для возврата:</div>
                            <div className="text-lg font-bold text-white">
                                {selectedReceipt?.items?.find(i => i.id === returnItemId)?.available_qty || 0} из {selectedReceipt?.items?.find(i => i.id === returnItemId)?.quantity} шт.
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-sm text-slate-300">Количество</Label>
                            <Input
                                type="number"
                                min="1"
                                max={selectedReceipt?.items?.find(i => i.id === returnItemId)?.available_qty}
                                value={returnQuantity}
                                onChange={e => setReturnQuantity(e.target.value)}
                                className="bg-slate-900 border-slate-800 h-12 rounded-xl text-base"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-sm text-slate-300">Причина возврата</Label>
                            <Input
                                value={returnReason}
                                onChange={e => setReturnReason(e.target.value)}
                                placeholder="Например: товар не подошел"
                                className="bg-slate-900 border-slate-800 h-12 rounded-xl text-base"
                            />
                        </div>
                        <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                            <div className="text-xs text-slate-400 mb-1">Сумма возврата:</div>
                            <div className="text-2xl font-black text-emerald-400">
                                {(Number(returnQuantity) * (selectedReceipt?.items?.find(i => i.id === returnItemId)?.selling_price_snapshot || 0)).toLocaleString('ru-RU')} ₽
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsReturnDialogOpen(false)} className="border-slate-800">
                            Отмена
                        </Button>
                        <Button 
                            onClick={handleReturnReceipt} 
                            disabled={!returnQuantity || Number(returnQuantity) <= 0 || isPending || Number(returnQuantity) > (selectedReceipt?.items?.find(i => i.id === returnItemId)?.available_qty || 0)}
                            className="bg-amber-600 hover:bg-amber-700"
                        >
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Оформить возврат
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {Dialogs}
        </>
    )
}
