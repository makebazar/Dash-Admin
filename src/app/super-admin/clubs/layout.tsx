"use client"

import React, { useMemo, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Loader2, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { ClubsDirectoryProvider, useClubsDirectory } from "./directory-context"
import { SuperAdminPage } from "../_components/page-shell"

export default function SuperAdminClubsLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClubsDirectoryProvider>
      <ClubsShell>{children}</ClubsShell>
    </ClubsDirectoryProvider>
  )
}

function ClubsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { clubs, isLoading, error } = useClubsDirectory()
  const [search, setSearch] = useState("")

  const filteredClubs = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return clubs
    return clubs.filter(club => {
      if (club.name.toLowerCase().includes(q)) return true
      if ((club.address || "").toLowerCase().includes(q)) return true
      if (club.owners?.some(o => (o.full_name || "").toLowerCase().includes(q))) return true
      if (club.employees?.some(e => (e.full_name || "").toLowerCase().includes(q))) return true
      return false
    })
  }, [clubs, search])

  return (
    <SuperAdminPage
      title="Клубы"
      description="Список и карточка клуба (владельцы, команда)"
      actions={
        <div className="w-full max-w-[520px]">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск: клуб, адрес, владелец, сотрудник"
              className="pl-10 bg-zinc-950/40 border-zinc-800 text-white placeholder:text-zinc-500"
            />
          </div>
        </div>
      }
      className="py-6"
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_1fr]">
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/30">
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
            <div className="text-sm font-medium text-zinc-200">Все клубы</div>
            <Badge variant="outline" className="border-zinc-700 text-zinc-300">
              {clubs.length}
            </Badge>
          </div>

          <div className="max-h-[72vh] overflow-auto p-2">
            {isLoading ? (
              <div className="flex h-44 items-center justify-center text-zinc-500">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : error ? (
              <div className="m-2 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>
            ) : filteredClubs.length === 0 ? (
              <div className="py-10 text-center text-sm text-zinc-500">Ничего не найдено</div>
            ) : (
              <div className="space-y-1">
                {filteredClubs.map(club => {
                  const href = `/super-admin/clubs/${club.id}`
                  const active = pathname === href
                  const owners = Array.isArray(club.owners) ? club.owners : []
                  const primary = owners.find(o => o.is_primary) || owners[0] || null
                  const ownersLabel = primary ? primary.full_name : "Владельцы не указаны"
                  const ownersExtra = Math.max(0, owners.length - (primary ? 1 : 0))

                  return (
                    <Link
                      key={club.id}
                      href={href}
                      className={cn(
                        "group relative block rounded-xl px-4 py-3 transition-colors",
                        active ? "bg-zinc-950/80" : "hover:bg-zinc-950/50"
                      )}
                    >
                      {active ? <div className="absolute left-1 top-3 bottom-3 w-[2px] rounded-full bg-red-500/70" /> : null}

                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                          <div className="truncate text-sm font-medium text-white">{club.name}</div>
                          <div className="truncate text-xs text-zinc-500">{club.address || "—"}</div>
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="truncate text-xs text-zinc-400">{ownersLabel}</div>
                            {ownersExtra > 0 ? (
                              <span className="shrink-0 rounded-full border border-zinc-700 bg-zinc-950/60 px-2 py-0.5 text-[11px] text-zinc-300">
                                +{ownersExtra}
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-2">
                          <span className="rounded-full border border-zinc-700 bg-zinc-950/60 px-2 py-0.5 text-[11px] text-zinc-300">
                            {club.employees?.length ?? 0}
                          </span>
                          <div className="text-[11px] text-zinc-600">ID: {club.public_id || club.id}</div>
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/20">
          {children}
        </section>
      </div>
    </SuperAdminPage>
  )
}
