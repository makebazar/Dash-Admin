import { cookies } from "next/headers"
import { query } from "@/db"

type AccessError = Error & { status?: number }

export type EmployeeSignageAccess = {
  userId: string
  shiftId: number
}

export async function requireEmployeeActiveShift(clubId: string): Promise<EmployeeSignageAccess> {
  const userId = (await cookies()).get("session_user_id")?.value
  if (!userId) {
    const error = new Error("Unauthorized") as AccessError
    error.status = 401
    throw error
  }

  const employeeCheck = await query(
    `
    SELECT 1
    FROM club_employees
    WHERE club_id = $1
      AND user_id = $2
      AND is_active = TRUE
      AND dismissed_at IS NULL
    LIMIT 1
    `,
    [clubId, userId]
  )

  if ((employeeCheck.rowCount || 0) === 0) {
    const error = new Error("Forbidden") as AccessError
    error.status = 403
    throw error
  }

  const shiftResult = await query(
    `
    SELECT id
    FROM shifts
    WHERE user_id = $1
      AND club_id = $2
      AND check_out IS NULL
    LIMIT 1
    `,
    [userId, clubId]
  )

  if ((shiftResult.rowCount || 0) === 0) {
    const error = new Error("Active shift required") as AccessError
    error.status = 409
    throw error
  }

  return {
    userId,
    shiftId: Number(shiftResult.rows[0].id),
  }
}
