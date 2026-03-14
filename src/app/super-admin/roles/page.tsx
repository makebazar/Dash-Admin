"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Briefcase, Loader2, Plus, Trash2 } from "lucide-react"

type RoleItem = {
  id: number
  name: string
  users_count: number
  club_employees_count: number
}

export default function SuperAdminRolesPage() {
  const [roles, setRoles] = useState<RoleItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [newName, setNewName] = useState("")

  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteRoleId, setDeleteRoleId] = useState<number | null>(null)
  const [reassignRoleId, setReassignRoleId] = useState<string>("__none__")

  const deleteRole = useMemo(() => roles.find(r => r.id === deleteRoleId) || null, [roles, deleteRoleId])

  const fetchRoles = async () => {
    setIsLoading(true)
    try {
      const res = await fetch("/api/super-admin/roles")
      const data = await res.json()
      if (res.ok) setRoles(data.roles || [])
    } catch (e) {
      console.error(e)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchRoles()
  }, [])

  const openDelete = (roleId: number) => {
    setDeleteRoleId(roleId)
    setReassignRoleId("__none__")
    setIsDeleteOpen(true)
  }

  const canDelete = (r: RoleItem) => r.name !== "Админ" && r.name !== "Управляющий"

  const handleCreate = async () => {
    const name = newName.trim()
    if (!name) return

    setIsCreating(true)
    try {
      const res = await fetch("/api/super-admin/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
        }),
      })

      if (res.ok) {
        setIsCreateOpen(false)
        setNewName("")
        await fetchRoles()
      } else {
        const data = await res.json()
        alert(data?.error || "Не удалось создать роль")
      }
    } catch (e) {
      console.error(e)
      alert("Ошибка создания роли")
    } finally {
      setIsCreating(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteRoleId) return

    const payload: any = { roleId: deleteRoleId }
    if (reassignRoleId !== "__none__") payload.reassignRoleId = Number(reassignRoleId)

    setIsDeleting(true)
    try {
      const res = await fetch("/api/super-admin/roles", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        setIsDeleteOpen(false)
        setDeleteRoleId(null)
        await fetchRoles()
      } else {
        const data = await res.json()
        alert(data?.error || "Не удалось удалить роль")
      }
    } catch (e) {
      console.error(e)
      alert("Ошибка удаления роли")
    } finally {
      setIsDeleting(false)
    }
  }

  const reassignOptions = useMemo(() => {
    const current = deleteRole
    if (!current) return []
    return roles.filter(r => r.id !== current.id)
  }, [roles, deleteRole])

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-start justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-red-500/10 flex items-center justify-center">
              <Briefcase className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Должности</h1>
              <p className="text-sm text-zinc-400">Управление справочником roles (то, что видит селект “Должность”)</p>
            </div>
          </div>
        </div>

        <Button onClick={() => setIsCreateOpen(true)} className="bg-red-500 hover:bg-red-600 text-white">
          <Plus className="h-4 w-4 mr-2" />
          Добавить
        </Button>
      </div>

      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader className="border-b border-zinc-800">
          <CardTitle className="text-zinc-100">Список ролей</CardTitle>
          <CardDescription className="text-zinc-400">Удаление автоматически переназначает club_employees.role на “Сотрудник” (или выбранную роль)</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 flex items-center justify-center text-zinc-400">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Загрузка…
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-800 hover:bg-transparent">
                  <TableHead className="text-zinc-400">Название</TableHead>
                  <TableHead className="text-zinc-400">users</TableHead>
                  <TableHead className="text-zinc-400">club_employees</TableHead>
                  <TableHead className="text-zinc-400 text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.map(r => (
                  <TableRow key={r.id} className="border-zinc-800 hover:bg-zinc-800/30">
                    <TableCell className="font-medium text-zinc-100">{r.name}</TableCell>
                    <TableCell className="text-zinc-300">
                      <Badge variant="secondary" className="bg-zinc-800 text-zinc-200">{r.users_count}</Badge>
                    </TableCell>
                    <TableCell className="text-zinc-300">
                      <Badge variant="secondary" className="bg-zinc-800 text-zinc-200">{r.club_employees_count}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={!canDelete(r)}
                        onClick={() => openDelete(r.id)}
                        className="bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/20"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Удалить
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100">
          <DialogHeader>
            <DialogTitle>Добавить должность</DialogTitle>
            <DialogDescription className="text-zinc-400">Создаёт запись в таблице roles</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="roleName" className="text-zinc-300">Название</Label>
              <Input
                id="roleName"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Напр: Техник"
                className="bg-zinc-900 border-zinc-800"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)} className="border-zinc-800 text-zinc-200 hover:bg-zinc-900">
              Отмена
            </Button>
            <Button onClick={handleCreate} disabled={isCreating || !newName.trim()} className="bg-red-500 hover:bg-red-600 text-white">
              {isCreating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Создать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100">
          <DialogHeader>
            <DialogTitle>Удалить должность</DialogTitle>
            <DialogDescription className="text-zinc-400">
              {deleteRole ? `Будет удалена роль “${deleteRole.name}”.` : "Выберите роль."}
            </DialogDescription>
          </DialogHeader>

          {deleteRole ? (
            <div className="space-y-4 pt-2">
              <div className="text-sm text-zinc-300">
                Привязки: users={deleteRole.users_count}, club_employees={deleteRole.club_employees_count}
              </div>

              <div className="space-y-1.5">
                <Label className="text-zinc-300">Переназначить на</Label>
                <Select value={reassignRoleId} onValueChange={setReassignRoleId}>
                  <SelectTrigger className="bg-zinc-900 border-zinc-800">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-950 border-zinc-800">
                    <SelectItem value="__none__">Сотрудник (сброс)</SelectItem>
                    {reassignOptions.map(r => (
                      <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)} className="border-zinc-800 text-zinc-200 hover:bg-zinc-900">
              Отмена
            </Button>
            <Button
              onClick={handleDelete}
              disabled={isDeleting || !deleteRoleId || (deleteRole ? !canDelete(deleteRole) : true)}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Удалить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
