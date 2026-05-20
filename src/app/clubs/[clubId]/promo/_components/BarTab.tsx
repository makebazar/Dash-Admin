"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  Search,
  ShoppingCart,
  CheckCircle2,
  XCircle,
  Coins,
  Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface BarTabProps {
  settings: any;
  saveSettings: (settings: any) => Promise<void>;
  products: any[];
  categories: any[];
}

export function BarTab({
  settings,
  saveSettings,
  products,
  categories,
}: BarTabProps) {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<number | "all">(
    "all",
  );

  if (!settings) return null;

  const barItems = settings.bar_items || [];
  const multiplier = Number(settings.bonus_price_multiplier) || 2;

  const handleToggleProduct = (productId: number, currentState: boolean) => {
    let nextItems = [...barItems];
    const index = nextItems.findIndex(
      (bi: any) => String(bi.id) === String(productId),
    );

    if (index >= 0) {
      nextItems[index] = { ...nextItems[index], is_enabled: !currentState };
    } else {
      nextItems.push({ id: productId, is_enabled: !currentState });
    }

    saveSettings({ ...settings, bar_items: nextItems });
  };

  const handleUpdatePrice = (productId: number, price: string) => {
    let nextItems = [...barItems];
    const index = nextItems.findIndex(
      (bi: any) => String(bi.id) === String(productId),
    );
    const numPrice = price === "" ? undefined : parseInt(price);

    if (index >= 0) {
      nextItems[index] = { ...nextItems[index], custom_bonus_price: numPrice };
    } else {
      nextItems.push({
        id: productId,
        is_enabled: false,
        custom_bonus_price: numPrice,
      });
    }

    saveSettings({ ...settings, bar_items: nextItems });
  };

  const filteredProducts = products.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory =
      selectedCategory === "all" || p.category_id === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6 max-w-5xl"
    >
      <div className="bg-white border border-slate-200 p-8 rounded-[2.5rem] shadow-sm space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h3 className="text-xl font-black uppercase italic tracking-tight flex items-center gap-3">
              <ShoppingCart className="w-6 h-6 text-emerald-500" />
              Маркет <span className="text-emerald-500">Товаров</span>
            </h3>
            <p className="text-slate-500 text-sm font-medium mt-1">
              Выберите товары из склада, которые будут доступны к покупке за
              бонусы в приложении гостя.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Поиск товара..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-emerald-500 w-full sm:w-64"
              />
            </div>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <select
                value={selectedCategory}
                onChange={(e) =>
                  setSelectedCategory(
                    e.target.value === "all" ? "all" : parseInt(e.target.value),
                  )
                }
                className="pl-10 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-emerald-500 appearance-none"
              >
                <option value="all">Все категории</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {filteredProducts.length === 0 ? (
            <div className="text-center py-20 border-2 border-dashed border-slate-100 rounded-[2rem] text-slate-300 font-bold uppercase italic text-sm">
              Товары не найдены
            </div>
          ) : (
            filteredProducts.map((product) => {
              const barConfig = barItems.find(
                (bi: any) => String(bi.id) === String(product.id),
              );
              const isEnabled =
                barConfig?.is_enabled === true ||
                String(barConfig?.is_enabled) === "true";
              const customPrice = barConfig?.custom_bonus_price;
              const defaultPrice = Math.round(
                product.selling_price * multiplier,
              );

              return (
                <div
                  key={product.id}
                  className={cn(
                    "p-4 rounded-3xl border transition-all duration-300 flex flex-col md:flex-row md:items-center justify-between gap-4 group",
                    isEnabled
                      ? "bg-emerald-50/30 border-emerald-100"
                      : "bg-white border-slate-100 hover:border-slate-200",
                  )}
                >
                  <div className="flex items-center gap-4 flex-1">
                    <button
                      onClick={() => handleToggleProduct(product.id, isEnabled)}
                      className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center transition-all",
                        isEnabled
                          ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                          : "bg-slate-100 text-slate-300 group-hover:bg-slate-200",
                      )}
                    >
                      {isEnabled ? (
                        <CheckCircle2 className="w-6 h-6" />
                      ) : (
                        <XCircle className="w-6 h-6" />
                      )}
                    </button>
                    <div>
                      <div className="font-black uppercase italic text-sm tracking-tight">
                        {product.name}
                      </div>
                      <div className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-widest flex items-center gap-2">
                        {product.category_name}
                        <span className="w-1 h-1 bg-slate-200 rounded-full" />
                        {product.selling_price} ₽ на кассе
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="space-y-1">
                      <label className="text-[8px] font-black uppercase tracking-widest text-slate-400 ml-2">
                        Стоимость в бонусах
                      </label>
                      <div className="relative">
                        <Coins className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-yellow-500" />
                        <input
                          type="number"
                          placeholder={String(defaultPrice)}
                          value={customPrice ?? ""}
                          onChange={(e) =>
                            handleUpdatePrice(product.id, e.target.value)
                          }
                          className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black outline-none focus:border-emerald-500 w-32"
                        />
                      </div>
                    </div>

                    <div className="hidden md:block w-px h-10 bg-slate-100" />

                    <div className="flex flex-col items-end min-w-20">
                      <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Статус
                      </div>
                      <div
                        className={cn(
                          "text-[10px] font-black uppercase italic mt-1",
                          isEnabled ? "text-emerald-500" : "text-slate-300",
                        )}
                      >
                        {isEnabled ? "Активен" : "Выключен"}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </motion.div>
  );
}
