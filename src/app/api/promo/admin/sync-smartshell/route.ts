import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query } from "@/db";
import { syncSmartShellPaymentsForPromo } from "@/lib/promo-smartshell-sync";
import { normalizeInventorySettings } from "@/lib/inventory-settings";

export async function POST(request: Request) {
  try {
    const userId = (await cookies()).get("session_user_id")?.value;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const url = new URL(request.url);
    const clubId = body.clubId || url.searchParams.get("clubId");

    const clubIdInt = parseInt(String(clubId), 10);
    if (isNaN(clubIdInt)) {
      return NextResponse.json({ error: "Invalid club ID" }, { status: 400 });
    }

    // Проверяем глобальные настройки клуба на включение SmartShell
    const clubRes = await query(
      `SELECT inventory_settings FROM clubs WHERE id = $1`,
      [clubIdInt]
    );

    if (clubRes.rowCount === 0) {
      return NextResponse.json({ error: "Club not found" }, { status: 404 });
    }

    const invSettings = normalizeInventorySettings(clubRes.rows[0].inventory_settings);
    const hasAuth = Boolean(
      (invSettings.smartshell_login && invSettings.smartshell_password && invSettings.smartshell_company_id) ||
      invSettings.smartshell_api_key
    );

    if (!invSettings.smartshell_integration_enabled || !hasAuth) {
      return NextResponse.json(
        {
          error: "SmartShell integration is disabled in global settings",
          is_smartshell_enabled: false,
        },
        { status: 400 }
      );
    }

    // Запускаем синхронизацию платежей, визитов и сессий
    const result = await syncSmartShellPaymentsForPromo(clubIdInt);

    return NextResponse.json({
      success: result.synced,
      processedCount: result.processedCount,
      totalTicketsAwarded: result.totalTicketsAwarded,
      visitsProcessed: result.visitsProcessed || 0,
      message: result.message,
    });
  } catch (error: any) {
    console.error("[SmartShell Promo Sync Error]:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
