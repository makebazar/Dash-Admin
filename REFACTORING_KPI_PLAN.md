# План рефакторинга системы KPI в DashAdmin

Этот документ описывает пошаговый план перехода от старых, разрозненных карточек KPI к новой унифицированной системе `UnifiedKpiCard` и `PayrollManagerKpiCard`.

## Текущее состояние (Проблема)
- **Фрагментация:** Отрисовка KPI разбросана по разным компонентам (`KpiOverview`, `ChecklistKpiCard`, `MaintenanceKpiCard`, `PromoKpiCard`).
- **Сложность поддержки:** Добавление нового KPI требует ручной правки рендеринга и типов в нескольких местах (особенно в `PayrollDashboard`).
- **Разный визуал:** Карточки имеют разные отступы, сетки, иконки и логику раскрытия деталей.
- **Ошибки бизнес-логики:** "Текущая выручка смены" показывалась в реальном времени, хотя фактически начисляется только при закрытии смены, что путало сотрудников.

## Решение (Unified KPI System)
Созданы два основных UI-компонента и один умный адаптер:
1.  **`src/components/employee/kpi/UnifiedKpiCard.tsx`** — Универсальная карточка для кабинета сотрудника. Поддерживает динамическую сетку статов, прогресс-бары, алерты и раскрывающийся контент (`children`).
2.  **`src/components/employee/kpi/PayrollManagerKpiCard.tsx`** — Компактная карточка для вкладки "Зарплаты" управляющего. Сфокусирована на расчетах, планах и фактах.
3.  **`src/components/employee/kpi/KpiMapper.tsx`** — Адаптер (Mapper), который принимает "сырые" данные API и формирует пропсы для `UnifiedKpiCard`. Содержит "Smart Labels logic" (скрытие факта при открытой смене).
4.  **`src/components/employee/salary/SalarySummaryWidget.tsx`** — Новый темный сайдбар-виджет для отображения итоговой ориентировочной зарплаты за месяц. Группирует начисления (база, бонусы) и удержания.

---

## Пошаговый план внедрения (Execution Plan)

### Фаза 1: Подготовка (Завершено)
Все четыре новых файла (`UnifiedKpiCard.tsx`, `PayrollManagerKpiCard.tsx`, `KpiMapper.tsx`, `SalarySummaryWidget.tsx`) созданы и протестированы на странице `/debug/kpi`.

### Фаза 2: Рефакторинг Кабинета Сотрудника
**Файлы для изменения:** `src/app/employee/clubs/[clubId]/page.tsx`

1.  **Удаление старых импортов:**
    Убрать импорты `KpiOverview`, `ChecklistKpiCard`, `MaintenanceKpiCard`, `PromoKpiCard`.
2.  **Добавление новых импортов:**
    Добавить `UnifiedKpiCard`, `mapKpiToUnifiedProps` и `SalarySummaryWidget`.
3.  **Создание `kpiContext`:**
    Внутри компонента (перед `useMemo` блоками) создать контекст для маппера:
    ```tsx
    const kpiContext = {
      formatCurrency,
      activeShiftId: activeShift?.id || null,
      remainingShifts: kpiData?.remaining_shifts || 0,
      plannedShifts: kpiData?.planned_shifts || 0,
      daysRemaining: kpiData?.days_remaining || 0,
    };
    ```
4.  **Обновление карточек KPI (useMemo блоки):**
    Заменить маппинг массивов (`kpiData.kpi`, `kpiData.checklist`, `kpiData.promo`, `kpiData.maintenance`) на вызов нового компонента.
    *Пример для Выручки:*
    ```tsx
    <UnifiedKpiCard {...mapKpiToUnifiedProps("revenue", kpi, kpiContext)} />
    ```
5.  **Замена виджета "Зарплата за месяц":**
    Найти блок `<!-- Salary Estimate -->` (строки ~1938-2060).
    Удалить старую разметку, которая выводила список начислений сплошным текстом.
    Вставить новый компонент:
    ```tsx
    <SalarySummaryWidget stats={stats} formatCurrency={formatCurrency} />
    ```

### Фаза 3: Рефакторинг "Зарплат" (Вид Управляющего)
**Файл для изменения:** `src/components/payroll/PayrollDashboard.tsx`

1.  **Очистка `PayrollKpiTab`:**
    Найти компонент `PayrollKpiTab` (внутри файла) и удалить всю старую верстку карточек KPI, оставив только верхний блок "KPI за месяц" и бейдж плана.
2.  **Внедрение `PayrollManagerKpiCard`:**
    В цикле `monthlyKpis.map((k: any, idx: number) => { ... })` реализовать логику определения типа KPI и рендеринг `PayrollManagerKpiCard`.
3.  **Добавление математической детализации:**
    Внутрь карточек (как `children`) поместить разметку с детальными расчетами (База × Ставка = Бонус), скопировав логику из дебаг-страницы. Это критично для прозрачности выплат для владельца.

### Фаза 4: Garbage Collection (Очистка проекта)
1.  **Удаление старых компонентов:**
    - `src/components/employee/kpi/KpiOverview.tsx`
    - `src/components/employee/kpi/EarningsProjection.tsx` (если больше нигде не используется)
    - `src/components/employee/kpi/KpiLadder.tsx` (если больше нигде не используется)
    - `src/components/employee/kpi/TargetCoach.tsx` (если больше нигде не используется)
2.  **Удаление дебаг-кода:**
    - Удалить папку `src/app/debug/kpi/` и файл `page.tsx` внутри нее.

### Фаза 5: QA и Валидация
1.  Выполнить `npm run lint` для проверки отсутствия неиспользуемых переменных и сломанных импортов.
2.  Выполнить `tsc --noEmit` для проверки типов.
3.  Вручную проверить кабинет сотрудника во время открытой и закрытой смены.
4.  Вручную проверить вкладку "Зарплата" в настройках клуба.
