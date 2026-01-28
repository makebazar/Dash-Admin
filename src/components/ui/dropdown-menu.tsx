"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

const DropdownMenu = ({ children }: { children: React.ReactNode }) => {
    return <div className="relative inline-block text-left">{children}</div>
}

const DropdownMenuTrigger = ({ children, asChild }: { children: React.ReactNode, asChild?: boolean }) => {
    return <div className="cursor-pointer">{children}</div>
}

const DropdownMenuContent = ({ children, align = "end", className }: { children: React.ReactNode, align?: "start" | "end", className?: string }) => {
    return (
        <div className={cn(
            "absolute z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-80 select-none",
            align === "end" ? "right-0" : "left-0",
            "mt-2 origin-top-right",
            className
        )}>
            {children}
        </div>
    )
}

const DropdownMenuItem = ({ children, onClick, className }: { children: React.ReactNode, onClick?: () => void, className?: string }) => {
    return (
        <div
            onClick={onClick}
            className={cn(
                "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                className
            )}
        >
            {children}
        </div>
    )
}

const DropdownMenuLabel = ({ children, className }: { children: React.ReactNode, className?: string }) => {
    return <div className={cn("px-2 py-1.5 text-sm font-semibold", className)}>{children}</div>
}

const DropdownMenuSeparator = ({ className }: { className?: string }) => {
    return <div className={cn("-mx-1 my-1 h-px bg-muted", className)} />
}

export {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
}
