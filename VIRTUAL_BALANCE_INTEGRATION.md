# Интеграция виртуального баланса (payout_type)

## Что сделано

### 1. База данных ✅
- `migrations/add_employee_balance.sql` — базовые таблицы (`employee_balances`, `employee_balance_transactions`)
- `migrations/add_bonus_payout_type.sql` — поддержка разделения по типам выплат
  - Таблица `club_virtual_balance_settings` — настройки для каждого клуба
  - Поля в `employee_balance_transactions`: `payout_type`, `bonus_type`, `shift_id`
  - VIEW `employee_balance_summary` — сводка по балансам

### 2. Бэкенд ✅

#### `src/lib/salary-calculator.ts`
- Разделение бонусов по `payout_type`:
  - `breakdown.total` — только **REAL_MONEY** (зарплата)
  - `breakdown.virtual_balance_total` — только **VIRTUAL_BALANCE** (бонусные)
- Поддержка для всех типов бонусов:
  - ✅ `fixed`, `percent_revenue`, `tiered`, `progressive_percent`
  - ✅ `checklist`
  - ✅ `maintenance_kpi`
  - ✅ `period_bonuses` (KPI лестница)

#### `src/app/api/employee/shifts/[shiftId]/route.ts`
- `calculated_salary` берётся из `breakdown.total` (только REAL_MONEY)
- Виртуальные бонусы записываются в `employee_balance_transactions`
- `employee_balances` обновляется на сумму `breakdown.virtual_balance_total`

#### `src/app/api/clubs/[clubId]/salaries/summary/route.ts`
- `total_accrued` — только REAL_MONEY (зарплата)
- `virtual_balance_accrued` — только VIRTUAL_BALANCE (бонусные)
- В ответе API:
  - `virtual_balance_accrued`
  - `virtual_balance`
  - `shifts[].virtual_balance_earned`
  - `shifts[].real_money_bonuses`
  - `shifts[].virtual_bonuses`

#### `src/app/api/clubs/[clubId]/employee-balance/route.ts`
- GET: получение баланса и истории транзакций
- POST: создание транзакции (начисление/списание)

### 3. Фронтенд ✅

#### `src/components/employee/VirtualBalanceCard.tsx` (новый)
- Виджет отображения виртуального баланса
- Показывает:
  - Текущий баланс
  - Начислено за сегодня
  - Поддержка разных валют (RUB, HOURS, CREDITS)

#### `src/app/employee/clubs/[clubId]/page.tsx`
- Добавлен компонент `VirtualBalanceCard`
- Загрузка баланса через `/api/clubs/[clubId]/employee-balance`
- Отображение в личном кабинете сотрудника

#### `src/components/payroll/PayrollDashboard.tsx`
- Разделение в карточке сотрудника:
  - **Зарплата** (синий) — REAL_MONEY
  - **Бонусные** (фиолетовый) — VIRTUAL_BALANCE
- Детализация в составе зарплаты:
  - База (ставка)
  - KPI бонусы
  - 🎁 Бонусные (баланс) — если есть
  - Итого зарплата
  - 🎁 Итого бонусные — если есть
- Таблица смен:
  - Колонка "🎁 Бонусные" — виртуальные бонусы за смену
  - Колонка "З/П" — зарплата за смену (REAL_MONEY)

#### `src/components/salary/SalarySchemeForm.tsx`
- Переключатель `payout_type` для каждого бонуса:
  - 💰 Деньги (REAL_MONEY)
  - 🎁 Баланс (VIRTUAL_BALANCE)

## Логика работы

### REAL_MONEY (Зарплата)
```
Бонус → calculated_salary → shifts.calculated_salary → зарплатная ведомость → выплата
```

### VIRTUAL_BALANCE (Бонусные)
```
Бонус → employee_balance_transactions → employee_balances → кабинет сотрудника → использование
```

## Пример настройки бонуса

### В Salary Scheme:
```json
{
  "type": "checklist",
  "name": "Бонус за чек-лист",
  "amount": 500,
  "payout_type": "VIRTUAL_BALANCE",  // ← Ключевое поле
  "checklist_template_id": 1,
  "min_score": 80
}
```

### Результат:
- При выполнении чек-листа на `score >= 80`
- 500 ₽ начисляется в `employee_balances` (НЕ в зарплату)
- Сотрудник видит это в личном кабинете в разделе "Виртуальный баланс"

## Поддерживаемые типы бонусов с `payout_type`

| Тип бонуса | Поддержка | Пример использования |
|------------|-----------|---------------------|
| `fixed` | ✅ | Фиксированный бонус на баланс |
| `percent_revenue` | ✅ | Процент от выручки на баланс |
| `tiered` | ✅ | Уровни бонусов на баланс |
| `progressive_percent` | ✅ | Прогрессивный процент на баланс |
| `checklist` | ✅ | Бонус за чек-лист на баланс |
| `maintenance_kpi` | ✅ | KPI обслуживания на баланс |
| `period_bonuses` | ✅ | KPI лестница на баланс |
| `penalty` | ❌ | Всегда REAL_MONEY |

## API Endpoints

### GET `/api/clubs/[clubId]/employee-balance?employee_id={id}`
```json
{
  "balance": {
    "id": 1,
    "club_id": 1,
    "user_id": "uuid",
    "balance": 1500.00,
    "currency": "RUB"
  },
  "transactions": [
    {
      "id": 1,
      "amount": 500.00,
      "payout_type": "VIRTUAL_BALANCE",
      "bonus_type": "CHECKLIST_BONUS",
      "shift_id": 123,
      "created_at": "2025-03-02T10:00:00Z"
    }
  ]
}
```

### POST `/api/clubs/[clubId]/employee-balance`
```json
{
  "employee_id": "uuid",
  "amount": 500,
  "transaction_type": "BONUS",
  "payout_type": "VIRTUAL_BALANCE",
  "bonus_type": "CHECKLIST_BONUS",
  "shift_id": 123,
  "description": "Бонус за чек-лист"
}
```

## Миграции

Применить в порядке:
```bash
psql "$DATABASE_URL" -f migrations/add_employee_balance.sql
psql "$DATABASE_URL" -f migrations/add_bonus_payout_type.sql
```

## Статус

- ✅ Миграции применены
- ✅ Бэкенд интегрирован
- ✅ Фронтенд обновлён
- ✅ Зарплатная ведомость показывает разделение
- ✅ Кабинет сотрудника отображает баланс
- ⚠️ Нет API для вывода/конвертации виртуального баланса (TODO)
