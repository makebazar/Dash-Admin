"use client";

import { useState, useTransition, useCallback, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Trash2,
  Search,
  Camera,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ShoppingCart,
  Ban,
  Warehouse,
  Plus,
  X,
  AlertTriangle,
  Minus,
  History,
  RotateCcw,
  Calendar,
  User,
} from "lucide-react";
import {
  getProducts,
  createWriteOffSafe,
  getProductByBarcode,
  getWarehouses,
  getClubSettings,
  getStockMovements,
} from "@/app/clubs/[clubId]/inventory/actions";
import type { Warehouse as WarehouseType } from "@/app/clubs/[clubId]/inventory/types";
import { useUiDialogs } from "@/app/clubs/[clubId]/inventory/_components/useUiDialogs";
import { getSearchVariants, matchSearchQuery } from "@/lib/search-layout";
import { cn } from "@/lib/utils";

interface EmployeeWriteOffWizardProps {
  isOpen: boolean;
  onClose: () => void;
  clubId: string;
  userId: string;
  activeShiftId?: string;
}

interface WriteOffItem {
  product_id: number;
  name: string;
  quantity: number;
  type: "WASTE";
  price: number;
  cost_price?: number;
  custom_price?: number;
}

const WRITE_OFF_REASONS = [
  "Брак / Дефект",
  "Истек срок годности",
  "Бой / Повреждение упаковки",
  "Расходники / Персонал",
  "Списание по инвентаризации",
  "Личное потребление",
];

