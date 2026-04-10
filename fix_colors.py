import re

with open("src/app/clubs/[clubId]/reviews/page.tsx", "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace('bg-indigo-600 hover:bg-indigo-700', 'bg-slate-900 hover:bg-slate-800')
content = content.replace('bg-green-600 hover:bg-green-700', 'bg-slate-900 hover:bg-slate-800 text-white')
content = content.replace('variant="destructive"', 'variant="outline" className="border-rose-200 text-rose-600 hover:bg-rose-50"')
content = content.replace('<Button onClick={() => setIsReviewMode(true)} variant="outline">', '<Button onClick={() => setIsReviewMode(true)} className="rounded-xl h-11 px-6 font-medium bg-slate-900 text-white hover:bg-slate-800">')
content = content.replace('<Button variant="outline" className="w-full sm:w-auto" onClick={() => {', '<Button variant="outline" className="w-full sm:w-auto rounded-xl h-11 px-6 font-medium" onClick={() => {')

with open("src/app/clubs/[clubId]/reviews/page.tsx", "w", encoding="utf-8") as f:
    f.write(content)
