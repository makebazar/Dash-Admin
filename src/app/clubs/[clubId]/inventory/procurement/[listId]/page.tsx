import { getProcurementListById, getProcurementListItems, getProducts, requireClubAccess } from "../../actions"
import { ProcurementDetailsClient } from "./ProcurementDetailsClient"
import { notFound } from "next/navigation"

export default async function ProcurementDetailsPage({ params }: { params: Promise<{ clubId: string, listId: string }> }) {
    const clubId = (await params).clubId
    const listId = Number((await params).listId)
    await requireClubAccess(clubId)

    if (isNaN(listId)) {
        notFound()
    }

    const list = await getProcurementListById(clubId, listId)
    if (!list) {
        notFound()
    }

    const items = await getProcurementListItems(clubId, listId)
    const availableProducts = await getProducts(clubId)

    return <ProcurementDetailsClient 
        clubId={clubId} 
        list={list} 
        initialItems={items} 
        availableProducts={availableProducts} 
    />
}
