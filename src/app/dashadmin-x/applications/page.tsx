"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Check, X, Clock, Mail, Phone, Building2, MapPin, Loader2 } from 'lucide-react'

type Application = {
    id: string
    full_name: string
    phone_number: string | null
    email: string
    club_name: string | null
    city: string | null
    comment: string | null
    status: 'pending' | 'approved' | 'rejected'
    created_at: string
}

export default function SuperAdminApplicationsPage() {
    const [applications, setApplications] = useState<Application[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [updatingId, setUpdatingId] = useState<string | null>(null)

    const fetchApplications = async () => {
        try {
            const res = await fetch('/api/dashadmin-x/applications')
            const data = await res.json()
            if (res.ok) {
                setApplications(data.applications || [])
            }
        } catch (err) {
            console.error(err)
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        fetchApplications()
    }, [])

    const handleUpdateStatus = async (id: string, status: 'approved' | 'rejected') => {
        setUpdatingId(id)
        try {
            const res = await fetch('/api/dashadmin-x/applications', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, status })
            })
            if (res.ok) {
                fetchApplications()
            }
        } catch (err) {
            console.error(err)
        } finally {
            setUpdatingId(null)
        }
    }

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'approved':
                return <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">Одобрена</Badge>
            case 'rejected':
                return <Badge className="bg-red-500/10 text-red-400 border-red-500/20">Отклонена</Badge>
            default:
                return <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20">Ожидает решения</Badge>
        }
    }

    return (
        <div className="p-8 space-y-6 max-w-7xl mx-auto">
            <div>
                <h1 className="text-3xl font-bold text-white tracking-tight">Заявки на подключение</h1>
                <p className="text-zinc-400 text-sm mt-1">Просмотр и рассмотрение новых заявок от владельцев клубов</p>
            </div>

            {isLoading ? (
                <div className="py-12 flex justify-center text-zinc-400">
                    <Loader2 className="w-6 h-6 animate-spin" />
                </div>
            ) : applications.length === 0 ? (
                <Card className="bg-zinc-900 border-zinc-800 text-center py-12">
                    <CardContent className="text-zinc-400 text-sm">
                        Заявок пока нет
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {applications.map((app) => (
                        <div key={app.id} className="p-6 bg-zinc-900 border border-zinc-800 rounded-2xl flex flex-col md:flex-row justify-between gap-6">
                            <div className="space-y-3">
                                <div className="flex items-center gap-3">
                                    <h3 className="text-lg font-bold text-white">{app.full_name}</h3>
                                    {getStatusBadge(app.status)}
                                    <span className="text-xs text-zinc-500 flex items-center gap-1 ml-auto md:ml-0">
                                        <Clock className="w-3.5 h-3.5" />
                                        {new Date(app.created_at).toLocaleString('ru-RU')}
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs text-zinc-300">
                                    <div className="flex items-center gap-2">
                                        <Mail className="w-4 h-4 text-blue-400 shrink-0" />
                                        <span className="truncate">{app.email}</span>
                                    </div>
                                    {app.phone_number && (
                                        <div className="flex items-center gap-2">
                                            <Phone className="w-4 h-4 text-emerald-400 shrink-0" />
                                            <span>{app.phone_number}</span>
                                        </div>
                                    )}
                                    {app.club_name && (
                                        <div className="flex items-center gap-2">
                                            <Building2 className="w-4 h-4 text-purple-400 shrink-0" />
                                            <span>{app.club_name}</span>
                                        </div>
                                    )}
                                    {app.city && (
                                        <div className="flex items-center gap-2">
                                            <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
                                            <span>{app.city}</span>
                                        </div>
                                    )}
                                </div>

                                {app.comment && (
                                    <div className="p-3 bg-zinc-950/60 border border-zinc-800/80 rounded-xl text-xs text-zinc-400">
                                        {app.comment}
                                    </div>
                                )}
                            </div>

                            {app.status === 'pending' && (
                                <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                                    <Button
                                        size="sm"
                                        className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs h-9 px-4"
                                        onClick={() => handleUpdateStatus(app.id, 'approved')}
                                        disabled={updatingId === app.id}
                                    >
                                        <Check className="w-4 h-4 mr-1.5" /> Одобрить
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-xl text-xs h-9 px-4"
                                        onClick={() => handleUpdateStatus(app.id, 'rejected')}
                                        disabled={updatingId === app.id}
                                    >
                                        <X className="w-4 h-4 mr-1.5" /> Отклонить
                                    </Button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
