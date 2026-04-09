import re

with open("src/app/clubs/[clubId]/employees/recruitment/tests/[testId]/page.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Add PageShell import
if 'import { PageShell }' not in content:
    content = content.replace('import { Badge } from "@/components/ui/badge"', 'import { Badge } from "@/components/ui/badge"\nimport { PageShell } from "@/components/layout/PageShell"')

# Remove Card imports
content = re.sub(r'import \{ Card, CardContent \} from "@/components/ui/card"\n', '', content)

# Update max-width container to PageShell
content = content.replace(
    '<div className="mx-auto max-w-[1600px] space-y-5 p-4 sm:space-y-6 sm:p-6 lg:p-8">',
    '<PageShell maxWidth="5xl">\n            <div className="space-y-8 pb-28 sm:pb-12">'
)

content = content.replace(
    '<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">',
    '<div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between mb-8">'
)

content = content.replace(
    '<h1 className="text-2xl font-bold tracking-tight sm:text-3xl truncate">{test.name}</h1>',
    '<h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900 truncate">{test.name}</h1>'
)

content = content.replace(
    '<p className="mt-1 text-sm text-muted-foreground sm:text-base">Редактор теста (вопросы + автоскор)</p>',
    '<p className="text-slate-500 text-lg mt-2">Редактор теста (вопросы + автоскор)</p>'
)

content = content.replace(
    '<Button onClick={handleSave} disabled={isSaving || (!rawMode && Boolean(schemaValidationError))} className="w-full bg-primary text-primary-foreground shadow-md hover:bg-primary/90 sm:w-auto">',
    '<Button onClick={handleSave} disabled={isSaving || (!rawMode && Boolean(schemaValidationError))} className="hidden w-full bg-slate-900 text-white shadow-sm hover:bg-slate-800 rounded-xl h-11 px-6 font-medium sm:inline-flex sm:w-auto">'
)
content = content.replace(
    '<Button asChild variant="outline" className="w-full sm:w-auto">',
    '<Button asChild variant="outline" className="hidden sm:inline-flex sm:w-auto rounded-xl h-11">'
)

# Replace Cards with plain divs
content = content.replace(
    '<Card className="border-none shadow-sm bg-white lg:col-span-1">',
    '<div className="bg-white rounded-3xl border border-slate-200 p-6 lg:col-span-1 flex flex-col gap-6">'
)
content = content.replace('<CardContent className="p-5 space-y-4">', '<div className="space-y-6">')
content = content.replace('</CardContent>', '</div>')
content = content.replace('</Card>', '</div>')

content = content.replace(
    '<Card className="border-none shadow-sm bg-white lg:col-span-2">',
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
content = content.replace('className="min-h-[88px] resize-y bg-muted/30 border-muted-foreground/10"', 'className="min-h-[88px] resize-y bg-slate-50/50 border-slate-200 rounded-xl font-medium text-slate-900 focus:bg-white p-3"')
content = content.replace('className="h-9 bg-muted/30 border-muted-foreground/10"', 'className="h-11 bg-slate-50/50 border-slate-200 rounded-xl font-medium text-slate-900 focus:bg-white"')
content = content.replace('className="h-10 bg-muted/30 border-muted-foreground/10"', 'className="h-12 bg-slate-50/50 border-slate-200 rounded-xl font-medium text-slate-900 focus:bg-white"')

# Misc updates for other fields
content = content.replace('rounded-xl border border-muted-foreground/10 p-3', 'rounded-2xl border border-slate-200 bg-slate-50/50 p-4')
content = content.replace('rounded-2xl border border-muted-foreground/10 p-4', 'rounded-2xl border border-slate-200 bg-slate-50/50 p-5')
content = content.replace('text-sm font-medium', 'text-sm font-bold text-slate-900')
content = content.replace('text-xs text-muted-foreground', 'text-xs text-slate-500 font-medium mt-0.5')

# Bottom bar update
content = content.replace('</div>\n        </div>\n    )\n}', '''</div>
            </div>
            <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/80 p-4 backdrop-blur-xl sm:hidden pb-[calc(1rem+env(safe-area-inset-bottom))]">
                <div className="mx-auto flex max-w-[1600px] gap-2">
                    <Button asChild variant="outline" className="flex-1 h-12 rounded-xl border-slate-200 text-slate-700 bg-white font-medium">
                        <Link href={`/clubs/${clubId}/employees/recruitment/templates`}>
                            Назад
                        </Link>
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving || (!rawMode && Boolean(schemaValidationError))} className="flex-1 h-12 rounded-xl bg-slate-900 text-white hover:bg-slate-800 font-medium shadow-sm">
                        {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <><span>Сохранить</span></>}
                    </Button>
                </div>
            </div>
        </PageShell>
    )
}''')


with open("src/app/clubs/[clubId]/employees/recruitment/tests/[testId]/page.tsx", "w", encoding="utf-8") as f:
    f.write(content)

