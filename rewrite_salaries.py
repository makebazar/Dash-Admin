import re

with open("src/app/clubs/[clubId]/salaries/page.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Add PageShell import
if 'import { PageShell }' not in content:
    content = content.replace("import PayrollDashboard from '@/components/payroll/PayrollDashboard';", "import PayrollDashboard from '@/components/payroll/PayrollDashboard';\nimport { PageShell } from '@/components/layout/PageShell';")

# Update return statement to wrap with PageShell
content = content.replace(
    "return <PayrollDashboard clubId={clubId} />;",
    "return (\n        <PageShell maxWidth=\"5xl\">\n            <PayrollDashboard clubId={clubId} />\n        </PageShell>\n    );"
)

with open("src/app/clubs/[clubId]/salaries/page.tsx", "w", encoding="utf-8") as f:
    f.write(content)


with open("src/components/payroll/PayrollDashboard.tsx", "r", encoding="utf-8") as f:
    dashboard_content = f.read()

# Remove Card imports
dashboard_content = re.sub(r'import \{ Card, CardContent, CardHeader, CardTitle \} from "@/components/ui/card";\n', '', dashboard_content)
dashboard_content = re.sub(r'import \{ Card, CardContent, CardHeader, CardTitle \} from '"'"'@/components/ui/card'"'"';\n', '', dashboard_content)

# Update the main container padding/spacing since PageShell handles it
dashboard_content = dashboard_content.replace(
    '<div className="space-y-5 p-4 md:space-y-6 md:p-8">',
    '<div className="space-y-8 pb-28 sm:pb-12">'
)

# Header section styling
dashboard_content = dashboard_content.replace(
    '<div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">',
    '<div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-8">'
)

dashboard_content = dashboard_content.replace(
    '<h1 className="text-[2rem] font-semibold tracking-[-0.04em] text-slate-900 md:text-3xl md:font-bold md:tracking-tight">Зарплаты</h1>',
    '<h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900">Зарплаты</h1>'
)

dashboard_content = dashboard_content.replace(
    '<p className="text-[15px] text-muted-foreground md:text-sm">Начисления, выплаты и остатки по сотрудникам</p>',
    '<p className="text-slate-500 text-lg mt-2">Начисления, выплаты и остатки по сотрудникам</p>'
)

# Date navigator
dashboard_content = dashboard_content.replace(
    '<div className="flex w-full items-center justify-between gap-2 rounded-2xl border bg-muted/40 p-1.5 md:w-auto md:gap-2 md:rounded-lg md:p-1">',
    '<div className="flex w-full items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white p-2 md:w-auto md:gap-3 shadow-sm">'
)

# Stats Cards
# Replace Card components with divs
dashboard_content = dashboard_content.replace(
    '<Card className="rounded-2xl border-slate-100 shadow-sm">',
    '<div className="bg-white rounded-3xl border border-slate-200 p-6 flex flex-col gap-4">'
)
dashboard_content = dashboard_content.replace(
    '<CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1 md:p-6 md:pb-2">',
    '<div className="flex flex-row items-center justify-between space-y-0">'
)
dashboard_content = dashboard_content.replace(
    '<CardTitle className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground md:text-sm md:tracking-wider">',
    '<h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">'
)
dashboard_content = dashboard_content.replace('</CardTitle>', '</h3>')
dashboard_content = dashboard_content.replace('</CardHeader>', '</div>')

dashboard_content = dashboard_content.replace(
    '<CardContent className="p-3 md:p-6 pt-0 md:pt-0">',
    '<div>'
)
dashboard_content = dashboard_content.replace(
    '<div className="text-2xl font-semibold tracking-[-0.03em] text-slate-900 md:text-2xl md:font-bold md:tracking-tight">',
    '<div className="text-3xl font-black tracking-tight text-slate-900">'
)
dashboard_content = dashboard_content.replace(
    '<div className="text-xl font-semibold tracking-[-0.03em] text-slate-900 md:text-2xl md:font-bold md:tracking-tight">',
    '<div className="text-3xl font-black tracking-tight text-slate-900">'
)

# Leaderboard Card
dashboard_content = dashboard_content.replace(
    '<Card>',
    '<div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8">'
)
dashboard_content = dashboard_content.replace(
    '<CardHeader className="pb-3">',
    '<div className="mb-6">'
)
dashboard_content = dashboard_content.replace(
    '<CardTitle className="text-base flex items-center gap-2">',
    '<h2 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-3">'
)
dashboard_content = dashboard_content.replace('</CardContent>', '</div>')
dashboard_content = dashboard_content.replace('</Card>', '</div>')

# Employee Cards
dashboard_content = dashboard_content.replace(
    '<Card key={employee.id} className="overflow-hidden border-slate-200/60 transition-all hover:shadow-md">',
    '<div key={employee.id} className="bg-white rounded-3xl border border-slate-200 overflow-hidden transition-all hover:shadow-md">'
)
dashboard_content = dashboard_content.replace(
    '<CardContent className="p-4 md:p-6">',
    '<div className="p-6 sm:p-8">'
)

# Modal styling
dashboard_content = dashboard_content.replace(
    '<div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">',
    '<div className="bg-white rounded-3xl border border-slate-200 shadow-2xl p-8 max-w-md w-full mx-4">'
)
dashboard_content = dashboard_content.replace(
    '<h2 className="text-xl font-semibold mb-4">',
    '<h2 className="text-2xl font-bold tracking-tight text-slate-900 mb-6">'
)
dashboard_content = dashboard_content.replace(
    '<div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl border animate-in zoom-in duration-200">',
    '<div className="bg-white rounded-3xl border border-slate-200 shadow-2xl p-8 max-w-sm w-full mx-4 animate-in zoom-in duration-200">'
)

# General inputs/textareas inside modals
dashboard_content = dashboard_content.replace(
    'className="w-full border rounded px-3 py-2"',
    'className="w-full h-12 bg-slate-50/50 border border-slate-200 rounded-xl px-4 font-medium text-slate-900 focus:bg-white transition-colors"'
)
dashboard_content = dashboard_content.replace(
    'className="block text-sm font-medium mb-1"',
    'className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2"'
)
dashboard_content = dashboard_content.replace(
    'className="block text-sm font-medium mb-2"',
    'className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3"'
)


with open("src/components/payroll/PayrollDashboard.tsx", "w", encoding="utf-8") as f:
    f.write(dashboard_content)

