#!/bin/bash
FILES=(
  "src/app/clubs/[clubId]/settings/reports/page.tsx"
  "src/app/clubs/[clubId]/settings/checklists/page.tsx"
  "src/app/clubs/[clubId]/settings/checklists/[templateId]/page.tsx"
  "src/app/clubs/[clubId]/settings/access/page.tsx"
)

for file in "${FILES[@]}"; do
  # Backgrounds
  sed -i '' 's/bg-white/bg-white dark:bg-slate-900\/50/g' "$file"
  sed -i '' 's/bg-slate-50\/50/bg-slate-50\/50 dark:bg-slate-800\/50/g' "$file"
  sed -i '' 's/bg-slate-50/bg-slate-50 dark:bg-slate-800/g' "$file"
  sed -i '' 's/bg-slate-100/bg-slate-100 dark:bg-slate-800/g' "$file"
  
  # Black buttons
  sed -i '' 's/bg-slate-900 text-white/bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900/g' "$file"
  sed -i '' 's/bg-slate-900/bg-slate-900 dark:bg-slate-100/g' "$file"
  sed -i '' 's/text-white/text-white dark:text-slate-900/g' "$file"
  sed -i '' 's/hover:bg-slate-800/hover:bg-slate-800 dark:hover:bg-slate-200/g' "$file"
  
  # Borders
  sed -i '' 's/border-slate-100/border-slate-100 dark:border-slate-800/g' "$file"
  sed -i '' 's/border-slate-200/border-slate-200 dark:border-slate-700/g' "$file"
  sed -i '' 's/border-slate-300/border-slate-300 dark:border-slate-600/g' "$file"
  
  # Text colors
  sed -i '' 's/text-slate-900/text-slate-900 dark:text-slate-100/g' "$file"
  sed -i '' 's/text-slate-700/text-slate-700 dark:text-slate-300/g' "$file"
  sed -i '' 's/text-slate-600/text-slate-600 dark:text-slate-400/g' "$file"
  sed -i '' 's/text-slate-500/text-slate-500 dark:text-slate-400/g' "$file"
  sed -i '' 's/text-slate-400/text-slate-400 dark:text-slate-500/g' "$file"
  sed -i '' 's/text-slate-300/text-slate-300 dark:text-slate-600/g' "$file"

  # Purple/Rose colors
  sed -i '' 's/bg-purple-50/bg-purple-50 dark:bg-purple-900\/20/g' "$file"
  sed -i '' 's/text-purple-600/text-purple-600 dark:text-purple-400/g' "$file"
  sed -i '' 's/bg-rose-50/bg-rose-50 dark:bg-rose-900\/20/g' "$file"
  sed -i '' 's/text-rose-600/text-rose-600 dark:text-rose-400/g' "$file"
  
  # Emerald colors
  sed -i '' 's/bg-emerald-50/bg-emerald-50 dark:bg-emerald-900\/20/g' "$file"
  sed -i '' 's/text-emerald-600/text-emerald-600 dark:text-emerald-400/g' "$file"
done

echo "Replacements done"
