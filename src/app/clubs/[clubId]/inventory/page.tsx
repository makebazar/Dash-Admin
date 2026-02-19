import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getProducts, getCategories, getSupplies, getInventories, getWarehouses, getEmployees } from "./actions"
import { ProductsTab } from "./_components/ProductsTab"
import { SuppliesTab } from "./_components/SuppliesTab"
import { InventoryTab } from "./_components/InventoryTab"
import { CategoriesTab } from "./_components/CategoriesTab"
import { WarehousesTab } from "./_components/WarehousesTab"
import { cookies } from "next/headers"

export default async function InventoryPage({ params }: { params: Promise<{ clubId: string }> }) {
    const { clubId } = await params
    const userId = (await cookies()).get("session_user_id")?.value

    if (!userId) return <div className="p-8 text-red-500">Доступ запрещен. Пожалуйста, авторизуйтесь.</div>

    const [products, categories, supplies, inventories, warehouses, employees] = await Promise.all([
        getProducts(clubId),
        getCategories(clubId),
        getSupplies(clubId),
        getInventories(clubId),
        getWarehouses(clubId),
        getEmployees(clubId)
    ])

    return (
        <div className="p-8 max-w-[1600px] mx-auto space-y-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">Склад и учет</h1>
                <p className="text-muted-foreground">Управление товарными запасами, поставками, складами и проведение ревизий.</p>
            </div>
            
            <Tabs defaultValue="stock" className="w-full">
                <div className="border-b mb-6 overflow-x-auto">
                    <TabsList className="bg-transparent p-0 h-auto space-x-6 w-full justify-start">
                        <TabsTrigger 
                            value="stock" 
                            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none px-0 py-3 bg-transparent font-medium"
                        >
                            Товары
                        </TabsTrigger>
                        <TabsTrigger 
                            value="categories" 
                            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none px-0 py-3 bg-transparent font-medium"
                        >
                            Категории
                        </TabsTrigger>
                        <TabsTrigger 
                            value="warehouses" 
                            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none px-0 py-3 bg-transparent font-medium"
                        >
                            Склады
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

                <TabsContent value="categories" className="mt-0">
                    <CategoriesTab categories={categories} currentUserId={userId} />
                </TabsContent>

                <TabsContent value="warehouses" className="mt-0">
                    <WarehousesTab warehouses={warehouses} employees={employees} currentUserId={userId} />
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
