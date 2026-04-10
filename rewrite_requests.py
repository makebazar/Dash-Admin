import re

with open("src/app/clubs/[clubId]/requests/page.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Imports
content = re.sub(r'import \{ Card, CardContent, CardHeader, CardTitle, CardDescription \} from "@/components/ui/card"\n', '', content)
if 'import { PageShell }' not in content:
    content = content.replace('import { cn } from "@/lib/utils"', 'import { cn } from "@/lib/utils"\nimport { PageShell } from "@/components/layout/PageShell"')

# Main wrapper
content = content.replace(
    '<div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">',
    '<PageShell maxWidth="5xl">\n            <div className="space-y-8 pb-28 sm:pb-12">'
)

content = content.replace(
    '</Dialog>\n        </div>\n    )\n}',
    '</Dialog>\n            </div>\n        </PageShell>\n    )\n}'
)

# Header
content = content.replace(
    '<div className="flex flex-col md:flex-row md:items-center justify-between gap-4">',
    '<div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between mb-8">'
)

content = content.replace(
    '<h1 className="text-2xl font-bold tracking-tight">Обратная связь</h1>',
    '<h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900 truncate">Обратная связь</h1>'
)

content = content.replace(
    '<p className="text-muted-foreground">Управление сообщениями от сотрудников</p>',
    '<p className="text-slate-500 text-lg mt-2">Управление сообщениями от сотрудников</p>'
)

# Tabs
content = content.replace(
    '<div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">',
    '<div className="flex items-center gap-2 bg-slate-100/50 border border-slate-200 p-1.5 rounded-2xl shadow-sm overflow-x-auto w-full md:w-auto">'
)
content = content.replace(
    'variant={activeTab === "ACTIVE" ? "default" : "outline"} \n                        size="sm" \n                        onClick={() => setActiveTab("ACTIVE")}\n                        className="rounded-full px-6"',
    'variant="ghost"\n                        size="sm"\n                        onClick={() => setActiveTab("ACTIVE")}\n                        className={`rounded-xl px-6 py-2.5 font-medium transition-all ${activeTab === "ACTIVE" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"}`}'
)
content = content.replace(
    'variant={activeTab === "ARCHIVE" ? "default" : "outline"} \n                        size="sm" \n                        onClick={() => setActiveTab("ARCHIVE")}\n                        className="rounded-full px-6"',
    'variant="ghost"\n                        size="sm"\n                        onClick={() => setActiveTab("ARCHIVE")}\n                        className={`rounded-xl px-6 py-2.5 font-medium transition-all ${activeTab === "ARCHIVE" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"}`}'
)

# Filters
content = content.replace(
    '<div className="flex items-center gap-2 border-b pb-4 overflow-x-auto">',
    '<div className="flex items-center gap-2 overflow-x-auto mb-6">'
)
content = content.replace(
    'variant={filterStatus === "ALL" ? "secondary" : "ghost"} size="sm" onClick={() => setFilterStatus("ALL")} className="text-xs"',
    'variant={filterStatus === "ALL" ? "secondary" : "ghost"} size="sm" onClick={() => setFilterStatus("ALL")} className={`rounded-xl text-xs font-bold uppercase tracking-wider px-4 ${filterStatus === "ALL" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}'
)
content = content.replace(
    'variant={filterStatus === "OPEN" ? "secondary" : "ghost"} size="sm" onClick={() => setFilterStatus("OPEN")} className="text-xs"',
    'variant={filterStatus === "OPEN" ? "secondary" : "ghost"} size="sm" onClick={() => setFilterStatus("OPEN")} className={`rounded-xl text-xs font-bold uppercase tracking-wider px-4 ${filterStatus === "OPEN" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}'
)
content = content.replace(
    'variant={filterStatus === "PENDING" ? "secondary" : "ghost"} size="sm" onClick={() => setFilterStatus("PENDING")} className="text-xs"',
    'variant={filterStatus === "PENDING" ? "secondary" : "ghost"} size="sm" onClick={() => setFilterStatus("PENDING")} className={`rounded-xl text-xs font-bold uppercase tracking-wider px-4 ${filterStatus === "PENDING" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}'
)
content = content.replace(
    'variant={filterStatus === "RESOLVED" ? "secondary" : "ghost"} size="sm" onClick={() => setFilterStatus("RESOLVED")} className="text-xs"',
    'variant={filterStatus === "RESOLVED" ? "secondary" : "ghost"} size="sm" onClick={() => setFilterStatus("RESOLVED")} className={`rounded-xl text-xs font-bold uppercase tracking-wider px-4 ${filterStatus === "RESOLVED" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}'
)

# Loading / Empty states
content = content.replace(
    '<Card key={i} className="animate-pulse h-48 bg-muted/50" />',
    '<div key={i} className="animate-pulse h-48 bg-slate-100 rounded-3xl" />'
)
content = content.replace(
    '<Card className="border-dashed flex flex-col items-center justify-center py-20">',
    '<div className="border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center py-24 bg-slate-50/50">'
)
content = content.replace('</Card>', '</div>')

# List items
content = content.replace(
    '<Card \n                                key={req.id} \n                                className={cn(\n                                    "cursor-pointer hover:border-primary/50 transition-all relative overflow-hidden",\n                                    !req.is_read_by_employee && "ring-2 ring-purple-500/20 border-purple-500/50"\n                                )}\n                                onClick={() => {\n                                    setSelectedRequest(req)\n                                    setAdminNotes(req.admin_notes || "")\n                                }}\n                            >',
    '<div \n                                key={req.id} \n                                className={cn(\n                                    "bg-white rounded-3xl border border-slate-200 overflow-hidden cursor-pointer hover:shadow-md hover:border-slate-300 transition-all relative group flex flex-col",\n                                    !req.is_read_by_employee && "ring-2 ring-purple-500/20 border-purple-500/50"\n                                )}\n                                onClick={() => {\n                                    setSelectedRequest(req)\n                                    setAdminNotes(req.admin_notes || "")\n                                }}\n                            >'
)

content = content.replace(
    '<CardHeader className="p-4 pb-2 flex-row items-start justify-between space-y-0">',
    '<div className="p-6 pb-4 flex flex-row items-start justify-between">'
)
content = content.replace(
    '<CardTitle className="text-sm truncate max-w-[150px]">{req.title}</CardTitle>',
    '<h3 className="text-lg font-bold text-slate-900 truncate max-w-[200px]">{req.title}</h3>'
)
content = content.replace('</CardHeader>', '</div>')

content = content.replace(
    '<CardContent className="p-4 pt-2 space-y-4">',
    '<div className="p-6 pt-0 space-y-4">'
)
content = content.replace('</CardContent>', '</div>')

# Dialog changes
content = content.replace(
    '<DialogContent className="max-w-3xl h-[90dvh] flex flex-col p-0 overflow-hidden">',
    '<DialogContent className="max-w-3xl rounded-3xl h-[90dvh] flex flex-col p-0 overflow-hidden bg-slate-50 border-slate-200">'
)
content = content.replace(
    '<DialogHeader className="p-6 pb-2 shrink-0">',
    '<div className="p-6 sm:p-8 pb-4 shrink-0 bg-white border-b border-slate-100">'
)
content = content.replace('</DialogHeader>', '</div>')
content = content.replace(
    '<DialogTitle className="text-xl">{selectedRequest.title}</DialogTitle>',
    '<h2 className="text-2xl font-bold tracking-tight text-slate-900 mt-2">{selectedRequest.title}</h2>'
)
content = content.replace(
    '<DialogDescription className="flex items-center gap-4 mt-2">',
    '<div className="flex items-center gap-4 mt-3 text-sm font-medium text-slate-500">'
)
content = content.replace('</DialogDescription>', '</div>')

# Chat Thread
content = content.replace(
    '<div className="flex-1 overflow-y-auto p-6 space-y-6 bg-muted/10">',
    '<div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6">'
)

content = content.replace(
    '<div className={cn(\n                                                    "p-4 rounded-2xl text-sm shadow-sm border",\n                                                    !isEmployee ? "bg-primary text-primary-foreground border-primary rounded-tr-none" : "bg-card border-border rounded-tl-none"\n                                                )}>',
    '<div className={cn(\n                                                    "p-5 rounded-3xl text-sm shadow-sm border leading-relaxed",\n                                                    !isEmployee ? "bg-slate-900 text-white border-slate-900 rounded-tr-none" : "bg-white border-slate-200 rounded-tl-none text-slate-900"\n                                                )}>'
)

# Textarea & Buttons inside dialog
content = content.replace(
    '<div className="p-6 border-t bg-card space-y-4 shrink-0">',
    '<div className="p-6 sm:p-8 border-t border-slate-200 bg-white space-y-4 shrink-0">'
)
content = content.replace(
    'className="min-h-[80px] rounded-xl resize-none"',
    'className="min-h-[80px] bg-slate-50/50 border-slate-200 rounded-xl resize-none font-medium text-slate-900 focus:bg-white p-4 text-base"'
)
content = content.replace(
    'className="h-auto px-6 rounded-xl"\n                                        onClick={handleSendMessage}',
    'className="h-auto px-6 sm:px-8 rounded-xl bg-slate-900 text-white shadow-sm hover:bg-slate-800 transition-colors"\n                                        onClick={handleSendMessage}'
)

with open("src/app/clubs/[clubId]/requests/page.tsx", "w", encoding="utf-8") as f:
    f.write(content)

