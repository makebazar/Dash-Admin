"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Settings, ShieldAlert, Check } from "lucide-react"

interface Category {
  id: number
  name: string
  type: string
}

interface TaxSettingsModalProps {
  clubId: string
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
  categories?: Category[]
}

export function FinanceTaxSettingsModal({
  clubId,
  isOpen,
  onClose,
  onSaved,
  categories = []
}: TaxSettingsModalProps) {
  const [taxRegime, setTaxRegime] = useState("patent_usn6")
  const [customTaxRate, setCustomTaxRate] = useState<number>(6)
  const [patentCost, setPatentCost] = useState<number>(12500)
  const [limitExceeded, setLimitExceeded] = useState<boolean>(false)
  const [usnCategories, setUsnCategories] = useState<number[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isOpen && clubId) {
      loadSettings()
    }
  }, [isOpen, clubId])

  const loadSettings = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/clubs/${clubId}/finance/settings`)
      if (res.ok) {
        const data = await res.json()
        if (data.settings) {
          setTaxRegime(data.settings.tax_regime || "patent_usn6")
          setCustomTaxRate(data.settings.custom_tax_rate || 6)
          setPatentCost(data.settings.patent_cost || 12500)
          setLimitExceeded(Boolean(data.settings.limit_exceeded))
          setUsnCategories(data.settings.usn_categories || [])
        }
      }
    } catch (e) {
      console.error("Failed to load tax settings:", e)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/clubs/${clubId}/finance/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tax_regime: taxRegime,
          custom_tax_rate: customTaxRate,
          patent_cost: patentCost,
          limit_exceeded: limitExceeded,
          usn_categories: usnCategories
        })
      })

      if (res.ok) {
        onSaved()
        onClose()
      } else {
        alert("Ошибка при сохранении налоговых настроек")
      }
    } catch (e) {
      console.error("Failed to save tax settings:", e)
      alert("Ошибка при сохранении")
    } finally {
      setSaving(false)
    }
  }

  const toggleUsnCategory = (id: number) => {
    setUsnCategories(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    )
  }

  const incomeCategories = categories.filter(c => c.type === "income")

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <Settings className="h-5 w-5 text-primary" />
            Настройки системы налогообложения
          </DialogTitle>
          <DialogDescription>
            Настройки сохраняются в базе данных клуба и используются для расчета чистой прибыли.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-slate-500 font-medium animate-pulse">
            Загрузка настроек...
          </div>
        ) : (
          <div className="space-y-6 py-2">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Налоговый режим ИП / Организации</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  { id: "usn6", title: "УСН Доходы (6%)", desc: "Фиксированный % от всей выручки" },
                  { id: "usn15", title: "УСН Доходы-Расходы (15%)", desc: "% от чистой прибыли" },
                  { id: "patent_usn6", title: "Патент + УСН 6%", desc: "Патент на ПК + УСН 6% на бар" },
                  { id: "patent_usn15", title: "Патент + УСН 15%", desc: "Патент на ПК + УСН 15% на бар" },
                ].map((r) => (
                  <div
                    key={r.id}
                    onClick={() => setTaxRegime(r.id)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      taxRegime === r.id
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-slate-200 hover:border-slate-300 bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-slate-900">{r.title}</span>
                      {taxRegime === r.id && <Check className="h-4 w-4 text-primary" />}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{r.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-600">Ставка УСН (%)</Label>
                <Input
                  type="number"
                  value={customTaxRate}
                  onChange={(e) => setCustomTaxRate(parseFloat(e.target.value) || 0)}
                  className="rounded-xl"
                  min={0}
                  max={20}
                />
              </div>

              {(taxRegime === "patent_usn6" || taxRegime === "patent_usn15") && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-600">Стоимость Патента в месяц (₽)</Label>
                  <Input
                    type="number"
                    value={patentCost}
                    onChange={(e) => setPatentCost(parseFloat(e.target.value) || 0)}
                    className="rounded-xl"
                    min={0}
                  />
                </div>
              )}
            </div>

            <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/50 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-amber-600" />
                  <span className="text-sm font-semibold text-amber-900">Порог выручки 20 млн ₽ (НДС 5%)</span>
                </div>
                <Checkbox
                  checked={limitExceeded}
                  onCheckedChange={(c) => setLimitExceeded(Boolean(c))}
                />
              </div>
              <p className="text-xs text-amber-700">
                Включите, если годовая выручка клуба превышает лимит 20 млн ₽ (автоматически добавит 5% НДС в расчет).
              </p>
            </div>

            {(taxRegime === "patent_usn6" || taxRegime === "patent_usn15") && incomeCategories.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs font-medium text-slate-600">Категории доходов, подпадающие под УСН (например, Бар):</Label>
                <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto p-2 border rounded-xl bg-slate-50/50">
                  {incomeCategories.map((cat) => (
                    <label key={cat.id} className="flex items-center gap-2 text-xs cursor-pointer p-1.5 hover:bg-white rounded-lg">
                      <Checkbox
                        checked={usnCategories.includes(cat.id)}
                        onCheckedChange={() => toggleUsnCategory(cat.id)}
                      />
                      <span className="truncate">{cat.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} className="rounded-xl" disabled={saving}>
            Отмена
          </Button>
          <Button onClick={handleSave} className="rounded-xl bg-slate-900 text-white" disabled={saving}>
            {saving ? "Сохранение..." : "Сохранить настройки"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
