-- ============================================================================
-- ИНТЕГРАЦИЯ ВИРТУАЛЬНОГО БАЛАНСА (payout_type)
-- ============================================================================
-- Этот файл описывает изменения, необходимые для поддержки разделения бонусов
-- на два типа выплат: REAL_MONEY (реальные деньги) и VIRTUAL_BALANCE (виртуальный баланс)
--
-- ЛОГИКА РАБОТЫ:
-- --------------
-- 1. REAL_MONEY:
--    - Бонусы включаются в calculated_salary (зарплату сотрудника)
--    - Отображаются в зарплатной ведомости (salaries/summary)
--    - Выплачиваются вместе с основной зарплатой
--    - Пример: стандартные бонусы за выручку, процент от продаж
--
-- 2. VIRTUAL_BALANCE:
--    - Бонусы НЕ включаются в calculated_salary
--    - Начисляются отдельно в employee_balances через employee_balance_transactions
--    - Отображаются в личном кабинете сотрудника
--    - Могут быть использованы для внутренних бонусов (например, бонусы на игры)
--    - Пример: бонус за чек-лист с payout_type='VIRTUAL_BALANCE'
--
-- ============================================================================
-- ИЗМЕНЕНИЯ В КОДЕ
-- ============================================================================

-- 1. salary-calculator.ts
--    - Добавлено разделение бонусов по payout_type
--    - breakdown.total теперь содержит ТОЛЬКО REAL_MONEY
--    - breakdown.virtual_balance_total содержит ТОЛЬКО VIRTUAL_BALANCE
--    - Все бонусы (checklist, maintenance_kpi, period, shift) поддерживают payout_type

-- 2. /api/employee/shifts/[shiftId]/route.ts
--    - calculated_salary берётся из breakdown.total (только REAL_MONEY)
--    - Виртуальные бонусы записываются в employee_balance_transactions
--    - employee_balances обновляется на сумму virtual_balance_total

-- 3. /api/clubs/[clubId]/salaries/summary/route.ts
--    - total_accrued содержит только REAL_MONEY (зарплата)
--    - virtual_balance_accrued содержит только VIRTUAL_BALANCE
--    - В ответе API добавлены поля:
--      * virtual_balance_accrued
--      * virtual_balance
--      * shifts[].virtual_balance_earned
--      * shifts[].real_money_bonuses
--      * shifts[].virtual_bonuses

-- 4. /api/employee/clubs/[clubId]/kpi/route.ts
--    - Возвращает kpi с бонусами, но НЕ разделяет по payout_type
--    - Требуется доработка для отображения разделения в UI

-- 5. Кабинет сотрудника (/employee/clubs/[clubId]/page.tsx)
--    - Добавлен компонент VirtualBalanceCard
--    - Загрузка баланса через /api/clubs/[clubId]/employee-balance
--    - Отображение текущего баланса и начислений за сегодня

-- ============================================================================
-- ТАБЛИЦЫ БАЗЫ ДАННЫХ
-- ============================================================================

-- club_virtual_balance_settings
-- - Настройки виртуального баланса для каждого клуба
-- - currency_type: RUB, HOURS, CREDITS
-- - enabled: включена ли система

-- employee_balances
-- - Хранит текущий баланс сотрудника в клубе
-- - balance: текущая сумма виртуального баланса

-- employee_balance_transactions
-- - payout_type: REAL_MONEY | VIRTUAL_BALANCE
-- - bonus_type: тип бонуса из salary scheme
-- - shift_id: связь со сменой

-- salary_schemes (JSONB formula)
-- - bonuses[].payout_type: REAL_MONEY | VIRTUAL_BALANCE
-- - period_bonuses[].payout_type: REAL_MONEY | VIRTUAL_BALANCE

-- ============================================================================
-- UI КОМПОНЕНТЫ
-- ============================================================================

-- 1. SalarySchemeForm.tsx
--    - Переключатель payout_type для каждого бонуса
--    - Визуальное разделение: "Деньги" vs "Баланс"

-- 2. VirtualBalanceCard.tsx
--    - Отображение текущего баланса
--    - Показ начислений за сегодня
--    - Поддержка разных валют (RUB, HOURS, CREDITS)

-- ============================================================================
-- ПРИМЕР НАСТРОЙКИ БОНУСА
-- ============================================================================

-- В Salary Scheme при создании бонуса:
-- {
--   "type": "checklist",
--   "name": "Бонус за чек-лист",
--   "amount": 500,
--   "payout_type": "VIRTUAL_BALANCE",  <-- Ключевое поле
--   "checklist_template_id": 1,
--   "min_score": 80
-- }

-- Результат:
-- - При выполнении чек-листа на score >= 80
-- - 500 будет начислено в employee_balances (НЕ в зарплату)
-- - Сотрудник увидит это в личном кабинете в разделе "Виртуальный баланс"

-- ============================================================================
-- НЕДОРАБОТКИ (TODO)
-- ============================================================================

-- 1. KPI API (/api/employee/clubs/[clubId]/kpi/route.ts)
--    - Не возвращает разделение по payout_type
--    - Нужно добавить kpi[].real_money_bonus и kpi[].virtual_balance_bonus

-- 2. История начислений (/api/employee/clubs/[clubId]/history/route.ts)
--    - Не показывает тип выплаты для бонусов
--    - Нужно добавить payout_type в ответ

-- 3. Выплата виртуального баланса
--    - Нет API для вывода/конвертации виртуального баланса
--    - Нужно добавить endpoint для трансфера

-- ============================================================================
