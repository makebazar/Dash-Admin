import re

with open("src/app/clubs/[clubId]/reviews/[evaluationId]/page.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Replace PageShell usage
content = re.sub(
    r'<PageShell maxWidth="6xl">\s*<PageHeader.*?>\s*<Button asChild variant="outline".*?</Button>\s*</PageHeader>',
    r'''<PageShell maxWidth="5xl">
            <div className="space-y-8 pb-28 sm:pb-12">
            <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between mb-8">
                    <div className="min-w-0">
                        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900 truncate">Проверка чеклиста</h1>
                        <p className="text-slate-500 text-lg mt-2">{evaluation.template_name}</p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap lg:justify-end">
                        <Button asChild variant="outline" className="hidden md:inline-flex rounded-xl h-11 px-6 font-medium">
                            <Link href={`/clubs/${clubId}/reviews?tab=checklists`}>
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Назад к проверкам
                            </Link>
                        </Button>
                    </div>
                </div>
            </div>''',
    content,
    flags=re.DOTALL
)

# I need to make sure I add Link import if it's missing, wait `import Link from "next/link"`
if "import Link" not in content:
    content = content.replace('import { useRouter } from "next/navigation"', 'import { useRouter } from "next/navigation"\nimport Link from "next/link"')


# Fix generic cards
content = content.replace('<Card className="shadow-sm">', '<div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8">')
content = content.replace('<Card className="border-none shadow-sm bg-muted/20">', '<div className="bg-slate-50 rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8">')
content = content.replace('<CardHeader className="pb-4">', '<div className="mb-6">')
content = content.replace('<CardContent>', '<div>')
content = content.replace('<CardContent className="space-y-6">', '<div className="space-y-6">')
content = content.replace('<CardContent className="pt-6">', '<div className="pt-6">')
content = content.replace('</CardContent>', '</div>')
content = content.replace('</CardHeader>', '</div>')
content = content.replace('</Card>', '</div>')
content = content.replace('<CardTitle className="text-lg">', '<h3 className="text-xl font-bold text-slate-900">')
content = content.replace('<CardTitle>', '<h3 className="text-xl font-bold text-slate-900">')
content = content.replace('</CardTitle>', '</h3>')
content = content.replace('<CardDescription>', '<p className="text-sm text-slate-500 mt-1">')
content = content.replace('</CardDescription>', '</p>')


# Fix list items cards
content = re.sub(
    r'<Card\s*key=\{resp.id\}\s*className=\{cn\(\s*"overflow-hidden transition-colors shadow-sm",\s*isRejected \? "border-destructive\/50" : "border-border"\s*\)\}\s*>',
    r'''<div
                            key={resp.id}
                            className={cn(
                                "bg-white rounded-3xl border shadow-sm p-6 sm:p-8 overflow-hidden transition-colors",
                                isRejected ? "border-rose-300" : "border-slate-200"
                            )}
                        >''',
    content,
    flags=re.DOTALL
)

# Replace <CardContent className="p-0"> for list items
content = content.replace('<CardContent className="p-0">', '<div>')

# Fix bottom sticky bar
content = content.replace(
    '<div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur supports-[backdrop-filter]:bg-background/80">',
    '<div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/80 p-4 backdrop-blur-xl pb-[calc(1rem+env(safe-area-inset-bottom))]">'
)
content = content.replace(
    '<div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 md:px-6">',
    '<div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4">'
)

content = content.replace('variant="destructive"', 'variant="outline" className="border-rose-200 text-rose-600 hover:bg-rose-50"')
content = content.replace('bg-green-600 hover:bg-green-700', 'bg-slate-900 hover:bg-slate-800 text-white')
content = content.replace('text-green-600', 'text-slate-900')
content = content.replace('bg-green-50 text-green-700', 'bg-slate-100 text-slate-900')

# End tag for PageShell wrapper
content = content.replace('</PageShell>', '</div>\n        </PageShell>')

# Remove old Card imports and PageHeader
content = content.replace('import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"\n', '')
content = content.replace('import { PageShell, PageHeader } from "@/components/layout/PageShell"', 'import { PageShell } from "@/components/layout/PageShell"')

with open("src/app/clubs/[clubId]/reviews/[evaluationId]/page.tsx", "w", encoding="utf-8") as f:
    f.write(content)
