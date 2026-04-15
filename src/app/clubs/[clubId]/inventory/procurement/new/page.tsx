import { requireClubAccess } from "../../actions"
import { NewProcurementClient } from "./NewProcurementClient"

export default async function NewProcurementPage({ params }: { params: Promise<{ clubId: string }> }) {
    const { clubId } = await params
    const userId = await requireClubAccess(clubId)

    return <NewProcurementClient clubId={clubId} currentUserId={userId} />
}
