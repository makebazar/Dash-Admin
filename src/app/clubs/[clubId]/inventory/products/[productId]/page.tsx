import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { getProduct, getCategories, getWarehouses, getProductHistory, getReplenishmentRulesForProduct, getClubSettings } from "../../actions"
import { ProductDetailsClient } from "./ProductDetailsClient"

export default async function ProductDetailPage({ params }: { params: Promise<{ clubId: string, productId: string }> }) {
    const { clubId, productId } = await params
    const userId = (await cookies()).get("session_user_id")?.value
    if (!userId) redirect("/login")

    const isNew = productId === "new"
    
    let product = null
    let history = []
    let rules: any[] = []
    
    if (!isNew) {
        product = await getProduct(clubId, Number(productId))
        if (!product) {
            return <div className="p-8 text-red-500">Товар не найден или нет доступа.</div>
        }
        history = await getProductHistory(clubId, Number(productId))
        rules = await getReplenishmentRulesForProduct(clubId, Number(productId))
    }

    const [categories, warehouses, clubSettings] = await Promise.all([
        getCategories(clubId),
        getWarehouses(clubId),
        getClubSettings(clubId)
    ])

    return (
        <ProductDetailsClient 
            clubId={clubId} 
            userId={userId} 
            initialProduct={product} 
            isNew={isNew}
            categories={categories}
            warehouses={warehouses}
            history={history}
            rules={rules}
            clubSettings={clubSettings}
        />
    )
}
