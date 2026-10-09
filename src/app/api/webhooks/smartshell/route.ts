import { NextResponse } from "next/server";
import { query } from "@/db";
import { syncSmartShellShifts } from "@/lib/smartshell/shift-sync";

export const dynamic = "force-dynamic";

/**
 * Высокоскоростной входящий Webhook от SmartShell (Event-Driven PUSH)
 * Срабатывает мгновенно при пробитии чека на кассе или изменении смены.
 */
export async function POST(request: Request) {
  const startTime = Date.now();
  try {
    const payload = await request.json().catch(() => ({}));
    
    // Идентификация клуба по company_id или club_id в теле запроса или заголовках
    const companyIdRaw =
      payload?.company_id ||
      payload?.companyId ||
      payload?.club_id ||
      request.headers.get("x-company-id") ||
      request.headers.get("company-id");

    let clubId: number | null = null;

    if (companyIdRaw) {
      const companyIdInt = parseInt(String(companyIdRaw), 10);
      if (!isNaN(companyIdInt)) {
        const clubRes = await query(
          `SELECT id FROM clubs 
           WHERE (inventory_settings->>'smartshell_company_id')::int = $1 
              OR id = $1 
           LIMIT 1`,
          [companyIdInt]
        );
        if (clubRes.rows.length > 0) {
          clubId = clubRes.rows[0].id;
        }
      }
    }

    // Если ID клуба не передан явно в теле, ищем все активные клубы со SmartShell
    if (!clubId) {
      const activeClubs = await query(
        `SELECT id FROM clubs WHERE (inventory_settings->>'smartshell_integration_enabled')::boolean = true LIMIT 1`
      );
      if (activeClubs.rows.length > 0) {
        clubId = activeClubs.rows[0].id;
      }
    }

    if (!clubId) {
      return NextResponse.json(
        { success: false, error: "Клуб не найден для данного webhook события" },
        { status: 404 }
      );
    }

    // Мгновенная синхронизация смены и списание товара в БД за ~20-40 мс
    const syncResult = await syncSmartShellShifts(clubId);
    const durationMs = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      clubId,
      processedInMs: durationMs,
      message: syncResult.message,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("SmartShell Webhook Handler Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * Поддержка метода GET для верификации эндпоинта при настройке в панели SmartShell
 */
export async function GET() {
  return NextResponse.json({
    status: "online",
    service: "DashAdmin SmartShell Webhook Listener",
    timestamp: new Date().toISOString(),
  });
}
