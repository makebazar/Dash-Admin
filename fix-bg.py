import os
import re

def fix_bg(content):
    content = re.sub(r'bg-\[#FAFAFA\]', r'bg-slate-50 dark:bg-slate-950', content)
    content = re.sub(r'selection:bg-black/10', r'selection:bg-slate-200 dark:selection:bg-slate-800', content)
    return content

for root, _, files in os.walk('src'):
    for file in files:
        if file.endswith('.tsx') or file.endswith('.ts'):
            path = os.path.join(root, file)
            with open(path, 'r') as f:
                content = f.read()
            new_content = fix_bg(content)
            if new_content != content:
                with open(path, 'w') as f:
                    f.write(new_content)
                print(f"Fixed {path}")
