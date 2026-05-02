# n8n AI Agent для DashAdmin

Простая инструкция по созданию AI-агента в n8n, который отвечает на вопросы о выручке и сменах.

## Архитектура

```
Пользователь → Max → n8n Webhook → OpenRouter (AI) → Reporting API → OpenRouter (AI) → Max → Пользователь
```

## Шаг 1: Создание Webhook в n8n

1. Создай новый workflow
2. Добавь ноду **Webhook** (Max integration)
   - Выбери триггер: **On message received direct**
   - Сохрани webhook URL

3. Настрой Max бота:
   - Укажи webhook URL в настройках Max
   - Добавь токен бота

## Шаг 2: Получение контекста пользователя

Добавь **HTTP Request** ноду:

```
Method: GET
URL: https://www.mydashadmin.ru/api/bot/context
Headers:
  - X-Messenger-Type: MAX
  - X-Messenger-User-Id: {{ $json.body.user.id }}
```

Сохрани `selected_club.id` в переменную workflow.

## Шаг 3: AI для анализа запроса

Добавь **OpenRouter** ноду (или HTTP Request к OpenRouter API):

```
Model: anthropic/claude-3-haiku 或 gpt-4o-mini
System Prompt:
Ты - помощник для владельцев клубов DashAdmin. 

Пользователь спрашивает: {{ $json.body.text }}

Определи тип запроса:
- Если про выручку/деньги → query = "revenue"
- Если про смены/часы/сотрудников → query = "shifts"

Определи период:
- "сегодня" → period = "today"
- "вчера" → period = "yesterday"
- "за неделю" → period = "last7days"
- "за месяц" → period = "last30days" или "this_month"

Верни ТОЛЬКО JSON без markdown:
{"query": "...", "period": "...", "clubId": "ID_КЛУБА"}
```

Сохрани JSON ответ для следующего шага.

## Шаг 4: Запрос к Reporting API

Добавь **HTTP Request** ноду:

```
Method: GET
URL: https://www.mydashadmin.ru/api/clubs/{{ clubId }}/reporting?query={{ query }}&period={{ period }}
```

## Шаг 5: AI для формирования ответа

Добавь ещё одну **OpenRouter** ноду:

```
System Prompt:
Пользователь спросил: "{{ $json.originalQuestion }}"

Данные из API: {{ $json.reportingData }}

Сформируй краткий и понятный ответ на русском языке.
Используй числа из данных. Пример: "Выручка за вчера: 45 000 ₽ (наличные: 20 000 ₽, карта: 25 000 ₽)"

Если данных нет - напиши "Нет данных за этот период".
```

## Шаг 6: Отправка ответа в Max

Добавь **HTTP Request** ноду (или Max ноду):

```
Method: POST
URL: https://platform-api.max.ru/v1/messages/send
Headers:
  - Authorization: <MAX_BOT_TOKEN>
Body:
{
  "chat_id": "{{ $json.body.chat.id }}",
  "text": "{{ $json.aiResponse }}"
}
```

## Альтернатива: Используй Code ноду

Если n8n поддерживает Code ноду, можно сделать всё в одном:

```javascript
// Code нода для анализа
const userMessage = $input.first().json.body.text;
const clubId = $input.first().json.selected_club?.id || "1"; // ID клуба по умолчанию

// Определяем тип запроса
let query = "revenue";
let period = "yesterday";

if (userMessage.includes("смен") || userMessage.includes("час")) {
  query = "shifts";
}

if (userMessage.includes("недел")) {
  period = "last7days";
} else if (userMessage.includes("месяц")) {
  period = "this_month";
} else if (userMessage.includes("сегодня")) {
  period = "today";
}

return {
  json: {
    query,
    period,
    clubId,
    userMessage
  }
};
```

## Тестовые запросы

Попробуй написать боту:
- "Какая выручка за вчера?"
- "Сколько смен за неделю?"
- "Покажи данные за месяц"
- "Какая выручка сегодня?"

## Troubleshooting

**Нет данных:**
- Проверь что clubId правильный
- Проверь что в базе есть смены за период

**Ошибка авторизации Max:**
- Проверь токен бота
- Проверь webhook URL

**AI не отвечает:**
- Проверь API ключ OpenRouter
- Проверь баланс на OpenRouter

## Быстрый тест без Max

Можно протестировать workflow через curl:

```bash
# Тест Reporting API
curl "https://www.mydashadmin.ru/api/clubs/1/reporting?query=revenue&period=yesterday"

# Тест Bot Context
curl -H "X-Messenger-Type: MAX" -H "X-Messenger-User-Id: test123" \
  "https://www.mydashadmin.ru/api/bot/context"
```
