import { getProcurementListById, getProcurementListItems, getProducts, requireClubAccess } from "../../actions"
import { ProcurementDetailsClient } from "./ProcurementDetailsClient"
import { notFound } from "next/navigation"
import { InventoryErrorState } from "../../_components/InventoryErrorState"

export default async function ProcurementDetailsPage({ params }: { params: Promise<{ clubId: string, listId: string }> }) {
    const clubId = (await params).clubId
    const listId = Number((await params).listId)
    try {
        await requireClubAccess(clubId)
    } catch (error: any) {
        const message = error?.message || "Нет доступа к складу"
        return <InventoryErrorState clubId={clubId} message={message} />
    }

    if (isNaN(listId)) {
        notFound()
    }

    let list: any = null
    let items: any[] = []
    let availableProducts: any[] = []
    try {
        list = await getProcurementListById(clubId, listId)
        if (!list) {
            notFound()
        }
        items = await getProcurementListItems(clubId, listId)
        availableProducts = await getProducts(clubId)
    } catch (error: any) {
        const message = error?.message || "Не удалось загрузить список закупки"
        return <InventoryErrorState clubId={clubId} title="Ошибка закупки" message={message} />
    }

    return <ProcurementDetailsClient 
        clubId={clubId} 
        list={list} 
        initialItems={items} 
        availableProducts={availableProducts} 
    />
}
