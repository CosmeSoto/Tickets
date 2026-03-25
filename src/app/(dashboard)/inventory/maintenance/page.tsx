'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  Wrench, Plus, Clock, Calendar, CheckCircle, XCircle, ThumbsUp,
  Loader2, Filter, Search, Package,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RoleDashboardLayout } from '@/components/layout/role-dashboard-layout'
import { NewMaintenanceDialog } from '@/components/inventory/new-maintenance-dialog'

interface MaintenanceItem {
  id: string
  type: string
  status: string
  description: string
  date: string
  createdAt: string
  equipment: { id: string; code: string; brand: string; model: string; status: string; type: { name: string } | null }
  technician: { id: string; name: string } | null
  requestedBy: { id: string; name: string } | null
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  REQUESTED: { label: 'Solicitado',  color: 'bg-blue-100 text-blue-800',    icon: <Clock className="h-3 w-3" /> },
  SCHEDULED: { label: 'Programado',  color: 'bg-yellow-100 text-yellow-800', icon: <Calendar className="h-3 w-3" /> },
  ACCEPTED:  { label: 'Aceptado',    color: 'bg-purple-100 text-purple-800', icon: <ThumbsUp className="h-3 w-3" /> },
  COMPLETED: { label: 'Completado',  color: 'bg-green-100 text-green-800',   icon: <CheckCircle className="h-3 w-3" /> },
  CANCELLED: { label: 'Cancelado',   color: 'bg-gray-100 text-gray-600',     icon: <XCircle className="h-3 w-3" /> },
}

const TYPE_LABELS: Record<string, string> = { PREVENTIVE: 'Preventivo', CORRECTIVE: 'Correctivo' }

