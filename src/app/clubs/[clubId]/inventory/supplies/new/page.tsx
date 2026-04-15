import { getProducts, getWarehouses, getSuppliers, requireClubAccess } from "../../actions"
import { NewSupplyClient } from "./NewSupplyClient"

export default async function NewSupplyPage({ params }: { params: Promise<{ clubId: string }> }) {
    const { clubId } = await params
    const userId = await requireClubAccess(clubId)
    
    const [products, warehouses, suppliers] = await Promise.all([
        getProducts(clubId),
        getWarehouses(clubId),
        getSuppliers(clubId)
    ])

    return <NewSupplyClient 
        clubId={clubId} 
        currentUserId={userId} 
        products={products} 
        warehouses={warehouses} 
        suppliers={suppliers} 
    />
}
