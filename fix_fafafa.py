import os
import re

def refactor_content(content):
    content = content.replace('bg-[#FAFAFA]', 'bg-background')
    content = content.replace('bg-[#fafafa]', 'bg-background')
    return content

for directory in ['src/app/clubs', 'src/app/employee', 'src/components/layout']:
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
                    print(f"Fixed fafafa: {path}")

