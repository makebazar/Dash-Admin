import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ clubId: string }> }
) {
  try {
    const { searchParams } = new URL(request.url);
    const apiId = searchParams.get("apiId");
    const action = searchParams.get("action");

    if (!apiId) {
      return NextResponse.json({ ok: false, error: "API ID обязателен" }, { status: 400 });
    }

    // Action 1: Отправка тестовой SMS
    if (action === "send_test") {
      const to = searchParams.get("to");
      const msg = searchParams.get("msg") || "Тестовое сообщение из DashAdmin Marketing";
      const from = searchParams.get("from");
      const test = searchParams.get("test") === "1" ? "1" : "0";

      if (!to) {
        return NextResponse.json({ ok: false, error: "Номер получателя обязателен" }, { status: 400 });
      }

      const cleanPhone = to.replace(/\D/g, "");
      const fullPhone = cleanPhone.length === 11 && cleanPhone.startsWith("8") ? "7" + cleanPhone.slice(1) : cleanPhone;

      const url = new URL("https://sms.ru/sms/send");
      url.searchParams.set("api_id", apiId);
      url.searchParams.set("to", fullPhone);
      url.searchParams.set("msg", msg);
      url.searchParams.set("json", "1");
      if (from) url.searchParams.set("from", from);
      if (test === "1") url.searchParams.set("test", "1");

      const res = await fetch(url.toString(), { method: "GET" });
      const data = await res.json();

      if (data.status === "OK") {
        const phoneData = data.sms?.[fullPhone] || {};
        return NextResponse.json({
          ok: phoneData.status === "OK",
          status_code: phoneData.status_code,
          status_text: phoneData.status_text || "Успешно отправлено",
          cost: phoneData.cost,
          balance: data.balance,
        });
      }

      return NextResponse.json({
        ok: false,
        error: data.status_text || `Ошибка SMS.RU (код ${data.status_code})`,
      });
    }

    // Action 2: Расчет стоимости (sms/cost) для одного сообщения или списка
    if (action === "cost") {
      const to = searchParams.get("to");
      const msg = searchParams.get("msg") || "";

      if (!to) {
        return NextResponse.json({ ok: false, error: "Параметр 'to' обязателен для расчета" }, { status: 400 });
      }

      const url = new URL("https://sms.ru/sms/cost");
      url.searchParams.set("api_id", apiId);
      url.searchParams.set("to", to);
      url.searchParams.set("msg", msg);
      url.searchParams.set("json", "1");

      const res = await fetch(url.toString(), { method: "GET" });
      const data = await res.json();

      if (data.status === "OK") {
        return NextResponse.json({
          ok: true,
          totalCost: data.total_cost || 0,
          totalSms: data.total_sms || 0,
          sms: data.sms || {},
        });
      }

      return NextResponse.json({
        ok: false,
        error: data.status_text || `Ошибка расчета SMS.RU (код ${data.status_code})`,
      });
    }

    // Action 3: Проверка баланса и валидация ключа
    const url = `https://sms.ru/my/balance?api_id=${encodeURIComponent(apiId)}&json=1`;
    const res = await fetch(url, { method: "GET" });
    const data = await res.json();

    if (data.status === "OK") {
      return NextResponse.json({
        ok: true,
        balance: data.balance,
        currency: "RUB",
      });
    }

    return NextResponse.json({
      ok: false,
      error: data.status_text || `Неверный API-ключ (код ${data.status_code})`,
    });
  } catch (err: any) {
    console.error("SMS.RU Error:", err);
    return NextResponse.json({ ok: false, error: err.message || "Ошибка обращения к SMS.RU" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ clubId: string }> }
) {
  try {
    const body = await request.json();
    const { apiId, senderName, testMode, messages, action } = body;

    if (!apiId) {
      return NextResponse.json({ ok: false, error: "API ID обязателен" }, { status: 400 });
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ ok: false, error: "Список сообщений пуст" }, { status: 400 });
    }

    // -------------------------------------------------------------
    // POST Action: Пакетный расчет точной стоимости через sms.ru/sms/cost
    // -------------------------------------------------------------
    if (action === "cost") {
      const chunkSize = 100;
      const chunks: typeof messages[] = [];
      for (let i = 0; i < messages.length; i += chunkSize) {
        chunks.push(messages.slice(i, i + chunkSize));
      }

      let totalCost = 0;
      let totalSms = 0;
      const smsMap: Record<string, any> = {};

      for (const chunk of chunks) {
        const formData = new URLSearchParams();
        formData.set("api_id", apiId);
        formData.set("json", "1");

        chunk.forEach((item: { phone: string; text: string }) => {
          const clean = (item.phone || "").replace(/\D/g, "");
          const fullPhone = clean.length === 11 && clean.startsWith("8") ? "7" + clean.slice(1) : clean;
          formData.set(`to[${fullPhone}]`, item.text);
        });

        const res = await fetch("https://sms.ru/sms/cost", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: formData.toString(),
        });

        const data = await res.json();
        if (data.status === "OK") {
          totalCost += data.total_cost || 0;
          totalSms += data.total_sms || 0;
          if (data.sms) {
            Object.assign(smsMap, data.sms);
          }
        }
      }

      return NextResponse.json({
        ok: true,
        totalCost: Number(totalCost.toFixed(2)),
        totalSms,
        count: messages.length,
        averageCostPerMessage: messages.length > 0 ? Number((totalCost / messages.length).toFixed(2)) : 0,
        sms: smsMap,
      });
    }

    // Разбиваем на пакеты по 100 сообщений (лимит SMS.RU multi-send за 1 запрос)
    const chunkSize = 100;
    const chunks: typeof messages[] = [];
    for (let i = 0; i < messages.length; i += chunkSize) {
      chunks.push(messages.slice(i, i + chunkSize));
    }

    let totalSent = 0;
    let totalFailed = 0;
    let totalCost = 0;
    let lastBalance: number | null = null;
    const results: Array<{ phone: string; status: string; status_code?: number; cost?: number; error?: string }> = [];

    for (const chunk of chunks) {
      const formData = new URLSearchParams();
      formData.set("api_id", apiId);
      formData.set("json", "1");
      if (senderName) formData.set("from", senderName);
      if (testMode) formData.set("test", "1");

      chunk.forEach((item: { phone: string; text: string }) => {
        const clean = (item.phone || "").replace(/\D/g, "");
        const fullPhone = clean.length === 11 && clean.startsWith("8") ? "7" + clean.slice(1) : clean;
        formData.set(`to[${fullPhone}]`, item.text);
      });

      const res = await fetch("https://sms.ru/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData.toString(),
      });

      const data = await res.json();

      if (data.status === "OK") {
        if (typeof data.balance === "number") lastBalance = data.balance;
        const smsMap = data.sms || {};
        for (const [phone, info] of Object.entries<any>(smsMap)) {
          if (info.status === "OK") {
            totalSent++;
            totalCost += info.cost || 0;
            results.push({ phone, status: "OK", status_code: info.status_code, cost: info.cost });
          } else {
            totalFailed++;
            results.push({ phone, status: "ERROR", status_code: info.status_code, error: info.status_text });
          }
        }
      } else {
        totalFailed += chunk.length;
        chunk.forEach((c: { phone: string }) => {
          results.push({ phone: c.phone, status: "ERROR", error: data.status_text });
        });
      }
    }

    return NextResponse.json({
      ok: true,
      totalSent,
      totalFailed,
      totalCost,
      balance: lastBalance,
      results,
    });
  } catch (err: any) {
    console.error("SMS.RU Batch Error:", err);
    return NextResponse.json({ ok: false, error: err.message || "Ошибка отправки через SMS.RU" }, { status: 500 });
  }
}
