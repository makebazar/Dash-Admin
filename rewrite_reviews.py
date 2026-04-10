import re

with open("src/app/clubs/[clubId]/reviews/page.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Replace PageShell usage if it includes PageHeader
content = re.sub(
    r'<PageShell.*?>\s*<PageHeader.*?</PageHeader>',
    r'''<PageShell maxWidth="5xl">
            <div className="space-y-8 pb-28 sm:pb-12">
            <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between mb-8">
                    <div className="min-w-0">
                        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900 truncate">Проверки</h1>
                        <p className="text-slate-500 text-lg mt-2">Проверка отчетов, чеклистов и оборудования</p>
                    </div>
                </div>
            </div>''',
    content,
    flags=re.DOTALL
)

# Update main tabs
content = re.sub(
    r'<Tabs defaultValue=\{activeTab\} value=\{activeTab\} onValueChange=\{handleTabChange\} className="w-full space-y-6">\s*<TabsList.*?</TabsList>',
    r'''<Tabs defaultValue={activeTab} value={activeTab} onValueChange={handleTabChange} className="w-full">
                    <div className="flex justify-start mb-8 border-b border-slate-200">
                        <TabsList className="flex h-auto w-full justify-start gap-8 overflow-x-auto rounded-none bg-transparent p-0">
                            <TabsTrigger value="equipment" className="relative shrink-0 rounded-none border-b-2 border-transparent px-0 pb-4 pt-2 font-medium text-slate-500 hover:text-slate-700 data-[state=active]:border-slate-900 data-[state=active]:text-slate-900 data-[state=active]:shadow-none data-[state=active]:bg-transparent transition-all gap-2">
                                <Layers className="h-4 w-4" />
                                Оборудование
                            </TabsTrigger>
                            <TabsTrigger value="shifts" className="relative shrink-0 rounded-none border-b-2 border-transparent px-0 pb-4 pt-2 font-medium text-slate-500 hover:text-slate-700 data-[state=active]:border-slate-900 data-[state=active]:text-slate-900 data-[state=active]:shadow-none data-[state=active]:bg-transparent transition-all gap-2">
                                <User className="h-4 w-4" />
                                Смены
                            </TabsTrigger>
                            <TabsTrigger value="checklists" className="relative shrink-0 rounded-none border-b-2 border-transparent px-0 pb-4 pt-2 font-medium text-slate-500 hover:text-slate-700 data-[state=active]:border-slate-900 data-[state=active]:text-slate-900 data-[state=active]:shadow-none data-[state=active]:bg-transparent transition-all gap-2">
                                <CheckCircle2 className="h-4 w-4" />
                                Чеклисты
                            </TabsTrigger>
                        </TabsList>
                    </div>''',
    content,
    flags=re.DOTALL
)

# Replace "Card" usages for empty states and item cards
# First, let's remove unused imports
content = content.replace('import { Card, CardContent } from "@/components/ui/card"\n', '')

# Replace generic card tags
content = content.replace('<Card className="overflow-hidden">', '<div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">')
content = content.replace('<Card className="border-none shadow-sm">', '<div className="bg-white rounded-3xl border border-slate-200 shadow-sm">')
content = content.replace('<Card className="border-none shadow-sm', '<div className="bg-white rounded-3xl border border-slate-200 shadow-sm')
content = content.replace('<Card ', '<div ')
content = content.replace('</Card>', '</div>')
content = content.replace('<CardContent className="p-0">', '<div>')
content = content.replace('<CardContent className="p-4 sm:p-6">', '<div className="p-6 sm:p-8">')
content = content.replace('<CardContent className="p-4">', '<div className="p-6">')
content = content.replace('<CardContent className="p-5 space-y-4">', '<div className="p-6 sm:p-8 space-y-6">')
content = content.replace('<CardContent', '<div')
content = content.replace('</CardContent>', '</div>')

# Fix secondary tabs (active/history)
content = re.sub(
    r'<Tabs value=\{equipmentTab\}.*?<TabsList.*?</TabsList>\s*</Tabs>',
    r'''<Tabs value={equipmentTab} onValueChange={(v: any) => setEquipmentTab(v)} className="w-full">
                                    <TabsList className="flex h-auto w-full justify-start gap-6 overflow-x-auto rounded-none bg-transparent p-0 mb-6">
                                        <TabsTrigger value="active" className="relative shrink-0 rounded-none border-b-2 border-transparent px-0 pb-2 pt-1 font-medium text-slate-500 hover:text-slate-700 data-[state=active]:border-slate-900 data-[state=active]:text-slate-900 data-[state=active]:shadow-none data-[state=active]:bg-transparent transition-all">Ожидают проверки</TabsTrigger>
                                        <TabsTrigger value="history" className="relative shrink-0 rounded-none border-b-2 border-transparent px-0 pb-2 pt-1 font-medium text-slate-500 hover:text-slate-700 data-[state=active]:border-slate-900 data-[state=active]:text-slate-900 data-[state=active]:shadow-none data-[state=active]:bg-transparent transition-all">История</TabsTrigger>
                                    </TabsList>
                                </Tabs>''',
    content,
    flags=re.DOTALL
)

content = re.sub(
    r'<Tabs value=\{shiftsTab\}.*?<TabsList.*?</TabsList>\s*</Tabs>',
    r'''<Tabs value={shiftsTab} onValueChange={(v: any) => setShiftsTab(v)} className="w-full">
                                    <TabsList className="flex h-auto w-full justify-start gap-6 overflow-x-auto rounded-none bg-transparent p-0 mb-6">
                                        <TabsTrigger value="active" className="relative shrink-0 rounded-none border-b-2 border-transparent px-0 pb-2 pt-1 font-medium text-slate-500 hover:text-slate-700 data-[state=active]:border-slate-900 data-[state=active]:text-slate-900 data-[state=active]:shadow-none data-[state=active]:bg-transparent transition-all">Ожидают проверки</TabsTrigger>
                                        <TabsTrigger value="history" className="relative shrink-0 rounded-none border-b-2 border-transparent px-0 pb-2 pt-1 font-medium text-slate-500 hover:text-slate-700 data-[state=active]:border-slate-900 data-[state=active]:text-slate-900 data-[state=active]:shadow-none data-[state=active]:bg-transparent transition-all">История</TabsTrigger>
                                    </TabsList>
                                </Tabs>''',
    content,
    flags=re.DOTALL
)

content = re.sub(
    r'<Tabs value=\{checklistsTab\}.*?<TabsList.*?</TabsList>\s*</Tabs>',
    r'''<Tabs value={checklistsTab} onValueChange={(v: any) => setChecklistsTab(v)} className="w-full">
                                    <TabsList className="flex h-auto w-full justify-start gap-6 overflow-x-auto rounded-none bg-transparent p-0 mb-6">
                                        <TabsTrigger value="active" className="relative shrink-0 rounded-none border-b-2 border-transparent px-0 pb-2 pt-1 font-medium text-slate-500 hover:text-slate-700 data-[state=active]:border-slate-900 data-[state=active]:text-slate-900 data-[state=active]:shadow-none data-[state=active]:bg-transparent transition-all">Ожидают проверки</TabsTrigger>
                                        <TabsTrigger value="history" className="relative shrink-0 rounded-none border-b-2 border-transparent px-0 pb-2 pt-1 font-medium text-slate-500 hover:text-slate-700 data-[state=active]:border-slate-900 data-[state=active]:text-slate-900 data-[state=active]:shadow-none data-[state=active]:bg-transparent transition-all">История</TabsTrigger>
                                    </TabsList>
                                </Tabs>''',
    content,
    flags=re.DOTALL
)

# Empty states
content = content.replace(
    '<div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground bg-muted/10">',
    '<div className="rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-16 text-center text-slate-500">'
)

content = content.replace('bg-green-600 hover:bg-green-700', 'bg-slate-900 hover:bg-slate-800 text-white')
content = content.replace('variant="destructive"', 'variant="outline" className="border-rose-200 text-rose-600 hover:bg-rose-50"')
content = content.replace('text-lg font-semibold', 'text-xl font-bold text-slate-900')

with open("src/app/clubs/[clubId]/reviews/page.tsx", "w", encoding="utf-8") as f:
    f.write(content)
