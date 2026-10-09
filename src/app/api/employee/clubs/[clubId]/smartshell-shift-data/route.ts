import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query } from "@/db";
import { getSmartShellClientForClub, buildReportDataFromSmartShell, getSmartShellFieldMapping } from "@/lib/smartshell/shift-sync";
import { normalizeInventorySettings } from "@/lib/inventory-settings";

/**
 * GET /api/employee/clubs/[clubId]/smartshell-shift-data
 *
 * Возвращает данные активной смены SmartShell для предзаполнения wizard'а закрытия.
 * Также возвращает fieldMapping — какие поля автозаполняются из SS (для блокировки на UI).
 *
 * Если SmartShell не настроен или недоступен — возвращает { enabled: false }.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ clubId: string }> }
) {
  try {
    const userId = (await cookies()).get("session_user_id")?.value;
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { clubId } = await params;
    const clubIdInt = parseInt(clubId, 10);

    // Проверяем доступ сотрудника
    const access = await query(
      `SELECT 1 FROM club_employees WHERE club_id = $1 AND user_id = $2
       UNION SELECT 1 FROM clubs WHERE id = $1 AND owner_id = $2`,
      [clubIdInt, userId]
    );
    if ((access.rowCount || 0) === 0) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Проверяем включена ли интеграция
    const clubRes = await query(`SELECT inventory_settings FROM clubs WHERE id = $1`, [clubIdInt]);
    const invSettings = normalizeInventorySettings(clubRes.rows[0]?.inventory_settings);
    if (!invSettings.smartshell_integration_enabled) {
      return NextResponse.json({ enabled: false });
    }

    const client = await getSmartShellClientForClub(clubIdInt);
    if (!client) return NextResponse.json({ enabled: false });

    // Получаем активную смену из SmartShell
    let ssShift;
    try {
      ssShift = await client.getActiveWorkShift();
    } catch (e: any) {
      console.warn("[SmartShell] getActiveWorkShift error:", e?.message);
      return NextResponse.json({ enabled: true, error: "SmartShell недоступен", reportData: null, fieldMapping: {} });
    }

    if (!ssShift) {
      return NextResponse.json({ enabled: true, reportData: null, fieldMapping: {} });
    }

    const [reportData, fieldMapping] = await Promise.all([
      buildReportDataFromSmartShell(clubIdInt, ssShift),
      getSmartShellFieldMapping(clubIdInt),
    ]);

    return NextResponse.json({
      enabled: true,
      reportData,
      fieldMapping,  // { "card_income": "money.sum.card", ... }
      ssShift: {
        id: ssShift.id,
        created_at: ssShift.created_at,
        money: ssShift.money,
      },
    });
  } catch (error: any) {
    console.error("SmartShell shift data error:", error);
    return NextResponse.json({ enabled: false, error: error.message }, { status: 500 });
  }
}
