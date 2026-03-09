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
        if (['categories', 'warehouses', 'pricetags'].includes(tab)) return 'settings'
        return tab
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
