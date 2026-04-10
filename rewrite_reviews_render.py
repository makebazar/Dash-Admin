import re

with open("src/app/clubs/[clubId]/reviews/page.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Replace PageShell usage
content = re.sub(
    r'<PageShell maxWidth="6xl">\s*<PageHeader\s*title="Центр проверок"\s*description="Единый центр контроля качества и выполненных работ"\s*/>',
    r'''<PageShell maxWidth="5xl">
            <div className="space-y-8 pb-28 sm:pb-12">
            <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between mb-8">
                    <div className="min-w-0">
                        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900 truncate">Центр проверок</h1>
                        <p className="text-slate-500 text-lg mt-2">Единый центр контроля качества и выполненных работ</p>
                    </div>
                </div>
            </div>''',
    content,
    flags=re.DOTALL
)

# Update main tabs
content = re.sub(
    r'<Tabs defaultValue="equipment" value=\{activeTab\} onValueChange=\{handleTabChange\} className="w-full">\s*<div className="border-b mb-6 overflow-x-auto">\s*<TabsList className="bg-transparent h-auto p-0 space-x-6 min-w-max">\s*<TabsTrigger value="equipment" variant="underline" className="pb-3 rounded-none">\s*Оборудование\s*\{pendingTasks > 0 && <Badge variant="secondary" className="ml-2 h-5 px-1\.5 bg-slate-100">\{pendingTasks\}</Badge>\}\s*</TabsTrigger>\s*<TabsTrigger value="checklists" variant="underline" className="pb-3 rounded-none">\s*Чеклист\s*\{pendingEvaluations > 0 && <Badge variant="secondary" className="ml-2 h-5 px-1\.5 bg-slate-100">\{pendingEvaluations\}</Badge>\}\s*</TabsTrigger>\s*<TabsTrigger value="shifts" variant="underline" className="pb-3 rounded-none">\s*Смены\s*\{pendingShifts > 0 && <Badge variant="secondary" className="ml-2 h-5 px-1\.5 bg-slate-100">\{pendingShifts\}</Badge>\}\s*</TabsTrigger>\s*</TabsList>\s*</div>',
    r'''<Tabs defaultValue="equipment" value={activeTab} onValueChange={handleTabChange} className="w-full">
                    <div className="flex justify-start mb-8 border-b border-slate-200">
                        <TabsList className="flex h-auto w-full justify-start gap-8 overflow-x-auto rounded-none bg-transparent p-0">
                            <TabsTrigger value="equipment" className="relative shrink-0 rounded-none border-b-2 border-transparent px-0 pb-4 pt-2 font-medium text-slate-500 hover:text-slate-700 data-[state=active]:border-slate-900 data-[state=active]:text-slate-900 data-[state=active]:shadow-none data-[state=active]:bg-transparent transition-all gap-2">
                                <Layers className="h-4 w-4" />
                                Оборудование
                                {pendingTasks > 0 && <Badge variant="secondary" className="ml-2 h-5 px-1.5 bg-slate-100 text-slate-900">{pendingTasks}</Badge>}
                            </TabsTrigger>
                            <TabsTrigger value="checklists" className="relative shrink-0 rounded-none border-b-2 border-transparent px-0 pb-4 pt-2 font-medium text-slate-500 hover:text-slate-700 data-[state=active]:border-slate-900 data-[state=active]:text-slate-900 data-[state=active]:shadow-none data-[state=active]:bg-transparent transition-all gap-2">
                                <CheckCircle2 className="h-4 w-4" />
                                Чеклисты
                                {pendingEvaluations > 0 && <Badge variant="secondary" className="ml-2 h-5 px-1.5 bg-slate-100 text-slate-900">{pendingEvaluations}</Badge>}
                            </TabsTrigger>
                            <TabsTrigger value="shifts" className="relative shrink-0 rounded-none border-b-2 border-transparent px-0 pb-4 pt-2 font-medium text-slate-500 hover:text-slate-700 data-[state=active]:border-slate-900 data-[state=active]:text-slate-900 data-[state=active]:shadow-none data-[state=active]:bg-transparent transition-all gap-2">
                                <User className="h-4 w-4" />
                                Смены
                                {pendingShifts > 0 && <Badge variant="secondary" className="ml-2 h-5 px-1.5 bg-slate-100 text-slate-900">{pendingShifts}</Badge>}
                            </TabsTrigger>
                        </TabsList>
                    </div>''',
    content,
    flags=re.DOTALL
)

# Fix empty states styling inside loops and main blocks
content = content.replace(
    '<div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground bg-muted/10">',
    '<div className="rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-16 text-center text-slate-500 font-medium">'
)
content = content.replace(
    '<div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground bg-muted/5">',
    '<div className="rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-12 text-center text-slate-500 font-medium">'
)
content = content.replace(
    '<div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground bg-slate-50">',
    '<div className="rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-16 text-center text-slate-500 font-medium">'
)

# Button styling fixes
content = content.replace('variant="destructive"', 'variant="outline" className="border-rose-200 text-rose-600 hover:bg-rose-50"')
content = content.replace('bg-green-600 hover:bg-green-700', 'bg-slate-900 text-white hover:bg-slate-800')

# End tag for PageShell wrapper
content = content.replace('</PageShell>', '</div>\n        </PageShell>')

# Remove old PageHeader, PageToolbar imports
content = content.replace('import { PageShell, PageHeader, PageToolbar, ToolbarGroup } from "@/components/layout/PageShell"', 'import { PageShell } from "@/components/layout/PageShell"')

# Fix all `<PageToolbar>` and `<ToolbarGroup>` components
content = re.sub(r'<PageToolbar>(.*?)</PageToolbar>', r'<div className="mb-6 border-b border-slate-100 pb-6">\1</div>', content, flags=re.DOTALL)
content = re.sub(r'<ToolbarGroup.*?>(.*?)</ToolbarGroup>', r'<div className="w-full">\1</div>', content, flags=re.DOTALL)


with open("src/app/clubs/[clubId]/reviews/page.tsx", "w", encoding="utf-8") as f:
    f.write(content)
