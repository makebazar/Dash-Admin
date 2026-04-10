import re

with open("src/app/clubs/[clubId]/equipment/settings/ZonesSettingsTab.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Replace Card with styled div
content = re.sub(
    r'<Card className="shadow-sm">\s*<CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">\s*<div>\s*<CardTitle>(.*?)</CardTitle>\s*<CardDescription>(.*?)</CardDescription>\s*</div>\s*<Button onClick=\{\(\) => setIsCreating\(true\)\} disabled=\{isCreating \|\| isSaving\} className="sm:self-start">\s*<Plus className="mr-2 h-4 w-4" />\s*Добавить зону\s*</Button>\s*</CardHeader>\s*<CardContent className="space-y-4">',
    r'''<div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-8">
                <div>
                    <h2 className="text-xl font-bold text-slate-900">\1</h2>
                    <p className="text-sm text-slate-500 mt-1">
                        \2
                    </p>
                </div>
                <Button onClick={() => setIsCreating(true)} disabled={isCreating || isSaving} className="sm:self-start rounded-xl h-11 px-6 font-medium bg-slate-900 text-white hover:bg-slate-800">
                    <Plus className="mr-2 h-4 w-4" />
                    Добавить зону
                </Button>
            </div>
            
            <div className="space-y-6">''',
    content,
    flags=re.DOTALL
)

content = content.replace('</CardContent>\n        </Card>', '</div>\n        </div>')
content = content.replace('import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"\n', '')

with open("src/app/clubs/[clubId]/equipment/settings/ZonesSettingsTab.tsx", "w", encoding="utf-8") as f:
    f.write(content)
