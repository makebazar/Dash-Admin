import re

with open("src/app/clubs/[clubId]/finance/page.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Add PageShell import
if 'import { PageShell }' not in content:
    content = content.replace("import Link from 'next/link'", "import Link from 'next/link'\nimport { PageShell } from '@/components/layout/PageShell'")

# Update main container
content = content.replace(
    '<div className="p-4 md:p-8 space-y-8 bg-slate-50/50 min-h-screen">',
    '<PageShell maxWidth="5xl">\n            <div className="space-y-8 pb-28 sm:pb-12">'
)
content = content.replace('</PaymentModal>\n        </div>\n    )\n}', '</PaymentModal>\n            </div>\n        </PageShell>\n    )\n}')

# Header Redesign
content = content.replace(
    '<h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900">Управление финансами</h1>',
    '<h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900 truncate">Финансы</h1>'
)
content = content.replace(
    '<p className="text-slate-500 text-xs md:text-sm font-medium">Аналитика, ДДС и планирование платежей</p>',
    '<p className="text-slate-500 text-lg mt-2">Аналитика, ДДС и планирование платежей</p>'
)

content = content.replace(
    '<div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">',
    '<div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between mb-8">'
)

content = content.replace(
    '<div className="flex items-center gap-1 bg-white p-1 rounded-2xl shadow-sm border w-full sm:w-auto justify-between sm:justify-start">',
    '<div className="flex items-center gap-2 bg-white p-2 rounded-2xl shadow-sm border border-slate-200 w-full sm:w-auto justify-between sm:justify-start">'
)

content = content.replace('hover:bg-slate-100 rounded-xl h-9 w-9 shrink-0', 'hover:bg-slate-50 rounded-xl h-10 w-10 shrink-0 border border-slate-200')

content = content.replace(
    '<Button variant="outline" className="w-full rounded-2xl border-slate-200 hover:bg-slate-50 font-bold text-xs h-11 px-4">',
    '<Button variant="outline" className="w-full rounded-xl border-slate-200 hover:bg-slate-50 font-medium h-12 px-6 shadow-sm">'
)
content = content.replace(
    '<Button \n                            onClick={() => { setActiveTab(\'transactions\'); setTimeout(() => setTransactionDialogOpen(true), 100); }}\n                            className="flex-[2] sm:flex-none rounded-2xl shadow-lg shadow-primary/20 font-black text-xs h-11 px-6"\n                        >',
    '<Button \n                            onClick={() => { setActiveTab(\'transactions\'); setTimeout(() => setTransactionDialogOpen(true), 100); }}\n                            className="flex-[2] sm:flex-none rounded-xl bg-slate-900 text-white shadow-sm hover:bg-slate-800 font-medium h-12 px-6"\n                        >'
)

# Tabs Redesign
content = content.replace(
    '<TabsList className="w-full md:w-auto bg-white border p-1 rounded-xl mb-6 shadow-sm">',
    '<TabsList className="w-full md:w-auto bg-slate-100/50 border border-slate-200 p-1.5 rounded-2xl mb-8 shadow-sm">'
)
content = content.replace('rounded-lg px-6 font-medium data-[state=active]:bg-slate-100 data-[state=active]:text-primary', 'rounded-xl px-6 py-2.5 font-medium text-slate-500 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm transition-all')
content = content.replace('📊 Дашборд', 'Дашборд')
content = content.replace('📝 Операции', 'Операции')
content = content.replace('📈 Отчеты ДДС', 'Отчеты ДДС')

# Cards to div
content = re.sub(
    r'<Card className="border-none shadow-sm bg-white overflow-hidden relative group">',
    r'<div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden relative group">',
    content
)
content = content.replace(
    '<Card className="border-none shadow-sm bg-primary text-primary-foreground overflow-hidden relative group">',
    '<div className="bg-slate-900 rounded-3xl border border-slate-800 shadow-sm text-white overflow-hidden relative group">'
)
content = content.replace(
    '<Card className="lg:col-span-2 border-none shadow-sm">',
    '<div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 lg:col-span-2 shadow-sm">'
)
content = content.replace(
    '<Card className="border-none shadow-sm flex flex-col">',
    '<div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 flex flex-col shadow-sm">'
)
content = content.replace(
    '<Card className="border-none shadow-sm">',
    '<div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm">'
)
content = content.replace(
    '<Card className="lg:col-span-3 border-none shadow-sm">',
    '<div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 lg:col-span-3 shadow-sm">'
)
content = content.replace(
    '<Card className="border-none shadow-sm overflow-hidden">',
    '<div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">'
)

# Card inner components
content = content.replace('<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">', '<div className="flex flex-row items-center justify-between space-y-0 p-6 pb-2">')
content = content.replace('<CardHeader className="flex flex-row items-center justify-between">', '<div className="flex flex-row items-center justify-between mb-6">')
content = content.replace('<CardHeader className="pb-2">', '<div className="mb-4">')
content = content.replace('<CardHeader className="pb-0">', '<div className="mb-6">')
content = content.replace('<CardHeader>', '<div className="mb-6">')

content = content.replace('</CardHeader>', '</div>')

content = content.replace('<CardContent>', '<div className="p-6 pt-0">')
content = content.replace('<CardContent className="p-0">', '<div>')
content = content.replace('<CardContent className="h-[300px] mt-4">', '<div className="h-[300px]">')
content = content.replace('<CardContent className="flex-1 overflow-auto max-h-[380px] scrollbar-hide">', '<div className="flex-1 overflow-auto max-h-[380px] scrollbar-hide">')
content = content.replace('<CardContent className="pt-6">', '<div>')
content = content.replace('</CardContent>', '</div>')
content = content.replace('</Card>', '</div>')

content = content.replace('<CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500">', '<h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">')
content = content.replace('<CardTitle className="text-xs font-bold uppercase tracking-wider opacity-80">', '<h3 className="text-[10px] font-bold uppercase tracking-widest opacity-80">')
content = content.replace('<CardTitle className="text-lg font-bold">', '<h2 className="text-2xl font-bold tracking-tight text-slate-900">')
content = content.replace('</CardTitle>', '</h3>')

content = content.replace('<CardDescription className="text-xs font-medium">', '<p className="text-sm font-medium text-slate-500 mt-1">')
content = content.replace('</CardDescription>', '</p>')


# Top Expenses list
content = content.replace('<span className="flex items-center gap-2 text-slate-600">', '<span className="flex items-center gap-3 text-slate-700 font-medium">')
content = content.replace('<span className="text-lg">{expense.icon}</span>', '<div className="w-8 h-8 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-sm">{expense.icon}</div>')


with open("src/app/clubs/[clubId]/finance/page.tsx", "w", encoding="utf-8") as f:
    f.write(content)

