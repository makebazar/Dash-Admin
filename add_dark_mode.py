import os
import re

def add_dark_classes(content):
    # Regex replacements to add dark mode utility classes
    
    # Backgrounds
    content = re.sub(r'\bbg-white\b', r'bg-white dark:bg-slate-900/50', content)
    content = re.sub(r'\bbg-slate-50/50\b', r'bg-slate-50/50 dark:bg-slate-800/50', content)
    content = re.sub(r'\bbg-slate-50\b(?!/)', r'bg-slate-50 dark:bg-slate-800/50', content)
    content = re.sub(r'\bbg-slate-100\b(?!/)', r'bg-slate-100 dark:bg-slate-800', content)
    
    # Borders
    content = re.sub(r'\bborder-slate-100\b', r'border-slate-100 dark:border-slate-800/50', content)
    content = re.sub(r'\bborder-slate-200\b', r'border-slate-200 dark:border-slate-700/50', content)
    content = re.sub(r'\bborder-slate-300\b', r'border-slate-300 dark:border-slate-600/50', content)
    
    # Texts
    content = re.sub(r'\btext-slate-900\b', r'text-slate-900 dark:text-slate-100', content)
    content = re.sub(r'\btext-slate-700\b', r'text-slate-700 dark:text-slate-300', content)
    content = re.sub(r'\btext-slate-600\b', r'text-slate-600 dark:text-slate-400', content)
    content = re.sub(r'\btext-slate-500\b', r'text-slate-500 dark:text-slate-400', content)
    content = re.sub(r'\btext-slate-400\b', r'text-slate-400 dark:text-slate-500', content)
    content = re.sub(r'\btext-slate-300\b', r'text-slate-300 dark:text-slate-600', content)
    
    # Hover Backgrounds
    content = re.sub(r'\bhover:bg-slate-50\b(?!/)', r'hover:bg-slate-50 dark:hover:bg-slate-800/50', content)
    content = re.sub(r'\bhover:bg-slate-100\b', r'hover:bg-slate-100 dark:hover:bg-slate-800', content)
    content = re.sub(r'\bhover:bg-slate-200\b', r'hover:bg-slate-200 dark:hover:bg-slate-700', content)
    
    # Hover Texts
    content = re.sub(r'\bhover:text-slate-900\b', r'hover:text-slate-900 dark:hover:text-slate-100', content)
    content = re.sub(r'\bhover:text-slate-700\b', r'hover:text-slate-700 dark:hover:text-slate-300', content)
    
    # Hover Borders
    content = re.sub(r'\bhover:border-slate-200\b', r'hover:border-slate-200 dark:hover:border-slate-700/50', content)
    content = re.sub(r'\bhover:border-slate-300\b', r'hover:border-slate-300 dark:hover:border-slate-600/50', content)
    
    # Black elements (like Save buttons)
    # Be careful not to replace text-white inside an already dark button if we can't contextually parse.
    # Usually it's bg-slate-900 text-white. Let's do bg-slate-900 first.
    content = re.sub(r'\bbg-slate-900\b(?!/)(?! dark:)', r'bg-slate-900 dark:bg-slate-100', content)
    content = re.sub(r'\bhover:bg-slate-800\b(?!/)', r'hover:bg-slate-800 dark:hover:bg-slate-200', content)
    
    # Colored highlights
    content = re.sub(r'\bbg-purple-50\b(?!/)', r'bg-purple-50 dark:bg-purple-500/10', content)
    content = re.sub(r'\btext-purple-600\b', r'text-purple-600 dark:text-purple-400', content)
    
    content = re.sub(r'\bbg-rose-50\b(?!/)', r'bg-rose-50 dark:bg-rose-500/10', content)
    content = re.sub(r'\btext-rose-600\b', r'text-rose-600 dark:text-rose-400', content)
    
    content = re.sub(r'\bbg-emerald-50\b(?!/)', r'bg-emerald-50 dark:bg-emerald-500/10', content)
    content = re.sub(r'\btext-emerald-600\b', r'text-emerald-600 dark:text-emerald-400', content)
    
    content = re.sub(r'\bbg-blue-50\b(?!/)', r'bg-blue-50 dark:bg-blue-500/10', content)
    content = re.sub(r'\btext-blue-600\b', r'text-blue-600 dark:text-blue-400', content)
    
    content = re.sub(r'\bbg-amber-50\b(?!/)', r'bg-amber-50 dark:bg-amber-500/10', content)
    content = re.sub(r'\btext-amber-600\b', r'text-amber-600 dark:text-amber-400', content)

    # Fix duplicated dark: classes if any
    content = re.sub(r'(dark:\S+)\s+\1', r'\1', content)
    
    # We also need to fix `text-white` inside buttons that became `bg-slate-100` in dark mode.
    # A button like `bg-slate-900 dark:bg-slate-100 text-white` should be `... text-white dark:text-slate-900`
    content = content.replace('bg-slate-900 dark:bg-slate-100 text-white', 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900')
    
    return content

def process_directory(directory):
    for root, _, files in os.walk(directory):
        for file in files:
            if file.endswith('.tsx'):
                path = os.path.join(root, file)
                with open(path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                new_content = add_dark_classes(content)
                
                if new_content != content:
                    with open(path, 'w', encoding='utf-8') as f:
                        f.write(new_content)

if __name__ == '__main__':
    process_directory('src/app/clubs/[clubId]')
    process_directory('src/components')
