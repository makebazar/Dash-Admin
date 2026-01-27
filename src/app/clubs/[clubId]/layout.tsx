import { ClubSidebar } from "@/components/layout/ClubSidebar"

export default async function ClubLayout({
    children,
    params,
}: {
    children: React.ReactNode
    params: Promise<{ clubId: string }>
}) {
    const { clubId } = await params

    return (
        <div className="flex h-screen overflow-hidden bg-background">
            <ClubSidebar clubId={clubId} />
            <main className="flex-1 overflow-auto">{children}</main>
        </div>
    )
}
