const fs = require('fs');
const path = './src/app/employee/clubs/[clubId]/_components/EmployeeSalesWizard.tsx';
let content = fs.readFileSync(path, 'utf8');

const startIdx = content.indexOf('    return (\n        <>\n            <div className="min-h-[100dvh]');
if (startIdx === -1) {
    console.log("Start not found");
    process.exit(1);
}

const newReturnBlock = `    return (
        <>
            <div className="min-h-[100dvh] bg-background text-foreground flex flex-col font-sans selection:bg-primary/20">
                <header className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 bg-background/80 backdrop-blur-md border-b border-border/50">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                            <ShoppingCart className="h-5 w-5" />
                        </div>
                        <div>
                            <h1 className="text-lg font-semibold tracking-tight leading-none">Касса</h1>
                            <p className="text-sm text-muted-foreground mt-1 leading-none">Смена открыта</p>
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        className="h-10 px-4 rounded-xl text-muted-foreground hover:text-foreground"
                        onClick={handleExit}
                    >
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Вернуться
                    </Button>
                </header>

                <main className="flex-1 overflow-y-auto p-6 w-full max-w-[1400px] mx-auto">
                    {!activeShiftId ? (
                        <div className="flex flex-col items-center justify-center h-[50vh] text-center animate-in fade-in duration-500">
                            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                                <History className="h-6 w-6 text-muted-foreground" />
                            </div>
                            <h2 className="text-xl font-medium tracking-tight mb-2">Нет активной смены</h2>
                            <p className="text-muted-foreground max-w-sm mx-auto">Откройте смену, чтобы начать принимать оплаты и списывать товары.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-both">
                            
                            {/* Left Column: Search & Cart */}
                            <div className="lg:col-span-7 flex flex-col gap-6">
                                <section className="space-y-4">
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
                                            className="h-14 pl-12 pr-16 rounded-2xl bg-muted/30 border-transparent focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/20 text-lg transition-all"
                                            disabled={isPending}
                                        />
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs text-muted-foreground font-medium bg-background px-2 py-1 rounded-md border border-border/50">
                                            <span>↵</span> Enter
                                        </div>
                                    </div>

                                    {suggestions.length > 0 && inputValue.trim() !== "" && (
                                        <div className="absolute z-10 w-full max-w-[calc(100vw-3rem)] lg:max-w-[calc((100vw-3rem)*7/12-2rem)] mt-2 rounded-2xl bg-popover border border-border shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                            {suggestions.map((p, idx) => (
                                                <button
                                                    key={p.id}
                                                    type="button"
                                                    className={cn(
                                                        "w-full text-left px-5 py-3 text-sm flex items-center justify-between transition-colors",
                                                        idx === selectedSuggestionIdx ? "bg-accent/80" : "hover:bg-accent/50"
                                                    )}
                                                    onMouseEnter={() => setSelectedSuggestionIdx(idx)}
                                                    onClick={() => {
                                                        addToCart(p, 1)
                                                        setInputValue("")
                                                        inputRef.current?.focus()
                                                    }}
                                                >
                                                    <span className="font-medium truncate pr-4">{p.name}</span>
                                                    <span className="text-muted-foreground shrink-0 font-mono">{Number(p.selling_price || 0).toLocaleString()} ₽</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </section>

                                <section className="flex-1 flex flex-col gap-4">
                                    <div className="flex items-center justify-between">
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
                                    
                                    <div className="flex-1 rounded-2xl border border-border/50 bg-card/30 overflow-hidden flex flex-col">
                                        {cart.length === 0 ? (
                                            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                                                <div className="h-16 w-16 rounded-full border border-dashed border-border flex items-center justify-center mb-4">
                                                    <ShoppingCart className="h-6 w-6 text-muted-foreground/30" />
                                                </div>
                                                <p className="text-muted-foreground">Чек пуст. Отсканируйте товар.</p>
                                            </div>
                                        ) : (
                                            <div className="flex-1 overflow-y-auto p-2">
                                                <div className="space-y-1">
                                                    {cart.map(i => (
                                                        <div
                                                            key={i.product_id}
                                                            className={cn(
                                                                "group flex items-center justify-between p-3 rounded-xl transition-colors cursor-pointer",
                                                                i.product_id === selectedCartProductId ? "bg-accent" : "hover:bg-muted/50"
                                                            )}
                                                            onClick={() => setSelectedCartProductId(i.product_id)}
                                                        >
                                                            <div className="min-w-0 flex-1 pr-4">
                                                                <div className="font-medium truncate">{i.name}</div>
                                                                <div className="text-sm text-muted-foreground mt-0.5 font-mono">
                                                                    {i.quantity} × {i.price.toLocaleString()} ₽
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-3 shrink-0">
                                                                <div className="flex items-center bg-background rounded-lg border border-border/50 overflow-hidden">
                                                                    <button 
                                                                        className="px-3 py-1.5 text-muted-foreground hover:bg-muted transition-colors"
                                                                        onClick={(e) => { e.stopPropagation(); updateCartQty(i.product_id, Math.max(1, i.quantity - 1)) }}
                                                                    >−</button>
                                                                    <div className="w-10 text-center font-medium font-mono text-sm">{i.quantity}</div>
                                                                    <button 
                                                                        className="px-3 py-1.5 text-muted-foreground hover:bg-muted transition-colors"
                                                                        onClick={(e) => { e.stopPropagation(); updateCartQty(i.product_id, i.quantity + 1) }}
                                                                    >+</button>
                                                                </div>
                                                                <div className="w-20 text-right font-semibold font-mono">
                                                                    {(i.quantity * i.price).toLocaleString()} ₽
                                                                </div>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-8 w-8 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive hover:bg-destructive/10 transition-all"
                                                                    onClick={(e) => { e.stopPropagation(); removeCartItem(i.product_id) }}
                                                                    disabled={isPending}
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {cart.length > 0 && (
                                            <div className="p-4 border-t border-border/50 bg-card flex items-center justify-between">
                                                <span className="text-muted-foreground font-medium">Итого к оплате</span>
                                                <span className="text-3xl font-bold tracking-tight font-mono">{cartTotal.toLocaleString()} ₽</span>
                                            </div>
                                        )}
                                    </div>
                                </section>
                            </div>

                            {/* Right Column: Payment & History */}
                            <div className="lg:col-span-5 flex flex-col gap-8">
                                
                                {/* Payment Section */}
                                <section ref={paymentRef} className="flex flex-col gap-5">
                                    <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-widest">Оплата</h2>
                                    
                                    <div className="p-6 rounded-3xl border border-border/50 bg-card/30 space-y-6">
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
                                                <SelectTrigger className="h-14 bg-background border-border/50 rounded-xl text-base font-medium">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-xl border-border/50">
                                                    <SelectItem value="cash" className="py-3">
                                                        <div className="flex items-center gap-3"><Banknote className="h-4 w-4 text-muted-foreground" /> Наличные</div>
                                                    </SelectItem>
                                                    <SelectItem value="card" className="py-3">
                                                        <div className="flex items-center gap-3"><CreditCard className="h-4 w-4 text-muted-foreground" /> Карта</div>
                                                    </SelectItem>
                                                    <SelectItem value="mixed" className="py-3">
                                                        <div className="flex items-center gap-3"><Wallet className="h-4 w-4 text-muted-foreground" /> Смешанная</div>
                                                    </SelectItem>
                                                    <SelectItem value="salary" className="py-3">
                                                        <div className="flex items-center gap-3"><Wallet className="h-4 w-4 text-muted-foreground" /> В счет ЗП</div>
                                                    </SelectItem>
                                                    <SelectItem value="other" className="py-3">Другое</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {paymentType === 'salary' && (
                                            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                                <div className="space-y-3">
                                                    <Label className="text-xs font-medium text-muted-foreground">Сотрудник</Label>
                                                    <Select value={salaryTargetUserId} onValueChange={setSalaryTargetUserId}>
                                                        <SelectTrigger className="h-14 bg-background border-border/50 rounded-xl text-base">
                                                            <SelectValue placeholder="Выберите сотрудника..." />
                                                        </SelectTrigger>
                                                        <SelectContent className="rounded-xl border-border/50">
                                                            {salarySaleCandidates.map((candidate) => (
                                                                <SelectItem key={candidate.id} value={candidate.id} className="py-2">
                                                                    <div className="flex flex-col">
                                                                        <span className="font-medium">{candidate.full_name}</span>
                                                                        <span className="text-xs text-muted-foreground">{candidate.role} · доступно {candidate.available_amount.toLocaleString()} ₽</span>
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
                                                        className="h-14 bg-background border-border/50 rounded-xl text-lg font-mono font-medium"
                                                        disabled={isPending}
                                                    />
                                                </div>
                                                <div className="space-y-3">
                                                    <Label className="text-xs font-medium text-muted-foreground">Сдача</Label>
                                                    <div className="h-14 rounded-xl border border-transparent bg-muted/50 flex items-center justify-end px-4">
                                                        <span className={cn(
                                                            "text-xl font-bold font-mono tracking-tight",
                                                            changeDue > 0 ? "text-emerald-500" : "text-muted-foreground"
                                                        )}>
                                                            {changeDue > 0 ? \`+\${changeDue.toLocaleString()}\` : "0"} ₽
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
                                                        className="h-14 bg-background border-border/50 rounded-xl text-base font-mono"
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
                                                        className="h-14 bg-background border-border/50 rounded-xl text-base font-mono"
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
                                                className="h-12 bg-background border-border/50 rounded-xl text-sm"
                                                disabled={isPending}
                                            />
                                        </div>

                                        <Button
                                            onClick={finalizeReceipt}
                                            disabled={isPending || cart.length === 0}
                                            className="w-full h-16 rounded-2xl font-bold text-lg shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
                                            size="lg"
                                        >
                                            {isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : \`Пробить чек (\${cartTotal.toLocaleString()} ₽)\`}
                                        </Button>
                                    </div>
                                </section>

                                {/* History Section */}
                                <section className="flex flex-col gap-4 flex-1 min-h-0">
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
                                    
                                    <div className="flex-1 overflow-y-auto pr-2 space-y-3 max-h-[400px]">
                                        {receipts.length === 0 ? (
                                            <div className="p-8 text-center text-sm text-muted-foreground border border-dashed border-border/50 rounded-2xl">
                                                Пока нет чеков
                                            </div>
                                        ) : (
                                            receipts.filter(r => !r.voided_at).map(r => (
                                                <div key={r.id} className="p-4 rounded-2xl border border-border/50 bg-card/30 flex flex-col gap-3 transition-colors hover:bg-card/50">
                                                    <div className="flex items-start justify-between gap-4">
                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className="text-sm font-semibold">Чек #{r.id}</span>
                                                                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase">
                                                                    {r.payment_type === 'salary' ? 'В СЧЕТ ЗП' : r.payment_type}
                                                                </span>
                                                            </div>
                                                            <div className="text-xs text-muted-foreground font-mono flex items-center gap-1.5 flex-wrap">
                                                                <span>{new Date(r.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                                                <span>·</span>
                                                                <span className="text-foreground font-medium">{r.total_amount.toLocaleString()} ₽</span>
                                                                {(r.total_refund_amount || 0) > 0 && (
                                                                    <span className="text-amber-500 bg-amber-500/10 px-1 rounded">
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
                                                        <div className="pt-3 border-t border-border/50 space-y-2">
                                                            {r.items.map((it: any) => {
                                                                const isFullyReturned = (it.available_qty || 0) <= 0
                                                                const returnedQty = it.returned_qty || 0
                                                                
                                                                return (
                                                                    <div key={it.id} className="flex justify-between items-start text-xs text-muted-foreground group/item">
                                                                        <span className="truncate pr-3">{it.product_name}</span>
                                                                        <div className="flex items-center gap-2 shrink-0 font-mono">
                                                                            <span className={cn(isFullyReturned && "line-through opacity-50")}>
                                                                                {it.quantity} × {Number(it.selling_price_snapshot).toLocaleString()}
                                                                            </span>
                                                                            {returnedQty > 0 && (
                                                                                <span className="text-[10px] text-amber-500">
                                                                                    (-{returnedQty})
                                                                                </span>
                                                                            )}
                                                                            {!isFullyReturned && !r.voided_at ? (
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => {
                                                                                        setSelectedReceipt(r)
                                                                                        setReturnItemId(it.id)
                                                                                        setReturnQuantity("1")
                                                                                        setReturnReason("")
                                                                                        setIsReturnDialogOpen(true)
                                                                                    }}
                                                                                    className="text-[10px] font-sans font-medium text-amber-500 opacity-0 group-hover/item:opacity-100 transition-opacity hover:underline ml-1"
                                                                                    disabled={isPending}
                                                                                >
                                                                                    Вернуть
                                                                                </button>
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
}`;

content = content.substring(0, startIdx) + newReturnBlock + "\n}\n";
fs.writeFileSync(path, content);
console.log("Done");
