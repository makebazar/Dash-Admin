"use client";

import {
  useState,
  useEffect,
  useCallback,
  useTransition,
  useMemo,
} from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  Loader2,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Camera,
  ChevronRight,
  ChevronLeft,
  X,
  Info,
  Check,
  Package2,
  Clock,
  Search,
  ScanLine,
  Plus,
  Trash2,
  ArrowRightLeft,
  User,
  Monitor,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { BarcodeScanner } from "@/app/clubs/[clubId]/inventory/_components/BarcodeScanner";
import { QRCode } from "@/components/qr/QRCode";
import {
  getHandoverSourceCandidatesTerminal,
  getShiftAccountabilityWarehousesTerminal,
  getShiftZoneSnapshotDraftTerminal,
  saveShiftZoneSnapshotTerminal,
  getProductsTerminal,
} from "@/app/clubs/[clubId]/inventory/terminal-actions";
import {
  type HandoverSourceCandidate,
  type ShiftZoneSnapshotDraftItem,
  type ShiftZoneSnapshotType,
} from "@/app/clubs/[clubId]/inventory/actions";

import { cn } from "@/lib/utils";

type Step = "SETUP" | "COUNTING" | "SUMMARY" | "SUCCESS";

export default function HandoverTerminalPage() {
  const { type, shiftId } = useParams() as { type: string; shiftId: string };
  const searchParams = useSearchParams();
  const clubId = searchParams.get("clubId");
  const router = useRouter();

  const snapshotType = type as ShiftZoneSnapshotType;
  const blindCloseMode =
    searchParams.get("blind") === "true" && snapshotType === "CLOSE";

  const [step, setStep] = useState<Step>("SETUP");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Data
  const [items, setItems] = useState<
    (ShiftZoneSnapshotDraftItem & { confirmed?: boolean })[]
  >([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [handoverSourceCandidates, setHandoverSourceCandidates] = useState<
    HandoverSourceCandidate[]
  >([]);
  const [selectedSourceShiftId, setSelectedSourceShiftId] = useState("");
  const [allProducts, setAllProducts] = useState<any[]>([]);

  // UI State
  const [searchQuery, setSearchQuery] = useState("");
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannedItemId, setScannedItemId] = useState<string | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
  const [manualSearchQuery, setManualSearchQuery] = useState("");
  const [countdown, setCountdown] = useState(5);
  const [isDesktop, setIsDesktop] = useState(false);

  const draftStorageKey = `shift-zone-snapshot:${clubId}:${shiftId}:${snapshotType}`;

  useEffect(() => {
    const checkIsDesktop = () => {
      setIsDesktop(window.innerWidth > 1024);
    };
    checkIsDesktop();
    window.addEventListener("resize", checkIsDesktop);
    return () => window.removeEventListener("resize", checkIsDesktop);
  }, []);

  // Success Countdown
  useEffect(() => {
    if (step === "SUCCESS") {
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            // Final action: Try multiple ways to close the window
            window.close();
            // Hack for mobile browsers/webviews
            setTimeout(() => {
              window.open("", "_self", "");
              window.close();
            }, 100);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [step, clubId]);

  // History Management
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      const state = e.state;
      if (state) {
        if (state.dialog === "add") {
          setIsAddDialogOpen(true);
          setIsScannerOpen(false);
        } else if (state.dialog === "scanner") {
          setIsScannerOpen(true);
          setIsAddDialogOpen(false);
        } else {
          setIsAddDialogOpen(false);
          setIsScannerOpen(false);
          if (state.step) setStep(state.step);
        }
      } else {
        setIsAddDialogOpen(false);
        setIsScannerOpen(false);
      }
    };
    window.addEventListener("popstate", handlePopState);

    // Initial state
    if (!window.history.state?.step) {
      window.history.replaceState({ step: "SETUP" }, "");
    }

    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const changeStep = (newStep: Step) => {
    window.history.pushState({ step: newStep }, "");
    setStep(newStep);
  };

  // Fetch initial data
  const fetchData = useCallback(
    async (silent = false) => {
      if (!clubId || !shiftId) return;
      if (!silent) setIsLoading(true);
      try {
        const [rowsRes, warehousesRes, sourceCandidatesRes] = await Promise.all(
          [
            getShiftZoneSnapshotDraftTerminal(clubId, shiftId, snapshotType),
            getShiftAccountabilityWarehousesTerminal(clubId, shiftId),
            snapshotType === "OPEN"
              ? getHandoverSourceCandidatesTerminal(clubId, shiftId)
              : Promise.resolve({ ok: true as const, data: [] }),
          ],
        );

        if (!rowsRes.ok) throw new Error(rowsRes.error);
        if (!warehousesRes.ok) throw new Error(warehousesRes.error);
        if (!sourceCandidatesRes.ok) throw new Error(sourceCandidatesRes.error);

        const rows = rowsRes.data;
        const availableWarehouses = warehousesRes.data;
        const sourceCandidates = sourceCandidatesRes.data;

        // Check if already finished
        const alreadyFinished =
          rows.length > 0 &&
          rows.every((i) => i.saved_counted_quantity !== null);
        if (alreadyFinished) {
          setIsFinished(true);
          setStep("SUCCESS");
          if (!silent) setIsLoading(false);
          return;
        }

        let nextItems = rows;
        let nextSelectedSourceShiftId =
          sourceCandidates?.find(
            (candidate: any) => !candidate.is_self_handover,
          )?.shift_id ||
          sourceCandidates?.[0]?.shift_id ||
          "";

        // Restore from localStorage
        try {
          const savedDraftRaw = localStorage.getItem(draftStorageKey);
          if (savedDraftRaw) {
            const savedDraft = JSON.parse(savedDraftRaw);
            if (Array.isArray(savedDraft.items)) {
              const savedData = new Map<
                string,
                { qty: any; confirmed: boolean }
              >(
                savedDraft.items.map((item: any) => [
                  `${item.warehouse_id}:${item.product_id}`,
                  {
                    qty: item.counted_quantity,
                    confirmed: !!item.confirmed,
                  },
                ]),
              );
              nextItems = rows.map((item: any) => {
                const key = `${item.warehouse_id}:${item.product_id}`;
                const saved = savedData.get(key);
                return {
                  ...item,
                  counted_quantity: saved
                    ? saved.qty === null
                      ? null
                      : Number(saved.qty)
                    : item.counted_quantity,
                  confirmed: saved ? saved.confirmed : !!item.confirmed,
                };
              });
            }
            if (savedDraft.selected_handover_source_shift_id) {
              nextSelectedSourceShiftId =
                savedDraft.selected_handover_source_shift_id;
            }
          }
        } catch (e) {
          console.error("Failed to restore draft", e);
        }

        if (snapshotType === "CLOSE" && blindCloseMode) {
          nextItems = nextItems.map((item: any) => ({
            ...item,
            counted_quantity:
              item.saved_counted_quantity === null
                ? null
                : item.counted_quantity,
          }));
        }

        setItems(nextItems);
        setWarehouses(availableWarehouses);
        setHandoverSourceCandidates(sourceCandidates);
        setSelectedSourceShiftId(nextSelectedSourceShiftId);

        // If it's CLOSE or no source candidates, skip SETUP
        if (
          step === "SETUP" &&
          (snapshotType === "CLOSE" || sourceCandidates.length === 0)
        ) {
          setStep("COUNTING");
          window.history.replaceState({ step: "COUNTING" }, "");
        }
      } catch (error) {
        console.error(error);
        if (!silent) alert("Ошибка загрузки данных");
      } finally {
        if (!silent) setIsLoading(false);
      }
    },
    [clubId, shiftId, snapshotType, blindCloseMode, draftStorageKey, step],
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Polling for completion (especially for desktop QR view)
  useEffect(() => {
    if (!isDesktop || step === "SUCCESS" || isLoading) return;

    const interval = setInterval(() => {
      fetchData(true);
    }, 3000);

    return () => clearInterval(interval);
  }, [isDesktop, step, isLoading, fetchData]);

  // Save to localStorage
  useEffect(() => {
    if (isLoading) return;
    try {
      localStorage.setItem(
        draftStorageKey,
        JSON.stringify({
          items: items.map((item) => ({
            warehouse_id: item.warehouse_id,
            product_id: item.product_id,
            counted_quantity: item.counted_quantity,
            confirmed: item.confirmed,
          })),
          selected_handover_source_shift_id: selectedSourceShiftId || null,
        }),
      );
    } catch (e) {
      console.error("Failed to save draft", e);
    }
  }, [items, selectedSourceShiftId, draftStorageKey, isLoading]);

  // Filtering
  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.product_name.toLowerCase().includes(q) ||
        item.barcode?.includes(q) ||
        item.barcodes?.some((bc) => bc.includes(q)),
    );
  }, [items, searchQuery]);

  const groupedItems = useMemo(() => {
    const groups = new Map<
      number,
      {
        label: string;
        items: (ShiftZoneSnapshotDraftItem & { confirmed?: boolean })[];
      }
    >();
    for (const item of filteredItems) {
      if (!groups.has(item.warehouse_id)) {
        groups.set(item.warehouse_id, {
          label: item.warehouse_name,
          items: [],
        });
      }
      groups.get(item.warehouse_id)!.items.push(item);
    }
    return Array.from(groups.entries());
  }, [filteredItems]);

  const stats = useMemo(() => {
    const total = items.length;
    const counted = items.filter((i) => i.confirmed).length;
    return {
      total,
      counted,
      progress: total === 0 ? 0 : Math.round((counted / total) * 100),
    };
  }, [items]);

  const updateQuantity = (
    warehouseId: number,
    productId: number,
    val: number | null,
  ) => {
    setItems((prev) =>
      prev.map((item) =>
        item.warehouse_id === warehouseId && item.product_id === productId
          ? {
              ...item,
              counted_quantity:
                val === null ? null : Math.max(0, Math.trunc(val)),
              confirmed: true,
            }
          : item,
      ),
    );
  };

  const confirmItem = (warehouseId: number, productId: number) => {
    setItems((prev) =>
      prev.map((item) =>
        item.warehouse_id === warehouseId && item.product_id === productId
          ? { ...item, confirmed: !item.confirmed }
          : item,
      ),
    );
  };

  const openAddDialog = async () => {
    setManualSearchQuery("");
    window.history.pushState({ dialog: "add", step }, "");
    setIsAddDialogOpen(true);
    if (allProducts.length > 0) return;
    try {
      const res = await getProductsTerminal(clubId!);
      if (res.ok) {
        setAllProducts(res.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const openScanner = () => {
    window.history.pushState({ dialog: "scanner", step }, "");
    setIsScannerOpen(true);
  };

  const handleScan = async (barcode: string) => {
    const matched = items.find(
      (i) => i.barcode === barcode || i.barcodes?.includes(barcode),
    );
    if (matched) {
      const current = Number(matched.counted_quantity || 0);
      updateQuantity(matched.warehouse_id, matched.product_id, current + 1);

      const id = `${matched.warehouse_id}:${matched.product_id}`;
      setScannedItemId(id);

      // Play beep
      try {
        const audioCtx = new (
          window.AudioContext || (window as any).webkitAudioContext
        )();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = "sine";
        osc.frequency.setValueAtTime(880, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
      } catch (e) {}

      // Scroll to element
      setTimeout(() => {
        const el = document.getElementById(
          `item-${matched.warehouse_id}-${matched.product_id}`,
        );
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 100);

      // Reset highlight after delay
      setTimeout(() => setScannedItemId(null), 1500);

      return true;
    }
    return false;
  };

  const handleFinish = () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    startTransition(async () => {
      try {
        const res = await saveShiftZoneSnapshotTerminal(
          clubId!,
          shiftId,
          snapshotType,
          warehouses.map((wh) => ({
            warehouse_id: wh.id,
            items: items
              .filter((i) => i.warehouse_id === wh.id)
              .map((i) => ({
                product_id: i.product_id,
                counted_quantity: Math.max(
                  0,
                  Math.trunc(Number(i.counted_quantity) || 0),
                ),
                system_quantity: Number(i.system_quantity || 0),
              })),
          })),
          snapshotType === "OPEN"
            ? { accepted_from_shift_id: selectedSourceShiftId || null }
            : undefined,
        );

        if (res.ok) {
          localStorage.removeItem(draftStorageKey);

          if (snapshotType === "CLOSE") {
            const pendingCloseKey = `pending_shift_close_data:${clubId}`;
            const pendingData = localStorage.getItem(pendingCloseKey);

            let requestBody = {};
            if (pendingData) {
              try {
                const parsedData = JSON.parse(pendingData);
                const { checklistResponses, checklistId, ...cleanReportData } =
                  parsedData;
                requestBody = {
                  reportData: cleanReportData,
                  checklistId,
                  checklistResponses,
                };
              } catch (e) {
                console.error("Failed to parse pending data", e);
              }
            }

            try {
              // Finalize shift close with data (or empty object if data is in DB draft)
              const finalizeRes = await fetch(
                `/api/employee/shifts/${shiftId}/finalize`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(requestBody),
                },
              );

              if (!finalizeRes.ok) {
                const errorData = await finalizeRes.json().catch(() => ({}));
                const errorText = errorData.error || (await finalizeRes.text());
                console.error("Failed to finalize shift:", errorText);
                alert(
                  `Ошибка при завершении смены: ${errorText}. Пожалуйста, обратитесь к администратору.`,
                );
                setIsSubmitting(false);
                return;
              }

              if (pendingData) {
                localStorage.removeItem(pendingCloseKey);
              }
            } catch (e) {
              console.error("Failed to finalize shift close", e);
              alert("Ошибка сети при завершении смены.");
              setIsSubmitting(false);
              return;
            }
          }

          setStep("SUCCESS");
        } else {
          alert(res.error || "Ошибка при сохранении");
        }
      } catch (e) {
        console.error(e);
        alert("Ошибка сети");
      } finally {
        setIsSubmitting(false);
      }
    });
  };

  if (isLoading)
    return (
      <div className="h-screen flex items-center justify-center bg-zinc-950 text-white">
        <Loader2 className="animate-spin" />
      </div>
    );

  if (isDesktop && step !== "SUCCESS") {
    const terminalUrl = `${window.location.origin}/employee/terminal/handover/${type}/${shiftId}?clubId=${clubId}${blindCloseMode ? "&blind=true" : ""}`;

    return (
      <div className="h-[100dvh] bg-zinc-950 flex flex-col items-center justify-center p-8 text-center font-sans">
        <div className="h-20 w-20 rounded-3xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 mb-8 shadow-2xl">
          <Monitor className="h-10 w-10" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight mb-4 text-white uppercase italic">
          Доступ ограничен
        </h1>
        <p className="text-zinc-500 max-w-sm mb-8 leading-relaxed font-medium">
          Этот терминал предназначен только для мобильных устройств.
          Отсканируйте QR-код ниже, чтобы продолжить{" "}
          {snapshotType === "OPEN" ? "приемку" : "сдачу"} со смартфона.
        </p>

        <div className="bg-white p-5 rounded-[2rem] flex items-center justify-center shadow-[0_0_50px_rgba(16,185,129,0.1)] border-4 border-zinc-900 mb-8 animate-in zoom-in-95 duration-500">
          <QRCode value={terminalUrl} size={180} />
        </div>

        <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-2xl text-[10px] font-mono text-zinc-600 uppercase tracking-[0.2em] font-bold">
          Mobile interface required
        </div>
      </div>
    );
  }

  if (step === "SUCCESS") {
    return (
      <div className="min-h-[100dvh] bg-black flex justify-center">
        <div className="w-full max-w-2xl bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-8 text-center font-sans border-x border-zinc-900 h-[100dvh] shadow-2xl relative">
          <div className="space-y-8 animate-in fade-in zoom-in duration-500">
            <div className="h-24 w-24 rounded-[2.5rem] bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 mx-auto shadow-2xl shadow-emerald-500/10">
              <CheckCircle2 className="h-12 w-12" />
            </div>
            <div className="space-y-4">
              <h2 className="text-3xl font-black tracking-tight text-white uppercase italic">
                Все готово!
              </h2>
              <p className="text-zinc-500 font-medium">
                {isFinished
                  ? "Данные по этой смене уже были сохранены ранее."
                  : "Отчет успешно отправлен. Хорошей смены!"}
              </p>
            </div>
            <div className="inline-flex items-center gap-3 px-6 py-3 rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-400 font-mono text-sm">
              {countdown > 0 ? (
                <>
                  <Clock className="h-4 w-4" />
                  Закрытие через {countdown} сек...
                </>
              ) : (
                <span className="text-emerald-500 font-bold">Готово</span>
              )}
            </div>

            {countdown === 0 && (
              <Button
                variant="outline"
                className="w-full max-w-xs h-14 rounded-2xl border-zinc-800 bg-zinc-900 text-white font-bold animate-in fade-in zoom-in duration-300"
                onClick={() => {
                  window.open("", "_self");
                  window.close();
                }}
              >
                Закрыть вкладку вручную
              </Button>
            )}

            <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold">
              Если вкладка не закрылась автоматически, нажмите кнопку выше
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-black flex justify-center">
      <div className="w-full max-w-2xl bg-zinc-950 text-zinc-100 flex flex-col font-sans h-[100dvh] overflow-hidden relative border-x border-zinc-900 shadow-2xl">
        {/* Header */}
        <div className="p-5 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/80 backdrop-blur-xl sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-base font-bold tracking-tight leading-none uppercase">
                {snapshotType === "OPEN" ? "Приемка бара" : "Сдача бара"}
              </h1>
              <div className="flex items-center gap-2 mt-1.5">
                <Badge
                  variant="outline"
                  className={cn(
                    "border-zinc-700 text-zinc-500 text-[9px] font-mono px-1.5 py-0 h-4",
                    snapshotType === "OPEN"
                      ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                      : "bg-blue-500/10 text-blue-500 border-blue-500/20",
                  )}
                >
                  {snapshotType === "OPEN" ? "ПРИЕМКА" : "СДАЧА"}
                </Badge>
                <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-wider">
                  {items.length} поз.
                </span>
              </div>
            </div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 text-right min-w-[80px]">
            <div className="text-[9px] font-bold text-zinc-500 uppercase leading-none mb-0.5 tracking-tight">
              Прогресс
            </div>
            <div className="text-sm font-mono font-bold text-emerald-500">
              {stats.progress}%
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-6 pb-40">
          {step === "SETUP" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
              <div className="space-y-2">
                <h2 className="text-xl font-bold tracking-tight">
                  У кого принимаешь остатки?
                </h2>
                <p className="text-sm text-zinc-500 font-medium">
                  Выберите смену коллеги, которая передает вам бар.
                </p>
              </div>

              <div className="grid gap-3">
                {handoverSourceCandidates.length > 0 ? (
                  handoverSourceCandidates.map((c) => (
                    <button
                      key={c.shift_id}
                      onClick={() => setSelectedSourceShiftId(c.shift_id)}
                      className={cn(
                        "p-5 rounded-[2rem] border-2 transition-all flex items-center gap-4 text-left group",
                        selectedSourceShiftId === c.shift_id
                          ? "bg-emerald-500/5 border-emerald-500/60 shadow-lg"
                          : "bg-zinc-900 border-zinc-800 text-zinc-500",
                        !c.is_counting_finished && "opacity-70",
                      )}
                    >
                      <div
                        className={cn(
                          "h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-active:scale-95",
                          selectedSourceShiftId === c.shift_id
                            ? "bg-emerald-500 text-white"
                            : "bg-zinc-800",
                        )}
                      >
                        <User className="h-6 w-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div
                          className={cn(
                            "text-sm font-bold tracking-tight truncate",
                            selectedSourceShiftId === c.shift_id &&
                              "text-emerald-500",
                          )}
                        >
                          {c.employee_name}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-0.5">
                          <span className="text-[10px] font-black text-zinc-500 uppercase tracking-wider">
                            {new Date(c.check_out!).toLocaleDateString(
                              "ru-RU",
                              {
                                day: "2-digit",
                                month: "2-digit",
                              },
                            )}
                          </span>
                          <span className="text-[10px] font-medium opacity-60 uppercase tracking-wider">
                            {new Date(c.check_out!).toLocaleTimeString(
                              "ru-RU",
                              {
                                hour: "2-digit",
                                minute: "2-digit",
                              },
                            )}
                          </span>
                          {c.shift_type && (
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[8px] font-bold px-1 py-0 h-3.5 border-zinc-800",
                                c.shift_type === "NIGHT"
                                  ? "bg-indigo-500/10 text-indigo-400"
                                  : "bg-amber-500/10 text-amber-400",
                              )}
                            >
                              {c.shift_type === "NIGHT" ? "НОЧЬ" : "ДЕНЬ"}
                            </Badge>
                          )}
                        </div>
                        {!c.is_counting_finished && (
                          <div className="flex items-center gap-1.5 mt-2 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-xl w-fit">
                            <Loader2 className="h-3 w-3 text-amber-500 animate-spin" />
                            <span className="text-[9px] font-black text-amber-500 uppercase tracking-tighter">
                              Идет подсчет остатков...
                            </span>
                          </div>
                        )}
                      </div>
                      {selectedSourceShiftId === c.shift_id &&
                        c.is_counting_finished && (
                          <Check className="h-6 w-6 text-emerald-500" />
                        )}
                      {selectedSourceShiftId === c.shift_id &&
                        !c.is_counting_finished && (
                          <AlertTriangle className="h-6 w-6 text-amber-500" />
                        )}
                    </button>
                  ))
                ) : (
                  <div className="p-8 text-center text-zinc-500 text-sm border-2 border-dashed border-zinc-800 rounded-[2rem]">
                    Подходящих смен не найдено.
                  </div>
                )}
              </div>
            </div>
          )}

          {step === "COUNTING" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
              {/* Search & Scan */}
              <div className="grid grid-cols-[1fr_auto_auto] gap-2">
                <div className="relative">
                  <Search className="absolute left-4 top-4 h-4 w-4 text-zinc-500" />
                  <Input
                    placeholder="Поиск товара..."
                    className="h-12 bg-zinc-900 border-zinc-800 pl-11 rounded-2xl text-sm"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Button
                  variant="outline"
                  className="h-12 w-12 rounded-2xl border-zinc-800 bg-zinc-900 text-emerald-500"
                  onClick={openAddDialog}
                >
                  <Plus className="h-5 w-5" />
                </Button>
                <Button
                  variant="outline"
                  className="h-12 w-12 rounded-2xl border-zinc-800 bg-zinc-900 text-zinc-400"
                  onClick={openScanner}
                >
                  <ScanLine className="h-5 w-5" />
                </Button>
              </div>

              {/* List */}
              {groupedItems.map(([whId, group]) => (
                <div key={whId} className="space-y-3">
                  <div className="flex items-center gap-2 px-1">
                    <Package2 className="h-3 w-3 text-zinc-600" />
                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                      {group.label}
                    </span>
                    <div className="h-px flex-1 bg-zinc-900" />
                  </div>

                  <div className="grid gap-3">
                    {group.items.map((item) => {
                      const isDiff =
                        !blindCloseMode &&
                        item.counted_quantity !== null &&
                        Number(item.counted_quantity) !==
                          Number(item.system_quantity);
                      const diffValue =
                        Number(item.counted_quantity || 0) -
                        Number(item.system_quantity || 0);

                      const itemId = `${whId}:${item.product_id}`;
                      const isScanned = scannedItemId === itemId;

                      return (
                        <div
                          key={itemId}
                          id={`item-${whId}-${item.product_id}`}
                          className={cn(
                            "p-4 rounded-[2rem] border transition-all bg-zinc-900",
                            isDiff ? "border-amber-500/30" : "border-zinc-800",
                            isScanned &&
                              "animate-scan-flash ring-2 ring-emerald-500",
                            item.confirmed && "border-zinc-100 shadow-lg",
                          )}
                        >
                          <div className="flex flex-col gap-2.5">
                            <div className="min-w-0">
                              <div className="text-sm font-bold text-white leading-tight line-clamp-2 min-h-[1.25rem]">
                                {item.product_name}
                              </div>
                              <div className="flex items-center justify-between mt-1.5">
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                  {(item.barcode ||
                                    (item.barcodes &&
                                      item.barcodes.length > 0) ||
                                    item.category_name) && (
                                    <div className="text-[10px] text-zinc-500 font-mono flex items-center flex-wrap gap-x-2 gap-y-1">
                                      {(item.barcode ||
                                        (item.barcodes &&
                                          item.barcodes.length > 0)) && (
                                        <div className="flex items-center gap-1">
                                          <ScanLine className="h-2.5 w-2.5" />
                                          ШК:{" "}
                                          {item.barcode || item.barcodes?.[0]}
                                        </div>
                                      )}
                                      {item.category_name && (
                                        <div className="flex items-center gap-2">
                                          {(item.barcode ||
                                            (item.barcodes &&
                                              item.barcodes.length > 0)) && (
                                            <span className="w-1 h-1 rounded-full bg-zinc-800" />
                                          )}
                                          <span className="text-zinc-600 font-sans font-bold uppercase tracking-tight text-[9px]">
                                            {item.category_name}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  {!blindCloseMode && (
                                    <Badge
                                      variant="outline"
                                      className="text-[9px] font-mono border-zinc-800 text-zinc-500 px-1.5 py-0 h-4 bg-zinc-950/50"
                                    >
                                      СИС: {item.system_quantity}
                                    </Badge>
                                  )}
                                </div>
                                {isDiff && (
                                  <span
                                    className={cn(
                                      "text-[9px] font-black uppercase tracking-tighter px-1.5 py-0 rounded-md bg-zinc-950/50 border border-zinc-800/50",
                                      diffValue > 0
                                        ? "text-emerald-500 border-emerald-500/20"
                                        : "text-rose-500 border-rose-500/20",
                                    )}
                                  >
                                    {diffValue > 0 ? "+" : ""}
                                    {diffValue}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 pt-2.5 border-t border-zinc-800/50">
                              <div className="flex-shrink-0 min-w-[55px] h-10 flex flex-col justify-center">
                                <div className="text-[11px] font-black text-emerald-500 tracking-tighter leading-none">
                                  {Number(
                                    item.selling_price || 0,
                                  ).toLocaleString()}{" "}
                                  ₽
                                </div>
                                <div className="text-[7px] font-bold text-zinc-600 uppercase tracking-widest mt-1">
                                  Цена
                                </div>
                              </div>

                              <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded-2xl p-0.5 shadow-inner flex-grow min-w-[100px] h-10 overflow-hidden">
                                <button
                                  className="w-10 h-full flex items-center justify-center text-zinc-500 active:text-white active:scale-90 transition-transform shrink-0"
                                  onClick={() =>
                                    updateQuantity(
                                      item.warehouse_id,
                                      item.product_id,
                                      Number(item.counted_quantity || 0) - 1,
                                    )
                                  }
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  className={cn(
                                    "flex-grow bg-transparent text-center text-sm font-black text-emerald-500 focus:outline-none transition-transform min-w-0 w-full px-1",
                                    isScanned && "animate-bump",
                                  )}
                                  value={item.counted_quantity ?? ""}
                                  onChange={(e) =>
                                    updateQuantity(
                                      item.warehouse_id,
                                      item.product_id,
                                      e.target.value === ""
                                        ? null
                                        : Number(e.target.value),
                                    )
                                  }
                                />
                                <button
                                  className="w-10 h-full flex items-center justify-center text-zinc-500 active:text-white active:scale-90 transition-transform shrink-0"
                                  onClick={() =>
                                    updateQuantity(
                                      item.warehouse_id,
                                      item.product_id,
                                      Number(item.counted_quantity || 0) + 1,
                                    )
                                  }
                                >
                                  +
                                </button>
                              </div>

                              <button
                                type="button"
                                className={cn(
                                  "flex items-center justify-center h-10 w-10 rounded-2xl border transition-all shrink-0 shadow-lg outline-none",
                                  item.confirmed
                                    ? "bg-emerald-500 text-white border-emerald-500 shadow-emerald-500/20"
                                    : "bg-zinc-900 text-zinc-600 border-zinc-800 active:text-white active:scale-95",
                                )}
                                onClick={() =>
                                  confirmItem(
                                    item.warehouse_id,
                                    item.product_id,
                                  )
                                }
                              >
                                <Check className="h-5 w-5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {step === "SUMMARY" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
              <div className="space-y-2">
                <h2 className="text-xl font-bold tracking-tight">
                  Итоговый отчет
                </h2>
                <p className="text-sm text-zinc-500 font-medium">
                  Проверьте данные перед отправкой.
                </p>
              </div>

              <div className="bg-zinc-900 rounded-[2rem] border border-zinc-800 p-6 space-y-4">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-zinc-500 uppercase tracking-widest">
                    Тип
                  </span>
                  <span className="text-white">
                    {snapshotType === "OPEN" ? "ПРИЕМКА" : "СДАЧА"}
                  </span>
                </div>
                {snapshotType === "OPEN" && (
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-zinc-500 uppercase tracking-widest">
                      Принято от
                    </span>
                    <span className="text-emerald-500">
                      {handoverSourceCandidates.find(
                        (c) => c.shift_id === selectedSourceShiftId,
                      )?.employee_name || "—"}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-zinc-500 uppercase tracking-widest">
                    Обработано
                  </span>
                  <span className="text-white">
                    {stats.counted} / {stats.total} поз.
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 px-1">
                  <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                    Расхождения
                  </span>
                  <div className="h-px flex-1 bg-zinc-900" />
                </div>
                <div className="grid gap-2">
                  {blindCloseMode ? (
                    <div className="p-4 text-center text-zinc-500 text-sm border border-dashed border-zinc-800 rounded-2xl">
                      Данные о расхождениях скрыты в режиме слепого подсчета
                    </div>
                  ) : items.filter(
                      (i) =>
                        i.counted_quantity !== null &&
                        Number(i.counted_quantity) !==
                          Number(i.system_quantity),
                    ).length === 0 ? (
                    <div className="p-4 text-center text-emerald-500 text-sm border border-dashed border-emerald-500/30 bg-emerald-500/5 rounded-2xl">
                      Все позиции сходятся с учетными остатками
                    </div>
                  ) : (
                    <>
                      {items
                        .filter(
                          (i) =>
                            i.counted_quantity !== null &&
                            Number(i.counted_quantity) !==
                              Number(i.system_quantity),
                        )
                        .map((i) => {
                          const diff =
                            Number(i.counted_quantity) -
                            Number(i.system_quantity);
                          const cost =
                            Math.abs(diff) * Number(i.selling_price || 0);
                          return (
                            <div
                              key={`${i.warehouse_id}:${i.product_id}`}
                              className="flex items-center justify-between px-4 py-3 bg-zinc-900 rounded-2xl border border-zinc-800/50"
                            >
                              <div className="flex flex-col">
                                <span className="text-xs font-medium text-zinc-300">
                                  {i.product_name}
                                </span>
                                {diff < 0 && cost > 0 && (
                                  <span className="text-[10px] text-zinc-500 font-medium">
                                    {cost.toLocaleString()} ₽
                                  </span>
                                )}
                              </div>
                              <span
                                className={cn(
                                  "text-xs font-black tabular-nums",
                                  diff > 0
                                    ? "text-emerald-500"
                                    : "text-rose-500",
                                )}
                              >
                                {diff > 0 ? "+" : ""}
                                {diff}
                              </span>
                            </div>
                          );
                        })}

                      {/* Total Shortage */}
                      {(() => {
                        const totalShortageCost = items.reduce((sum, i) => {
                          if (i.counted_quantity !== null) {
                            const diff =
                              Number(i.counted_quantity) -
                              Number(i.system_quantity);
                            if (diff < 0) {
                              return (
                                sum +
                                Math.abs(diff) * Number(i.selling_price || 0)
                              );
                            }
                          }
                          return sum;
                        }, 0);

                        if (totalShortageCost > 0) {
                          return (
                            <div className="flex items-center justify-between px-4 py-3 bg-rose-500/10 rounded-2xl border border-rose-500/20 mt-2">
                              <span className="text-xs font-bold text-rose-500 uppercase tracking-widest">
                                Итого недостача
                              </span>
                              <span className="text-sm font-black text-rose-500 tabular-nums">
                                {totalShortageCost.toLocaleString()} ₽
                              </span>
                            </div>
                          );
                        }
                        return null;
                      })()}

                      {/* Responsibility Notice */}
                      <div className="p-4 mt-2 bg-zinc-900/50 rounded-2xl border border-zinc-800 text-xs text-zinc-400 leading-relaxed font-medium">
                        {snapshotType === "OPEN" ? (
                          <>
                            Данные расхождения возникли{" "}
                            <strong className="text-zinc-200">
                              до начала вашей смены
                            </strong>
                            . Ответственность за них несет сдающий сотрудник.
                            Для вас эти фактические остатки станут стартовыми.
                          </>
                        ) : (
                          <>
                            Данные расхождения возникли{" "}
                            <strong className="text-zinc-200">
                              за время вашей смены
                            </strong>
                            . Информация будет передана управляющему.
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sticky Bottom Actions */}
        <div className="p-6 bg-zinc-950/80 backdrop-blur-xl border-t border-zinc-900 absolute bottom-0 left-0 right-0 z-40">
          <div className="flex gap-4">
            {step !== "SETUP" &&
              (snapshotType === "OPEN" || step !== "COUNTING") && (
                <Button
                  variant="outline"
                  className="h-16 w-16 rounded-[2rem] border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 active:scale-95 transition-all"
                  onClick={() => {
                    window.history.back();
                  }}
                >
                  <ChevronLeft className="h-8 w-8" />
                </Button>
              )}

            {step === "SETUP" ? (
              <Button
                className="flex-1 h-16 rounded-[2rem] bg-zinc-100 hover:bg-white text-black font-bold text-lg shadow-2xl active:scale-[0.98] transition-all"
                onClick={() => changeStep("COUNTING")}
                disabled={Boolean(
                  (!selectedSourceShiftId &&
                    handoverSourceCandidates.length > 0) ||
                  (selectedSourceShiftId &&
                    !handoverSourceCandidates.find(
                      (c) => c.shift_id === selectedSourceShiftId,
                    )?.is_counting_finished),
                )}
              >
                Далее к подсчету
                <ChevronRight className="ml-2 h-7 w-7" />
              </Button>
            ) : step === "COUNTING" ? (
              <Button
                className="flex-1 h-16 rounded-[2rem] bg-zinc-100 hover:bg-white text-black font-bold text-lg shadow-2xl active:scale-[0.98] transition-all disabled:opacity-50 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:shadow-none"
                onClick={() => changeStep("SUMMARY")}
                disabled={stats.progress < 100}
              >
                {stats.progress < 100
                  ? `Осталось проверить: ${stats.total - stats.counted}`
                  : "Итоговый отчет"}
                <ChevronRight className="ml-2 h-7 w-7" />
              </Button>
            ) : (
              <Button
                className="flex-1 h-16 rounded-[2rem] bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-lg shadow-[0_0_30px_rgba(16,185,129,0.3)] active:scale-[0.98] transition-all"
                onClick={handleFinish}
                disabled={isSubmitting || stats.progress < 100}
              >
                {isSubmitting ? (
                  <Loader2 className="h-7 w-7 animate-spin" />
                ) : (
                  <>
                    {stats.progress < 100
                      ? `Проверьте еще ${stats.total - stats.counted}`
                      : `Завершить ${snapshotType === "OPEN" ? "приемку" : "сдачу"}`}
                    <Check className="ml-2 h-7 w-7" />
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        <BarcodeScanner
          isOpen={isScannerOpen}
          onClose={() => window.history.back()}
          onScan={handleScan}
        />

        <Dialog
          open={isAddDialogOpen}
          onOpenChange={(open) => {
            if (!open) window.history.back();
          }}
        >
          <DialogContent className="relative h-[100dvh] w-screen max-w-none md:w-full md:max-w-2xl md:h-[85vh] md:rounded-[2rem] md:border md:border-zinc-800 rounded-none border-none bg-zinc-950 p-0 text-zinc-100 selection:bg-emerald-500/30 overflow-hidden flex flex-col [&>button]:hidden">
            <div className="flex-1 overflow-y-auto p-6 space-y-8 pb-32">
              <DialogHeader className="space-y-1 text-left pt-2">
                <DialogTitle className="text-xl font-black text-white uppercase italic tracking-tight">
                  Добавить товар
                </DialogTitle>
                <DialogDescription className="text-xs text-zinc-500 font-medium">
                  Поиск по всему каталогу клуба
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 max-w-md mx-auto w-full">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">
                    Выберите склад
                  </Label>
                  <div className="grid grid-cols-1 gap-2">
                    {warehouses.map((w) => (
                      <button
                        key={w.id}
                        onClick={() => setSelectedWarehouseId(String(w.id))}
                        className={cn(
                          "h-14 px-4 rounded-2xl border-2 transition-all text-left font-bold text-sm flex items-center justify-between",
                          selectedWarehouseId === String(w.id)
                            ? "bg-emerald-500/5 border-emerald-500/50 text-emerald-500"
                            : "bg-zinc-900 border-zinc-800 text-zinc-400",
                        )}
                      >
                        {w.name}
                        {selectedWarehouseId === String(w.id) && (
                          <Check className="h-5 w-5" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">
                    Поиск товара
                  </Label>
                  <div className="relative">
                    <Search className="absolute left-4 top-5 h-5 w-5 text-zinc-500" />
                    <Input
                      placeholder="Название или штрихкод..."
                      className="h-16 bg-zinc-900 border-zinc-800 pl-12 rounded-2xl text-base font-bold focus:ring-emerald-500/20 focus:border-emerald-500/50"
                      value={manualSearchQuery}
                      onChange={(e) =>
                        setManualSearchQuery(e.target.value.toLowerCase())
                      }
                    />
                  </div>

                  <div className="space-y-2 pt-2">
                    {!selectedWarehouseId ? (
                      <div className="p-8 text-center text-zinc-500 text-sm border-2 border-dashed border-zinc-800 rounded-[2rem]">
                        Сначала выберите склад, чтобы добавить товары
                      </div>
                    ) : (
                      allProducts
                        .filter(
                          (p) =>
                            p.name.toLowerCase().includes(manualSearchQuery) ||
                            p.barcode?.includes(manualSearchQuery),
                        )
                        .slice(0, 40)
                        .map((p) => {
                          const warehouseId = Number(selectedWarehouseId);
                          const isAlreadyAdded = items.some(
                            (i) =>
                              i.warehouse_id === warehouseId &&
                              i.product_id === p.id,
                          );

                          return (
                            <button
                              key={p.id}
                              className={cn(
                                "w-full text-left p-5 rounded-[2rem] border transition-all flex justify-between items-center group active:scale-[0.98]",
                                isAlreadyAdded
                                  ? "bg-zinc-900/50 border-zinc-800 opacity-60"
                                  : "bg-zinc-900 border-zinc-800",
                              )}
                              onClick={() => {
                                if (isAlreadyAdded) return;

                                const productId = p.id;
                                const warehouse = warehouses.find(
                                  (w) => w.id === warehouseId,
                                );
                                const product = allProducts.find(
                                  (item) => item.id === productId,
                                );
                                if (warehouse && product) {
                                  setItems((prev) => [
                                    ...prev,
                                    {
                                      warehouse_id: warehouse.id,
                                      warehouse_name: warehouse.name,
                                      shift_zone_key: warehouse.shift_zone_key,
                                      shift_zone_label:
                                        warehouse.shift_zone_label,
                                      product_id: product.id,
                                      product_name: product.name,
                                      barcode: product.barcode,
                                      barcodes: product.barcodes,
                                      counted_quantity: 1,
                                      saved_counted_quantity: null,
                                      system_quantity: 0,
                                      selling_price: Number(
                                        product.selling_price || 0,
                                      ),
                                    },
                                  ]);

                                  // Show visual feedback
                                  setScannedItemId(
                                    `${warehouseId}:${productId}`,
                                  );
                                  setTimeout(() => {
                                    const el = document.getElementById(
                                      `item-${warehouseId}-${productId}`,
                                    );
                                    if (el)
                                      el.scrollIntoView({
                                        behavior: "smooth",
                                        block: "center",
                                      });
                                  }, 100);
                                  setTimeout(
                                    () => setScannedItemId(null),
                                    1500,
                                  );
                                }
                              }}
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <div
                                    className={cn(
                                      "text-base font-bold truncate transition-colors",
                                      isAlreadyAdded
                                        ? "text-zinc-400"
                                        : "text-white",
                                    )}
                                  >
                                    {p.name}
                                  </div>
                                  {isAlreadyAdded && (
                                    <Badge
                                      variant="outline"
                                      className="text-[8px] px-1.5 h-4 border-emerald-500/30 text-emerald-500 bg-emerald-500/5 uppercase font-black"
                                    >
                                      В списке
                                    </Badge>
                                  )}
                                </div>
                                {p.barcode && (
                                  <div className="text-[10px] text-zinc-500 font-mono mt-1 uppercase tracking-tight">
                                    ШК: {p.barcode}
                                  </div>
                                )}
                              </div>
                              <div
                                className={cn(
                                  "h-10 w-10 rounded-2xl border flex items-center justify-center transition-colors shrink-0",
                                  isAlreadyAdded
                                    ? "bg-zinc-900 border-zinc-800 text-zinc-700"
                                    : "bg-zinc-950 border-zinc-800 text-zinc-500",
                                )}
                              >
                                {isAlreadyAdded ? (
                                  <Check className="h-5 w-5" />
                                ) : (
                                  <Plus className="h-5 w-5" />
                                )}
                              </div>
                            </button>
                          );
                        })
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 bg-zinc-950/80 backdrop-blur-xl border-t border-zinc-900 absolute bottom-0 left-0 right-0 z-50">
              <Button
                className="w-full h-16 rounded-[2rem] bg-zinc-100 hover:bg-white text-zinc-950 font-black uppercase italic tracking-tighter shadow-2xl active:scale-95 transition-all"
                onClick={() => {
                  window.history.back();
                }}
              >
                <ChevronLeft className="mr-2 h-6 w-6" />
                Вернуться к списку
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <style>{`
        @keyframes scanFlash {
          0% {
            background-color: rgb(16 185 129 / 0.2);
            border-color: #10b981;
            transform: scale(1.02);
          }
          100% {
            background-color: rgb(24 24 27);
            border-color: rgb(39 39 42);
            transform: scale(1);
          }
        }
        .animate-scan-flash {
          animation: scanFlash 1s ease-out;
        }
        @keyframes bump {
          0% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.3);
          }
          100% {
            transform: scale(1);
          }
        }
        .animate-bump {
          animation: bump 0.3s ease-out;
        }
      `}</style>
      </div>
    </div>
  );
}
