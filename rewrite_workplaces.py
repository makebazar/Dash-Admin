import re

with open("src/app/clubs/[clubId]/equipment/workplaces/page.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Replace main wrapper
content = content.replace(
    '<div className="mx-auto max-w-[1600px] space-y-6 p-4 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:space-y-8 sm:p-6 sm:pb-[calc(6.5rem+env(safe-area-inset-bottom))] md:pb-8 lg:p-8">',
    '<PageShell maxWidth="5xl">\n            <div className="space-y-8 pb-28 sm:pb-12">'
)
content = content.replace(
    '        </div>\n    )\n}',
    '            </div>\n        </PageShell>\n    )\n}'
)

# Header redesign
content = content.replace(
    '<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">',
    '<div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between mb-8">'
)
content = content.replace(
    '<h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Рабочие места</h1>',
    '<h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900 truncate">Рабочие места</h1>'
)
content = content.replace(
    '<p className="mt-1 text-sm text-muted-foreground sm:text-base">Обзор зон, мест и подключенного оборудования</p>',
    '<p className="text-slate-500 text-lg mt-2">Обзор зон, мест и подключенного оборудования</p>'
)

# Buttons redesign
content = content.replace(
    '<Button asChild variant="outline" className="hidden w-full md:inline-flex md:w-auto">',
    '<Button asChild variant="outline" className="hidden w-full md:inline-flex md:w-auto rounded-xl h-11 px-6 font-medium">'
)
content = content.replace(
    '<Button asChild variant="outline" className="w-full sm:w-auto">',
    '<Button asChild variant="outline" className="w-full sm:w-auto rounded-xl h-11 px-6 font-medium">'
)
content = content.replace(
    '<Button onClick={() => handleCreate()} disabled={zones.length === 0} className="w-full bg-primary shadow-md hover:bg-primary/90 disabled:opacity-60 sm:w-auto">',
    '<Button onClick={() => handleCreate()} disabled={zones.length === 0} className="w-full bg-slate-900 text-white shadow-sm hover:bg-slate-800 disabled:opacity-60 sm:w-auto rounded-xl h-11 px-6 font-medium">'
)

# Dialog Unassign Redesign
content = content.replace(
    '<DialogContent className="[&>button]:hidden sm:max-w-md">',
    '<DialogContent className="[&>button]:hidden sm:max-w-md rounded-3xl p-6 sm:p-8">'
)
content = content.replace(
    '<DialogTitle className="flex items-center gap-2">',
    '<DialogTitle className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900 mb-2">'
)
content = content.replace(
    '<Button\n                            variant="outline"\n                            onClick={() => setPendingUnassignEquipmentId(null)}\n                            disabled={Boolean(isUnassigningEquipmentId)}\n                        >',
    '<Button\n                            variant="ghost"\n                            className="rounded-xl font-bold"\n                            onClick={() => setPendingUnassignEquipmentId(null)}\n                            disabled={Boolean(isUnassigningEquipmentId)}\n                        >'
)
content = content.replace(
    '<Button\n                            variant="destructive"\n                            onClick={confirmUnassignEquipment}\n                            disabled={Boolean(isUnassigningEquipmentId)}\n                        >',
    '<Button\n                            className="rounded-xl font-bold bg-rose-600 hover:bg-rose-700 text-white"\n                            onClick={confirmUnassignEquipment}\n                            disabled={Boolean(isUnassigningEquipmentId)}\n                        >'
)

# Mobile bottom nav
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

with open("src/app/clubs/[clubId]/equipment/workplaces/page.tsx", "w", encoding="utf-8") as f:
    f.write(content)

