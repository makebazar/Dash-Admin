import { TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getProducts, getCategories, getSupplies, getInventories, getWarehouses, getEmployees, getClubTasks, getProcurementLists, getSuppliersForSelect, getClubSettings, getSalesAnalytics, getActiveShiftsForClub, getInventoryPageAccess, getShiftZoneOverview } from "./actions"
import { ProductsTab } from "./_components/ProductsTab"
import { SalesTab } from "./_components/SalesTab"
import { TasksTab } from "./_components/TasksTab"
import { TransfersTab } from "./_components/TransfersTab"
import { SuppliesTab } from "./_components/SuppliesTab"
import { ProcurementTab } from "./_components/ProcurementTab"
import { InventoryTab } from "./_components/InventoryTab"
import { SettingsTab } from "./_components/SettingsTab"
import { AbcAnalysisTab } from "./_components/AbcAnalysisTab"
import { InventoryTabsWrapper } from "./_components/InventoryTabsWrapper"
import { ShiftZonesOverviewTab } from "./_components/ShiftZonesOverviewTab"
import { cookies } from "next/headers"

export default async function InventoryPage({ params, searchParams }: { params: Promise<{ clubId: string }>, searchParams: Promise<{ tab?: string }> }) {
    const { clubId } = await params
    const { tab } = await searchParams
    const userId = (await cookies()).get("session_user_id")?.value

    if (!userId) return <div className="p-8 text-red-500">Доступ запрещен. Пожалуйста, авторизуйтесь.</div>

    const access = await getInventoryPageAccess(clubId)

    if (!access.canManageInventory) {
        return <div className="p-8 text-red-500">Доступ к управлению складом закрыт для вашей роли.</div>
    }

    const [products, categories, supplies, inventories, warehouses, employees, tasks, procurementLists, suppliers, clubSettings, sales, shifts, shiftZoneOverview] = await Promise.all([
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
        getShiftZoneOverview(clubId)
    ])

    const hasAdminPrivileges = access.isFullAccess
    const activeTab = tab || "stock"

    return (
        <div className="p-4 md:p-8 max-w-[1600px] mx-auto space-y-4 md:space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex flex-col gap-1 md:gap-2">
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Склад и учет</h1>
                    <p className="text-sm md:text-base text-muted-foreground">Управление товарными запасами, поставками, складами и проведение ревизий.</p>
                </div>
            </div>
            
            <InventoryTabsWrapper activeTab={activeTab}>
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
                            value="zones" 
                            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none px-0 py-3 bg-transparent font-medium"
                        >
                            Передача
                        </TabsTrigger>
                        <TabsTrigger 
                            value="inventory" 
                            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none px-0 py-3 bg-transparent font-medium"
                        >
                            Инвентаризации
                        </TabsTrigger>
                        <TabsTrigger 
                            value="abc-analysis" 
                            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none px-0 py-3 bg-transparent font-medium"
                        >
                            Аналитика
                        </TabsTrigger>
                        <TabsTrigger 
                            value="settings" 
                            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none px-0 py-3 bg-transparent font-medium"
                        >
                            Настройки
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="stock" className="mt-0">
                    <ProductsTab 
                        products={products} 
                        categories={categories} 
                        warehouses={warehouses} 
                        currentUserId={userId} 
                        priceTagSettings={clubSettings.inventory_settings?.price_tag_settings}
                    />
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

                <TabsContent value="transfers" className="mt-0">
                    <TransfersTab warehouses={warehouses} products={products} currentUserId={userId} />
                </TabsContent>
                
                <TabsContent value="supplies" className="mt-0">
                    <SuppliesTab supplies={supplies} products={products} warehouses={warehouses} suppliers={suppliers} currentUserId={userId} />
                </TabsContent>

                <TabsContent value="procurement" className="mt-0">
                    <ProcurementTab lists={procurementLists} products={products} currentUserId={userId} />
                </TabsContent>

                <TabsContent value="zones" className="mt-0">
                    <ShiftZonesOverviewTab clubId={clubId} overview={shiftZoneOverview} />
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

                <TabsContent value="abc-analysis" className="mt-0">
                    <AbcAnalysisTab clubId={clubId} products={products} />
                </TabsContent>

                <TabsContent value="settings" className="mt-0">
                    <SettingsTab 
                        products={products}
                        categories={categories} 
                        warehouses={warehouses} 
                        employees={employees} 
                        currentUserId={userId} 
                        inventoryRequired={clubSettings.inventory_required}
                        inventorySettings={clubSettings.inventory_settings}
                    />
                </TabsContent>
            </InventoryTabsWrapper>
        </div>
    )
}
