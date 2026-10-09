import { NextResponse } from "next/server";
import { SmartShellClient } from "@/lib/smartshell/client";
import { requireModuleAccess } from "@/lib/club-api-access";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ clubId: string }> }
) {
  try {
    const { clubId } = await params;
    await requireModuleAccess(clubId, "settings_general", "edit");

    const body = await request.json();
    const { api_key, company_id, login, password } = body;

    const hasLogin = Boolean(login && password && company_id);
    const hasApiKey = Boolean(api_key);

    if (!hasLogin && !hasApiKey) {
      return NextResponse.json(
        { error: "Укажите логин и пароль сотрудника SmartShell (и ID компании) или API-ключ" },
        { status: 400 }
      );
    }

    const client = new SmartShellClient({
      apiKey: api_key || undefined,
      login: login || undefined,
      password: password || undefined,
      companyId: company_id ? Number(company_id) : undefined,
    });

    // Проверяем авторизацию
    await client.getAuthToken();

    let clubs: any[] = [];
    try {
      clubs = await client.getMyClubs();
    } catch {
      // Игнорируем ошибку прав myClubs
    }

    return NextResponse.json({
      success: true,
      message: "Подключение к SmartShell API успешно установлено!",
      clubs,
    });
  } catch (error: any) {
    console.error("SmartShell Connection Test Error:", error);
    return NextResponse.json(
      { error: error.message || "Не удалось подключиться к SmartShell API" },
      { status: 400 }
    );
  }
}
