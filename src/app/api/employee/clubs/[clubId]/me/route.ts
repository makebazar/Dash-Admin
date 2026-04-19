import { NextResponse } from "next/server"
import { getEmployeeRoleAccess } from "@/lib/employee-role-access"

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ clubId: string }> }
) {
    try {
        const { clubId } = await params
        const access = await getEmployeeRoleAccess(clubId)
        return NextResponse.json({
            user_id: access.userId,
            role_id: access.roleId,
            role_name: access.roleName,
            settings: access.settings,
        })
    } catch (error: any) {
        const status = error?.status
        if (status) {
            return NextResponse.json({ error: status === 401 ? "Unauthorized" : "Forbidden" }, { status })
        }
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}

