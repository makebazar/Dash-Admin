import { PageShell, PageHeader } from "@/components/layout/PageShell"
import { cookies } from "next/headers"
import { TournamentsClient } from "./_components/TournamentsClient"

export default async function TournamentsPage({ params }: { params: Promise<{ clubId: string }> }) {
    const { clubId } = await params
    const userId = (await cookies()).get("session_user_id")?.value

    if (!userId) {
        return (
            <div className="dark">
                <PageShell maxWidth="6xl">
                    <PageHeader title="Турниры" description="Доступ запрещён. Пожалуйста, авторизуйтесь." />
                </PageShell>
            </div>
        )
    }

    return (
        <div className="dark">
            <PageShell maxWidth="6xl">
                <PageHeader
                    title="Турниры"
                    description="Создание локальных турниров, регистрация, матчи, чат и учёт призового фонда."
                />
                <TournamentsClient clubId={clubId} />
            </PageShell>
        </div>
    )
}
