import { cn } from "@/lib/utils"
import React from "react"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"

// ... (keep PageShell and PageHeader)

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

// --- NEW COMPONENTS ---

interface PageToolbarProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode
}

export function PageToolbar({ children, className, ...props }: PageToolbarProps) {
    return (
        <div className={cn("flex flex-col gap-4 mb-6", className)} {...props}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                {children}
            </div>
            <div className="h-px bg-border/40" />
        </div>
    )
}

interface ToolbarGroupProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode
    align?: "start" | "end"
}

export function ToolbarGroup({ children, className, align = "start", ...props }: ToolbarGroupProps) {
    return (
        <div 
            className={cn(
                "flex flex-wrap items-center gap-2", 
                align === "end" ? "sm:ml-auto" : "",
                className
            )} 
            {...props}
        >
            {children}
        </div>
    )
}

interface SearchInputProps extends React.ComponentProps<typeof Input> {
    placeholder?: string
}

export function SearchInput({ className, ...props }: SearchInputProps) {
    return (
        <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
                type="search"
                className={cn("pl-8 h-9 w-[150px] lg:w-[250px]", className)}
                {...props}
            />
        </div>
    )
}
