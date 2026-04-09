import re

with open("src/app/apply/[token]/page.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Remove Card imports
content = re.sub(r'import \{ Card, CardContent \} from "@/components/ui/card"\n', '', content)

# Background
content = content.replace('bg-[#F9FAFB]', 'bg-slate-50')

# Card replacement
content = content.replace(
    '<Card className="max-w-lg w-full border-none shadow-sm bg-white">',
    '<div className="max-w-lg w-full bg-white rounded-3xl border border-slate-200 shadow-sm">'
)
content = content.replace(
    '<Card className="border-none shadow-sm bg-white">',
    '<div className="bg-white rounded-3xl border border-slate-200 shadow-sm">'
)
content = content.replace('<CardContent className="p-6">', '<div className="p-6 sm:p-8">')
content = content.replace('<CardContent className="p-6 space-y-5">', '<div className="p-6 sm:p-8 space-y-8">')
content = content.replace('<CardContent className="p-8 flex flex-col items-center text-center gap-3">', '<div className="p-10 flex flex-col items-center text-center gap-4">')
content = content.replace('</CardContent>', '</div>')
content = content.replace('</Card>', '</div>')

# Typography
content = content.replace(
    'text-2xl font-bold tracking-tight sm:text-3xl',
    'text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl'
)
content = content.replace(
    'mt-1 text-sm text-muted-foreground sm:text-base',
    'mt-2 text-base text-slate-500'
)

# Labels
content = re.sub(
    r'<Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">',
    '<Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">',
    content
)

# Inputs
content = content.replace(
    'className="bg-muted/30 border-muted-foreground/10"',
    'className="h-12 bg-slate-50/50 border-slate-200 rounded-xl font-medium text-slate-900 focus:bg-white"'
)
content = content.replace(
    'className="min-h-[96px] resize-y bg-muted/30 border-muted-foreground/10"',
    'className="min-h-[96px] resize-y bg-slate-50/50 border-slate-200 rounded-xl font-medium text-slate-900 focus:bg-white p-3"'
)

# Panels
content = content.replace(
    'rounded-xl border border-muted-foreground/10 p-4',
    'rounded-2xl border border-slate-200 bg-slate-50/50 p-5'
)
content = content.replace(
    'rounded-xl border border-muted-foreground/10 bg-muted/20',
    'rounded-2xl border border-slate-100 bg-slate-50'
)

# Buttons
content = content.replace(
    'className="w-full bg-primary text-primary-foreground shadow-md hover:bg-primary/90"',
    'className="w-full bg-slate-900 text-white shadow-sm hover:bg-slate-800 rounded-xl h-12 font-medium"'
)

content = content.replace(
    'border-muted-foreground/10',
    'border-slate-200'
)
content = content.replace(
    'border-muted-foreground/30',
    'border-slate-300'
)
content = content.replace(
    'text-muted-foreground',
    'text-slate-500'
)
content = content.replace(
    'bg-primary',
    'bg-slate-900'
)
content = content.replace(
    'border-primary',
    'border-slate-900'
)

with open("src/app/apply/[token]/page.tsx", "w", encoding="utf-8") as f:
    f.write(content)

