import { ClubSidebar, ClubSidebarContent } from "@/components/layout/ClubSidebar"
import { MobileNav } from "@/components/layout/MobileNav"
import { query } from "@/db"

export default async function ClubLayout({
    children,
    params,
}: {
    children: React.ReactNode
    params: Promise<{ clubId: string }>
}) {
    const { clubId } = await params

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
