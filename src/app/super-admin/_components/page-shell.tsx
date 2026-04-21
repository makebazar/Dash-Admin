"use client"

import React from "react"
import { cn } from "@/lib/utils"

export function SuperAdminPage({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("px-8 py-8", className)}>
      <div className="mx-auto w-full max-w-[1280px]">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-6">
          <div className="space-y-1">
            <div className="text-2xl font-semibold tracking-tight text-white">{title}</div>
            {description ? <div className="text-sm text-zinc-400">{description}</div> : null}
          </div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </div>

        {children}
      </div>
    </div>
  )
}

