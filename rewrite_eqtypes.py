import re

with open("src/app/clubs/[clubId]/equipment/settings/EquipmentTypesTab.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Replace main wrapper and cards
content = content.replace(
    '''<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                        <h2 className="text-xl font-semibold tracking-tight text-slate-950">Типы оборудования</h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Системные типы доступны всем клубам, а свои типы ты можешь добавлять и настраивать отдельно.
                        </p>
                    </div>
                    <Button onClick={openCreateDialog} className="h-10 rounded-xl">
                        <Plus className="mr-2 h-4 w-4" />
                        Добавить тип
                    </Button>
                </div>''',
    '''<div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-8">
                        <div>
                            <h2 className="text-xl font-bold text-slate-900">Типы оборудования</h2>
                            <p className="text-sm text-slate-500 mt-1">
                                Системные типы доступны всем клубам, а свои типы ты можешь добавлять и настраивать отдельно.
                            </p>
                        </div>
                        <Button onClick={openCreateDialog} className="sm:self-start rounded-xl h-11 px-6 font-medium bg-slate-900 text-white hover:bg-slate-800">
                            <Plus className="mr-2 h-4 w-4" />
                            Добавить тип
                        </Button>
                    </div>

                    <div className="grid gap-8 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">'''
)

# Custom Types Card -> div
content = re.sub(
    r'<Card className="border-none shadow-sm">\s*<CardHeader>\s*<CardTitle>Типы клуба</CardTitle>\s*<CardDescription>Собственные типы оборудования для этого клуба</CardDescription>\s*</CardHeader>\s*<CardContent className="space-y-3">',
    r'''<div>
                            <div className="mb-4">
                                <h3 className="text-lg font-bold text-slate-900">Типы клуба</h3>
                                <p className="text-sm text-slate-500 mt-1">Собственные типы оборудования для этого клуба</p>
                            </div>
                            <div className="space-y-4">''',
    content,
    flags=re.DOTALL
)
content = content.replace('</CardContent>\n                    </Card>', '</div>\n                        </div>')

# System Types Card -> div
content = re.sub(
    r'<Card className="border-none shadow-sm">\s*<CardHeader>\s*<CardTitle>Системные типы</CardTitle>\s*<CardDescription>Базовые типы, которые доступны всем клубам</CardDescription>\s*</CardHeader>\s*<CardContent className="space-y-3">',
    r'''<div>
                            <div className="mb-4">
                                <h3 className="text-lg font-bold text-slate-900">Системные типы</h3>
                                <p className="text-sm text-slate-500 mt-1">Базовые типы, которые доступны всем клубам</p>
                            </div>
                            <div className="space-y-3">''',
    content,
    flags=re.DOTALL
)

# Close the new wrapping div
content = content.replace('</CardContent>\n                    </Card>\n                </div>\n            </div>', '</div>\n                        </div>\n                    </div>\n                </div>\n            </div>')

content = content.replace('import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"\n', '')

with open("src/app/clubs/[clubId]/equipment/settings/EquipmentTypesTab.tsx", "w", encoding="utf-8") as f:
    f.write(content)
