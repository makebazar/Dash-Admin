"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import {
  Loader2,
  MapPin,
  Monitor,
  Layers,
  ArrowRightLeft,
  Warehouse,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  User,
  ChevronRight,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useUiDialogs } from "@/app/clubs/[clubId]/inventory/_components/useUiDialogs";
import { cn } from "@/lib/utils";
import { renderEquipmentIcon } from "@/lib/equipment-icons";
import { getMaintenanceProgress } from "@/lib/maintenance-progress";
import { MaintenanceSegmentedBar } from "@/components/equipment/MaintenanceSegmentedBar";
import { COMPONENT_TYPES } from "@/lib/equipment-status";

// --- Types ---

interface Workstation {
  id: string;
  name: string;
  zone: string;
  assigned_user_id?: string | null;
  assigned_user_name?: string | null;
  equipment_count?: number;
}

interface Equipment {
  id: string;
  name: string;
  type: string;
  type_name: string;
  type_icon?: string | null;
  identifier?: string | null;
  brand: string | null;
  model: string | null;
  workstation_id: string | null;
  parent_equipment_id?: string | null;
  is_active: boolean;
  status?: string;
  maintenance_enabled?: boolean;
  cleaning_interval_days?: number | null;
  cleaning_interval_override_days?: number | null;
  last_cleaned_at?: string | null;
  open_issues_count?: number;
}

interface Zone {
  id: string;
  name: string;
  assigned_user_id?: string | null;
  assigned_user_name?: string | null;
}

