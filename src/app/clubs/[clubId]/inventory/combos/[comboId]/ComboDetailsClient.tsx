"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  PageShell,
  PageHeader,
  PageToolbar,
  ToolbarGroup,
} from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  ArrowLeft,
  Save,
  Trash2,
  Plus,
  Minus,
  Search,
  Package,
  Layers,
  Sparkles,
  ShoppingBag,
  TrendingUp,
  Upload,
  Check,
  AlertCircle,
  Barcode,
  Store,
  X,
} from "lucide-react";
import {
  createCombo,
  updateCombo,
  deleteCombo,
  exportSingleComboToSmartShell,
} from "../../actions";
import type { ComboView, ComboItemInput } from "../../actions/combos";
import type { Product, Category } from "../../types";
import { useUiDialogs } from "../../_components/useUiDialogs";
import { cn } from "@/lib/utils";

interface ComboDetailsClientProps {
  clubId: string;
  userId: string;
  initialCombo: ComboView | null;
  isNew: boolean;
  products: Product[];
  categories: Category[];
  smartshellEnabled: boolean;
}

export function ComboDetailsClient({
  clubId,
  userId,
  initialCombo,
  isNew,
  products = [],
  categories = [],
  smartshellEnabled = false,
}: ComboDetailsClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { confirmAction, showMessage, Dialogs } = useUiDialogs();

  // Form State
  const [name, setName] = useState(initialCombo?.name || "");
  const [barcode, setBarcode] = useState(initialCombo?.barcode || "");
  const [price, setPrice] = useState(
    initialCombo ? String(initialCombo.price) : ""
  );
  const [isActive, setIsActive] = useState(
    initialCombo ? initialCombo.is_active : true
  );
  const [syncWithSmartShell, setSyncWithSmartShell] = useState(
    initialCombo ? Boolean(initialCombo.smartshell_combo_id) : smartshellEnabled
  );
  const [smartshellComboId, setSmartshellComboId] = useState<number | null>(
    initialCombo?.smartshell_combo_id ?? null
  );

  // Selected Combo Items: Map of productId -> quantity
  const [items, setItems] = useState<ComboItemInput[]>(
    initialCombo
      ? initialCombo.items.map((i) => ({
          product_id: i.product_id,
          quantity: i.quantity,
          allocated_price: i.product_selling_price,
        }))
      : []
  );

  // Catalog Search & Filter State
  const [search, setSearch] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("all");

  // Product Lookup Maps
  const productMap = useMemo(() => {
    const map = new Map<number, Product>();
    for (const p of products) map.set(p.id, p);
    return map;
  }, [products]);

  const activeProducts = useMemo(() => {
    return products.filter((p) => p.is_active !== false && !p.deleted_at);
  }, [products]);

  // Filtered Catalog
  const filteredCatalog = useMemo(() => {
    return activeProducts.filter((prod) => {
      if (
        selectedCategoryId !== "all" &&
        String(prod.category_id) !== selectedCategoryId
      ) {
        return false;
      }
      if (!search.trim()) return true;

      const q = search.trim().toLowerCase();
      const matchName = prod.name.toLowerCase().includes(q);
      const matchBarcode =
        (prod.barcode && prod.barcode.toLowerCase().includes(q)) ||
        (Array.isArray(prod.barcodes) &&
          prod.barcodes.some((b) => b.toLowerCase().includes(q)));

      return matchName || matchBarcode;
    });
  }, [activeProducts, search, selectedCategoryId]);

  // Helper map for currently selected items: productId -> quantity
  const selectedQtyMap = useMemo(() => {
    const map = new Map<number, number>();
    for (const item of items) {
      map.set(item.product_id, item.quantity);
    }
    return map;
  }, [items]);

  // Add or increment item
  const handleAddItem = (productId: number) => {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.product_id === productId);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
        return next;
      }
      const prod = productMap.get(productId);
      return [
        ...prev,
        {
          product_id: productId,
          quantity: 1,
          allocated_price: prod ? Number(prod.selling_price || 0) : undefined,
        },
      ];
    });
  };

  // Decrement item
  const handleDecrementItem = (productId: number) => {
    setItems((prev) => {
      return prev
        .map((i) => {
          if (i.product_id === productId) {
            const nextQty = i.quantity - 1;
            return nextQty > 0 ? { ...i, quantity: nextQty } : null;
          }
          return i;
        })
        .filter(Boolean) as ComboItemInput[];
    });
  };

  // Set direct quantity
  const handleSetQuantity = (productId: number, qty: number) => {
    const validQty = Math.max(0, Math.floor(qty));
    setItems((prev) => {
      if (validQty === 0) {
        return prev.filter((i) => i.product_id !== productId);
      }
      const idx = prev.findIndex((i) => i.product_id === productId);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: validQty };
        return next;
      }
      return [...prev, { product_id: productId, quantity: validQty }];
    });
  };

  // Remove item completely
  const handleRemoveItem = (productId: number) => {
    setItems((prev) => prev.filter((i) => i.product_id !== productId));
  };

  // Financial Calculations
  const calculations = useMemo(() => {
    let totalCost = 0;
    let totalRetail = 0;
    let minAvailableStock = items.length > 0 ? Infinity : 0;

    for (const item of items) {
      const prod = productMap.get(item.product_id);
      if (prod) {
        const cost = Number(prod.cost_price || 0);
        const retail = Number(prod.selling_price || 0);
        const stock = Number(prod.current_stock || 0);

        totalCost += cost * item.quantity;
        totalRetail += retail * item.quantity;

        if (item.quantity > 0) {
          const possibleSets = Math.floor(stock / item.quantity);
          if (possibleSets < minAvailableStock) {
            minAvailableStock = possibleSets;
          }
        }
      }
    }

    if (minAvailableStock === Infinity) minAvailableStock = 0;

    const setPrice = parseFloat(price) || 0;
    const marginRub = setPrice - totalCost;
    const marginPercent = setPrice > 0 ? (marginRub / setPrice) * 100 : 0;
    const discountRub = totalRetail > setPrice ? totalRetail - setPrice : 0;
    const discountPercent =
      totalRetail > 0 ? (discountRub / totalRetail) * 100 : 0;

    return {
      totalCost: Math.round(totalCost * 100) / 100,
      totalRetail: Math.round(totalRetail * 100) / 100,
      marginRub: Math.round(marginRub * 100) / 100,
      marginPercent: Math.round(marginPercent * 10) / 10,
      discountRub: Math.round(discountRub * 100) / 100,
      discountPercent: Math.round(discountPercent * 10) / 10,
      availableStock: Math.max(0, minAvailableStock),
    };
  }, [items, price, productMap]);

  // Save Combo Action
  const handleSave = () => {
    if (!name.trim()) {
      showMessage({ title: "Ошибка", description: "Введите название комбо-набора" });
      return;
    }
    const numPrice = parseFloat(price);
    if (isNaN(numPrice) || numPrice < 0) {
      showMessage({
        title: "Ошибка",
        description: "Введите корректную цену комбо-набора",
      });
      return;
    }
    if (items.length === 0) {
      showMessage({
        title: "Ошибка",
        description: "Добавьте хотя бы один товар в состав комбо-набора",
      });
      return;
    }

    const totalUnits = items.reduce((sum, it) => sum + it.quantity, 0);
    if (syncWithSmartShell && totalUnits < 2) {
      showMessage({
        title: "Внимание",
        description:
          "SmartShell требует, чтобы в комбо-наборе было минимум 2 товара (например, 2 сникерса или сникерс + напиток). Увеличьте количество или добавьте второй товар.",
      });
      return;
    }

    startTransition(async () => {
      try {
        if (isNew) {
          const res = await createCombo(
            clubId,
            {
              name: name.trim(),
              barcode: barcode.trim() || undefined,
              price: numPrice,
              items,
            },
            syncWithSmartShell
          );
          showMessage({
            title: "Успешно",
            description: "Комбо-набор успешно создан!",
          });
          router.push(`/clubs/${clubId}/inventory?tab=combos`);
          router.refresh();
        } else if (initialCombo) {
          const res = await updateCombo(
            clubId,
            initialCombo.id,
            {
              name: name.trim(),
              barcode: barcode.trim() || undefined,
              price: numPrice,
              is_active: isActive,
              items,
            },
            syncWithSmartShell
          );
          if (res?.smartshell_combo_id) {
            setSmartshellComboId(res.smartshell_combo_id);
          }
          showMessage({
            title: "Успешно",
            description: "Комбо-набор успешно обновлен!",
          });
          router.refresh();
        }
      } catch (err: any) {
        showMessage({
          title: "Ошибка сохранения",
          description: err.message || "Не удалось сохранить комбо-набор",
        });
      }
    });
  };

  // Delete Combo Action
  const handleDelete = () => {
    if (!initialCombo) return;
    confirmAction({
      title: "Удалить комбо-набор?",
      description: `Вы уверены, что хотите удалить комбо-набор "${initialCombo.name}"? Это действие необратимо.`,
      confirmText: "Удалить",
    }).then(async (confirmed) => {
      if (confirmed) {
        startTransition(async () => {
          try {
            await deleteCombo(clubId, initialCombo.id);
            showMessage({
              title: "Удалено",
              description: "Комбо-набор успешно удален",
            });
            router.push(`/clubs/${clubId}/inventory?tab=combos`);
            router.refresh();
          } catch (err: any) {
            showMessage({
              title: "Ошибка",
              description: err.message || "Не удалось удалить комбо-набор",
            });
          }
        });
      }
    });
  };

  // Export / Sync to SmartShell Action
  const handleExportToSmartShell = () => {
    if (!initialCombo) return;
    startTransition(async () => {
      try {
        const res = await exportSingleComboToSmartShell(clubId, initialCombo.id);
        if (res?.smartshell_combo_id) {
          setSmartshellComboId(res.smartshell_combo_id);
        }
        showMessage({
          title: "SmartShell",
          description: res.message || "Комбо-набор выгружен в SmartShell",
        });
        router.refresh();
      } catch (err: any) {
        showMessage({
          title: "Ошибка выгрузки",
          description: err.message || "Не удалось выгрузить комбо в SmartShell",
        });
      }
    });
  };

  return (
    <PageShell>
      <PageHeader
        title={isNew ? "Новый комбо-набор" : name || "Редактирование комбо"}
        description="Формирование и управление наборами товаров со специальной ценой для гостей клуба."
      >
        {!isNew && smartshellComboId && (
          <Badge
            variant="outline"
            className="bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-800 text-xs px-2.5 py-1"
          >
            SmartShell ID #{smartshellComboId}
          </Badge>
        )}
      </PageHeader>

      <PageToolbar>
        <ToolbarGroup>
          <Link href={`/clubs/${clubId}/inventory?tab=combos`}>
            <Button variant="outline" className="gap-2 bg-white">
              <ArrowLeft className="h-4 w-4" />К списку комбо
            </Button>
          </Link>
        </ToolbarGroup>

        <ToolbarGroup>
          {!isNew && smartshellEnabled && (
            <Button
              variant="outline"
              onClick={handleExportToSmartShell}
              disabled={isPending}
              className="gap-2 bg-white text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-200 dark:border-blue-900"
            >
              <Upload className={cn("h-4 w-4", isPending && "animate-spin")} />
              {smartshellComboId ? "Обновить в SmartShell" : "Выгрузить в SmartShell"}
            </Button>
          )}

          {!isNew && (
            <Button
              variant="outline"
              onClick={handleDelete}
              disabled={isPending}
              className="gap-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200"
            >
              <Trash2 className="h-4 w-4" />
              Удалить
            </Button>
          )}

          <Button
            onClick={handleSave}
            disabled={isPending}
            className="gap-2 shadow-xs"
          >
            <Save className="h-4 w-4" />
            {isPending ? "Сохранение..." : isNew ? "Создать комбо-набор" : "Сохранить изменения"}
          </Button>
        </ToolbarGroup>
      </PageToolbar>

      {/* Main Form Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Basic Parameters & Margin Calculation (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Main Info Card */}
          <div className="border rounded-2xl p-5 bg-card shadow-2xs space-y-4">
            <h3 className="font-semibold text-base flex items-center gap-2 text-foreground">
              <Package className="h-4 w-4 text-primary" />
              Параметры комбо-набора
            </h3>

            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="combo-name" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Название набора *
              </Label>
              <Input
                id="combo-name"
                placeholder="Например: Сет Энергия (Adrenaline + Чипсы)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-background text-base font-medium"
              />
            </div>

            {/* Price & Barcode */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="combo-price" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Цена продажи (₽) *
                </Label>
                <div className="relative">
                  <Input
                    id="combo-price"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="0"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="bg-background font-mono text-base font-bold pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-sm">
                    ₽
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="combo-barcode" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Штрихкод набора
                </Label>
                <div className="relative">
                  <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="combo-barcode"
                    placeholder="4600000000000"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    className="pl-9 font-mono text-sm bg-background"
                  />
                </div>
              </div>
            </div>

            {/* Active Switch (for Edit) */}
            {!isNew && (
              <div className="flex items-center justify-between border rounded-xl p-3 bg-muted/30">
                <div className="space-y-0.5">
                  <Label htmlFor="combo-active" className="text-sm font-medium text-foreground cursor-pointer">
                    Активен для продажи
                  </Label>
                  <div className="text-xs text-muted-foreground">
                    Если выключено, набор скрывается в кассе и на витрине
                  </div>
                </div>
                <Switch
                  id="combo-active"
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
              </div>
            )}

            {/* SmartShell Sync Toggle */}
            {smartshellEnabled && (
              <div className="flex items-center justify-between border rounded-xl p-3.5 bg-blue-500/5 border-blue-200 dark:border-blue-900/50">
                <div className="space-y-0.5 pr-2">
                  <div className="flex items-center gap-1.5">
                    <Store className="h-4 w-4 text-blue-600" />
                    <Label htmlFor="sync-ss" className="text-sm font-medium text-foreground cursor-pointer">
                      {isNew ? "Создать в SmartShell" : "Синхронизировать со SmartShell"}
                    </Label>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {isNew
                      ? "Автоматически экспортирует набор в магазин SmartShell для гостей"
                      : "Обновит состав, название и цену набора в магазине SmartShell"}
                  </div>
                </div>
                <Switch
                  id="sync-ss"
                  checked={syncWithSmartShell}
                  onCheckedChange={setSyncWithSmartShell}
                />
              </div>
            )}
          </div>

          {/* Financial & Economy Card */}
          <div className="border rounded-2xl p-5 bg-card shadow-2xs space-y-4">
            <h3 className="font-semibold text-base flex items-center gap-2 text-foreground">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
              Экономика и выгода набора
            </h3>

            {items.length === 0 ? (
              <div className="text-center py-6 text-sm text-muted-foreground border border-dashed rounded-xl bg-muted/20">
                Добавьте товары из каталога справа, чтобы рассчитать экономику
              </div>
            ) : (
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center text-muted-foreground">
                  <span>Розничная сумма товаров:</span>
                  <span className="font-mono font-medium text-foreground">
                    {calculations.totalRetail.toLocaleString("ru-RU")} ₽
                  </span>
                </div>

                <div className="flex justify-between items-center text-muted-foreground">
                  <span>Себестоимость компонентов:</span>
                  <span className="font-mono font-medium text-foreground">
                    {calculations.totalCost.toLocaleString("ru-RU")} ₽
                  </span>
                </div>

                {calculations.discountRub > 0 ? (
                  <div className="flex justify-between items-center p-2.5 rounded-xl bg-amber-500/10 border border-amber-200 dark:border-amber-900/40 text-amber-700 dark:text-amber-400 font-medium">
                    <span className="flex items-center gap-1.5 text-xs sm:text-sm">
                      <Sparkles className="h-4 w-4" />
                      Выгода для гостя (скидка):
                    </span>
                    <span className="font-mono font-bold">
                      -{calculations.discountRub.toLocaleString("ru-RU")} ₽ ({calculations.discountPercent}%)
                    </span>
                  </div>
                ) : (
                  <div className="flex justify-between items-center text-xs text-muted-foreground p-2 rounded-lg bg-muted/40">
                    <span>Наценка на набор относительно розницы:</span>
                    <span className="font-mono">
                      +{(parseFloat(price || "0") - calculations.totalRetail).toLocaleString("ru-RU")} ₽
                    </span>
                  </div>
                )}

                <div className="border-t pt-3 flex justify-between items-center">
                  <div className="flex flex-col">
                    <span className="font-semibold text-foreground">
                      Маржинальная прибыль:
                    </span>
                    <span className="text-xs text-muted-foreground">
                      С продажи 1 набора
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400">
                      +{calculations.marginRub.toLocaleString("ru-RU")} ₽
                    </span>
                    <div className="text-xs font-medium text-emerald-600/80">
                      Маржа: {calculations.marginPercent}%
                    </div>
                  </div>
                </div>

                <div className="border-t pt-3 flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">
                    Доступно для сборки на складе:
                  </span>
                  <Badge
                    variant={calculations.availableStock > 0 ? "secondary" : "outline"}
                    className={cn(
                      "font-mono font-bold",
                      calculations.availableStock > 0
                        ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                        : "text-rose-500 border-rose-200"
                    )}
                  >
                    {calculations.availableStock} шт
                  </Badge>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Selected Items Composition & Catalog Browser (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Selected Items Composition Card */}
          <div className="border rounded-2xl p-5 bg-card shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-base flex items-center gap-2 text-foreground">
                  <ShoppingBag className="h-4 w-4 text-primary" />
                  Состав набора ({items.length})
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Товары, которые будут списываться со склада при продаже комбо
                </p>
              </div>

              {items.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setItems([])}
                  className="h-8 text-xs text-muted-foreground hover:text-rose-600"
                >
                  Очистить состав
                </Button>
              )}
            </div>

            {items.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed rounded-xl bg-muted/10 space-y-2">
                <ShoppingBag className="h-8 w-8 mx-auto text-muted-foreground/50" />
                <div className="font-medium text-sm text-foreground">
                  Состав набора пока пуст
                </div>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Выберите товары из каталога ниже, нажимая кнопку «+» на нужных позициях.
                </p>
              </div>
            ) : (
              <div className="border rounded-xl overflow-hidden divide-y bg-background">
                {items.map((item) => {
                  const prod = productMap.get(item.product_id);
                  const cost = Number(prod?.cost_price || 0);
                  const retail = Number(prod?.selling_price || 0);
                  const lineRetailTotal = retail * item.quantity;
                  const lineCostTotal = cost * item.quantity;

                  return (
                    <div
                      key={item.product_id}
                      className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm text-foreground truncate">
                          {prod?.name || `Товар #${item.product_id}`}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          {prod?.barcode && (
                            <span className="font-mono">{prod.barcode}</span>
                          )}
                          <span>·</span>
                          <span>Розн.: {retail} ₽</span>
                          <span>·</span>
                          <span>Себест.: {cost} ₽</span>
                        </div>
                      </div>

                      {/* Controls & Subtotal */}
                      <div className="flex items-center gap-3 self-end sm:self-center">
                        {/* Quantity Stepper */}
                        <div className="flex items-center border rounded-lg overflow-hidden bg-background shadow-2xs">
                          <button
                            type="button"
                            onClick={() => handleDecrementItem(item.product_id)}
                            className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            title="Уменьшить"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) =>
                              handleSetQuantity(
                                item.product_id,
                                parseInt(e.target.value, 10) || 0
                              )
                            }
                            className="w-11 text-center text-xs font-mono font-bold focus:outline-hidden py-1 border-x bg-transparent"
                          />
                          <button
                            type="button"
                            onClick={() => handleAddItem(item.product_id)}
                            className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            title="Увеличить"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        {/* Line Total */}
                        <div className="text-right min-w-[70px]">
                          <div className="font-mono font-bold text-xs sm:text-sm text-foreground">
                            {lineRetailTotal} ₽
                          </div>
                          <div className="text-[10px] text-muted-foreground font-mono">
                            себест. {lineCostTotal} ₽
                          </div>
                        </div>

                        {/* Remove */}
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.product_id)}
                          className="p-1.5 text-muted-foreground hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                          title="Удалить из набора"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Product Catalog Browser with Search & Quick '+' Add */}
          <div className="border rounded-2xl p-5 bg-card shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-base flex items-center gap-2 text-foreground">
                  <Layers className="h-4 w-4 text-primary" />
                  Каталог товаров
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Нажмите «+» на товаре или кликните по строке, чтобы добавить в комбо
                </p>
              </div>

              {/* Category Filter */}
              {categories.length > 0 && (
                <select
                  value={selectedCategoryId}
                  onChange={(e) => setSelectedCategoryId(e.target.value)}
                  className="h-8 rounded-lg border bg-background px-2.5 text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring"
                >
                  <option value="all">Все категории</option>
                  {categories.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Поиск по названию или штрихкоду..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-background"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Products List */}
            <div className="border rounded-xl overflow-hidden divide-y max-h-[420px] overflow-y-auto bg-background">
              {filteredCatalog.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  Товары не найдены
                </div>
              ) : (
                filteredCatalog.map((prod) => {
                  const qtyInCombo = selectedQtyMap.get(prod.id) || 0;
                  const isSelected = qtyInCombo > 0;
                  const stock = Number(prod.current_stock || 0);

                  return (
                    <div
                      key={prod.id}
                      onClick={() => handleAddItem(prod.id)}
                      className={cn(
                        "p-3 flex items-center justify-between gap-3 cursor-pointer transition-colors select-none",
                        isSelected
                          ? "bg-primary/5 hover:bg-primary/10"
                          : "hover:bg-muted/40"
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-foreground truncate">
                            {prod.name}
                          </span>
                          {isSelected && (
                            <Badge className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0 h-4 font-mono font-bold">
                              {qtyInCombo} в наборе
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          {prod.barcode && (
                            <span className="font-mono text-[11px]">
                              {prod.barcode}
                            </span>
                          )}
                          <span>·</span>
                          <span className="font-medium text-foreground">
                            {prod.selling_price} ₽
                          </span>
                          <span>·</span>
                          <span>Себест.: {prod.cost_price || 0} ₽</span>
                          <span>·</span>
                          <span
                            className={cn(
                              "font-medium",
                              stock > 0 ? "text-emerald-600" : "text-rose-500"
                            )}
                          >
                            Остаток: {stock} шт
                          </span>
                        </div>
                      </div>

                      {/* Add '+' Button */}
                      <Button
                        type="button"
                        size="sm"
                        variant={isSelected ? "default" : "outline"}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddItem(prod.id);
                        }}
                        className={cn(
                          "h-8 px-2.5 gap-1 shrink-0 font-medium shadow-2xs",
                          isSelected
                            ? "bg-primary text-primary-foreground hover:bg-primary/90"
                            : "hover:bg-primary hover:text-primary-foreground"
                        )}
                        title="Добавить позицию в комбо"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span className="text-xs">
                          {isSelected ? "Еще" : "Добавить"}
                        </span>
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {Dialogs}
    </PageShell>
  );
}
