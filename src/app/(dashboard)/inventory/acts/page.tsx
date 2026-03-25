'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { RoleDashboardLayout } from '@/components/layout/role-dashboard-layout'
import {
  FileText, Clock, CheckCircle, XCircle, AlertTriangle,
  Package, User, Calendar, ChevronRight, RefreshCw, Filter,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { cn } from '@/lib/utils'

const STATUS_CONFIG = {
  PENDING:  { label: 'Pendiente',  color: 'bg-yellow-100 text-yellow-800 border-yellow-300', icon: Clock },
  ACCEPTED: { label: 'Aceptada',   color: 'bg-green-100 text-green-800 border-green-300',   icon: CheckCircle },
  REJECTED: { label: 'Rechazada',  color: 'bg-red-100 text-red-800 border-red-300',          icon: XCircle },
  EXPIRED:  { label: 'Expirada',   color: 'bg-gray-100 text-gray-600 border-gray-300',       icon: AlertTriangle },
}

const ROLE_LABEL: Record<string, string> = {
  deliverer: 'Entregador',
  receiver:  'Receptor',
  both:      'Entregador y Receptor',
  admin:     'Administrador',
}

const STATUS_FILTERS = ['all', 'PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED'] as const

function fmtDate(d: string | Date) {
  return format(new Date(d), "d MMM yyyy", { locale: es })
}

export default function ActsListPage() {
  const { data: session } = useSession()
  const router = useRouter()

  const [acts, setActs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [pagination, setPagination] = useState({ page: 1, total: 0, pages: 1 })

  const fetchActs = useCallback(async (page = 1, status = statusFilter) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20', status })
      const res = await fetch(`/api/inventory/acts?${params}`, { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()
      setActs(data.acts ?? [])
      setPagination(data.pagination)
    } catch { /* silencioso */ }
    finally { setLoading(false) }
  }, [statusFilter])

  useEffect(() => { fetchActs(1, statusFilter) }, [statusFilter])

  const handleFilterChange = (s: string) => {
    setStatusFilter(s)
    fetchActs(1, s)
  }

  const pendingCount = acts.filter(a => a.status === 'PENDING').length

  return (
    <RoleDashboardLayout
      title="Actas de Entrega"
      subtitle={pendingCount > 0 ? `${pendingCount} pendiente${pendingCount > 1 ? 's' : ''} de firma` : 'Historial de actas de entrega de equipos'}
      headerActions={
        <Button variant="outline" size="sm" onClick={() => fetchActs(1, statusFilter)} disabled={loading}>
          <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
          Actualizar
        </Button>
      }
    >
      <div className="max-w-4xl mx-auto space-y-4">

        {/* Filtros de estado */}
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
              {STATUS_FILTERS.map(s => {
                const cfg = s !== 'all' ? STATUS_CONFIG[s as keyof typeof STATUS_CONFIG] : null
                return (
                  <Button
                    key={s}
                    variant={statusFilter === s ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => handleFilterChange(s)}
                  >
                    {s === 'all' ? `Todas (${pagination.total})` : cfg?.label}
                  </Button>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Lista */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : acts.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <FileText className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground">
                {statusFilter === 'all' ? 'No tienes actas de entrega aún' : `No hay actas con estado "${STATUS_CONFIG[statusFilter as keyof typeof STATUS_CONFIG]?.label}"`}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {acts.map(act => {
              const cfg = STATUS_CONFIG[act.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.PENDING
              const StatusIcon = cfg.icon
              const isPending = act.status === 'PENDING'
              const isMyAction = isPending && act.userRole === 'receiver'

              return (
                <Card
                  key={act.id}
                  className={cn(
                    'cursor-pointer transition-all hover:shadow-md border-l-4',
                    isMyAction ? 'border-l-yellow-400 bg-yellow-50/20' : 'border-l-transparent'
                  )}
                  onClick={() => router.push(`/inventory/acts/${act.id}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        {/* Folio + estado */}
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <span className="font-mono font-semibold text-sm">{act.folio}</span>
                          <Badge className={cn('flex items-center gap-1 text-xs px-2 py-0.5 border', cfg.color)}>
                            <StatusIcon className="h-3 w-3" />
                            {cfg.label}
                          </Badge>
                          {isMyAction && (
                            <Badge className="text-xs bg-yellow-500 text-white border-0">
                              Requiere tu firma
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-xs">
                            {ROLE_LABEL[act.userRole] ?? act.userRole}
                          </Badge>
                        </div>

                        {/* Equipo */}
                        <div className="flex items-center gap-1.5 text-sm mb-1">
                          <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="font-medium">{act.equipmentSnapshot?.code}</span>
                          <span className="text-muted-foreground">—</span>
                          <span className="text-muted-foreground truncate">
                            {act.equipmentSnapshot?.brand} {act.equipmentSnapshot?.model}
                          </span>
                        </div>

                        {/* Participantes */}
                        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            Entrega: <strong className="text-foreground ml-0.5">{act.delivererInfo?.name}</strong>
                          </span>
                          <ChevronRight className="h-3 w-3" />
                          <span className="flex items-center gap-1">
                            Recibe: <strong className="text-foreground ml-0.5">{act.receiverInfo?.name}</strong>
                          </span>
                        </div>
                      </div>

                      {/* Fechas */}
                      <div className="text-right text-xs text-muted-foreground shrink-0 space-y-1">
                        <div className="flex items-center gap-1 justify-end">
                          <Calendar className="h-3 w-3" />
                          {fmtDate(act.createdAt)}
                        </div>
                        {isPending && (
                          <div className={cn(
                            'text-xs',
                            new Date(act.expirationDate) < new Date() ? 'text-red-500 font-medium' : 'text-muted-foreground'
                          )}>
                            Expira: {fmtDate(act.expirationDate)}
                          </div>
                        )}
                        {act.acceptedAt && (
                          <div className="text-green-600 text-xs">Firmada: {fmtDate(act.acceptedAt)}</div>
                        )}
                        <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        {/* Paginación */}
        {pagination.pages > 1 && (
          <div className="flex justify-center gap-2">
            <Button
              variant="outline" size="sm"
              disabled={pagination.page <= 1 || loading}
              onClick={() => fetchActs(pagination.page - 1)}
            >
              Anterior
            </Button>
            <span className="flex items-center text-sm text-muted-foreground px-2">
              Página {pagination.page} de {pagination.pages}
            </span>
            <Button
              variant="outline" size="sm"
              disabled={pagination.page >= pagination.pages || loading}
              onClick={() => fetchActs(pagination.page + 1)}
            >
              Siguiente
            </Button>
          </div>
        )}
      </div>
    </RoleDashboardLayout>
  )
}
