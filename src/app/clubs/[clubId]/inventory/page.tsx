import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getProducts, getCategories, getSupplies, getInventories, getWarehouses, getEmployees, getClubTasks, getProcurementLists, getSuppliersForSelect, getClubSettings, manualTriggerReplenishment, getSalesAnalytics, getActiveShiftsForClub, getUserRoleInClub } from "./actions"
import { ProductsTab } from "./_components/ProductsTab"
import { SalesTab } from "./_components/SalesTab"
import { TasksTab } from "./_components/TasksTab"
import { CategoriesTab } from "./_components/CategoriesTab"
import { WarehousesTab } from "./_components/WarehousesTab"
import { TransfersTab } from "./_components/TransfersTab"
import { SuppliesTab } from "./_components/SuppliesTab"
import { ProcurementTab } from "./_components/ProcurementTab"
import { InventoryTab } from "./_components/InventoryTab"
import { cookies } from "next/headers"
import { Button } from "@/components/ui/button"
import { RefreshCw, ShoppingCart } from "lucide-react"
import { revalidatePath } from "next/cache"

export default async function InventoryPage({ params }: { params: Promise<{ clubId: string }> }) {
    const { clubId } = await params
    const userId = (await cookies()).get("session_user_id")?.value

    if (!userId) return <div className="p-8 text-red-500">Доступ запрещен. Пожалуйста, авторизуйтесь.</div>

    const handleManualTrigger = async () => {
        "use server"
        await manualTriggerReplenishment(clubId)
        revalidatePath(`/clubs/${clubId}/inventory`)
    }

    const [products, categories, supplies, inventories, warehouses, employees, tasks, procurementLists, suppliers, clubSettings, sales, shifts, userRole] = await Promise.all([
        getProducts(clubId),
        getCategories(clubId),
        getSupplies(clubId),
        getInventories(clubId),
        getWarehouses(clubId),
        getEmployees(clubId),
        getClubTasks(clubId),
        getProcurementLists(clubId),
        getSuppliersForSelect(clubId),
        getClubSettings(clubId),
        getSalesAnalytics(clubId),
        getActiveShiftsForClub(clubId),
        getUserRoleInClub(clubId, userId)
    ])

    const isOwner = clubSettings.owner_id === userId
    const isManager = userRole?.toLowerCase() === 'управляющий'
    const hasAdminPrivileges = isOwner || isManager

    return (
        <div className="p-4 md:p-8 max-w-[1600px] mx-auto space-y-4 md:space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex flex-col gap-1 md:gap-2">
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Склад и учет</h1>
                    <p className="text-sm md:text-base text-muted-foreground">Управление товарными запасами, поставками, складами и проведение ревизий.</p>
                </div>
                <form action={handleManualTrigger}>
                    <Button variant="outline" className="gap-2">
                        <RefreshCw className="h-4 w-4" />
                        Проверить остатки
                    </Button>
                </form>
            </div>
            
            <Tabs defaultValue="stock" className="w-full">
                <div className="border-b mb-4 md:mb-6 overflow-x-auto no-scrollbar">
                    <TabsList className="bg-transparent p-0 h-auto space-x-4 md:space-x-6 w-full justify-start min-w-max flex">
                        <TabsTrigger 
                            value="stock" 
                            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none px-0 py-3 bg-transparent font-medium"
                        >
                            Товары
                        </TabsTrigger>
                        <TabsTrigger 
                            value="sales" 
                            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none px-0 py-3 bg-transparent font-medium"
                        >
                            Продажи
                        </TabsTrigger>
                        <TabsTrigger 
                            value="tasks" 
                            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none px-0 py-3 bg-transparent font-medium"
                        >
                            Задачи {tasks.length > 0 && <span className="ml-2 bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full text-xs font-bold">{tasks.length}</span>}
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
                            value="transfers" 
                            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none px-0 py-3 bg-transparent font-medium"
                        >
                            Перемещения
                        </TabsTrigger>
                        <TabsTrigger 
                            value="supplies" 
                            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none px-0 py-3 bg-transparent font-medium"
                        >
                            Поставки
                        </TabsTrigger>
                        <TabsTrigger 
                            value="procurement" 
                            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none px-0 py-3 bg-transparent font-medium"
                        >
                            Закупки
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
                    <ProductsTab products={products} categories={categories} warehouses={warehouses} currentUserId={userId} />
                </TabsContent>

                <TabsContent value="sales" className="mt-0">
                    <SalesTab 
                        sales={sales} 
                        shifts={shifts} 
                        clubId={clubId} 
                        warehouses={warehouses} 
                        products={products}
                        currentUserId={userId}
                    />
                </TabsContent>
                
                <TabsContent value="tasks" className="mt-0">
                    <TasksTab tasks={tasks} currentUserId={userId} />
                </TabsContent>

                <TabsContent value="categories" className="mt-0">
                    <CategoriesTab categories={categories} currentUserId={userId} />
                </TabsContent>

                <TabsContent value="warehouses" className="mt-0">
                    <WarehousesTab warehouses={warehouses} employees={employees} currentUserId={userId} />
                </TabsContent>
                
                <TabsContent value="transfers" className="mt-0">
                    <TransfersTab warehouses={warehouses} products={products} currentUserId={userId} />
                </TabsContent>
                
                <TabsContent value="supplies" className="mt-0">
                    <SuppliesTab supplies={supplies} products={products} warehouses={warehouses} suppliers={suppliers} currentUserId={userId} />
                </TabsContent>

                <TabsContent value="procurement" className="mt-0">
                    <ProcurementTab lists={procurementLists} currentUserId={userId} />
                </TabsContent>

                <TabsContent value="inventory" className="mt-0">
                    <InventoryTab 
                        inventories={inventories} 
                        categories={categories} 
                        warehouses={warehouses}
                        currentUserId={userId} 
                        isOwner={hasAdminPrivileges}
                        inventorySettings={clubSettings.inventory_settings}
                    />
                </TabsContent>
            </Tabs>
        </div>
    )
}
