# Документация по интеграции SmartShell API в DashAdmin

Документ описывает структуру, проверенный API-эндпоинт, авторизацию и примеры интеграции системы **SmartShell API** в управляющую платформу **DashAdmin**.

---

## 1. Обзор SmartShell API

**SmartShell** — это ERP-система для автоматизации и управления компьютерными клубами, кибер-аренами и интернет-кафе.

### Проверенные характеристики API:
- **Протокол:** HTTP POST
- **Формат данных:** GraphQL (`query` и `mutation`)
- **Формат ответа:** JSON (`{ "data": { ... }, "errors": [ ... ] }`)
- **Рабочий Production URL:** `https://billing.smartshell.gg/api/graphql`
- **Заголовки запроса (Headers):**
  - `Content-Type: application/json`
  - `User-Agent: Mozilla/5.0`
  - `Authorization: Bearer <access_token>`
  - `Company-Id: <company_id>` *(передаётся для запросов в контексте конкретного клуба)*

---

## 2. Авторизация и Токены

В SmartShell API существует два вида авторизации:
1. **Персонал / Администрация (`LoginInput`):** требует `login`, `password` и `company_id`.
2. **Клиенты / Игроки (`ClientLoginInput`):** требует `login` и `password`.

### Авторизация персонала (Mutation `login`)

**Запрос:**
```graphql
mutation login($input: LoginInput!) {
  login(input: $input) {
    access_token
    token_type
    refresh_token
    expires_in
  }
}
```

**Variables:**
```json
{
  "input": {
    "login": "79963058814",
    "password": "your_password",
    "company_id": 10436
  }
}
```

**Ответ API:**
```json
{
  "data": {
    "login": {
      "access_token": "eyJhbGciOiJSUzI1NiIs...",
      "token_type": "Bearer",
      "refresh_token": "N2zmFzylOW...",
      "expires_in": 86400
    }
  }
}
```

---

## 3. Проверенные вызовы GraphQL

### 3.1. Получение списка клубов учетной записи (`myClubs`)

**Query:**
```graphql
query GetClubs {
  myClubs {
    id
    city
    address
  }
  myLastVisitedClub {
    id
    city
    address
  }
}
```

### 3.2. Текущая смена, услуги и товары клуба (`activeWorkShift`, `services`, `goods`)

**Headers:**
- `Authorization: Bearer <access_token>`
- `Company-Id: 10436`

**Query:**
```graphql
query GetClubDetails {
  activeWorkShift {
    id
    created_at
  }
  services {
    id
    title
  }
  goods {
    id
    title
  }
}
```

**Реальный ответ API:**
```json
{
  "data": {
    "activeWorkShift": {
      "id": 2038660,
      "created_at": "2026-08-05 16:09:00"
    },
    "services": [
      { "id": 44344, "title": "Сканирование" },
      { "id": 44343, "title": "Печать А4" }
    ],
    "goods": [
      { "id": 575387, "title": "Вода минеральная" },
      { "id": 575388, "title": "Сникерс большой" }
    ]
  }
}
```

---

## 4. Клиент TypeScript для DashAdmin

Пример реализации GraphQL-клиента `SmartShellClient` для Next.js (`src/lib/smartshell/client.ts`):

```typescript
export interface SmartShellConfig {
  apiUrl?: string;
  login: string;
  password: string;
  companyId?: number;
}

export class SmartShellClient {
  private baseUrl: string;
  private config: SmartShellConfig;
  private accessToken: string | null = null;

  constructor(config: SmartShellConfig) {
    this.baseUrl = config.apiUrl || 'https://billing.smartshell.gg/api/graphql';
    this.config = config;
  }

  public async request<T = any>(query: string, variables: Record<string, any> = {}): Promise<T> {
    if (!this.accessToken && !query.includes('mutation login')) {
      await this.authenticate();
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'DashAdmin-Integration/1.0',
    };

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }
    if (this.config.companyId) {
      headers['Company-Id'] = String(this.config.companyId);
    }

    const res = await fetch(this.baseUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, variables }),
    });

    if (!res.ok) {
      throw new Error(`SmartShell HTTP Error: ${res.status} ${res.statusText}`);
    }

    const json = await res.json();
    if (json.errors && json.errors.length > 0) {
      throw new Error(`SmartShell GraphQL Error: ${json.errors[0].message}`);
    }

    return json.data;
  }

  private async authenticate(): Promise<void> {
    const loginMutation = `
      mutation login($input: LoginInput!) {
        login(input: $input) {
          access_token
          expires_in
          refresh_token
        }
      }
    `;

    const data = await this.request(loginMutation, {
      input: {
        login: this.config.login,
        password: this.config.password,
        company_id: this.config.companyId,
      },
    });

    this.accessToken = data.login.access_token;
  }

  public async getClubOverview() {
    const query = `
      query {
        activeWorkShift { id created_at }
        services { id title }
        goods { id title }
      }
    `;
    return this.request(query);
  }
}
```
