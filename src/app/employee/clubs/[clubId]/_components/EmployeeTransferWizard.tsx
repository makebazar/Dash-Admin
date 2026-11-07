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
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ShoppingCart,
  Warehouse,
  Plus,
  Minus,
  X,
  ArrowRightLeft,
  AlertTriangle,
  MoveRight,
  History,
  RotateCcw,
  User,
  Calendar,
} from "lucide-react";
import {
  getProducts,
  createTransferSafe,
  getProductByBarcode,
  getWarehouses,
  getStockMovements,
} from "@/app/clubs/[clubId]/inventory/actions";
import type { Warehouse as WarehouseType } from "@/app/clubs/[clubId]/inventory/types";
import { useUiDialogs } from "@/app/clubs/[clubId]/inventory/_components/useUiDialogs";
import { getSearchVariants, matchSearchQuery } from "@/lib/search-layout";
import { cn } from "@/lib/utils";

interface EmployeeTransferWizardProps {
  isOpen: boolean;
  onClose: () => void;
  clubId: string;
  userId: string;
  activeShiftId?: string;
  inventorySettings?: any;
}

interface TransferItem {
  product_id: number;
  name: string;
  quantity: number;
  available_stock: number;
}

export function EmployeeTransferWizard({
  isOpen,
  onClose,
  clubId,
  userId,
  activeShiftId,
  inventorySettings,
}: EmployeeTransferWizardProps) {
  const { showMessage, Dialogs } = useUiDialogs();
  const [step, setStep] = useState<1 | 2 | 3>(1); // 1: Route, 2: Items, 3: Confirm
  const [items, setItems] = useState<TransferItem[]>([]);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseType[]>([]);
  const [sourceWarehouseId, setSourceWarehouseId] = useState<string>("");
  const [targetWarehouseId, setTargetWarehouseId] = useState<string>("");
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

  // Load products and warehouses
  useEffect(() => {
    if (isOpen) {
      getProducts(clubId).then(setAllProducts);
      getWarehouses(clubId).then((whs) => {
        setWarehouses(whs);
        const def = whs.find((w) => w.is_default) || whs[0];
        if (def) {
          const srcId = def.id.toString();
          setSourceWarehouseId(srcId);
          const target =
            whs.find((w) => {
              if (w.id.toString() === srcId) return false;
              const isBlocked = (
                inventorySettings?.transfer_blocked_routes || []
              ).some(
                (r: any) =>
                  Number(r.from_id) === Number(srcId) &&
                  Number(r.to_id) === Number(w.id)
              );
              return !isBlocked;
            }) || whs[0];
          if (target) setTargetWarehouseId(target.id.toString());
        }
      });
    }
  }, [isOpen, clubId, inventorySettings]);

  const loadHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const data = await getStockMovements(clubId, 300);
      // Filter transfer movements (take outbound transfers change_amount < 0 for clean listing)
      const transfers = (data || []).filter(
        (m: any) => m.type === "TRANSFER" && Number(m.change_amount || 0) < 0
      );
      setHistoryMovements(transfers);
    } catch (e) {
      console.error("Failed to load transfer history", e);
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

  // Products available in source warehouse
  const availableProducts = useMemo(() => {
    if (!sourceWarehouseId) return [];
    return allProducts.filter((p) => {
      const stock =
        p.stocks?.find((s: any) => s.warehouse_id === Number(sourceWarehouseId))
          ?.quantity || 0;
      return stock > 0;
    });
  }, [allProducts, sourceWarehouseId]);

  const suggestions = useMemo(() => {
    const qRaw = searchQuery.trim().toLowerCase();
    if (!qRaw) return [];

    const variants = getSearchVariants(qRaw);
    const hits: { p: any; score: number }[] = [];
    for (const p of availableProducts) {
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
  }, [availableProducts, searchQuery]);

  const addOrIncrementProduct = (product: any, qty: number = 1) => {
    const sourceStock =
      product.stocks?.find(
        (s: any) => s.warehouse_id === Number(sourceWarehouseId)
      )?.quantity || 0;

    if (sourceStock <= 0) {
      showMessage({
        title: "Нет в наличии",
        description: "Этого товара нет на складе отправления",
      });
      return;
    }

    const existingIdx = items.findIndex((i) => i.product_id === product.id);
    if (existingIdx > -1) {
      const newItems = [...items];
      const maxAllowed = sourceStock;
      newItems[existingIdx].quantity = Math.min(
        maxAllowed,
        newItems[existingIdx].quantity + qty
      );
      setItems(newItems);
    } else {
      setItems((prev) => [
        ...prev,
        {
          product_id: product.id,
          name: product.name,
          quantity: Math.min(sourceStock, qty),
          available_stock: sourceStock,
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
          const sourceStock =
            product.stocks?.find(
              (s: any) => s.warehouse_id === Number(sourceWarehouseId)
            )?.quantity || 0;
          if (sourceStock <= 0) {
            showMessage({
              title: "Нет в наличии",
              description: `Товар ${product.name} отсутствует на складе отправления`,
            });
            return;
          }
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
      prev.map((i) =>
        i.product_id === productId
          ? { ...i, quantity: Math.min(i.available_stock, newQty) }
          : i
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

  const totalQty = useMemo(() => {
    return items.reduce((sum, item) => sum + item.quantity, 0);
  }, [items]);

  const sourceWh = warehouses.find((w) => w.id.toString() === sourceWarehouseId);
  const targetWh = warehouses.find((w) => w.id.toString() === targetWarehouseId);

  const isRouteBlocked = useMemo(() => {
    if (!sourceWarehouseId || !targetWarehouseId) return false;
    return (inventorySettings?.transfer_blocked_routes || []).some(
      (r: any) =>
        Number(r.from_id) === Number(sourceWarehouseId) &&
        Number(r.to_id) === Number(targetWarehouseId)
    );
  }, [inventorySettings, sourceWarehouseId, targetWarehouseId]);

  const handleFinalize = () => {
    if (items.length === 0) return;
    if (!sourceWarehouseId || !targetWarehouseId) {
      showMessage({
        title: "Проверьте данные",
        description: "Выберите склад отправления и назначения",
      });
      return;
    }

    if (sourceWarehouseId === targetWarehouseId) {
      showMessage({
        title: "Некорректный маршрут",
        description: "Склады отправления и назначения должны отличаться",
      });
      return;
    }

    startTransition(async () => {
      try {
        const result = await createTransferSafe(clubId, userId, {
          items: items.map((i) => ({
            product_id: i.product_id,
            quantity: i.quantity,
          })),
          source_warehouse_id: Number(sourceWarehouseId),
          target_warehouse_id: Number(targetWarehouseId),
          notes: notes,
          shift_id: activeShiftId,
        });

        if (!result.ok) {
          showMessage({ title: "Ошибка", description: result.error });
          return;
        }

        showMessage({
          title: "Перемещение выполнено",
          description: "Товары успешно перемещены между складами",
        });
        handleClose();
      } catch (e: any) {
        console.error(e);
        showMessage({
          title: "Ошибка",
          description: e?.message || "Ошибка при выполнении перемещения",
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
            <div className="h-10 w-10 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <ArrowRightLeft className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-white uppercase italic tracking-tight leading-none">
                {isHistoryView
                  ? "История перемещений"
                  : step === 1
                  ? "Маршрут перемещения"
                  : step === 2
                  ? "Выбор товаров"
                  : "Подтверждение перемещения"}
              </h2>
              <div className="flex items-center gap-2 mt-1.5">
                {!isHistoryView ? (
                  <>
                    <Badge
                      variant="outline"
                      className="border-zinc-700 text-zinc-500 text-[9px] font-mono px-1.5 py-0 h-4 bg-zinc-900/50"
                    >
                      ШАГ {step} ИЗ 3
                    </Badge>
                    {items.length > 0 && (
                      <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
                        Позиций: {items.length} ({totalQty} шт)
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-[10px] text-purple-400 font-bold uppercase tracking-wider">
                    Всего перемещений: {filteredHistory.length}
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
                  ? "bg-purple-500/10 border-purple-500/40 text-purple-400"
                  : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white"
              )}
              title={isHistoryView ? "Вернуться к перемещению" : "История перемещений"}
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
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 group-focus-within:text-purple-400 transition-colors" />
                  <Input
                    value={historySearchQuery}
                    onChange={(e) => setHistorySearchQuery(e.target.value)}
                    placeholder="Поиск по товару, складу, сотруднику или примечанию..."
                    className="h-12 pl-11 rounded-2xl bg-zinc-900 border-zinc-800 text-sm font-medium text-white placeholder:text-zinc-600 focus:border-purple-500/50"
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
                          ? "bg-purple-500/10 border-purple-500/40 text-purple-400"
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
                        isLoadingHistory && "animate-spin text-purple-400"
                      )}
                    />
                  </Button>
                </div>
              </div>

              {/* History List */}
              {isLoadingHistory ? (
                <div className="flex flex-col items-center justify-center py-24 gap-4 text-zinc-500">
                  <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
                  <span className="text-xs font-mono uppercase tracking-widest">
                    Загрузка перемещений...
                  </span>
                </div>
              ) : filteredHistory.length === 0 ? (
                <div className="border border-dashed border-zinc-800 rounded-3xl p-12 text-center text-zinc-600 space-y-3 bg-zinc-950/40">
                  <History className="h-10 w-10 mx-auto text-zinc-700" />
                  <div className="text-sm font-bold text-zinc-400">
                    История перемещений пуста
                  </div>
                  <div className="text-xs text-zinc-600 max-w-xs mx-auto">
                    {historySearchQuery || historyOnlyShift
                      ? "Ничего не найдено по заданным критериям."
                      : "В этом клубе еще не оформлялись перемещения товаров."}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredHistory.map((m) => {
                    const qty = Math.abs(Number(m.change_amount || 0));

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
                              <span className="font-mono font-bold text-purple-400">
                                {qty} шт
                              </span>
                              {m.warehouse_name && (
                                <>
                                  <span className="text-zinc-600">·</span>
                                  <span className="text-zinc-400 flex items-center gap-1 font-mono">
                                    <Warehouse className="h-3 w-3 text-zinc-500" />
                                    Откуда: {m.warehouse_name}
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
                            <div className="text-[10px] text-zinc-500 font-mono">
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
            /* Step 1: Select Warehouses */
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Route Banner */}
              <div className="p-6 bg-zinc-900/60 rounded-3xl border border-zinc-800 flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">
                    Склад-отправитель
                  </span>
                  <div className="text-lg font-black text-purple-400 italic">
                    {sourceWh?.name || "Не выбран"}
                  </div>
                </div>

                <div className="h-10 w-10 rounded-2xl bg-zinc-800 flex items-center justify-center text-zinc-400 shrink-0">
                  <MoveRight className="h-5 w-5 text-purple-400" />
                </div>

                <div className="space-y-1 text-right">
                  <span className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">
                    Склад-получатель
                  </span>
                  <div className="text-lg font-black text-emerald-400 italic">
                    {targetWh?.name || "Не выбран"}
                  </div>
                </div>
              </div>

              {isRouteBlocked && (
                <div className="p-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
                  <span>
                    Этот маршрут перемещения заблокирован настройками инвентаризации клуба.
                  </span>
                </div>
              )}

              {/* Source Warehouse */}
              <section className="space-y-3">
                <span className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.2em] flex items-center gap-2">
                  <span className="text-purple-400">01</span> Откуда перемещаем (Склад
                  отправления)
                </span>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {warehouses.map((wh) => {
                    const isSelected = sourceWarehouseId === wh.id.toString();
                    return (
                      <button
                        key={wh.id}
                        type="button"
                        onClick={() => {
                          const newSrc = wh.id.toString();
                          setSourceWarehouseId(newSrc);
                          if (targetWarehouseId === newSrc) {
                            const other = warehouses.find(
                              (w) => w.id.toString() !== newSrc
                            );
                            if (other) setTargetWarehouseId(other.id.toString());
                          }
                          // Clear items if source changed
                          setItems([]);
                        }}
                        className={cn(
                          "relative text-left p-3.5 rounded-2xl border transition-all text-xs flex flex-col justify-between gap-2 active:scale-[0.98]",
                          isSelected
                            ? "bg-purple-500/10 border-purple-500/50 text-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.15)] ring-1 ring-purple-500/30"
                            : "bg-zinc-900/60 border-zinc-800/80 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                        )}
                      >
                        <div className="flex items-center justify-between w-full">
                          <Warehouse
                            className={cn(
                              "h-4 w-4",
                              isSelected ? "text-purple-400" : "text-zinc-600"
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

              {/* Target Warehouse */}
              <section className="space-y-3">
                <span className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.2em] flex items-center gap-2">
                  <span className="text-emerald-500">02</span> Куда перемещаем (Склад
                  назначения)
                </span>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {warehouses
                    .filter((wh) => wh.id.toString() !== sourceWarehouseId)
                    .map((wh) => {
                      const isSelected = targetWarehouseId === wh.id.toString();
                      const isBlocked = (
                        inventorySettings?.transfer_blocked_routes || []
                      ).some(
                        (r: any) =>
                          Number(r.from_id) === Number(sourceWarehouseId) &&
                          Number(r.to_id) === Number(wh.id)
                      );

                      return (
                        <button
                          key={wh.id}
                          type="button"
                          disabled={isBlocked}
                          onClick={() => setTargetWarehouseId(wh.id.toString())}
                          className={cn(
                            "relative text-left p-3.5 rounded-2xl border transition-all text-xs flex flex-col justify-between gap-2 active:scale-[0.98]",
                            isBlocked && "opacity-40 cursor-not-allowed bg-zinc-950",
                            isSelected
                              ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/30"
                              : "bg-zinc-900/60 border-zinc-800/80 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                          )}
                        >
                          <div className="flex items-center justify-between w-full">
                            <Warehouse
                              className={cn(
                                "h-4 w-4",
                                isSelected ? "text-emerald-400" : "text-zinc-600"
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
            </div>
          ) : step === 2 ? (
            /* Step 2: Product Selection */
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Active Route Pill */}
              <div className="px-4 py-3 bg-zinc-900/60 rounded-2xl border border-zinc-800 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-zinc-500 font-bold uppercase tracking-wider text-[10px]">
                    Маршрут:
                  </span>
                  <span className="font-bold text-purple-400">{sourceWh?.name}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-zinc-600" />
                  <span className="font-bold text-emerald-400">{targetWh?.name}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-zinc-500 hover:text-zinc-300 font-bold text-[10px] uppercase tracking-wider underline underline-offset-2"
                >
                  Сменить
                </button>
              </div>

              {/* Search & Scanner */}
              <section className="space-y-3">
                <span className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.2em] flex items-center gap-2">
                  <span className="text-purple-400">01</span> Добавить товары
                </span>

                <div ref={searchContainerRef} className="relative group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-500 group-focus-within:text-purple-400 transition-colors pointer-events-none" />
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
                    placeholder="Штрихкод или название товара в наличии..."
                    className="h-14 pl-12 pr-24 rounded-2xl bg-zinc-900 border-zinc-800 text-base font-medium transition-all placeholder:text-zinc-600 focus:border-purple-500/50 focus:ring-purple-500/10"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs text-muted-foreground font-medium bg-zinc-900 px-2 py-1 rounded-md border border-zinc-800/50 pointer-events-none select-none">
                    <span>↵</span> Enter
                  </div>

                  {/* Suggestions */}
                  {isSearchOpen && searchQuery.trim() && (
                    <div
                      ref={suggestionsListRef}
                      className="absolute left-0 right-0 top-full mt-2 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl z-50 max-h-75 overflow-y-auto custom-scrollbar p-1.5 space-y-1 animate-in fade-in slide-in-from-top-2 duration-200"
                    >
                      {suggestions.length === 0 ? (
                        <div className="p-4 text-center text-sm text-zinc-500">
                          Товары не найдены или нет остатка на складе {sourceWh?.name}
                        </div>
                      ) : (
                        suggestions.map((p, idx) => {
                          const stock =
                            p.stocks?.find(
                              (s: any) =>
                                s.warehouse_id === Number(sourceWarehouseId)
                            )?.quantity || 0;
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
                                existingItem && "border-l-2 border-l-purple-500 bg-purple-500/[0.04]"
                              )}
                            >
                              <div className="flex flex-col min-w-0 pr-3">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm text-white truncate">
                                    {p.name}
                                  </span>
                                  {existingItem && (
                                    <span className="text-[10px] font-mono font-bold text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20 shrink-0">
                                      В списке: {existingItem.quantity} шт
                                    </span>
                                  )}
                                </div>
                                <span className="text-[11px] text-zinc-500">
                                  {p.barcode ? `Штрихкод: ${p.barcode}` : "Без штрихкода"}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 shrink-0">
                                <span className="text-sm font-mono text-zinc-400">
                                  {stock} шт
                                </span>
                                <div
                                  className={cn(
                                    "h-7 w-7 rounded-lg flex items-center justify-center transition-all",
                                    isSelected
                                      ? "bg-purple-500 text-white shadow-sm shadow-purple-950/40"
                                      : "bg-zinc-800 text-zinc-400 group-hover/item:bg-purple-500 group-hover/item:text-white"
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
                <span className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.2em] flex items-center gap-2">
                  <span className="text-purple-400">02</span> Товары к перемещению (
                  {items.length})
                </span>

                {items.length === 0 ? (
                  <div className="border border-dashed border-zinc-800 rounded-3xl p-12 text-center text-zinc-600 space-y-3 bg-zinc-950/40">
                    <div className="h-14 w-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-zinc-700">
                      <ShoppingCart className="h-7 w-7" />
                    </div>
                    <div className="text-sm font-bold text-zinc-400">
                      Список товаров пуст
                    </div>
                    <div className="text-xs text-zinc-600 max-w-xs mx-auto">
                      Используйте строку поиска или сканер штрихкодов, чтобы выбрать
                      товары с остатком на складе {sourceWh?.name}.
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
                          <span className="text-sm font-bold text-white">
                            {item.name}
                          </span>
                          <div className="flex items-center gap-2.5">
                            <span className="text-xs font-mono text-zinc-400">
                              Остаток: <span className="font-bold text-purple-400">{item.available_stock} шт</span>
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                updateItemQty(
                                  item.product_id,
                                  item.available_stock
                                )
                              }
                              className="text-[10px] font-mono px-2 py-0.5 rounded border border-zinc-700 bg-zinc-800 text-zinc-300 hover:text-white transition-colors"
                            >
                              Макс ({item.available_stock})
                            </button>
                          </div>
                        </div>

                        {/* Controls */}
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
                              max={item.available_stock}
                              value={item.quantity}
                              onChange={(e) =>
                                updateItemQty(
                                  item.product_id,
                                  Math.min(
                                    item.available_stock,
                                    Math.max(1, Number(e.target.value) || 1)
                                  )
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
            /* Step 3: Confirmation */
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Route Summary */}
              <div className="p-6 bg-zinc-900/60 rounded-3xl border border-zinc-800 space-y-4">
                <span className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.2em]">
                  Маршрут и объем
                </span>

                <div className="flex items-center justify-between gap-4 py-2 border-b border-zinc-800/60">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">
                      Откуда
                    </span>
                    <div className="text-base font-black text-purple-400">
                      {sourceWh?.name}
                    </div>
                  </div>
                  <MoveRight className="h-5 w-5 text-zinc-600" />
                  <div className="space-y-0.5 text-right">
                    <span className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">
                      Куда
                    </span>
                    <div className="text-base font-black text-emerald-400">
                      {targetWh?.name}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-1">
                  <div>
                    <span className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">
                      Позиций к передаче
                    </span>
                    <div className="text-2xl font-black text-white italic mt-0.5">
                      {items.length}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">
                      Общее количество
                    </span>
                    <div className="text-2xl font-black text-purple-400 italic mt-0.5">
                      {totalQty} шт
                    </div>
                  </div>
                </div>
              </div>

              {/* Items Table Recap */}
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
                <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-900/80 text-[10px] font-black uppercase tracking-wider text-zinc-500">
                  Список товаров в накладной
                </div>
                <div className="divide-y divide-zinc-800/60 max-h-60 overflow-y-auto">
                  {items.map((i) => (
                    <div
                      key={i.product_id}
                      className="px-4 py-3 flex items-center justify-between text-sm"
                    >
                      <span className="font-bold text-white truncate max-w-xs">
                        {i.name}
                      </span>
                      <span className="font-mono font-bold text-purple-400">
                        {i.quantity} шт
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">
                  Примечание к перемещению
                </Label>
                <Input
                  placeholder="Например: пополнил бар перед ночной сменой..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="h-14 rounded-2xl bg-zinc-900 border-zinc-800 text-base font-bold text-white placeholder:text-zinc-600 focus:border-purple-500/50"
                />
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
              Вернуться к оформлению перемещения
            </Button>
          ) : (
            <div className="flex items-center gap-3 w-full">
              {step > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep((step - 1) as any)}
                  className="h-14 w-14 rounded-2xl bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white transition-all active:scale-95 shrink-0"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              )}

              <Button
                type="button"
                disabled={
                  (step === 1 && (!sourceWarehouseId || !targetWarehouseId || isRouteBlocked)) ||
                  (step === 2 && items.length === 0) ||
                  isPending
                }
                onClick={() => (step < 3 ? setStep((step + 1) as any) : handleFinalize())}
                className={cn(
                  "flex-1 h-14 font-black uppercase italic tracking-wide text-sm rounded-2xl shadow-lg transition-all active:scale-[0.98] disabled:opacity-40",
                  step === 3
                    ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/30"
                    : "bg-purple-600 hover:bg-purple-500 text-white shadow-purple-950/30"
                )}
              >
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Перемещение...
                  </>
                ) : step === 3 ? (
                  <>
                    <CheckCircle2 className="mr-2 h-5 w-5" />
                    Выполнить перемещение ({totalQty} шт)
                  </>
                ) : step === 1 ? (
                  <>
                    Далее: Выбрать товары
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </>
                ) : (
                  <>
                    Далее: Подтвердить ({items.length})
                    <ArrowRight className="ml-2 h-5 w-5" />
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
