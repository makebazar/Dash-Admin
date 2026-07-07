"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Layers, CheckCircle2, User } from "lucide-react";
import { ImageViewer } from "@/components/ui/image-viewer";
import { PageShell } from "@/components/layout/PageShell";

import { useEquipmentTasks } from "./_hooks/useEquipmentTasks";
import { useChecklists } from "./_hooks/useChecklists";
import { useShifts } from "./_hooks/useShifts";

import { EquipmentTab } from "./_components/EquipmentTab";
import { ChecklistsTab } from "./_components/ChecklistsTab";
import { ShiftsTab } from "./_components/ShiftsTab";

export default function ChecklistsPage({
  params,
  searchParams,
}: {
  params: Promise<{ clubId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [clubId, setClubId] = useState("");
  const [activeTab, setActiveTab] = useState("equipment");

  // Custom hooks
  const equipment = useEquipmentTasks(clubId);
  const checklists = useChecklists(clubId);
  const shifts = useShifts(clubId);

  useEffect(() => {
    Promise.all([params, searchParams]).then(([p, sp]) => {
      setClubId(p.clubId);
      if (
        sp.tab === "equipment" ||
        sp.tab === "checklists" ||
        sp.tab === "shifts"
      ) {
        setActiveTab(sp.tab);
      }
    });
  }, [params, searchParams]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", value);
    window.history.pushState({}, "", url.toString());
  };

  const handleViewEvaluation = (evaluationId: number) => {
    window.location.href = `/clubs/${clubId}/reviews/${evaluationId}`;
  };

  const pendingTasks = equipment.tasks.length;
  const pendingEvaluations = checklists.pendingEvaluations;
  const pendingShifts = shifts.pendingShifts;

  return (
    <PageShell maxWidth="5xl">
      <div className="space-y-8 pb-28 sm:pb-12">
        {/* Page header */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between mb-8">
            <div className="min-w-0">
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900 truncate">
                Центр проверок
              </h1>
              <p className="text-slate-500 text-lg mt-2">
                Единый центр контроля качества и выполненных работ
              </p>
            </div>
          </div>
        </div>

        {/* Main tabs */}
        <Tabs
          defaultValue="equipment"
          value={activeTab}
          onValueChange={handleTabChange}
          className="w-full"
        >
          <div className="flex justify-start mb-8 border-b border-slate-200">
            <TabsList className="flex h-auto w-full justify-start gap-8 overflow-x-auto rounded-none bg-transparent p-0">
              <TabsTrigger
                value="equipment"
                className="relative shrink-0 rounded-none border-b-2 border-transparent px-0 pb-4 pt-2 font-medium text-slate-500 hover:text-slate-700 data-[state=active]:border-slate-900 data-[state=active]:text-slate-900 data-[state=active]:shadow-none data-[state=active]:bg-transparent transition-all gap-2"
              >
                <Layers className="h-4 w-4" />
                Оборудование
                {pendingTasks > 0 && (
                  <Badge
                    variant="secondary"
                    className="ml-2 h-5 px-1.5 bg-slate-100 text-slate-900"
                  >
                    {pendingTasks}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="checklists"
                className="relative shrink-0 rounded-none border-b-2 border-transparent px-0 pb-4 pt-2 font-medium text-slate-500 hover:text-slate-700 data-[state=active]:border-slate-900 data-[state=active]:text-slate-900 data-[state=active]:shadow-none data-[state=active]:bg-transparent transition-all gap-2"
              >
                <CheckCircle2 className="h-4 w-4" />
                Чеклисты
                {pendingEvaluations > 0 && (
                  <Badge
                    variant="secondary"
                    className="ml-2 h-5 px-1.5 bg-slate-100 text-slate-900"
                  >
                    {pendingEvaluations}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="shifts"
                className="relative shrink-0 rounded-none border-b-2 border-transparent px-0 pb-4 pt-2 font-medium text-slate-500 hover:text-slate-700 data-[state=active]:border-slate-900 data-[state=active]:text-slate-900 data-[state=active]:shadow-none data-[state=active]:bg-transparent transition-all gap-2"
              >
                <User className="h-4 w-4" />
                Смены
                {pendingShifts > 0 && (
                  <Badge
                    variant="secondary"
                    className="ml-2 h-5 px-1.5 bg-slate-100 text-slate-900"
                  >
                    {pendingShifts}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Equipment Tab */}
          <TabsContent value="equipment">
            <EquipmentTab clubId={clubId} {...equipment} />
          </TabsContent>

          {/* Checklists Tab */}
          <TabsContent value="checklists">
            <ChecklistsTab
              clubId={clubId}
              {...checklists}
              onViewEvaluation={handleViewEvaluation}
            />
          </TabsContent>

          {/* Shifts Tab */}
          <TabsContent value="shifts">
            <ShiftsTab clubId={clubId} {...shifts} />
          </TabsContent>
        </Tabs>

        {/* Image viewer for equipment task photos */}
        <ImageViewer
          open={equipment.viewerOpen}
          onOpenChange={equipment.setViewerOpen}
          src={equipment.viewerImage}
          photos={equipment.currentTaskPhotos}
          onNext={equipment.handleNextImage}
          onPrev={equipment.handlePrevImage}
        />
      </div>
    </PageShell>
  );
}
