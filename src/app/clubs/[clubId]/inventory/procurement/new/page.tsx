import { requireClubAccess } from "../../actions"
import { NewProcurementClient } from "./NewProcurementClient"
import { InventoryErrorState } from "../../_components/InventoryErrorState"

export default async function NewProcurementPage({ params }: { params: Promise<{ clubId: string }> }) {
    const { clubId } = await params
    let userId = ""
    try {
        userId = await requireClubAccess(clubId)
    } catch (error: any) {
        const message = error?.message || "Нет доступа к складу"
        return <InventoryErrorState clubId={clubId} message={message} />
    }

    return <NewProcurementClient clubId={clubId} currentUserId={userId} />
}
