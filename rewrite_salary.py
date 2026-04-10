import re

with open("src/app/clubs/[clubId]/settings/salary/page.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Replace PageHeader
content = re.sub(
    r'<PageShell maxWidth="5xl">\s*<PageHeader\s*title="Схемы оплаты"\s*description="Настройте правила расчёта зарплаты для различных должностей"\s*>\s*<Link href=\{`/clubs/\$\{clubId\}/settings/salary/scheme/new`\}>\s*<Button className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-6 h-12 rounded-xl shadow-lg shadow-purple-200 gap-2 transition-all hover:scale-\[1.02\]">\s*<Plus className="h-5 w-5" />\s*Создать схему\s*</Button>\s*</Link>\s*</PageHeader>',
    r'''<PageShell maxWidth="5xl">
            <div className="space-y-8 pb-28 sm:pb-12">
            <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between mb-8">
                    <div className="min-w-0">
                        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900 truncate">Схемы оплаты</h1>
                        <p className="text-slate-500 text-lg mt-2">Настройте правила расчёта зарплаты для различных должностей</p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap lg:justify-end">
                        <Button asChild className="w-full bg-slate-900 text-white hover:bg-slate-800 sm:w-auto rounded-xl h-11 px-6 font-medium shadow-sm">
                            <Link href={`/clubs/${clubId}/settings/salary/scheme/new`}>
                                <Plus className="mr-2 h-4 w-4" />
                                Создать схему
                            </Link>
                        </Button>
                    </div>
                </div>
            </div>''',
    content,
    flags=re.DOTALL
)

# Empty state
content = re.sub(
    r'<Card className="border-2 border-dashed border-muted-foreground/10 bg-muted/5 rounded-\[2rem\]">\s*<CardContent className="flex flex-col items-center justify-center py-24">\s*<div className="h-24 w-24 rounded-\[2rem\] bg-purple-50 flex items-center justify-center mb-6">\s*<Wallet className="h-12 w-12 text-purple-600 opacity-40" />\s*</div>\s*<h3 className="text-2xl font-black tracking-tight mb-2">Схемы пока не созданы</h3>\s*<p className="text-muted-foreground text-sm max-w-\[300px\] text-center mb-8 font-medium">\s*Создайте первую схему оплаты, чтобы система могла автоматически рассчитывать зарплаты ваших сотрудников.\s*</p>\s*<Link href=\{`/clubs/\$\{clubId\}/settings/salary/scheme/new`\}>\s*<Button variant="outline" className="h-12 px-8 rounded-xl font-bold border-purple-200 text-purple-600 hover:bg-purple-50 gap-2">\s*<Plus className="h-4 w-4" />\s*Добавить схему\s*</Button>\s*</Link>\s*</CardContent>\s*</Card>',
    r'''<div className="rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-12 text-center text-slate-500">
                    <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 mb-6">
                        <Wallet className="h-10 w-10 text-slate-400" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-2">Схемы пока не созданы</h3>
                    <p className="text-slate-500 text-sm max-w-md mx-auto mb-8">
                        Создайте первую схему оплаты, чтобы система могла автоматически рассчитывать зарплаты ваших сотрудников.
                    </p>
                    <Button asChild className="rounded-xl h-11 px-6 font-medium bg-slate-900 text-white hover:bg-slate-800">
                        <Link href={`/clubs/${clubId}/settings/salary/scheme/new`}>
                            <Plus className="mr-2 h-4 w-4" />
                            Добавить схему
                        </Link>
                    </Button>
                </div>''',
    content,
    flags=re.DOTALL
)


# Card mapped items
content = re.sub(
    r'<Card key=\{scheme.id\} className=\{`group border-none shadow-sm hover:shadow-xl transition-all duration-300 rounded-\[2rem\] overflow-hidden \$\{!scheme.is_active \? \'opacity-60 grayscale\' : \'\'\}`\}>.*?<CardHeader className="pb-4 bg-gradient-to-br from-white to-slate-50/50">.*?<div className="flex items-start justify-between">.*?<div className="space-y-1">.*?<div className="flex items-center gap-2">.*?<div className="h-10 w-10 rounded-2xl bg-purple-50 flex items-center justify-center group-hover:bg-purple-600 group-hover:text-white transition-colors duration-300">.*?<Wallet className="h-5 w-5 text-purple-600 group-hover:text-white transition-colors duration-300" />.*?</div>.*?<CardTitle className="text-lg font-black tracking-tight">\{scheme.name\}</CardTitle>.*?</div>.*?\{scheme.description && \(\s*<CardDescription className="text-\[11px\] font-medium pl-12 line-clamp-1">\{scheme.description\}</CardDescription>\s*\)\}.*?</div>.*?<Badge variant="outline" className="text-\[10px\] font-black uppercase tracking-widest bg-white border-muted-foreground/10 px-2 rounded-lg">.*?v\{scheme.version \|\| 1\}.*?</Badge>.*?</div>.*?</CardHeader>.*?<CardContent className="space-y-6 pt-2">',
    r'''<div key={scheme.id} className={`bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 flex flex-col justify-between transition-all hover:shadow-md ${!scheme.is_active ? 'opacity-60 grayscale' : ''}`}>
                                <div>
                                    <div className="flex items-start justify-between mb-6">
                                        <div className="space-y-1 min-w-0 pr-4">
                                            <div className="flex items-center gap-3">
                                                <div className="h-12 w-12 rounded-2xl bg-slate-50 flex items-center justify-center shrink-0 border border-slate-100">
                                                    <Wallet className="h-6 w-6 text-slate-600" />
                                                </div>
                                                <div className="min-w-0">
                                                    <h3 className="text-xl font-bold text-slate-900 truncate">{scheme.name}</h3>
                                                    {scheme.description && (
                                                        <p className="text-sm text-slate-500 truncate mt-0.5">{scheme.description}</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 shrink-0 font-medium px-2.5 py-0.5 rounded-lg">
                                            v{scheme.version || 1}
                                        </Badge>
                                    </div>''',
    content,
    flags=re.DOTALL
)

# Replace the inner stats structure
content = re.sub(
    r'<!-- Stats Summary -->.*?<div className="grid grid-cols-2 gap-3">.*?<div className="bg-muted/20 rounded-2xl p-3 border border-muted-foreground/5">.*?<p className="text-\[10px\] font-black uppercase tracking-widest text-muted-foreground mb-1">Ставка</p>.*?<p className="text-sm font-bold flex items-center gap-1\.5">.*?<Coins className="h-3\.5 w-3\.5 text-purple-400" />.*?\{scheme.formula.base.type === \'hourly\'.*?\? `\$\{scheme.formula.base.amount \|\| scheme.formula.base.day_rate \|\| 0\} ₽/ч`.*?: `\$\{scheme.formula.base.amount \|\| scheme.formula.base.day_rate \|\| 0\} ₽/с`\}.*?</p>.*?</div>.*?<div className="bg-muted/20 rounded-2xl p-3 border border-muted-foreground/5">.*?<p className="text-\[10px\] font-black uppercase tracking-widest text-muted-foreground mb-1">Сотрудники</p>.*?<p className="text-sm font-bold flex items-center gap-1\.5">.*?<Users className="h-3\.5 w-3\.5 text-blue-400" />.*?\{scheme.employee_count \|\| 0\} <span className="text-\[11px\] text-muted-foreground font-medium">чел\.</span>.*?</p>.*?</div>.*?</div>',
    r'''{/* Stats Summary */}
                                    <div className="grid grid-cols-2 gap-4 mb-6">
                                        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                                            <p className="text-xs font-medium text-slate-500 mb-1">Ставка</p>
                                            <p className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                                                <Coins className="h-4 w-4 text-slate-400" />
                                                {scheme.formula.base.type === 'hourly' 
                                                    ? `${scheme.formula.base.amount || scheme.formula.base.day_rate || 0} ₽/ч`
                                                    : `${scheme.formula.base.amount || scheme.formula.base.day_rate || 0} ₽/с`}
                                            </p>
                                        </div>
                                        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                                            <p className="text-xs font-medium text-slate-500 mb-1">Сотрудники</p>
                                            <p className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                                                <Users className="h-4 w-4 text-slate-400" />
                                                {scheme.employee_count || 0} <span className="text-xs text-slate-500 font-medium">чел.</span>
                                            </p>
                                        </div>
                                    </div>''',
    content,
    flags=re.DOTALL
)

# KPI Section
content = re.sub(
    r'<div className="space-y-2">.*?<p className="text-\[10px\] font-black uppercase tracking-widest text-muted-foreground px-1">Активные KPI и бонусы</p>.*?<div className="bg-white rounded-2xl border border-muted-foreground/5 divide-y divide-muted-foreground/5 overflow-hidden">.*?\{formulaParts.map\(\(part, idx\) => \(.*?<div key=\{idx\} className="flex items-center justify-between p-3 hover:bg-muted/10 transition-colors">.*?<div className="flex items-center gap-2\.5">.*?<div className="p-1\.5 rounded-lg bg-slate-50 text-slate-400 group-hover:bg-white group-hover:text-purple-500 transition-colors">.*?\{part.icon && <part.icon className="h-3\.5 w-3\.5" />\}.*?</div>.*?<span className="text-\[11px\] font-bold text-muted-foreground uppercase tracking-tight">\{part.label\}</span>.*?</div>.*?</div>.*?\)\)}.*?\{scheme.period_bonuses && scheme.period_bonuses.length > 0 && scheme.period_bonuses.map\(\(pb, idx\) => \(.*?<div key=\{`pb-\$\{idx\}`\} className="flex items-center justify-between p-3 hover:bg-muted/10 transition-colors">.*?<div className="flex items-center gap-2\.5">.*?<div className="p-1\.5 rounded-lg bg-emerald-50 text-emerald-400 group-hover:bg-white group-hover:text-emerald-500 transition-colors">.*?<TrendingUp className="h-3\.5 w-3\.5" />.*?</div>.*?<span className="text-\[11px\] font-bold text-muted-foreground uppercase tracking-tight">\{pb.name\}</span>.*?</div>.*?</div>.*?\)\)}.*?\{\(formulaParts.length === 0 && \(!scheme.period_bonuses \|\| scheme.period_bonuses.length === 0\)\)\) && \(.*?<div className="p-4 text-center text-xs text-muted-foreground italic font-medium">.*?KPI не настроены.*?</div>.*?\)}.*?</div>.*?</div>',
    r'''<div className="space-y-3 mb-8">
                                        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Активные KPI и бонусы</p>
                                        <div className="space-y-2">
                                            {formulaParts.map((part, idx) => (
                                                <div key={idx} className="flex items-center gap-3">
                                                    <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                                                        {part.icon && <part.icon className="h-4 w-4 text-slate-600" />}
                                                    </div>
                                                    <span className="text-sm font-medium text-slate-700">{part.label}</span>
                                                </div>
                                            ))}
                                            {scheme.period_bonuses && scheme.period_bonuses.length > 0 && scheme.period_bonuses.map((pb, idx) => (
                                                <div key={`pb-${idx}`} className="flex items-center gap-3">
                                                    <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                                                        <TrendingUp className="h-4 w-4 text-emerald-600" />
                                                    </div>
                                                    <span className="text-sm font-medium text-slate-700">{pb.name}</span>
                                                </div>
                                            ))}
                                            {(formulaParts.length === 0 && (!scheme.period_bonuses || scheme.period_bonuses.length === 0)) && (
                                                <div className="text-sm text-slate-400 italic">
                                                    KPI не настроены
                                                </div>
                                            )}
                                        </div>
                                    </div>''',
    content,
    flags=re.DOTALL
)

# Actions
content = re.sub(
    r'<div className="flex gap-2 pt-2">.*?<Link href=\{`/clubs/\$\{clubId\}/settings/salary/scheme/\$\{scheme.id\}`\} className="flex-1">.*?<Button.*?Настроить.*?</Button>.*?</Link>.*?<Button.*?onClick=\{.*?handleDelete.*?\}?>.*?<Trash2.*?/>.*?</Button>.*?</div>.*?</CardContent>.*?</Card>',
    r'''</div>
                                <div className="flex items-center gap-2 pt-6 border-t border-slate-100 mt-auto">
                                    <Button asChild variant="outline" className="flex-1 rounded-xl h-11 font-medium border-slate-200 text-slate-700 hover:bg-slate-50">
                                        <Link href={`/clubs/${clubId}/settings/salary/scheme/${scheme.id}`}>
                                            <Edit className="mr-2 h-4 w-4" />
                                            Настроить
                                        </Link>
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-11 w-11 shrink-0 rounded-xl border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                                        onClick={() => handleDelete(scheme)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>''',
    content,
    flags=re.DOTALL
)

content = content.replace('            </div>\n        </PageShell>', '            </div>\n            </div>\n        </PageShell>')
content = content.replace('import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"\n', '')
content = content.replace('import { PageShell, PageHeader } from "@/components/layout/PageShell"', 'import { PageShell } from "@/components/layout/PageShell"')

with open("src/app/clubs/[clubId]/settings/salary/page.tsx", "w", encoding="utf-8") as f:
    f.write(content)
