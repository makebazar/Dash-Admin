export interface SmartShellConfig {
  apiUrl?: string;
  apiKey?: string;
  login?: string;
  password?: string;
  companyId?: number | null;
  accessToken?: string;
  tokenExpiresAt?: number;
  onTokenRefresh?: (token: string, expiresAt: number) => Promise<void> | void;
}

const tokenCache: Map<string, { token: string; expiresAt: number }> =
  (globalThis as any).__smartshell_token_cache__ ||
  ((globalThis as any).__smartshell_token_cache__ = new Map());

function getSharedHttpsAgent(): any {
  if (typeof globalThis !== 'undefined') {
    if (!(globalThis as any).__smartshell_https_agent__) {
      try {
        const https = require('https');
        (globalThis as any).__smartshell_https_agent__ = new https.Agent({
          keepAlive: true,
          keepAliveMsecs: 15000,
          maxSockets: 20,
          family: 4, // Force IPv4
        });
      } catch {
        // browser environment
      }
    }
    return (globalThis as any).__smartshell_https_agent__;
  }
  return undefined;
}

export interface SmartShellUser {
  id: number;
  phone?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
}

export interface SmartShellActiveWorkShift {
  id: number;
  created_at: string;
  finished_at?: string | null;
  comment?: string | null;
  worker?: SmartShellUser | null;
  money?: {
    cash_on_start?: number;
    sum?: {
      cash: number;
      card: number;
      deposit: number;
      bonus: number;
      total: number;
    };
  } | null;
  payments?: {
    id: number;
    sum?: number;
    items?: {
      id: number;
      type: string;
      sum: number;
      amount: number;
    }[];
  }[] | null;
}

export interface ChangeGoodsQuantityItemInput {
  id: number;
  quantity: number;
}

export interface ChangeGoodsQuantityInput {
  items: ChangeGoodsQuantityItemInput[];
  operation: "SET" | "ADD" | "DISPOSAL" | "SOLD" | "CREATE";
  comment?: string;
  price?: number;
}

export interface SmartShellClub {
  id: number;
  city?: string;
  address?: string;
}

export class SmartShellClient {
  private baseUrl: string;
  private config: SmartShellConfig;

  constructor(config: SmartShellConfig) {
    this.baseUrl = config.apiUrl || 'https://billing.smartshell.gg/api/graphql';
    this.config = config;

    // Инициализируем глобальный кэш токеном из БД, если он ещё валиден
    if (config.companyId && config.login && config.accessToken && config.tokenExpiresAt) {
      const cacheKey = `${config.companyId}:${config.login}`;
      if (!tokenCache.has(cacheKey) && config.tokenExpiresAt > Date.now() + 60_000) {
        tokenCache.set(cacheKey, {
          token: config.accessToken,
          expiresAt: config.tokenExpiresAt,
        });
      }
    }
  }

  /**
   * Получение токена авторизации (авто-логин с кэшированием или API-ключ)
   */
  public async getAuthToken(): Promise<string> {
    if (this.config.login && this.config.password && this.config.companyId) {
      const cacheKey = `${this.config.companyId}:${this.config.login}`;
      const cached = tokenCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now() + 60_000) {
        return cached.token;
      }

      // Выполняем логин только если токен отсутствует или истёк (раз в 24 часа)
      const loginQuery = `
        mutation Login($input: LoginInput!) {
          login(input: $input) {
            access_token
            expires_in
          }
        }
      `;
      const loginVars = {
        input: {
          login: this.config.login,
          password: this.config.password,
          company_id: Number(this.config.companyId),
        },
      };

      const res = await this.rawRequest<{ login: { access_token: string; expires_in: number } }>(
        loginQuery,
        loginVars,
        null // без авторизации
      );

      const token = res.login?.access_token;
      if (!token) {
        throw new Error('SmartShell: Не удалось получить access_token при логине');
      }

      const expiresInSec = res.login.expires_in || 86400;
      const expiresAt = Date.now() + (expiresInSec - 300) * 1000;
      tokenCache.set(cacheKey, {
        token,
        expiresAt,
      });

      // Сохраняем свежий токен в БД через callback
      try {
        await this.config.onTokenRefresh?.(token, expiresAt);
      } catch (saveErr) {
        console.warn("[SmartShell] Failed to persist refreshed token in DB:", saveErr);
      }

      return token;
    }

