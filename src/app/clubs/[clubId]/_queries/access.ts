import { redirect } from "next/navigation";
import { query } from "@/db";
import { getClubApiAccess, hasModuleAccess } from "@/lib/club-api-access";
import type { DashboardAccess, PermissionMap } from "../_types";

export async function getDashboardAccess(
  clubId: string,
): Promise<DashboardAccess> {
  const clubRes = await query(
    `SELECT id, name, owner_id FROM clubs WHERE id = $1`,
    [clubId],
  );
  if ((clubRes.rowCount || 0) === 0) redirect("/dashboard");
  const club = clubRes.rows[0];

  try {
    const access = await getClubApiAccess(clubId);

    const permissions: PermissionMap = {
      view_shifts: hasModuleAccess(access, "shifts", "view", clubId),
      manage_employees: hasModuleAccess(access, "employees", "edit", clubId),
      manage_inventory: hasModuleAccess(access, "inventory", "edit", clubId),
      manage_equipment: hasModuleAccess(access, "equipment", "edit", clubId),
    };

    return {
      clubName: club.name,
      isFullAccess: access.isFullAccess,
      permissions,
      roleName: access.clubRole || access.roleName,
    };
  } catch (e) {
    redirect("/dashboard");
  }
}
