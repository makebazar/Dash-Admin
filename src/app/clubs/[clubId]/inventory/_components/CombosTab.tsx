"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  Plus,
  Search,
  MoreVertical,
  Pencil,
  Trash2,
  Package,
  RefreshCw,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  deleteCombo,
  importCombosFromSmartShell,
  exportSingleComboToSmartShell,
  exportCombosToSmartShell,
} from "../actions";
import type { ComboView } from "../actions/combos";
import type { Product } from "../types";
import { useUiDialogs } from "./useUiDialogs";
import { cn } from "@/lib/utils";

interface CombosTabProps {
  clubId: string;
  combos: ComboView[];
  products: Product[];
  smartshellEnabled?: boolean;
}

export function CombosTab({
  clubId,
  combos = [],
  products = [],
  smartshellEnabled = false,
}: CombosTabProps) {
  const { confirmAction, showMessage, Dialogs } = useUiDialogs();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState("");

  // Filtered Combos
  const filteredCombos = useMemo(() => {
    return combos.filter((combo) => {
      const matchesSearch =
        !search ||
        combo.name.toLowerCase().includes(search.toLowerCase()) ||
        (combo.barcode && combo.barcode.includes(search)) ||
        combo.items.some((i) =>
          i.product_name.toLowerCase().includes(search.toLowerCase())
        );

      return matchesSearch;
    });
  }, [combos, search]);

  // Delete Combo
  const handleDeleteCombo = (combo: ComboView) => {
    confirmAction({
      title: "Удалить комбо-набор?",
      description: `Вы действительно хотите удалить комбо-набор "${combo.name}"? Это действие необратимо.`,
      confirmText: "Удалить",
    }).then(async (confirmed) => {
      if (confirmed) {
        try {
          await deleteCombo(clubId, combo.id);
          showMessage({ title: "Удалено", description: "Комбо-набор удален" });
        } catch (err: any) {
          showMessage({
            title: "Ошибка",
            description: err.message || "Не удалось удалить комбо-набор",
          });
        }
      }
    });
  };

  // Import Combos from SmartShell
  const handleImportFromSmartShell = () => {
    startTransition(async () => {
      try {
        const res = await importCombosFromSmartShell(clubId);
        showMessage({
          title: "Импорт завершен",
          description: res.message || `Синхронизировано ${res.count} наборов`,
        });
      } catch (err: any) {
        showMessage({
          title: "Ошибка импорта",
          description:
            err.message || "Не удалось импортировать комбо из SmartShell",
        });
      }
    });
  };

  // Export all Combos to SmartShell
  const handleExportToSmartShell = () => {
    startTransition(async () => {
      try {
        const res = await exportCombosToSmartShell(clubId);
        showMessage({
          title: "Выгрузка завершена",
          description: res.message || `Выгружено ${res.count} комбо-наборов`,
        });
      } catch (err: any) {
        showMessage({
          title: "Ошибка выгрузки",
          description:
            err.message || "Не удалось выгрузить комбо-наборы в SmartShell",
        });
      }
    });
  };

  // Export single Combo to SmartShell
  const handleExportSingleCombo = (combo: ComboView) => {
    startTransition(async () => {
      try {
        const res = await exportSingleComboToSmartShell(clubId, combo.id);
        showMessage({
          title: "Успешно выгружено",
          description:
            res.message || `Комбо "${combo.name}" выгружен в SmartShell`,
        });
      } catch (err: any) {
        showMessage({
          title: "Ошибка выгрузки",
          description:
            err.message || `Не удалось выгрузить "${combo.name}" в SmartShell`,
        });
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Controls Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Поиск комбо-наборов или товаров в составе..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-white"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {smartshellEnabled && (
            <>
              <Button
                variant="outline"
                onClick={handleImportFromSmartShell}
                disabled={isPending}
                className="gap-1.5 bg-white"
                title="Загрузить существующие комбо-наборы из SmartShell"
              >
                <RefreshCw className={cn("h-4 w-4", isPending && "animate-spin")} />
                Импорт из SmartShell
              </Button>
              <Button
                variant="outline"
                onClick={handleExportToSmartShell}
                disabled={isPending}
                className="gap-1.5 bg-white"
                title="Выгрузить все локальные комбо-наборы в SmartShell"
              >
                <Upload className={cn("h-4 w-4", isPending && "animate-spin")} />
                Выгрузить в SmartShell
              </Button>
            </>
          )}

          <Link href={`/clubs/${clubId}/inventory/combos/new`}>
            <Button className="gap-1.5 shadow-sm">
              <Plus className="h-4 w-4" />
              Создать комбо-набор
            </Button>
          </Link>
        </div>
      </div>

      {/* Combos Table */}
      <div className="border rounded-xl bg-card overflow-hidden shadow-xs">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="font-semibold">Комбо-набор</TableHead>
              <TableHead className="font-semibold">Состав набора</TableHead>
              <TableHead className="text-right font-semibold">Себестоимость</TableHead>
              <TableHead className="text-right font-semibold">Цена продажи</TableHead>
              <TableHead className="text-right font-semibold">Маржа</TableHead>
              <TableHead className="text-center font-semibold">Доступно на Баре</TableHead>
              <TableHead className="text-center font-semibold">SmartShell</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCombos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-40 text-center text-muted-foreground">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div>Комбо-наборы не найдены</div>
                    <Link href={`/clubs/${clubId}/inventory/combos/new`}>
                      <Button variant="outline" size="sm" className="mt-2 gap-1.5 bg-white">
                        <Plus className="h-3.5 w-3.5" />
                        Создать первый комбо-набор
                      </Button>
                    </Link>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredCombos.map((combo) => (
                <TableRow key={combo.id} className="hover:bg-muted/40 transition-colors">
                  {/* Name & Barcode */}
                  <TableCell className="font-medium">
                    <Link
                      href={`/clubs/${clubId}/inventory/combos/${combo.id}`}
                      className="group flex flex-col hover:opacity-80 transition-opacity"
                    >
                      <span className="font-semibold text-foreground text-sm group-hover:text-primary transition-colors">
                        {combo.name}
                      </span>
                      {combo.barcode && (
                        <span className="text-xs text-muted-foreground font-mono">
                          {combo.barcode}
                        </span>
                      )}
                    </Link>
                  </TableCell>

                  {/* Included Items */}
                  <TableCell>
                    <div className="flex flex-wrap gap-1.5 max-w-md">
                      {combo.items.map((item) => (
                        <Badge
                          key={item.id}
                          variant="secondary"
                          className="bg-muted/70 hover:bg-muted font-normal text-xs py-0.5 px-2"
                        >
                          <span className="font-semibold text-primary mr-1">
                            {item.quantity}×
                          </span>
                          {item.product_name}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>

                  {/* Cost Price */}
                  <TableCell className="text-right text-muted-foreground font-mono text-sm">
                    {combo.total_cost_price.toLocaleString("ru-RU")} ₽
                  </TableCell>

                  {/* Selling Price */}
                  <TableCell className="text-right font-bold text-foreground font-mono text-sm">
                    {combo.price.toLocaleString("ru-RU")} ₽
                  </TableCell>

                  {/* Margin */}
                  <TableCell className="text-right">
                    <div className="flex flex-col items-end">
                      <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        +{combo.margin_rub.toLocaleString("ru-RU")} ₽
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {combo.margin_percent}%
                      </span>
                    </div>
                  </TableCell>

                  {/* Available Quantity */}
                  <TableCell className="text-center">
                    {combo.available_qty > 0 ? (
                      <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/20">
                        {combo.available_qty} шт
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-rose-500 border-rose-200 dark:border-rose-900 bg-rose-500/5">
                        0 шт (нет товаров)
                      </Badge>
                    )}
                  </TableCell>

                  {/* SmartShell Status */}
                  <TableCell className="text-center">
                    {combo.smartshell_combo_id ? (
                      <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-800 text-[11px]">
                        ID #{combo.smartshell_combo_id}
                      </Badge>
                    ) : smartshellEnabled ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleExportSingleCombo(combo)}
                        disabled={isPending}
                        className="h-6 text-[11px] text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/30 px-2 py-0"
                        title="Выгрузить этот комбо в SmartShell"
                      >
                        <Upload className="h-3 w-3 mr-1" />
                        Выгрузить
                      </Button>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground border-dashed text-[11px]">
                        Локально
                      </Badge>
                    )}
                  </TableCell>

                  {/* Actions Dropdown */}
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <Link href={`/clubs/${clubId}/inventory/combos/${combo.id}`}>
                          <DropdownMenuItem className="gap-2 cursor-pointer">
                            <Pencil className="h-4 w-4 text-muted-foreground" />
                            Редактировать
                          </DropdownMenuItem>
                        </Link>
                        {smartshellEnabled && (
                          <DropdownMenuItem
                            onClick={() => handleExportSingleCombo(combo)}
                            disabled={isPending}
                            className="gap-2 text-blue-600 focus:text-blue-600 cursor-pointer"
                          >
                            <Upload className="h-4 w-4" />
                            {combo.smartshell_combo_id ? "Обновить в SmartShell" : "Выгрузить в SmartShell"}
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleDeleteCombo(combo)}
                          className="gap-2 text-rose-600 focus:text-rose-600 cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                          Удалить
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {Dialogs}
    </div>
  );
}
