"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Zap, ArrowRight } from "lucide-react"

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-black text-white selection:bg-purple-500/30 font-sans">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-12 py-6 mix-blend-difference">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-white fill-current" />
          <span className="font-bold tracking-tight text-lg">DashAdmin</span>
        </div>
        <div className="flex items-center gap-6 text-sm font-medium">
          <Link href="/login" className="hover:text-white/70 transition-colors hidden sm:block">Войти</Link>
          <Button asChild className="bg-white text-black hover:bg-gray-200 rounded-full px-6 font-semibold">
            <Link href="/login">Начать</Link>
          </Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative min-h-[100svh] flex flex-col justify-end pb-16 md:pb-24 px-6 md:px-12 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 2, ease: "easeOut" }}
            className="absolute top-1/4 right-1/4 w-[60vw] h-[60vw] bg-purple-600/20 rounded-full blur-[120px] pointer-events-none" 
          />
        </div>
        
        <div className="relative z-10 max-w-5xl">
          <motion.h1 
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="text-6xl md:text-8xl lg:text-[10rem] font-bold tracking-tighter leading-[0.9] mb-8"
          >
            Порядок <br/>
            <span className="text-white/40">в клубе.</span>
          </motion.h1>
          
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-t border-white/20 pt-8"
          >
            <p className="text-xl md:text-2xl text-gray-400 max-w-xl leading-snug">
              Смена закрывается без расхождений. Техника обслуживается по графику. Качество контролируется чеклистами с фото, а все регламенты собраны в единой базе знаний.
            </p>
            <Button asChild size="lg" className="h-14 px-8 rounded-full bg-white text-black hover:bg-gray-200 text-lg font-medium group shrink-0">
              <Link href="/login">
                Попробовать бесплатно
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Feature List (No Cards) */}
      <section className="py-24 md:py-40 px-6 md:px-12 bg-black">
        <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-16 lg:gap-32">
          <div className="lg:w-1/3">
            <div className="sticky top-32">
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6">Всё в одной<br/>системе</h2>
              <p className="text-gray-400 text-lg lg:text-xl leading-relaxed">
                Мы собрали то, где чаще всего теряются деньги и нервы. Больше никаких разрозненных таблиц и потерянных инструкций в чатах.
              </p>
            </div>
          </div>
          
          <div className="lg:w-2/3 flex flex-col">
            <FeatureRow 
              num="01" 
              title="Оборудование и инциденты" 
              desc="Техника жестко привязана к рабочим местам и зонам. Плановое обслуживание, ремонты, история поломок и контроль просрочки — в едином реестре." 
            />
            <FeatureRow 
              num="02" 
              title="Чеклисты и контроль качества" 
              desc="Шаблоны проверок для аудита зала и приемки смен. Блокировка старта смены без чеклиста, обязательные фото-доказательства и оценка в баллах для KPI." 
            />
            <FeatureRow 
              num="03" 
              title="Встроенная база знаний" 
              desc="Регламенты и инструкции всегда под рукой. Сотрудники быстро ищут ответы прямо в рабочем интерфейсе с телефона, а не дергают управляющего." 
            />
            <FeatureRow 
              num="04" 
              title="Деньги и смены" 
              desc="Каждая смена закрывается строгим отчётом. Вы сразу видите выручку, расходы, остатки на счетах и историю правок." 
            />
            <FeatureRow 
              num="05" 
              title="Зарплаты и склад" 
              desc="Система сама считает ставку, проценты и премии. Поставки, списания и инвентаризация товаров без сюрпризов и потерь." 
              last
            />
          </div>
        </div>
      </section>

      {/* Roles (List, not cards) */}
      <section className="py-24 md:py-40 px-6 md:px-12 border-t border-white/10">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-20 md:mb-32">Для кого это</h2>
          
          <div className="grid md:grid-cols-3 gap-16 md:gap-12">
            <RoleColumn 
              title="Владелец"
              points={[
                "Вижу прибыль и расходы",
                "Смена закрылась — деньги сходятся",
                "Состояние техники под контролем",
                "Зарплаты без сюрпризов"
              ]}
            />
            <RoleColumn 
              title="Управляющий"
              points={[
                "Аудит зала по строгим чеклистам",
                "Плановое обслуживание оборудования",
                "Актуализация базы знаний",
                "Управление сменами и складом"
              ]}
            />
            <RoleColumn 
              title="Сотрудник"
              points={[
                "Приемка смены по шаблону с фото",
                "Инструкции и база знаний под рукой",
                "Понятный расчёт зарплаты",
                "Свои задачи по обслуживанию"
              ]}
            />
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-32 md:py-56 px-6 md:px-12 bg-black flex flex-col items-center justify-center text-center border-t border-white/10">
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8 }}
          className="max-w-4xl"
        >
          <h2 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight mb-8">Начните<br/>бесплатно.</h2>
          <p className="text-xl md:text-2xl text-gray-400 mb-12 max-w-2xl mx-auto leading-relaxed">
            14 дней полного доступа. Регистрация по телефону занимает считанные минуты.
          </p>
          <Button asChild size="lg" className="h-16 px-12 rounded-full bg-white text-black hover:bg-gray-200 text-xl font-medium">
            <Link href="/login">Создать клуб</Link>
          </Button>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-6 text-sm text-gray-500">
        <div>&copy; {new Date().getFullYear()} DashAdmin.</div>
        <div className="flex flex-wrap justify-center gap-6">
          <Link href="/support" className="hover:text-white transition-colors">Поддержка</Link>
          <Link href="/privacy" className="hover:text-white transition-colors">Конфиденциальность</Link>
          <Link href="/terms" className="hover:text-white transition-colors">Правила</Link>
        </div>
      </footer>
    </div>
  )
}

function FeatureRow({ num, title, desc, last = false }: { num: string, title: string, desc: string, last?: boolean }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.5 }}
      className={`py-10 md:py-16 border-t border-white/20 ${last ? 'border-b' : ''} flex flex-col md:flex-row gap-4 md:gap-12 group`}
    >
      <div className="text-sm font-mono text-white/30 pt-2 shrink-0">{num}</div>
      <div>
        <h3 className="text-2xl md:text-4xl font-semibold mb-4 md:mb-6 group-hover:text-purple-400 transition-colors tracking-tight">{title}</h3>
        <p className="text-gray-400 text-lg md:text-xl leading-relaxed max-w-xl">{desc}</p>
      </div>
    </motion.div>
  )
}

function RoleColumn({ title, points }: { title: string, points: string[] }) {
  return (
    <div className="flex flex-col border-t border-white/20 pt-8">
      <h3 className="text-2xl md:text-3xl font-semibold mb-8 tracking-tight">{title}</h3>
      <ul className="space-y-4 md:space-y-6 text-gray-400 text-lg md:text-xl">
        {points.map((p, i) => (
          <li key={i} className="flex items-start gap-4">
            <span className="text-white/20 mt-1">—</span>
            <span className="leading-snug">{p}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
