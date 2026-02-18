import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getProducts, getCategories, getSupplies, getInventories } from "./actions"
import { ProductsTab } from "./_components/ProductsTab"
import { SuppliesTab } from "./_components/SuppliesTab"
import { InventoryTab } from "./_components/InventoryTab"
import { cookies } from "next/headers"

export default async function InventoryPage({ params }: { params: Promise<{ clubId: string }> }) {
    const { clubId } = await params
    const userId = (await cookies()).get("session_user_id")?.value

    if (!userId) return <div className="p-8 text-red-500">Доступ запрещен. Пожалуйста, авторизуйтесь.</div>

    const [products, categories, supplies, inventories] = await Promise.all([
        getProducts(clubId),
        getCategories(clubId),
        getSupplies(clubId),
        getInventories(clubId)
    ])

    return (
        <div className="p-8 max-w-[1600px] mx-auto space-y-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">Склад и учет</h1>
                <p className="text-muted-foreground">Управление товарными запасами, поставками и проведение ревизий.</p>
            </div>
            
            <Tabs defaultValue="stock" className="w-full">
                <div className="border-b mb-6">
                    <TabsList className="bg-transparent p-0 h-auto space-x-6">
                        <TabsTrigger 
                            value="stock" 
                            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none px-0 py-3 bg-transparent font-medium"
                        >
                            Товары и остатки
                        </TabsTrigger>
                        <TabsTrigger 
                            value="supplies" 
                            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none px-0 py-3 bg-transparent font-medium"
                        >
                            Поставки
                        </TabsTrigger>
                        <TabsTrigger 
                            value="inventory" 
                            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none px-0 py-3 bg-transparent font-medium"
                        >
                            Инвентаризации
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="stock" className="mt-0">
                    <ProductsTab products={products} categories={categories} />
                </TabsContent>
                
                <TabsContent value="supplies" className="mt-0">
                    <SuppliesTab supplies={supplies} products={products} currentUserId={userId} />
                </TabsContent>

                <TabsContent value="inventory" className="mt-0">
                    <InventoryTab inventories={inventories} currentUserId={userId} />
                </TabsContent>
            </Tabs>
        </div>
    )
}
