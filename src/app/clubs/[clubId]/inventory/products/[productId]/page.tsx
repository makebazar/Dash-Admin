import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { getProduct, getCategories, getWarehouses, getProductHistory, getReplenishmentRulesForProduct, getClubSettings, getProductDeletionStatus } from "../../actions"
import { ProductDetailsClient } from "./ProductDetailsClient"
import { InventoryErrorState } from "../../_components/InventoryErrorState"

export default async function ProductDetailPage({ params }: { params: Promise<{ clubId: string, productId: string }> }) {
    const { clubId, productId } = await params
    const userId = (await cookies()).get("session_user_id")?.value
    if (!userId) redirect("/login")

    const isNew = productId === "new"
    
    let product = null
    let history = []
    let rules: any[] = []
    let deletionStatus: any = null
    let missingProduct = false
    
    try {
        if (!isNew) {
            product = await getProduct(clubId, Number(productId))
            if (!product) {
                missingProduct = true
            } else {
                history = await getProductHistory(clubId, Number(productId))
                rules = await getReplenishmentRulesForProduct(clubId, Number(productId))
                deletionStatus = await getProductDeletionStatus(clubId, Number(productId))
            }
        }
    } catch (error: any) {
        const message = error?.message || "Не удалось загрузить данные товара"
        return <InventoryErrorState clubId={clubId} title="Ошибка товара" message={message} />
    }

    if (!isNew && missingProduct) {
        return <div className="p-8 text-red-500">Товар не найден или нет доступа.</div>
    }

    let categories: any[] = []
    let warehouses: any[] = []
    let clubSettings: any = null

    try {
        [categories, warehouses, clubSettings] = await Promise.all([
            getCategories(clubId),
            getWarehouses(clubId),
            getClubSettings(clubId)
        ])
    } catch (error: any) {
        const message = error?.message || "Не удалось загрузить справочники склада"
        return <InventoryErrorState clubId={clubId} message={message} />
    }

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
            deletionStatus={deletionStatus}
        />
    )
}
