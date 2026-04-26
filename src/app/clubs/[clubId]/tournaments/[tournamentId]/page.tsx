import { PageShell } from "@/components/layout/PageShell"
import { cookies } from "next/headers"
import { TournamentWorkspace } from "../_components/TournamentWorkspace"

export default async function TournamentPage({
    params,
}: {
    params: Promise<{ clubId: string; tournamentId: string }>
}) {
    const { clubId, tournamentId } = await params
    const userId = (await cookies()).get("session_user_id")?.value

    if (!userId) {
        return (
            <div className="dark">
                <PageShell maxWidth="7xl">
                    <div className="p-8 text-red-500">Доступ запрещён. Пожалуйста, авторизуйтесь.</div>
                </PageShell>
            </div>
        )
    }

    return (
        <div className="dark">
            <PageShell maxWidth="7xl">
                <TournamentWorkspace clubId={clubId} tournamentId={tournamentId} />
            </PageShell>
        </div>
    )
}
