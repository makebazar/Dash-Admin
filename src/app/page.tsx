import Link from "next/link"
import { Button } from "@/components/ui/button"
import { CheckCircle2, DollarSign, Users, BarChart3, ShieldCheck, Zap } from "lucide-react"

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
          <Link href="#pricing" className="hover:text-white transition-colors">Цены</Link>
          <Link href="#about" className="hover:text-white transition-colors">О нас</Link>
        </nav>

        <div className="flex items-center gap-4">
          <Link href="/login" className="text-sm font-medium text-gray-400 hover:text-white transition-colors hidden sm:block">
            Войти
          </Link>
          <Link href="/login">
            <Button className="bg-white text-black hover:bg-gray-200 transition-all font-semibold rounded-full px-6">
              Начать
            </Button>
          </Link>
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
              Новое поколение управления клубом
            </div>

            <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-8 bg-gradient-to-b from-white to-gray-500 bg-clip-text text-transparent">
              Управляй клубом <br className="hidden md:block" /> как Профи.
            </h1>

            <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
              Единый бэк-офис для современных компьютерных клубов.
              Снапшоты зарплат, строгий контроль Cashflow и управление складом — без головной боли.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/login">
                <Button size="lg" className="h-14 px-8 text-base bg-blue-600 hover:bg-blue-500 rounded-full shadow-[0_0_40px_-10px_rgba(37,99,235,0.5)] transition-all transform hover:scale-105">
                  Попробовать бесплатно
                </Button>
              </Link>
              <Button variant="outline" size="lg" className="h-14 px-8 text-base border-white/10 bg-white/5 hover:bg-white/10 rounded-full text-white backdrop-blur-sm">
                Демонстрация
              </Button>
            </div>

            {/* Dashboard Preview Mockup */}
            <div className="mt-20 relative mx-auto max-w-5xl rounded-xl border border-white/10 bg-gray-900/50 backdrop-blur-sm p-2 shadow-2xl">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-50 blur-sm"></div>
              <div className="rounded-lg overflow-hidden bg-black aspect-video border border-white/5">
                <div className="flex h-full items-center justify-center text-gray-600">
                  {/* Placeholder for actual dashboard screenshot */}
                  <div className="text-center">
                    <BarChart3 className="w-16 h-16 mx-auto mb-4 opacity-20" />
                    <p className="text-sm">Предпросмотр Дашборда</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section id="features" className="py-24 px-6 md:px-12 bg-black/50">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Всё для масштабирования</h2>
              <p className="text-gray-400">Создано владельцами для владельцев.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              <FeatureCard
                icon={<DollarSign className="w-6 h-6 text-green-400" />}
                title="Строгий Cashflow"
                description="Автоматические отчеты P&L (ДДС). Отслеживайте каждый рубль, полученный и потраченный за смену."
              />
              <FeatureCard
                icon={<Users className="w-6 h-6 text-purple-400" />}
                title="Умная Зарплата"
                description="Снапшоты зарплат гарантируют, что исторические данные не изменятся при обновлении ставок сотрудников."
              />
              <FeatureCard
                icon={<ShieldCheck className="w-6 h-6 text-blue-400" />}
                title="Склад Lite"
                description="Управляйте наценкой, печатайте ценники и отслеживайте движение товаров без лишних усилий."
              />
            </div>
          </div>
        </section>

      </main>

      <footer className="py-8 px-6 border-t border-white/10 text-center text-gray-600 text-sm">
        &copy; {new Date().getFullYear()} DashAdmin. Все права защищены.
      </footer>
    </div>
  )
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="p-6 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 hover:bg-white/10 transition-all group">
      <div className="mb-4 p-3 bg-white/5 rounded-xl inline-flex group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <h3 className="text-xl font-semibold mb-2 text-white">{title}</h3>
      <p className="text-gray-400 leading-relaxed">{description}</p>
    </div>
  )
}
