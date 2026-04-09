import re

with open("src/components/finance/TransactionList.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Remove Card imports
content = re.sub(r'import \{ Card, CardContent, CardHeader, CardTitle \} from "@/components/ui/card"\n', '', content)

# Replace Cards with plain divs
content = content.replace(
    '<Card className="border-none shadow-sm">',
    '<div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">'
)

content = content.replace(
    '<CardHeader className="flex flex-row items-center justify-between pb-2">',
    '<div className="flex flex-row items-center justify-between p-6 sm:p-8 pb-4">'
)
content = content.replace(
    '<CardHeader>',
    '<div className="p-6 sm:p-8 pb-4">'
)

content = content.replace('<CardTitle className="text-xl font-bold">', '<h2 className="text-2xl font-bold tracking-tight text-slate-900">')
content = content.replace('</CardTitle>', '</h2>')
content = content.replace('</CardHeader>', '</div>')

content = content.replace('<CardContent className="space-y-4">', '<div className="p-6 sm:p-8 pt-0 space-y-6">')
content = content.replace('<CardContent>', '<div className="p-6 sm:p-8 pt-0">')
content = content.replace('</CardContent>', '</div>')

content = content.replace('</Card>', '</div>')

with open("src/components/finance/TransactionList.tsx", "w", encoding="utf-8") as f:
    f.write(content)

