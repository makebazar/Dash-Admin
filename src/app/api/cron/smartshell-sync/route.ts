import { NextResponse } from "next/server";
import { query } from "@/db";
import { syncSmartShellShifts } from "@/lib/smartshell/shift-sync";

export const dynamic = "force-dynamic";

/**
 * Фоновый Крон для автоматической непрерывной синхронизации SmartShell (24/7)
 * Опрашивает все клубы с включенной интеграцией и списывает чеки/остатки в фоне.
 */
export async function GET() {
  try {
    const clubsRes = await query(
      `SELECT id FROM clubs WHERE (inventory_settings->>'smartshell_integration_enabled')::boolean = true`
    );

    const clubs = clubsRes.rows || [];
    const results: any[] = [];

    for (const club of clubs) {
      try {
        const res = await syncSmartShellShifts(club.id);
        results.push({ clubId: club.id, status: "ok", message: res.message });
      } catch (err: any) {
        console.error(`SmartShell background cron error for club ${club.id}:`, err);
        results.push({ clubId: club.id, status: "error", error: err.message });
      }
    }

    return NextResponse.json({
      success: true,
      syncedClubsCount: clubs.length,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("SmartShell background cron route error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
