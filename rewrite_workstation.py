import re

with open("src/app/clubs/[clubId]/equipment/workplaces/[workstationId]/page.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Replace main wrapper
content = content.replace(
    '<div className="mx-auto max-w-[1200px] space-y-5 p-4 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:space-y-6 sm:p-6 md:pb-8 lg:p-8">',
    '<PageShell maxWidth="5xl">\n            <div className="space-y-8 pb-28 sm:pb-12">'
)
content = content.replace(
    '        </div>\n    )\n}',
    '            </div>\n        </PageShell>\n    )\n}'
)
if 'import { PageShell }' not in content:
    content = content.replace('import { cn } from "@/lib/utils"', 'import { cn } from "@/lib/utils"\nimport { PageShell } from "@/components/layout/PageShell"')

# Header redesign
content = content.replace(
    '<div className="hidden md:flex md:flex-wrap md:items-center md:justify-between md:gap-3">',
    '<div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between mb-8">'
)

content = content.replace(
    '<Button asChild variant="outline">',
    '<Button asChild variant="outline" className="rounded-xl h-11 px-6 font-medium">'
)
content = content.replace(
    '<Button variant="outline" onClick={() => handleEdit(workstation)}>',
    '<Button variant="outline" className="rounded-xl h-11 px-6 font-medium" onClick={() => handleEdit(workstation)}>'
)
content = content.replace(
    '<Button\n                        variant="outline"\n                        className="border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700"\n                        disabled={deletingWorkstationId === workstation.id}\n                        onClick={() => requestDeleteWorkstation(workstation.id)}\n                    >',
    '<Button\n                        variant="outline"\n                        className="border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 rounded-xl h-11 px-6 font-medium"\n                        disabled={deletingWorkstationId === workstation.id}\n                        onClick={() => requestDeleteWorkstation(workstation.id)}\n                    >'
)

# Convert Cards to Divs
content = re.sub(r'<Card className="border-slate-200 shadow-sm">', '<div className="bg-white rounded-3xl border border-slate-200 shadow-sm">', content)
content = re.sub(r'<Card className="border-slate-200">', '<div className="bg-white rounded-3xl border border-slate-200 shadow-sm">', content)
content = re.sub(r'</Card>', '</div>', content)

content = re.sub(r'<CardContent className="p-5 sm:p-6">', '<div className="p-6 sm:p-8">', content)
content = re.sub(r'<CardContent className="space-y-4 p-5 sm:p-6">', '<div className="space-y-6 p-6 sm:p-8">', content)
content = re.sub(r'<CardContent className="space-y-2">', '<div className="space-y-4 p-6 sm:p-8 pt-0">', content)
content = re.sub(r'<CardContent className="space-y-3">', '<div className="space-y-6 p-6 sm:p-8 pt-0">', content)
content = re.sub(r'<CardContent>', '<div className="p-6 sm:p-8 pt-0">', content)
content = re.sub(r'</CardContent>', '</div>', content)

content = re.sub(r'<CardHeader className="pb-2">', '<div className="p-6 sm:p-8 pb-4">', content)
content = re.sub(r'<CardHeader className="gap-4 pb-2">', '<div className="p-6 sm:p-8 pb-4 flex flex-col gap-4">', content)
content = re.sub(r'</CardHeader>', '</div>', content)

content = re.sub(r'<CardTitle className="text-base">', '<h3 className="text-lg font-bold text-slate-900">', content)
content = re.sub(r'</CardTitle>', '</h3>', content)

content = re.sub(r'<CardDescription>', '<p className="text-sm text-slate-500 mt-1">', content)
content = re.sub(r'</CardDescription>', '</p>', content)


# Titles
content = content.replace(
    '<h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{workstation.name}</h1>',
    '<h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900 truncate">{workstation.name}</h1>'
)
content = content.replace(
    '<p className="mt-1 text-sm text-muted-foreground">Карточка рабочего места и привязанного оборудования</p>',
    '<p className="text-slate-500 text-lg mt-2">Карточка рабочего места и привязанного оборудования</p>'
)

# Tabs
content = content.replace(
    '<TabsList className="h-auto w-full justify-start gap-4 overflow-x-auto rounded-none border-b bg-transparent p-0">',
    '<TabsList className="w-full md:w-auto bg-slate-100/50 border border-slate-200 p-1.5 rounded-2xl mb-8 shadow-sm flex overflow-x-auto justify-start">'
)
content = content.replace(
    '<TabsTrigger value="equipment" variant="underline" className="shrink-0 px-0">',
    '<TabsTrigger value="equipment" className="rounded-xl px-6 py-2.5 font-medium text-slate-500 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm transition-all shrink-0">'
)
content = content.replace(
    '<TabsTrigger value="maintenance" variant="underline" className="shrink-0 px-0">',
    '<TabsTrigger value="maintenance" className="rounded-xl px-6 py-2.5 font-medium text-slate-500 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm transition-all shrink-0">'
)
content = content.replace(
    '<TabsTrigger value="history" variant="underline" className="shrink-0 px-0">',
    '<TabsTrigger value="history" className="rounded-xl px-6 py-2.5 font-medium text-slate-500 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm transition-all shrink-0">'
)


# Select
content = content.replace(
    '<SelectTrigger className="w-full">',
    '<SelectTrigger className="w-full h-12 bg-slate-50/50 border-slate-200 rounded-xl font-medium text-slate-900 focus:bg-white">'
)

# Small updates
content = content.replace(
    '<Button size="sm" className="w-full shrink-0 sm:w-auto" onClick={() => setIsAssignDialogOpen(true)}>',
    '<Button className="w-full shrink-0 sm:w-auto rounded-xl bg-slate-900 text-white hover:bg-slate-800" onClick={() => setIsAssignDialogOpen(true)}>'
)
content = content.replace(
    '<Button size="sm" variant="outline" className="w-full sm:w-auto" onClick={() => setIsAssignDialogOpen(true)}>',
    '<Button variant="outline" className="w-full sm:w-auto rounded-xl font-medium" onClick={() => setIsAssignDialogOpen(true)}>'
)

# Unassign Dialog
content = content.replace(
    '<DialogContent className="[&>button]:hidden sm:max-w-md">',
    '<DialogContent className="[&>button]:hidden sm:max-w-md rounded-3xl p-6 sm:p-8">'
)
content = content.replace(
    '<DialogTitle className="flex items-center gap-2">',
    '<DialogTitle className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900 mb-2">'
)
content = content.replace(
    '<Button variant="outline" onClick={() => setPendingUnassignEquipmentId(null)} disabled={Boolean(isUnassigningEquipmentId)}>',
    '<Button variant="ghost" className="rounded-xl font-bold" onClick={() => setPendingUnassignEquipmentId(null)} disabled={Boolean(isUnassigningEquipmentId)}>'
)
content = content.replace(
    '<Button variant="destructive" onClick={confirmUnassignEquipment} disabled={Boolean(isUnassigningEquipmentId)}>',
    '<Button className="rounded-xl font-bold bg-rose-600 hover:bg-rose-700 text-white" onClick={confirmUnassignEquipment} disabled={Boolean(isUnassigningEquipmentId)}>'
)

# Delete Dialog
content = content.replace(
    '<DialogContent className="[&>button]:hidden sm:max-w-lg">',
    '<DialogContent className="[&>button]:hidden sm:max-w-lg rounded-3xl p-6 sm:p-8">'
)
content = content.replace(
    '<Button\n                            variant="outline"\n                            onClick={() => setPendingDeleteWorkstationId(null)}\n                            disabled={Boolean(deletingWorkstationId)}\n                        >',
    '<Button\n                            variant="ghost"\n                            className="rounded-xl font-bold"\n                            onClick={() => setPendingDeleteWorkstationId(null)}\n                            disabled={Boolean(deletingWorkstationId)}\n                        >'
)
content = content.replace(
    '<Button\n                            variant="destructive"\n                            onClick={() => pendingDeleteWorkstationId && handleDeleteWorkstation(pendingDeleteWorkstationId)}\n                            disabled={Boolean(deletingWorkstationId)}\n                        >',
    '<Button\n                            className="rounded-xl font-bold bg-rose-600 hover:bg-rose-700 text-white"\n                            onClick={() => pendingDeleteWorkstationId && handleDeleteWorkstation(pendingDeleteWorkstationId)}\n                            disabled={Boolean(deletingWorkstationId)}\n                        >'
)

# Mobile menu
content = content.replace(
    '<div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden">',
    '<div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/80 p-4 backdrop-blur-xl md:hidden pb-[calc(1rem+env(safe-area-inset-bottom))]">'
)
content = content.replace(
    '<div className="mx-auto flex max-w-7xl gap-2">',
    '<div className="mx-auto flex max-w-[1600px] gap-2">'
)
content = content.replace(
    '<Button asChild variant="outline" className="h-11 flex-1">',
    '<Button asChild variant="outline" className="flex-1 h-12 rounded-xl border-slate-200 text-slate-700 bg-white font-medium">'
)


with open("src/app/clubs/[clubId]/equipment/workplaces/[workstationId]/page.tsx", "w", encoding="utf-8") as f:
    f.write(content)

