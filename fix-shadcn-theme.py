import os
import re

def fix_theme(content):
    # Backgrounds
    content = re.sub(r'\bbg-white\b', r'bg-card', content)
    content = re.sub(r'\bbg-slate-50\b', r'bg-muted', content)
    content = re.sub(r'\bbg-slate-100\b', r'bg-accent', content)
    content = re.sub(r'\bbg-slate-900\b', r'bg-primary', content)
    
    # Borders
    content = re.sub(r'\bborder-slate-100\b', r'border-border/50', content)
    content = re.sub(r'\bborder-slate-200\b', r'border-border', content)
    content = re.sub(r'\bborder-slate-300\b', r'border-border', content)
    
    # Texts
    content = re.sub(r'\btext-slate-900\b', r'text-foreground', content)
    content = re.sub(r'\btext-slate-800\b', r'text-foreground', content)
    content = re.sub(r'\btext-slate-700\b', r'text-foreground/90', content)
    content = re.sub(r'\btext-slate-600\b', r'text-muted-foreground', content)
    content = re.sub(r'\btext-slate-500\b', r'text-muted-foreground', content)
    content = re.sub(r'\btext-slate-400\b', r'text-muted-foreground/70', content)
    
    # Text white (often used inside primary buttons)
    content = re.sub(r'\btext-white\b', r'text-primary-foreground', content)
    
    # Hovers
    content = re.sub(r'\bhover:bg-slate-50\b', r'hover:bg-accent', content)
    content = re.sub(r'\bhover:bg-slate-100\b', r'hover:bg-accent', content)
    content = re.sub(r'\bhover:bg-slate-800\b', r'hover:bg-primary/90', content)
    content = re.sub(r'\bhover:text-slate-900\b', r'hover:text-foreground', content)
    
    return content

for root, _, files in os.walk('src'):
    for file in files:
        if file.endswith('.tsx') or file.endswith('.ts'):
            path = os.path.join(root, file)
            with open(path, 'r') as f:
                content = f.read()
            new_content = fix_theme(content)
            if new_content != content:
                with open(path, 'w') as f:
                    f.write(new_content)
                print(f"Fixed {path}")
