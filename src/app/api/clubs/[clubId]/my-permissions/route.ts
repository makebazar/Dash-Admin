import { NextResponse } from "next/server";
import { query } from "@/db";
import { cookies } from "next/headers";
import { hasColumn } from "@/lib/db-compat";
import { resolveSubscriptionState } from "@/lib/subscriptions";
import { getClubApiAccess } from "@/lib/club-api-access";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ clubId: string }> },
) {
  try {
    const { clubId } = await params;
    const userId = (await cookies()).get("session_user_id")?.value;

    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Use unified access helper - getClubApiAccess is already designed to re-fetch on every call.
    const access = await getClubApiAccess(clubId);
    console.log(
      `[DEBUG] my-permissions for userId=${access.userId}:`,
      JSON.stringify(access.permissions.modules),
    );

    const ownerSubscriptionRes = await query(
      `SELECT
                subscription_plan,
                subscription_status,
                subscription_ends_at,
                grace_period_days
             FROM clubs
             WHERE id = $1`,
      [clubId],
    );
    if ((ownerSubscriptionRes.rowCount || 0) === 0) {
      return NextResponse.json({ error: "Club not found" }, { status: 404 });
    }
    const ownerSubscription = resolveSubscriptionState(
      ownerSubscriptionRes.rows[0],
    );
    const graceDaysLeft = ownerSubscription.isInGracePeriod && ownerSubscription.endsAt
      ? Math.max(0, Math.ceil((new Date(ownerSubscription.endsAt.getTime() + ownerSubscription.gracePeriodDays * 24 * 60 * 60 * 1000).getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
      : null;

    const subscriptionMeta = {
      subscription_status: ownerSubscription.status,
      subscription_is_active: ownerSubscription.isActive,
      subscription_ends_at: ownerSubscription.endsAt,
      is_in_grace_period: ownerSubscription.isInGracePeriod,
      grace_days_left: graceDaysLeft,
    };

    // Use the new flag system universally
    const isFull = access.isFullAccess;
    const mod = access.permissions.modules;

    // Provide backward compatibility boolean flags for the current UI
    const mappedPermissions: Record<string, boolean> = {
      view_dashboard:
        isFull || mod.dashboard === "view" || mod.dashboard === "edit",
      view_shifts: isFull || mod.shifts === "view" || mod.shifts === "edit",
      view_schedule:
        isFull || mod.schedule === "view" || mod.schedule === "edit",
      manage_employees: isFull || mod.employees === "edit",
      view_salaries:
        isFull || mod.salaries === "view" || mod.salaries === "edit",
      view_finance: isFull || mod.finance === "view" || mod.finance === "edit",
      manage_inventory: isFull || mod.inventory === "edit",
      manage_equipment: isFull || mod.equipment === "edit",
      view_reviews: isFull || mod.reviews === "view" || mod.reviews === "edit",
      manage_club_settings: isFull || mod.settings_general === "edit",
      edit_salaries_settings: isFull || mod.settings_salary === "edit",
      manage_report_template: isFull || mod.settings_reports === "edit",
      manage_checklists: isFull || mod.settings_checklists === "edit",
      manage_kb: isFull || mod.kb === "edit",
    };

    return NextResponse.json({
      isFullAccess: access.isFullAccess,
      permissions: mappedPermissions, // Legacy format
      modules: access.permissions.modules, // New format
      user_role: access.clubRole || access.roleName,
      ...subscriptionMeta,
    });
  } catch (error: any) {
    console.error("MyPermissions Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
