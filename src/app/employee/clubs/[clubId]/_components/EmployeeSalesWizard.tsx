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

const roundMoney = (value: number) => Math.round(value * 100) / 100

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

    const [cart, setCart] = useState<{
        product_id: number
        name: string
        quantity: number
        selling_price: number
        cost_price: number
        price: number
    }[]>([])
    const [selectedCartProductId, setSelectedCartProductId] = useState<number | null>(null)
    const [paymentType, setPaymentType] = useState<ShiftReceiptPaymentType>('cash')
    const [cashAmount, setCashAmount] = useState<string>("")
    const [cardAmount, setCardAmount] = useState<string>("")
    const [cashReceived, setCashReceived] = useState<string>("")
    const [receiptNotes, setReceiptNotes] = useState<string>("")
    const [salaryTargetUserId, setSalaryTargetUserId] = useState<string>("")
    const salaryPricing = useMemo(() => {
        const candidate = salarySaleCandidates.find((item) => item.id === salaryTargetUserId)
        return {
            discountPercent: Number(candidate?.discount_percent ?? 0),
            priceMode: candidate?.price_mode === "COST" ? "COST" : "SELLING",
        }
    }, [salarySaleCandidates, salaryTargetUserId])

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

    useEffect(() => {
        setCart((prev) => prev.map((item) => {
            const baseUnitPrice = paymentType === "salary"
                ? (salaryPricing.priceMode === "COST" ? item.cost_price : item.selling_price)
                : item.selling_price
            const effectiveUnitPrice = paymentType === "salary" && salaryPricing.priceMode === "SELLING"
                ? roundMoney(baseUnitPrice * (1 - salaryPricing.discountPercent / 100))
                : baseUnitPrice
            return { ...item, price: effectiveUnitPrice }
        }))
    }, [paymentType, salaryPricing.discountPercent, salaryPricing.priceMode])

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
        const sellingPrice = Number(product.selling_price || 0)
        const costPrice = Number(product.cost_price || 0)
        const baseUnitPrice = paymentType === "salary"
            ? (salaryPricing.priceMode === "COST" ? costPrice : sellingPrice)
            : sellingPrice
        const price = paymentType === "salary" && salaryPricing.priceMode === "SELLING"
            ? roundMoney(baseUnitPrice * (1 - salaryPricing.discountPercent / 100))
            : baseUnitPrice
        setCart(prev => {
            const idx = prev.findIndex(i => i.product_id === product.id)
            if (idx === -1) return [...prev, { product_id: product.id, name: product.name, quantity: quantityToAdd, selling_price: sellingPrice, cost_price: costPrice, price }]
            const next = [...prev]
            next[idx] = { ...next[idx], quantity: next[idx].quantity + quantityToAdd, price }
            return next
        })
        setSelectedCartProductId(product.id)
    }, [paymentType, salaryPricing.discountPercent, salaryPricing.priceMode])

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
                            description: `${product.name} отсутствует на доступном складе кассы`
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
    }, [addToCart, clubId, isInStock])

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
                showMessage({ title: "Нет остатка", description: `${product.name} отсутствует на доступном складе кассы` })
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
                showMessage({ title: "Ошибка", description: e?.message || "Ошибка обновления кассы" })
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
        document.title = "Касса - DashAdmin"
        
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
            <div className="h-[100dvh] bg-zinc-950 text-foreground flex flex-col font-sans selection:bg-primary/20 overflow-hidden">
                <main className="flex-1 flex flex-col min-h-0 w-full max-w-6xl mx-auto p-6 lg:p-8">
                    {!activeShiftId ? (
                        <div className="flex flex-col items-center justify-center h-full text-center animate-in fade-in duration-500">
                            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                                <History className="h-6 w-6 text-muted-foreground" />
                            </div>
                            <h2 className="text-xl font-medium tracking-tight mb-2">Нет активной смены</h2>
                            <p className="text-muted-foreground max-w-sm mx-auto">Откройте смену, чтобы начать принимать оплаты и списывать товары.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-both min-h-0">
                            
                            {/* Left Column: Search, Cart & Payment */}
                            <div className="lg:col-span-8 flex flex-col gap-5 min-h-0">
                                {/* Search Section */}
                                <section className="shrink-0 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-widest">Поиск товаров</h2>
                                        <div className="flex items-center gap-3 text-xs">
                                            <span className={cn(
                                                "flex items-center gap-1.5 font-medium transition-colors",
                                                isConnected ? "text-emerald-500" : "text-amber-500"
                                            )}>
                                                <span className={cn("h-1.5 w-1.5 rounded-full", isConnected ? "bg-emerald-500" : "bg-amber-500 animate-pulse")} />
                                                {isConnected ? 'Подключено' : 'Переподключение'}
                                            </span>
                                            {isScanning && (
                                                <span className="flex items-center gap-1.5 text-blue-500 font-medium animate-pulse">
                                                    <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                                                    Сканер
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    
                                    <div className="relative group">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground transition-colors group-focus-within:text-primary" />
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
                                            placeholder="Штрихкод или название..."
                                            className="h-14 pl-12 pr-16 rounded-2xl bg-zinc-900/50 border-zinc-800/50 focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/20 text-lg transition-all"
                                            disabled={isPending}
                                        />
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs text-muted-foreground font-medium bg-zinc-900 px-2 py-1 rounded-md border border-zinc-800/50">
                                            <span>↵</span> Enter
                                        </div>

                                        {suggestions.length > 0 && inputValue.trim() !== "" && (
                                        <div className="absolute z-10 w-full mt-2 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 max-h-[300px] overflow-y-auto custom-scrollbar">
                                                {suggestions.map((p, idx) => (
                                                    <button
                                                        key={p.id}
                                                        type="button"
                                                        className={cn(
                                                            "w-full text-left px-5 py-4 text-base flex items-center justify-between transition-colors",
                                                            idx === selectedSuggestionIdx ? "bg-zinc-800/80" : "hover:bg-zinc-800/50"
                                                        )}
                                                        onMouseEnter={() => setSelectedSuggestionIdx(idx)}
                                                        onClick={() => {
                                                            addToCart(p, 1)
                                                            setInputValue("")
                                                            inputRef.current?.focus()
                                                        }}
                                                    >
                                                        <span className="font-medium truncate pr-4">{p.name}</span>
                                                        <span className="text-muted-foreground shrink-0 font-mono text-lg">{Number(p.selling_price || 0).toLocaleString()} ₽</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </section>

                                {/* Cart Section */}
                                <section className="flex-1 flex flex-col min-h-0 gap-3">
                                    <div className="flex items-center justify-between shrink-0">
                                        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-widest">Текущий чек</h2>
                                        {cart.length > 0 && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                onClick={() => {
                                                    startTransition(async () => {
                                                        const ok = await confirmAction({
                                                            title: "Очистить чек",
                                                            description: "Вы уверены, что хотите очистить текущий чек?",
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
                                            >
                                                Очистить всё
                                            </Button>
                                        )}
                                    </div>
                                    
                                    <div className="flex-1 rounded-2xl border border-zinc-800/50 bg-zinc-900/30 overflow-hidden flex flex-col max-h-[30vh]">
                                        {cart.length === 0 ? (
                                            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                                                <div className="h-12 w-12 rounded-full border border-dashed border-zinc-700 flex items-center justify-center mb-3">
                                                    <ShoppingCart className="h-5 w-5 text-muted-foreground/30" />
                                                </div>
                                                <p className="text-sm text-muted-foreground">Чек пуст. Отсканируйте товар.</p>
                                            </div>
                                        ) : (
                                            <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                                                <div className="space-y-1">
                                                    {cart.map(i => (
                                                        <div
                                                            key={i.product_id}
                                                            className={cn(
                                                                "group flex items-center justify-between p-2.5 rounded-xl transition-colors cursor-pointer",
                                                                i.product_id === selectedCartProductId ? "bg-zinc-800/80" : "hover:bg-zinc-800/40"
                                                            )}
                                                            onClick={() => setSelectedCartProductId(i.product_id)}
                                                        >
                                                            <div className="min-w-0 flex-1 pr-3">
                                                                <div className="text-sm font-medium truncate">{i.name}</div>
                                                                <div className="text-xs text-muted-foreground mt-0.5 font-mono">
                                                                    {i.quantity} × {i.price.toLocaleString()} ₽
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-2.5 shrink-0">
                                                                <div className="flex items-center bg-zinc-950 rounded-md border border-zinc-800/50 overflow-hidden">
                                                                    <button 
                                                                        className="px-2.5 py-1 text-muted-foreground hover:bg-zinc-800 transition-colors text-sm"
                                                                        onClick={(e) => { e.stopPropagation(); updateCartQty(i.product_id, Math.max(1, i.quantity - 1)) }}
                                                                    >−</button>
                                                                    <div className="w-8 text-center font-medium font-mono text-xs">{i.quantity}</div>
                                                                    <button 
                                                                        className="px-2.5 py-1 text-muted-foreground hover:bg-zinc-800 transition-colors text-sm"
                                                                        onClick={(e) => { e.stopPropagation(); updateCartQty(i.product_id, i.quantity + 1) }}
                                                                    >+</button>
                                                                </div>
                                                                <div className="w-16 text-right text-sm font-semibold font-mono">
                                                                    {(i.quantity * i.price).toLocaleString()} ₽
                                                                </div>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive hover:bg-destructive/10 transition-all"
                                                                    onClick={(e) => { e.stopPropagation(); removeCartItem(i.product_id) }}
                                                                    disabled={isPending}
                                                                >
                                                                    <Trash2 className="h-3.5 w-3.5" />
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {cart.length > 0 && (
                                            <div className="p-4 border-t border-zinc-800/50 bg-zinc-900/50 flex items-center justify-between">
                                                <span className="text-muted-foreground font-medium">Итого к оплате</span>
                                                <span className="text-3xl font-bold tracking-tight font-mono">{cartTotal.toLocaleString()} ₽</span>
                                            </div>
                                        )}
                                    </div>
                                </section>

                                {/* Payment Section */}
                                <section ref={paymentRef} className="flex flex-col gap-5">
                                    <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-widest">Оплата</h2>
                                    
                                    <div className="p-6 rounded-3xl border border-zinc-800/50 bg-zinc-900/30 space-y-6">
                                        <div className="space-y-3">
                                            <Label className="text-xs font-medium text-muted-foreground">Способ оплаты</Label>
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
                                                <SelectTrigger className="h-14 rounded-2xl border border-zinc-800 bg-zinc-950 px-4 text-base font-medium text-zinc-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] data-[placeholder]:text-zinc-500">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-2xl border-zinc-800 bg-zinc-950/98 p-2 text-zinc-100 shadow-2xl shadow-black/60 backdrop-blur-xl">
                                                    <SelectItem value="cash" className="rounded-xl border border-transparent px-3 py-3 text-[15px] font-medium text-zinc-100 focus:border-zinc-700 focus:bg-zinc-900 focus:text-white data-[state=checked]:border-zinc-700 data-[state=checked]:bg-zinc-900 data-[state=checked]:text-white">
                                                        <div className="flex items-center gap-3">
                                                            <Banknote className="h-4 w-4 text-zinc-400" />
                                                            <span>Наличные</span>
                                                        </div>
                                                    </SelectItem>
                                                    <SelectItem value="card" className="rounded-xl border border-transparent px-3 py-3 text-[15px] font-medium text-zinc-100 focus:border-zinc-700 focus:bg-zinc-900 focus:text-white data-[state=checked]:border-zinc-700 data-[state=checked]:bg-zinc-900 data-[state=checked]:text-white">
                                                        <div className="flex items-center gap-3">
                                                            <CreditCard className="h-4 w-4 text-zinc-400" />
                                                            <span>Карта</span>
                                                        </div>
                                                    </SelectItem>
                                                    <SelectItem value="mixed" className="rounded-xl border border-transparent px-3 py-3 text-[15px] font-medium text-zinc-100 focus:border-zinc-700 focus:bg-zinc-900 focus:text-white data-[state=checked]:border-zinc-700 data-[state=checked]:bg-zinc-900 data-[state=checked]:text-white">
                                                        <div className="flex items-center gap-3">
                                                            <Wallet className="h-4 w-4 text-zinc-400" />
                                                            <span>Смешанная</span>
                                                        </div>
                                                    </SelectItem>
                                                    <SelectItem value="salary" className="rounded-xl border border-transparent px-3 py-3 text-[15px] font-medium text-zinc-100 focus:border-zinc-700 focus:bg-zinc-900 focus:text-white data-[state=checked]:border-zinc-700 data-[state=checked]:bg-zinc-900 data-[state=checked]:text-white">
                                                        <div className="flex items-center gap-3">
                                                            <Wallet className="h-4 w-4 text-zinc-400" />
                                                            <span>В счет ЗП</span>
                                                        </div>
                                                    </SelectItem>
                                                    <SelectItem value="other" className="rounded-xl border border-transparent px-3 py-3 text-[15px] font-medium text-zinc-100 focus:border-zinc-700 focus:bg-zinc-900 focus:text-white data-[state=checked]:border-zinc-700 data-[state=checked]:bg-zinc-900 data-[state=checked]:text-white">
                                                        <div className="flex items-center gap-3">
                                                            <Wallet className="h-4 w-4 text-zinc-400" />
                                                            <span>Другое</span>
                                                        </div>
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {paymentType === 'salary' && (
                                            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                                <div className="space-y-3">
                                                    <Label className="text-xs font-medium text-muted-foreground">Сотрудник</Label>
                                                    <Select value={salaryTargetUserId} onValueChange={setSalaryTargetUserId}>
                                                        <SelectTrigger className="h-14 rounded-2xl border border-zinc-800 bg-zinc-950 px-4 text-base text-zinc-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] data-[placeholder]:text-zinc-500">
                                                            <SelectValue placeholder="Выберите сотрудника..." />
                                                        </SelectTrigger>
                                                        <SelectContent className="rounded-2xl border-zinc-800 bg-zinc-950/98 p-2 text-zinc-100 shadow-2xl shadow-black/60 backdrop-blur-xl">
                                                            {salarySaleCandidates.map((candidate) => (
                                                                <SelectItem
                                                                    key={candidate.id}
                                                                    value={candidate.id}
                                                                    className="rounded-xl border border-transparent px-3 py-3 text-left text-zinc-100 focus:border-zinc-700 focus:bg-zinc-900 focus:text-white data-[state=checked]:border-zinc-700 data-[state=checked]:bg-zinc-900 data-[state=checked]:text-white"
                                                                >
                                                                    <div className="flex min-w-0 flex-col gap-1 pr-4">
                                                                        <span className="truncate text-[15px] font-semibold leading-none">{candidate.full_name}</span>
                                                                        <span className="text-xs text-zinc-400">
                                                                            {candidate.role} · доступно {candidate.available_amount.toLocaleString()} ₽
                                                                        </span>
                                                                    </div>
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>
                                        )}

                                        {paymentType === 'cash' && (
                                            <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                                <div className="space-y-3">
                                                    <Label className="text-xs font-medium text-muted-foreground">Получено (₽)</Label>
                                                    <Input
                                                        value={cashReceived}
                                                        onChange={e => setCashReceived(e.target.value)}
                                                        type="number"
                                                        placeholder="0"
                                                        className="h-14 bg-zinc-950 border-zinc-800/50 rounded-xl text-lg font-mono font-medium"
                                                        disabled={isPending}
                                                    />
                                                </div>
                                                <div className="space-y-3">
                                                    <Label className="text-xs font-medium text-muted-foreground">Сдача</Label>
                                                    <div className="h-14 rounded-xl border border-transparent bg-zinc-900 flex items-center justify-end px-4">
                                                        <span className={cn(
                                                            "text-xl font-bold font-mono tracking-tight",
                                                            changeDue > 0 ? "text-emerald-500" : "text-muted-foreground"
                                                        )}>
                                                            {changeDue > 0 ? `+${changeDue.toLocaleString()}` : "0"} ₽
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {paymentType === 'mixed' && (
                                            <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                                <div className="space-y-3">
                                                    <Label className="text-xs font-medium text-muted-foreground">Наличные (₽)</Label>
                                                    <Input
                                                        value={cashAmount}
                                                        onChange={e => setCashAmount(e.target.value)}
                                                        type="number"
                                                        placeholder="0"
                                                        className="h-14 bg-zinc-950 border-zinc-800/50 rounded-xl text-base font-mono"
                                                        disabled={isPending}
                                                    />
                                                </div>
                                                <div className="space-y-3">
                                                    <Label className="text-xs font-medium text-muted-foreground">Карта (₽)</Label>
                                                    <Input
                                                        value={cardAmount}
                                                        onChange={e => setCardAmount(e.target.value)}
                                                        type="number"
                                                        placeholder="0"
                                                        className="h-14 bg-zinc-950 border-zinc-800/50 rounded-xl text-base font-mono"
                                                        disabled={isPending}
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        <div className="space-y-3">
                                            <Label className="text-xs font-medium text-muted-foreground">Комментарий (опционально)</Label>
                                            <Input
                                                value={receiptNotes}
                                                onChange={e => setReceiptNotes(e.target.value)}
                                                placeholder="Добавьте заметку к чеку..."
                                                className="h-12 bg-zinc-950 border-zinc-800/50 rounded-xl text-sm"
                                                disabled={isPending}
                                            />
                                        </div>

                                        <Button
                                            onClick={finalizeReceipt}
                                            disabled={isPending || cart.length === 0}
                                            className="w-full h-16 rounded-2xl font-bold text-lg shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
                                            size="lg"
                                        >
                                            {isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : `Пробить чек (${cartTotal.toLocaleString()} ₽)`}
                                        </Button>
                                    </div>
                                </section>

                            </div>

                            {/* Right Column: History */}
                            <div className="lg:col-span-4 flex flex-col gap-8">

                                {/* History Section */}
                                <section className="flex flex-col gap-4 sticky top-24">
                                    <div className="flex items-center justify-between">
                                        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-widest">История смены</h2>
                                        <div className="flex items-center gap-3">
                                            <span className="text-sm font-semibold font-mono bg-muted/50 px-2.5 py-1 rounded-md">
                                                {receiptTotalForShift.toLocaleString()} ₽
                                            </span>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-8 p-0 rounded-full text-muted-foreground hover:text-foreground"
                                                onClick={() => refresh()}
                                                disabled={isPending}
                                                title="Обновить историю"
                                            >
                                                <History className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                    
                                    <div className="flex flex-col rounded-3xl border border-zinc-800/50 bg-zinc-900/30 overflow-hidden">
                                        <div className="max-h-[calc(100vh-140px)] overflow-y-auto p-4 space-y-3 custom-scrollbar">
                                            {receipts.length === 0 ? (
                                                <div className="p-8 text-center text-sm text-muted-foreground">
                                                    Пока нет чеков
                                                </div>
                                            ) : (
                                                receipts.filter(r => !r.voided_at).map(r => (
                                                    <div key={r.id} className="p-4 rounded-2xl border border-zinc-800/50 bg-zinc-950 flex flex-col gap-3 transition-colors hover:border-zinc-700">
                                                        <div className="flex items-start justify-between gap-4">
                                                            <div className="min-w-0">
                                                                <div className="flex items-center gap-2 mb-1">
                                                                        <span className="text-sm font-semibold">Чек #{r.id}</span>
                                                                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-zinc-800 text-muted-foreground uppercase">
                                                                        {r.payment_type === 'salary' ? 'В СЧЕТ ЗП' : 
                                                                         r.payment_type === 'cash' ? 'НАЛИЧНЫЕ' :
                                                                         r.payment_type === 'card' ? 'КАРТА' :
                                                                         r.payment_type === 'mixed' ? 'СМЕШАННАЯ' :
                                                                         r.payment_type}
                                                                    </span>
                                                                </div>
                                                                <div className="text-xs text-muted-foreground font-mono flex items-center gap-1.5 flex-wrap">
                                                                    <span>{new Date(r.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                                                    <span>·</span>
                                                                    <span className="text-foreground font-medium text-sm">{r.total_amount.toLocaleString()} ₽</span>
                                                                    {(r.total_refund_amount || 0) > 0 && (
                                                                        <span className="text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded text-[10px]">
                                                                            возврат: {(r.total_refund_amount || 0).toLocaleString()} ₽
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center shrink-0">
                                                                {r.committed_at ? (
                                                                    <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                                                                        ПРОВЕДЕН
                                                                    </span>
                                                                ) : (
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full"
                                                                        onClick={() => cancelReceipt(r.id)}
                                                                        disabled={isPending}
                                                                        title="Отменить чек"
                                                                    >
                                                                        <X className="h-4 w-4" />
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        </div>
                                                        
                                                        {r.items?.length > 0 && (
                                                            <div className="pt-3 border-t border-zinc-800/50 space-y-2">
                                                                {r.items.map((it: any) => {
                                                                    const isFullyReturned = (it.available_qty || 0) <= 0
                                                                    const returnedQty = it.returned_qty || 0
                                                                    
                                                                    return (
                                                                        <div key={it.id} className="flex justify-between items-center text-xs text-muted-foreground group/item">
                                                                            <span className="truncate pr-3">{it.product_name}</span>
                                                                            <div className="flex items-center gap-2 shrink-0 font-mono">
                                                                                <span className={cn(isFullyReturned && "line-through opacity-50")}>
                                                                                    {it.quantity} × {Number(it.selling_price_snapshot).toLocaleString()}
                                                                                </span>
                                                                                {returnedQty > 0 && (
                                                                                    <span className="text-[10px] text-amber-500 bg-amber-500/10 px-1 rounded">
                                                                                        -{returnedQty}
                                                                                    </span>
                                                                                )}
                                                                                {!isFullyReturned && !r.voided_at ? (
                                                                                    <Button
                                                                                        variant="ghost"
                                                                                        size="sm"
                                                                                        onClick={() => {
                                                                                            setSelectedReceipt(r)
                                                                                            setReturnItemId(it.id)
                                                                                            setReturnQuantity("1")
                                                                                            setReturnReason("")
                                                                                            setIsReturnDialogOpen(true)
                                                                                        }}
                                                                                        className="h-6 px-2 text-[10px] font-sans font-medium text-amber-500 opacity-0 group-hover/item:opacity-100 hover:text-amber-600 hover:bg-amber-500/10 ml-1 transition-all"
                                                                                        disabled={isPending}
                                                                                    >
                                                                                        Вернуть
                                                                                    </Button>
                                                                                ) : isFullyReturned ? (
                                                                                    <span className="text-emerald-500 ml-1">✓</span>
                                                                                ) : null}
                                                                            </div>
                                                                        </div>
                                                                    )
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                </section>
                            </div>
                        </div>
                    )}
                </main>
            </div>

            {/* Return Dialog */}
            <Dialog open={isReturnDialogOpen} onOpenChange={setIsReturnDialogOpen}>
                <DialogContent className="bg-card border-border sm:max-w-md rounded-3xl p-6">
                    <DialogHeader className="mb-4">
                        <DialogTitle className="text-xl font-semibold">Возврат товара</DialogTitle>
                        <DialogDescription className="text-base">
                            {selectedReceipt?.items?.find((i: any) => i.id === returnItemId)?.product_name}
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-6">
                        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-2xl">
                            <span className="text-sm font-medium text-muted-foreground">Доступно для возврата</span>
                            <span className="text-lg font-bold font-mono">
                                {selectedReceipt?.items?.find((i: any) => i.id === returnItemId)?.available_qty || 0} <span className="text-muted-foreground text-sm font-sans font-normal">шт.</span>
                            </span>
                        </div>
                        
                        <div className="space-y-3">
                            <Label className="text-sm font-medium">Количество к возврату</Label>
                            <Input
                                type="number"
                                min="1"
                                max={selectedReceipt?.items?.find((i: any) => i.id === returnItemId)?.available_qty}
                                value={returnQuantity}
                                onChange={e => setReturnQuantity(e.target.value)}
                                className="h-14 bg-background rounded-xl text-lg font-mono"
                            />
                        </div>
                        
                        <div className="space-y-3">
                            <Label className="text-sm font-medium">Причина возврата (опционально)</Label>
                            <Input
                                value={returnReason}
                                onChange={e => setReturnReason(e.target.value)}
                                placeholder="Например: ошибка при пробитии"
                                className="h-14 bg-background rounded-xl text-base"
                            />
                        </div>
                        
                        <div className="flex items-center justify-between pt-2">
                            <span className="text-sm font-medium text-muted-foreground">Сумма к возврату</span>
                            <span className="text-2xl font-bold font-mono text-emerald-500">
                                {(Number(returnQuantity) * (selectedReceipt?.items?.find((i: any) => i.id === returnItemId)?.selling_price_snapshot || 0)).toLocaleString()} ₽
                            </span>
                        </div>
                    </div>
                    
                    <DialogFooter className="mt-8 gap-3 sm:gap-0">
                        <Button variant="ghost" onClick={() => setIsReturnDialogOpen(false)} className="h-12 rounded-xl">
                            Отмена
                        </Button>
                        <Button 
                            onClick={handleReturnReceipt} 
                            disabled={!returnQuantity || Number(returnQuantity) <= 0 || isPending || Number(returnQuantity) > (selectedReceipt?.items?.find((i: any) => i.id === returnItemId)?.available_qty || 0)}
                            className="h-12 rounded-xl bg-destructive hover:bg-destructive/90 text-destructive-foreground px-8"
                        >
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Подтвердить возврат
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {Dialogs}
        </>
    )
}
