import { query } from "@/db"
import { cookies } from "next/headers"

type AccessError = Error & { status?: number }

type ClubApiAccess = {
    userId: string
    isOwner: boolean
    isFullAccess: boolean
    clubRole: string | null
    roleName: string | null
}

function hasFullAccessRole(clubRole: string | null, roleName: string | null) {
    return clubRole === "Владелец" ||
        clubRole === "Админ" ||
        clubRole === "Управляющий" ||
        roleName === "Админ" ||
        roleName === "Управляющий"
}

export async function getClubApiAccess(clubId: string): Promise<ClubApiAccess> {
    const userId = (await cookies()).get("session_user_id")?.value
    if (!userId) {
        const error = new Error("Unauthorized") as AccessError
        error.status = 401
        throw error
    }

    const accessRes = await query(
        `
        SELECT
            c.owner_id,
            ce.role as club_role,
            r.name as role_name
        FROM clubs c
        LEFT JOIN club_employees ce
          ON ce.club_id = c.id
         AND ce.user_id = $2
         AND ce.is_active = true
         AND ce.dismissed_at IS NULL
        LEFT JOIN users u
          ON u.id = $2
        LEFT JOIN roles r
          ON r.id = u.role_id
        WHERE c.id = $1
          AND (c.owner_id = $2 OR ce.user_id IS NOT NULL)
        LIMIT 1
        `,
        [clubId, userId]
    )

    if ((accessRes.rowCount || 0) === 0) {
        const error = new Error("Forbidden") as AccessError
        error.status = 403
        throw error
    }

    const accessRow = accessRes.rows[0]
    const clubRole = accessRow?.club_role || null
    const roleName = accessRow?.role_name || null
    const isOwner = String(accessRow?.owner_id) === String(userId)

    return {
        userId,
        isOwner,
        isFullAccess: isOwner || hasFullAccessRole(clubRole, roleName),
        clubRole,
        roleName,
    }
}

export async function requireClubApiAccess(clubId: string) {
    const access = await getClubApiAccess(clubId)
    return access.userId
}

export async function requireClubFullAccess(clubId: string) {
    const access = await getClubApiAccess(clubId)
    if (!access.isFullAccess) {
        const error = new Error("Forbidden") as AccessError
        error.status = 403
        throw error
    }
    return access
}
