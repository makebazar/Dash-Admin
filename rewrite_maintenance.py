import re

with open("src/app/clubs/[clubId]/equipment/maintenance/page.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Remove Card imports
content = re.sub(r'import \{ Card, CardContent \} from "@/components/ui/card"\n', '', content)

if 'import { PageShell }' not in content:
    content = content.replace('import { cn } from "@/lib/utils"', 'import { cn } from "@/lib/utils"\nimport { PageShell } from "@/components/layout/PageShell"')

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
    '<h1 className="text-2xl font-bold tracking-tight md:text-3xl">Обслуживание</h1>',
    '<h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900 truncate">Обслуживание</h1>'
)
content = content.replace(
    '<p className="mt-1 text-sm text-muted-foreground md:text-base">График чистки, регламентные работы и назначения</p>',
    '<p className="text-slate-500 text-lg mt-2">График чистки, регламентные работы и назначения</p>'
)

# Filters/Controls Container
content = content.replace(
    '<Card className="border-none shadow-sm">',
    '<div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8">'
)
content = content.replace(
    '<CardContent className="space-y-4 p-4 md:p-6">',
    '<div className="space-y-6">'
)

content = content.replace(
    '<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />',
    '<Search className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />'
)
content = content.replace(
    '<Input\n                                value={searchQuery}\n                                onChange={(e) => setSearchQuery(e.target.value)}\n                                placeholder="Поиск по месту, зоне, устройству"\n                                className="border-slate-200 bg-slate-50 pl-9"\n                            />',
    '<Input\n                                value={searchQuery}\n                                onChange={(e) => setSearchQuery(e.target.value)}\n                                placeholder="Поиск по месту, зоне, устройству"\n                                className="h-12 border-slate-200 bg-slate-50/50 pl-10 rounded-xl font-medium text-slate-900 focus:bg-white"\n                            />'
)

# Month selector
content = content.replace(
    '<div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-2 py-0.5 shadow-sm">',
    '<div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">'
)

content = content.replace(
    '<Button\n                                variant="ghost"\n                                size="icon"\n                                className="h-7 w-7 text-slate-500"',
    '<Button\n                                variant="ghost"\n                                size="icon"\n                                className="h-10 w-10 text-slate-500 hover:bg-slate-50 rounded-xl border border-slate-100"'
)

# Stats boxes
content = content.replace(
    'className={cn("rounded-xl border px-3 py-2", item.tone)}',
    'className={cn("rounded-2xl border p-4 shadow-sm", item.tone)}'
)

content = content.replace('</CardContent>', '</div>')
content = content.replace('</Card>', '</div>')


# Zones and Places structure
content = content.replace(
    '<Card key={zone.key} className="shadow-none overflow-hidden">',
    '<div key={zone.key} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">'
)
content = content.replace(
    '<button\n                                    type="button"\n                                    onClick={() => toggleZone(zone.key)}\n                                    className="w-full px-4 py-3 border-b bg-slate-50/70 text-left"',
    '<button\n                                    type="button"\n                                    onClick={() => toggleZone(zone.key)}\n                                    className="w-full px-6 py-5 border-b border-slate-100 bg-slate-50/50 text-left hover:bg-slate-50 transition-colors"'
)

content = content.replace(
    '<CardContent className="p-3 space-y-2">',
    '<div className="p-4 sm:p-6 space-y-4">'
)

content = content.replace(
    '<Card className="shadow-none">',
    '<div className="border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50/50">'
)
content = content.replace(
    '<CardContent className="h-64 flex flex-col items-center justify-center gap-3 text-muted-foreground">',
    '<div className="h-64 flex flex-col items-center justify-center gap-3 text-muted-foreground">'
)
content = content.replace(
    '<CardContent className="h-64 flex items-center justify-center text-muted-foreground">',
    '<div className="h-64 flex items-center justify-center text-muted-foreground">'
)

with open("src/app/clubs/[clubId]/equipment/maintenance/page.tsx", "w", encoding="utf-8") as f:
    f.write(content)