export default function EmployeeEquipmentPage() {
  const { clubId } = useParams();
  const { showMessage, Dialogs } = useUiDialogs();
  const [workstations, setWorkstations] = useState<Workstation[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [zoneList, setZoneList] = useState<Zone[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedPcIds, setExpandedPcIds] = useState<string[]>([]);

  const togglePcExpansion = (e: React.MouseEvent, pcId: string) => {
    e.stopPropagation();
    setExpandedPcIds((prev) =>
      prev.includes(pcId) ? prev.filter((id) => id !== pcId) : [...prev, pcId],
    );
  };

  // Move Dialog State
  const [isMoveDialogOpen, setIsMoveDialogOpen] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(
    null,
  );
  const [moveAction, setMoveAction] = useState<"SWAP" | "REPLACE">("SWAP");
  const [targetWorkstationId, setTargetWorkstationId] = useState<string>("");
  const [moveReason, setMoveReason] = useState("");
  const [isMoveWithIssue, setIsMoveWithIssue] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Details Dialog State (for viewing workstation contents)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [detailsWorkstationId, setDetailsWorkstationId] = useState<
    string | null
  >(null);

  // Report Issue Dialog State
  const [isReportIssueOpen, setIsReportIssueOpen] = useState(false);
  const [issueTitle, setIssueTitle] = useState("");
  const [issueDescription, setIssueDescription] = useState("");

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [wsRes, eqRes, zonesRes] = await Promise.all([
        fetch(`/api/clubs/${clubId}/workstations`),
        fetch(`/api/clubs/${clubId}/equipment?limit=1000`),
        fetch(`/api/clubs/${clubId}/zones`),
      ]);

      const wsData = await wsRes.json();
      const eqData = await eqRes.json();

      if (zonesRes.ok) {
        const zonesData = await zonesRes.json();
        setZoneList(zonesData);
      }

      if (wsRes.ok && eqRes.ok) {
        const allEquipment = (eqData.equipment || []).filter(
          (e: Equipment) => e.is_active,
        );
        setEquipment(allEquipment);

        const enhancedWs = wsData.map((ws: Workstation) => ({
          ...ws,
          equipment_count: allEquipment.filter(
            (e: Equipment) => e.workstation_id === ws.id,
          ).length,
        }));
        setWorkstations(enhancedWs);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [clubId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const zones = useMemo(() => {
    const fromList = zoneList.map((z) => z.name);
    const fromWorkstations = workstations.map((w) => w.zone);
    return Array.from(new Set([...fromList, ...fromWorkstations])).sort();
  }, [zoneList, workstations]);

  // --- Helpers ---

  const getEquipmentIcon = (type: string, typeIcon?: string | null) =>
    renderEquipmentIcon(type, typeIcon, "h-4 w-4");

  // --- Actions ---

  const handleOpenDetails = (wsId: string) => {
    setDetailsWorkstationId(wsId);
    setIsDetailsOpen(true);
  };

  const handleOpenMoveDialog = (item: Equipment) => {
    setSelectedEquipment(item);
    setMoveAction("SWAP");
    setTargetWorkstationId("");
    setMoveReason("");
    setIsMoveWithIssue(false);
    setIsMoveDialogOpen(true);
  };

  const handleOpenReportIssue = (item: Equipment) => {
    setSelectedEquipment(item);
    setIssueTitle("");
    setIssueDescription("");
    setIsReportIssueOpen(true);
  };

  const handleReportIssueSubmit = async () => {
    if (!selectedEquipment || !issueTitle.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/clubs/${clubId}/equipment/issues`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          equipment_id: selectedEquipment.id,
          title: issueTitle,
          description: issueDescription,
          severity: "MEDIUM",
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Не удалось создать инцидент");
      }

      showMessage({
        title: "Готово",
        description: "Проблема зарегистрирована",
      });
      setIsReportIssueOpen(false);
    } catch (error: any) {
      console.error(error);
      showMessage({
        title: "Ошибка",
        description: error.message || "Ошибка при создании инцидента",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMoveSubmit = async () => {
    if (!selectedEquipment) return;
    if (moveAction === "SWAP" && !targetWorkstationId) {
      showMessage({
        title: "Проверьте данные",
        description: "Выберите целевое место для перемещения",
      });
      return;
    }
    if (!moveReason.trim()) {
      showMessage({
        title: "Проверьте данные",
        description: "Укажите причину перемещения",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Move Equipment
      const moveRes = await fetch(`/api/clubs/${clubId}/equipment/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          equipment_id: selectedEquipment.id,
          target_workstation_id:
            moveAction === "SWAP" ? targetWorkstationId : null,
          action: moveAction,
          reason: moveReason + (isMoveWithIssue ? " (Создан инцидент)" : ""),
        }),
      });

      const moveData = await moveRes.json();

      if (!moveRes.ok) {
        throw new Error(moveData.error || "Ошибка перемещения");
      }

      // 2. Create Issue if requested
      if (isMoveWithIssue) {
        const issueRes = await fetch(`/api/clubs/${clubId}/equipment/issues`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            equipment_id: selectedEquipment.id,
            title: "Проблема при перемещении",
            description: moveReason,
            severity: "MEDIUM",
          }),
        });

        if (!issueRes.ok) {
          const issueData = await issueRes.json();
          console.error("Failed to create issue:", issueData);
          showMessage({
            title: "Внимание",
            description: `Оборудование перемещено, но не удалось создать инцидент: ${issueData.error || "Unknown error"}`,
          });
        }
      }

      showMessage({
        title: "Готово",
        description:
          moveAction === "SWAP"
            ? "Оборудование перемещено"
            : "Оборудование отправлено на склад",
      });
      setIsMoveDialogOpen(false);
      fetchData();
    } catch (error: any) {
      console.error("Error moving equipment:", error);
      showMessage({ title: "Ошибка", description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Computed ---

  const activeWorkstation = useMemo(() => {
    return workstations.find((w) => w.id === detailsWorkstationId) || null;
  }, [workstations, detailsWorkstationId]);

  const activeEquipment = useMemo(() => {
    return equipment.filter(
      (item) => item.workstation_id === detailsWorkstationId,
    );
  }, [equipment, detailsWorkstationId]);

  const equipmentByWorkstationId = useMemo(() => {
    const map = new Map<string, Equipment[]>();
    for (const item of equipment) {
      if (!item.workstation_id) continue;
      const current = map.get(item.workstation_id);
      if (current) current.push(item);
      else map.set(item.workstation_id, [item]);
    }
    return map;
  }, [equipment]);

  const zoneMetaByName = useMemo(() => {
    return new Map(zoneList.map((zone) => [zone.name, zone]));
  }, [zoneList]);

  const activeIssueCountByEquipmentId = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of equipment) {
      const count = Number(item.open_issues_count ?? 0);
      if (count > 0) {
        map.set(item.id, count);
      }
    }
    return map;
  }, [equipment]);

  const availableTargets = useMemo(() => {
    if (!selectedEquipment) return [];
    // Filter out current workstation
    return workstations.filter(
      (w) => w.id !== selectedEquipment.workstation_id,
    );
  }, [workstations, selectedEquipment]);

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-400 mx-auto pb-24">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Рабочие места</h1>
            <p className="text-muted-foreground mt-1">
              Здесь можно посмотреть зоны и места, увидеть кто за них отвечает,
              проверить статус обслуживания оборудования, сообщить о проблеме и
              переместить устройство.
            </p>
          </div>
        </div>
      </div>

      {/* Zones Grid */}
      <div className="space-y-12">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : zones.length === 0 ? (
          <div className="text-center py-20 bg-card rounded-3xl border border-border">
            <MapPin className="h-10 w-10 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-bold">Зоны не найдены</h3>
          </div>
        ) : (
          zones.map((zone) => (
            <section
              key={zone}
              className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500"
            >
              {(() => {
                const zoneWorkstations = workstations.filter(
                  (w) => w.zone === zone,
                );

                return (
                  <div className="group flex items-center px-2 sticky top-0 z-10 bg-background/95 backdrop-blur py-2 border-b">
                    <div className="flex min-w-0 items-center gap-3">
                      <h2 className="text-lg font-black uppercase tracking-widest text-muted-foreground flex items-center gap-3">
                        <Layers className="h-5 w-5 text-primary" />
                        {zone}
                        <Badge
                          variant="secondary"
                          className="bg-accent text-muted-foreground border-none px-2"
                        >
                          {zoneWorkstations.length}
                        </Badge>
                      </h2>
                    </div>
                  </div>
                );
              })()}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {workstations
                  .filter((w) => w.zone === zone)
                  .map((ws) => {
                    const wsEquipment =
                      equipmentByWorkstationId.get(ws.id) ?? [];
                    const progressByItemId = new Map(
                      wsEquipment.map((item) => [
                        item.id,
                        getMaintenanceProgress(item),
                      ]),
                    );

                    const wsPenaltyCount = wsEquipment.filter(
                      (item) =>
                        progressByItemId.get(item.id)?.stage === "penalty",
                    ).length;
                    const wsGraceCount = wsEquipment.filter(
                      (item) =>
                        progressByItemId.get(item.id)?.stage === "grace",
                    ).length;
                    const wsNormalCount = wsEquipment.filter(
                      (item) =>
                        progressByItemId.get(item.id)?.stage === "normal",
                    ).length;
                    const wsMaxPenaltyDays = wsEquipment.reduce(
                      (max, item) =>
                        Math.max(
                          max,
                          progressByItemId.get(item.id)?.penaltyDays ?? 0,
                        ),
                      0,
                    );

                    const pcItem = wsEquipment.find((i) => i.type === "PC");
                    const componentItems = wsEquipment.filter(
                      (i) =>
                        i.type !== "PC" &&
                        (i.parent_equipment_id === pcItem?.id ||
                          COMPONENT_TYPES.includes(i.type)),
                    );
                    const peripheralItems = wsEquipment.filter(
                      (i) =>
                        i.id !== pcItem?.id &&
                        !componentItems.find((c) => c.id === i.id),
                    );

                    const mainDeviceCount =
                      wsEquipment.length - componentItems.length;

                    return (
                      <Card
                        key={ws.id}
                        className="group hover:border-primary/50 transition-all border-border shadow-sm overflow-hidden flex flex-col h-full cursor-pointer bg-card"
                        onClick={() => handleOpenDetails(ws.id)}
                      >
                        <CardHeader className="p-3.5 pb-2.5 bg-background/50 border-b border-border/50 flex flex-col gap-1">
                          {/* Строка 1: Имя ПК слева <----> Статус справа */}
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="font-bold text-sm text-foreground leading-tight truncate">
                              {ws.name}
                            </h4>
                            {wsPenaltyCount > 0 ? (
                              <span className="shrink-0 text-xs font-semibold text-rose-500 dark:text-rose-400">
                                Штраф: {wsPenaltyCount} устр.
                              </span>
                            ) : wsGraceCount > 0 ? (
                              <span className="shrink-0 text-xs font-semibold text-amber-500 dark:text-amber-400">
                                ТО: {wsGraceCount} устр.
                              </span>
                            ) : wsNormalCount > 0 ? (
                              <span className="shrink-0 text-xs font-medium text-emerald-500 dark:text-emerald-400">
                                В норме
                              </span>
                            ) : null}
                          </div>

                          {/* Строка 2: Количество устройств слева <----> Ответственный справа */}
                          <div className="flex items-center justify-between gap-2 text-[10px]">
                            <span className="text-muted-foreground font-medium uppercase tracking-wider">
                              {mainDeviceCount}{" "}
                              {mainDeviceCount === 1
                                ? "устройство"
                                : mainDeviceCount > 1 && mainDeviceCount < 5
                                  ? "устройства"
                                  : "устройств"}
                            </span>

                            <div
                              className="flex items-center gap-1.5 shrink-0"
                              title={
                                ws.assigned_user_name || "Не назначено"
                              }
                            >
                              <User
                                className={cn(
                                  "h-3 w-3",
                                  ws.assigned_user_name
                                    ? "text-primary"
                                    : "text-muted-foreground/70",
                                )}
                              />
                              <span
                                className={cn(
                                  "max-w-[110px] truncate font-medium",
                                  ws.assigned_user_name
                                    ? "text-primary"
                                    : "text-muted-foreground/70",
                                )}
                              >
                                {ws.assigned_user_name || "Не назначено"}
                              </span>
                            </div>
                          </div>
                        </CardHeader>

                        <CardContent className="p-4 flex-1 bg-card">
                          {wsEquipment.length === 0 ? (
                            <div className="h-full min-h-25 flex flex-col items-center justify-center text-center border-2 border-dashed border-border/50 rounded-lg p-4 bg-accent/10">
                              <Monitor className="h-8 w-8 text-muted-foreground/30 mb-2" />
                              <p className="text-xs text-muted-foreground font-medium">
                                Пусто
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {(() => {
                                const renderItemRow = (
                                  item: any,
                                  isSubItem = false,
                                  componentCount = 0,
                                ) => {
                                  const isExpandable = componentCount > 0;
                                  const isExpanded = expandedPcIds.includes(
                                    item.id,
                                  );

                                  return (
                                    <div
                                      key={item.id}
                                      onClick={(e) => {
                                        if (isExpandable) {
                                          togglePcExpansion(e, item.id);
                                        }
                                      }}
                                      className={cn(
                                        "flex items-center justify-between p-2 rounded-lg bg-background border border-border/50 relative overflow-hidden transition-colors hover:border-primary/20 hover:bg-primary/5",
                                        isExpandable && "cursor-pointer",
                                        isSubItem && "ml-4 bg-background/50",
                                      )}
                                    >
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center justify-between gap-2">
                                          <p className="text-xs font-semibold truncate text-foreground group-hover/item:text-primary">
                                            {item.name}
                                          </p>
                                          {isExpandable && (
                                            <span className="text-[10px] text-muted-foreground shrink-0">
                                              Комплектующие: {componentCount}
                                            </span>
                                          )}
                                        </div>
                                        <MaintenanceSegmentedBar
                                          progress={
                                            progressByItemId.get(item.id) ??
                                            getMaintenanceProgress(item)
                                          }
                                        />
                                      </div>

                                      {isExpandable && (
                                        <div className="flex shrink-0 items-center pl-2">
                                          <ChevronRight
                                            className={cn(
                                              "h-4 w-4 text-muted-foreground transition-transform",
                                              isExpanded && "rotate-90",
                                            )}
                                          />
                                        </div>
                                      )}
                                    </div>
                                  );
                                };

                                return (
                                  <>
                                    {pcItem && (
                                      <div className="space-y-1.5">
                                        {renderItemRow(
                                          pcItem,
                                          false,
                                          componentItems.length,
                                        )}
                                        {componentItems.length > 0 &&
                                          expandedPcIds.includes(pcItem.id) && (
                                            <div className="ml-2 animate-in fade-in slide-in-from-top-1 space-y-1.5 border-l-2 border-slate-100 duration-200">
                                              {componentItems.map((item) =>
                                                renderItemRow(item, true),
                                              )}
                                            </div>
                                          )}
                                      </div>
                                    )}
                                    {peripheralItems.map((item) =>
                                      renderItemRow(item),
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
              </div>
            </section>
          ))
        )}
      </div>

      {/* Workstation Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="sm:max-w-4xl p-0 overflow-hidden bg-background border-border dark text-foreground">
          <DialogHeader className="px-6 py-4 border-b border-border bg-card">
            <DialogTitle className="text-xl">
              {activeWorkstation
                ? `Оборудование: ${activeWorkstation.name}`
                : "Рабочее место"}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Выберите устройство для перемещения или сообщите о проблеме.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 space-y-4 max-h-[70vh]">
            {activeEquipment.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground bg-card rounded-xl border border-border">
                Нет оборудования на этом месте.
              </div>
            ) : (
              (() => {
                const pcItem = activeEquipment.find((i) => i.type === "PC");
                const componentItems = activeEquipment.filter(
                  (i) =>
                    i.type !== "PC" &&
                    (i.parent_equipment_id === pcItem?.id ||
                      COMPONENT_TYPES.includes(i.type)),
                );
                const peripheralItems = activeEquipment.filter(
                  (i) =>
                    i.id !== pcItem?.id &&
                    !componentItems.find((c) => c.id === i.id),
                );

                const renderDialogItemRow = (
                  item: Equipment,
                  isSubItem = false,
                  componentCount = 0,
                ) => {
                  const isExpandable = componentCount > 0;
                  const isExpanded = expandedPcIds.includes(item.id);

                  return (
                    <div
                      key={item.id}
                      className={cn(
                        "flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-border bg-card hover:bg-accent/10 transition-colors gap-4",
                        isSubItem && "ml-4 sm:ml-8 mt-2",
                      )}
                    >
                      <div
                        className="flex items-center gap-4 overflow-hidden flex-1 cursor-pointer"
                        onClick={(e) => {
                          if (isExpandable) {
                            togglePcExpansion(e, item.id);
                          }
                        }}
                      >
                        <div className="h-12 w-12 rounded-xl bg-background border border-border flex items-center justify-center text-muted-foreground shrink-0 shadow-sm relative">
                          {getEquipmentIcon(item.type, item.type_icon)}
                          {isExpandable && (
                            <div className="absolute -right-1 -bottom-1 h-5 w-5 rounded-full bg-primary flex items-center justify-center text-white border-2 border-background">
                              <ChevronRight
                                className={cn(
                                  "h-3 w-3 transition-transform",
                                  isExpanded && "rotate-90",
                                )}
                              />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-base truncate text-foreground">
                            {item.name}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge
                              variant="secondary"
                              className="text-[10px] h-5 px-1.5 font-normal bg-accent text-muted-foreground border-none"
                            >
                              {item.type_name || item.type}
                            </Badge>
                            {isExpandable && (
                              <Badge
                                variant="outline"
                                className="text-[10px] h-5 px-1.5 font-normal border-border"
                              >
                                Комплектующие: {componentCount}
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground truncate">
                              {item.brand} {item.model}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            {!isSubItem && (
                              <div className="w-full max-w-xs mt-1">
                                <MaintenanceSegmentedBar
                                  progress={getMaintenanceProgress(item)}
                                />
                              </div>
                            )}
                            {(activeIssueCountByEquipmentId.get(item.id) ?? 0) >
                            0 ? (
                              <Badge
                                variant="outline"
                                className="border-orange-200 bg-orange-50 text-orange-700"
                              >
                                Проблем:{" "}
                                {activeIssueCountByEquipmentId.get(item.id)}
                              </Badge>
                            ) : null}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 sm:flex-none gap-2 bg-card border-border hover:bg-accent text-foreground hover:text-foreground"
                          onClick={() => handleOpenReportIssue(item)}
                        >
                          <AlertTriangle className="h-4 w-4 text-amber-500" />
                          Проблема
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1 sm:flex-none gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
                          onClick={() => handleOpenMoveDialog(item)}
                        >
                          <ArrowRightLeft className="h-4 w-4" />
                          Переместить
                        </Button>
                      </div>
                    </div>
                  );
                };

                return (
                  <div className="space-y-4">
                    {pcItem && (
                      <div className="space-y-2">
                        {renderDialogItemRow(
                          pcItem,
                          false,
                          componentItems.length,
                        )}
                        {componentItems.length > 0 &&
                          expandedPcIds.includes(pcItem.id) && (
                            <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                              {componentItems.map((item) =>
                                renderDialogItemRow(item, true),
                              )}
                            </div>
                          )}
                      </div>
                    )}
                    {peripheralItems.map((item) => renderDialogItemRow(item))}
                  </div>
                );
              })()
            )}
          </div>

          <DialogFooter className="p-4 border-t border-border bg-accent/10 mt-auto">
            <Button
              variant="ghost"
              onClick={() => setIsDetailsOpen(false)}
              className="w-full sm:w-auto hover:bg-accent"
            >
              Закрыть
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move/Swap Dialog */}
      <Dialog open={isMoveDialogOpen} onOpenChange={setIsMoveDialogOpen}>
        <DialogContent className="sm:max-w-2xl p-0 overflow-hidden bg-card border-border dark text-foreground">
          <DialogHeader className="px-6 py-4 border-b border-border bg-accent/30">
            <DialogTitle className="text-xl">
              Перемещение оборудования
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {selectedEquipment?.name} ({selectedEquipment?.type_name})
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 space-y-6 max-h-[70vh]">
            {/* From / To Indicator */}
            <div className="flex items-center justify-between p-4 bg-accent/30 rounded-xl border border-border">
              <div className="flex-1">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">
                  Откуда
                </p>
                <p className="font-bold text-sm text-foreground">
                  {workstations.find(
                    (w) => w.id === selectedEquipment?.workstation_id,
                  )?.name || "Склад"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {workstations.find(
                    (w) => w.id === selectedEquipment?.workstation_id,
                  )?.zone || "Зона хранения"}
                </p>
              </div>
              <div className="px-4">
                <ArrowRight className="h-5 w-5 text-muted-foreground/30" />
              </div>
              <div className="flex-1 text-right">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">
                  Куда
                </p>
                {moveAction === "REPLACE" ? (
                  <div className="flex flex-col items-end">
                    <p className="font-bold text-sm text-amber-600">Склад</p>
                    <p className="text-xs text-amber-600/70">
                      Списание / Ремонт
                    </p>
                  </div>
                ) : targetWorkstationId ? (
                  <div className="flex flex-col items-end">
                    <p className="font-bold text-sm text-primary">
                      {
                        workstations.find((w) => w.id === targetWorkstationId)
                          ?.name
                      }
                    </p>
                    <p className="text-xs text-primary/70">
                      {
                        workstations.find((w) => w.id === targetWorkstationId)
                          ?.zone
                      }
                    </p>
                  </div>
                ) : (
                  <p className="font-bold text-sm text-muted-foreground/70">
                    Выберите место
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div
                className={cn(
                  "cursor-pointer rounded-xl border p-4 flex flex-col items-center gap-2 transition-all hover:bg-accent/50",
                  moveAction === "SWAP"
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border text-foreground",
                )}
                onClick={() => setMoveAction("SWAP")}
              >
                <ArrowRightLeft
                  className={cn(
                    "h-6 w-6",
                    moveAction === "SWAP"
                      ? "text-primary"
                      : "text-muted-foreground/70",
                  )}
                />
                <span className="font-semibold text-sm">Переместить</span>
                <span className="text-xs text-center text-muted-foreground">
                  На другое место
                </span>
              </div>
              <div
                className={cn(
                  "cursor-pointer rounded-xl border p-4 flex flex-col items-center gap-2 transition-all hover:bg-accent/50",
                  moveAction === "REPLACE"
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border text-foreground",
                )}
                onClick={() => setMoveAction("REPLACE")}
              >
                <Warehouse
                  className={cn(
                    "h-6 w-6",
                    moveAction === "REPLACE"
                      ? "text-primary"
                      : "text-muted-foreground/70",
                  )}
                />
                <span className="font-semibold text-sm">На склад</span>
                <span className="text-xs text-center text-muted-foreground">
                  Поломка / Замена
                </span>
              </div>
            </div>

            {moveAction === "SWAP" && (
              <div className="space-y-2">
                <Label>Выберите новое место</Label>
                <Select
                  value={targetWorkstationId}
                  onValueChange={setTargetWorkstationId}
                >
                  <SelectTrigger className="h-12 bg-background border-border">
                    <SelectValue placeholder="Нажмите для выбора..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-75">
                    {availableTargets.map((ws) => (
                      <SelectItem key={ws.id} value={ws.id}>
                        {ws.name} ({ws.zone})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {targetWorkstationId &&
                  (() => {
                    // Check if target has equipment of same type
                    const targetHasSameType = equipment.some(
                      (e) =>
                        e.workstation_id === targetWorkstationId &&
                        e.type === selectedEquipment?.type,
                    );

                    if (targetHasSameType) {
                      return (
                        <div className="flex items-start gap-2 p-3 bg-amber-500/10 text-amber-500 rounded-md text-xs mt-2 border border-amber-500/20">
                          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                          <p>
                            На выбранном месте уже есть устройство такого типа.
                            Они поменяются местами (SWAP).
                          </p>
                        </div>
                      );
                    }
                    return (
                      <div className="flex items-start gap-2 p-3 bg-primary/10 text-primary rounded-md text-xs mt-2 border border-primary/20">
                        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                        <p>Устройство будет перемещено на выбранное место.</p>
                      </div>
                    );
                  })()}
              </div>
            )}

            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between p-4 rounded-xl border border-border">
                <div className="space-y-0.5">
                  <Label className="text-base">Есть проблема?</Label>
                  <p className="text-xs text-muted-foreground">
                    Создать инцидент при перемещении
                  </p>
                </div>
                <Switch
                  checked={isMoveWithIssue}
                  onCheckedChange={setIsMoveWithIssue}
                />
              </div>

              <div className="space-y-2">
                <Label>
                  {isMoveWithIssue ? "Опишите проблему" : "Причина перемещения"}
                  <span className="text-rose-500 ml-1">*</span>
                </Label>
                <Textarea
                  placeholder={
                    isMoveWithIssue
                      ? "Что сломалось? Опишите неисправность..."
                      : moveAction === "REPLACE"
                        ? "Почему отправляете на склад?"
                        : "Почему перемещаете устройство?"
                  }
                  value={moveReason}
                  onChange={(e) => setMoveReason(e.target.value)}
                  className="min-h-25 text-base p-4 bg-background border-border"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="p-4 border-t border-border bg-accent/10 mt-auto">
            <Button
              variant="ghost"
              onClick={() => setIsMoveDialogOpen(false)}
              className="w-full sm:w-auto hover:bg-accent"
            >
              Отмена
            </Button>
            <Button
              onClick={handleMoveSubmit}
              disabled={isSubmitting}
              className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {moveAction === "SWAP" ? "Переместить" : "На склад"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Report Issue Dialog */}
      <Dialog open={isReportIssueOpen} onOpenChange={setIsReportIssueOpen}>
        <DialogContent className="sm:max-w-xl p-0 overflow-hidden bg-card border-border dark text-foreground">
          <DialogHeader className="px-6 py-4 border-b border-border bg-accent/30">
            <DialogTitle className="text-xl">Сообщить о проблеме</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {selectedEquipment?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 p-6">
            <div className="space-y-2">
              <Label>
                Что случилось? <span className="text-rose-500">*</span>
              </Label>
              <Input
                placeholder="Краткое название проблемы"
                value={issueTitle}
                onChange={(e) => setIssueTitle(e.target.value)}
                className="bg-background border-border"
              />
            </div>
            <div className="space-y-2">
              <Label>Подробности</Label>
              <Textarea
                placeholder="Опишите детали, как воспроизвести..."
                value={issueDescription}
                onChange={(e) => setIssueDescription(e.target.value)}
                className="min-h-25 bg-background border-border"
              />
            </div>
          </div>

          <DialogFooter className="p-4 border-t border-border bg-accent/10 mt-auto">
            <Button
              variant="ghost"
              onClick={() => setIsReportIssueOpen(false)}
              className="w-full sm:w-auto hover:bg-accent"
            >
              Отмена
            </Button>
            <Button
              onClick={handleReportIssueSubmit}
              disabled={isSubmitting}
              className="w-full sm:w-auto bg-rose-500 hover:bg-rose-600 text-white"
            >
              {isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Отправить отчет
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {Dialogs}
    </div>
  );
}
