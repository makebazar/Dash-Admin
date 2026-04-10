import re

with open("src/app/clubs/[clubId]/equipment/inventory/InstructionsTab.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Replace main Card wrapper with div
content = re.sub(
    r'<Card className="overflow-hidden border-none shadow-sm">\s*<CardHeader className="gap-5 border-b px-4 py-4 md:px-6 md:py-5">\s*<div className="flex items-start justify-between gap-4">\s*<div className="min-w-0">\s*<CardTitle className="text-xl tracking-tight text-slate-950 md:text-2xl">\s*Настройки обслуживания\s*</CardTitle>\s*<CardDescription className="mt-1 text-sm">\s*Интервал и инструкция для выбранного типа оборудования.\s*</CardDescription>\s*</div>\s*<Button\s*onClick=\{handleSave\}\s*disabled=\{isSaving \|\| !hasUnsavedChanges\}\s*className=\{cn\(\s*"hidden md:inline-flex h-10 shrink-0 rounded-xl px-4",\s*hasUnsavedChanges && "bg-green-600 hover:bg-green-700"\s*\)\}\s*>\s*\{isSaving \? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />\}\s*\{hasUnsavedChanges \? "Сохранить изменения" : "Сохранено"\}\s*</Button>\s*</div>',
    r'''<div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-8 border-b border-slate-100 pb-6">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900">Настройки обслуживания</h2>
                        <p className="text-sm text-slate-500 mt-1">Интервал и инструкция для выбранного типа оборудования.</p>
                    </div>
                    <Button
                        onClick={handleSave}
                        disabled={isSaving || !hasUnsavedChanges}
                        className={cn(
                            "hidden md:inline-flex rounded-xl h-11 px-6 font-medium",
                            hasUnsavedChanges ? "bg-green-600 hover:bg-green-700 text-white" : "bg-slate-900 text-white hover:bg-slate-800"
                        )}
                    >
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        {hasUnsavedChanges ? "Сохранить изменения" : "Сохранено"}
                    </Button>
                </div>''',
    content,
    flags=re.DOTALL
)

# Remove CardHeader closing
content = content.replace('</CardHeader>\n\n                    <div className="grid gap-4 lg:grid-cols-[minmax(320px,1fr)_180px] lg:items-end">', '<div className="grid gap-6 lg:grid-cols-[minmax(320px,1fr)_180px] lg:items-end mb-8">')

# Replace CardContent with div
content = content.replace('<CardContent className="bg-slate-50/50 p-0 md:bg-white md:p-6 lg:pt-0">', '<div>')
content = content.replace('</CardContent>\n            </Card>', '</div>\n            </div>')

content = content.replace('import {\n    Card,\n    CardContent,\n    CardDescription,\n    CardHeader,\n    CardTitle,\n} from "@/components/ui/card"\n', '')

with open("src/app/clubs/[clubId]/equipment/inventory/InstructionsTab.tsx", "w", encoding="utf-8") as f:
    f.write(content)
