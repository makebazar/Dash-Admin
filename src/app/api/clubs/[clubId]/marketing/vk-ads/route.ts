import { NextResponse } from "next/server";

// Глобальный in-memory кэш токенов VK Ads для предотвращения лимита токенов
interface TokenCacheEntry {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number; // timestamp ms
}

const tokenCache: Map<string, TokenCacheEntry> =
  (globalThis as any).__vk_ads_token_cache__ ||
  ((globalThis as any).__vk_ads_token_cache__ = new Map());

// Первоначально полученные токены
const INITIAL_KEY = "X3aiv6IIlQxTMLta";
if (!tokenCache.has(INITIAL_KEY)) {
  tokenCache.set(INITIAL_KEY, {
    accessToken: "JV9yOYu1o61SzDs4cw3YHbS92CfuQpF9U9hZt38IYKKzEEDlBTWtBvOGLfaFjPa4LSwKHKUzxz5J8WzzTFJQd1nDPcrEOFjLMlsiRV0eSi8Ti0orzZwKAzk2FVVG7wkGGSzw0imIi4zuAkWmu5YOMBRYZcRd6ZdIKL3XanAEK7wm7dU6xrWUEwlePs30gp5stBtbEWHWkkOqdANX8cSV7qpsxc20YfVkBcVXiiWT2",
    refreshToken: "542TTlTbimO5aYAfILeyS0giHZ2bRKRcQJAaO4rMZuweInol8ceoE9y0zU5wAbe8t30COyydUBDGrZCYlMaYs1cRzsg1U2HZkAeb0uxKZWHZfzFD9Er3qUhfagxWm6tMoupLMa6UJxZDpo1M2bBuIgI5De6tj5ms5AtGUPoM5VNBi6OMJcvACYftjQJVrN5lCRhrKNZlimAxw7",
    expiresAt: Date.now() + 86400 * 1000 - 60000,
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ clubId: string }> }
) {
  try {
    const body = await request.json();
    const { action, clientId, clientSecret, accessToken } = body;

    // Helper: получить живой access_token с кэшированием и refresh
    const getValidToken = async (): Promise<{ token: string; error?: string }> => {
      if (accessToken && !clientId) {
        return { token: accessToken };
      }

      const cId = clientId?.trim() || INITIAL_KEY;
      const cSecret = clientSecret?.trim();

      // Проверяем кэш
      const cached = tokenCache.get(cId);
      if (cached && cached.accessToken && cached.expiresAt > Date.now() + 60_000) {
        return { token: cached.accessToken };
      }

      // Если есть refresh_token, обновляем через него
      if (cached?.refreshToken && cSecret) {
        try {
          const params = new URLSearchParams();
          params.append("client_id", cId);
          params.append("client_secret", cSecret);
          params.append("grant_type", "refresh_token");
          params.append("refresh_token", cached.refreshToken);

          const rRes = await fetch("https://ads.vk.com/api/v2/oauth2/token.json", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: params.toString(),
          });
          const rData = await rRes.json();
          if (rRes.ok && rData.access_token) {
            tokenCache.set(cId, {
              accessToken: rData.access_token,
              refreshToken: rData.refresh_token || cached.refreshToken,
              expiresAt: Date.now() + (rData.expires_in || 86400) * 1000 - 60000,
            });
            return { token: rData.access_token };
          }
        } catch (e) {
          console.warn("[VK Ads] Failed to refresh token:", e);
        }
      }

      // Если кэша нет или refresh не сработал, делаем client_credentials
      if (cId && cSecret) {
        try {
          const params = new URLSearchParams();
          params.append("client_id", cId);
          params.append("client_secret", cSecret);
          params.append("grant_type", "client_credentials");

          const oauthRes = await fetch("https://ads.vk.com/api/v2/oauth2/token.json", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: params.toString(),
          });
          const oauthData = await oauthRes.json();
          if (oauthRes.ok && oauthData.access_token) {
            tokenCache.set(cId, {
              accessToken: oauthData.access_token,
              refreshToken: oauthData.refresh_token,
              expiresAt: Date.now() + (oauthData.expires_in || 86400) * 1000 - 60000,
            });
            return { token: oauthData.access_token };
          }

          // Если превышен лимит токенов, но у нас есть текущий токен в кэше — используем его
          if (oauthData.error === "token_limit_exceeded" && cached?.accessToken) {
            return { token: cached.accessToken };
          }

          return {
            token: cached?.accessToken || "",
            error: oauthData.error_description || oauthData.error || "Ошибка получения токена VK Рекламы",
          };
        } catch (e: any) {
          if (cached?.accessToken) return { token: cached.accessToken };
          return { token: "", error: "Ошибка подключения к OAuth VK: " + (e.message || String(e)) };
        }
      }

      return { token: cached?.accessToken || "", error: "Укажите Client ID и Client Secret" };
    };

    // Действие 1: Проверка подключения и профиля
    if (action === "check_auth") {
      const { token, error: tokenErr } = await getValidToken();
      if (!token) {
        return NextResponse.json({ ok: false, error: tokenErr }, { status: 400 });
      }

      try {
        const res = await fetch("https://ads.vk.com/api/v2/user.json", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await res.json();

        if (res.ok && !data.error) {
          return NextResponse.json({
            ok: true,
            user: {
              id: data.id,
              name: [data.firstname, data.lastname].filter(Boolean).join(" ") || data.username,
              email: data.email,
              currency: data.currency || "RUB",
              status: data.status,
            },
            message: `Подключено: ${data.firstname || ""} ${data.lastname || ""} (${data.email || data.id})`,
          });
        }

        return NextResponse.json({
          ok: false,
          error: data?.error?.message || "Токен отклонен сервером ads.vk.com",
        });
      } catch (err: any) {
        return NextResponse.json({
          ok: false,
          error: "Ошибка запроса к ads.vk.com: " + (err.message || String(err)),
        });
      }
    }

    // Действие 2: Получение списка рекламных планов
    if (action === "get_campaigns") {
      const { token, error: tokenErr } = await getValidToken();
      if (!token) {
        return NextResponse.json({ ok: false, error: tokenErr }, { status: 400 });
      }

      try {
        const res = await fetch(
          "https://ads.vk.com/api/v2/ad_plans.json?fields=id,name,status,budget_limit_day,budget_limit,created,updated",
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        const data = await res.json();
        return NextResponse.json({
          ok: true,
          items: data.items || [],
          count: data.count || 0,
        });
      } catch (err: any) {
        return NextResponse.json({
          ok: false,
          error: "Ошибка загрузки кампаний: " + (err.message || String(err)),
        });
      }
    }

    return NextResponse.json({ ok: false, error: "Неизвестное действие" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: "Внутренняя ошибка сервера: " + (error.message || String(error)) },
      { status: 500 }
    );
  }
}
