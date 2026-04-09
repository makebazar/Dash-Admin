import re

with open("src/app/clubs/[clubId]/finance/settings/page.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Add PageShell import
if 'import { PageShell }' not in content:
    content = content.replace("import Link from \"next/link\"", "import Link from \"next/link\"\nimport { PageShell } from \"@/components/layout/PageShell\"")

# Main Container Update
content = content.replace(
    '<div className="p-4 md:p-8 space-y-6 max-w-6xl mx-auto bg-slate-50/50 min-h-screen">',
    '<PageShell maxWidth="5xl">\n            <div className="space-y-8 pb-28 sm:pb-12">'
)
content = content.replace('</div>\n        </div>\n    )\n}', '</div>\n        </PageShell>\n    )\n}')

# Header Redesign
content = content.replace(
    '<div className="flex items-center gap-4 border-b pb-4">',
    '<div className="flex items-center gap-6 mb-8 border-b border-slate-200 pb-6">'
)
content = content.replace(
    '<h1 className="text-2xl font-bold tracking-tight">Настройки финансов</h1>',
    '<h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900">Настройки финансов</h1>'
)
content = content.replace(
    '<Button variant="ghost" size="icon" asChild>',
    '<Button variant="ghost" size="icon" asChild className="rounded-2xl h-12 w-12 hover:bg-slate-100">'
)

# Tabs List
content = content.replace(
    '<TabsList className="grid w-full grid-cols-4">',
    '<TabsList className="w-full md:w-auto bg-slate-100/50 border border-slate-200 p-1.5 rounded-2xl mb-8 shadow-sm flex overflow-x-auto">'
)
content = content.replace(
    'className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"',
    'className="rounded-xl px-6 py-2.5 font-medium text-slate-500 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm transition-all"'
)

# Replace Cards with clean divs
content = re.sub(
    r'<Card className="border-none shadow-sm">',
    r'<div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm">',
    content
)
content = re.sub(
    r'<Card className="bg-background border-slate-200">',
    r'<div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm">',
    content
)

# Card inner structure
content = content.replace('<CardHeader className="pb-4">', '<div className="mb-6">')
content = content.replace('<CardHeader>', '<div className="mb-6">')
content = content.replace('</CardHeader>', '</div>')

content = content.replace('<CardContent className="space-y-4">', '<div className="space-y-6">')
content = content.replace('<CardContent>', '<div>')
content = content.replace('</CardContent>', '</div>')

content = content.replace('</Card>', '</div>')

content = content.replace('<CardTitle className="text-lg">', '<h2 className="text-2xl font-bold tracking-tight text-slate-900">')
content = content.replace('<CardTitle className="text-xl">', '<h2 className="text-2xl font-bold tracking-tight text-slate-900">')
content = content.replace('</CardTitle>', '</h2>')

content = content.replace('<CardDescription>', '<p className="text-sm font-medium text-slate-500 mt-2">')
content = content.replace('</CardDescription>', '</p>')


# Buttons
content = content.replace(
    '<Button variant="outline" size="sm" onClick={() => setIsAccountModalOpen(true)}>',
    '<Button variant="outline" size="sm" className="rounded-xl h-10 px-4 font-medium border-slate-200 shadow-sm" onClick={() => setIsAccountModalOpen(true)}>'
)
content = content.replace(
    '<Button variant="outline" size="sm" onClick={() => {',
    '<Button variant="outline" size="sm" className="rounded-xl h-10 px-4 font-medium border-slate-200 shadow-sm" onClick={() => {'
)

# Lists / Inner cards
content = content.replace(
    'className="flex items-center justify-between p-4 rounded-xl border bg-card hover:bg-accent/5 transition-colors"',
    'className="flex items-center justify-between p-5 rounded-2xl border border-slate-200 bg-white hover:border-primary/20 hover:shadow-sm transition-all"'
)
content = content.replace(
    'className="flex items-center justify-between p-4 rounded-xl border bg-card"',
    'className="flex items-center justify-between p-5 rounded-2xl border border-slate-200 bg-white hover:border-primary/20 hover:shadow-sm transition-all"'
)
content = content.replace(
    'className="flex flex-col gap-4 p-4 rounded-xl border bg-card"',
    'className="flex flex-col gap-4 p-5 rounded-2xl border border-slate-200 bg-white shadow-sm"'
)
content = content.replace(
    'className="p-4 rounded-xl border bg-card"',
    'className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm"'
)

# Badges and generic text
content = content.replace(
    '<span className="text-sm font-medium text-muted-foreground uppercase">',
    '<span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">'
)

with open("src/app/clubs/[clubId]/finance/settings/page.tsx", "w", encoding="utf-8") as f:
    f.write(content)

