import re

with open("src/app/clubs/[clubId]/laundry/page.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Replace ChevronLeft import if missing
if "ChevronLeft" not in content:
    content = content.replace("ArrowLeft,", "ArrowLeft, ChevronLeft,")

# Replace PageShell content
# Remove PageHeader and PageToolbar imports if possible, or just replace their usage.
content = re.sub(
    r'<PageHeader.*?</PageHeader>',
    '''<div className="flex flex-col gap-4">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between mb-8">
                    <div className="min-w-0">
                        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900 truncate">Стирка</h1>
                        <p className="text-slate-500 text-lg mt-2">Очередь ковриков, которые попали на обработку из обслуживания и центра проверок</p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap lg:justify-end">
                        <Button asChild variant="outline" className="hidden md:inline-flex md:w-auto rounded-xl h-11 px-6 font-medium">
                            <Link href={`/clubs/${clubId}/equipment`}>
                                <ChevronLeft className="mr-2 h-4 w-4" />
                                Назад
                            </Link>
                        </Button>
                    </div>
                </div>
            </div>''',
    content,
    flags=re.DOTALL
)

# Update PageShell maxWidth to 5xl
content = content.replace('<PageShell maxWidth="6xl">', '<PageShell maxWidth="5xl">\n            <div className="space-y-8 pb-28 sm:pb-12">')
content = content.replace('</PageShell>', '            </div>\n        </PageShell>')

# Update Grid Stats
old_grid = r'<div className="grid grid-cols-1 gap-4 md:grid-cols-4">.*?</div>\n\n\s*<Tabs'
new_grid = '''<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 sm:p-6 flex flex-col justify-between h-[140px]">
                    <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-slate-500 leading-tight">Всего</p>
                        <div className="rounded-2xl bg-slate-100 p-2.5 text-slate-700 shrink-0">
                            <Shirt className="h-5 w-5" />
                        </div>
                    </div>
                    <h3 className="text-3xl font-bold text-slate-900">{stats.total}</h3>
                </div>
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 sm:p-6 flex flex-col justify-between h-[140px]">
                    <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-slate-500 leading-tight">Новые</p>
                        <div className="rounded-2xl bg-amber-50 p-2.5 text-amber-600 shrink-0">
                            <Sparkles className="h-5 w-5" />
                        </div>
                    </div>
                    <h3 className="text-3xl font-bold text-amber-600">{stats.newCount}</h3>
                </div>
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 sm:p-6 flex flex-col justify-between h-[140px]">
                    <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-slate-500 leading-tight">В стирке</p>
                        <div className="rounded-2xl bg-blue-50 p-2.5 text-blue-600 shrink-0">
                            <Loader2 className="h-5 w-5" />
                        </div>
                    </div>
                    <h3 className="text-3xl font-bold text-blue-600">{stats.inLaundryCount}</h3>
                </div>
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 sm:p-6 flex flex-col justify-between h-[140px]">
                    <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-slate-500 leading-tight">Готово</p>
                        <div className="rounded-2xl bg-violet-50 p-2.5 text-violet-600 shrink-0">
                            <CheckCircle2 className="h-5 w-5" />
                        </div>
                    </div>
                    <h3 className="text-3xl font-bold text-violet-600">{stats.readyCount}</h3>
                </div>
            </div>

            <div className="flex justify-between items-center mb-6 border-b border-slate-200">
                <Tabs value={tab} onValueChange={(value) => setTab(value as 'active' | 'history')} className="w-full">
                    <TabsList className="flex h-auto w-full justify-start gap-8 overflow-x-auto rounded-none bg-transparent p-0">
                        <TabsTrigger value="active" className="relative shrink-0 rounded-none border-b-2 border-transparent px-0 pb-4 pt-2 font-medium text-slate-500 hover:text-slate-700 data-[state=active]:border-slate-900 data-[state=active]:text-slate-900 data-[state=active]:shadow-none data-[state=active]:bg-transparent transition-all">
                            Активные
                        </TabsTrigger>
                        <TabsTrigger value="history" className="relative shrink-0 rounded-none border-b-2 border-transparent px-0 pb-4 pt-2 font-medium text-slate-500 hover:text-slate-700 data-[state=active]:border-slate-900 data-[state=active]:text-slate-900 data-[state=active]:shadow-none data-[state=active]:bg-transparent transition-all">
                            История
                        </TabsTrigger>
                    </TabsList>
                </Tabs>
                <div className="flex items-center gap-4 mb-2">
                    <div className="text-sm text-slate-500 hidden sm:block whitespace-nowrap">
                        Показано: <span className="font-medium text-slate-900">{requests.length}</span>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 rounded-full text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                        onClick={() => fetchRequests(tab)}
                        disabled={isLoading}
                    >
                        <RotateCcw className={`h-5 w-5 ${isLoading ? "animate-spin" : ""}`} />
                    </Button>
                </div>
            </div>'''
content = re.sub(old_grid, new_grid, content, flags=re.DOTALL)

# Remove the old PageToolbar section
content = re.sub(r'<PageToolbar>.*?</PageToolbar>', '', content, flags=re.DOTALL)

# Empty state styling
content = content.replace(
    '<div className="rounded-xl border border-dashed bg-muted/10 py-12 text-center text-muted-foreground">',
    '<div className="border-dashed border-2 border-slate-200 rounded-3xl bg-slate-50/50 py-16 text-center text-slate-500">'
)
content = content.replace(
    '<h3 className="text-lg font-medium text-foreground">Пусто</h3>',
    '<h3 className="text-lg font-bold text-slate-900">Пусто</h3>'
)

# List items
content = re.sub(r'<Card key={item.id} className="border-none shadow-sm">', '<div key={item.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8">', content)
content = re.sub(r'<CardContent className="p-5">', '<div>', content)
content = re.sub(r'</CardContent>\s*</Card>', '</div>\n                        </div>', content)

content = content.replace('<h3 className="text-lg font-semibold">{item.equipment_name}</h3>', '<h3 className="text-xl font-bold text-slate-900">{item.equipment_name}</h3>')

# Update buttons inside list items
content = content.replace(
    '''<Button
                                                    onClick={() => handleStatusUpdate(item.id, 'SENT_TO_LAUNDRY')}
                                                    disabled={updatingId === item.id}
                                                >''',
    '''<Button
                                                    className="w-full sm:w-auto rounded-xl h-11 px-6 font-medium bg-slate-900 text-white hover:bg-slate-800"
                                                    onClick={() => handleStatusUpdate(item.id, 'SENT_TO_LAUNDRY')}
                                                    disabled={updatingId === item.id}
                                                >'''
)
content = content.replace(
    '''<Button
                                                    onClick={() => handleStatusUpdate(item.id, 'READY_FOR_RETURN')}
                                                    disabled={updatingId === item.id}
                                                >''',
    '''<Button
                                                    className="w-full sm:w-auto rounded-xl h-11 px-6 font-medium bg-slate-900 text-white hover:bg-slate-800"
                                                    onClick={() => handleStatusUpdate(item.id, 'READY_FOR_RETURN')}
                                                    disabled={updatingId === item.id}
                                                >'''
)
content = content.replace(
    '''<Button
                                                    onClick={() => handleStatusUpdate(item.id, 'RETURNED')}
                                                    disabled={updatingId === item.id}
                                                    className="bg-green-600 hover:bg-green-700"
                                                >''',
    '''<Button
                                                    onClick={() => handleStatusUpdate(item.id, 'RETURNED')}
                                                    disabled={updatingId === item.id}
                                                    className="w-full sm:w-auto rounded-xl h-11 px-6 font-medium bg-green-600 hover:bg-green-700 text-white"
                                                >'''
)
content = content.replace(
    '''<Button
                                                variant="outline"
                                                className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                                                onClick={() => handleStatusUpdate(item.id, 'CANCELLED')}
                                                disabled={updatingId === item.id}
                                            >''',
    '''<Button
                                                variant="outline"
                                                className="w-full sm:w-auto rounded-xl h-11 px-6 font-medium border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                                                onClick={() => handleStatusUpdate(item.id, 'CANCELLED')}
                                                disabled={updatingId === item.id}
                                            >'''
)


# Mobile bottom back button
old_mobile_btn = r'<div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 p-3 pb-\[calc\(0.75rem\+env\(safe-area-inset-bottom\)\)\] backdrop-blur supports-\[backdrop-filter\]:bg-background/80 md:hidden">.*?</div>\n\s*</div>'
new_mobile_btn = '''{/* Mobile Bottom Back Button */}
            <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/80 p-4 backdrop-blur-xl md:hidden pb-[calc(1rem+env(safe-area-inset-bottom))]">
                <div className="mx-auto flex max-w-[1600px] gap-2">
                    <Button asChild variant="outline" className="flex-1 h-12 rounded-xl border-slate-200 text-slate-700 bg-white font-medium">
                        <Link href={`/clubs/${clubId}/equipment`}>
                            <ChevronLeft className="mr-2 h-4 w-4" />
                            Назад
                        </Link>
                    </Button>
                </div>
            </div>'''
content = re.sub(old_mobile_btn, new_mobile_btn, content, flags=re.DOTALL)

with open("src/app/clubs/[clubId]/laundry/page.tsx", "w", encoding="utf-8") as f:
    f.write(content)
