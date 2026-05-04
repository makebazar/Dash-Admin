import { query } from "@/db";
import { cookies } from "next/headers";

type AccessError = Error & { status?: number };

export type AccessLevel = "none" | "view" | "edit";

export type ModuleAccessKey =
  | "dashboard"
  | "shifts"
  | "schedule"
  | "employees"
  | "salaries"
  | "requests"
  | "finance"
  | "inventory"
  | "equipment"
  | "signage"
  | "kb"
  | "reviews"
  | "tasks"
  | "settings_general"
  | "settings_salary"
  | "settings_reports"
  | "settings_checklists";

export type ClubApiAccess = {
  userId: string;
  isOwner: boolean;
  isFullAccess: boolean;
  canAccessManagement: boolean;
  clubRole: string | null;
  roleName: string | null;
  permissions: {
    is_full_access: boolean;
    employee_only: boolean;
    modules: Record<ModuleAccessKey, AccessLevel>;
    // Legacy flags for transition / safety
    can_view_reports: boolean;
    can_edit_settings: boolean;
    can_manage_employees: boolean;
    can_manage_inventory: boolean;
    can_manage_equipment: boolean;
  };
};

function resolveAccessLevel(
  level: unknown,
  fallbackBoolean?: boolean,
): AccessLevel {
  if (level === "edit") return "edit";
  if (level === "view") return "view";
  if (level === "none") return "none";
  // Если уровень не задан, но есть старый флаг true, даем edit доступ
  if (fallbackBoolean === true) return "edit";
  return "none";
}

function hasFullAccessRole(
  clubRole: string | null,
  roleName: string | null,
  permissions: any,
  clubId: string,
) {
  if (permissions && typeof permissions.is_full_access === "boolean") {
    return permissions.is_full_access;
  }
  // Remove string-based fallback as per instructions to move entirely to the new system.
  return false;
}

function canAccessManagement(
  access: {
    isOwner: boolean;
    clubRole: string | null;
    roleName: string | null;
    permissions: any;
  },
  clubId: string,
): boolean {
  if (access.isOwner) return true;

  if (access.permissions.employee_only === true) return false;
  if (access.permissions.is_full_access === true) return true;

  const hasAnyModuleAccess = Object.values(
    access.permissions.modules || {},
  ).some((v) => v === "view" || v === "edit");

  return !!(
    hasAnyModuleAccess ||
    access.permissions.can_view_reports ||
    access.permissions.can_edit_settings
  );
}

export async function getApiAccess(): Promise<{ userId: string }> {
  const userId = (await cookies()).get("session_user_id")?.value;
  if (!userId) {
    const error = new Error("Unauthorized") as AccessError;
    error.status = 401;
    throw error;
  }
  return { userId };
}

