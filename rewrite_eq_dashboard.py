import re

with open("src/app/clubs/[clubId]/equipment/page.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Remove Card imports
content = re.sub(r'import \{ Card, CardContent \} from "@/components/ui/card"\n', '', content)

# Remove PageHeader if it exists (we'll manually build the header for more control)
content = content.replace(
    '<PageHeader\n                title="Управление оборудованием"\n                description="Комплексный контроль техники, периферии и её состояния"\n            />',
    '''<div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between mb-8">
                <div className="space-y-1">
                    <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900 truncate">Оборудование</h1>
                    <p className="text-slate-500 text-lg mt-2">Комплексный контроль техники, периферии и её состояния</p>
                </div>
            </div>'''
)
content = content.replace('maxWidth="7xl"', 'maxWidth="5xl"')

# Key Signals Cards -> Divs
content = content.replace(
    '<Card className="group h-full cursor-pointer border-none bg-gradient-to-br from-white to-amber-50/50 shadow-sm transition-all hover:shadow-md">',
    '<div className="group h-full cursor-pointer rounded-3xl border border-amber-200/50 bg-gradient-to-br from-white to-amber-50/50 shadow-sm transition-all hover:shadow-md">'
)
content = content.replace(
    '<Card className="group h-full cursor-pointer border-none bg-gradient-to-br from-white to-rose-50/40 shadow-sm transition-all hover:shadow-md">',
    '<div className="group h-full cursor-pointer rounded-3xl border border-rose-200/50 bg-gradient-to-br from-white to-rose-50/40 shadow-sm transition-all hover:shadow-md">'
)

content = content.replace('<CardContent className="pt-6">', '<div className="p-6 sm:p-8">')
content = content.replace('</CardContent>', '</div>')
content = content.replace('</Card>', '</div>')

# Quick Actions Cards -> Divs
content = content.replace(
    '<Card className="group hover:border-primary/50 transition-all cursor-pointer h-full border-dashed overflow-hidden">',
    '<div className="group hover:border-slate-300 transition-all cursor-pointer h-full bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md">'
)
content = content.replace('<CardContent className="p-!0">', '<div className="p-0">')
content = content.replace('</CardContent>', '</div>')

with open("src/app/clubs/[clubId]/equipment/page.tsx", "w", encoding="utf-8") as f:
    f.write(content)