    if (this.config.apiKey) {
      return this.config.apiKey;
    }

    throw new Error('SmartShell: не указаны учетные данные (логин/пароль или API-ключ)');
  }

  /**
   * Базовый HTTP запрос к GraphQL
   */
  private async rawRequest<T = any>(
    query: string,
    variables: Record<string, any> = {},
    token: string | null = null,
    retryCount = 0
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Origin': 'https://billing.smartshell.gg',
      'Referer': 'https://billing.smartshell.gg/',
      'Accept': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    if (this.config.companyId) {
      headers['Company-Id'] = String(this.config.companyId);
    }

    const postData = JSON.stringify({ query, variables });

    if (typeof window === 'undefined') {
      const https = await import('https');
      const url = new URL(this.baseUrl);
      const agent = getSharedHttpsAgent();

      let json: any;
      try {
        json = await new Promise((resolve, reject) => {
          const req = https.request(
            {
              hostname: url.hostname,
              path: url.pathname + url.search,
              method: 'POST',
              agent,
              servername: url.hostname,
              family: 4,
              headers: { ...headers, 'Content-Length': Buffer.byteLength(postData) },
              timeout: 15000,
            },
            (res) => {
              let data = '';
              res.on('data', (chunk) => (data += chunk));
              res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch (e) { reject(new Error(`SmartShell Invalid JSON: ${data}`)); }
              });
            }
          );
          req.on('error', (err) => reject(err));
          req.on('timeout', () => { req.destroy(); reject(new Error('SmartShell request timeout (15s)')); });
          req.write(postData);
          req.end();
        });
      } catch (netErr: any) {
        if (retryCount < 2) {
          console.warn(`[SmartShell] Network error (${netErr?.message}), retrying (${retryCount + 1}/2)...`);
          await new Promise((r) => setTimeout(r, 500));
          return this.rawRequest(query, variables, token, retryCount + 1);
        }
        throw netErr;
      }

      if (json.errors?.length > 0) {
        throw new Error(`SmartShell GraphQL Error: ${json.errors[0]?.message}`);
      }
      return json.data;
    } else {
      const res = await fetch(this.baseUrl, {
        method: 'POST',
        headers,
        body: postData,
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) throw new Error(`SmartShell HTTP Error: ${res.status} ${res.statusText}`);
      const json = await res.json();
      if (json.errors?.length > 0) {
        throw new Error(`SmartShell GraphQL Error: ${json.errors[0]?.message}`);
      }
      return json.data;
    }
  }

  /**
   * Выполнение авторизованного GraphQL запроса к SmartShell API
   */
  public async request<T = any>(
    query: string,
    variables: Record<string, any> = {}
  ): Promise<T> {
    const token = await this.getAuthToken();
    try {
      return await this.rawRequest<T>(query, variables, token);
    } catch (err: any) {
      // Если токен протух — сбрасываем кэш и пробуем один раз снова
      if (err?.message?.includes('401') || err?.message?.includes('not permitted') || err?.message?.includes('Unauthenticated')) {
        if (this.config.login && this.config.companyId) {
          tokenCache.delete(`${this.config.companyId}:${this.config.login}`);
          const newToken = await this.getAuthToken();
          return await this.rawRequest<T>(query, variables, newToken);
        }
      }
      throw err;
    }
  }

  /**
   * Запрос списка клубов аккаунта (`myClubs`)
   */
  public async getMyClubs(): Promise<SmartShellClub[]> {
    const query = `
      query GetClubs {
        myClubs {
          id
          city
          address
        }
      }
    `;
    const data = await this.request(query);
    return data.myClubs || [];
  }

  /**
   * Получение активной смены с деталями сотрудника, финансовыми показателями и чеками
   */
  public async getActiveWorkShift(): Promise<SmartShellActiveWorkShift | null> {
    const query = `
      query GetActiveShift {
        activeWorkShift {
          id
          created_at
          finished_at
          comment
          worker {
            id
            phone
            first_name
            last_name
            email
          }
          money {
            cash_on_start
            sum {
              cash
              card
              deposit
              bonus
              total
            }
          }
          payments {
            id
            created_at
            method
            sum
            cash_sum
            card_sum
            client {
              id
              phone
              login
              first_name
              last_name
            }
            items {
              id
              type
              sum
              amount
              entity {
                ... on Good {
                  id
                  title
                  cost
                  wholesale_cost
                }
                ... on Tariff {
                  id
                  title
                  duration
                }
                ... on Service {
                  id
                  title
                }
                ... on Combo {
                  id
                  title
                  price
                  items {
                    id
                    amount
                    price
                    entity_type
                    entity {
                      ... on Good {
                        id
                        title
                        cost
                        wholesale_cost
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;
    const data = await this.request(query);
    return data.activeWorkShift || null;
  }

  /**
   * Корректировка, списание или зачисление остатков товаров на складе SmartShell
   */
  public async changeGoodsQuantity(input: ChangeGoodsQuantityInput): Promise<boolean> {
    const mutation = `
      mutation ChangeGoodsQuantity($input: ChangeGoodsQuantityInput!) {
        changeGoodsQuantity(input: $input)
      }
    `;
    const data = await this.request(mutation, { input });
    return Boolean(data.changeGoodsQuantity);
  }

  /**
   * Установка точного количества товаров (вычисляет дельту относительно текущих остатков SmartShell и выполняет ADD / DISPOSAL)
   */
  public async setGoodsQuantity(
    items: { id: number; quantity: number }[],
    comment?: string
  ): Promise<boolean> {
    if (!items || items.length === 0) return true;

    // 1. Запрашиваем текущие остатки SmartShell
    const currentGoods = await this.getGoods();
    const goodsById = new Map<number, number>();
    for (const g of currentGoods) {
      goodsById.set(Number(g.id), Number(g.amount || 0));
    }

    const itemsToAdd: { id: number; quantity: number }[] = [];
    const itemsToDispose: { id: number; quantity: number }[] = [];

    for (const item of items) {
      const currentAmount = goodsById.get(Number(item.id)) ?? 0;
      const targetAmount = Math.max(0, Number(item.quantity || 0));
      const diff = targetAmount - currentAmount;

      if (diff > 0) {
        itemsToAdd.push({ id: Number(item.id), quantity: diff });
      } else if (diff < 0) {
        itemsToDispose.push({ id: Number(item.id), quantity: Math.abs(diff) });
      }
    }

    const BATCH_SIZE = 50;

    for (let i = 0; i < itemsToDispose.length; i += BATCH_SIZE) {
      const batch = itemsToDispose.slice(i, i + BATCH_SIZE);
      await this.changeGoodsQuantity({
        items: batch,
        operation: "DISPOSAL",
        comment: comment || "Списание излишков по ревизии в DashAdmin",
      });
    }

    for (let i = 0; i < itemsToAdd.length; i += BATCH_SIZE) {
      const batch = itemsToAdd.slice(i, i + BATCH_SIZE);
      await this.changeGoodsQuantity({
        items: batch,
        operation: "ADD",
        comment: comment || "Оприходование недостачи по ревизии в DashAdmin",
      });
    }

    return true;
  }

  /**
   * Создание нового товара на складе SmartShell
   */
  public async createGood(input: {
    title: string;
    cost: number;
    wholesale_cost?: number;
    amount?: number;
    category_id?: number;
    unit_name?: string;
    use_global_discounts?: boolean;
    eans?: string[];
  }): Promise<{ id: number; title: string; cost: number } | null> {
    const mutation = `
      mutation CreateGood($input: GoodInput!) {
        createGood(input: $input) {
          id
          title
          cost
        }
      }
    `;
    const payload = {
      ...input,
      use_global_discounts: input.use_global_discounts ?? true,
      wholesale_cost: input.wholesale_cost ?? 0,
      amount: input.amount ?? 0,
    };
    const data = await this.request(mutation, { input: payload });
    return data.createGood || null;
  }

  /**
   * Обновление существующего товара в SmartShell (цена, себестоимость, название)
   */
  public async updateGood(
    id: number,
    input: {
      title?: string;
      cost?: number;
      wholesale_cost?: number;
      category_id?: number;
      unit_name?: string;
      use_global_discounts?: boolean;
      eans?: string[];
    }
  ): Promise<{ id: number; title: string; cost: number } | null> {
    const mutation = `
      mutation UpdateGood($id: Int!, $input: GoodInput!) {
        updateGood(id: $id, input: $input) {
          id
          title
          cost
        }
      }
    `;
    try {
      const data = await this.request(mutation, { id: Number(id), input });
      return data.updateGood || null;
    } catch (err: any) {
      console.warn(`SmartShell updateGood failed for ID ${id}:`, err?.message || err);
      return null;
    }
  }

  /**
   * Запрос полного списка товаров и остатков из SmartShell
   */
  public async getGoods(): Promise<
    { id: number; title: string; amount?: number; cost?: number; wholesale_cost?: number; eans?: string[] }[]
  > {
    const query = `
      query GetGoods {
        goods {
          id
          title
          amount
          cost
          wholesale_cost
          eans
        }
      }
    `;
    const data = await this.request(query);
    return data?.goods || [];
  }

  /**
   * Запрос списка комбо-наборов из SmartShell
   */
  public async getCombos(): Promise<{
    id: number;
    title: string;
    quantity?: number;
    base_price?: number;
    price: number;
    tariff?: { id: number; title: string } | null;
    host_group?: { id: number; title: string } | null;
    items: {
      id: number;
      amount: number;
      price: number;
      entity_type: string;
      entity?: { id: number; title: string; cost?: number } | null;
    }[];
  }[]> {
    const query = `
      query GetCombos {
        combos {
          data {
            id
            title
            quantity
            base_price
            price
            tariff { id title }
            host_group { id title }
            items {
              id
              amount
              price
              entity_type
              entity {
                ... on Good {
                  id
                  title
                  cost
                }
                ... on Service {
                  id
                  title
                }
              }
            }
          }
        }
      }
    `;
    try {
      const data = await this.request(query);
      return data?.combos?.data || [];
    } catch (err: any) {
      console.warn("SmartShell getCombos error:", err?.message || err);
      return [];
    }
  }

  /**
   * Создание комбо-набора в SmartShell
   */
  public async createCombo(input: {
    title: string;
    host_group_id?: number;
    tariff_id?: number;
    use_global_discount?: boolean;
    items: {
      entity_type: "GOOD" | "SERVICE";
      entity_id: number;
      amount: number;
      price: number;
    }[];
  }): Promise<{ id: number; title: string; price: number } | null> {
    const mutation = `
      mutation CreateCombo($input: ComboInput!) {
        createCombo(input: $input) {
          id
          title
          price
        }
      }
    `;
    const data = await this.request(mutation, { input });
    return data?.createCombo || null;
  }

  /**
   * Обновление комбо-набора в SmartShell
   */
  public async updateCombo(
    id: number,
    input: {
      title: string;
      host_group_id?: number;
      tariff_id?: number;
      use_global_discount?: boolean;
      items: {
        entity_type: "GOOD" | "SERVICE";
        entity_id: number;
        amount: number;
        price: number;
      }[];
    }
  ): Promise<{ id: number; title: string; price: number } | null> {
    const mutation = `
      mutation UpdateCombo($id: Int!, $input: ComboInput!) {
        updateCombo(id: $id, input: $input) {
          id
          title
          price
        }
      }
    `;
    const data = await this.request(mutation, { id: Number(id), input });
    return data?.updateCombo || null;
  }

  /**
   * Удаление комбо-набора в SmartShell
   */
  public async deleteCombo(id: number): Promise<boolean> {
    const mutation = `
      mutation DeleteCombo($id: Int!) {
        deleteCombo(id: $id)
      }
    `;
    try {
      const data = await this.request(mutation, { id: Number(id) });
      return Boolean(data?.deleteCombo);
    } catch (err: any) {
      console.warn(`SmartShell deleteCombo failed for ID ${id}:`, err?.message || err);
      return false;
    }
  }

  /**
   * Получение ID товара в SmartShell по штрихкоду или названию
   */
  public async resolveGoodId(product: {
    name: string;
    barcode?: string | null;
  }): Promise<number | null> {
    if (!product.name && !product.barcode) return null;

    try {
      const goods = await this.getGoods();
      // 1. Match by EAN / Barcode
      if (product.barcode) {
        const barcodeClean = product.barcode.trim();
        const eanMatch = goods.find((g: any) =>
          Array.isArray(g.eans) && g.eans.some((e: string) => String(e).trim() === barcodeClean)
        );
        if (eanMatch) return Number(eanMatch.id);

        const idMatch = goods.find((g: any) => String(g.id) === barcodeClean);
        if (idMatch) return Number(idMatch.id);
      }

      // 2. Match by Title
      if (product.name) {
        const titleClean = product.name.trim().toLowerCase();
        const titleMatch = goods.find(
          (g: any) => g.title?.trim().toLowerCase() === titleClean
        );
        if (titleMatch) return Number(titleMatch.id);
      }

      return null;
    } catch (err) {
      console.error("SmartShell resolveGoodId error:", err);
      return null;
    }
  }

  /**
   * Проверить, можно ли открыть смену
   */
  public async canStartWorkShift(): Promise<boolean> {
    const data = await this.request(`{ canStartWorkShift }`);
    return Boolean(data.canStartWorkShift);
  }

  /**
   * Открыть смену в SmartShell
   * @param cash — сумма наличных в кассе на начало смены
   */
  public async startWorkShift(cash: number): Promise<{ id: number; created_at: string }> {
    const mutation = `
      mutation StartWorkShift($input: StartWorkShiftInput!) {
        startWorkShift(input: $input) {
          id
          created_at
        }
      }
    `;
    const data = await this.request(mutation, { input: { cash } });
    if (!data.startWorkShift) throw new Error('SmartShell: startWorkShift вернул null');
    return data.startWorkShift;
  }

  /**
   * Закрыть смену в SmartShell
   * @param comment — опциональный комментарий
   * @param confirmPass — пароль подтверждения (если не передан, берется из config.password)
   */
  public async finishWorkShift(comment?: string, confirmPass?: string): Promise<{ id: number; finished_at: string }> {
    const password = confirmPass || this.config.password;
    if (password) {
      const mutation = `
        mutation FinishWorkShift($confirm_pass: String!, $input: FinishWorkShiftInput) {
          finishWorkShift(confirm_pass: $confirm_pass, input: $input) {
            id
            finished_at
          }
        }
      `;
      const data = await this.request(mutation, {
        confirm_pass: password,
        input: { comment: comment || '' },
      });
      if (!data.finishWorkShift) throw new Error('SmartShell: finishWorkShift вернул null');
      return data.finishWorkShift;
    }

    // Если пароль не указан, пробуем forceFinishWorkShift
    return this.forceFinishWorkShift(comment);
  }

  /**
   * Принудительно закрыть смену (без пароля)
   */
  public async forceFinishWorkShift(comment?: string): Promise<{ id: number; finished_at: string }> {
    const mutation = `
      mutation ForceFinishWorkShift($input: FinishWorkShiftInput) {
        forceFinishWorkShift(input: $input) {
          id
          finished_at
        }
      }
    `;
    const data = await this.request(mutation, { input: { comment: comment || '' } });
    if (!data.forceFinishWorkShift) throw new Error('SmartShell: forceFinishWorkShift вернул null');
    return data.forceFinishWorkShift;
  }

  /**
   * Поиск клиента SmartShell по номеру телефона
   */
  public async findClientByPhone(phone: string): Promise<{
    id: number;
    uuid: string;
    phone: string;
    login?: string;
    first_name?: string;
    last_name?: string;
    deposit?: number;
    bonus?: number;
  } | null> {
    const cleanPhone = phone.replace(/\D/g, "");
    const query = `
      query FindClient($input: ClientsInput) {
        clients(input: $input, first: 1) {
          data {
            id
            uuid
            phone
            login
            first_name
            last_name
            deposit
            bonus
          }
        }
      }
    `;
    try {
      const res = await this.request(query, {
        input: { q: cleanPhone },
      });
      return res?.clients?.data?.[0] || null;
    } catch (err) {
      console.warn("[SmartShell findClientByPhone error]:", err);
      return null;
    }
  }

  /**
   * Начисление бонусов на бонусный счет клиента
   */
  public async addBonusToClient(clientUuid: string, amount: number): Promise<{
    success: boolean;
    bonus?: number;
    error?: string;
  }> {
    const mutation = `
      mutation AddBonus($input: SetBonusInput!) {
        setBonus(input: $input) {
          id
          uuid
          bonus
          deposit
        }
      }
    `;
    try {
      const res = await this.request(mutation, {
        input: {
          client_uuid: clientUuid,
          value: Number(amount),
        },
      });
      return {
        success: true,
        bonus: Number(res?.setBonus?.bonus || 0),
      };
    } catch (err: any) {
      console.error("[SmartShell addBonusToClient error]:", err);
      return {
        success: false,
        error: err.message || "Ошибка при начислении бонусов в SmartShell",
      };
    }
  }

  /**
   * Получение компьютеров (хостов) и активных сессий клуба
   */
  public async getClubHostsWithSessions(): Promise<Array<{
    id: number;
    alias?: string;
    online?: boolean;
    locked?: boolean;
    group?: {
      id?: number;
      title?: string;
    } | null;
    client_sessions?: Array<{
      id: number;
      created_at?: string;
      started_at?: string;
      finished_at?: string;
      duration?: number;
      elapsed?: number;
      status?: string;
      client?: {
        id?: number;
        uuid?: string;
        phone?: string;
        login?: string;
        first_name?: string;
        last_name?: string;
      } | null;
    }>;
  }>> {
    const query = `
      query GetHostsWithSessions {
        hosts {
          id
          alias
          online
          locked
          group {
            id
            title
          }
          client_sessions {
            id
            created_at
            started_at
            finished_at
            duration
            elapsed
            status
            client {
              id
              uuid
              phone
              login
              first_name
              last_name
            }
          }
        }
      }
    `;
    try {
      const res = await this.request(query);
      return Array.isArray(res?.hosts) ? res.hosts : [];
    } catch (err) {
      console.warn("[SmartShell getClubHostsWithSessions error]:", err);
      return [];
    }
  }

  /**
   * Получение групп компьютеров (зон клуба: Общий зал, VIP и т.д.) из SmartShell
   */
  public async getHostGroups(): Promise<Array<{
    id: number;
    title: string;
  }>> {
    const query = `
      query GetClubHostGroups {
        hostGroups {
          id
          title
        }
      }
    `;
    try {
      const res = await this.request(query);
      return Array.isArray(res?.hostGroups) ? res.hostGroups : [];
    } catch (err) {
      console.warn("[SmartShell getHostGroups error]:", err);
      return [];
    }
  }

  /**
   * Запуск игровой сессии пользователя на компьютере (хосте)
   */
  public async startClientSessionOnHost(userId: number, hostId: number, postPaid: boolean = false): Promise<{
    success: boolean;
    session?: any;
    error?: string;
  }> {
    const mutation = `
      mutation StartClientSession($input: StartClientSessionInput!) {
        startClientSession(input: $input) {
          id
          duration
          started_at
          status
        }
      }
    `;
    try {
      const res = await this.request(mutation, {
        input: {
          user_id: Number(userId),
          host_id: Number(hostId),
          post_paid: postPaid,
        },
      });
      if (res?.startClientSession) {
        return { success: true, session: res.startClientSession };
      }
      return { success: false, error: "Не удалось запустить сессию" };
    } catch (err: any) {
      console.error("[SmartShell startClientSession error]:", err);
      return { success: false, error: err.message || "Ошибка при запуске сессии в SmartShell" };
    }
  }

  /**
   * Получение тарифов и пакетов клуба из SmartShell
   */
  public async getTariffs(): Promise<Array<{
    id: number;
    title: string;
    duration?: number;
    is_active?: boolean;
    description?: string;
  }>> {
    const query = `
      query GetClubTariffs {
        tariffs(first: 100) {
          data {
            id
            title
            duration
            is_active
            description
          }
        }
      }
    `;
    try {
      const res = await this.request(query);
      return Array.isArray(res?.tariffs?.data) ? res.tariffs.data : [];
    } catch (err) {
      console.warn("[SmartShell getTariffs error]:", err);
      return [];
    }
  }
}

