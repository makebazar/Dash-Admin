import os
import re

def refactor_content(content):
    # Backgrounds
    content = re.sub(r'\bbg-\[#FAFAFA\]\b', r'bg-background', content, flags=re.IGNORECASE)
    content = re.sub(r'\bbg-white\b', r'bg-card', content)
    content = re.sub(r'\bbg-slate-50\b', r'bg-muted', content)
    content = re.sub(r'\bbg-slate-100\b', r'bg-accent', content)
    content = re.sub(r'\bbg-slate-900\b', r'bg-primary', content)
    content = re.sub(r'\bbg-black\b', r'bg-primary', content)
    
    # Borders
    content = re.sub(r'\bborder-slate-100\b', r'border-border/50', content)
    content = re.sub(r'\bborder-slate-200\b', r'border-border', content)
    content = re.sub(r'\bborder-slate-300\b', r'border-border', content)
    content = re.sub(r'\bborder-black\b', r'border-primary', content)
    
    # Text colors
    content = re.sub(r'\btext-slate-900\b', r'text-foreground', content)
    content = re.sub(r'\btext-slate-800\b', r'text-foreground', content)
    content = re.sub(r'\btext-slate-700\b', r'text-foreground', content) # often used for slightly lighter text, foreground is fine or foreground/90
    content = re.sub(r'\btext-slate-600\b', r'text-muted-foreground', content)
    content = re.sub(r'\btext-slate-500\b', r'text-muted-foreground', content)
    content = re.sub(r'\btext-slate-400\b', r'text-muted-foreground/70', content)
    content = re.sub(r'\btext-black\b', r'text-foreground', content)
    
    # "text-white" inside primary elements (buttons etc)
    content = re.sub(r'\btext-white\b', r'text-primary-foreground', content)
    
    # Hovers
    content = re.sub(r'\bhover:bg-slate-50\b', r'hover:bg-accent', content)
    content = re.sub(r'\bhover:bg-slate-100\b', r'hover:bg-accent', content)
    content = re.sub(r'\bhover:bg-slate-200\b', r'hover:bg-accent', content)
    content = re.sub(r'\bhover:bg-slate-800\b', r'hover:bg-primary/90', content)
    content = re.sub(r'\bhover:bg-black/90\b', r'hover:bg-primary/90', content)
    content = re.sub(r'\bhover:text-slate-900\b', r'hover:text-foreground', content)
    content = re.sub(r'\bhover:text-black\b', r'hover:text-foreground', content)
    
    # Fixes for double classes if any
    content = content.replace('text-primary-foreground text-primary-foreground', 'text-primary-foreground')
    
    return content

directories_to_process = [
    'src/app/clubs',
    'src/app/employee',
    'src/components/layout'
]

for directory in directories_to_process:
    for root, _, files in os.walk(directory):
        for file in files:
            if file.endswith('.tsx') or file.endswith('.ts'):
                path = os.path.join(root, file)
                with open(path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                new_content = refactor_content(content)
                
                if new_content != content:
                    with open(path, 'w', encoding='utf-8') as f:
                        f.write(new_content)
                    print(f"Refactored: {path}")

print("Done refactoring semantic themes.")
