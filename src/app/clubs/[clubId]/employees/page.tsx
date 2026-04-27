"use client"

import { useEffect, useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Loader2, UserPlus, Pencil, Search, Users, UserCheck, UserMinus, MoreHorizontal, FileText, ArrowUp, ArrowDown, X } from "lucide-react"
import { PhoneInput } from "@/components/ui/phone-input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Link from "next/link"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { formatLocalDate } from "@/lib/utils"

import { PageShell } from "@/components/layout/PageShell"

interface Employee {
    id: string
    full_name: string
    phone_number: string
    role: string
    role_id: number | null
    shift_roles?: { role_id: number, role_name: string, priority: number }[]
    role_salary_overrides?: { role_id: number, scheme_id: number | null, scheme_name: string | null }[]
    hired_at: string
    is_active: boolean
    dismissed_at?: string | null
    show_in_schedule: boolean
    salary_scheme_id?: number
    salary_scheme_name?: string
}

interface Role {
    id: number
    name: string
}

interface SalaryScheme {
    id: number
    name: string
}

export default function EmployeesPage({ params }: { params: Promise<{ clubId: string }> }) {
    const [clubId, setClubId] = useState<string>('')
    const [employees, setEmployees] = useState<Employee[]>([])
    const [newCandidatesCount, setNewCandidatesCount] = useState(0)
    const [roles, setRoles] = useState<Role[]>([])
    const [salarySchemes, setSalarySchemes] = useState<SalaryScheme[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [isEditModalOpen, setIsEditModalOpen] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)

    // Filters
    const [searchQuery, setSearchQuery] = useState('')
    const [activeTab, setActiveTab] = useState<'active' | 'dismissed'>('active')

    // Form state for add
    const [phoneNumber, setPhoneNumber] = useState('')
    const [fullName, setFullName] = useState('')
    const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null)

    // Form state for edit
    const [editFullName, setEditFullName] = useState('')
    const [editPhoneNumber, setEditPhoneNumber] = useState('')
    const [editRoleId, setEditRoleId] = useState<number | null>(null)
    const [editPassword, setEditPassword] = useState('')
    const [editShowInSchedule, setEditShowInSchedule] = useState(true)
    const [editShiftRoleIds, setEditShiftRoleIds] = useState<number[]>([])
    const [editShiftRolesLoading, setEditShiftRolesLoading] = useState(false)
    const [editAddShiftRoleId, setEditAddShiftRoleId] = useState<number | null>(null)

    // Dismissal State
    const [isDismissModalOpen, setIsDismissModalOpen] = useState(false)
    const [dismissalDate, setDismissalDate] = useState('')
    const [employeeToDismiss, setEmployeeToDismiss] = useState<string | null>(null)

    // Restore State
    const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false)
    const [employeeToRestore, setEmployeeToRestore] = useState<Employee | null>(null)

    useEffect(() => {
        params.then(p => {
            setClubId(p.clubId)
            fetchData(p.clubId)
        })
    }, [params])

    const fetchData = async (id: string) => {
        try {
            const [employeesRes, rolesRes, schemesRes, applicationsRes] = await Promise.all([
                fetch(`/api/clubs/${id}/employees`),
                fetch(`/api/roles`),
                fetch(`/api/clubs/${id}/salary-schemes`),
                fetch(`/api/clubs/${id}/recruitment/applications?status=new`)
            ])

            const [employeesData, rolesData, schemesData, applicationsData] = await Promise.all([
                employeesRes.json(),
                rolesRes.json(),
                schemesRes.json(),
                applicationsRes.json()
            ])

            if (employeesRes.ok) setEmployees(employeesData.employees)
            if (rolesRes.ok) setRoles(rolesData.roles)
            if (schemesRes.ok) setSalarySchemes(schemesData.schemes || [])
            if (applicationsRes.ok) setNewCandidatesCount(Array.isArray(applicationsData) ? applicationsData.length : 0)
        } catch (error) {
            console.error('Error fetching data:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const handleAssignRoleScheme = async (employeeId: string, roleId: number, value: string) => {
        try {
            const schemeId = value === 'none' ? null : parseInt(value)
            const res = await fetch(`/api/clubs/${clubId}/employees/${employeeId}/role-salary`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role_id: roleId, scheme_id: schemeId })
            })
            if (!res.ok) return

            const schemeName = schemeId ? (salarySchemes.find(s => s.id === schemeId)?.name || null) : null
            setEmployees(prev => prev.map(emp => {
                if (emp.id !== employeeId) return emp
                const prevArr = emp.role_salary_overrides || []
                const filtered = prevArr.filter(x => x.role_id !== roleId)
                return {
                    ...emp,
                    role_salary_overrides: [...filtered, { role_id: roleId, scheme_id: schemeId, scheme_name: schemeName }]
                }
            }))
        } catch (error) {
            console.error('Error assigning role scheme:', error)
        }
    }

    const handleAddEmployee = async (e: React.FormEvent) => {
        e.preventDefault()

        const digits = phoneNumber.replace(/\D/g, '')
        if (digits.length < 11) {
            alert('Введите полный номер телефона')
            return
        }

        setIsSubmitting(true)

        try {
            const res = await fetch(`/api/clubs/${clubId}/employees`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phone_number: phoneNumber,
                    full_name: fullName,
                    role_id: selectedRoleId
                }),
            })

            if (res.ok) {
                setIsModalOpen(false)
                setPhoneNumber('')
                setFullName('')
                setSelectedRoleId(null)
                fetchData(clubId)
            } else {
                const data = await res.json()
                alert(data.error || 'Не удалось добавить сотрудника')
            }
        } catch (error) {
            console.error('Error adding employee:', error)
            alert('Ошибка добавления сотрудника')
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleDismissEmployee = (employeeId: string) => {
        setEmployeeToDismiss(employeeId)
        setDismissalDate(formatLocalDate(new Date()))
        setIsDismissModalOpen(true)
    }

    const handleConfirmDismiss = async () => {
        if (!employeeToDismiss || !dismissalDate) return

        setIsSubmitting(true)
        try {
            const res = await fetch(`/api/clubs/${clubId}/employees/${employeeToDismiss}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_active: false, dismissed_at: dismissalDate })
            })

            if (res.ok) {
                setIsDismissModalOpen(false)
                fetchData(clubId)
                setEmployeeToDismiss(null)
            } else {
                alert('Не удалось уволить сотрудника')
            }
        } catch (error) {
            console.error('Error dismissing employee:', error)
            alert('Ошибка при увольнении')
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleEditEmployee = async (employee: Employee) => {
        setSelectedEmployee(employee)
        setEditFullName(employee.full_name)
        setEditPhoneNumber(employee.phone_number)
        setEditRoleId(employee.role_id)
        setEditPassword('')
        setEditShowInSchedule(employee.show_in_schedule)
        setEditShiftRoleIds([])
        setEditAddShiftRoleId(null)
        setEditShiftRolesLoading(true)
        try {
            const res = await fetch(`/api/clubs/${clubId}/employees/${employee.id}/roles`, { cache: 'no-store' })
            const data = await res.json()
            if (res.ok && Array.isArray(data.roles)) {
                const ids = data.roles
                    .sort((a: any, b: any) => Number(a.priority ?? 0) - Number(b.priority ?? 0))
                    .map((r: any) => Number(r.role_id))
                    .filter((v: any) => Number.isFinite(v))
                setEditShiftRoleIds(ids)
            }
        } catch (e) {
            console.error(e)
        } finally {
            setEditShiftRolesLoading(false)
        }
        setEditShiftRoleIds(prev => {
            if (prev.length > 0) return prev
            return employee.role_id ? [employee.role_id] : []
        })
        setIsEditModalOpen(true)
    }

    const handleUpdateEmployee = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedEmployee) return

        setIsSubmitting(true)
        try {
            const body: any = {
                full_name: editFullName,
                phone_number: editPhoneNumber,
                role_id: editRoleId,
                show_in_schedule: editShowInSchedule
            }

            if (editPassword && editPassword.length >= 6) {
                body.password = editPassword
            }

            const res = await fetch(`/api/clubs/${clubId}/employees/${selectedEmployee.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            })

            if (res.ok) {
                await fetch(`/api/clubs/${clubId}/employees/${selectedEmployee.id}/roles`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ role_ids: editShiftRoleIds })
                })
                setIsEditModalOpen(false)
                setSelectedEmployee(null)
                setEditPassword('')
                fetchData(clubId)
            } else {
                const data = await res.json()
                alert(data.error || 'Не удалось обновить сотрудника')
            }
        } catch (error) {
            console.error('Error updating employee:', error)
            alert('Ошибка обновления')
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleRestoreEmployee = (employee: Employee) => {
        setEmployeeToRestore(employee)
        setIsRestoreModalOpen(true)
    }

    const handleConfirmRestore = async () => {
        if (!employeeToRestore) return

        setIsSubmitting(true)
        try {
            const res = await fetch(`/api/clubs/${clubId}/employees/${employeeToRestore.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_active: true })
            })

            if (res.ok) {
                setIsRestoreModalOpen(false)
                setEmployeeToRestore(null)
                fetchData(clubId)
            } else {
                alert('Не удалось восстановить сотрудника')
            }
        } catch (error) {
            console.error('Error restoring employee:', error)
            alert('Ошибка при восстановлении')
        } finally {
            setIsSubmitting(false)
        }
    }

    const filteredEmployees = useMemo(() => {
        return employees.filter(emp => {
            const matchesSearch = emp.full_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                emp.phone_number.includes(searchQuery)
            const matchesStatus = activeTab === 'active' ? emp.is_active && !emp.dismissed_at : !emp.is_active || emp.dismissed_at
            return matchesSearch && matchesStatus
        })
    }, [employees, searchQuery, activeTab])

    const stats = useMemo(() => {
        const activeEmployees = employees.filter(employee => employee.is_active && !employee.dismissed_at).length
        return { activeEmployees, newCandidates: newCandidatesCount }
    }, [employees, newCandidatesCount])

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-50">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                    <p className="text-sm font-medium text-slate-500 animate-pulse">Загрузка команды...</p>
                </div>
            </div>
        )
    }

    return (
        <PageShell maxWidth="5xl">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between mb-12">
                <div className="space-y-3">
                    <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900">
                        Сотрудники
                    </h1>
                    <p className="text-slate-500 text-lg">
                        Управление персоналом
                    </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap lg:justify-end hidden md:flex">
                    <Button asChild variant="outline" className="w-full sm:w-auto rounded-xl h-12 border-slate-200 px-6 font-medium text-slate-700 hover:bg-slate-50 hover:text-black">
                        <Link href={`/clubs/${clubId}/employees/recruitment/applications`}>
                            <FileText className="mr-2 h-5 w-5" />
                            Анкеты
                        </Link>
                    </Button>
                    <Button onClick={() => setIsModalOpen(true)} className="w-full bg-slate-900 text-white hover:bg-slate-800 sm:w-auto rounded-xl h-12 px-6 font-medium shadow-sm">
                        <UserPlus className="mr-2 h-5 w-5" />
                        Добавить сотрудника
                    </Button>
                </div>
            </div>

            <div className="space-y-8">
                
                <div className="grid gap-4 sm:grid-cols-2 mb-12">
                    <div className="bg-white rounded-3xl border border-slate-200 p-6 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500">Активные сотрудники</p>
                            <p className="text-3xl font-semibold text-slate-900 mt-1">{stats.activeEmployees}</p>
                        </div>
                        <div className="h-12 w-12 rounded-2xl bg-slate-50 flex items-center justify-center">
                            <Users className="h-6 w-6 text-slate-400" />
                        </div>
                    </div>

                    <div className="bg-white rounded-3xl border border-slate-200 p-6 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500">Новые кандидаты</p>
                            <p className="text-3xl font-semibold text-slate-900 mt-1">{stats.newCandidates}</p>
                        </div>
                        <div className="h-12 w-12 rounded-2xl bg-emerald-50 flex items-center justify-center">
                            <FileText className="h-6 w-6 text-emerald-500" />
                        </div>
                    </div>
                </div>

                {/* Filters and List */}
                <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
                        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full sm:w-auto">
                            <TabsList className="grid w-full grid-cols-2 bg-slate-100/50 p-1 rounded-xl">
                                <TabsTrigger value="active" className="text-xs font-semibold rounded-lg data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm">
                                    Активные
                                </TabsTrigger>
                                <TabsTrigger value="dismissed" className="text-xs font-semibold rounded-lg data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm">
                                    Уволенные
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>

                        <div className="relative w-full sm:w-80">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input 
                                placeholder="Поиск по имени или телефону..." 
                                className="pl-10 bg-white border-slate-200 focus:border-slate-400 rounded-xl h-10"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>

                    {filteredEmployees.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-slate-200">
                            <div className="h-16 w-16 rounded-full bg-slate-50 flex items-center justify-center mb-4">
                                <Search className="h-8 w-8 text-slate-300" />
                            </div>
                            <h3 className="text-lg font-bold">Никого не нашли</h3>
                            <p className="text-sm text-slate-500">Попробуйте изменить поисковый запрос или фильтры</p>
                            {searchQuery && (
                                <Button variant="link" onClick={() => setSearchQuery('')} className="text-slate-900 mt-2">
                                    Сбросить поиск
                                </Button>
                            )}
                        </div>
                    ) : (
                        <>
                            {/* Desktop Table */}
                            <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden hidden md:block">
                                <Table>
                                    <TableHeader className="bg-slate-50/50">
                                        <TableRow className="hover:bg-transparent border-slate-100">
                                            <TableHead className="text-xs font-bold uppercase tracking-widest text-slate-500 py-4">Сотрудник</TableHead>
                                            <TableHead className="text-xs font-bold uppercase tracking-widest text-slate-500 py-4">Должность</TableHead>
                                            <TableHead className="text-xs font-bold uppercase tracking-widest text-slate-500 py-4">Зарплата</TableHead>
                                            <TableHead className="text-xs font-bold uppercase tracking-widest text-slate-500 py-4">Нанят</TableHead>
                                            <TableHead className="text-xs font-bold uppercase tracking-widest text-slate-500 py-4 text-right">Действия</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredEmployees.map((employee) => (
                                            <TableRow key={employee.id} className="group hover:bg-slate-50/50 border-slate-100 transition-colors">
                                                <TableCell className="py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="space-y-0.5">
                                                            <div className="font-bold text-sm tracking-tight text-slate-900">{employee.full_name}</div>
                                                            <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                                                {employee.phone_number}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col gap-1.5">
                                                        {(employee.shift_roles && employee.shift_roles.length > 0
                                                            ? employee.shift_roles
                                                            : [{ role_id: employee.role_id || 0, role_name: employee.role, priority: 0 }]
                                                        ).map((r, idx) => {
                                                            return (
                                                                <div key={`${employee.id}-${r.role_id}-${idx}`} className="flex items-center gap-2">
                                                                    <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 font-bold text-[10px] uppercase tracking-wider px-2 py-0.5">
                                                                        {r.role_name}
                                                                    </Badge>
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col gap-2 max-w-[220px]">
                                                        {(employee.shift_roles && employee.shift_roles.length > 0
                                                            ? employee.shift_roles
                                                            : [{ role_id: employee.role_id || 0, role_name: employee.role, priority: 0 }]
                                                        ).filter(r => r.role_id > 0).map((r, idx) => {
                                                            const override = (employee.role_salary_overrides || []).find(x => x.role_id === r.role_id)
                                                            const currentValue = override
                                                                ? (override.scheme_id === null ? 'none' : String(override.scheme_id))
                                                                : (employee.salary_scheme_id ? String(employee.salary_scheme_id) : 'none')
                                                            return (
                                                                <Select
                                                                    key={`${employee.id}-scheme-${r.role_id}-${idx}`}
                                                                    value={currentValue}
                                                                    onValueChange={(v) => handleAssignRoleScheme(employee.id, r.role_id, v)}
                                                                >
                                                                    <SelectTrigger className="h-8 text-xs font-medium border-slate-200 hover:border-slate-300 transition-colors bg-white">
                                                                        <SelectValue placeholder="Схема" />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="none" className="text-xs">Без схемы</SelectItem>
                                                                        {salarySchemes.map(scheme => (
                                                                            <SelectItem key={scheme.id} value={scheme.id.toString()} className="text-xs">
                                                                                {scheme.name}
                                                                            </SelectItem>
                                                                        ))}
                                                                    </SelectContent>
                                                                </Select>
                                                            )
                                                        })}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="space-y-0.5">
                                                        <div className="text-xs font-medium text-slate-900">
                                                            {new Date(employee.hired_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                        </div>
                                                        {employee.dismissed_at && (
                                                            <div className="text-[10px] font-bold text-orange-600 uppercase">
                                                                Уволен: {new Date(employee.dismissed_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                                                            </div>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-slate-100 hover:text-slate-900">
                                                                <MoreHorizontal className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="w-48 rounded-xl border-slate-200 shadow-xl shadow-slate-900/5">
                                                            <DropdownMenuItem onClick={() => handleEditEmployee(employee)} className="text-xs font-medium cursor-pointer py-2 gap-2">
                                                                <Pencil className="h-3.5 w-3.5" /> Редактировать
                                                            </DropdownMenuItem>
                                                            {employee.is_active && !employee.dismissed_at ? (
                                                                <DropdownMenuItem onClick={() => handleDismissEmployee(employee.id)} className="text-xs font-medium cursor-pointer py-2 gap-2 text-rose-600 focus:text-rose-600 focus:bg-rose-50">
                                                                    <UserMinus className="h-3.5 w-3.5" /> Уволить
                                                                </DropdownMenuItem>
                                                            ) : (
                                                                <DropdownMenuItem onClick={() => handleRestoreEmployee(employee)} className="text-xs font-medium cursor-pointer py-2 gap-2 text-emerald-600 focus:text-emerald-600 focus:bg-emerald-50">
                                                                    <UserCheck className="h-3.5 w-3.5" /> Восстановить
                                                                </DropdownMenuItem>
                                                            )}
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Mobile Cards */}
                            <div className="md:hidden space-y-3">
                                {filteredEmployees.map((employee) => (
                                    <div key={employee.id} className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <div className="font-bold text-sm tracking-tight text-slate-900">{employee.full_name}</div>
                                                <div className="text-xs text-slate-500 mt-0.5">{employee.phone_number}</div>
                                            </div>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full -mr-2 -mt-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-48 rounded-xl border-slate-200 shadow-xl shadow-slate-900/5">
                                                    <DropdownMenuItem onClick={() => handleEditEmployee(employee)} className="text-xs font-medium cursor-pointer py-2 gap-2">
                                                        <Pencil className="h-3.5 w-3.5" /> Редактировать
                                                    </DropdownMenuItem>
                                                    {employee.is_active && !employee.dismissed_at ? (
                                                        <DropdownMenuItem onClick={() => handleDismissEmployee(employee.id)} className="text-xs font-medium cursor-pointer py-2 gap-2 text-rose-600 focus:text-rose-600 focus:bg-rose-50">
                                                            <UserMinus className="h-3.5 w-3.5" /> Уволить
                                                        </DropdownMenuItem>
                                                    ) : (
                                                        <DropdownMenuItem onClick={() => handleRestoreEmployee(employee)} className="text-xs font-medium cursor-pointer py-2 gap-2 text-emerald-600 focus:text-emerald-600 focus:bg-emerald-50">
                                                            <UserCheck className="h-3.5 w-3.5" /> Восстановить
                                                        </DropdownMenuItem>
                                                    )}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                        
                                        <div className="flex flex-wrap gap-2">
                                            {(employee.shift_roles && employee.shift_roles.length > 0
                                                ? employee.shift_roles
                                                : [{ role_id: employee.role_id || 0, role_name: employee.role, priority: 0 }]
                                            ).map((r, idx) => {
                                                return (
                                                    <div key={`${employee.id}-m-${r.role_id}-${idx}`} className="flex items-center gap-2">
                                                        <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 font-bold text-[10px] uppercase tracking-wider px-2 py-0.5">
                                                            {r.role_name}
                                                        </Badge>
                                                    </div>
                                                )
                                            })}
                                            {employee.dismissed_at ? (
                                                <Badge variant="outline" className="bg-rose-50 text-rose-600 border-rose-200 font-bold text-[10px] uppercase tracking-wider px-2 py-0.5">
                                                    Уволен: {new Date(employee.dismissed_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200 font-bold text-[10px] uppercase tracking-wider px-2 py-0.5">
                                                    Нанят: {new Date(employee.hired_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                </Badge>
                                            )}
                                        </div>

                                        <div className="pt-3 border-t border-slate-100 space-y-2">
                                            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Схемы оплаты по ролям</div>
                                            {(employee.shift_roles && employee.shift_roles.length > 0
                                                ? employee.shift_roles
                                                : [{ role_id: employee.role_id || 0, role_name: employee.role, priority: 0 }]
                                            ).filter(r => r.role_id > 0).map((r, idx) => {
                                                const override = (employee.role_salary_overrides || []).find(x => x.role_id === r.role_id)
                                                const currentValue = override
                                                    ? (override.scheme_id === null ? 'none' : String(override.scheme_id))
                                                    : (employee.salary_scheme_id ? String(employee.salary_scheme_id) : 'none')
                                                return (
                                                    <div key={`${employee.id}-m-scheme-${r.role_id}-${idx}`} className="space-y-1">
                                                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{r.role_name}</div>
                                                        <Select
                                                            value={currentValue}
                                                            onValueChange={(v) => handleAssignRoleScheme(employee.id, r.role_id, v)}
                                                        >
                                                            <SelectTrigger className="h-9 text-xs font-medium border-slate-200 hover:border-slate-300 transition-colors bg-slate-50/50">
                                                                <SelectValue placeholder="Схема" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="none" className="text-xs">Без схемы</SelectItem>
                                                                {salarySchemes.map(scheme => (
                                                                    <SelectItem key={scheme.id} value={scheme.id.toString()} className="text-xs">
                                                                        {scheme.name}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Mobile Sticky Actions */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-xl border-t border-slate-200 md:hidden z-50 flex gap-2 pb-[calc(1rem+env(safe-area-inset-bottom))]">
                <Button asChild variant="outline" className="flex-1 bg-white border-slate-200 text-slate-700 h-12 rounded-xl font-medium">
                    <Link href={`/clubs/${clubId}/employees/recruitment/applications`}>
                        <FileText className="mr-2 h-4 w-4" />
                        Анкеты
                    </Link>
                </Button>
                <Button onClick={() => setIsModalOpen(true)} className="flex-1 bg-slate-900 text-white hover:bg-slate-800 h-12 rounded-xl font-medium">
                    <UserPlus className="mr-2 h-4 w-4" />
                    Добавить
                </Button>
            </div>

            {/* Add Employee Modal */}
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="sm:max-w-[425px] rounded-3xl border border-slate-200 shadow-2xl bg-white p-6">
                    <DialogHeader className="space-y-3">
                        <div className="h-12 w-12 rounded-2xl bg-slate-100 flex items-center justify-center">
                            <UserPlus className="h-6 w-6 text-slate-700" />
                        </div>
                        <div>
                            <DialogTitle className="text-xl font-bold text-slate-900">Добавить сотрудника</DialogTitle>
                            <DialogDescription className="text-sm font-medium text-slate-500">
                                Заполните данные для создания нового аккаунта
                            </DialogDescription>
                        </div>
                    </DialogHeader>

                    <form onSubmit={handleAddEmployee} className="space-y-5 pt-4">
                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="fullName" className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Полное имя</Label>
                                <Input
                                    id="fullName"
                                    placeholder="Напр: Иван Иванов"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    className="bg-slate-50/50 border-slate-200 focus:border-slate-400 h-10 rounded-xl"
                                    required
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="phoneNumber" className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Номер телефона</Label>
                                <PhoneInput
                                    id="phoneNumber"
                                    placeholder="+7 (999) 000-00-00"
                                    value={phoneNumber}
                                    onChange={setPhoneNumber}
                                    className="bg-slate-50/50 border-slate-200 focus:border-slate-400 h-10 rounded-xl"
                                    required
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="role" className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Должность</Label>
                                <Select 
                                    value={selectedRoleId?.toString() || ""} 
                                    onValueChange={(v) => setSelectedRoleId(parseInt(v))}
                                >
                                    <SelectTrigger className="bg-slate-50/50 border-slate-200 focus:border-slate-400 h-10 rounded-xl">
                                        <SelectValue placeholder="Выберите должность" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        {roles.map((role) => (
                                            <SelectItem key={role.id} value={role.id.toString()}>
                                                {role.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <DialogFooter className="pt-2">
                            <Button
                                type="submit"
                                className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-xl h-11 font-medium"
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Добавление...
                                    </>
                                ) : (
                                    <>
                                        <Plus className="mr-2 h-4 w-4" />
                                        Добавить в команду
                                    </>
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Edit Employee Modal */}
            <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
                <DialogContent className="sm:max-w-[425px] rounded-3xl border border-slate-200 shadow-2xl bg-white p-6">
                    <DialogHeader className="space-y-3">
                        <div className="h-12 w-12 rounded-2xl bg-slate-100 flex items-center justify-center">
                            <Pencil className="h-6 w-6 text-slate-700" />
                        </div>
                        <div>
                            <DialogTitle className="text-xl font-bold text-slate-900">Редактировать профиль</DialogTitle>
                            <DialogDescription className="text-sm font-medium text-slate-500">
                                Обновите контактные данные или роль сотрудника
                            </DialogDescription>
                        </div>
                    </DialogHeader>

                    <form onSubmit={handleUpdateEmployee} className="space-y-5 pt-4">
                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="editFullName" className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Полное имя</Label>
                                <Input
                                    id="editFullName"
                                    value={editFullName}
                                    onChange={(e) => setEditFullName(e.target.value)}
                                    className="bg-slate-50/50 border-slate-200 focus:border-slate-400 h-10 rounded-xl"
                                    required
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="editPhoneNumber" className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Номер телефона</Label>
                                <PhoneInput
                                    id="editPhoneNumber"
                                    value={editPhoneNumber}
                                    onChange={setEditPhoneNumber}
                                    className="bg-slate-50/50 border-slate-200 focus:border-slate-400 h-10 rounded-xl"
                                    required
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="editRole" className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Должность</Label>
                                <Select 
                                    value={editRoleId?.toString() || ""} 
                                    onValueChange={(v) => setEditRoleId(parseInt(v))}
                                >
                                    <SelectTrigger className="bg-slate-50/50 border-slate-200 focus:border-slate-400 h-10 rounded-xl">
                                        <SelectValue placeholder="Выберите должность" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        {roles.map((role) => (
                                            <SelectItem key={role.id} value={role.id.toString()}>
                                                {role.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="editPassword" className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Новый пароль</Label>
                                <Input
                                    id="editPassword"
                                    type="password"
                                    placeholder="Оставьте пустым, чтобы не менять"
                                    value={editPassword}
                                    onChange={(e) => setEditPassword(e.target.value)}
                                    className="bg-slate-50/50 border-slate-200 focus:border-slate-400 h-10 rounded-xl"
                                />
                            </div>

                            <div className="space-y-2 p-4 rounded-2xl bg-slate-50/50 border border-slate-200">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="space-y-0.5">
                                        <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-900">Роли для смены</Label>
                                        <p className="text-[10px] text-slate-500">Порядок сверху вниз = приоритет по умолчанию</p>
                                    </div>
                                    {editShiftRolesLoading && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
                                </div>

                                <div className="space-y-2">
                                    {editShiftRoleIds.length === 0 ? (
                                        <div className="text-[11px] text-slate-500 font-medium">Не задано</div>
                                    ) : (
                                        editShiftRoleIds.map((rid, idx) => {
                                            const roleName = roles.find(r => r.id === rid)?.name || `#${rid}`
                                            return (
                                                <div key={`${rid}-${idx}`} className="flex items-center justify-between rounded-xl bg-white border border-slate-200 px-3 py-2">
                                                    <div className="min-w-0">
                                                        <div className="text-sm font-bold text-slate-900 truncate">{roleName}</div>
                                                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Приоритет {idx + 1}</div>
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 rounded-lg"
                                                            disabled={idx === 0}
                                                            onClick={() => setEditShiftRoleIds(prev => {
                                                                const next = [...prev]
                                                                const tmp = next[idx - 1]
                                                                next[idx - 1] = next[idx]
                                                                next[idx] = tmp
                                                                return next
                                                            })}
                                                        >
                                                            <ArrowUp className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 rounded-lg"
                                                            disabled={idx === editShiftRoleIds.length - 1}
                                                            onClick={() => setEditShiftRoleIds(prev => {
                                                                const next = [...prev]
                                                                const tmp = next[idx + 1]
                                                                next[idx + 1] = next[idx]
                                                                next[idx] = tmp
                                                                return next
                                                            })}
                                                        >
                                                            <ArrowDown className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 rounded-lg text-rose-600 hover:text-rose-700"
                                                            onClick={() => setEditShiftRoleIds(prev => prev.filter((_, i) => i !== idx))}
                                                        >
                                                            <X className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            )
                                        })
                                    )}
                                </div>

                                <div className="flex items-center gap-2">
                                    <Select
                                        value={editAddShiftRoleId ? String(editAddShiftRoleId) : ""}
                                        onValueChange={(v) => setEditAddShiftRoleId(parseInt(v))}
                                    >
                                        <SelectTrigger className="bg-white border-slate-200 focus:border-slate-400 h-10 rounded-xl">
                                            <SelectValue placeholder="Добавить роль" />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl">
                                            {roles
                                                .filter(r => !editShiftRoleIds.includes(r.id))
                                                .map((role) => (
                                                    <SelectItem key={role.id} value={role.id.toString()}>
                                                        {role.name}
                                                    </SelectItem>
                                                ))}
                                        </SelectContent>
                                    </Select>
                                    <Button
                                        type="button"
                                        className="h-10 rounded-xl bg-slate-900 text-white hover:bg-slate-800"
                                        disabled={!editAddShiftRoleId}
                                        onClick={() => {
                                            if (!editAddShiftRoleId) return
                                            setEditShiftRoleIds(prev => [...prev, editAddShiftRoleId])
                                            setEditAddShiftRoleId(null)
                                        }}
                                    >
                                        <Plus className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>

                            <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50/50 border border-slate-200">
                                <div className="space-y-0.5">
                                    <Label htmlFor="showInSchedule" className="text-[10px] font-bold uppercase tracking-wider text-slate-900">График работы</Label>
                                    <p className="text-[10px] text-slate-500">Отображать сотрудника в сетке расписания</p>
                                </div>
                                <Switch
                                    id="showInSchedule"
                                    checked={editShowInSchedule}
                                    onCheckedChange={setEditShowInSchedule}
                                    className="data-[state=checked]:bg-slate-900"
                                />
                            </div>
                        </div>

                        <DialogFooter className="pt-2">
                            <Button
                                type="submit"
                                className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-xl h-11 font-medium"
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Сохранение...
                                    </>
                                ) : (
                                    'Обновить профиль'
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Dismiss Employee Modal */}
            <Dialog open={isDismissModalOpen} onOpenChange={setIsDismissModalOpen}>
                <DialogContent className="sm:max-w-[400px] rounded-3xl border border-slate-200 shadow-2xl bg-white p-6">
                    <DialogHeader className="space-y-3">
                        <div className="h-12 w-12 rounded-2xl bg-rose-50 flex items-center justify-center">
                            <UserMinus className="h-6 w-6 text-rose-600" />
                        </div>
                        <div>
                            <DialogTitle className="text-xl font-bold text-slate-900">Увольнение сотрудника</DialogTitle>
                            <DialogDescription className="text-sm font-medium text-slate-500">
                                Выберите последний рабочий день сотрудника
                            </DialogDescription>
                        </div>
                    </DialogHeader>

                    <div className="py-4 space-y-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="dismissDate" className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Дата увольнения</Label>
                            <Input
                                id="dismissDate"
                                type="date"
                                value={dismissalDate}
                                onChange={(e) => setDismissalDate(e.target.value)}
                                className="bg-slate-50/50 border-slate-200 h-10 rounded-xl"
                            />
                        </div>
                        <div className="bg-rose-50 border border-rose-100 p-4 rounded-xl space-y-2">
                            <p className="text-[11px] text-rose-700 leading-relaxed font-medium">
                                С этой даты сотрудник больше не сможет выходить в смены, но его история работы останется в архиве.
                            </p>
                        </div>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            variant="ghost"
                            onClick={() => setIsDismissModalOpen(false)}
                            disabled={isSubmitting}
                            className="flex-1 text-xs font-bold uppercase tracking-widest rounded-xl h-11"
                        >
                            Отмена
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleConfirmDismiss}
                            disabled={isSubmitting}
                            className="flex-1 text-xs font-bold uppercase tracking-widest shadow-lg shadow-rose-200 rounded-xl h-11"
                        >
                            {isSubmitting ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                'Подтвердить'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Restore Employee Modal */}
            <Dialog open={isRestoreModalOpen} onOpenChange={setIsRestoreModalOpen}>
                <DialogContent className="sm:max-w-[400px] rounded-3xl border border-slate-200 shadow-2xl bg-white p-6">
                    <DialogHeader className="space-y-3">
                        <div className="h-12 w-12 rounded-2xl bg-emerald-50 flex items-center justify-center">
                            <UserCheck className="h-6 w-6 text-emerald-600" />
                        </div>
                        <div>
                            <DialogTitle className="text-xl font-bold text-slate-900">Восстановление сотрудника</DialogTitle>
                            <DialogDescription className="text-sm font-medium text-slate-500">
                                Вы собираетесь восстановить <strong>{employeeToRestore?.full_name}</strong>
                            </DialogDescription>
                        </div>
                    </DialogHeader>

                    <div className="py-4">
                        <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl space-y-2">
                            <p className="text-[11px] text-emerald-700 leading-relaxed font-medium">
                                После восстановления сотрудник снова сможет входить в систему и будет отображаться в списке активных сотрудников.
                            </p>
                        </div>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            variant="ghost"
                            onClick={() => setIsRestoreModalOpen(false)}
                            disabled={isSubmitting}
                            className="flex-1 text-xs font-bold uppercase tracking-widest rounded-xl h-11"
                        >
                            Отмена
                        </Button>
                        <Button
                            onClick={handleConfirmRestore}
                            disabled={isSubmitting}
                            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold uppercase tracking-widest shadow-lg shadow-emerald-200 rounded-xl h-11"
                        >
                            {isSubmitting ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                'Восстановить'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </PageShell>
    )
}
