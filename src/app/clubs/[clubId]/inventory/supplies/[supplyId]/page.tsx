import { getSupplyById, getSupplyItems } from "../../actions"
import { SupplyDetailsClient } from "./SupplyDetailsClient"
import { notFound } from "next/navigation"
import { InventoryErrorState } from "../../_components/InventoryErrorState"

export default async function SupplyDetailsPage({ params }: { params: Promise<{ clubId: string, supplyId: string }> }) {
    const p = await params
    const clubId = p.clubId
    const supplyId = Number(p.supplyId)
    
    if (isNaN(supplyId)) {
        notFound()
    }

    let supply: any = null
    let items: any[] = []
    try {
        supply = await getSupplyById(clubId, supplyId)
        if (!supply) {
            notFound()
        }
        items = await getSupplyItems(clubId, supplyId)
    } catch (error: any) {
        const message = error?.message || "Не удалось загрузить поставку"
        return <InventoryErrorState clubId={clubId} title="Ошибка поставки" message={message} />
    }

    return <SupplyDetailsClient clubId={clubId} supply={supply} items={items} />
}
