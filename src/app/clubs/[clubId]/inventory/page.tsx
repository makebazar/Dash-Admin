import { TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getProducts, getCategories, getSupplies, getInventories, getWarehouses, getClubTasks, getProcurementLists, getSuppliersForSelect, getClubSettings, getSalesAnalytics, getActiveShiftsForClub, getInventoryPageAccess, getShiftZoneOverview, getCombos } from "./actions"
import { ProductsTab } from "./_components/ProductsTab"
import { CombosTab } from "./_components/CombosTab"
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
    const displayMonth = month || (() => {
        const now = new Date()
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    })()
    const userId = (await cookies()).get("session_user_id")?.value

    if (!userId) return <div className="p-8 text-red-500">Доступ запрещен. Пожалуйста, авторизуйтесь.</div>

    const access = await getInventoryPageAccess(clubId)

    if (!access.canManageInventory) {
        return <div className="p-8 text-red-500">Доступ к управлению складом закрыт для вашей роли.</div>
    }

    let clubSettings: any = null
    try {
        clubSettings = await getClubSettings(clubId)
    } catch (error: any) {
        const message = error?.message || "Не удалось загрузить настройки склада"
        return <InventoryErrorState clubId={clubId} message={message} />
    }

    const hasAdminPrivileges = access.isFullAccess
    const inventorySettings = normalizeInventorySettings(clubSettings?.inventory_settings)
    const isSuppliesEnabled = inventorySettings.supplies_enabled
    const isStockEnabled = inventorySettings.stock_enabled
    const isCashboxEnabled = (inventorySettings.cashbox_enabled && (inventorySettings.cashbox_warehouse_ids || []).length > 0) || Boolean(inventorySettings.smartshell_integration_enabled)
    const isShiftAccountabilityEnabled = inventorySettings.shift_accountability_mode === "WAREHOUSE"
    const settingsSubTabs = ["general", "categories", "warehouses", "pricetags", "suppliers"]
    const availableTabs = [
        "stock",
        "combos",
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
    const isSettingsSubTab = settingsSubTabs.includes(requestedTab)
    const activeTab = availableTabs.includes(requestedTab) || isSettingsSubTab
        ? (isSettingsSubTab ? "settings" : requestedTab)
        : "stock"

    let products: any[] = []
    let combos: any[] = []
    let categories: any[] = []
    let supplies: any[] = []
    let inventories: any[] = []
    let warehouses: any[] = []
    let tasks: any[] = []
    let procurementLists: any[] = []
    let suppliers: any[] = []
    let sales: any[] = []
    let shifts: any[] = []
    let shiftZoneOverview: any = null

    try {
        if (inventorySettings.smartshell_integration_enabled) {
            try {
                const { syncSmartShellShifts } = await import("@/lib/smartshell/shift-sync");
                await syncSmartShellShifts(clubId);
            } catch (syncErr) {
                console.error("SmartShell shift & payments sync error:", syncErr);
            }
        }

        const fetchProducts = ["stock", "combos", "sales", "transfers", "supplies", "procurement", "abc-analysis", "settings"].includes(activeTab)
        const fetchCombos = activeTab === "combos"
        const fetchCategories = ["stock", "inventory", "settings"].includes(activeTab)
        const fetchWarehouses = ["stock", "sales", "transfers", "supplies", "inventory", "settings"].includes(activeTab)
        const fetchSales = activeTab === "sales"
        const fetchTasks = true
        const fetchSupplies = activeTab === "supplies"
        const fetchProcurement = activeTab === "procurement"
        const fetchZones = activeTab === "zones"
        const fetchInventory = activeTab === "inventory"

        const results = await Promise.all([
            fetchProducts ? getProducts(clubId, { includeArchived: true }) : Promise.resolve([]),
            fetchCategories ? getCategories(clubId) : Promise.resolve([]),
            fetchWarehouses ? getWarehouses(clubId) : Promise.resolve([]),
            fetchTasks ? getClubTasks(clubId) : Promise.resolve([]),
            fetchSupplies ? getSupplies(clubId) : Promise.resolve([]),
            fetchSupplies ? getSuppliersForSelect(clubId) : Promise.resolve([]),
            fetchInventory ? getInventories(clubId) : Promise.resolve([]),
            fetchProcurement ? getProcurementLists(clubId) : Promise.resolve([]),
            fetchSales ? getSalesAnalytics(clubId, 500, displayMonth) : Promise.resolve(null),
            fetchSales ? getActiveShiftsForClub(clubId) : Promise.resolve([]),
            fetchZones ? getShiftZoneOverview(clubId, displayMonth) : Promise.resolve(null),
            fetchCombos ? getCombos(clubId) : Promise.resolve([])
        ])

        products = Array.isArray(results[0]) ? results[0] : []
        categories = Array.isArray(results[1]) ? results[1] : []
        warehouses = Array.isArray(results[2]) ? results[2] : []
        tasks = Array.isArray(results[3]) ? results[3] : []
        supplies = Array.isArray(results[4]) ? results[4] : []
        suppliers = Array.isArray(results[5]) ? results[5] : []
        inventories = Array.isArray(results[6]) ? results[6] : []
        procurementLists = Array.isArray(results[7]) ? results[7] : []
        sales = Array.isArray(results[8]) ? results[8] : []
        shifts = Array.isArray(results[9]) ? results[9] : []
        shiftZoneOverview = results[10]
        combos = Array.isArray(results[11]) ? results[11] : []
        suppliers = Array.isArray(results[5]) ? results[5] : []
        inventories = Array.isArray(results[6]) ? results[6] : []
        procurementLists = Array.isArray(results[7]) ? results[7] : []
        sales = Array.isArray(results[8]) ? results[8] : []
        shifts = Array.isArray(results[9]) ? results[9] : []
        shiftZoneOverview = results[10]
    } catch (error: any) {
        const message = error?.message || "Не удалось загрузить данные склада"
        return <InventoryErrorState clubId={clubId} message={message} />
    }

    return (
        <PageShell maxWidth="7xl">
            <div className="mb-6">
                <h1 className="text-3xl font-black tracking-tight text-slate-900">
                    Инвентарь клуба
                </h1>
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
                        <TabsTrigger 
                            value="combos" 
                            className="rounded-none border-b-2 border-transparent text-slate-500 hover:text-slate-800 data-[state=active]:border-black data-[state=active]:text-black data-[state=active]:shadow-none px-1 py-3 bg-transparent font-medium transition-colors"
                        >
                            Комбо {(combos?.length || 0) > 0 && <span className="ml-2 bg-slate-100 text-slate-900 px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider">{combos.length}</span>}
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
                            Задачи {(tasks?.length || 0) > 0 && <span className="ml-2 bg-slate-100 text-slate-900 px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider">{tasks.length}</span>}
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

                <TabsContent value="combos" className="mt-0">
                    <CombosTab 
                        clubId={clubId}
                        combos={combos}
                        products={products}
                        smartshellEnabled={Boolean(inventorySettings.smartshell_integration_enabled)}
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
                            inventorySettings={inventorySettings}
                            currentMonth={displayMonth}
                        />
                    </TabsContent>
                )}
                
                <TabsContent value="tasks" className="mt-0">
                    <TasksTab tasks={tasks} currentUserId={userId} />
                </TabsContent>

                {isStockEnabled && (
                    <TabsContent value="transfers" className="mt-0">
                        <TransfersTab warehouses={warehouses} products={products} currentUserId={userId} isFullAccess={hasAdminPrivileges} inventorySettings={clubSettings.inventory_settings} />
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
