"use client"

import { Tabs } from "@/components/ui/tabs"
import { useRouter } from "next/navigation"

export function InventoryTabsWrapper({ 
    children, 
    activeTab 
}: { 
    children: React.ReactNode, 
    activeTab: string 
}) {
    const router = useRouter()
    
    // Map sub-tabs to their parent tab for the top-level navigation
    const getTopLevelTab = (tab: string) => {
        const topLevelTabs = [
            "stock",
            "sales",
            "tasks",
            "transfers",
            "supplies",
            "procurement",
            "zones",
            "inventory",
            "abc-analysis",
            "settings"
        ]

        const settingsSubTabs = ["general", "categories", "warehouses", "pricetags"]

        if (settingsSubTabs.includes(tab)) return "settings"
        if (topLevelTabs.includes(tab)) return tab
        return "stock"
    }
    
    return (
        <Tabs 
            value={getTopLevelTab(activeTab)} 
            onValueChange={(val) => {
                const url = new URL(window.location.href)
                url.searchParams.set("tab", val)
                router.push(url.pathname + url.search, { scroll: false })
            }} 
            className="w-full"
        >
            {children}
        </Tabs>
    )
}
