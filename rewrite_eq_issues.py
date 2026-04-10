import re

with open("src/app/clubs/[clubId]/equipment/issues/page.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Add PageShell import
if 'import { PageShell }' not in content:
    content = content.replace('import { cn } from "@/lib/utils"', 'import { cn } from "@/lib/utils"\nimport { PageShell } from "@/components/layout/PageShell"')

# Remove Card imports
content = re.sub(r'import \{ Card, CardContent \} from "@/components/ui/card"\n', '', content)

# Wrap with PageShell
content = content.replace(
    '<div className="mx-auto max-w-7xl space-y-6 p-4 pb-24 md:p-8">',
    '<PageShell maxWidth="5xl">\n            <div className="space-y-8 pb-28 sm:pb-12">'
)
content = content.replace(
    '</div>\n        </div>\n    )\n}',
    '</div>\n            </div>\n        </PageShell>\n    )\n}'
)

# Header
content = content.replace(
    '<div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">',
    '<div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between mb-8">'
)
content = content.replace(
    '<h1 className="text-2xl font-bold tracking-tight md:text-3xl">Инциденты</h1>',
    '<h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900 truncate">Инциденты</h1>'
)
content = content.replace(
    '<p className="mt-1 text-sm text-muted-foreground md:text-base">Отслеживание проблем, ремонтов и статуса оборудования</p>',
    '<p className="text-slate-500 text-lg mt-2">Отслеживание проблем, ремонтов и статуса оборудования</p>'
)

content = content.replace(
    '<Button className="w-full md:w-auto" onClick={() => setIsCreateOpen(true)}>',
    '<Button className="hidden md:inline-flex rounded-xl bg-slate-900 text-white shadow-sm hover:bg-slate-800 h-11 px-6 font-medium" onClick={() => setIsCreateOpen(true)}>'
)

# Stats Cards -> Divs
content = content.replace(
    '<Card className="border-none bg-gradient-to-br from-rose-50/50 to-white shadow-sm">',
    '<div className="rounded-3xl border border-rose-200/50 bg-gradient-to-br from-rose-50/50 to-white shadow-sm">'
)
content = content.replace(
    '<Card className="border-none bg-gradient-to-br from-amber-50/50 to-white shadow-sm">',
    '<div className="rounded-3xl border border-amber-200/50 bg-gradient-to-br from-amber-50/50 to-white shadow-sm">'
)

content = content.replace(
    '<CardContent className="flex items-center justify-between p-4 md:p-6">',
    '<div className="flex items-center justify-between p-6 sm:p-8">'
)
content = content.replace('</CardContent>', '</div>')
content = content.replace('</Card>', '</div>')

# Search & Tabs Card -> Div
content = content.replace(
    '<Card className="border-none shadow-sm">',
    '<div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8">'
)
content = content.replace(
    '<CardContent className="space-y-4 p-4">',
    '<div className="space-y-6">'
)

content = content.replace(
    '<Input\n                                placeholder="Поиск по проблеме, описанию или оборудованию..."\n                                className="border-slate-200 bg-slate-50 pl-9"\n                                value={searchTerm}\n                                onChange={(e) => setSearchTerm(e.target.value)}\n                            />',
    '<Input\n                                placeholder="Поиск по проблеме, описанию или оборудованию..."\n                                className="h-12 border-slate-200 bg-slate-50/50 pl-10 rounded-xl font-medium text-slate-900 focus:bg-white"\n                                value={searchTerm}\n                                onChange={(e) => setSearchTerm(e.target.value)}\n                            />'
)
content = content.replace(
    '<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />',
    '<Search className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />'
)

content = content.replace(
    '<TabsList className="grid h-12 w-full grid-cols-3 rounded-xl bg-slate-100 p-1">',
    '<TabsList className="grid h-12 w-full grid-cols-3 rounded-xl bg-slate-100/50 border border-slate-200 p-1 shadow-sm">'
)
content = content.replace(
    'className="rounded-lg px-4 text-sm font-medium"',
    'className="rounded-lg px-4 text-sm font-medium text-slate-500 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm transition-all"'
)

# List Card -> Div
content = content.replace(
    '<Card className="overflow-hidden border-none shadow-sm">',
    '<div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">'
)
content = content.replace(
    '<div className="space-y-3 p-3">',
    '<div className="space-y-4 p-4 sm:p-6">'
)
content = content.replace(
    '<div key={group.key} className="overflow-hidden rounded-xl border bg-white">',
    '<div key={group.key} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">'
)
content = content.replace(
    '<button\n                                        type="button"\n                                        onClick={() => toggleGroup(group.key)}\n                                        className="w-full border-b bg-slate-50/70 px-4 py-3 text-left"\n                                    >',
    '<button\n                                        type="button"\n                                        onClick={() => toggleGroup(group.key)}\n                                        className="w-full border-b border-slate-100 bg-slate-50/50 px-5 py-4 text-left hover:bg-slate-50 transition-colors"\n                                    >'
)

content = content.replace(
    '<CardContent className="space-y-2 p-3">',
    '<div className="space-y-3 p-4">'
)

content = content.replace(
    '<div className="flex h-40 flex-col items-center justify-center rounded-xl border border-dashed text-center">',
    '<div className="flex h-48 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 text-center">'
)

# Dialog
content = content.replace(
    '<DialogContent className="sm:max-w-[500px]">',
    '<DialogContent className="sm:max-w-[500px] rounded-3xl p-6 sm:p-8">'
)

content = content.replace(
    '<div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden">',
    '<div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/80 p-4 backdrop-blur-xl md:hidden pb-[calc(1rem+env(safe-area-inset-bottom))]">'
)
content = content.replace(
    '<Button asChild variant="outline" className="h-11 flex-1">',
    '<Button asChild variant="outline" className="flex-1 h-12 rounded-xl border-slate-200 text-slate-700 bg-white font-medium">'
)
content = content.replace(
    '<Button className="h-11 flex-1" onClick={() => setIsCreateOpen(true)}>',
    '<Button className="flex-1 h-12 rounded-xl bg-slate-900 text-white hover:bg-slate-800 font-medium shadow-sm" onClick={() => setIsCreateOpen(true)}>'
)

with open("src/app/clubs/[clubId]/equipment/issues/page.tsx", "w", encoding="utf-8") as f:
    f.write(content)

