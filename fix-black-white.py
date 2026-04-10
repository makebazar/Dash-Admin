import os
import re

def fix_black_white(content):
    content = re.sub(r'\bbg-black\b', r'bg-primary', content)
    content = re.sub(r'\btext-white\b', r'text-primary-foreground', content)
    content = re.sub(r'\btext-black\b', r'text-primary', content)
    content = re.sub(r'\bring-black\b', r'ring-ring', content)
    content = re.sub(r'\bborder-black\b', r'border-primary', content)
    
    # Clean up double text-primary-foreground
    content = re.sub(r'text-primary-foreground text-primary-foreground', r'text-primary-foreground', content)
    
    return content

for root, _, files in os.walk('src'):
    for file in files:
        if file.endswith('.tsx') or file.endswith('.ts'):
            path = os.path.join(root, file)
            with open(path, 'r') as f:
                content = f.read()
            new_content = fix_black_white(content)
            if new_content != content:
                with open(path, 'w') as f:
                    f.write(new_content)
                print(f"Fixed black/white in {path}")
