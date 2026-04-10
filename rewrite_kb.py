import re

with open("src/app/clubs/[clubId]/kb/page.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Update mobile Start Content header to match the rest of the style if needed
content = content.replace(
    '''<h1 className="text-xl font-bold text-slate-900">База знаний</h1>''',
    '''<h1 className="text-3xl font-bold tracking-tight text-slate-900">База знаний</h1>'''
)

# Update sidebar title
content = content.replace(
    '''<h2 className="text-lg font-bold flex items-center gap-2 min-w-0">''',
    '''<h2 className="text-2xl font-bold flex items-center gap-2 min-w-0 tracking-tight text-slate-900">'''
)

content = content.replace(
    '''<Input
                        placeholder="Поиск..."
                        className="pl-9 bg-slate-50 border-none shadow-none w-full max-w-full"''',
    '''<Input
                        placeholder="Поиск..."
                        className="pl-9 bg-slate-50 border-none shadow-none w-full max-w-full h-11 rounded-xl"'''
)

# Update article list to remove rounded-lg border in favor of cleaner list
content = content.replace(
    '''className="w-full text-left rounded-lg border px-4 py-3 hover:bg-slate-50 transition-colors"''',
    '''className="w-full text-left rounded-xl border border-slate-200 px-6 py-4 hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-sm"'''
)
content = content.replace(
    '''<div className="font-medium text-slate-900">{article.title}</div>''',
    '''<div className="text-lg font-bold text-slate-900">{article.title}</div>'''
)

# Replace indigo with slate-900 for main action buttons
content = content.replace('bg-indigo-600 hover:bg-indigo-700', 'bg-slate-900 hover:bg-slate-800')
content = content.replace('bg-indigo-50 text-indigo-700', 'bg-slate-100 text-slate-900')
content = content.replace('text-indigo-600', 'text-slate-900')

# Update empty state
content = content.replace(
    '''<div className="rounded-lg border border-dashed p-6 text-center text-sm text-slate-500">''',
    '''<div className="rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-12 text-center text-slate-500 font-medium">'''
)

# Update layout wrapping to ensure it feels like PageShell but using full height
# It already uses h-[calc(100vh-64px)] which is fine.

# Update Add buttons
content = content.replace('size="sm"', '')
content = content.replace('variant="outline" size="sm"', 'variant="outline"')
content = content.replace(
    '''<Button variant="outline" onClick={() => {''',
    '''<Button variant="outline" className="rounded-xl h-11 px-6 font-medium" onClick={() => {'''
)
content = content.replace(
    '''<Button className="bg-slate-900 hover:bg-slate-800 text-white" onClick={() => {''',
    '''<Button className="rounded-xl h-11 px-6 font-medium bg-slate-900 text-white hover:bg-slate-800" onClick={() => {'''
)
content = content.replace(
    '''<Button variant="outline">
                                                    Шаблоны
                                                </Button>''',
    '''<Button variant="outline" className="rounded-xl h-11 px-6 font-medium">
                                                    Шаблоны
                                                </Button>'''
)

# Replace all Button instances that got "size='sm'" removed but still need formatting
content = content.replace(
    '''<Button variant="outline" onClick={() => {
                                            setEditingArticle(selectedArticle)''',
    '''<Button variant="outline" className="rounded-xl h-11 px-6 font-medium" onClick={() => {
                                            setEditingArticle(selectedArticle)'''
)

# Bottom mobile buttons
content = content.replace(
    '''className="h-11 w-full justify-center bg-slate-900 text-white hover:bg-slate-800"''',
    '''className="h-12 w-full justify-center bg-slate-900 text-white hover:bg-slate-800 rounded-xl font-medium"'''
)
content = content.replace(
    '''className="h-11 w-full justify-center"''',
    '''className="h-12 w-full justify-center rounded-xl font-medium"'''
)
content = content.replace(
    '''<Button type="button" variant="outline" size="icon" className="h-11 w-11 justify-center rounded-md">''',
    '''<Button type="button" variant="outline" size="icon" className="h-12 w-12 justify-center rounded-xl">'''
)

with open("src/app/clubs/[clubId]/kb/page.tsx", "w", encoding="utf-8") as f:
    f.write(content)