export async function getClubApiAccess(clubId: string): Promise<ClubApiAccess> {
  const { userId } = await getApiAccess();

  console.log(
    `[DEBUG] Executing getClubApiAccess for clubId=${clubId}, userId=${userId}`,
  );
  const accessRes = await query(
    `
        SELECT
            c.owner_id,
            ce.role as club_role,
            ce.role_id,
            r_global.name as global_role_name,
            r_club.name as club_role_name,
            COALESCE(
              crs.employee_access_settings,
              r_club.employee_access_settings,
              r_global.employee_access_settings,
              '{}'::jsonb
            ) as permissions
        FROM clubs c
        LEFT JOIN club_employees ce
          ON ce.club_id = c.id
         AND ce.user_id = $2
         AND ce.is_active = true
         AND ce.dismissed_at IS NULL
        LEFT JOIN users u
          ON u.id = $2
        LEFT JOIN roles r_global
          ON r_global.id = u.role_id
        LEFT JOIN roles r_club
          ON r_club.id = ce.role_id
        LEFT JOIN club_role_settings crs
          ON crs.club_id = c.id AND crs.role_id = COALESCE(ce.role_id, u.role_id)
        WHERE c.id = $1
          AND (c.owner_id = $2 OR ce.user_id IS NOT NULL)
        LIMIT 1
        `,
    [clubId, userId],
  );
  console.log(`[DEBUG] accessRes.rowCount:`, accessRes.rowCount);

  if ((accessRes.rowCount || 0) === 0) {
    const error = new Error("Forbidden") as AccessError;
    error.status = 403;
    throw error;
  }

  const accessRow = accessRes.rows[0];
  console.log(
    `[DEBUG] getClubApiAccess for userId=${userId}, clubId=${clubId}. Found row:`,
    !!accessRow,
  );
  if (accessRow) {
    console.log(
      `[DEBUG] accessRow: role_id=${accessRow.role_id}, club_role=${accessRow.club_role}`,
    );
  }

  const clubRole = accessRow?.club_role || accessRow?.club_role_name || null;
  const roleName = accessRow?.global_role_name || null;
  const isOwner = String(accessRow?.owner_id) === String(userId);
  const rawPerms = accessRow?.permissions || {};
  console.log(`[DEBUG] rawPerms:`, JSON.stringify(rawPerms));

  const isFullAccess =
    isOwner || hasFullAccessRole(clubRole, roleName, rawPerms, clubId);
  console.log(`[DEBUG] isFullAccess: ${isFullAccess}, isOwner: ${isOwner}`);

  const modules: Record<ModuleAccessKey, AccessLevel> = {
    dashboard: resolveAccessLevel(
      rawPerms.dashboard_access,
      rawPerms.can_view_reports,
    ),
    shifts: resolveAccessLevel(
      rawPerms.shifts_access,
      rawPerms.can_view_reports,
    ),
    schedule: resolveAccessLevel(
      rawPerms.schedule_access,
      rawPerms.can_manage_employees,
    ),
    employees: resolveAccessLevel(
      rawPerms.employees_access,
      rawPerms.can_manage_employees,
    ),
    salaries: resolveAccessLevel(
      rawPerms.salaries_access,
      rawPerms.can_view_reports,
    ),
    requests: resolveAccessLevel(
      rawPerms.requests_access,
      rawPerms.can_manage_employees,
    ),
    finance: resolveAccessLevel(
      rawPerms.finance_access,
      rawPerms.can_view_reports,
    ),
    inventory: resolveAccessLevel(
      rawPerms.inventory_access,
      rawPerms.can_manage_inventory,
    ),
    equipment: resolveAccessLevel(
      rawPerms.equipment_access,
      rawPerms.can_manage_equipment,
    ),
    signage: resolveAccessLevel(rawPerms.signage_access, isFullAccess),
    kb: resolveAccessLevel(rawPerms.kb_access, rawPerms.can_edit_settings),
    reviews: resolveAccessLevel(
      rawPerms.reviews_access,
      rawPerms.can_view_reports,
    ),
    tasks: resolveAccessLevel(
      rawPerms.tasks_access,
      rawPerms.can_manage_equipment,
    ),
    settings_general: resolveAccessLevel(
      rawPerms.settings_general_access,
      rawPerms.can_edit_settings,
    ),
    settings_salary: resolveAccessLevel(
      rawPerms.settings_salary_access,
      rawPerms.can_edit_settings,
    ),
    settings_reports: resolveAccessLevel(
      rawPerms.settings_reports_access,
      rawPerms.can_edit_settings,
    ),
    settings_checklists: resolveAccessLevel(
      rawPerms.settings_checklists_access,
      rawPerms.can_edit_settings,
    ),
  };
  console.log(`[DEBUG] Resolved modules:`, JSON.stringify(modules));

  const permissions = {
    is_full_access: !!rawPerms.is_full_access,
    employee_only: !!rawPerms.employee_only,
    modules,
    // Legacy flags for compatibility where they are directly used
    can_view_reports: !!rawPerms.can_view_reports,
    can_edit_settings: !!rawPerms.can_edit_settings,
    can_manage_employees: !!rawPerms.can_manage_employees,
    can_manage_inventory: !!rawPerms.can_manage_inventory,
    can_manage_equipment: !!rawPerms.can_manage_equipment,
  };

  const accessData = {
    userId,
    isOwner,
    isFullAccess,
    clubRole,
    roleName,
    permissions,
  };

  return {
    ...accessData,
    canAccessManagement: canAccessManagement(accessData, clubId),
  };
}

/**
 * Checks if the user has a specific access level for a module.
 */
export function hasModuleAccess(
  access: ClubApiAccess,
  module: ModuleAccessKey,
  requiredLevel: "view" | "edit",
  clubId: string,
): boolean {
  if (access.isOwner || access.permissions.is_full_access) return true;

  const level = access.permissions.modules[module] || "none";
  console.log(
    `[DEBUG] Permission check: module=${module}, required=${requiredLevel}, current=${level}`,
  );

  if (requiredLevel === "view") return level === "view" || level === "edit";
  if (requiredLevel === "edit") return level === "edit";

  return false;
}

/**
 * LEGACY: Checks if the user has a specific permission for a club using old boolean flags.
 * @deprecated Use hasModuleAccess instead.
 */
export function hasPermission(
  access: ClubApiAccess,
  permission: keyof Omit<ClubApiAccess["permissions"], "modules">,
  clubId: string,
) {
  return (
    access.isOwner ||
    access.permissions.is_full_access ||
    !!(access.permissions as any)[permission]
  );
}

export async function requireClubApiAccess(clubId: string) {
  const access = await getClubApiAccess(clubId);
  return access.userId;
}

/**
 * Requires the user to have at least 'view' or 'edit' access to a specific module.
 */
export async function requireModuleAccess(
  clubId: string,
  module: ModuleAccessKey,
  level: "view" | "edit" = "view",
) {
  const access = await getClubApiAccess(clubId);
  if (!hasModuleAccess(access, module, level, clubId)) {
    const error = new Error(
      `Forbidden: Missing ${level} access for module ${module}. Access data: ${JSON.stringify(access.permissions)}`,
    ) as AccessError;
    error.status = 403;
    throw error;
  }
  return access;
}

export async function requireClubFullAccess(clubId: string) {
  const access = await getClubApiAccess(clubId);
  if (!access.isFullAccess) {
    const error = new Error("Forbidden") as AccessError;
    error.status = 403;
    throw error;
  }
  return access;
}

export async function requireClubOwner(clubId: string) {
  const access = await getClubApiAccess(clubId);
  if (!access.isOwner) {
    const error = new Error("Forbidden") as AccessError;
    error.status = 403;
    throw error;
  }
  return access;
}
