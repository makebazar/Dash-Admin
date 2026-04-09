import re

with open("src/app/clubs/[clubId]/employees/recruitment/templates/[templateId]/page.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Remove Card imports
content = re.sub(r'import \{ Card, CardContent \} from "@/components/ui/card"\n', '', content)

# Update max-width container to PageShell
content = content.replace(
    '<div className="mx-auto max-w-[1600px] overflow-x-hidden space-y-5 p-4 pb-28 sm:space-y-6 sm:p-6 sm:pb-6 lg:p-8">',
    '<PageShell maxWidth="5xl">\n            <div className="space-y-8 pb-28 sm:pb-12">'
)
content = content.replace('</PageShell>', '</div>\n        </PageShell>') # Fix end tag

# Update Header section
content = content.replace(
    '<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">',
    '<div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between mb-8">'
)

content = content.replace(
    '<h1 className="min-w-0 truncate text-2xl font-bold tracking-tight sm:text-3xl">{template.name}</h1>',
    '<h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900 truncate">{template.name}</h1>'
)

content = content.replace(
    '<p className="mt-1 text-sm text-muted-foreground sm:text-base">Здесь настраивается анкета кандидата: разделы, вопросы и тесты, которые он проходит</p>',
    '<p className="text-slate-500 text-lg mt-2">Здесь настраивается анкета кандидата: разделы, вопросы и тесты, которые он проходит</p>'
)

content = content.replace(
    '<Button onClick={handleSave} disabled={isSaving} className="hidden w-full bg-primary text-primary-foreground shadow-md hover:bg-primary/90 sm:inline-flex sm:w-auto">',
    '<Button onClick={handleSave} disabled={isSaving} className="hidden w-full bg-slate-900 text-white shadow-sm hover:bg-slate-800 rounded-xl h-11 px-6 font-medium sm:inline-flex sm:w-auto">'
)

# Replace Cards with plain divs
content = content.replace(
    '<Card className="min-w-0 border-none bg-white shadow-sm lg:col-span-1">',
    '<div className="bg-white rounded-3xl border border-slate-200 p-6 lg:col-span-1 flex flex-col gap-6">'
)
content = content.replace('<CardContent className="p-5 space-y-4">', '<div className="space-y-6">')
content = content.replace('</CardContent>', '</div>')
content = content.replace('</Card>', '</div>')

content = content.replace(
    '<Card className="min-w-0 border-none bg-white shadow-sm lg:col-span-2">',
    '<div className="bg-white rounded-3xl border border-slate-200 p-6 lg:col-span-2">'
)

# Update Labels
content = re.sub(
    r'<Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">',
    '<Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">',
    content
)

# Update Inputs and Textareas
content = content.replace('className="bg-muted/30 border-muted-foreground/10"', 'className="h-12 bg-slate-50/50 border-slate-200 rounded-xl font-medium text-slate-900 focus:bg-white"')
content = content.replace('className="min-h-[96px] resize-y bg-muted/30 border-muted-foreground/10"', 'className="min-h-[96px] resize-y bg-slate-50/50 border-slate-200 rounded-xl font-medium text-slate-900 focus:bg-white p-3"')
content = content.replace('className="min-w-0 bg-muted/30 border-muted-foreground/10"', 'className="h-12 bg-slate-50/50 border-slate-200 rounded-xl font-medium text-slate-900 focus:bg-white"')

# Misc updates for other fields
content = content.replace('rounded-xl border border-muted-foreground/10 p-3', 'rounded-2xl border border-slate-200 bg-slate-50/50 p-4')
content = content.replace('text-sm font-medium', 'text-sm font-bold text-slate-900')
content = content.replace('text-xs text-muted-foreground', 'text-xs text-slate-500 font-medium mt-0.5')

# Bottom bar update
content = content.replace('className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/80 p-4 backdrop-blur-xl sm:hidden pb-[calc(1rem+env(safe-area-inset-bottom))]"', 'className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/80 p-4 backdrop-blur-xl sm:hidden pb-[calc(1rem+env(safe-area-inset-bottom))]"')


with open("src/app/clubs/[clubId]/employees/recruitment/templates/[templateId]/page.tsx", "w", encoding="utf-8") as f:
    f.write(content)

