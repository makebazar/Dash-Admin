"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Trash2, Loader2, UserPlus, Pencil, Search, Users, UserCheck, UserMinus, CreditCard, ArrowLeft, MoreHorizontal, User } from "lucide-react"
import { PhoneInput } from "@/components/ui/phone-input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Link from "next/link"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

interface Employee {
    id: string
    full_name: string
    phone_number: string
    role: string
    role_id: number | null
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
    const router = useRouter()
    const [clubId, setClubId] = useState<string>('')
    const [employees, setEmployees] = useState<Employee[]>([])
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
            const [employeesRes, rolesRes, schemesRes] = await Promise.all([
                fetch(`/api/clubs/${id}/employees`),
                fetch(`/api/roles`),
                fetch(`/api/clubs/${id}/salary-schemes`)
            ])

            const [employeesData, rolesData, schemesData] = await Promise.all([
                employeesRes.json(),
                rolesRes.json(),
                schemesRes.json()
            ])

            if (employeesRes.ok) setEmployees(employeesData.employees)
            if (rolesRes.ok) setRoles(rolesData.roles)
            if (schemesRes.ok) setSalarySchemes(schemesData.schemes || [])
        } catch (error) {
            console.error('Error fetching data:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const handleAssignScheme = async (employeeId: string, schemeId: number | null) => {
        try {
            const res = await fetch(`/api/clubs/${clubId}/employees/${employeeId}/salary`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ scheme_id: schemeId })
            })

            if (res.ok) {
                setEmployees(prev => prev.map(emp =>
                    emp.id === employeeId
                        ? {
                            ...emp,
                            salary_scheme_id: schemeId || undefined,
                            salary_scheme_name: salarySchemes.find(s => s.id === schemeId)?.name || undefined
                        }
                        : emp
                ))
            }
        } catch (error) {
            console.error('Error assigning scheme:', error)
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
        setDismissalDate(new Date().toISOString().split('T')[0])
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

    const handleEditEmployee = (employee: Employee) => {
        setSelectedEmployee(employee)
        setEditFullName(employee.full_name)
        setEditPhoneNumber(employee.phone_number)
        setEditRoleId(employee.role_id)
        setEditPassword('')
        setEditShowInSchedule(employee.show_in_schedule)
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
        const active = employees.filter(e => e.is_active && !e.dismissed_at).length
        const dismissed = employees.filter(e => !e.is_active || e.dismissed_at).length
        return { total: employees.length, active, dismissed }
    }, [employees])

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-10 w-10 animate-spin text-purple-600" />
                    <p className="text-sm font-medium text-muted-foreground animate-pulse">Загрузка команды...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#F9FAFB] dark:bg-background">
            {/* Top Bar */}
            <div className="sticky top-0 z-30 w-full border-b bg-background/80 backdrop-blur-md">
                <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" asChild className="rounded-full">
                            <Link href={`/clubs/${clubId}/settings/general`}>
                                <ArrowLeft className="h-5 w-5" />
                            </Link>
                        </Button>
                        <div>
                            <h1 className="text-xl font-bold tracking-tight">Сотрудники</h1>
                            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Управление персоналом</p>
                        </div>
                    </div>
                    <Button onClick={() => setIsModalOpen(true)} className="bg-purple-600 hover:bg-purple-700 text-white shadow-md shadow-purple-200 transition-all active:scale-95">
                        <UserPlus className="mr-2 h-4 w-4" />
                        Добавить сотрудника
                    </Button>
                </div>
            </div>

            <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
                
                {/* Statistics Cards */}
                <div className="grid gap-4 md:grid-cols-3">
                    <Card className="border-none shadow-sm bg-white overflow-hidden group">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Всего сотрудников</p>
                                    <p className="text-3xl font-black">{stats.total}</p>
                                </div>
                                <div className="h-12 w-12 rounded-2xl bg-purple-50 flex items-center justify-center group-hover:bg-purple-100 transition-colors">
                                    <Users className="h-6 w-6 text-purple-600" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-sm bg-white overflow-hidden group">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Активные</p>
                                    <p className="text-3xl font-black text-emerald-600">{stats.active}</p>
                                </div>
                                <div className="h-12 w-12 rounded-2xl bg-emerald-50 flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
                                    <UserCheck className="h-6 w-6 text-emerald-600" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-sm bg-white overflow-hidden group">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Уволенные</p>
                                    <p className="text-3xl font-black text-orange-600">{stats.dismissed}</p>
                                </div>
                                <div className="h-12 w-12 rounded-2xl bg-orange-50 flex items-center justify-center group-hover:bg-orange-100 transition-colors">
                                    <UserMinus className="h-6 w-6 text-orange-600" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Filters and List */}
                <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
                        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full sm:w-auto">
                            <TabsList className="grid w-full grid-cols-2 bg-muted/50 p-1">
                                <TabsTrigger value="active" className="text-xs font-bold uppercase tracking-tight data-[state=active]:bg-white data-[state=active]:text-purple-600">
                                    Активные
                                </TabsTrigger>
                                <TabsTrigger value="dismissed" className="text-xs font-bold uppercase tracking-tight data-[state=active]:bg-white data-[state=active]:text-orange-600">
                                    Уволенные
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>

                        <div className="relative w-full sm:w-80">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input 
                                placeholder="Поиск по имени или телефону..." 
                                className="pl-10 bg-white border-muted-foreground/10 focus:border-purple-500/50"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>

                    <Card className="border-none shadow-xl shadow-purple-900/5 overflow-hidden rounded-2xl">
                        <CardContent className="p-0">
                            {filteredEmployees.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20 bg-white">
                                    <div className="h-16 w-16 rounded-full bg-purple-50 flex items-center justify-center mb-4">
                                        <Search className="h-8 w-8 text-purple-300" />
                                    </div>
                                    <h3 className="text-lg font-bold">Никого не нашли</h3>
                                    <p className="text-sm text-muted-foreground">Попробуйте изменить поисковый запрос или фильтры</p>
                                    {searchQuery && (
                                        <Button variant="link" onClick={() => setSearchQuery('')} className="text-purple-600 mt-2">
                                            Сбросить поиск
                                        </Button>
                                    )}
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader className="bg-muted/30">
                                        <TableRow className="hover:bg-transparent border-muted-foreground/5">
                                            <TableHead className="text-xs font-bold uppercase tracking-widest text-muted-foreground py-4">Сотрудник</TableHead>
                                            <TableHead className="text-xs font-bold uppercase tracking-widest text-muted-foreground py-4">Должность</TableHead>
                                            <TableHead className="text-xs font-bold uppercase tracking-widest text-muted-foreground py-4">Зарплата</TableHead>
                                            <TableHead className="text-xs font-bold uppercase tracking-widest text-muted-foreground py-4">Нанят</TableHead>
                                            <TableHead className="text-xs font-bold uppercase tracking-widest text-muted-foreground py-4 text-right">Действия</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody className="bg-white">
                                        {filteredEmployees.map((employee) => (
                                            <TableRow key={employee.id} className="group hover:bg-purple-50/30 border-muted-foreground/5 transition-colors">
                                                <TableCell className="py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="space-y-0.5">
                                                            <div className="font-bold text-sm tracking-tight">{employee.full_name}</div>
                                                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                                {employee.phone_number}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 font-bold text-[10px] uppercase tracking-wider px-2 py-0.5">
                                                        {employee.role}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col gap-1.5 max-w-[180px]">
                                                        <Select
                                                            value={employee.salary_scheme_id?.toString() || "none"}
                                                            onValueChange={(v) => handleAssignScheme(employee.id, v === "none" ? null : parseInt(v))}
                                                        >
                                                            <SelectTrigger className="h-8 text-xs font-medium border-muted-foreground/10 hover:border-purple-200 transition-colors bg-white">
                                                                <SelectValue placeholder="Схема не выбрана" />
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
                                                </TableCell>
                                                <TableCell>
                                                    <div className="space-y-0.5">
                                                        <div className="text-xs font-bold text-foreground">
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
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-purple-100 hover:text-purple-600">
                                                                <MoreHorizontal className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="w-48 rounded-xl border-muted-foreground/10 shadow-xl shadow-purple-900/5">
                                                            <DropdownMenuItem onClick={() => handleEditEmployee(employee)} className="text-xs font-medium cursor-pointer py-2 gap-2">
                                                                <Pencil className="h-3.5 w-3.5" /> Редактировать
                                                            </DropdownMenuItem>
                                                            {employee.is_active && !employee.dismissed_at ? (
                                                                <DropdownMenuItem onClick={() => handleDismissEmployee(employee.id)} className="text-xs font-medium cursor-pointer py-2 gap-2 text-red-600 focus:text-red-600 focus:bg-red-50">
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
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Add Employee Modal */}
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="sm:max-w-[425px] rounded-2xl border-none shadow-2xl">
                    <DialogHeader className="space-y-3">
                        <div className="h-12 w-12 rounded-2xl bg-purple-50 flex items-center justify-center">
                            <UserPlus className="h-6 w-6 text-purple-600" />
                        </div>
                        <div>
                            <DialogTitle className="text-xl font-bold">Добавить сотрудника</DialogTitle>
                            <DialogDescription className="text-xs font-medium">
                                Заполните данные для создания нового аккаунта
                            </DialogDescription>
                        </div>
                    </DialogHeader>

                    <form onSubmit={handleAddEmployee} className="space-y-5 pt-4">
                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="fullName" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Полное имя</Label>
                                <Input
                                    id="fullName"
                                    placeholder="Напр: Иван Иванов"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    className="bg-muted/30 border-muted-foreground/10 focus:border-purple-500/50"
                                    required
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="phoneNumber" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Номер телефона</Label>
                                <PhoneInput
                                    id="phoneNumber"
                                    placeholder="+7 (999) 000-00-00"
                                    value={phoneNumber}
                                    onChange={setPhoneNumber}
                                    className="bg-muted/30 border-muted-foreground/10 focus:border-purple-500/50"
                                    required
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="role" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Должность</Label>
                                <Select 
                                    value={selectedRoleId?.toString() || ""} 
                                    onValueChange={(v) => setSelectedRoleId(parseInt(v))}
                                >
                                    <SelectTrigger className="bg-muted/30 border-muted-foreground/10 focus:border-purple-500/50 h-10">
                                        <SelectValue placeholder="Выберите должность" />
                                    </SelectTrigger>
                                    <SelectContent>
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
                                className="w-full bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-200"
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
                <DialogContent className="sm:max-w-[425px] rounded-2xl border-none shadow-2xl">
                    <DialogHeader className="space-y-3">
                        <div className="h-12 w-12 rounded-2xl bg-blue-50 flex items-center justify-center">
                            <Pencil className="h-6 w-6 text-blue-600" />
                        </div>
                        <div>
                            <DialogTitle className="text-xl font-bold">Редактировать профиль</DialogTitle>
                            <DialogDescription className="text-xs font-medium">
                                Обновите контактные данные или роль сотрудника
                            </DialogDescription>
                        </div>
                    </DialogHeader>

                    <form onSubmit={handleUpdateEmployee} className="space-y-5 pt-4">
                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="editFullName" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Полное имя</Label>
                                <Input
                                    id="editFullName"
                                    value={editFullName}
                                    onChange={(e) => setEditFullName(e.target.value)}
                                    className="bg-muted/30 border-muted-foreground/10 focus:border-purple-500/50"
                                    required
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="editPhoneNumber" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Номер телефона</Label>
                                <PhoneInput
                                    id="editPhoneNumber"
                                    value={editPhoneNumber}
                                    onChange={setEditPhoneNumber}
                                    className="bg-muted/30 border-muted-foreground/10 focus:border-purple-500/50"
                                    required
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="editRole" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Должность</Label>
                                <Select 
                                    value={editRoleId?.toString() || ""} 
                                    onValueChange={(v) => setEditRoleId(parseInt(v))}
                                >
                                    <SelectTrigger className="bg-muted/30 border-muted-foreground/10 focus:border-purple-500/50 h-10">
                                        <SelectValue placeholder="Выберите должность" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {roles.map((role) => (
                                            <SelectItem key={role.id} value={role.id.toString()}>
                                                {role.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="editPassword" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Новый пароль</Label>
                                <Input
                                        id="editPassword"
                                        type="password"
                                        placeholder="Оставьте пустым, чтобы не менять"
                                        value={editPassword}
                                        onChange={(e) => setEditPassword(e.target.value)}
                                        className="bg-muted/30 border-muted-foreground/10 focus:border-purple-500/50"
                                    />
                                </div>

                                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-muted-foreground/5">
                                    <div className="space-y-0.5">
                                        <Label htmlFor="showInSchedule" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">График работы</Label>
                                        <p className="text-[10px] text-muted-foreground">Отображать сотрудника в сетке расписания</p>
                                    </div>
                                    <Switch
                                        id="showInSchedule"
                                        checked={editShowInSchedule}
                                        onCheckedChange={setEditShowInSchedule}
                                        className="data-[state=checked]:bg-purple-600"
                                    />
                                </div>
                            </div>

                            <DialogFooter className="pt-2">
                            <Button
                                type="submit"
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200"
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
                <DialogContent className="sm:max-w-[400px] rounded-2xl border-none shadow-2xl">
                    <DialogHeader className="space-y-3">
                        <div className="h-12 w-12 rounded-2xl bg-orange-50 flex items-center justify-center">
                            <UserMinus className="h-6 w-6 text-orange-600" />
                        </div>
                        <div>
                            <DialogTitle className="text-xl font-bold">Увольнение сотрудника</DialogTitle>
                            <DialogDescription className="text-xs font-medium">
                                Выберите последний рабочий день сотрудника
                            </DialogDescription>
                        </div>
                    </DialogHeader>

                    <div className="py-4 space-y-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="dismissDate" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Дата увольнения</Label>
                            <Input
                                id="dismissDate"
                                type="date"
                                value={dismissalDate}
                                onChange={(e) => setDismissalDate(e.target.value)}
                                className="bg-muted/30 border-muted-foreground/10"
                            />
                        </div>
                        <div className="bg-orange-50 border border-orange-100 p-4 rounded-xl space-y-2">
                            <p className="text-[11px] text-orange-700 leading-relaxed font-medium">
                                С этой даты сотрудник больше не сможет выходить в смены, но его история работы останется в архиве.
                            </p>
                        </div>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            variant="ghost"
                            onClick={() => setIsDismissModalOpen(false)}
                            disabled={isSubmitting}
                            className="flex-1 text-xs font-bold uppercase tracking-widest"
                        >
                            Отмена
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleConfirmDismiss}
                            disabled={isSubmitting}
                            className="flex-1 text-xs font-bold uppercase tracking-widest shadow-lg shadow-red-200"
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
                <DialogContent className="sm:max-w-[400px] rounded-2xl border-none shadow-2xl">
                    <DialogHeader className="space-y-3">
                        <div className="h-12 w-12 rounded-2xl bg-emerald-50 flex items-center justify-center">
                            <UserCheck className="h-6 w-6 text-emerald-600" />
                        </div>
                        <div>
                            <DialogTitle className="text-xl font-bold">Восстановление сотрудника</DialogTitle>
                            <DialogDescription className="text-xs font-medium">
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
                            className="flex-1 text-xs font-bold uppercase tracking-widest"
                        >
                            Отмена
                        </Button>
                        <Button
                            onClick={handleConfirmRestore}
                            disabled={isSubmitting}
                            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold uppercase tracking-widest shadow-lg shadow-emerald-200"
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
        </div>
    )
}
