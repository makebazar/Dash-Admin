import { getProducts, getWarehouses, getSuppliers, requireClubAccess } from "../../actions"
import { NewSupplyClient } from "./NewSupplyClient"
import { InventoryErrorState } from "../../_components/InventoryErrorState"

export default async function NewSupplyPage({ params }: { params: Promise<{ clubId: string }> }) {
    const { clubId } = await params
    let userId = ""
    try {
        userId = await requireClubAccess(clubId)
    } catch (error: any) {
        const message = error?.message || "Нет доступа к складу"
        return <InventoryErrorState clubId={clubId} message={message} />
    }
    
    let products: any[] = []
    let warehouses: any[] = []
    let suppliers: any[] = []
    try {
        [products, warehouses, suppliers] = await Promise.all([
            getProducts(clubId),
            getWarehouses(clubId),
            getSuppliers(clubId)
        ])
    } catch (error: any) {
        const message = error?.message || "Не удалось загрузить данные для новой поставки"
        return <InventoryErrorState clubId={clubId} message={message} />
    }

    return <NewSupplyClient 
        clubId={clubId} 
        currentUserId={userId} 
        products={products} 
        warehouses={warehouses} 
        suppliers={suppliers} 
    />
}
