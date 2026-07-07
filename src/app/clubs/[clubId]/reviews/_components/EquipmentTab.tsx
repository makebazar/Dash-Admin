"use client";

import { format } from "date-fns";
import { ru } from "date-fns/locale";
import {
  Loader2,
  CheckCircle2,
  Filter,
  User,
  Layers,
  Calendar,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { UseEquipmentTasksReturn } from "../_hooks/useEquipmentTasks";
import { ZoneSection } from "./ZoneSection";

interface EquipmentTabProps extends UseEquipmentTasksReturn {
  clubId: string;
}

export function EquipmentTab({
  clubId,
  tasks,
  setTasks,
  isTasksLoading,
  expandedTaskId,
  comment,
  setComment,
  reworkPhotos,
  setReworkPhotos,
  reworkPhotosPreviews,
  setReworkPhotosPreviews,
  isSubmittingTask,
  isSubmittingBatch,
  setIsSubmittingBatch,
  selectedTaskIds,
  setSelectedTaskIds,
  filterZone,
  setFilterZone,
  filterEmployee,
  setFilterEmployee,
  filterStatus,
  setFilterStatus,
  filterMonth,
  setFilterMonth,
  equipmentTab,
  setEquipmentTab,
  zones,
  employees,
  months,
  currentMonthIndex,
  groupedTasks,
  fetchTasks,
  handleVerifyTask,
  handleRevertTask,
  handleSendToLaundry,
  openImage,
  toggleExpand,
}: EquipmentTabProps) {
  return (
    <div className="space-y-6">
      {/* Inner sub-tabs: active / history */}
      <Tabs
        value={equipmentTab}
        onValueChange={(v) => setEquipmentTab(v as "active" | "history")}
        className="w-full"
      >
        <TabsList className="flex h-auto w-full justify-start gap-6 overflow-x-auto rounded-none bg-transparent p-0 mb-6">
          <TabsTrigger
            value="active"
            className="relative shrink-0 rounded-none border-b-2 border-transparent px-0 pb-2 pt-1 font-medium text-slate-500 hover:text-slate-700 data-[state=active]:border-slate-900 data-[state=active]:text-slate-900 data-[state=active]:shadow-none data-[state=active]:bg-transparent transition-all"
          >
            Ожидают проверки
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="relative shrink-0 rounded-none border-b-2 border-transparent px-0 pb-2 pt-1 font-medium text-slate-500 hover:text-slate-700 data-[state=active]:border-slate-900 data-[state=active]:text-slate-900 data-[state=active]:shadow-none data-[state=active]:bg-transparent transition-all"
          >
            История
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Filters */}
      {tasks.length > 0 && (
        <div className="mb-6 flex flex-col gap-4 border-b border-slate-100 pb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="h-10 w-[180px] rounded-xl border-slate-200 bg-white font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus:ring-0">
                  <div className="flex items-center truncate">
                    <Filter className="mr-2 h-4 w-4 text-slate-400 shrink-0" />
                    <SelectValue placeholder="Статус" />
                  </div>
                </SelectTrigger>
                <SelectContent className="rounded-xl border-slate-200 shadow-lg">
                  <SelectItem value="all">Все статусы</SelectItem>
                  {equipmentTab === "active" ? (
                    <>
                      <SelectItem value="PENDING">Ожидает</SelectItem>
                      <SelectItem value="REJECTED">На доработке</SelectItem>
                    </>
                  ) : (
                    <>
                      <SelectItem value="APPROVED">Одобрено</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>

              {equipmentTab === "active" && (
                <Select value={filterZone} onValueChange={setFilterZone}>
                  <SelectTrigger className="h-10 w-[180px] rounded-xl border-slate-200 bg-white font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus:ring-0">
                    <div className="flex items-center truncate">
                      <Layers className="mr-2 h-4 w-4 text-slate-400 shrink-0" />
                      <SelectValue placeholder="Зона" />
                    </div>
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-slate-200 shadow-lg">
                    <SelectItem value="all">Все зоны</SelectItem>
                    {zones.map((z) => (
                      <SelectItem key={z} value={z}>
                        {z}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <Select value={filterEmployee} onValueChange={setFilterEmployee}>
                <SelectTrigger className="h-10 w-[180px] rounded-xl border-slate-200 bg-white font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus:ring-0">
                  <div className="flex items-center truncate">
                    <User className="mr-2 h-4 w-4 text-slate-400 shrink-0" />
                    <SelectValue placeholder="Сотрудник" />
                  </div>
                </SelectTrigger>
                <SelectContent className="rounded-xl border-slate-200 shadow-lg">
                  <SelectItem value="all">Все сотрудники</SelectItem>
                  {employees.map((e) => (
                    <SelectItem key={e} value={e}>
                      {e}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {equipmentTab === "history" && (
                <div className="flex items-center justify-between rounded-xl bg-white border border-slate-200 shadow-sm px-3 h-10 w-[240px]">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-900"
                    onClick={() => {
                      const nextIndex = currentMonthIndex + 1;
                      if (nextIndex < months.length) {
                        setFilterMonth(months[nextIndex]);
                      }
                    }}
                    disabled={
                      currentMonthIndex === -1 ||
                      currentMonthIndex >= months.length - 1
                    }
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
                    <span className="text-sm font-medium text-slate-700 truncate">
                      {filterMonth === "all"
                        ? "Все месяцы"
                        : format(
                            new Date(`${filterMonth}-01`),
                            "MMMM yyyy",
                            { locale: ru },
                          )}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-900"
                    onClick={() => {
                      const nextIndex = currentMonthIndex - 1;
                      if (nextIndex >= 0) {
                        setFilterMonth(months[nextIndex]);
                      }
                    }}
                    disabled={currentMonthIndex <= 0}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-0 border-slate-100 pt-3 sm:pt-0 mt-2 sm:mt-0">
              <div className="text-sm font-medium text-slate-500">
                Показано:{" "}
                <span className="text-slate-900">
                  {groupedTasks.reduce((acc, [_, zoneTasks]) => acc + zoneTasks.length, 0)}
                </span>{" "}
                задач
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => fetchTasks(clubId, equipmentTab)}
                disabled={isTasksLoading}
                className="h-9 w-9 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-900 shrink-0"
              >
                <RotateCcw
                  className={cn("h-4 w-4", isTasksLoading && "animate-spin")}
                />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {isTasksLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-muted-foreground" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground bg-muted/10 rounded-xl border border-dashed">
          <CheckCircle2 className="mx-auto h-12 w-12 text-green-500 mb-4 opacity-50" />
          <h3 className="text-lg font-medium text-foreground">Все проверено!</h3>
          <p>Нет задач по оборудованию, ожидающих проверки.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {groupedTasks.map(([zoneName, zoneTasks]) => (
            <ZoneSection
              key={zoneName}
              zoneName={zoneName}
              zoneTasks={zoneTasks}
              clubId={clubId}
              equipmentTab={equipmentTab}
              expandedTaskId={expandedTaskId}
              comment={comment}
              setComment={setComment}
              reworkPhotos={reworkPhotos}
              setReworkPhotos={setReworkPhotos}
              reworkPhotosPreviews={reworkPhotosPreviews}
              setReworkPhotosPreviews={setReworkPhotosPreviews}
              isSubmittingTask={isSubmittingTask}
              isSubmittingBatch={isSubmittingBatch}
              setIsSubmittingBatch={setIsSubmittingBatch}
              selectedTaskIds={selectedTaskIds}
              setSelectedTaskIds={setSelectedTaskIds}
              setTasks={setTasks}
              openImage={openImage}
              toggleExpand={toggleExpand}
              handleVerifyTask={handleVerifyTask}
              handleRevertTask={handleRevertTask}
              handleSendToLaundry={handleSendToLaundry}
            />
          ))}
        </div>
      )}
    </div>
  );
}
