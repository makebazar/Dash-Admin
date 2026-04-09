import re

with open("src/components/finance/DDSReport.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Remove Card imports
content = re.sub(r'import \{ Card, CardContent, CardHeader, CardTitle, CardDescription \} from "@/components/ui/card"\n', '', content)

# Replace Cards with plain divs
content = content.replace(
    '<Card className="border-none shadow-sm bg-white overflow-hidden">',
    '<div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">'
)
content = content.replace('<CardHeader className="pb-8 border-b border-slate-50">', '<div className="p-6 sm:p-8 pb-8 border-b border-slate-100">')
content = content.replace('</CardHeader>', '</div>')

content = content.replace('<CardTitle className="text-2xl font-black text-slate-900">', '<h2 className="text-2xl font-bold tracking-tight text-slate-900">')
content = content.replace('</CardTitle>', '</h2>')

content = content.replace('<CardDescription className="text-sm font-medium text-slate-500 mt-1">', '<p className="text-sm font-medium text-slate-500 mt-2">')
content = content.replace('</CardDescription>', '</p>')

content = content.replace('<CardContent className="p-0">', '<div>')
content = content.replace('</CardContent>', '</div>')
content = content.replace('</Card>', '</div>')

content = content.replace(
    '<Card className="border-none shadow-sm bg-blue-50/50 rounded-3xl p-6 border border-blue-100">',
    '<div className="bg-blue-50/50 rounded-3xl p-6 sm:p-8 border border-blue-100 shadow-sm">'
)
content = content.replace(
    '<Card className="border-none shadow-sm bg-emerald-50/50 rounded-3xl p-6 border border-emerald-100">',
    '<div className="bg-emerald-50/50 rounded-3xl p-6 sm:p-8 border border-emerald-100 shadow-sm">'
)

with open("src/components/finance/DDSReport.tsx", "w", encoding="utf-8") as f:
    f.write(content)

