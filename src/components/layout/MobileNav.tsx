"use client"

import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { useState } from "react"

export function MobileNav({ children }: { children: React.ReactNode }) {
    const [open, setOpen] = useState(false)

    return (
        <div className="flex items-center p-4 border-b md:hidden bg-background sticky top-0 z-40">
            <Sheet open={open} onOpenChange={setOpen}>
                <SheetTrigger asChild>
                    <Button variant="ghost" size="icon">
                        <Menu className="h-6 w-6" />
                    </Button>
                </SheetTrigger>
                <SheetContent side="left" className="p-0 w-80">
                     <div className="h-full" onClick={(e) => {
                         if ((e.target as HTMLElement).closest('a') || (e.target as HTMLElement).closest('button')) {
                             // Allow some time for navigation or action before closing? 
                             // Usually immediate is fine for links. For buttons (like logout), maybe.
                             // But logout redirects anyway.
                             setOpen(false)
                         }
                     }}>
                        {children}
                     </div>
                </SheetContent>
            </Sheet>
            <span className="ml-4 font-semibold text-lg">DashAdmin</span>
        </div>
    )
}
