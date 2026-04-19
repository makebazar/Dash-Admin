import { ClubSidebar, ClubSidebarContent } from "@/components/layout/ClubSidebar"
import { MobileNav } from "@/components/layout/MobileNav"
import { query } from "@/db"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { hasColumn } from "@/lib/db-compat"
import { resolveSubscriptionState } from "@/lib/subscriptions"
import { getEmployeeRoleAccess } from "@/lib/employee-role-access"

export default async function ClubLayout({
    children,
    params,
}: {
    children: React.ReactNode
    params: Promise<{ clubId: string }>
}) {
    const { clubId } = await params
    const userId = (await cookies()).get('session_user_id')?.value
    if (!userId) {
        redirect('/login')
    }

    const hasSubscriptionStatus = await hasColumn('users', 'subscription_status')
    
    // Check if user is owner or employee of the club
    const accessCheck = await query(
        `SELECT c.owner_id, u.subscription_plan, u.subscription_status, u.subscription_ends_at
         FROM clubs c
         JOIN users u ON u.id = c.owner_id
         WHERE c.id = $1
           AND (
               c.owner_id = $2
               OR EXISTS (
                   SELECT 1 FROM club_employees ce
                   WHERE ce.club_id = $1
                     AND ce.user_id = $2
                     AND ce.is_active = TRUE
                     AND ce.dismissed_at IS NULL
               )
           )`,
        [clubId, userId]
    )
    
    if ((accessCheck.rowCount || 0) === 0) {
        redirect('/dashboard')
    }
    
    const clubOwner = accessCheck.rows[0]
    const subscriptionState = resolveSubscriptionState(clubOwner)
    if (!subscriptionState.isActive) {
        redirect('/dashboard')
    }

    const roleAccess = await getEmployeeRoleAccess(clubId)
    if (roleAccess.settings.employee_only) {
        redirect(`/employee/clubs/${clubId}`)
    }

    // Fetch club data for sidebar
    const result = await query(
        'SELECT id, name, address FROM clubs WHERE id = $1',
        [clubId]
    )
    const club = result.rows[0] || null

    return (
        <div className="flex min-h-dvh bg-background flex-col md:h-screen md:flex-row md:overflow-hidden">
            <ClubSidebar clubId={clubId} club={club} />
            
            <div className="md:hidden">
                <MobileNav>
                    <ClubSidebarContent club={club} clubId={clubId} />
                </MobileNav>
            </div>

            <main className="flex-1 overflow-y-auto overflow-x-hidden w-full max-w-full">{children}</main>
        </div>
    )
}
