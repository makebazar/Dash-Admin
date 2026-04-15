import { getSupplyById, getSupplyItems } from "../../actions"
import { SupplyDetailsClient } from "./SupplyDetailsClient"
import { notFound } from "next/navigation"

export default async function SupplyDetailsPage({ params }: { params: Promise<{ clubId: string, supplyId: string }> }) {
    const p = await params
    const clubId = p.clubId
    const supplyId = Number(p.supplyId)
    
    if (isNaN(supplyId)) {
        notFound()
    }

    const supply = await getSupplyById(clubId, supplyId)
    if (!supply) {
        notFound()
    }

    const items = await getSupplyItems(clubId, supplyId)

    return <SupplyDetailsClient clubId={clubId} supply={supply} items={items} />
}
