"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Trash2, Loader2, UserPlus, Pencil } from "lucide-react"
import { PhoneInput } from "@/components/ui/phone-input"

interface Employee {
    id: string
    full_name: string
    phone_number: string
    role: string
    role_id: number | null
    hired_at: string
    is_active: boolean
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

    // Form state for add
    const [phoneNumber, setPhoneNumber] = useState('')
    const [fullName, setFullName] = useState('')
    const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null)

    // Form state for edit
    const [editFullName, setEditFullName] = useState('')
    const [editPhoneNumber, setEditPhoneNumber] = useState('')
    const [editRoleId, setEditRoleId] = useState<number | null>(null)
    const [editPassword, setEditPassword] = useState('')

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
            await fetch(`/api/clubs/${clubId}/employees/${employeeId}/salary`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ scheme_id: schemeId })
            })
            // Update local state
            setEmployees(prev => prev.map(emp =>
                emp.id === employeeId
                    ? {
                        ...emp,
                        salary_scheme_id: schemeId || undefined,
                        salary_scheme_name: salarySchemes.find(s => s.id === schemeId)?.name || undefined
                    }
                    : emp
            ))
        } catch (error) {
            console.error('Error assigning scheme:', error)
        }
    }

    const handleAddEmployee = async (e: React.FormEvent) => {
        e.preventDefault()

        // Validate phone - at least 11 digits
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

    const handleDeleteEmployee = async (employeeId: string) => {
        if (!confirm('Вы уверены, что хотите удалить этого сотрудника?')) {
            return
        }

        try {
            const res = await fetch(`/api/clubs/${clubId}/employees?employeeId=${employeeId}`, {
                method: 'DELETE',
            })

            if (res.ok) {
                fetchData(clubId)
            } else {
                alert('Не удалось удалить сотрудника')
            }
        } catch (error) {
            console.error('Error deleting employee:', error)
            alert('Ошибка удаления')
        }
    }

    const handleEditEmployee = (employee: Employee) => {
        setSelectedEmployee(employee)
        setEditFullName(employee.full_name)
        setEditPhoneNumber(employee.phone_number)
        setEditRoleId(employee.role_id)
        setEditPassword('')
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
                role_id: editRoleId
            }

            // Only include password if it was set
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

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return (
        <div className="p-8">
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Сотрудники</h1>
                    <p className="text-muted-foreground">
                        Управление персоналом клуба
                    </p>
                </div>
                <Button onClick={() => setIsModalOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Добавить сотрудника
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Список сотрудников ({employees.length})</CardTitle>
                    <CardDescription>
                        Все сотрудники, работающие в этом клубе
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {employees.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16">
                            <UserPlus className="mb-4 h-16 w-16 text-muted-foreground" />
                            <h3 className="mb-2 text-xl font-semibold">Нет сотрудников</h3>
                            <p className="mb-6 text-center text-sm text-muted-foreground">
                                Добавьте первого сотрудника, чтобы начать работу
                            </p>
                            <Button onClick={() => setIsModalOpen(true)}>
                                <Plus className="mr-2 h-4 w-4" />
                                Добавить сотрудника
                            </Button>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Имя</TableHead>
                                    <TableHead>Телефон</TableHead>
                                    <TableHead>Должность</TableHead>
                                    <TableHead>Схема оплаты</TableHead>
                                    <TableHead>Дата найма</TableHead>
                                    <TableHead>Статус</TableHead>
                                    <TableHead className="text-right">Действия</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {employees.map((employee) => (
                                    <TableRow key={employee.id}>
                                        <TableCell className="font-medium">{employee.full_name}</TableCell>
                                        <TableCell>{employee.phone_number}</TableCell>
                                        <TableCell>{employee.role}</TableCell>
                                        <TableCell>
                                            <select
                                                value={employee.salary_scheme_id || ''}
                                                onChange={(e) => handleAssignScheme(employee.id, e.target.value ? parseInt(e.target.value) : null)}
                                                className="h-8 px-2 rounded-md border border-input bg-background text-sm min-w-[140px]"
                                            >
                                                <option value="">Не выбрана</option>
                                                {salarySchemes.map(scheme => (
                                                    <option key={scheme.id} value={scheme.id}>{scheme.name}</option>
                                                ))}
                                            </select>
                                        </TableCell>
                                        <TableCell>
                                            {new Date(employee.hired_at).toLocaleDateString('ru-RU')}
                                        </TableCell>
                                        <TableCell>
                                            <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${employee.is_active
                                                ? 'bg-green-500/10 text-green-500'
                                                : 'bg-red-500/10 text-red-500'
                                                }`}>
                                                {employee.is_active ? 'Активен' : 'Неактивен'}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleEditEmployee(employee)}
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleDeleteEmployee(employee.id)}
                                                >
                                                    <Trash2 className="h-4 w-4 text-red-500" />
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

            {/* Add Employee Modal */}
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Добавить сотрудника</DialogTitle>
                        <DialogDescription>
                            Введите данные нового сотрудника
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleAddEmployee} className="mt-4 space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="fullName">Полное имя</Label>
                            <Input
                                id="fullName"
                                placeholder="Иван Иванов"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="phoneNumber">Номер телефона</Label>
                            <PhoneInput
                                id="phoneNumber"
                                placeholder="+7 (999) 000-00-00"
                                value={phoneNumber}
                                onChange={setPhoneNumber}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="role">Должность</Label>
                            <select
                                id="role"
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                value={selectedRoleId || ''}
                                onChange={(e) => setSelectedRoleId(Number(e.target.value))}
                            >
                                <option value="">Выберите должность</option>
                                {roles.map((role) => (
                                    <option key={role.id} value={role.id}>
                                        {role.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="flex gap-3 pt-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsModalOpen(false)}
                                className="flex-1"
                                disabled={isSubmitting}
                            >
                                Отмена
                            </Button>
                            <Button
                                type="submit"
                                className="flex-1"
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Добавление...
                                    </>
                                ) : (
                                    <>
                                        <UserPlus className="mr-2 h-4 w-4" />
                                        Добавить
                                    </>
                                )}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Edit Employee Modal */}
            <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Редактировать сотрудника</DialogTitle>
                        <DialogDescription>
                            Измените данные сотрудника
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleUpdateEmployee} className="mt-4 space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="editFullName">Полное имя</Label>
                            <Input
                                id="editFullName"
                                placeholder="Иван Иванов"
                                value={editFullName}
                                onChange={(e) => setEditFullName(e.target.value)}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="editPhoneNumber">Номер телефона</Label>
                            <PhoneInput
                                id="editPhoneNumber"
                                placeholder="+7 (999) 000-00-00"
                                value={editPhoneNumber}
                                onChange={setEditPhoneNumber}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="editRole">Должность</Label>
                            <select
                                id="editRole"
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                value={editRoleId || ''}
                                onChange={(e) => setEditRoleId(Number(e.target.value))}
                            >
                                <option value="">Выберите должность</option>
                                {roles.map((role) => (
                                    <option key={role.id} value={role.id}>
                                        {role.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="editPassword">Установить пароль (необязательно)</Label>
                            <Input
                                id="editPassword"
                                type="password"
                                placeholder="Минимум 6 символов"
                                value={editPassword}
                                onChange={(e) => setEditPassword(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">
                                Оставьте пустым, если не хотите менять пароль.
                                Сотрудник сможет войти используя номер телефона и этот пароль.
                            </p>
                        </div>

                        <div className="flex gap-3 pt-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsEditModalOpen(false)}
                                className="flex-1"
                                disabled={isSubmitting}
                            >
                                Отмена
                            </Button>
                            <Button
                                type="submit"
                                className="flex-1"
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Сохранение...
                                    </>
                                ) : (
                                    'Сохранить'
                                )}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    )
}
