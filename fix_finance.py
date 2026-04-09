with open("src/app/clubs/[clubId]/finance/page.tsx", "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace('</h3>', '</h2>')

with open("src/app/clubs/[clubId]/finance/page.tsx", "w", encoding="utf-8") as f:
    f.write(content)

with open("src/app/clubs/[clubId]/finance/settings/page.tsx", "r", encoding="utf-8") as f:
    settings_content = f.read()

settings_content = settings_content.replace('<CardTitle className="text-lg font-black">', '<h2 className="text-2xl font-bold tracking-tight text-slate-900">')
settings_content = settings_content.replace('<CardDescription className="text-xs font-medium">', '<p className="text-sm font-medium text-slate-500 mt-2">')

with open("src/app/clubs/[clubId]/finance/settings/page.tsx", "w", encoding="utf-8") as f:
    f.write(settings_content)

