import { cn } from "@/lib/utils"
import React from "react"

interface PageShellProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode
    maxWidth?: "full" | "xl" | "2xl" | "3xl" | "4xl" | "5xl" | "6xl" | "7xl"
}

export function PageShell({ children, className, maxWidth = "full", ...props }: PageShellProps) {
    const maxWidthClass = {
        "full": "max-w-full",
        "xl": "max-w-xl",
        "2xl": "max-w-2xl",
        "3xl": "max-w-3xl",
        "4xl": "max-w-4xl",
        "5xl": "max-w-5xl",
        "6xl": "max-w-6xl",
        "7xl": "max-w-7xl",
    }[maxWidth]

    return (
        <div className="flex-1 space-y-8 p-8 pt-6 min-h-screen bg-background">
            <div className={cn("mx-auto space-y-8", maxWidthClass, className)} {...props}>
                {children}
            </div>
        </div>
    )
}

interface PageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
    title: string
    description?: React.ReactNode
    children?: React.ReactNode // For actions on the right
}

export function PageHeader({ title, description, children, className, ...props }: PageHeaderProps) {
    return (
        <div className={cn("flex flex-col gap-4 md:flex-row md:items-center md:justify-between", className)} {...props}>
            <div className="space-y-1.5">
                <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
                {description && (
                    <p className="text-muted-foreground">
                        {description}
                    </p>
                )}
            </div>
            {children && (
                <div className="flex items-center gap-2">
                    {children}
                </div>
            )}
        </div>
    )
}
