"use client"

import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Crown, Users } from "lucide-react"
import { useMemo } from "react"
import { useClubsDirectory } from "../directory-context"

export default function SuperAdminClubDetailsPage({ params }: { params: { clubId: string } }) {
  const { clubs, isLoading } = useClubsDirectory()
  const clubId = Number(params.clubId)

  const club = useMemo(() => clubs.find(c => c.id === clubId) || null, [clubs, clubId])

  if (isLoading) {
    return <div className="p-6 text-sm text-zinc-500">Загрузка…</div>
  }

  if (!club) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-10 text-center text-sm text-zinc-500">
          Клуб не найден
        </div>
      </div>
    )
  }

  const primaryOwner = (club.owners || []).find(o => o.is_primary) || null
  const secondaryOwners = (club.owners || []).filter(o => !o.is_primary)

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-2xl font-semibold tracking-tight text-white">{club.name}</h2>
            <span className="rounded-full border border-zinc-800 bg-zinc-950/40 px-2.5 py-1 text-[11px] text-zinc-300">
              ID: {club.public_id || club.id}
            </span>
          </div>
          <div className="text-sm text-zinc-400">{club.address || "—"}</div>
          <div className="text-xs text-zinc-500">Создан: {new Date(club.created_at).toLocaleDateString("ru-RU")}</div>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-full border border-zinc-800 bg-zinc-950/40 px-2.5 py-1 text-[11px] text-zinc-300">
            владельцев: {(club.owners || []).length}
          </span>
          <span className="rounded-full border border-zinc-800 bg-zinc-950/40 px-2.5 py-1 text-[11px] text-zinc-300">
            сотрудников: {club.employees?.length ?? 0}
          </span>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[360px_1fr]">
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-zinc-200">
              <Crown className="h-4 w-4 text-amber-300" />
              Владельцы
            </div>
            <span className="text-xs text-zinc-500">основной + совладельцы</span>
          </div>

          <div className="mt-4 space-y-2">
            {primaryOwner ? (
              <PersonRow name={primaryOwner.full_name} meta={primaryOwner.phone_number} badge="Основной" tone="amber" />
            ) : (
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 px-4 py-3 text-sm text-zinc-500">
                Не указан основной владелец
              </div>
            )}

            {secondaryOwners.length ? (
              <div className="pt-2 space-y-2">
                {secondaryOwners.map(owner => (
                  <PersonRow key={owner.id} name={owner.full_name} meta={owner.phone_number} />
                ))}
              </div>
            ) : null}
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/20 overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-zinc-200">
              <Users className="h-4 w-4 text-zinc-300" />
              Сотрудники
            </div>
            <Badge variant="outline" className="border-zinc-700 text-zinc-300">
              {club.employees?.length ?? 0}
            </Badge>
          </div>

          {(club.employees?.length ?? 0) === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-zinc-500">Сотрудников нет</div>
          ) : (
            <Table>
              <TableHeader className="bg-zinc-950/30">
                <TableRow className="border-zinc-800 hover:bg-transparent">
                  <TableHead className="text-zinc-500">Участник</TableHead>
                  <TableHead className="text-zinc-500">Роль</TableHead>
                  <TableHead className="text-zinc-500">Добавлен</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {club.employees.map(employee => (
                  <TableRow key={employee.id} className="border-zinc-800">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <InitialsChip name={employee.full_name} />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-white">{employee.full_name}</div>
                          <div className="truncate text-xs text-zinc-500">{employee.phone_number}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={roleBadgeClass(employee.role)}>
                        {employee.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-zinc-400 text-sm">
                      {new Date(employee.hired_at).toLocaleDateString("ru-RU")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>
      </div>
    </div>
  )
}

function roleBadgeClass(role: string) {
  const r = (role || "").toLowerCase()
  if (r.includes("владел")) return "border-amber-500/40 text-amber-200 bg-amber-500/5"
  if (r.includes("управ")) return "border-sky-500/40 text-sky-200 bg-sky-500/5"
  if (r.includes("админ")) return "border-red-500/40 text-red-200 bg-red-500/5"
  return "border-zinc-700 text-zinc-200 bg-zinc-950/40"
}

function getInitials(name: string) {
  const parts = (name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  const a = parts[0]?.[0] || "?"
  const b = parts[1]?.[0] || ""
  return (a + b).toUpperCase()
}

function InitialsChip({ name }: { name: string }) {
  return (
    <div className="h-9 w-9 rounded-full border border-zinc-800 bg-zinc-950/40 flex items-center justify-center text-xs font-semibold text-zinc-200">
      {getInitials(name)}
    </div>
  )
}

function PersonRow({ name, meta, badge, tone }: { name: string, meta?: string | null, badge?: string, tone?: "amber" | "default" }) {
  const toneClass = tone === "amber" ? "border-amber-500/20 bg-amber-500/5" : "border-zinc-800 bg-zinc-950/40"
  const badgeClass = tone === "amber" ? "border-amber-500/40 text-amber-200 bg-amber-500/5" : "border-zinc-700 text-zinc-200 bg-zinc-950/40"
  return (
    <div className={`rounded-xl border ${toneClass} px-4 py-3 flex items-center justify-between gap-3`}>
      <div className="flex items-center gap-3 min-w-0">
        <InitialsChip name={name} />
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-white">{name}</div>
          {meta ? <div className="truncate text-xs text-zinc-500">{meta}</div> : null}
        </div>
      </div>
      {badge ? (
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] ${badgeClass}`}>
          {badge}
        </span>
      ) : null}
    </div>
  )
}
