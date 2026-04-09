import re

with open("src/components/finance/FinanceReports.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Remove Card imports
content = re.sub(r'import \{ Card, CardContent, CardHeader, CardTitle, CardDescription \} from "@/components/ui/card"\n', '', content)

# Replace Cards with plain divs
content = content.replace(
    '<Card className="border-none shadow-sm bg-white overflow-hidden">',
    '<div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">'
)
content = content.replace('<CardContent className="p-6">', '<div className="p-6 sm:p-8">')
content = content.replace('</CardContent>', '</div>')
content = content.replace('</Card>', '</div>')

with open("src/components/finance/FinanceReports.tsx", "w", encoding="utf-8") as f:
    f.write(content)

