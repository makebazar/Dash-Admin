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
  Package,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ShoppingCart,
  Warehouse,
  Plus,
  Minus,
  X,
  Calendar,
  AlertTriangle,
  History,
  RotateCcw,
  User,
  ChevronDown,
  ChevronUp,
  Truck,
} from "lucide-react";
import {
  getProducts,
  createSupplySafe,
  getProductByBarcode,
  getWarehouses,
  getSupplies,
  getSupplyItems,
} from "@/app/clubs/[clubId]/inventory/actions";
import type { Warehouse as WarehouseType } from "@/app/clubs/[clubId]/inventory/types";
import { useUiDialogs } from "@/app/clubs/[clubId]/inventory/_components/useUiDialogs";
import { getSearchVariants, matchSearchQuery } from "@/lib/search-layout";
import { cn } from "@/lib/utils";

interface EmployeeSupplyWizardProps {
  isOpen: boolean;
  onClose: () => void;
  clubId: string;
  userId: string;
  activeShiftId?: string;
}

interface SupplyItem {
  product_id: number;
  name: string;
  quantity: number;
  cost_price: number;
  expiration_date?: string;
  track_expiration?: boolean;
}

export function EmployeeSupplyWizard({
  isOpen,
  onClose,
  clubId,
  userId,
  activeShiftId,
}: EmployeeSupplyWizardProps) {
  const { showMessage, Dialogs } = useUiDialogs();
  const [step, setStep] = useState<1 | 2>(1); // 1: Items, 2: Destination & Supplier
  const [items, setItems] = useState<SupplyItem[]>([]);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseType[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  // Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedSuggestionIdx, setSelectedSuggestionIdx] = useState(0);

  // Supplier & Notes
  const [supplierName, setSupplierName] = useState("");
  const [notes, setNotes] = useState("");

  // History state
  const [isHistoryView, setIsHistoryView] = useState(false);
  const [historySupplies, setHistorySupplies] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historySearchQuery, setHistorySearchQuery] = useState("");
  const [expandedSupplyId, setExpandedSupplyId] = useState<number | null>(null);
  const [supplyItemsMap, setSupplyItemsMap] = useState<Record<number, any[]>>({});
  const [loadingItemsSupplyId, setLoadingItemsSupplyId] = useState<number | null>(null);

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

  // Body Scroll Lock
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
        const def = whs.find((w) => w.is_default) || whs[0];
        if (def) setSelectedWarehouseId(def.id.toString());
      });
    }
  }, [isOpen, clubId]);

  const loadHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const data = await getSupplies(clubId);
      setHistorySupplies(data || []);
    } catch (e) {
      console.error("Failed to load supplies history", e);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [clubId]);

  useEffect(() => {
    if (isOpen && isHistoryView) {
      loadHistory();
    }
  }, [isOpen, isHistoryView, loadHistory]);

  const handleToggleExpandSupply = async (supplyId: number) => {
    if (expandedSupplyId === supplyId) {
      setExpandedSupplyId(null);
      return;
    }
    setExpandedSupplyId(supplyId);
    if (!supplyItemsMap[supplyId]) {
      setLoadingItemsSupplyId(supplyId);
      try {
        const itemsData = await getSupplyItems(clubId, supplyId);
        setSupplyItemsMap((prev) => ({ ...prev, [supplyId]: itemsData || [] }));
      } catch (e) {
        console.error("Failed to load supply items", e);
      } finally {
        setLoadingItemsSupplyId(null);
      }
    }
  };

  const filteredHistory = useMemo(() => {
    const q = historySearchQuery.trim().toLowerCase();
    if (!q) return historySupplies;
    return historySupplies.filter((s) => {
      const whName =
        s.warehouse_name ||
        warehouses.find((w) => w.id === s.warehouse_id)?.name;
      return (
        s.supplier_name?.toLowerCase().includes(q) ||
        whName?.toLowerCase().includes(q) ||
        s.notes?.toLowerCase().includes(q) ||
        s.created_by_name?.toLowerCase().includes(q) ||
        String(s.id).includes(q)
      );
    });
  }, [historySupplies, historySearchQuery, warehouses]);

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
    let expDate: string | undefined = undefined;
    if (
      product.track_expiration &&
      product.shelf_life_days &&
      Number(product.shelf_life_days) > 0
    ) {
      const exp = new Date();
      exp.setDate(exp.getDate() + Number(product.shelf_life_days));
      expDate = exp.toISOString().split("T")[0];
    }

    const existingIdx = items.findIndex((i) => i.product_id === product.id);
    if (existingIdx > -1) {
      const newItems = [...items];
      newItems[existingIdx].quantity += qty;
      if (!newItems[existingIdx].expiration_date && expDate) {
        newItems[existingIdx].expiration_date = expDate;
      }
      setItems(newItems);
    } else {
      setItems((prev) => [
        ...prev,
        {
          product_id: product.id,
          name: product.name,
          quantity: qty,
          cost_price: Number(product.cost_price) || 0,
          expiration_date: expDate,
          track_expiration: Boolean(product.track_expiration),
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

  const updateItem = (
    productId: number,
    field: "quantity" | "cost_price" | "expiration_date",
    value: any
  ) => {
    setItems((prev) =>
      prev.map((i) => (i.product_id === productId ? { ...i, [field]: value } : i))
    );
  };

  const removeItem = (productId: number) => {
    setItems((prev) => prev.filter((i) => i.product_id !== productId));
  };

  const handleClose = () => {
    setStep(1);
    setItems([]);
    setSupplierName("");
    setNotes("");
    setSearchQuery("");
    setIsSearchOpen(false);
    setIsHistoryView(false);
    onClose();
  };

  const totalSum = useMemo(() => {
    return items.reduce((sum, item) => sum + item.cost_price * item.quantity, 0);
  }, [items]);

  const totalQty = useMemo(() => {
    return items.reduce((sum, item) => sum + item.quantity, 0);
  }, [items]);

  const handleFinalize = () => {
    if (items.length === 0) return;
    if (!selectedWarehouseId) {
      showMessage({
        title: "Проверьте данные",
        description: "Выберите склад для приемки поставки",
      });
      return;
    }

    startTransition(async () => {
      try {
        const result = await createSupplySafe(clubId, userId, {
          items: items.map((i) => ({
            product_id: i.product_id,
            quantity: i.quantity,
            cost_price: i.cost_price,
            expiration_date: i.expiration_date,
          })),
          supplier_name: supplierName,
          notes: notes,
          shift_id: activeShiftId,
          warehouse_id: Number(selectedWarehouseId),
        });

        if (!result.ok) {
          showMessage({ title: "Ошибка", description: result.error });
          return;
        }

        showMessage({
          title: "Поставка оприходована",
          description: "Товары успешно добавлены на склад",
        });
        handleClose();
      } catch (e: any) {
        console.error(e);
        showMessage({
          title: "Ошибка",
          description: e?.message || "Ошибка при оформлении поставки",
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
            <div className="h-10 w-10 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-white uppercase italic tracking-tight leading-none">
                {isHistoryView
                  ? "История поставок"
                  : step === 1
                  ? "Поставка товаров"
                  : "Склад и реквизиты"}
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
                  <span className="text-[10px] text-blue-400 font-bold uppercase tracking-wider">
                    Накладных в истории: {filteredHistory.length}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* History Button */}
            <Button
              variant="outline"
              size="icon"
              onClick={() => setIsHistoryView(!isHistoryView)}
              className={cn(
                "h-12 w-12 rounded-2xl border transition-all active:scale-90",
                isHistoryView
                  ? "bg-blue-500/10 border-blue-500/40 text-blue-400"
                  : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white"
              )}
              title={isHistoryView ? "Вернуться к оформлению" : "История поставок"}
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

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
        <div className="max-w-4xl mx-auto space-y-6 pb-28">
          {isHistoryView ? (
            /* History View */
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Filter & Search Bar */}
              <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
                <div className="relative flex-1 w-full group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 group-focus-within:text-blue-400 transition-colors" />
                  <Input
                    value={historySearchQuery}
                    onChange={(e) => setHistorySearchQuery(e.target.value)}
                    placeholder="Поиск по поставщику, номеру, примечанию..."
                    className="h-12 pl-11 rounded-2xl bg-zinc-900 border-zinc-800 text-sm font-medium text-white placeholder:text-zinc-600 focus:border-blue-500/50"
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

                <Button
                  type="button"
                  variant="outline"
                  onClick={loadHistory}
                  disabled={isLoadingHistory}
                  className="h-12 px-4 rounded-2xl bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white active:scale-95 transition-all shrink-0"
                >
                  <RotateCcw
                    className={cn(
                      "h-4 w-4",
                      isLoadingHistory && "animate-spin text-blue-400"
                    )}
                  />
                </Button>
              </div>

              {/* History List */}
              {isLoadingHistory ? (
                <div className="flex flex-col items-center justify-center py-24 gap-4 text-zinc-500">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                  <span className="text-xs font-mono uppercase tracking-widest">
                    Загрузка поставок...
                  </span>
                </div>
              ) : filteredHistory.length === 0 ? (
                <div className="border border-dashed border-zinc-800 rounded-3xl p-12 text-center text-zinc-600 space-y-3 bg-zinc-950/40">
                  <History className="h-10 w-10 mx-auto text-zinc-700" />
                  <div className="text-sm font-bold text-zinc-400">
                    История поставок пуста
                  </div>
                  <div className="text-xs text-zinc-600 max-w-xs mx-auto">
                    {historySearchQuery
                      ? "Ничего не найдено по вашему запросу."
                      : "В этом клубе еще не проводились поставки товаров."}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredHistory.map((s) => {
                    const isExpanded = expandedSupplyId === s.id;
                    const items = supplyItemsMap[s.id] || [];
                    const isLoadingItems = loadingItemsSupplyId === s.id;
                    const totalCost = Number(s.total_cost || s.total_amount || 0);
                    const warehouseName =
                      s.warehouse_name ||
                      warehouses.find((w) => w.id === s.warehouse_id)?.name;
                    const cleanNotes = s.notes
                      ? s.notes.replace(/\s*\(Смена #[a-f0-9-]+\)/gi, "").trim()
                      : "";

                    return (
                      <div
                        key={s.id}
                        className="rounded-2xl border border-zinc-800/60 bg-zinc-900/60 hover:border-zinc-700 transition-all overflow-hidden"
                      >
                        <button
                          type="button"
                          onClick={() => handleToggleExpandSupply(s.id)}
                          className="w-full text-left p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 active:bg-zinc-800/30 transition-colors"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap text-xs">
                              <span className="font-bold text-white">
                                {s.supplier_name || "Поставка"}
                              </span>
                              <span className="text-zinc-600">·</span>
                              <span className="font-bold uppercase tracking-wider text-blue-400">
                                {s.status === "COMPLETED" ? "Проведена" : s.status || "Оформлена"}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 text-[11px] text-zinc-500 flex-wrap">
                              {warehouseName && (
                                <>
                                  <span className="text-zinc-300 font-medium flex items-center gap-1 font-mono">
                                    <Warehouse className="h-3 w-3 text-blue-400" />
                                    {warehouseName}
                                  </span>
                                  <span>•</span>
                                </>
                              )}
                              {s.created_by_name && (
                                <span className="flex items-center gap-1">
                                  <User className="h-3 w-3" /> {s.created_by_name}
                                </span>
                              )}
                              <span>•</span>
                              <span>
                                Позиций: {s.items_count || "—"}
                              </span>
                              {cleanNotes ? (
                                <>
                                  <span>•</span>
                                  <span className="truncate max-w-xs text-zinc-400 italic">
                                    "{cleanNotes}"
                                  </span>
                                </>
                              ) : null}
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                            <div className="text-right">
                              <div className="text-sm font-black text-blue-400 italic">
                                {totalCost > 0 ? `${totalCost.toLocaleString()} ₽` : "—"}
                              </div>
                              <div className="text-[10px] text-zinc-500 font-mono">
                                {new Date(s.created_at).toLocaleString("ru-RU", {
                                  day: "2-digit",
                                  month: "2-digit",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </div>
                            </div>

                            <div className="h-8 w-8 rounded-xl bg-zinc-800 flex items-center justify-center text-zinc-400">
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </div>
                          </div>
                        </button>

                        {/* Expanded Items */}
                        {isExpanded && (
                          <div className="border-t border-zinc-800 bg-zinc-950/80 p-4 space-y-2">
                            <span className="text-[10px] font-black uppercase text-zinc-500 tracking-wider block">
                              Товары в накладной
                            </span>

                            {isLoadingItems ? (
                              <div className="py-4 text-center text-xs text-zinc-500 flex items-center justify-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                                Загрузка позиций...
                              </div>
                            ) : items.length === 0 ? (
                              <div className="py-2 text-xs text-zinc-600 italic">
                                Список позиций пуст или не найден
                              </div>
                            ) : (
                              <div className="divide-y divide-zinc-800/60">
                                {items.map((it, idx) => (
                                  <div
                                    key={idx}
                                    className="py-2 flex items-center justify-between text-xs"
                                  >
                                    <div className="space-y-0.5">
                                      <span className="font-bold text-white">
                                        {it.product_name}
                                      </span>
                                      {it.expiration_date && (
                                        <div className="text-[10px] text-amber-400 font-mono">
                                          Годен до: {new Date(it.expiration_date).toLocaleDateString("ru-RU")}
                                        </div>
                                      )}
                                    </div>
                                    <div className="text-right font-mono">
                                      <span className="text-zinc-300 font-bold">
                                        {it.quantity} шт
                                      </span>
                                      <span className="text-zinc-500 text-[11px] block">
                                        по {Number(it.cost_price || 0).toLocaleString()} ₽
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : step === 1 ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Product Search & Barcode Scan */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.2em] flex items-center gap-2">
                    <span className="text-blue-500">01</span> Добавить товары
                  </span>
                  {totalSum > 0 && (
                    <span className="text-xs font-black text-blue-400 italic">
                      Сумма поставки: {totalSum.toLocaleString()} ₽
                    </span>
                  )}
                </div>

                <div ref={searchContainerRef} className="relative group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-500 group-focus-within:text-blue-400 transition-colors pointer-events-none" />
                  <Input
                    ref={searchInputRef}
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
                    placeholder="Штрихкод или название..."
                    className="h-14 pl-12 pr-24 rounded-2xl bg-zinc-900 border-zinc-800 text-base font-medium transition-all placeholder:text-zinc-600 focus:border-blue-500/50 focus:ring-blue-500/10"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs text-muted-foreground font-medium bg-zinc-900 px-2 py-1 rounded-md border border-zinc-800/50 pointer-events-none select-none">
                    <span>↵</span> Enter
                  </div>

                  {/* Search Suggestions */}
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
                            (i) => i.product_id === p.id
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
                                existingItem && "border-l-2 border-l-blue-500 bg-blue-500/[0.04]"
                              )}
                            >
                              <div className="flex flex-col min-w-0 pr-3">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm text-white truncate">
                                    {p.name}
                                  </span>
                                  {existingItem && (
                                    <span className="text-[10px] font-mono font-bold text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20 shrink-0">
                                      В списке: {existingItem.quantity} шт
                                    </span>
                                  )}
                                </div>
                                <span className="text-[11px] text-zinc-500">
                                  Закуп: {p.cost_price || 0} ₽ • Продажа:{" "}
                                  {p.selling_price || 0} ₽
                                  {p.barcode && ` • ${p.barcode}`}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 shrink-0">
                                <span className="text-sm font-mono text-zinc-400">
                                  {Number(p.cost_price || 0).toLocaleString()} ₽
                                </span>
                                <div
                                  className={cn(
                                    "h-7 w-7 rounded-lg flex items-center justify-center transition-all",
                                    isSelected
                                      ? "bg-blue-500 text-white shadow-sm shadow-blue-950/40"
                                      : "bg-zinc-800 text-zinc-400 group-hover/item:bg-blue-500 group-hover/item:text-white"
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

              {/* Items List */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.2em] flex items-center gap-2">
                    <span className="text-blue-500">02</span> Товары в поставке (
                    {items.length})
                  </span>
                </div>

                {items.length === 0 ? (
                  <div className="border border-dashed border-zinc-800 rounded-3xl p-12 text-center text-zinc-600 space-y-3 bg-zinc-950/40">
                    <div className="h-14 w-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-zinc-700">
                      <ShoppingCart className="h-7 w-7" />
                    </div>
                    <div className="text-sm font-bold text-zinc-400">
                      Список товаров пуст
                    </div>
                    <div className="text-xs text-zinc-600 max-w-xs mx-auto">
                      Воспользуйтесь поиском по названию или сканируйте штрихкоды,
                      чтобы добавить товары в приходную накладную.
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {items.map((item) => (
                      <div
                        key={item.product_id}
                        className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-4 space-y-3 hover:border-zinc-700 transition-all"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <span className="text-sm font-bold text-white">
                              {item.name}
                            </span>
                            {item.expiration_date && (
                              <div className="text-xs text-amber-400 font-mono mt-0.5">
                                Срок: {item.expiration_date}
                              </div>
                            )}
                          </div>

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeItem(item.product_id)}
                            className="h-8 w-8 rounded-xl text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 active:scale-90 transition-all"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        {/* Cost Price, Stepper & Expiration Date */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-zinc-800/60">
                          {/* Cost Price Input */}
                          <div className="space-y-1">
                            <Label className="text-[9px] font-black uppercase tracking-wider text-zinc-500">
                              Цена закупа (₽/шт)
                            </Label>
                            <Input
                              type="number"
                              min="0"
                              value={item.cost_price}
                              onChange={(e) =>
                                updateItem(
                                  item.product_id,
                                  "cost_price",
                                  Number(e.target.value) || 0
                                )
                              }
                              className="h-10 rounded-xl bg-zinc-950 border-zinc-800 text-sm font-bold text-white focus:border-blue-500/50"
                            />
                          </div>

                          {/* Quantity Stepper */}
                          <div className="space-y-1">
                            <Label className="text-[9px] font-black uppercase tracking-wider text-zinc-500">
                              Количество (шт)
                            </Label>
                            <div className="flex items-center gap-1.5 bg-zinc-950 border border-zinc-800 rounded-xl p-1 h-10 w-fit">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() =>
                                  updateItem(
                                    item.product_id,
                                    "quantity",
                                    Math.max(1, item.quantity - 1)
                                  )
                                }
                                className="h-8 w-8 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 shrink-0"
                              >
                                <Minus className="h-4 w-4" />
                              </Button>
                              <Input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) =>
                                  updateItem(
                                    item.product_id,
                                    "quantity",
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
                                  updateItem(
                                    item.product_id,
                                    "quantity",
                                    item.quantity + 1
                                  )
                                }
                                className="h-8 w-8 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 shrink-0"
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>

                          {/* Expiration Date if tracked */}
                          {item.track_expiration ? (
                            <div className="space-y-1">
                              <Label className="text-[9px] font-black uppercase tracking-wider text-amber-500 flex items-center gap-1">
                                <Calendar className="h-3 w-3" /> Срок годности
                              </Label>
                              <Input
                                type="date"
                                value={item.expiration_date || ""}
                                onChange={(e) =>
                                  updateItem(
                                    item.product_id,
                                    "expiration_date",
                                    e.target.value
                                  )
                                }
                                className="h-10 rounded-xl bg-zinc-950 border-amber-500/30 text-amber-300 text-xs font-mono"
                              />
                            </div>
                          ) : (
                            <div className="flex flex-col justify-end text-right">
                              <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-black">
                                Сумма позиции
                              </span>
                              <span className="text-base font-black text-white italic">
                                {(item.cost_price * item.quantity).toLocaleString()} ₽
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          ) : (
            /* Step 2: Warehouse, Supplier, and Details */
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Summary Recap */}
              <div className="p-6 bg-zinc-900/60 rounded-3xl border border-zinc-800 space-y-4">
                <span className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.2em]">
                  Итог поставки
                </span>

                <div className="grid grid-cols-2 gap-4">
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
                      Итоговая сумма
                    </span>
                    <div className="text-2xl font-black text-blue-400 italic mt-0.5">
                      {totalSum.toLocaleString()} ₽
                    </div>
                  </div>
                </div>
              </div>

              {/* Warehouse Destination */}
              <section className="space-y-3">
                <span className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.2em] flex items-center gap-2">
                  <span className="text-blue-500">01</span> Склад назначения (куда
                  принимаем)
                </span>

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
                            ? "bg-blue-500/10 border-blue-500/50 text-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.15)] ring-1 ring-blue-500/30"
                            : "bg-zinc-900/60 border-zinc-800/80 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                        )}
                      >
                        <div className="flex items-center justify-between w-full">
                          <Warehouse
                            className={cn(
                              "h-4 w-4",
                              isSelected ? "text-blue-400" : "text-zinc-600"
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

              {/* Supplier & Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">
                    Поставщик
                  </Label>
                  <Input
                    placeholder="Название поставщика или компании..."
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    className="h-14 rounded-2xl bg-zinc-900 border-zinc-800 text-base font-bold text-white placeholder:text-zinc-600 focus:border-blue-500/50"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">
                    Номер накладной / Примечание
                  </Label>
                  <Input
                    placeholder="Например: накладная №412 от 12.05..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="h-14 rounded-2xl bg-zinc-900 border-zinc-800 text-base font-bold text-white placeholder:text-zinc-600 focus:border-blue-500/50"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="px-4 sm:px-6 py-4 border-t border-zinc-800 bg-zinc-950/80 backdrop-blur-xl sticky bottom-0 z-50 shrink-0">
        <div className="max-w-4xl mx-auto w-full">
          {isHistoryView ? (
            <Button
              type="button"
              onClick={() => setIsHistoryView(false)}
              className="w-full h-14 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-white font-black uppercase italic tracking-wide text-sm rounded-2xl transition-all active:scale-[0.98]"
            >
              <ArrowLeft className="mr-2 h-5 w-5" />
              Вернуться к оформлению поставки
            </Button>
          ) : step === 1 ? (
            <Button
              type="button"
              disabled={items.length === 0}
              onClick={() => setStep(2)}
              className="w-full h-14 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase italic tracking-wide text-sm rounded-2xl shadow-lg shadow-blue-950/30 transition-all active:scale-[0.98] disabled:opacity-40"
            >
              Далее: Склад и реквизиты
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
                disabled={isPending || !selectedWarehouseId}
                onClick={handleFinalize}
                className="flex-1 h-14 bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase italic tracking-wide text-sm rounded-2xl shadow-lg shadow-emerald-950/30 transition-all active:scale-[0.98]"
              >
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Приемка...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-5 w-5" />
                    Оприходовать поставку ({totalSum.toLocaleString()} ₽)
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