export function EmployeeWriteOffWizard({
  isOpen,
  onClose,
  clubId,
  userId,
  activeShiftId,
}: EmployeeWriteOffWizardProps) {
  const { showMessage, Dialogs } = useUiDialogs();
  const [step, setStep] = useState<1 | 2>(1);
  const [items, setItems] = useState<WriteOffItem[]>([]);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseType[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>("");
  const [inventorySettings, setInventorySettings] = useState<any>(null);
  const [isPending, startTransition] = useTransition();

  // Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedSuggestionIdx, setSelectedSuggestionIdx] = useState(0);
  const [notes, setNotes] = useState("");

  // History state
  const [isHistoryView, setIsHistoryView] = useState(false);
  const [historyMovements, setHistoryMovements] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historySearchQuery, setHistorySearchQuery] = useState("");
  const [historyOnlyShift, setHistoryOnlyShift] = useState(false);

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);
  const suggestionsListRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setSelectedSuggestionIdx(0);
  }, [searchQuery]);

  useEffect(() => {
    if (isSearchOpen && suggestionsListRef.current) {
      const activeEl = suggestionsListRef.current.children[
        selectedSuggestionIdx
      ] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [selectedSuggestionIdx, isSearchOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // iOS / Body Scroll Lock
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      document.body.style.position = "fixed";
      document.body.style.width = "100%";
      document.body.style.height = "100%";
    } else {
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.width = "";
      document.body.style.height = "";
    }
    return () => {
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.width = "";
      document.body.style.height = "";
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      getProducts(clubId).then(setAllProducts);
      getWarehouses(clubId).then((whs) => {
        setWarehouses(whs);
        setSelectedWarehouseId("");
      });
      getClubSettings(clubId).then((settings) =>
        setInventorySettings(settings?.inventory_settings)
      );
    }
  }, [isOpen, clubId]);

  const loadHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const data = await getStockMovements(clubId, 300);
      const writeOffs = (data || []).filter(
        (m: any) => m.type === "WRITE_OFF" || m.related_entity_type === "WRITE_OFF"
      );
      setHistoryMovements(writeOffs);
    } catch (e) {
      console.error("Failed to load write-off history", e);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [clubId]);

  useEffect(() => {
    if (isOpen && isHistoryView) {
      loadHistory();
    }
  }, [isOpen, isHistoryView, loadHistory]);

  const filteredHistory = useMemo(() => {
    let list = historyMovements;
    if (historyOnlyShift && activeShiftId) {
      list = list.filter((m) => String(m.shift_id) === String(activeShiftId));
    }
    const q = historySearchQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (m) =>
        m.product_name?.toLowerCase().includes(q) ||
        m.warehouse_name?.toLowerCase().includes(q) ||
        m.reason?.toLowerCase().includes(q) ||
        m.user_name?.toLowerCase().includes(q)
    );
  }, [historyMovements, historyOnlyShift, activeShiftId, historySearchQuery]);

  const suggestions = useMemo(() => {
    const qRaw = searchQuery.trim().toLowerCase();
    if (!qRaw) return [];

    const variants = getSearchVariants(qRaw);
    const hits: { p: any; score: number }[] = [];
    for (const p of allProducts) {
      const match = matchSearchQuery(p.name, variants);
      if (match.isMatch) {
        hits.push({ p, score: match.score });
      } else if (
        p.barcode?.toLowerCase().includes(qRaw) ||
        p.barcodes?.some((bc: string) => bc.toLowerCase().includes(qRaw))
      ) {
        hits.push({ p, score: 50 });
      }
    }
    hits.sort((a, b) => b.score - a.score);
    return hits.slice(0, 10).map((x) => x.p);
  }, [allProducts, searchQuery]);

  const addOrIncrementProduct = (product: any, qty: number = 1) => {
    const priceToRecord = product.selling_price || 0;
    const existingIdx = items.findIndex(
      (i) => i.product_id === product.id && i.type === "WASTE"
    );

    if (existingIdx > -1) {
      const newItems = [...items];
      newItems[existingIdx].quantity += qty;
      setItems(newItems);
    } else {
      setItems((prev) => [
        ...prev,
        {
          product_id: product.id,
          name: product.name,
          quantity: qty,
          type: "WASTE",
          price: priceToRecord,
          cost_price: product.cost_price || 0,
        },
      ]);
    }

    setSearchQuery("");
    setIsSearchOpen(false);
  };

  const handleSearchEnter = async () => {
    const v = searchQuery.trim();
    if (!v) return;

    const looksLikeBarcode = /^[0-9]{6,32}$/.test(v);
    if (looksLikeBarcode) {
      try {
        const product = await getProductByBarcode(clubId, v);
        if (product) {
          addOrIncrementProduct(product, 1);
          setSearchQuery("");
          setIsSearchOpen(false);
          searchInputRef.current?.focus();
          return;
        } else {
          showMessage({
            title: "Не найдено",
            description: "Штрихкод не найден в каталоге",
          });
          return;
        }
      } catch (e) {
        console.error(e);
      }
    }

    if (suggestions.length > 0) {
      const idx = Math.min(
        Math.max(selectedSuggestionIdx, 0),
        suggestions.length - 1
      );
      addOrIncrementProduct(suggestions[idx], 1);
      setSearchQuery("");
      setIsSearchOpen(false);
      searchInputRef.current?.focus();
    }
  };

  const updateItemQty = (productId: number, newQty: number) => {
    if (newQty <= 0) {
      removeItem(productId);
      return;
    }
    setItems((prev) =>
      prev.map((item) =>
        item.product_id === productId ? { ...item, quantity: newQty } : item
      )
    );
  };

  const updateItemCustomPrice = (productId: number, price: number | undefined) => {
    setItems((prev) =>
      prev.map((item) =>
        item.product_id === productId ? { ...item, custom_price: price } : item
      )
    );
  };

  const removeItem = (productId: number) => {
    setItems((prev) => prev.filter((i) => i.product_id !== productId));
  };

  const handleClose = () => {
    setStep(1);
    setItems([]);
    setNotes("");
    setSearchQuery("");
    setIsSearchOpen(false);
    setIsHistoryView(false);
    onClose();
  };

  const totalSum = useMemo(() => {
    return items.reduce(
      (sum, item) => sum + (item.custom_price ?? item.price) * item.quantity,
      0
    );
  }, [items]);

  const totalQty = useMemo(() => {
    return items.reduce((sum, item) => sum + item.quantity, 0);
  }, [items]);

  const handleFinalize = () => {
    if (items.length === 0) return;
    if (!selectedWarehouseId) {
      showMessage({
        title: "Проверьте данные",
        description: "Выберите склад для списания",
      });
      return;
    }

    startTransition(async () => {
      try {
        const result = await createWriteOffSafe(clubId, userId, {
          items: items.map((i) => ({
            product_id: i.product_id,
            quantity: i.quantity,
            type: i.type,
            custom_price: i.custom_price,
          })),
          notes: notes,
          shift_id: activeShiftId,
          warehouse_id: Number(selectedWarehouseId),
        });

        if (!result.ok) {
          showMessage({ title: "Ошибка", description: result.error });
          return;
        }

        showMessage({
          title: "Списание выполнено",
          description: "Товары успешно списаны с выбранного склада",
        });
        handleClose();
      } catch (e: any) {
        console.error(e);
        showMessage({
          title: "Ошибка",
          description: e?.message || "Ошибка при оформлении списания",
        });
      }
    });
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 h-dvh bg-black text-zinc-100 flex flex-col z-[9999] overflow-hidden font-sans">
      {/* Header */}
      <header className="px-4 sm:px-6 py-5 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-xl sticky top-0 z-50 shrink-0">
        <div className="max-w-4xl mx-auto w-full flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500">
              <Ban className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-white uppercase italic tracking-tight leading-none">
                {isHistoryView
                  ? "История списаний"
                  : step === 1
                  ? "Списание товара"
                  : "Причина списания"}
              </h2>
              <div className="flex items-center gap-2 mt-1.5">
                {!isHistoryView ? (
                  <>
                    <Badge
                      variant="outline"
                      className="border-zinc-700 text-zinc-500 text-[9px] font-mono px-1.5 py-0 h-4 bg-zinc-900/50"
                    >
                      ШАГ {step} ИЗ 2
                    </Badge>
                    {items.length > 0 && (
                      <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
                        Позиций: {items.length} ({totalQty} шт)
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-[10px] text-rose-400 font-bold uppercase tracking-wider">
                    Всего записей: {filteredHistory.length}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* History Toggle Button */}
            <Button
              variant="outline"
              size="icon"
              onClick={() => setIsHistoryView(!isHistoryView)}
              className={cn(
                "h-12 w-12 rounded-2xl border transition-all active:scale-90",
                isHistoryView
                  ? "bg-rose-500/10 border-rose-500/40 text-rose-400"
                  : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white"
              )}
              title={isHistoryView ? "Вернуться к списанию" : "История списаний"}
            >
              <History className="h-5 w-5" />
            </Button>

            {/* Close Button */}
            <Button
              variant="outline"
              size="icon"
              onClick={handleClose}
              className="bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white h-12 w-12 rounded-2xl transition-all active:scale-90"
            >
              <X className="h-6 w-6" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
        <div className="max-w-4xl mx-auto space-y-6 pb-28">
          {isHistoryView ? (
            /* History View */
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Filter & Search Bar */}
              <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
                <div className="relative flex-1 w-full group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 group-focus-within:text-rose-400 transition-colors" />
                  <Input
                    value={historySearchQuery}
                    onChange={(e) => setHistorySearchQuery(e.target.value)}
                    placeholder="Поиск по товару, складу, сотруднику или причине..."
                    className="h-12 pl-11 rounded-2xl bg-zinc-900 border-zinc-800 text-sm font-medium text-white placeholder:text-zinc-600 focus:border-rose-500/50"
                  />
                  {historySearchQuery && (
                    <button
                      type="button"
                      onClick={() => setHistorySearchQuery("")}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                  {activeShiftId && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setHistoryOnlyShift(!historyOnlyShift)}
                      className={cn(
                        "h-12 rounded-2xl border text-xs font-bold transition-all px-4",
                        historyOnlyShift
                          ? "bg-rose-500/10 border-rose-500/40 text-rose-400"
                          : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white"
                      )}
                    >
                      Эта смена
                    </Button>
                  )}

                  <Button
                    type="button"
                    variant="outline"
                    onClick={loadHistory}
                    disabled={isLoadingHistory}
                    className="h-12 px-4 rounded-2xl bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white active:scale-95 transition-all"
                  >
                    <RotateCcw
                      className={cn(
                        "h-4 w-4",
                        isLoadingHistory && "animate-spin text-rose-400"
                      )}
                    />
                  </Button>
                </div>
              </div>

              {/* History List */}
              {isLoadingHistory ? (
                <div className="flex flex-col items-center justify-center py-24 gap-4 text-zinc-500">
                  <Loader2 className="h-8 w-8 animate-spin text-rose-500" />
                  <span className="text-xs font-mono uppercase tracking-widest">
                    Загрузка истории...
                  </span>
                </div>
              ) : filteredHistory.length === 0 ? (
                <div className="border border-dashed border-zinc-800 rounded-3xl p-12 text-center text-zinc-600 space-y-3 bg-zinc-950/40">
                  <History className="h-10 w-10 mx-auto text-zinc-700" />
                  <div className="text-sm font-bold text-zinc-400">
                    История списаний пуста
                  </div>
                  <div className="text-xs text-zinc-600 max-w-xs mx-auto">
                    {historySearchQuery || historyOnlyShift
                      ? "Ничего не найдено по заданным фильтрам."
                      : "В этом клубе еще не было оформлено списаний."}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredHistory.map((m) => {
                    const qty = Math.abs(Number(m.change_amount || 0));
                    const price = Number(m.price_at_time || 0);
                    const total = price > 0 ? price * qty : null;

                    return (
                      <div
                        key={m.id}
                        className="p-4 rounded-2xl border border-zinc-800/60 bg-zinc-900/60 hover:border-zinc-700 transition-all space-y-2.5"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <span className="text-sm font-bold text-white">
                              {m.product_name}
                            </span>
                            <div className="flex items-center gap-2 flex-wrap text-xs">
                              <span className="font-mono font-bold text-rose-400">
                                -{qty} шт
                              </span>
                              {m.warehouse_name && (
                                <>
                                  <span className="text-zinc-600">·</span>
                                  <span className="text-zinc-400 flex items-center gap-1 font-mono">
                                    <Warehouse className="h-3 w-3 text-zinc-500" />
                                    {m.warehouse_name}
                                  </span>
                                </>
                              )}
                              {m.user_name && (
                                <>
                                  <span className="text-zinc-600">·</span>
                                  <span className="text-zinc-500 flex items-center gap-1">
                                    <User className="h-3 w-3" />
                                    {m.user_name}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            {total != null && total > 0 && (
                              <div className="text-sm font-black text-rose-400 italic">
                                {total.toLocaleString()} ₽
                              </div>
                            )}
                            <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                              {new Date(m.created_at).toLocaleString("ru-RU", {
                                day: "2-digit",
                                month: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </div>
                          </div>
                        </div>

                        {(() => {
                          const cleanReason = m.reason
                            ? m.reason.replace(/\s*\(Смена #[a-f0-9-]+\)/gi, "").trim()
                            : "";
                          if (!cleanReason) return null;
                          return (
                            <div className="text-xs text-zinc-400 bg-zinc-950/70 p-2.5 rounded-xl border border-zinc-800/40">
                              <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider block mb-0.5">
                                Причина
                              </span>
                              {cleanReason}
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : step === 1 ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* 1. Warehouse Selector */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.2em] flex items-center gap-2">
                    <span className="text-rose-500">01</span> Склад списания
                  </span>
                  {!selectedWarehouseId && (
                    <span className="text-[10px] text-rose-400 font-bold uppercase tracking-wider animate-pulse flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> Выберите склад
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {warehouses.map((wh) => {
                    const isSelected = selectedWarehouseId === wh.id.toString();
                    return (
                      <button
                        key={wh.id}
                        type="button"
                        onClick={() => setSelectedWarehouseId(wh.id.toString())}
                        className={cn(
                          "relative text-left p-3.5 rounded-2xl border transition-all text-xs flex flex-col justify-between gap-2 active:scale-[0.98]",
                          isSelected
                            ? "bg-rose-500/10 border-rose-500/50 text-rose-400 shadow-[0_0_20px_rgba(244,63,94,0.15)] ring-1 ring-rose-500/30"
                            : "bg-zinc-900/60 border-zinc-800/80 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                        )}
                      >
                        <div className="flex items-center justify-between w-full">
                          <Warehouse
                            className={cn(
                              "h-4 w-4",
                              isSelected ? "text-rose-400" : "text-zinc-600"
                            )}
                          />
                          {wh.is_default && (
                            <span className="text-[8px] font-mono uppercase px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                              Основной
                            </span>
                          )}
                        </div>
                        <span className="font-bold text-sm truncate text-white">
                          {wh.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* 2. Fast Product Search & Scan */}
              <section className="space-y-3">
                <span className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.2em] flex items-center gap-2">
                  <span className="text-rose-500">02</span> Добавить товары
                </span>

                <div ref={searchContainerRef} className="relative group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-500 group-focus-within:text-rose-400 transition-colors pointer-events-none" />
                  <Input
                    ref={searchInputRef}
                    disabled={!selectedWarehouseId}
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setIsSearchOpen(true);
                    }}
                    onFocus={() => {
                      if (searchQuery.trim()) setIsSearchOpen(true);
                    }}
                    onClick={() => {
                      if (searchQuery.trim()) setIsSearchOpen(true);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleSearchEnter();
                      } else if (e.key === "ArrowDown") {
                        if (suggestions.length > 0) {
                          e.preventDefault();
                          setSelectedSuggestionIdx((i) =>
                            Math.min(suggestions.length - 1, i + 1)
                          );
                        }
                      } else if (e.key === "ArrowUp") {
                        if (suggestions.length > 0) {
                          e.preventDefault();
                          setSelectedSuggestionIdx((i) => Math.max(0, i - 1));
                        }
                      } else if (e.key === "Escape") {
                        setIsSearchOpen(false);
                      }
                    }}
                    placeholder={
                      selectedWarehouseId
                        ? "Штрихкод или название..."
                        : "Сначала выберите склад выше..."
                    }
                    className={cn(
                      "h-14 pl-12 pr-24 rounded-2xl bg-zinc-900 border-zinc-800 text-base font-medium transition-all placeholder:text-zinc-600 focus:border-rose-500/50 focus:ring-rose-500/10",
                      !selectedWarehouseId && "opacity-50 cursor-not-allowed"
                    )}
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs text-muted-foreground font-medium bg-zinc-900 px-2 py-1 rounded-md border border-zinc-800/50 pointer-events-none select-none">
                    <span>↵</span> Enter
                  </div>

                  {/* Dropdown Suggestions */}
                  {isSearchOpen && searchQuery.trim() && (
                    <div
                      ref={suggestionsListRef}
                      className="absolute left-0 right-0 top-full mt-2 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl z-50 max-h-75 overflow-y-auto custom-scrollbar p-1.5 space-y-1 animate-in fade-in slide-in-from-top-2 duration-200"
                    >
                      {suggestions.length === 0 ? (
                        <div className="p-4 text-center text-sm text-zinc-500">
                          Товары не найдены
                        </div>
                      ) : (
                        suggestions.map((p, idx) => {
                          const existingItem = items.find(
                            (i) => i.product_id === p.id && i.type === "WASTE"
                          );
                          const isSelected = idx === selectedSuggestionIdx;

                          return (
                            <button
                              key={p.id}
                              type="button"
                              onMouseEnter={() => setSelectedSuggestionIdx(idx)}
                              onClick={() => {
                                addOrIncrementProduct(p, 1);
                                searchInputRef.current?.focus();
                              }}
                              className={cn(
                                "group/item w-full text-left px-4 py-3 rounded-xl flex items-center justify-between transition-colors",
                                isSelected
                                  ? "bg-zinc-800/80"
                                  : "hover:bg-zinc-800/50",
                                existingItem && "border-l-2 border-l-rose-500 bg-rose-500/[0.04]"
                              )}
                            >
                              <div className="flex flex-col min-w-0 pr-3">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm text-white truncate">
                                    {p.name}
                                  </span>
                                  {existingItem && (
                                    <span className="text-[10px] font-mono font-bold text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20 shrink-0">
                                      В списке: {existingItem.quantity} шт
                                    </span>
                                  )}
                                </div>
                                <span className="text-[11px] text-zinc-500">
                                  {p.barcode
                                    ? `Штрихкод: ${p.barcode}`
                                    : "Без штрихкода"}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 shrink-0">
                                <span className="text-sm font-mono text-zinc-400">
                                  {Number(p.selling_price || 0).toLocaleString()} ₽
                                </span>
                                <div
                                  className={cn(
                                    "h-7 w-7 rounded-lg flex items-center justify-center transition-all",
                                    isSelected
                                      ? "bg-rose-500 text-white shadow-sm shadow-rose-950/40"
                                      : "bg-zinc-800 text-zinc-400 group-hover/item:bg-rose-500 group-hover/item:text-white"
                                  )}
                                >
                                  <Plus className="h-4 w-4" />
                                </div>
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              </section>

              {/* 3. Selected Items List */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.2em] flex items-center gap-2">
                    <span className="text-rose-500">03</span> Список списания (
                    {items.length})
                  </span>
                  {totalSum > 0 && (
                    <span className="text-xs font-black text-rose-400 italic">
                      Итого: {totalSum.toLocaleString()} ₽
                    </span>
                  )}
                </div>

                {items.length === 0 ? (
                  <div className="border border-dashed border-zinc-800 rounded-3xl p-12 text-center text-zinc-600 space-y-3 bg-zinc-950/40">
                    <div className="h-14 w-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-zinc-700">
                      <ShoppingCart className="h-7 w-7" />
                    </div>
                    <div className="text-sm font-bold text-zinc-400">
                      Список списания пуст
                    </div>
                    <div className="text-xs text-zinc-600 max-w-xs mx-auto">
                      Выберите склад и воспользуйтесь поиском или сканером, чтобы
                      добавить товары в списание.
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {items.map((item) => (
                      <div
                        key={item.product_id}
                        className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-zinc-700 transition-all"
                      >
                        <div className="space-y-1">
                          <div className="text-sm font-bold text-white">
                            {item.name}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-zinc-400">
                              {(item.custom_price ?? item.price).toLocaleString()} ₽ / шт
                            </span>
                            {inventorySettings?.allow_cost_price_sale && (
                              <button
                                type="button"
                                onClick={() =>
                                  updateItemCustomPrice(
                                    item.product_id,
                                    item.custom_price != null
                                      ? undefined
                                      : item.cost_price || 0
                                  )
                                }
                                className={cn(
                                  "text-[10px] font-mono px-2 py-0.5 rounded border transition-colors",
                                  item.custom_price != null
                                    ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                                    : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white"
                                )}
                              >
                                {item.custom_price != null
                                  ? "По себестоимости"
                                  : "Поставить себестоимость"}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Controls: Stepper & Remove */}
                        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                          <div className="flex items-center gap-1.5 bg-zinc-950 border border-zinc-800 rounded-xl p-1 w-fit">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                updateItemQty(item.product_id, item.quantity - 1)
                              }
                              className="h-8 w-8 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800"
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <Input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) =>
                                updateItemQty(
                                  item.product_id,
                                  Math.max(1, Number(e.target.value) || 1)
                                )
                              }
                              className="w-14 h-8 bg-transparent border-none text-center font-black text-sm text-white focus-visible:ring-0 p-0"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                updateItemQty(item.product_id, item.quantity + 1)
                              }
                              className="h-8 w-8 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800"
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>

                          <div className="text-right min-w-[70px]">
                            <span className="text-sm font-black text-white italic">
                              {(
                                (item.custom_price ?? item.price) * item.quantity
                              ).toLocaleString()}{" "}
                              ₽
                            </span>
                          </div>

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeItem(item.product_id)}
                            className="h-9 w-9 rounded-xl text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 active:scale-90 transition-all"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          ) : (
            /* Step 2: Reason and Details */
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Summary Card */}
              <div className="p-6 bg-zinc-900/60 rounded-3xl border border-zinc-800 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.2em]">
                    Сводка списания
                  </span>
                  <span className="text-xs font-bold text-rose-400">
                    {warehouses.find((w) => w.id.toString() === selectedWarehouseId)?.name}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div>
                    <span className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">
                      Всего позиций
                    </span>
                    <div className="text-2xl font-black text-white italic mt-0.5">
                      {items.length} ({totalQty} шт)
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">
                      Общая сумма
                    </span>
                    <div className="text-2xl font-black text-rose-400 italic mt-0.5">
                      {totalSum.toLocaleString()} ₽
                    </div>
                  </div>
                </div>
              </div>

              {/* Fast Chips */}
              <div className="space-y-3">
                <Label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">
                  Быстрый выбор причины
                </Label>
                <div className="flex flex-wrap gap-2">
                  {WRITE_OFF_REASONS.map((r) => {
                    const isActive = notes.includes(r);
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => {
                          if (isActive) {
                            setNotes((prev) =>
                              prev
                                .replace(r, "")
                                .replace(/,\s*,/g, ",")
                                .trim()
                            );
                          } else {
                            setNotes((prev) =>
                              prev.trim() ? `${prev.trim()}, ${r}` : r
                            );
                          }
                        }}
                        className={cn(
                          "px-3.5 py-2 rounded-xl text-xs font-bold border transition-all active:scale-95",
                          isActive
                            ? "bg-rose-500/15 border-rose-500/40 text-rose-300"
                            : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                        )}
                      >
                        {r}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Notes Input */}
              <div className="space-y-2">
                <Label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">
                  Причина списания / Комментарий
                </Label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Опишите причину списания подробнее..."
                  className="w-full rounded-2xl bg-zinc-900 border border-zinc-800 p-4 text-sm font-medium text-white transition-all placeholder:text-zinc-600 focus:outline-none focus:border-rose-500/50"
                />
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Sticky Bottom Actions */}
      <footer className="px-4 sm:px-6 py-4 border-t border-zinc-800 bg-zinc-950/80 backdrop-blur-xl sticky bottom-0 z-50 shrink-0">
        <div className="max-w-4xl mx-auto w-full">
          {isHistoryView ? (
            <Button
              type="button"
              onClick={() => setIsHistoryView(false)}
              className="w-full h-14 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-white font-black uppercase italic tracking-wide text-sm rounded-2xl transition-all active:scale-[0.98]"
            >
              <ArrowLeft className="mr-2 h-5 w-5" />
              Вернуться к оформлению списания
            </Button>
          ) : step === 1 ? (
            <Button
              type="button"
              disabled={items.length === 0 || !selectedWarehouseId}
              onClick={() => setStep(2)}
              className="w-full h-14 bg-rose-600 hover:bg-rose-500 text-white font-black uppercase italic tracking-wide text-sm rounded-2xl shadow-lg shadow-rose-950/30 transition-all active:scale-[0.98] disabled:opacity-40"
            >
              Далее: Причина списания
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          ) : (
            <div className="flex items-center gap-3 w-full">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(1)}
                className="h-14 w-14 rounded-2xl bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white transition-all active:scale-95 shrink-0"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <Button
                type="button"
                disabled={isPending}
                onClick={handleFinalize}
                className="flex-1 h-14 bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase italic tracking-wide text-sm rounded-2xl shadow-lg shadow-emerald-950/30 transition-all active:scale-[0.98]"
              >
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Списание...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-5 w-5" />
                    Подтвердить списание ({totalSum.toLocaleString()} ₽)
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </footer>

      {Dialogs}
    </div>,
    document.body
  );
}
