import re

with open("src/components/payroll/PayrollDashboard.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Other cards to div
content = content.replace(
    '<Card className="bg-background border rounded-xl p-4 space-y-4 shadow-sm">',
    '<div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-6">'
)
content = content.replace(
    '<Card className="bg-background border rounded-xl p-4 space-y-4">',
    '<div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-6">'
)

content = content.replace(
    'className="bg-muted/30 p-4 rounded-xl border mt-4"',
    'className="bg-slate-50/50 p-6 rounded-2xl border border-slate-200 mt-6"'
)
content = content.replace(
    'className="bg-muted/30 p-3 rounded-xl border flex flex-col items-center"',
    'className="bg-slate-50/50 p-4 rounded-2xl border border-slate-200 flex flex-col items-center shadow-sm"'
)
content = content.replace(
    'className="rounded-xl border border-slate-100 overflow-hidden bg-white shadow-sm"',
    'className="rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-sm mt-4"'
)
content = content.replace(
    'className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm"',
    'className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm"'
)

# Badges and buttons
content = content.replace('variant="outline" className="text-[10px] h-5 gap-1 bg-amber-50 text-amber-700 border-amber-100"', 'variant="outline" className="text-[10px] h-5 gap-1 bg-amber-50 text-amber-700 border-amber-200 font-bold uppercase tracking-wider"')
content = content.replace('variant="secondary" className="text-[10px] h-5"', 'variant="secondary" className="text-[10px] h-5 font-bold uppercase tracking-wider bg-slate-100 text-slate-600"')

with open("src/components/payroll/PayrollDashboard.tsx", "w", encoding="utf-8") as f:
    f.write(content)

