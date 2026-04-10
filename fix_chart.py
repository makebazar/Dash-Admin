import re

with open('src/app/clubs/[clubId]/RevenueTrendChart.tsx', 'r') as f:
    content = f.read()

# Replace hardcoded SVG colors with semantic classes
content = content.replace('stroke="#E2E8F0"', 'className="stroke-border"')
content = content.replace('stroke="#CBD5E1"', 'className="stroke-border/70"')
content = content.replace('stroke="#94A3B8"', 'className="stroke-muted-foreground/50"')
content = content.replace('stroke="#2563EB"', 'className="stroke-primary"')
content = content.replace('fill="#FFFFFF"', 'className="fill-background"')
content = content.replace('stroke="#fff"', 'className="stroke-background"')
content = content.replace('stroke="#BFDBFE"', 'className="stroke-primary/30"')
content = content.replace('fill={point.revenue === 0 ? "#CBD5E1" : "#2563EB"}', 'className={point.revenue === 0 ? "fill-muted-foreground" : "fill-primary"}')
content = content.replace('fill="none"', 'fill="none"') # Just a placeholder
content = content.replace('fill="url(#revenueGradient)"', 'fill="url(#revenueGradient)"')

# Fix text fills
content = content.replace('fill="#64748B"', 'className="fill-muted-foreground"')
content = content.replace('fill="#0F172A"', 'className="fill-foreground"')
content = content.replace('fill="#334155"', 'className="fill-foreground/90"')
content = content.replace('fill="#2563EB"', 'className="fill-primary"')

with open('src/app/clubs/[clubId]/RevenueTrendChart.tsx', 'w') as f:
    f.write(content)
