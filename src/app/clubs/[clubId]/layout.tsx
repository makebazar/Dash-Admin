import { ClubSidebar, ClubSidebarContent } from "@/components/layout/ClubSidebar"
import { MobileNav } from "@/components/layout/MobileNav"
import { query } from "@/db"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { hasColumn } from "@/lib/db-compat"
import { resolveSubscriptionState } from "@/lib/subscriptions"

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
    const subscriptionResult = await query(
        `SELECT 
            subscription_plan,
            ${hasSubscriptionStatus ? 'subscription_status' : "NULL::varchar as subscription_status"},
            subscription_ends_at
         FROM users
         WHERE id = $1`,
        [userId]
    )
    if ((subscriptionResult.rowCount || 0) === 0) {
        redirect('/login')
    }
    const subscriptionState = resolveSubscriptionState(subscriptionResult.rows[0])
    if (!subscriptionState.isActive) {
        redirect('/dashboard')
    }

    // Fetch club data for sidebar
    const result = await query(
        'SELECT id, name FROM clubs WHERE id = $1',
        [clubId]
    )
    const club = result.rows[0] || null

    return (
        <div className="flex h-screen bg-background flex-col md:flex-row overflow-hidden">
            <ClubSidebar clubId={clubId} club={club} />
            
            <div className="md:hidden">
                <MobileNav>
                    <ClubSidebarContent club={club} clubId={clubId} />
                </MobileNav>
            </div>

            <main className="flex-1 overflow-auto w-full max-w-full">{children}</main>
        </div>
    )
}