export default function MaintenanceListPage() {
  const { data: session } = useSession()
  const router = useRouter()

  const [records, setRecords] = useState<MaintenanceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [showNew, setShowNew] = useState(false)

  const role = session?.user?.role
  const isClient = role === 'CLIENT'
  const isAdminOrTech = role === 'ADMIN' || role === 'TECHNICIAN'

  const fetchRecords = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'ALL') params.set('status', statusFilter)
      if (typeFilter !== 'ALL') params.set('type', typeFilter)
      const res = await fetch(`/api/inventory/maintenance?${params}`, { cache: 'no-store' })
      if (res.ok) setRecords(await res.json())
    } finally {
      setLoading(false)
    }
  }, [statusFilter, typeFilter])

  useEffect(() => { fetchRecords() }, [fetchRecords])

  const filtered = records.filter(r => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      r.equipment.code.toLowerCase().includes(q) ||
      r.equipment.brand.toLowerCase().includes(q) ||
      r.equipment.model.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q) ||
      r.technician?.name.toLowerCase().includes(q) ||
      r.requestedBy?.name.toLowerCase().includes(q)
    )
  })

  // Contadores por estado para el cliente (acciones pendientes)
  const pendingAction = isClient
    ? records.filter(r => r.status === 'SCHEDULED').length
    : records.filter(r => r.status === 'REQUESTED').length

  const title = isClient ? 'Mis Mantenimientos' : 'Mantenimientos'
  const subtitle = isClient
    ? 'Historial de mantenimientos de tus equipos'
    : 'Gestión de mantenimientos preventivos y correctivos'

  return (
    <RoleDashboardLayout
      title={title}
      subtitle={subtitle}
      headerActions={
        isAdminOrTech ? (
          <Button onClick={() => setShowNew(true)}>
            <Plus className="mr-2 h-4 w-4" /> Nuevo Mantenimiento
          </Button>
        ) : (
          <Button onClick={() => setShowNew(true)} variant="outline">
            <Plus className="mr-2 h-4 w-4" /> Solicitar Mantenimiento
          </Button>
        )
      }
    >
      <div className="space-y-4">
        {/* Banner de acciones pendientes */}
        {pendingAction > 0 && (
          <div className={`rounded-lg px-4 py-3 flex items-center gap-3 text-sm ${
            isClient ? 'bg-yellow-50 border border-yellow-200 text-yellow-800' : 'bg-blue-50 border border-blue-200 text-blue-800'
          }`}>
            <Clock className="h-4 w-4 shrink-0" />
            {isClient
              ? `Tienes ${pendingAction} mantenimiento${pendingAction > 1 ? 's' : ''} programado${pendingAction > 1 ? 's' : ''} esperando tu confirmación.`
              : `Hay ${pendingAction} solicitud${pendingAction > 1 ? 'es' : ''} de mantenimiento pendiente${pendingAction > 1 ? 's' : ''} de aprobación.`}
          </div>
        )}

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por equipo, técnico, descripción..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-44">
              <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos los estados</SelectItem>
              <SelectItem value="REQUESTED">Solicitado</SelectItem>
              <SelectItem value="SCHEDULED">Programado</SelectItem>
              <SelectItem value="ACCEPTED">Aceptado</SelectItem>
              <SelectItem value="COMPLETED">Completado</SelectItem>
              <SelectItem value="CANCELLED">Cancelado</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos los tipos</SelectItem>
              <SelectItem value="PREVENTIVE">Preventivo</SelectItem>
              <SelectItem value="CORRECTIVE">Correctivo</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Lista */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 space-y-2">
            <Wrench className="h-10 w-10 text-muted-foreground mx-auto" />
            <p className="text-muted-foreground">
              {search || statusFilter !== 'ALL' || typeFilter !== 'ALL'
                ? 'No hay mantenimientos que coincidan con los filtros.'
                : isClient
                  ? 'No tienes mantenimientos registrados. Puedes solicitar uno desde un equipo asignado.'
                  : 'No hay mantenimientos registrados.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(record => {
              const statusCfg = STATUS_CONFIG[record.status] || STATUS_CONFIG.SCHEDULED
              const needsAction =
                (isClient && record.status === 'SCHEDULED') ||
                (isAdminOrTech && record.status === 'REQUESTED')

              return (
                <Card
                  key={record.id}
                  className={`cursor-pointer hover:shadow-md transition-shadow ${needsAction ? 'ring-2 ring-primary/30' : ''}`}
                  onClick={() => router.push(`/inventory/maintenance/${record.id}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className={`p-2 rounded-lg shrink-0 ${record.type === 'CORRECTIVE' ? 'bg-red-50' : 'bg-blue-50'}`}>
                          <Wrench className={`h-4 w-4 ${record.type === 'CORRECTIVE' ? 'text-red-600' : 'text-blue-600'}`} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm">{record.equipment.code}</span>
                            <span className="text-muted-foreground text-sm">
                              {record.equipment.brand} {record.equipment.model}
                            </span>
                            {needsAction && (
                              <Badge className="bg-primary/10 text-primary text-xs">
                                {isClient ? 'Requiere tu confirmación' : 'Pendiente de aprobación'}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-0.5 truncate max-w-md">
                            {record.description}
                          </p>
                          <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(record.date).toLocaleDateString('es-EC', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                            {record.technician && (
                              <span className="flex items-center gap-1">
                                <Wrench className="h-3 w-3" />
                                {record.technician.name}
                              </span>
                            )}
                            {record.requestedBy && (
                              <span className="flex items-center gap-1">
                                <Package className="h-3 w-3" />
                                Solicitado por {record.requestedBy.name}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className="text-xs">
                          {TYPE_LABELS[record.type] || record.type}
                        </Badge>
                        <Badge className={`${statusCfg.color} flex items-center gap-1 text-xs`}>
                          {statusCfg.icon}
                          {statusCfg.label}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {showNew && (
        <NewMaintenanceDialog
          open={showNew}
          onClose={() => setShowNew(false)}
          onCreated={() => { setShowNew(false); fetchRecords() }}
          isClient={isClient}
        />
      )}
    </RoleDashboardLayout>
  )
}
