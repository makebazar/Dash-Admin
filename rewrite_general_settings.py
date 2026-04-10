import re

with open("src/app/clubs/[clubId]/settings/general/page.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Header rewrite
content = re.sub(
    r'<PageShell maxWidth="2xl">\s*<PageHeader\s*title="Общие настройки"\s*description="Основная информация о клубе"\s*/>',
    r'''<PageShell maxWidth="5xl">
            <div className="space-y-8 pb-28 sm:pb-12 max-w-2xl">
            <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between mb-8">
                    <div className="min-w-0">
                        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900 truncate">Общие настройки</h1>
                        <p className="text-slate-500 text-lg mt-2">Основная информация о клубе</p>
                    </div>
                </div>
            </div>''',
    content,
    flags=re.DOTALL
)

# Fix Inputs to use rounded-xl and h-11
content = content.replace(
    '<Input\n                                id="name"',
    '<Input\n                                id="name"\n                                className="h-11 rounded-xl"'
)
content = content.replace(
    '<Input\n                                    id="address"',
    '<Input\n                                    id="address"\n                                    className="h-11 rounded-xl pl-10"'
)
# remove the existing className="pl-10" from address input if it's there
content = content.replace('\n                                    className="pl-10"\n                                />', '\n                                />')


# Fix select classes
old_select_class = 'className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"'
new_select_class = 'className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"'
content = content.replace(old_select_class, new_select_class)


# Fix Cards -> custom div
content = re.sub(
    r'<Card>\s*<CardHeader>\s*<CardTitle className="flex items-center gap-2">\s*<Building className="h-5 w-5" />\s*Информация о клубе\s*</CardTitle>\s*<CardDescription>Название и адрес вашего заведения</CardDescription>\s*</CardHeader>\s*<CardContent className="space-y-4">',
    r'''<div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8">
                    <div className="mb-6">
                        <h3 className="flex items-center gap-2 text-xl font-bold text-slate-900">
                            <Building className="h-5 w-5 text-slate-500" />
                            Информация о клубе
                        </h3>
                        <p className="text-sm text-slate-500 mt-1">Название и адрес вашего заведения</p>
                    </div>
                    <div className="space-y-4">''',
    content,
    flags=re.DOTALL
)

content = re.sub(
    r'<Card className="border-purple-500/20">\s*<CardHeader>\s*<CardTitle className="flex items-center gap-2">\s*<Globe className="h-5 w-5 text-purple-500" />\s*Часовой пояс\s*</CardTitle>\s*<CardDescription>\s*Все время в отчетах будет отображаться в выбранном часовом поясе\s*</CardDescription>\s*</CardHeader>\s*<CardContent>',
    r'''<div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
                    <div className="mb-6 relative z-10">
                        <h3 className="flex items-center gap-2 text-xl font-bold text-slate-900">
                            <Globe className="h-5 w-5 text-purple-500" />
                            Часовой пояс
                        </h3>
                        <p className="text-sm text-slate-500 mt-1">Все время в отчетах будет отображаться в выбранном часовом поясе</p>
                    </div>
                    <div className="relative z-10">''',
    content,
    flags=re.DOTALL
)

content = re.sub(
    r'<Card className="border-orange-500/20">\s*<CardHeader>\s*<CardTitle className="flex items-center gap-2">\s*<Sun className="h-5 w-5 text-orange-500" />\s*<Moon className="h-4 w-4 text-blue-500" />\s*Дневные и ночные смены\s*</CardTitle>\s*<CardDescription>\s*Настройте границы для автоматического определения типа смены\s*</CardDescription>\s*</CardHeader>\s*<CardContent className="space-y-4">',
    r'''<div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
                    <div className="mb-6 relative z-10">
                        <h3 className="flex items-center gap-2 text-xl font-bold text-slate-900">
                            <Sun className="h-5 w-5 text-orange-500" />
                            Дневные и ночные смены
                        </h3>
                        <p className="text-sm text-slate-500 mt-1">Настройте границы для автоматического определения типа смены</p>
                    </div>
                    <div className="space-y-6 relative z-10">''',
    content,
    flags=re.DOTALL
)

# Fix CardContent closing
content = content.replace('</CardContent>\n                </Card>', '</div>\n                </div>')
# Fix closing tags for the remaining sections
content = content.replace('                    </CardContent>\n                </Card>', '                    </div>\n                </div>')

# Fix save button
content = re.sub(
    r'<Button onClick=\{handleSave\} disabled=\{isSaving\} className="w-full" size="lg">.*?Сохранить настройки\s*</Button>',
    r'''<div className="pt-4">
                    <Button onClick={handleSave} disabled={isSaving} className="w-full rounded-xl h-12 text-base font-medium bg-slate-900 text-white hover:bg-slate-800 shadow-sm">
                        {isSaving ? (
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        ) : (
                            <Save className="mr-2 h-5 w-5" />
                        )}
                        Сохранить настройки
                    </Button>
                </div>''',
    content,
    flags=re.DOTALL
)

# Close the wrapper div
content = content.replace('            </div>\n        </PageShell>', '            </div>\n            </div>\n        </PageShell>')

# Remove Card imports
content = content.replace('import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"\n', '')

# Remove PageHeader from import
content = content.replace('import { PageShell, PageHeader } from "@/components/layout/PageShell"', 'import { PageShell } from "@/components/layout/PageShell"')

with open("src/app/clubs/[clubId]/settings/general/page.tsx", "w", encoding="utf-8") as f:
    f.write(content)
