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
        <div className="flex min-h-screen bg-background">
            <ClubSidebar clubId={clubId} />
            <main className="ml-64 flex-1">{children}</main>
        </div>
    )
}
