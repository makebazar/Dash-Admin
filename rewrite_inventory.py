import re

with open("src/app/clubs/[clubId]/equipment/inventory/page.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Add PageShell import
if 'import { PageShell }' not in content:
    content = content.replace('import { cn } from "@/lib/utils"', 'import { cn } from "@/lib/utils"\nimport { PageShell } from "@/components/layout/PageShell"')

# Remove Card imports
content = re.sub(r'import \{ Card, CardContent \} from "@/components/ui/card"\n', '', content)
content = re.sub(r'import \{ Card, CardContent \} from '"'"'@/components/ui/card'"'"'\n', '', content)


# Main Wrapper
content = content.replace(
    '<div className="mx-auto max-w-[1600px] space-y-5 p-4 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:space-y-6 sm:p-6 sm:pb-[calc(6.5rem+env(safe-area-inset-bottom))] md:pb-8 lg:p-8">',
    '<PageShell maxWidth="5xl">\n            <div className="space-y-8 pb-28 sm:pb-12">'
)
content = content.replace(
    '</Dialog>\n        </div>\n    )\n}',
    '</Dialog>\n            </div>\n        </PageShell>\n    )\n}'
)

# Header
content = content.replace(
    '<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">',
    '<div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between mb-8">'
)
content = content.replace(
    '<h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Инвентаризация</h1>',
    '<h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900 truncate">Инвентаризация</h1>'
)
content = content.replace(
    '<p className="mt-1 text-sm text-muted-foreground sm:text-base">База данных оборудования и периферии</p>',
    '<p className="text-slate-500 text-lg mt-2">База данных оборудования и периферии</p>'
)

# Top action buttons
content = content.replace(
    '<Button asChild variant="outline" className="hidden w-full md:inline-flex md:w-auto">',
    '<Button asChild variant="outline" className="hidden w-full md:inline-flex md:w-auto rounded-xl h-11 px-6 font-medium">'
)
content = content.replace(
    '<Button variant="outline" onClick={() => setIsImportExportDialogOpen(true)} className="w-full sm:w-auto">',
    '<Button variant="outline" onClick={() => setIsImportExportDialogOpen(true)} className="w-full sm:w-auto rounded-xl h-11 px-6 font-medium">'
)
content = content.replace(
    '<Button onClick={handleCreate} className="w-full bg-primary text-primary-foreground shadow-md hover:bg-primary/90 sm:w-auto">',
    '<Button onClick={handleCreate} className="w-full bg-slate-900 text-white shadow-sm hover:bg-slate-800 sm:w-auto rounded-xl h-11 px-6 font-medium">'
)

# Dashboard Stats (replace cards with divs)
content = content.replace(
    '<Card className="shadow-sm border-none bg-white">',
    '<div className="bg-white rounded-3xl border border-slate-200 shadow-sm">'
)
content = content.replace(
    '<CardContent className="flex items-center justify-between p-4 sm:p-6">',
    '<div className="flex items-center justify-between p-6 sm:p-8">'
)
content = content.replace('</CardContent>', '</div>')
content = content.replace('</Card>', '</div>')

# Advanced Filters Bar
content = content.replace(
    '<div className="flex flex-col gap-4 bg-white p-4 rounded-xl shadow-sm border">',
    '<div className="flex flex-col gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">'
)
content = content.replace(
    '<Input\n                            placeholder="Поиск по названию, серийному номеру..."\n                            className="pl-9 bg-slate-50 border-slate-200"\n                            value={search}\n                            onChange={(e) => setSearch(e.target.value)}\n                        />',
    '<Input\n                            placeholder="Поиск по названию, серийному номеру..."\n                            className="h-12 pl-10 bg-slate-50/50 border-slate-200 rounded-xl font-medium text-slate-900 focus:bg-white"\n                            value={search}\n                            onChange={(e) => setSearch(e.target.value)}\n                        />'
)

# Select components in filters
content = content.replace(
    'className="w-full bg-slate-50 border-slate-200"',
    'className="w-full h-11 bg-slate-50/50 border-slate-200 rounded-xl font-medium text-slate-900"'
)
content = content.replace(
    '<Button variant="ghost" className="w-full justify-center xl:w-auto"',
    '<Button variant="ghost" className="w-full justify-center xl:w-auto h-11 rounded-xl font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-100"'
)

# Data Table Card -> Div
content = content.replace(
    '<Card className="border-none shadow-sm overflow-hidden">',
    '<div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">'
)

content = content.replace(
    '<div className="space-y-3 p-3 md:hidden">',
    '<div className="space-y-4 p-4 sm:p-6 md:hidden">'
)

# Group headers inside the list
content = content.replace(
    '<div key={groupId} className="overflow-hidden rounded-xl border bg-white">',
    '<div key={groupId} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">'
)
content = content.replace(
    '<div className="space-y-3 border-t bg-slate-50/70 p-3">',
    '<div className="space-y-4 border-t border-slate-100 bg-slate-50/50 p-4 sm:p-6">'
)

# Item cards
content = content.replace(
    'className={cn(\n                                                        "rounded-xl border bg-white p-3 shadow-sm",',
    'className={cn(\n                                                        "rounded-2xl border bg-white p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer",'
)

# Dialog headers
content = content.replace(
    '<DialogContent className="sm:max-w-[700px]">',
    '<DialogContent className="sm:max-w-[700px] rounded-3xl p-6 sm:p-8">'
)

content = content.replace(
    '<DialogContent className="sm:max-w-[500px]">',
    '<DialogContent className="sm:max-w-[500px] rounded-3xl p-6 sm:p-8">'
)

# Dialog inputs
content = content.replace(
    '<Input\n                                            value={editingEquipment?.name || ""}\n                                            onChange={(e) => setEditingEquipment(prev => ({ ...prev, name: e.target.value }))}\n                                            placeholder="Например: Игровой ПК #1"\n                                        />',
    '<Input\n                                            className="h-12 bg-slate-50/50 border-slate-200 rounded-xl font-medium text-slate-900 focus:bg-white"\n                                            value={editingEquipment?.name || ""}\n                                            onChange={(e) => setEditingEquipment(prev => ({ ...prev, name: e.target.value }))}\n                                            placeholder="Например: Игровой ПК #1"\n                                        />'
)
content = content.replace(
    '<Input\n                                            value={editingEquipment?.identifier || ""}\n                                            onChange={(e) => setEditingEquipment(prev => ({ ...prev, identifier: e.target.value }))}\n                                            placeholder="Например: INV-12345"\n                                        />',
    '<Input\n                                            className="h-12 bg-slate-50/50 border-slate-200 rounded-xl font-medium text-slate-900 focus:bg-white"\n                                            value={editingEquipment?.identifier || ""}\n                                            onChange={(e) => setEditingEquipment(prev => ({ ...prev, identifier: e.target.value }))}\n                                            placeholder="Например: INV-12345"\n                                        />'
)

# General select trigger in dialog
content = content.replace(
    '<SelectTrigger className="bg-slate-50">',
    '<SelectTrigger className="h-12 bg-slate-50/50 border-slate-200 rounded-xl font-medium text-slate-900 focus:bg-white">'
)

content = content.replace(
    '<Textarea\n                                            value={editingEquipment?.notes || ""}\n                                            onChange={(e) => setEditingEquipment(prev => ({ ...prev, notes: e.target.value }))}\n                                            placeholder="Дополнительная информация"\n                                            rows={3}\n                                        />',
    '<Textarea\n                                            className="min-h-[96px] resize-y bg-slate-50/50 border-slate-200 rounded-xl font-medium text-slate-900 focus:bg-white p-4"\n                                            value={editingEquipment?.notes || ""}\n                                            onChange={(e) => setEditingEquipment(prev => ({ ...prev, notes: e.target.value }))}\n                                            placeholder="Дополнительная информация"\n                                            rows={3}\n                                        />'
)

with open("src/app/clubs/[clubId]/equipment/inventory/page.tsx", "w", encoding="utf-8") as f:
    f.write(content)

