import { query } from "@/db"
import { cookies } from "next/headers"

type AccessError = Error & { status?: number }

export async function requireClubApiAccess(clubId: string) {
    const userId = (await cookies()).get("session_user_id")?.value
    if (!userId) {
        const error = new Error("Unauthorized") as AccessError
        error.status = 401
        throw error
    }

    const accessRes = await query(
        `
        SELECT 1
        FROM clubs c
        LEFT JOIN club_employees ce
          ON ce.club_id = c.id
         AND ce.user_id = $2
         AND ce.is_active = true
         AND ce.dismissed_at IS NULL
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

    return userId
}
