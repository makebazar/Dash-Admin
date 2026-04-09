import re

with open("src/app/clubs/[clubId]/finance/page.tsx", "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace('Добро пожаловать в центр управления финансами!</h2>', 'Добро пожаловать в центр управления финансами!</h3>')
content = content.replace('<h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">', '<h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">\n')
content = content.replace('</CardTitle>', '</h3>')

# Also fix the previous broken replace where </h3> was replaced with </h2> for ALL elements
content = re.sub(r'<h3 className="text-\[10px\](.*?)</h2>', r'<h3 className="text-[10px]\1</h3>', content, flags=re.DOTALL)


with open("src/app/clubs/[clubId]/finance/page.tsx", "w", encoding="utf-8") as f:
    f.write(content)

with open("src/app/clubs/[clubId]/finance/settings/page.tsx", "r", encoding="utf-8") as f:
    s_content = f.read()

s_content = s_content.replace('</CardContent>', '</div>')
s_content = s_content.replace('</Card>', '</div>')
s_content = s_content.replace('<CardContent className="space-y-4 pt-4">', '<div className="space-y-6 pt-4">')
s_content = s_content.replace('<CardContent className="pt-4 space-y-4">', '<div className="space-y-6 pt-4">')
s_content = s_content.replace('<CardContent className="space-y-4">', '<div className="space-y-6">')
s_content = s_content.replace('<CardContent>', '<div>')

with open("src/app/clubs/[clubId]/finance/settings/page.tsx", "w", encoding="utf-8") as f:
    f.write(s_content)

