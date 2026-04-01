export const dynamic = 'force-dynamic'
export const revalidate = 0

import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  BarChart3,
  BookOpen,
  Building2,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  DollarSign,
  Monitor,
  Package,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Users,
  Wallet,
  Wrench,
  Zap,
} from "lucide-react"

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-black text-white selection:bg-purple-500/30">

      {/* Header */}
      <header className="px-6 lg:px-12 h-20 flex items-center justify-between border-b border-white/10 sticky top-0 bg-black/80 backdrop-blur-md z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-tr from-purple-500 to-blue-500 rounded-lg flex items-center justify-center">
            <Zap className="text-white w-5 h-5 fill-current" />
          </div>
          <span className="font-bold text-xl tracking-tight">DashAdmin</span>
        </div>

        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-400">
          <Link href="#features" className="hover:text-white transition-colors">Функции</Link>
          <Link href="#how" className="hover:text-white transition-colors">Как работает</Link>
          <Link href="#pricing" className="hover:text-white transition-colors">Цены</Link>
          <Link href="#about" className="hover:text-white transition-colors">О нас</Link>
        </nav>

        <div className="flex items-center gap-4">
          <Link href="/support" className="text-sm font-medium text-gray-400 hover:text-white transition-colors hidden sm:block">
            Поддержка
          </Link>
          <Link href="/login" className="text-sm font-medium text-gray-400 hover:text-white transition-colors hidden sm:block">
            Войти
          </Link>
          <Button asChild className="bg-white text-black hover:bg-gray-200 transition-all font-semibold rounded-full px-6">
            <Link href="/login">Начать</Link>
          </Button>
        </div>
      </header>

      <main className="flex-1">

        {/* Hero Section */}
        <section className="relative pt-32 pb-20 px-6 overflow-hidden">
          <div className="absolute top-0 right-0 -mr-20 -mt-20 w-[500px] h-[500px] bg-purple-500/20 rounded-full blur-[120px] pointer-events-none" />
          <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />

          <div className="max-w-5xl mx-auto text-center relative z-10">
            <div className="inline-flex items-center px-3 py-1 rounded-full border border-white/10 bg-white/5 text-xs font-medium text-purple-300 mb-8 animate-fade-in-up">
              <span className="flex w-2 h-2 bg-purple-500 rounded-full mr-2 animate-pulse"></span>
              Единая админка для компьютерного клуба
            </div>

            <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-8 bg-gradient-to-b from-white to-gray-500 bg-clip-text text-transparent">
              Владельцу — порядок <br className="hidden md:block" /> в деньгах и процессах
            </h1>

            <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
              Смена закрылась — вы видите выручку и расходы. Зарплата и премии считаются по правилам. Склад и техника под
              контролем. Всё в одной системе — для владельца и команды.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                asChild
                size="lg"
                className="h-14 px-8 text-base bg-blue-600 hover:bg-blue-500 rounded-full shadow-[0_0_40px_-10px_rgba(37,99,235,0.5)] transition-all transform hover:scale-105"
              >
                <Link href="/login">Попробовать бесплатно</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="h-14 px-8 text-base border-white/10 bg-white/5 hover:bg-white/10 rounded-full text-white backdrop-blur-sm"
              >
                <Link href="#features">Смотреть возможности</Link>
              </Button>
            </div>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-2 text-xs text-gray-300">
              <Pill icon={<DollarSign className="w-3.5 h-3.5 text-green-400" />}>Финансы</Pill>
              <Pill icon={<Clock className="w-3.5 h-3.5 text-sky-300" />}>Смены</Pill>
              <Pill icon={<Wallet className="w-3.5 h-3.5 text-blue-300" />}>Зарплаты и премии</Pill>
              <Pill icon={<Package className="w-3.5 h-3.5 text-amber-300" />}>Склад</Pill>
              <Pill icon={<Wrench className="w-3.5 h-3.5 text-purple-300" />}>Обслуживание</Pill>
              <Pill icon={<ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />}>Роли и доступы</Pill>
            </div>

            {/* Dashboard Preview Mockup */}
            <div className="mt-20 relative mx-auto max-w-5xl rounded-xl border border-white/10 bg-gray-900/50 backdrop-blur-sm p-2 shadow-2xl">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-50 blur-sm"></div>
              <div className="rounded-lg overflow-hidden bg-black aspect-video border border-white/5">
                <div className="h-full w-full bg-gradient-to-br from-slate-950 via-black to-slate-950 p-4 sm:p-6">
                  <div className="grid grid-cols-12 gap-4 h-full">
                    <div className="hidden md:flex md:col-span-3 flex-col gap-3 rounded-xl border border-white/10 bg-white/5 p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-white">
                        <div className="h-7 w-7 rounded-lg bg-gradient-to-tr from-purple-500 to-blue-500" />
                        <span>Мой клуб</span>
                      </div>
                      <div className="mt-2 space-y-2 text-xs text-gray-400">
                        <PreviewNavItem icon={<Clock className="w-4 h-4" />} label="Смены" />
                        <PreviewNavItem icon={<DollarSign className="w-4 h-4" />} label="Финансы" />
                        <PreviewNavItem icon={<Wallet className="w-4 h-4" />} label="Зарплаты" />
                        <PreviewNavItem icon={<Package className="w-4 h-4" />} label="Склад" />
                        <PreviewNavItem icon={<Monitor className="w-4 h-4" />} label="Оборудование" />
                        <PreviewNavItem icon={<ClipboardCheck className="w-4 h-4" />} label="Проверки" />
                      </div>
                      <div className="mt-auto rounded-lg border border-white/10 bg-black/40 p-3">
                        <div className="flex items-center gap-2 text-xs text-gray-300">
                          <ShieldCheck className="w-4 h-4 text-emerald-300" />
                          Доступы по ролям
                        </div>
                        <div className="mt-1 text-[11px] text-gray-500">
                          Владелец • Управляющий • Сотрудник
                        </div>
                      </div>
                    </div>

                    <div className="col-span-12 md:col-span-9 flex flex-col gap-4">
                      <div className="grid grid-cols-3 gap-3">
                        <PreviewMetric title="Выручка" value="154 200₽" trend="+12%" tone="green" />
                        <PreviewMetric title="Расходы" value="48 950₽" trend="-3%" tone="amber" />
                        <PreviewMetric title="Прибыль" value="105 250₽" trend="+18%" tone="blue" />
                      </div>

                      <div className="grid grid-cols-12 gap-4 flex-1">
                        <div className="col-span-12 lg:col-span-8 rounded-xl border border-white/10 bg-white/5 p-4 flex flex-col">
                          <div className="flex items-center justify-between">
                            <div className="text-sm font-semibold text-white">Деньги и динамика</div>
                            <div className="text-xs text-gray-400">Сегодня • Неделя • Месяц</div>
                          </div>
                            <div className="mt-4 flex-1 rounded-lg bg-gradient-to-b from-white/10 to-transparent border border-white/10 relative overflow-hidden">
                              <div className="absolute inset-0 opacity-60 [background-image:linear-gradient(to_right,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:36px_36px]" />
                              <div className="absolute left-0 right-0 bottom-0 h-2/3 bg-gradient-to-t from-blue-500/25 via-purple-500/10 to-transparent" />
                              <div className="absolute left-6 bottom-6 text-xs text-gray-300 flex items-center gap-2">
                                <BarChart3 className="w-4 h-4 text-blue-300" />
                                Прибыль • Движение денег • Тренды
                              </div>
                            </div>
                          </div>

                        <div className="col-span-12 lg:col-span-4 rounded-xl border border-white/10 bg-white/5 p-4">
                          <div className="text-sm font-semibold text-white">Смена сейчас</div>
                          <div className="mt-4 space-y-3">
                            <PreviewStat label="Открыта" value="10:02" icon={<Clock className="w-4 h-4 text-sky-300" />} />
                            <PreviewStat label="Продажи" value="27" icon={<Sparkles className="w-4 h-4 text-purple-300" />} />
                            <PreviewStat label="Остаток кассы" value="62 300₽" icon={<DollarSign className="w-4 h-4 text-green-400" />} />
                            <div className="pt-2 border-t border-white/10">
                              <div className="text-xs text-gray-400">Последние операции</div>
                              <div className="mt-2 space-y-2 text-xs">
                                <PreviewTx label="Игровые часы" value="+3 600₽" tone="green" />
                                <PreviewTx label="Списания склада" value="-520₽" tone="red" />
                                <PreviewTx label="Бонус сотруднику" value="-400₽" tone="amber" />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="py-24 px-6 md:px-12 bg-black/50 border-y border-white/10">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Самый важный контроль для владельца</h2>
              <p className="text-gray-400 max-w-3xl mx-auto">
                Мы собрали в одной системе то, где чаще всего теряются деньги и нервы: смены, касса, зарплата, склад,
                техника и качество работы команды.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              <FeatureCard
                icon={<DollarSign className="w-6 h-6 text-green-400" />}
                title="Деньги и прибыль"
                description="Понимаете цифры за минуту: сколько заработали, сколько потратили и что осталось."
                highlights={[
                  "Доходы/расходы/прибыль по периоду",
                  "Категории и счета (видно остатки)",
                  "Регулярные платежи (аренда и т.п.)",
                  "Движение денег: что реально уходит и куда",
                ]}
              />
              <FeatureCard
                icon={<Clock className="w-6 h-6 text-sky-300" />}
                title="Смена под контролем"
                description="Каждая смена закрывается отчётом: выручка, расходы, комментарии и история правок."
                highlights={[
                  "Отчёт смены: наличные/карта/расходы",
                  "Настраиваемые поля отчёта + обязательные пункты",
                  "В деталях смены: чеклисты, склад, обслуживание",
                  "Импорт смен из Excel (если уже ведёте таблицы)",
                ]}
              />
              <FeatureCard
                icon={<Wallet className="w-6 h-6 text-blue-300" />}
                title="Зарплата без споров"
                description="Система считает по правилам: ставка, проценты и премии. Выплаты и история — прозрачны."
                highlights={[
                  "Схемы оплаты: ставка + проценты + премии",
                  "Выплаты, авансы, премии — с историей",
                  "Удержания (бар, штрафы) — прозрачно",
                  "Премии за выручку и качество (чеклисты/обслуживание)",
                ]}
              />
              <FeatureCard
                icon={<Package className="w-6 h-6 text-amber-300" />}
                title="Склад без потерь"
                description="Товары, поставки, списания и ревизии — всё в одном месте, без «потерялось по дороге»."
                highlights={[
                  "Товары, наценка, ценники",
                  "Поставки, перемещения, списания",
                  "Ревизии и расхождения — сразу видно",
                  "Продажи и аналитика: что продаётся лучше всего",
                ]}
              />
              <FeatureCard
                icon={<Monitor className="w-6 h-6 text-indigo-300" />}
                title="Техника без сюрпризов"
                description="Инвентаризация, поломки, чистка и обслуживание. Контроль работ и фотоотчётов."
                highlights={[
                  "Инвентаризация техники и игровых мест",
                  "Инциденты: поломки, ремонты, комментарии",
                  "План работ: чистка/обслуживание + задачи",
                  "Проверка фотоотчётов и верификация работ",
                ]}
              />
              <FeatureCard
                icon={<Users className="w-6 h-6 text-purple-300" />}
                title="Команда по правилам"
                description="Отдельный кабинет для сотрудников: график, задачи, продажи и проверки. Вы видите статус и качество."
                highlights={[
                  "График работы на месяц + копирование",
                  "Запросы сотрудников: чат, статусы, фото",
                  "Чеклисты и проверки качества с фото и оценкой",
                  "База знаний: инструкции и стандарты",
                ]}
              />
            </div>

            <div className="mt-14 rounded-2xl border border-white/10 bg-white/5 p-6 md:p-8">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                <div>
                  <div className="text-lg font-semibold">Хотите посмотреть вживую?</div>
                  <p className="mt-1 text-sm text-gray-400">
                    Зарегистрируйтесь по телефону и начните с пробного доступа — настройка занимает считанные минуты.
                  </p>
                  <div className="mt-4 grid gap-2 text-xs text-gray-400">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                      Несколько клубов в одном аккаунте
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                      Роли и права доступа: каждый видит своё
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                      Отдельная рабочая область для сотрудников
                    </div>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button asChild className="bg-white text-black hover:bg-gray-200 font-semibold rounded-full px-6">
                    <Link href="/login">Попробовать бесплатно</Link>
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    className="border-white/10 bg-white/5 hover:bg-white/10 rounded-full text-white"
                  >
                    <Link href="#pricing">Смотреть тарифы</Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="py-24 px-6 md:px-12">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 items-start">
              <div>
                <h2 className="text-3xl md:text-4xl font-bold">Как это работает</h2>
                <p className="mt-4 text-gray-400 leading-relaxed">
                  В клубе всё держится на смене. DashAdmin делает смену «точкой правды»: деньги, продажи, склад,
                  обслуживание и качество — фиксируются сразу и остаются в истории.
                </p>

                <div className="mt-8 space-y-4">
                  <Step
                    number="01"
                    icon={<Smartphone className="w-5 h-5 text-blue-300" />}
                    title="Вход по номеру телефона"
                    description="Быстрая регистрация и роли: владелец, управляющий, сотрудник."
                  />
                  <Step
                    number="02"
                    icon={<Building2 className="w-5 h-5 text-purple-300" />}
                    title="Создайте клуб и добавьте команду"
                    description="Клубы, сотрудники и доступы — настраивается за пару минут."
                  />
                  <Step
                    number="03"
                    icon={<Clock className="w-5 h-5 text-sky-300" />}
                    title="Смена закрывается отчётом"
                    description="Наличка/карта/расходы + ваши поля. В деталях видно чеклисты, склад и обслуживание."
                  />
                  <Step
                    number="04"
                    icon={<BarChart3 className="w-5 h-5 text-emerald-300" />}
                    title="Видно, где теряются деньги"
                    description="Финансы, зарплаты, склад, техника и качество — без догадок, на цифрах и фактах."
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 md:p-8">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Sparkles className="w-4 h-4 text-purple-300" />
                  Для кого это
                </div>

                <div className="mt-6 grid gap-4">
                  <RoleCard
                    title="Владелец"
                    icon={<ShieldCheck className="w-5 h-5 text-emerald-300" />}
                    points={[
                      "Вижу прибыль и расходы по периодам",
                      "Смена закрылась — деньги сходятся",
                      "Склад, списания и ревизии под контролем",
                      "Зарплаты и выплаты без сюрпризов",
                    ]}
                  />
                  <RoleCard
                    title="Управляющий / Админ"
                    icon={<Users className="w-5 h-5 text-blue-300" />}
                    points={[
                      "Смены, график, персонал и задачи",
                      "Склад, техника, обслуживание и инциденты",
                      "Проверки, чеклисты и фотоотчёты",
                    ]}
                  />
                  <RoleCard
                    title="Сотрудник"
                    icon={<Wrench className="w-5 h-5 text-amber-300" />}
                    points={[
                      "Рабочий кабинет: продажи, задачи, проверки",
                      "График смен и история",
                      "Понимаю расчёт зарплаты и премий",
                    ]}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="py-24 px-6 md:px-12 bg-black/50 border-y border-white/10">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Тарифы под ваш масштаб</h2>
              <p className="text-gray-400">Сейчас доступно: 14 дней бесплатно. Остальные тарифы — в разработке.</p>
            </div>

            <div className="grid lg:grid-cols-4 gap-6 items-stretch">
              <PricingCard
                name="Бесплатно"
                badge="14 дней"
                price="0₽"
                period="доступ"
                description="Попробуйте DashAdmin на своём клубе."
                features={[
                  "Все ключевые разделы: деньги, смены, зарплата, склад, техника",
                  "Кабинет владельца и рабочая область для сотрудников",
                  "Проверки, чеклисты и отчёты по сменам",
                ]}
                cta="Начать бесплатно"
              />
              <PricingCard
                name="Стартовый"
                badge="В разработке"
                price="—"
                period=""
                description="Скоро. Пока можно начать с 14 дней бесплатно."
                features={[
                  "Тариф в разработке",
                  "Сейчас доступно: 14 дней бесплатно",
                ]}
                cta="В разработке"
                disabled
              />
              <PricingCard
                name="Про"
                badge="В разработке"
                price="—"
                period=""
                description="Скоро. Пока можно начать с 14 дней бесплатно."
                features={[
                  "Тариф в разработке",
                  "Сейчас доступно: 14 дней бесплатно",
                ]}
                cta="В разработке"
                disabled
              />
              <PricingCard
                name="Энтерпрайз"
                badge="В разработке"
                price="—"
                period=""
                description="Скоро. Пока можно начать с 14 дней бесплатно."
                features={[
                  "Тариф в разработке",
                  "Сейчас доступно: 14 дней бесплатно",
                ]}
                cta="В разработке"
                disabled
              />
            </div>

            <div className="mt-10 text-center text-sm text-gray-500">
              Сейчас доступен один тариф: 14 дней бесплатно. Платные тарифы готовим — обновим страницу.
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="py-24 px-6 md:px-12">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Частые вопросы</h2>
              <p className="text-gray-400">Коротко — о самом важном перед стартом.</p>
            </div>

            <div className="space-y-3">
              <FaqItem
                question="Можно настроить отчёт смены под наш клуб?"
                answer="Да: вы настраиваете поля отчёта и обязательные пункты — сотрудник сдаёт смену в нужном формате."
              />
              <FaqItem
                question="Это подходит только для одного клуба или для сети?"
                answer="Подходит для одного клуба и для сети: в DashAdmin есть мультиклубность и роли доступа."
              />
              <FaqItem
                question="Сможем ли мы избежать перерасчётов зарплаты «задним числом»?"
                answer="Да: система фиксирует расчёт по правилам, которые действовали в момент смены — без переписывания истории."
              />
              <FaqItem
                question="Есть ли кабинет для сотрудников?"
                answer="Да: у сотрудников есть отдельная рабочая область (смены, задачи, проверки, продажи и т.д.)."
              />
              <FaqItem
                question="Можно проверять работы по чистке/обслуживанию по фото?"
                answer="Да: сотрудники прикладывают фотоотчёт, а вы можете проверять и подтверждать выполненные работы."
              />
              <FaqItem
                question="Как быстро можно начать?"
                answer="Регистрация по телефону, создание клуба и базовая настройка занимают несколько минут."
              />
            </div>
          </div>
        </section>

        {/* About */}
        <section id="about" className="py-24 px-6 md:px-12 bg-black/50 border-t border-white/10">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-10 items-start">
              <div>
                <h2 className="text-3xl md:text-4xl font-bold mb-4">О продукте</h2>
                <p className="text-gray-400 leading-relaxed">
                  DashAdmin — административная панель для управления клубами, сотрудниками, сменами и финансами.
                  Мы делаем так, чтобы владелец видел прибыльность, управляющий — процессы, а сотрудник — понятные задачи
                  и мотивацию.
                </p>
                <div className="mt-8 grid sm:grid-cols-2 gap-4">
                  <MiniHighlight
                    icon={<ShieldCheck className="w-5 h-5 text-emerald-300" />}
                    title="Доступы"
                    text="Роли и права: каждый видит своё."
                  />
                  <MiniHighlight
                    icon={<Smartphone className="w-5 h-5 text-blue-300" />}
                    title="Простой вход"
                    text="Авторизация по телефону и быстрый старт."
                  />
                  <MiniHighlight
                    icon={<BarChart3 className="w-5 h-5 text-purple-300" />}
                    title="Отчёты"
                    text="Периоды, динамика и итоги."
                  />
                  <MiniHighlight
                    icon={<CheckCircle2 className="w-5 h-5 text-amber-300" />}
                    title="Контроль качества"
                    text="Чеклисты, проверки и прозрачные результаты."
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 md:p-8">
                <div className="text-lg font-semibold">Готовы навести порядок?</div>
                <p className="mt-2 text-sm text-gray-400">
                  Начните с пробного доступа. После регистрации вы сможете создать клуб и постепенно включать модули.
                </p>
                <div className="mt-6 flex flex-col sm:flex-row gap-3">
                  <Button asChild className="bg-white text-black hover:bg-gray-200 font-semibold rounded-full px-6">
                    <Link href="/login">Попробовать бесплатно</Link>
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    className="border-white/10 bg-white/5 hover:bg-white/10 rounded-full text-white"
                  >
                    <Link href="#features">Посмотреть функции</Link>
                  </Button>
                </div>

                <div className="mt-8 rounded-xl border border-white/10 bg-black/40 p-4 text-sm text-gray-300">
                  <div className="flex items-center gap-2 font-medium text-white">
                    <Zap className="w-4 h-4 text-purple-300" />
                    Быстрый старт
                  </div>
                  <div className="mt-2 grid gap-2 text-xs text-gray-400">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                      Вход по номеру телефона
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                      Создание клуба и сотрудников
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                      Смена, касса, отчёты — в одном месте
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

      </main>

      <footer className="border-t border-white/10 px-6 py-8 text-sm text-gray-600">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 text-center md:flex-row md:text-left">
          <div>&copy; {new Date().getFullYear()} DashAdmin. Все права защищены.</div>
          <div className="flex items-center gap-4">
            <Link href="/support" className="transition-colors hover:text-white">
              Поддержка
            </Link>
            <Link href="/privacy" className="transition-colors hover:text-white">
              Политика конфиденциальности
            </Link>
            <Link href="/terms" className="transition-colors hover:text-white">
              Пользовательское соглашение
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({
  icon,
  title,
  description,
  highlights,
}: {
  icon: React.ReactNode
  title: string
  description: string
  highlights?: string[]
}) {
  return (
    <div className="p-6 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 hover:bg-white/10 transition-all group">
      <div className="mb-4 p-3 bg-white/5 rounded-xl inline-flex group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <h3 className="text-xl font-semibold mb-2 text-white">{title}</h3>
      <p className="text-gray-400 leading-relaxed">{description}</p>
      {highlights?.length ? (
        <ul className="mt-4 space-y-2 text-sm text-gray-300">
          {highlights.map((item) => (
            <li key={item} className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 mt-0.5 text-emerald-300 shrink-0" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function Pill({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-gray-300">
      {icon}
      <span className="font-medium">{children}</span>
    </div>
  )
}

function PreviewNavItem({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2">
      <span className="text-gray-300">{icon}</span>
      <span>{label}</span>
    </div>
  )
}

function PreviewMetric({
  title,
  value,
  trend,
  tone,
}: {
  title: string
  value: string
  trend: string
  tone: "green" | "amber" | "blue"
}) {
  const toneClass =
    tone === "green"
      ? "from-green-500/20 via-green-500/10 to-transparent"
      : tone === "amber"
        ? "from-amber-500/20 via-amber-500/10 to-transparent"
        : "from-blue-500/20 via-blue-500/10 to-transparent"

  const trendClass =
    tone === "green" ? "text-green-300" : tone === "amber" ? "text-amber-300" : "text-blue-300"

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 relative overflow-hidden">
      <div className={`absolute inset-0 bg-gradient-to-b ${toneClass}`} />
      <div className="relative">
        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-400">{title}</div>
          <div className={`text-xs font-medium ${trendClass}`}>{trend}</div>
        </div>
        <div className="mt-2 text-lg sm:text-xl font-semibold text-white">{value}</div>
      </div>
    </div>
  )
}

function PreviewStat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-white/10 bg-black/30 px-3 py-2">
      <div className="flex items-center gap-2 text-xs text-gray-400">
        <span className="text-gray-300">{icon}</span>
        {label}
      </div>
      <div className="text-xs font-semibold text-white">{value}</div>
    </div>
  )
}

function PreviewTx({ label, value, tone }: { label: string; value: string; tone: "green" | "red" | "amber" }) {
  const toneClass =
    tone === "green" ? "text-green-300" : tone === "red" ? "text-red-300" : "text-amber-300"
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-white/10 bg-black/30 px-3 py-2">
      <div className="text-gray-400">{label}</div>
      <div className={`font-medium ${toneClass}`}>{value}</div>
    </div>
  )
}

function Step({
  number,
  icon,
  title,
  description,
}: {
  number: string
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-start gap-4">
        <div className="shrink-0 w-12 h-12 rounded-xl border border-white/10 bg-black/30 flex items-center justify-center">
          {icon}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="text-xs font-bold tracking-widest text-gray-500">{number}</div>
            <div className="text-sm font-semibold text-white">{title}</div>
          </div>
          <p className="mt-2 text-sm text-gray-400 leading-relaxed">{description}</p>
        </div>
      </div>
    </div>
  )
}

function RoleCard({ title, icon, points }: { title: string; icon: React.ReactNode; points: string[] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center">
          {icon}
        </div>
        <div className="font-semibold text-white">{title}</div>
      </div>
      <ul className="mt-4 space-y-2 text-sm text-gray-300">
        {points.map((p) => (
          <li key={p} className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 mt-0.5 text-emerald-300 shrink-0" />
            <span>{p}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function PricingCard({
  name,
  description,
  price,
  period,
  features,
  cta,
  badge,
  highlighted,
  disabled,
}: {
  name: string
  description: string
  price: string
  period: string
  features: string[]
  cta: string
  badge?: string
  highlighted?: boolean
  disabled?: boolean
}) {
  return (
    <div
      className={[
        "relative rounded-2xl border p-6 transition-all h-full",
        disabled
          ? "border-white/10 bg-white/5 opacity-70"
          : highlighted
          ? "border-blue-500/50 bg-gradient-to-b from-blue-600/15 to-white/5 shadow-[0_0_60px_-25px_rgba(37,99,235,0.65)]"
          : "border-white/10 bg-white/5 hover:bg-white/10",
      ].join(" ")}
    >
      {badge ? (
        <div className="absolute -top-3 left-6">
          <span
            className={[
              "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold border",
              highlighted ? "bg-blue-600 text-white border-blue-500/50" : "bg-black/60 text-gray-200 border-white/10",
            ].join(" ")}
          >
            {badge}
          </span>
        </div>
      ) : null}

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-lg font-semibold text-white">{name}</div>
          <div className="mt-1 text-sm text-gray-400">{description}</div>
        </div>
      </div>

      <div className="mt-6 flex items-end gap-2">
        <div className="text-4xl font-bold text-white">{price}</div>
        <div className="text-sm text-gray-400 mb-1">{period}</div>
      </div>

      {features.length ? (
        <ul className="mt-6 space-y-3 text-sm text-gray-300">
          {features.map((f) => (
            <li key={f} className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 mt-0.5 text-emerald-300 shrink-0" />
              <span>{f}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-8">
        {disabled ? (
          <Button
            disabled
            className="w-full rounded-full font-semibold bg-white/10 text-white/60 hover:bg-white/10"
          >
            {cta}
          </Button>
        ) : (
          <Button
            asChild
            className={[
              "w-full rounded-full font-semibold",
              highlighted ? "bg-white text-black hover:bg-gray-200" : "bg-white/10 text-white hover:bg-white/15",
            ].join(" ")}
          >
            <Link href="/login">{cta}</Link>
          </Button>
        )}
      </div>
    </div>
  )
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  return (
    <details className="group rounded-2xl border border-white/10 bg-white/5 px-6 py-4 open:bg-white/10 transition-all">
      <summary className="cursor-pointer list-none flex items-center justify-between gap-4">
        <span className="text-sm font-semibold text-white">{question}</span>
        <span className="shrink-0 text-gray-400 group-open:text-gray-200 transition-colors">+</span>
      </summary>
      <p className="mt-3 text-sm text-gray-400 leading-relaxed">{answer}</p>
    </details>
  )
}

function MiniHighlight({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode
  title: string
  text: string
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl border border-white/10 bg-black/30 flex items-center justify-center">
          {icon}
        </div>
        <div className="font-semibold text-white">{title}</div>
      </div>
      <p className="mt-3 text-sm text-gray-400">{text}</p>
    </div>
  )
}
