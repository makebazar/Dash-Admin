import { TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getProducts, getCategories, getSupplies, getInventories, getWarehouses, getClubTasks, getProcurementLists, getSuppliersForSelect, getClubSettings, getSalesAnalytics, getActiveShiftsForClub, getInventoryPageAccess, getShiftZoneOverview } from "./actions"
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
import { InventoryErrorState } from "./_components/InventoryErrorState"
import { cookies } from "next/headers"
import { normalizeInventorySettings } from "@/lib/inventory-settings"
import { PageShell } from "@/components/layout/PageShell"
import { Package } from "lucide-react"

export default async function InventoryPage({ params, searchParams }: { params: Promise<{ clubId: string }>, searchParams: Promise<{ tab?: string, month?: string }> }) {
    const { clubId } = await params
    const { tab, month } = await searchParams
    const userId = (await cookies()).get("session_user_id")?.value

    if (!userId) return <div className="p-8 text-red-500">Доступ запрещен. Пожалуйста, авторизуйтесь.</div>

    const access = await getInventoryPageAccess(clubId)

    if (!access.canManageInventory) {
        return <div className="p-8 text-red-500">Доступ к управлению складом закрыт для вашей роли.</div>
    }

    let products: any[] = []
    let categories: any[] = []
    let supplies: any[] = []
    let inventories: any[] = []
    let warehouses: any[] = []
    let tasks: any[] = []
    let procurementLists: any[] = []
    let suppliers: any[] = []
    let clubSettings: any = null
    let sales: any = null
    let shifts: any[] = []
    let shiftZoneOverview: any = null

    try {
        [products, categories, supplies, inventories, warehouses, tasks, procurementLists, suppliers, clubSettings, sales, shifts, shiftZoneOverview] = await Promise.all([
            getProducts(clubId, { includeArchived: true }),
            getCategories(clubId),
            getSupplies(clubId),
            getInventories(clubId),
            getWarehouses(clubId),
            getClubTasks(clubId),
            getProcurementLists(clubId),
            getSuppliersForSelect(clubId),
            getClubSettings(clubId),
            getSalesAnalytics(clubId),
            getActiveShiftsForClub(clubId),
            getShiftZoneOverview(clubId, month)
        ])
    } catch (error: any) {
        const message = error?.message || "Не удалось загрузить данные склада"
        return <InventoryErrorState clubId={clubId} message={message} />
    }

    const hasAdminPrivileges = access.isFullAccess
    const inventorySettings = normalizeInventorySettings(clubSettings.inventory_settings)
    const isSuppliesEnabled = inventorySettings.supplies_enabled
    const isStockEnabled = inventorySettings.stock_enabled
    const isCashboxEnabled = inventorySettings.cashbox_enabled && Boolean(inventorySettings.cashbox_warehouse_id)
    const isShiftAccountabilityEnabled = inventorySettings.shift_accountability_mode === "WAREHOUSE" && Boolean(inventorySettings.handover_warehouse_id)
    const settingsSubTabs = ["general", "categories", "warehouses", "pricetags"]
    const availableTabs = [
        "stock",
        ...(isCashboxEnabled ? ["sales"] : []),
        "tasks",
        ...(isStockEnabled ? ["transfers"] : []),
        ...(isSuppliesEnabled ? ["supplies"] : []),
        ...(isStockEnabled ? ["procurement"] : []),
        ...(isShiftAccountabilityEnabled ? ["zones"] : []),
        ...(isStockEnabled ? ["inventory"] : []),
        ...(isStockEnabled ? ["abc-analysis"] : []),
        "settings",
    ]
    const requestedTab = tab || "stock"
    const activeTab = availableTabs.includes(requestedTab) || settingsSubTabs.includes(requestedTab)
        ? requestedTab
        : "stock"

    return (
        <PageShell maxWidth="7xl">
            {/* Minimalist Header */}
            <div className="mb-8 md:mb-12">
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900">
                    Инвентарь клуба
                </h1>
                <p className="text-base text-slate-500 mt-3 max-w-2xl">
                    Управление запасами, поставками, перемещениями и контроль товарных остатков.
                </p>
            </div>
            
            <InventoryTabsWrapper activeTab={activeTab}>
                <div className="border-b border-slate-200 mb-6 md:mb-8 overflow-x-auto no-scrollbar">
                    <TabsList className="bg-transparent p-0 h-auto space-x-6 md:space-x-8 w-full justify-start min-w-max flex">
                        <TabsTrigger 
                            value="stock" 
                            className="rounded-none border-b-2 border-transparent text-slate-500 hover:text-slate-800 data-[state=active]:border-black data-[state=active]:text-black data-[state=active]:shadow-none px-1 py-3 bg-transparent font-medium transition-colors"
                        >
                            Товары
                        </TabsTrigger>
                        {isCashboxEnabled && (
                            <TabsTrigger 
                                value="sales" 
                                className="rounded-none border-b-2 border-transparent text-slate-500 hover:text-slate-800 data-[state=active]:border-black data-[state=active]:text-black data-[state=active]:shadow-none px-1 py-3 bg-transparent font-medium transition-colors"
                            >
                                Касса
                            </TabsTrigger>
                        )}
                        <TabsTrigger 
                            value="tasks" 
                            className="rounded-none border-b-2 border-transparent text-slate-500 hover:text-slate-800 data-[state=active]:border-black data-[state=active]:text-black data-[state=active]:shadow-none px-1 py-3 bg-transparent font-medium transition-colors"
                        >
                            Задачи {tasks.length > 0 && <span className="ml-2 bg-slate-100 text-slate-900 px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider">{tasks.length}</span>}
                        </TabsTrigger>
                        {isStockEnabled && (
                            <TabsTrigger 
                                value="transfers" 
                                className="rounded-none border-b-2 border-transparent text-slate-500 hover:text-slate-800 data-[state=active]:border-black data-[state=active]:text-black data-[state=active]:shadow-none px-1 py-3 bg-transparent font-medium transition-colors"
                            >
                                Перемещения
                            </TabsTrigger>
                        )}
                        {isSuppliesEnabled && (
                            <TabsTrigger 
                                value="supplies" 
                                className="rounded-none border-b-2 border-transparent text-slate-500 hover:text-slate-800 data-[state=active]:border-black data-[state=active]:text-black data-[state=active]:shadow-none px-1 py-3 bg-transparent font-medium transition-colors"
                            >
                                Поставки
                            </TabsTrigger>
                        )}
                        {isStockEnabled && (
                            <TabsTrigger 
                                value="procurement" 
                                className="rounded-none border-b-2 border-transparent text-slate-500 hover:text-slate-800 data-[state=active]:border-black data-[state=active]:text-black data-[state=active]:shadow-none px-1 py-3 bg-transparent font-medium transition-colors"
                            >
                                Закупки
                            </TabsTrigger>
                        )}
                        {isShiftAccountabilityEnabled && (
                            <TabsTrigger 
                                value="zones" 
                                className="rounded-none border-b-2 border-transparent text-slate-500 hover:text-slate-800 data-[state=active]:border-black data-[state=active]:text-black data-[state=active]:shadow-none px-1 py-3 bg-transparent font-medium transition-colors"
                            >
                                Передача
                            </TabsTrigger>
                        )}
                        {isStockEnabled && (
                            <TabsTrigger 
                                value="inventory" 
                                className="rounded-none border-b-2 border-transparent text-slate-500 hover:text-slate-800 data-[state=active]:border-black data-[state=active]:text-black data-[state=active]:shadow-none px-1 py-3 bg-transparent font-medium transition-colors"
                            >
                                Инвентаризации
                            </TabsTrigger>
                        )}
                        {isStockEnabled && (
                            <TabsTrigger 
                                value="abc-analysis" 
                                className="rounded-none border-b-2 border-transparent text-slate-500 hover:text-slate-800 data-[state=active]:border-black data-[state=active]:text-black data-[state=active]:shadow-none px-1 py-3 bg-transparent font-medium transition-colors"
                            >
                                Аналитика
                            </TabsTrigger>
                        )}
                        <TabsTrigger 
                            value="settings" 
                            className="rounded-none border-b-2 border-transparent text-slate-500 hover:text-slate-800 data-[state=active]:border-black data-[state=active]:text-black data-[state=active]:shadow-none px-1 py-3 bg-transparent font-medium transition-colors"
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

                {isCashboxEnabled && (
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
                )}
                
                <TabsContent value="tasks" className="mt-0">
                    <TasksTab tasks={tasks} currentUserId={userId} />
                </TabsContent>

                {isStockEnabled && (
                    <TabsContent value="transfers" className="mt-0">
                        <TransfersTab warehouses={warehouses} products={products} currentUserId={userId} />
                    </TabsContent>
                )}
                
                {isSuppliesEnabled && (
                    <TabsContent value="supplies" className="mt-0">
                        <SuppliesTab supplies={supplies} products={products} warehouses={warehouses} suppliers={suppliers} currentUserId={userId} />
                    </TabsContent>
                )}

                {isStockEnabled && (
                    <TabsContent value="procurement" className="mt-0">
                        <ProcurementTab lists={procurementLists} products={products} currentUserId={userId} />
                    </TabsContent>
                )}

                {isShiftAccountabilityEnabled && (
                    <TabsContent value="zones" className="mt-0">
                        <ShiftZonesOverviewTab clubId={clubId} overview={shiftZoneOverview} currentMonth={month} />
                    </TabsContent>
                )}

                {isStockEnabled && (
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
                )}

                {isStockEnabled && (
                    <TabsContent value="abc-analysis" className="mt-0">
                        <AbcAnalysisTab clubId={clubId} products={products} />
                    </TabsContent>
                )}

                <TabsContent value="settings" className="mt-0">
                    <SettingsTab 
                        products={products}
                        categories={categories} 
                        warehouses={warehouses} 
                        currentUserId={userId} 
                        inventorySettings={clubSettings.inventory_settings}
                    />
                </TabsContent>
            </InventoryTabsWrapper>
        </PageShell>
    )
}
