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
import { Switch } from "@/components/ui/switch"
import { Briefcase, Loader2, Plus, Settings, Trash2 } from "lucide-react"

type RoleItem = {
  id: number
  name: string
  employee_access_settings?: any
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

  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isSavingSettings, setIsSavingSettings] = useState(false)
  const [settingsRoleId, setSettingsRoleId] = useState<number | null>(null)
  const [settingsDraft, setSettingsDraft] = useState<any>({})

  const deleteRole = useMemo(() => roles.find(r => r.id === deleteRoleId) || null, [roles, deleteRoleId])
  const settingsRole = useMemo(() => roles.find(r => r.id === settingsRoleId) || null, [roles, settingsRoleId])

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

  const openSettings = (role: RoleItem) => {
    setSettingsRoleId(role.id)
    setSettingsDraft(role.employee_access_settings || {})
    setIsSettingsOpen(true)
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

  const handleSaveSettings = async () => {
    if (!settingsRoleId) return

    setIsSavingSettings(true)
    try {
      const res = await fetch("/api/super-admin/roles", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roleId: settingsRoleId,
          employee_access_settings: settingsDraft || {},
        }),
      })

      if (res.ok) {
        setIsSettingsOpen(false)
        setSettingsRoleId(null)
        await fetchRoles()
      } else {
        const data = await res.json().catch(() => ({}))
        alert(data?.error || "Не удалось сохранить настройки роли")
      }
    } catch (e) {
      console.error(e)
      alert("Ошибка сохранения настроек")
    } finally {
      setIsSavingSettings(false)
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
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openSettings(r)}
                          className="border-zinc-800 text-zinc-200 hover:bg-zinc-900"
                        >
                          <Settings className="h-4 w-4 mr-2" />
                          Настройки
                        </Button>
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
                      </div>
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

      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100">
          <DialogHeader>
            <DialogTitle>Настройки роли</DialogTitle>
            <DialogDescription className="text-zinc-400">
              {settingsRole ? `Роль: ${settingsRole.name}` : "Выберите роль"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-zinc-300">Только employee</Label>
                <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2">
                  <span className="text-sm text-zinc-300">Запретить /clubs</span>
                  <Switch
                    checked={Boolean(settingsDraft?.employee_only)}
                    onCheckedChange={(checked) => setSettingsDraft((prev: any) => ({ ...(prev || {}), employee_only: checked }))}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-zinc-300">Закрытие смены</Label>
                <Select
                  value={String(settingsDraft?.shift_end_mode || "FULL_REPORT")}
                  onValueChange={(value) => setSettingsDraft((prev: any) => ({ ...(prev || {}), shift_end_mode: value }))}
                >
                  <SelectTrigger className="bg-zinc-900 border-zinc-800">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-950 border-zinc-800">
                    <SelectItem value="FULL_REPORT">С отчётом</SelectItem>
                    <SelectItem value="NO_REPORT">Без отчёта</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-zinc-300">Чеклисты</Label>
              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2">
                  <span className="text-sm text-zinc-300">Приёмка на старте</span>
                  <Select
                    value={settingsDraft?.handover_checklist_on_start ? String(settingsDraft.handover_checklist_on_start) : "__inherit__"}
                    onValueChange={(value) => setSettingsDraft((prev: any) => {
                      const next = { ...(prev || {}) }
                      if (value === "__inherit__") delete next.handover_checklist_on_start
                      else next.handover_checklist_on_start = value
                      return next
                    })}
                  >
                    <SelectTrigger className="h-8 w-[160px] bg-zinc-950 border-zinc-800">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-950 border-zinc-800">
                      <SelectItem value="__inherit__">Наследовать</SelectItem>
                      <SelectItem value="DISABLED">Отключено</SelectItem>
                      <SelectItem value="OPTIONAL">Опционально</SelectItem>
                      <SelectItem value="REQUIRED">Обязательно</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2">
                  <span className="text-sm text-zinc-300">Чеклист закрытия</span>
                  <Select
                    value={typeof settingsDraft?.closing_checklist_enabled === "boolean" ? (settingsDraft.closing_checklist_enabled ? "ENABLED" : "DISABLED") : "__inherit__"}
                    onValueChange={(value) => setSettingsDraft((prev: any) => {
                      const next = { ...(prev || {}) }
                      if (value === "__inherit__") delete next.closing_checklist_enabled
                      else next.closing_checklist_enabled = value === "ENABLED"
                      return next
                    })}
                  >
                    <SelectTrigger className="h-8 w-[160px] bg-zinc-950 border-zinc-800">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-950 border-zinc-800">
                      <SelectItem value="__inherit__">Наследовать</SelectItem>
                      <SelectItem value="ENABLED">Включено</SelectItem>
                      <SelectItem value="DISABLED">Отключено</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-zinc-300">Доступы</Label>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2">
                  <span className="text-sm text-zinc-300">Старт смены</span>
                  <Switch
                    checked={settingsDraft?.shift_start_enabled !== false}
                    onCheckedChange={(checked) => setSettingsDraft((prev: any) => ({ ...(prev || {}), shift_start_enabled: checked }))}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2">
                  <span className="text-sm text-zinc-300">Передача зон</span>
                  <Switch
                    checked={settingsDraft?.shift_zone_handover_enabled !== false}
                    onCheckedChange={(checked) => setSettingsDraft((prev: any) => ({ ...(prev || {}), shift_zone_handover_enabled: checked }))}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2">
                  <span className="text-sm text-zinc-300">Складские действия</span>
                  <Switch
                    checked={settingsDraft?.inventory_actions_enabled !== false}
                    onCheckedChange={(checked) => setSettingsDraft((prev: any) => ({ ...(prev || {}), inventory_actions_enabled: checked }))}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2">
                  <span className="text-sm text-zinc-300">Обслуживание</span>
                  <Switch
                    checked={settingsDraft?.maintenance_enabled !== false}
                    onCheckedChange={(checked) => setSettingsDraft((prev: any) => ({ ...(prev || {}), maintenance_enabled: checked }))}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2">
                  <span className="text-sm text-zinc-300">График</span>
                  <Switch
                    checked={settingsDraft?.schedule_enabled !== false}
                    onCheckedChange={(checked) => setSettingsDraft((prev: any) => ({ ...(prev || {}), schedule_enabled: checked }))}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2">
                  <span className="text-sm text-zinc-300">Заявки руководству</span>
                  <Switch
                    checked={settingsDraft?.requests_enabled !== false}
                    onCheckedChange={(checked) => setSettingsDraft((prev: any) => ({ ...(prev || {}), requests_enabled: checked }))}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2">
                  <span className="text-sm text-zinc-300">Рабочие места</span>
                  <Switch
                    checked={settingsDraft?.workstations_view_enabled !== false}
                    onCheckedChange={(checked) => setSettingsDraft((prev: any) => ({ ...(prev || {}), workstations_view_enabled: checked }))}
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsSettingsOpen(false)}
              className="border-zinc-800 text-zinc-200 hover:bg-zinc-900"
            >
              Отмена
            </Button>
            <Button
              onClick={handleSaveSettings}
              disabled={isSavingSettings || !settingsRoleId}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              {isSavingSettings ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
