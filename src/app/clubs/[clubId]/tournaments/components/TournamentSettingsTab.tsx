"use client";

import React from "react";

const useState = React.useState;
const useEffect = React.useEffect;
const useMemo = React.useMemo;
import {
  X,
  Loader2,
  Package,
  Gamepad2,
  Plus,
  Edit2,
  Trash2,
  Search,
  Check,
  Download,
  Clock,
  Sparkles,
  Layers,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { TournamentDiscipline, TournamentPackage, formatTypeLabel } from "../types";

interface TournamentSettingsTabProps {
  clubId: string;
}

const COMMON_FORMATS = [
  { id: "1vs1", label: "1 vs 1" },
  { id: "2vs2", label: "2 vs 2" },
  { id: "3vs3", label: "3 vs 3" },
  { id: "5vs5", label: "5 vs 5" },
  { id: "mix_2vs2", label: "Mix 2 vs 2" },
  { id: "mix_5vs5", label: "Mix 5 vs 5" },
];

export function TournamentSettingsTab({ clubId }: TournamentSettingsTabProps) {
  // Sub-tabs switcher: disciplines vs packages
  const [settingsSubTab, setSettingsSubTab] = useState<"disciplines" | "packages">("disciplines");

  // Disciplines state
  const [disciplines, setDisciplines] = useState<TournamentDiscipline[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "system" | "custom">("all");

  // Modal states for disciplines
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingDiscipline, setEditingDiscipline] = useState<TournamentDiscipline | null>(null);

  // Form states for disciplines
  const [formName, setFormName] = useState("");
  const [formKey, setFormKey] = useState("");
  const [formBadge, setFormBadge] = useState("Ручной ввод");
  const [formFormats, setFormFormats] = useState<string[]>(["1vs1", "2vs2"]);
  const [formDescription, setFormDescription] = useState("");
  const [customFormatInput, setCustomFormatInput] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Packages state
  const [packages, setPackages] = useState<TournamentPackage[]>([]);
  const [packagesLoading, setPackagesLoading] = useState(false);
  const [smartshellTariffs, setSmartshellTariffs] = useState<Array<{ id: number; title: string; duration?: number; is_active?: boolean; description?: string }>>([]);
  const [packageSearch, setPackageSearch] = useState("");
  const [packageFilter, setPackageFilter] = useState<"all" | "active" | "inactive">("all");

  // Modal state for package create / edit
  const [isPackageModalOpen, setIsPackageModalOpen] = useState(false);
  const [isPackageSubmitting, setIsPackageSubmitting] = useState(false);
  const [editingPackage, setEditingPackage] = useState<TournamentPackage | null>(null);
  const [pkgName, setPkgName] = useState("");
  const [pkgPrice, setPkgPrice] = useState("400");
  const [pkgDuration, setPkgDuration] = useState("3 часа");
  const [pkgDescription, setPkgDescription] = useState("");
  const [pkgIsActive, setPkgIsActive] = useState(true);
  const [packageErrorMessage, setPackageErrorMessage] = useState<string | null>(null);

  // Modal state for SmartShell import
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedTariffIds, setSelectedTariffIds] = useState<number[]>([]);

  const fetchDisciplines = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/clubs/${clubId}/tournaments?action=disciplines`);
      if (res.ok) {
        const data = await res.json();
        setDisciplines(data.disciplines || []);
      }
    } catch (e) {
      console.error("Failed to load disciplines:", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchPackages = async () => {
    try {
      setPackagesLoading(true);
      const res = await fetch(`/api/clubs/${clubId}/tournaments?action=packages`);
      if (res.ok) {
        const data = await res.json();
        setPackages(data.packages || []);
        setSmartshellTariffs(data.smartshellTariffs || []);
      }
    } catch (e) {
      console.error("Failed to load packages:", e);
    } finally {
      setPackagesLoading(false);
    }
  };

  useEffect(() => {
    fetchDisciplines();
    fetchPackages();
  }, [clubId]);

  const handleOpenCreate = () => {
    setEditingDiscipline(null);
    setFormName("");
    setFormKey("");
    setFormBadge("Ручной ввод");
    setFormFormats(["1vs1", "2vs2"]);
    setFormDescription("");
    setCustomFormatInput("");
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (d: TournamentDiscipline) => {
    setEditingDiscipline(d);
    setFormName(d.name || "");
    setFormKey(d.key || "");
    setFormBadge(d.badge || "Ручной ввод");
    setFormFormats(
      Array.isArray(d.formats) && d.formats.length > 0 ? d.formats : ["1vs1", "2vs2"]
    );
    setFormDescription(d.description || "");
    setCustomFormatInput("");
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const handleToggleFormat = (fmtId: string) => {
    setFormFormats((prev) =>
      prev.includes(fmtId) ? prev.filter((f) => f !== fmtId) : [...prev, fmtId]
    );
  };

  const handleAddCustomFormat = () => {
    const trimmed = customFormatInput.trim().toLowerCase().replace(/\s+/g, "_");
    if (!trimmed) return;
    if (!formFormats.includes(trimmed)) {
      setFormFormats([...formFormats, trimmed]);
    }
    setCustomFormatInput("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setErrorMessage("Введите название дисциплины");
      return;
    }
    if (!editingDiscipline && !formKey.trim()) {
      setErrorMessage("Укажите уникальный код дисциплины");
      return;
    }
    if (formFormats.length === 0) {
      setErrorMessage("Выберите хотя бы один формат участия");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/clubs/${clubId}/tournaments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_discipline",
          id: editingDiscipline?.id,
          key: formKey.trim().toLowerCase(),
          name: formName.trim(),
          badge: formBadge.trim(),
          formats: formFormats,
          description: formDescription.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || "Ошибка сохранения дисциплины");
        return;
      }

      setIsModalOpen(false);
      await fetchDisciplines();
    } catch (err: any) {
      console.error(err);
      setErrorMessage("Ошибка сети при сохранении");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (d: TournamentDiscipline) => {
    if (d.is_system || d.key === "cs2" || d.key === "dota2") {
      alert("Системную дисциплину (CS2 или Dota 2) удалить нельзя.");
      return;
    }

    if (
      !confirm(
        `Вы уверены, что хотите удалить дисциплину "${d.name}"? Это действие необратимо.`
      )
    ) {
      return;
    }

    try {
      const res = await fetch(`/api/clubs/${clubId}/tournaments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete_discipline",
          id: d.id,
        }),
      });

      if (res.ok) {
        await fetchDisciplines();
      } else {
        const data = await res.json();
        alert(data.error || "Не удалось удалить дисциплину");
      }
    } catch (err) {
      console.error(err);
      alert("Ошибка сети при удалении дисциплины");
    }
  };

  // Package handlers
  const handleOpenCreatePackage = () => {
    setEditingPackage(null);
    setPkgName("");
    setPkgPrice("400");
    setPkgDuration("3 часа");
    setPkgDescription("");
    setPkgIsActive(true);
    setPackageErrorMessage(null);
    setIsPackageModalOpen(true);
  };

  const handleOpenEditPackage = (pkg: TournamentPackage) => {
    setEditingPackage(pkg);
    setPkgName(pkg.name);
    setPkgPrice(String(pkg.price));
    setPkgDuration(pkg.duration || "");
    setPkgDescription(pkg.description || "");
    setPkgIsActive(pkg.is_active);
    setPackageErrorMessage(null);
    setIsPackageModalOpen(true);
  };

  const handleTogglePackageActive = async (pkg: TournamentPackage) => {
    try {
      const res = await fetch(`/api/clubs/${clubId}/tournaments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_package",
          id: pkg.id,
          name: pkg.name,
          price: pkg.price,
          duration: pkg.duration,
          description: pkg.description,
          is_active: !pkg.is_active,
          smartshell_tariff_id: pkg.smartshell_tariff_id,
        }),
      });
      if (res.ok) {
        await fetchPackages();
      }
    } catch (e) {
      console.error("Failed to toggle package active:", e);
    }
  };

  const handleDeletePackage = async (pkg: TournamentPackage) => {
    if (!confirm(`Вы уверены, что хотите удалить пакет "${pkg.name}"?`)) return;
    try {
      const res = await fetch(`/api/clubs/${clubId}/tournaments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete_package",
          id: pkg.id,
        }),
      });
      if (res.ok) {
        await fetchPackages();
      }
    } catch (e) {
      console.error("Failed to delete package:", e);
    }
  };

  const handleSubmitPackage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pkgName.trim()) {
      setPackageErrorMessage("Укажите название пакета");
      return;
    }
    const numPrice = parseFloat(pkgPrice);
    if (isNaN(numPrice) || numPrice < 0) {
      setPackageErrorMessage("Укажите корректную стоимость");
      return;
    }

    setIsPackageSubmitting(true);
    setPackageErrorMessage(null);
    try {
      const res = await fetch(`/api/clubs/${clubId}/tournaments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_package",
          id: editingPackage?.id,
          name: pkgName.trim(),
          price: numPrice,
          duration: pkgDuration.trim() || undefined,
          description: pkgDescription.trim() || undefined,
          is_active: pkgIsActive,
          smartshell_tariff_id: editingPackage?.smartshell_tariff_id,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPackageErrorMessage(data.error || "Ошибка сохранения пакета");
        return;
      }
      setIsPackageModalOpen(false);
      await fetchPackages();
    } catch (err) {
      setPackageErrorMessage("Ошибка сети при сохранении пакета");
    } finally {
      setIsPackageSubmitting(false);
    }
  };

  const handleOpenImportModal = () => {
    setSelectedTariffIds(smartshellTariffs.map((t) => t.id));
    setIsImportModalOpen(true);
  };

  const handleImportSmartshell = async () => {
    if (selectedTariffIds.length === 0) {
      alert("Выберите хотя бы один тариф для импорта");
      return;
    }
    const tariffsToImport = smartshellTariffs
      .filter((t) => selectedTariffIds.includes(t.id))
      .map((t) => ({
        id: t.id,
        title: t.title,
        duration: t.duration,
        price: 0,
        description: t.description || undefined,
      }));

    setIsImporting(true);
    try {
      const res = await fetch(`/api/clubs/${clubId}/tournaments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "import_smartshell_packages",
          tariffs: tariffsToImport,
        }),
      });
      if (res.ok) {
        setIsImportModalOpen(false);
        await fetchPackages();
      } else {
        const data = await res.json();
        alert(data.error || "Не удалось импортировать тарифы");
      }
    } catch (e) {
      console.error("Failed to import tariffs:", e);
      alert("Ошибка сети при импорте тарифов");
    } finally {
      setIsImporting(false);
    }
  };

  const filteredPackages = useMemo(() => {
    return packages.filter((pkg) => {
      const q = packageSearch.toLowerCase().trim();
      const matchQuery =
        !q ||
        pkg.name.toLowerCase().includes(q) ||
        (pkg.duration && pkg.duration.toLowerCase().includes(q)) ||
        (pkg.description && pkg.description.toLowerCase().includes(q));

      if (packageFilter === "active" && !pkg.is_active) return false;
      if (packageFilter === "inactive" && pkg.is_active) return false;

      return matchQuery;
    });
  }, [packages, packageSearch, packageFilter]);

  // Filtered disciplines
  const filteredDisciplines = useMemo(() => {
    return disciplines.filter((d) => {
      const q = searchQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        d.name.toLowerCase().includes(q) ||
        d.key.toLowerCase().includes(q) ||
        (d.description && d.description.toLowerCase().includes(q));

      const isSys = Boolean(d.is_system || d.key === "cs2" || d.key === "dota2");
      if (filterType === "system" && !isSys) return false;
      if (filterType === "custom" && isSys) return false;

      return matchQuery;
    });
  }, [disciplines, searchQuery, filterType]);

  const systemCount = disciplines.filter(
    (d) => d.is_system || d.key === "cs2" || d.key === "dota2"
  ).length;
  const customCount = disciplines.length - systemCount;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Settings Sub-Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200/80 pb-4 overflow-x-auto">
        <button
          type="button"
          onClick={() => setSettingsSubTab("disciplines")}
          className={cn(
            "flex items-center gap-2.5 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap",
            settingsSubTab === "disciplines"
              ? "bg-slate-900 text-white shadow-sm"
              : "bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-slate-200/60"
          )}
        >
          <Gamepad2 className="w-4 h-4" />
          <span>Дисциплины</span>
          <span
            className={cn(
              "text-[10px] px-2 py-0.5 rounded-full font-black",
              settingsSubTab === "disciplines"
                ? "bg-white/20 text-white"
                : "bg-slate-100 text-slate-600"
            )}
          >
            {disciplines.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setSettingsSubTab("packages")}
          className={cn(
            "flex items-center gap-2.5 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap",
            settingsSubTab === "packages"
              ? "bg-slate-900 text-white shadow-sm"
              : "bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-slate-200/60"
          )}
        >
          <Package className="w-4 h-4" />
          <span>Пакеты взносов</span>
          <span
            className={cn(
              "text-[10px] px-2 py-0.5 rounded-full font-black",
              settingsSubTab === "packages"
                ? "bg-white/20 text-white"
                : "bg-slate-100 text-slate-600"
            )}
          >
            {packages.length}
          </span>
        </button>
      </div>

      {settingsSubTab === "disciplines" && (
        <div className="space-y-8 animate-in fade-in duration-300">
          {/* Top Banner & Actions */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1.5">
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 uppercase">
                Настройки дисциплин
              </h2>
          <p className="text-xs sm:text-sm text-slate-500 max-w-2xl font-medium">
            Управляйте киберспортивными дисциплинами клуба. Системные дисциплины (CS2 и Dota 2)
            интегрированы с игровыми серверами, а для кастомных можно задавать свои форматы и правила.
          </p>
        </div>

        <Button
          onClick={handleOpenCreate}
          className="h-11 sm:h-12 rounded-2xl px-5 bg-slate-900 text-white hover:bg-slate-800 font-bold transition-all shadow-sm shrink-0 cursor-pointer"
        >
          Создать дисциплину
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
            Всего дисциплин
          </span>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-2">
            {disciplines.length}
          </div>
          <span className="text-[10px] text-slate-400 font-medium">
            Доступно при создании турниров
          </span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 block">
            Системные дисциплины
          </span>
          <div className="text-2xl sm:text-3xl font-black text-blue-700 mt-2">
            {systemCount}
          </div>
          <span className="text-[10px] text-slate-400 font-medium">
            CS2 и Dota 2 (автосерверы и API)
          </span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 block">
            Пользовательские
          </span>
          <div className="text-2xl sm:text-3xl font-black text-emerald-700 mt-2">
            {customCount}
          </div>
          <span className="text-[10px] text-slate-400 font-medium">
            Консольные, мобильные и другие игры
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            placeholder="Поиск по названию или коду дисциплины..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 transition-all font-medium"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200 self-start sm:self-auto overflow-x-auto">
          {(
            [
              { id: "all", label: "Все" },
              { id: "system", label: "Системные" },
              { id: "custom", label: "Пользовательские" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterType(tab.id)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap",
                filterType === tab.id
                  ? "bg-slate-900 text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Disciplines Grid */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Загрузка дисциплин...
          </span>
        </div>
      ) : filteredDisciplines.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-200 rounded-3xl p-12 text-center space-y-3">
          <h4 className="text-base font-bold text-slate-800">Дисциплины не найдены</h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {searchQuery
              ? "По вашему поисковому запросу ничего не найдено."
              : "Список дисциплин пуст. Создайте новую дисциплину для проведения турниров."}
          </p>
          {searchQuery && (
            <Button
              variant="outline"
              onClick={() => setSearchQuery("")}
              className="rounded-xl text-xs h-9"
            >
              Сбросить поиск
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredDisciplines.map((d) => {
            const isSys = Boolean(d.is_system || d.key === "cs2" || d.key === "dota2");
            return (
              <div
                key={d.id}
                className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs flex flex-col justify-between transition-all hover:border-slate-300 relative"
              >
                <div className="space-y-4">
                  {/* Top Bar of Card */}
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-black text-slate-900 tracking-tight">
                        {d.name}
                      </h3>
                      <span className="text-slate-400 font-mono text-xs font-semibold">
                        {d.key}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium line-clamp-2 mt-1">
                      {d.description || "Описание не указано"}
                    </p>
                  </div>

                  {/* Formats Tags */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Доступные форматы
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {Array.isArray(d.formats) && d.formats.length > 0 ? (
                        d.formats.map((fmt) => (
                          <span
                            key={fmt}
                            className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200/80 text-[11px] font-bold text-slate-700 uppercase"
                          >
                            {formatTypeLabel(fmt)}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-slate-400">Форматы не заданы</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="pt-5 mt-5 border-t border-slate-100 flex items-center justify-between gap-2">
                  <span className="text-[10px] text-slate-400 font-medium">
                    {isSys ? "Системная дисциплина" : "Пользовательская дисциплина"}
                  </span>

                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenEdit(d)}
                      className="h-8 rounded-xl px-3 border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold cursor-pointer"
                    >
                      Редактировать
                    </Button>

                    {!isSys ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(d)}
                        className="h-8 rounded-xl px-3 border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-semibold cursor-pointer"
                      >
                        Удалить
                      </Button>
                    ) : (
                      <span
                        title="Системную дисциплину нельзя удалить"
                        className="h-8 px-2.5 flex items-center text-[10px] font-bold text-slate-400 cursor-not-allowed select-none"
                      >
                        Неудаляемая
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE / EDIT DISCIPLINE MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/40 backdrop-blur-xs animate-in fade-in-0">
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-slate-900 animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex justify-between items-start pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-black text-slate-900 tracking-tight uppercase">
                  {editingDiscipline
                    ? editingDiscipline.is_system || editingDiscipline.key === "cs2" || editingDiscipline.key === "dota2"
                      ? `Редактирование: ${editingDiscipline.name}`
                      : "Редактировать дисциплину"
                    : "Новая дисциплина"}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 font-medium">
                  {editingDiscipline?.is_system || editingDiscipline?.key === "cs2" || editingDiscipline?.key === "dota2"
                    ? "Настройка параметров системной дисциплины"
                    : "Добавление дисциплины для создания турниров в клубе"}
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Error Banner */}
            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-semibold text-rose-700">
                {errorMessage}
              </div>
            )}

            {/* System Discipline Notice */}
            {editingDiscipline &&
              (editingDiscipline.is_system ||
                editingDiscipline.key === "cs2" ||
                editingDiscipline.key === "dota2") && (
                <div className="p-3.5 bg-blue-50 border border-blue-200/80 rounded-2xl text-xs text-blue-800 space-y-0.5">
                  <span className="font-bold block">Системная дисциплина</span>
                  <span className="text-[11px] text-blue-700 font-medium block">
                    Код дисциплины фиксирован для взаимодействия с серверами DashMatch и Steam API.
                    Вы можете отредактировать название, поддерживаемые форматы и описание.
                  </span>
                </div>
              )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-700">
                  Название дисциплины *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Например: Mortal Kombat 1, Valorant..."
                  className="w-full bg-slate-50 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-2xl px-4 py-3 text-xs text-slate-900 font-bold placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 transition-all"
                />
              </div>

              {/* Key */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-700">
                  Идентификатор (код) *
                </label>
                <input
                  type="text"
                  required
                  disabled={
                    Boolean(
                      editingDiscipline &&
                        (editingDiscipline.is_system ||
                          editingDiscipline.key === "cs2" ||
                          editingDiscipline.key === "dota2")
                    )
                  }
                  value={formKey}
                  onChange={(e) => setFormKey(e.target.value)}
                  placeholder="valorant, mk1, apex..."
                  className={cn(
                    "w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs font-mono font-bold transition-all",
                    editingDiscipline &&
                      (editingDiscipline.is_system ||
                        editingDiscipline.key === "cs2" ||
                        editingDiscipline.key === "dota2")
                      ? "text-slate-400 cursor-not-allowed bg-slate-100"
                      : "text-slate-900 hover:bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                  )}
                />
                <span className="text-[10px] text-slate-400 block font-medium">
                  Только латинские буквы в нижнем регистре, цифры и дефис.
                </span>
              </div>

              {/* Badge */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-700">
                  Бейдж / Тип проведения
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {["Ручной ввод", "Автосервер", "Консоли / LAN", "Мобильные"].map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setFormBadge(b)}
                      className={cn(
                        "py-2.5 px-3 rounded-xl border text-xs font-bold transition-all text-center cursor-pointer",
                        formBadge === b
                          ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                          : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100/70"
                      )}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>

              {/* Formats Selection */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-700 block">
                  Поддерживаемые форматы матчей *
                </label>
                <div className="flex flex-wrap gap-2">
                  {COMMON_FORMATS.map((f) => {
                    const isSelected = formFormats.includes(f.id);
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => handleToggleFormat(f.id)}
                        className={cn(
                          "px-3 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer",
                          isSelected
                            ? "bg-orange-500 text-white border-orange-500 shadow-xs"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                        )}
                      >
                        <span>{f.label}</span>
                      </button>
                    );
                  })}
                  {/* Any custom formats already added */}
                  {formFormats
                    .filter((f) => !COMMON_FORMATS.some((cf) => cf.id === f))
                    .map((cf) => (
                      <button
                        key={cf}
                        type="button"
                        onClick={() => handleToggleFormat(cf)}
                        className="px-3 py-2 rounded-xl border border-orange-500 bg-orange-500 text-white text-xs font-bold cursor-pointer"
                      >
                        <span>{cf}</span>
                      </button>
                    ))}
                </div>

                {/* Add Custom Format inline */}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    placeholder="Добавить другой формат (например: 4vs4)..."
                    value={customFormatInput}
                    onChange={(e) => setCustomFormatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddCustomFormat();
                      }
                    }}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleAddCustomFormat}
                    className="h-8 rounded-xl px-3 text-xs font-bold"
                  >
                    Добавить
                  </Button>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-700">
                  Описание дисциплины
                </label>
                <textarea
                  rows={3}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Краткое описание игры, платформ или особенностей проведения..."
                  className="w-full bg-slate-50 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-2xl px-4 py-2.5 text-xs text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 transition-all"
                />
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                  className="rounded-xl px-4 h-10 text-xs font-bold"
                >
                  Отмена
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl px-5 h-10 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Сохранение...</span>
                    </>
                  ) : (
                    <span>{editingDiscipline ? "Сохранить изменения" : "Создать"}</span>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )}

  {/* PACKAGES SUB-TAB */}
  {settingsSubTab === "packages" && (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Banner & Actions */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1.5">
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 uppercase flex items-center gap-2.5 flex-wrap">
            <span>Пакеты взносов в турниры</span>
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200/80">
              Клубные тарифы
            </span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 max-w-2xl font-medium">
            Настройте клубные пакеты игрового времени. При создании турнира можно указать покупку определенного пакета как обязательное условие участия (взнос).
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0 flex-wrap">
          {smartshellTariffs.length > 0 && (
            <Button
              type="button"
              onClick={handleOpenImportModal}
              variant="outline"
              className="h-11 sm:h-12 rounded-2xl px-4 border-slate-200 hover:bg-slate-50 text-slate-700 font-bold transition-all shadow-xs flex items-center gap-2 cursor-pointer text-xs sm:text-sm"
            >
              <Download className="w-4 h-4 text-blue-600" />
              <span>Импорт из SmartShell</span>
              <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
                {smartshellTariffs.length}
              </span>
            </Button>
          )}

          <Button
            type="button"
            onClick={handleOpenCreatePackage}
            className="h-11 sm:h-12 rounded-2xl px-5 bg-slate-900 text-white hover:bg-slate-800 font-bold transition-all shadow-sm shrink-0 cursor-pointer flex items-center gap-2 text-xs sm:text-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Создать пакет</span>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
            Всего пакетов
          </span>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-2 font-mono">
            {packages.length}
          </div>
          <span className="text-[10px] text-slate-400 font-medium">
            Сконфигурировано в клубе
          </span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 block">
            Активных для взноса
          </span>
          <div className="text-2xl sm:text-3xl font-black text-emerald-700 mt-2 font-mono">
            {packages.filter((p) => p.is_active).length}
          </div>
          <span className="text-[10px] text-slate-400 font-medium">
            Доступно при создании турнира
          </span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 block">
            Интеграция SmartShell
          </span>
          <div className="text-2xl sm:text-3xl font-black text-blue-700 mt-2 flex items-center gap-2 font-mono">
            {smartshellTariffs.length > 0 ? (
              <>
                <span>{smartshellTariffs.length}</span>
                <span className="text-xs font-semibold text-blue-600 font-sans">тарифов найдено</span>
              </>
            ) : (
              <span className="text-base font-bold text-slate-400 font-sans">Ручной ввод</span>
            )}
          </div>
          <span className="text-[10px] text-slate-400 font-medium">
            {smartshellTariffs.length > 0
              ? "Синхронизация с тарифами клуба"
              : "Тарифы добавляются вручную"}
          </span>
        </div>
      </div>

      {/* Search & Status Filters */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Поиск пакета по названию, стоимости или описанию..."
              value={packageSearch}
              onChange={(e) => setPackageSearch(e.target.value)}
              className="w-full bg-slate-50/50 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 transition-all font-medium"
            />
          </div>

          <div className="flex bg-slate-100/70 p-1 rounded-xl border border-slate-200/60 overflow-x-auto shrink-0 gap-1">
            {[
              { id: "all", label: "Все", count: packages.length },
              { id: "active", label: "Активные", count: packages.filter((p) => p.is_active).length },
              { id: "inactive", label: "Отключенные", count: packages.filter((p) => !p.is_active).length },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setPackageFilter(tab.id as any)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5",
                  packageFilter === tab.id
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                )}
              >
                <span>{tab.label}</span>
                <span
                  className={cn(
                    "text-[10px] px-1.5 py-0.2 rounded-full",
                    packageFilter === tab.id ? "bg-slate-100 text-slate-900" : "text-slate-400"
                  )}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Packages List / Grid */}
      {packagesLoading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
          <span className="text-xs font-medium text-slate-500">Загрузка пакетов клуба...</span>
        </div>
      ) : filteredPackages.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center shadow-xs space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center mx-auto text-amber-600">
            <Package className="w-7 h-7" />
          </div>
          <div className="max-w-md mx-auto space-y-1.5">
            <h3 className="text-base font-bold text-slate-900">
              {packageSearch ? "Ничего не найдено" : "В клубе пока нет пакетов взносов"}
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              {packageSearch
                ? "Попробуйте изменить поисковый запрос"
                : "Добавьте пакеты (например: «Пакет 3 часа — 400 ₽»), чтобы участники могли оплачивать участие в турнирах покупкой игрового времени."}
            </p>
          </div>
          {!packageSearch && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button
                type="button"
                onClick={handleOpenCreatePackage}
                className="h-10 rounded-xl px-4 bg-slate-900 text-white font-bold text-xs cursor-pointer"
              >
                + Создать пакет
              </Button>
              {smartshellTariffs.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleOpenImportModal}
                  className="h-10 rounded-xl px-4 text-xs font-bold cursor-pointer"
                >
                  Импорт из SmartShell
                </Button>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredPackages.map((pkg) => (
            <div
              key={pkg.id}
              className={cn(
                "bg-white border rounded-3xl p-6 shadow-xs transition-all flex flex-col justify-between gap-5 relative overflow-hidden group hover:border-slate-300",
                pkg.is_active ? "border-slate-200" : "border-slate-200/60 opacity-60 bg-slate-50/50"
              )}
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 shrink-0">
                      <Package className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-900 leading-tight">
                        {pkg.name}
                      </h4>
                      <span className="text-[11px] text-slate-400 font-medium block mt-0.5">
                        {pkg.duration ? `⏱️ ${pkg.duration}` : "Длительность не указана"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {pkg.smartshell_tariff_id && (
                      <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                        SmartShell
                      </span>
                    )}
                    <span
                      className={cn(
                        "text-[10px] font-black uppercase px-2 py-0.5 rounded-full border",
                        pkg.is_active
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-slate-100 text-slate-500 border-slate-200"
                      )}
                    >
                      {pkg.is_active ? "Активен" : "Отключен"}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-baseline justify-between">
                  <span className="text-xs font-semibold text-slate-400">Стоимость взноса:</span>
                  <div className="text-2xl font-black text-slate-900 font-mono tracking-tight">
                    {pkg.price} ₽
                  </div>
                </div>

                {pkg.description && (
                  <p className="text-xs text-slate-500 font-normal line-clamp-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    {pkg.description}
                  </p>
                )}
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={pkg.is_active}
                    onCheckedChange={() => handleTogglePackageActive(pkg)}
                  />
                  <span className="text-[11px] font-medium text-slate-500 select-none">
                    {pkg.is_active ? "Для турниров" : "Скрыт"}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleOpenEditPackage(pkg)}
                    className="h-8 px-2.5 text-slate-600 hover:text-slate-900 rounded-lg text-xs font-bold cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5 mr-1" />
                    <span>Изменить</span>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeletePackage(pkg)}
                    className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer"
                    title="Удалить пакет"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Package Create / Edit Modal */}
      {isPackageModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md shadow-2xl p-6 sm:p-7 space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {editingPackage ? "Редактировать пакет" : "Новый пакет взноса"}
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Клубный пакет игрового времени
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsPackageModalOpen(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {packageErrorMessage && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{packageErrorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmitPackage} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-700 block">
                  Название пакета *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Например: Пакет 3 часа, Пакет Ночь, 5 часов VIP"
                  value={pkgName}
                  onChange={(e) => setPkgName(e.target.value)}
                  className="w-full bg-slate-50 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-medium focus:outline-none focus:ring-1 focus:ring-slate-900 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-700 block">
                    Стоимость (₽) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    required
                    placeholder="400"
                    value={pkgPrice}
                    onChange={(e) => setPkgPrice(e.target.value)}
                    className="w-full bg-slate-50 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-bold focus:outline-none focus:ring-1 focus:ring-slate-900 transition-all font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-700 block">
                    Длительность
                  </label>
                  <input
                    type="text"
                    placeholder="3 часа / 180 мин"
                    value={pkgDuration}
                    onChange={(e) => setPkgDuration(e.target.value)}
                    className="w-full bg-slate-50 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-medium focus:outline-none focus:ring-1 focus:ring-slate-900 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-700 block">
                  Описание / Условия пакета
                </label>
                <textarea
                  rows={2}
                  placeholder="Например: Стандартный игровой пакет, действует на все ПК клуба..."
                  value={pkgDescription}
                  onChange={(e) => setPkgDescription(e.target.value)}
                  className="w-full bg-slate-50 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-medium focus:outline-none focus:ring-1 focus:ring-slate-900 transition-all resize-none"
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">
                    Активен для турниров
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal block">
                    Отображать этот пакет при создании турнира
                  </span>
                </div>
                <Switch checked={pkgIsActive} onCheckedChange={setPkgIsActive} />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsPackageModalOpen(false)}
                  disabled={isPackageSubmitting}
                  className="rounded-xl px-4 h-10 text-xs font-bold"
                >
                  Отмена
                </Button>
                <Button
                  type="submit"
                  disabled={isPackageSubmitting}
                  className="rounded-xl px-5 h-10 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer"
                >
                  {isPackageSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Сохранение...</span>
                    </>
                  ) : (
                    <span>{editingPackage ? "Сохранить" : "Создать пакет"}</span>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SmartShell Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg shadow-2xl p-6 sm:p-7 space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                  <Download className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Импорт тарифов из SmartShell
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Выберите тарифы для добавления в пакеты турниров
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 px-1">
                <span>Доступные тарифы клуба ({smartshellTariffs.length})</span>
                <button
                  type="button"
                  onClick={() => {
                    if (selectedTariffIds.length === smartshellTariffs.length) {
                      setSelectedTariffIds([]);
                    } else {
                      setSelectedTariffIds(smartshellTariffs.map((t) => t.id));
                    }
                  }}
                  className="text-blue-600 hover:underline cursor-pointer"
                >
                  {selectedTariffIds.length === smartshellTariffs.length
                    ? "Снять выбор"
                    : "Выбрать все"}
                </button>
              </div>

              <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                {smartshellTariffs.map((t) => {
                  const isSelected = selectedTariffIds.includes(t.id);
                  const durationMin = t.duration ? Math.round(t.duration / 60) : 0;
                  return (
                    <div
                      key={t.id}
                      onClick={() => {
                        setSelectedTariffIds((prev) =>
                          prev.includes(t.id) ? prev.filter((id) => id !== t.id) : [...prev, t.id]
                        );
                      }}
                      className={cn(
                        "p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 select-none",
                        isSelected
                          ? "bg-blue-50/60 border-blue-300 text-slate-900"
                          : "bg-slate-50/50 border-slate-200/80 hover:bg-slate-50 text-slate-600"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "w-5 h-5 rounded-md border flex items-center justify-center transition-colors shrink-0",
                            isSelected
                              ? "bg-blue-600 border-blue-600 text-white"
                              : "border-slate-300 bg-white"
                          )}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                        <div>
                          <span className="text-xs font-bold block text-slate-900">
                            {t.title}
                          </span>
                          {durationMin > 0 && (
                            <span className="text-[10px] text-slate-400 font-medium">
                              ⏱️ Длительность: {durationMin} мин
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsImportModalOpen(false)}
                disabled={isImporting}
                className="rounded-xl px-4 h-10 text-xs font-bold"
              >
                Отмена
              </Button>
              <Button
                type="button"
                onClick={handleImportSmartshell}
                disabled={isImporting || selectedTariffIds.length === 0}
                className="rounded-xl px-5 h-10 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Импорт...</span>
                  </>
                ) : (
                  <span>Импортировать ({selectedTariffIds.length})</span>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )}
    </div>
  );
}
