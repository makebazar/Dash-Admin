# Руководство по настройке n8n AI Agent с DashAdmin Tools

## Обзор

Это руководство описывает как настроить AI Agent в n8n, который будет использовать Tools для запроса данных из DashAdmin.

## Архитектура

```
Пользователь → Max/Telegram → n8n (AI Agent) → DashAdmin API (/api/ai-tools/*)
```

## Настройка n8n Workflow

### 1. Trigger Node (Max/Telegram)

Используйте `n8n-nodes-max` для получения сообщений от пользователя.

**Триггеры:**
- `On message received direct` — основной триггер для сообщений
- `On button clicked` — для выбора клуба из списка
- `On bot started` — для приветственного сообщения

### 2. AI Agent Node

#### Configuration:

```json
{
  "model": "gpt-4",
  "systemPrompt": "Ты — AI ассистент для владельцев киберклубов. Ты можешь отвечать на вопросы о выручке, сменах и сотрудниках. Используй доступные инструменты для получения данных.",
  "tools": [...]
}
```

### 3. HTTP Request Nodes (Tools)

Для каждого Tool создайте HTTP Request node:

#### Tool: getRevenue
```json
{
  "name": "Get Revenue",
  "url": "https://www.mydashadmin.ru/api/ai-tools/revenue",
  "method": "GET",
  "headers": {
    "X-Messenger-Type": "{{ $json.messenger_type }}",
    "X-Messenger-User-Id": "{{ $json.messenger_user_id }}"
  },
  "queryParameters": {
    "period": "{{ $json.period || 'yesterday' }}"
  }
}
```

#### Tool: getShiftsSummary
```json
{
  "name": "Get Shifts Summary",
  "url": "https://www.mydashadmin.ru/api/ai-tools/shifts-summary",
  "method": "GET",
  "headers": {
    "X-Messenger-Type": "{{ $json.messenger_type }}",
    "X-Messenger-User-Id": "{{ $json.messenger_user_id }}"
  }
}
```

#### Tool: getEmployeesList
```json
{
  "name": "Get Employees",
  "url": "https://www.mydashadmin.ru/api/ai-tools/employees-list",
  "method": "GET",
  "headers": {
    "X-Messenger-Type": "{{ $json.messenger_type }}",
    "X-Messenger-User-Id": "{{ $json.messenger_user_id }}"
  }
}
```

#### Tool: getEmployeeHours
```json
{
  "name": "Get Employee Hours",
  "url": "https://www.mydashadmin.ru/api/ai-tools/employee-hours",
  "method": "GET",
  "headers": {
    "X-Messenger-Type": "{{ $json.messenger_type }}",
    "X-Messenger-User-Id": "{{ $json.messenger_user_id }}"
  },
  "queryParameters": {
    "employeeName": "{{ $json.employee_name }}",
    "period": "{{ $json.period || 'this_month' }}"
  }
}
```

#### Tool: selectClub
```json
{
  "name": "Select Club",
  "url": "https://www.mydashadmin.ru/api/ai-tools/select-club",
  "method": "POST",
  "headers": {
    "X-Messenger-Type": "{{ $json.messenger_type }}",
    "X-Messenger-User-Id": "{{ $json.messenger_user_id }}",
    "Content-Type": "application/json"
  },
  "bodyParameters": {
    "clubId": "{{ $json.club_id }}"
  }
}
```

## Примеры запросов

### "Какая выручка за вчера?"
```
AI Agent вызовет: GET /api/ai-tools/revenue?period=yesterday
Ответ: { revenue: { total: 12500, ... } }
```

### "Сколько часов отработал Иван?"
```
AI Agent вызовет: GET /api/ai-tools/employee-hours?employeeName=Иван&period=this_month
Ответ: { employees: [{ name: "Иван", total_hours: 120 }] }
```

### "Покажи статистику смен за неделю"
```
AI Agent вызовет: GET /api/ai-tools/shifts-summary?period=last7days
Ответ: { summary: { total_shifts: 45, total_hours: 360, ... } }
```

## Аутентификация

Все Tools требуют заголовки:
- `X-Messenger-Type`: MAX, TELEGRAM, или N8N
- `X-Messenger-User-Id`: Уникальный ID пользователя в мессенджере

Эти значения берутся из Trigger node и передаются в каждый HTTP Request.

## Пример Workflow (JSON)

```json
{
  "name": "DashAdmin AI Agent",
  "nodes": [
    {
      "type": "n8n-nodes-max.messageReceived",
      "typeVersion": 1,
      "name": "Max Trigger",
      "webhook": "max-webhook",
      "parameters": {}
    },
    {
      "type": "@n8n/n8n-nodes-langchain.agent",
      "parameters": {
        "model": "gpt-4",
        "systemPrompt": "Ты — AI ассистент...",
        "tools": {
          "values": [
            { "name": "getRevenue", "node": "Revenue Tool" },
            { "name": "getShiftsSummary", "node": "Shifts Tool" },
            { "name": "getEmployeesList", "node": "Employees Tool" },
            { "name": "getEmployeeHours", "node": "Employee Hours Tool" }
          ]
        }
      }
    },
    {
      "type": "httpRequest",
      "name": "Revenue Tool",
      "parameters": {
        "url": "https://www.mydashadmin.ru/api/ai-tools/revenue",
        "method": "GET",
        "authentication": "genericCredentialType",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            { "name": "X-Messenger-Type", "value": "{{ $json.messenger_type }}" },
            { "name": "X-Messenger-User-Id", "value": "{{ $json.messenger_user_id }}" }
          ]
        }
      }
    }
  ],
  "connections": {}
}
```

## Обработка ошибок

### Ошибка: "Bot account not linked"
Пользователь не привязал свой аккаунт DashAdmin к боту. Нужно:
1. Пользователь заходит в DashAdmin
2. Открывает настройки профиля
3. Находит раздел "Привязка бота"
4. Нажимает "Сгенерировать код"
5. Вводит 6-значный код в бота

### Ошибка: "No club selected"
У пользователя несколько клубов, но ни один не выбран. AI Agent должен:
1. Запросить `/api/ai-tools/select-club` (GET)
2. Показать пользователю список клубов с кнопками
3. После выбора вызвать `/api/ai-tools/select-club` (POST)

## Лимиты и ограничения

- Все запросы к AI Tools требуют привязанного аккаунта
- Пользователь видит только свои клубы (где он владелец или сотрудник)
- Периоды: today, yesterday, last7days, last30days, this_month
- Кастомные даты: YYYY-MM-DD формат