'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { ModuleLayout } from '@/components/common/layout/module-layout'
import {
  FileText, Clock, CheckCircle, XCircle, AlertTriangle,
  Package, User, Calendar, ChevronRight, RefreshCw, Filter,
  ArrowLeftRight, Trash2, TruckIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { cn } from '@/lib/utils'

// ── Constantes compartidas ────────────────────────────────────────────────────

const STATUS_CONFIG = {
  PENDING:  { label: 'Pendiente',  color: 'bg-yellow-100 text-yellow-800 border-yellow-300', icon: Clock },
  ACCEPTED: { label: 'Aceptada',   color: 'bg-green-100 text-green-800 border-green-300',   icon: CheckCircle },
  REJECTED: { label: 'Rechazada',  color: 'bg-red-100 text-red-800 border-red-300',          icon: XCircle },
  EXPIRED:  { label: 'Expirada',   color: 'bg-muted text-muted-foreground border-border',    icon: AlertTriangle },
}

const STATUS_FILTERS = ['all', 'PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED'] as const

const CONDITION_LABELS: Record<string, string> = {
  EXCELLENT: 'Excelente', GOOD: 'Bueno', FAIR: 'Regular', POOR: 'Malo', DAMAGED: 'Dañado',
}

const CONDITION_COLORS: Record<string, string> = {
  EXCELLENT: 'text-green-700', GOOD: 'text-green-600',
  FAIR: 'text-yellow-600', POOR: 'text-orange-600', DAMAGED: 'text-red-600',
}

function fmtDate(d: string | Date) {
  return format(new Date(d), "d MMM yyyy", { locale: es })
}

// ── Tab: Actas de Entrega ─────────────────────────────────────────────────────

function DeliveryActsTab() {
  const router = useRouter()
  const [acts, setActs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
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

  const pendingCount = acts.filter(a => a.status === 'PENDING').length

  return (
    <div className="space-y-4">
      {pendingCount > 0 && (
        <div className="rounded-lg bg-yellow-50 border border-yellow-200 px-4 py-3 flex items-center gap-2 text-sm text-yellow-800">
          <Clock className="h-4 w-4 shrink-0" />
          {pendingCount} acta{pendingCount > 1 ? 's' : ''} pendiente{pendingCount > 1 ? 's' : ''} de firma
        </div>
      )}

      <StatusFilterBar
        statusFilter={statusFilter}
        total={pagination.total}
        loading={loading}
        onFilterChange={(s) => setStatusFilter(s)}
        onRefresh={() => fetchActs(1, statusFilter)}
      />

      <ActsList
        acts={acts}
        loading={loading}
        emptyMessage="No hay actas de entrega"
        renderCard={(act) => {
          const isMyAction = act.status === 'PENDING' && act.userRole === 'receiver'
          return (
            <ActCard
              key={act.id}
              act={act}
              highlight={isMyAction}
              actionBadge={isMyAction ? 'Requiere tu firma' : undefined}
              subtitle={
                <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    Entrega: <strong className="text-foreground ml-0.5">{act.delivererInfo?.name}</strong>
                  </span>
                  <ChevronRight className="h-3 w-3" />
                  <span>Recibe: <strong className="text-foreground">{act.receiverInfo?.name}</strong></span>
                </div>
              }
              onClick={() => router.push(`/inventory/acts/${act.id}`)}
            />
          )
        }}
      />

      <PaginationBar pagination={pagination} loading={loading} onPage={(p) => fetchActs(p)} />
    </div>
  )
}

// ── Tab: Actas de Devolución ──────────────────────────────────────────────────

function ReturnActsTab() {
  const router = useRouter()
  const [acts, setActs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [pagination, setPagination] = useState({ page: 1, total: 0, pages: 1 })

  const fetchActs = useCallback(async (page = 1, status = statusFilter) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20', status })
      const res = await fetch(`/api/inventory/return-acts?${params}`, { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()
      setActs(data.acts ?? [])
      setPagination(data.pagination)
    } catch { /* silencioso */ }
    finally { setLoading(false) }
  }, [statusFilter])

  useEffect(() => { fetchActs(1, statusFilter) }, [statusFilter])

  const pendingCount = acts.filter(a => a.status === 'PENDING').length

  return (
    <div className="space-y-4">
      {pendingCount > 0 && (
        <div className="rounded-lg bg-purple-50 border border-purple-200 px-4 py-3 flex items-center gap-2 text-sm text-purple-800">
          <ArrowLeftRight className="h-4 w-4 shrink-0" />
          {pendingCount} devolución{pendingCount > 1 ? 'es' : ''} pendiente{pendingCount > 1 ? 's' : ''} de firma
        </div>
      )}

      <StatusFilterBar
        statusFilter={statusFilter}
        total={pagination.total}
        loading={loading}
        onFilterChange={(s) => setStatusFilter(s)}
        onRefresh={() => fetchActs(1, statusFilter)}
      />

      <ActsList
        acts={acts}
        loading={loading}
        emptyMessage="No hay actas de devolución"
        renderCard={(act) => {
          const isMyAction = act.status === 'PENDING' && act.userRole === 'returner'
          const condition = act.returnCondition
          return (
            <ActCard
              key={act.id}
              act={act}
              highlight={isMyAction}
              accentColor="purple"
              actionBadge={isMyAction ? 'Requiere tu firma' : undefined}
              extraBadge={
                condition ? (
                  <span className={cn('text-xs font-medium', CONDITION_COLORS[condition] ?? '')}>
                    {CONDITION_LABELS[condition] ?? condition}
                  </span>
                ) : undefined
              }
              subtitle={
                <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    Devuelve: <strong className="text-foreground ml-0.5">{act.receiverInfo?.name}</strong>
                  </span>
                  <ChevronRight className="h-3 w-3" />
                  <span>Recibe: <strong className="text-foreground">{act.delivererInfo?.name}</strong></span>
                </div>
              }
              onClick={() => router.push(`/inventory/acts/return/${act.id}`)}
            />
          )
        }}
      />

      <PaginationBar pagination={pagination} loading={loading} onPage={(p) => fetchActs(p)} />
    </div>
  )
}

// ── Tab: Actas de Baja ────────────────────────────────────────────────────────

function DecommissionActsTab() {
  const router = useRouter()
  const [acts, setActs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [pagination, setPagination] = useState({ page: 1, total: 0, pages: 1 })

  const DECOMMISSION_STATUS = {
    PENDING:  { label: 'Pendiente',  color: 'bg-yellow-100 text-yellow-800 border-yellow-300', icon: Clock },
    APPROVED: { label: 'Aprobada',   color: 'bg-green-100 text-green-800 border-green-300',   icon: CheckCircle },
    REJECTED: { label: 'Rechazada',  color: 'bg-red-100 text-red-800 border-red-300',          icon: XCircle },
  }

  const fetchActs = useCallback(async (page = 1, status = statusFilter) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (status !== 'all') params.set('status', status)
      const res = await fetch(`/api/inventory/decommission-acts?${params}`, { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()
      setActs(data.requests ?? [])
      setPagination({ page, total: data.total ?? 0, pages: Math.ceil((data.total ?? 0) / 20) })
    } catch { /* silencioso */ }
    finally { setLoading(false) }
  }, [statusFilter])

  useEffect(() => { fetchActs(1, statusFilter) }, [statusFilter])

  const pendingCount = acts.filter(a => a.status === 'PENDING').length

  return (
    <div className="space-y-4">
      {pendingCount > 0 && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 flex items-center gap-2 text-sm text-red-800">
          <Trash2 className="h-4 w-4 shrink-0" />
          {pendingCount} solicitud{pendingCount > 1 ? 'es' : ''} de baja pendiente{pendingCount > 1 ? 's' : ''} de aprobación
        </div>
      )}

      {/* Filtros de estado para bajas */}
      <Card>
        <CardContent className="p-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
            {(['all', 'PENDING', 'APPROVED', 'REJECTED'] as const).map(s => (
              <Button
                key={s}
                variant={statusFilter === s ? 'default' : 'outline'}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setStatusFilter(s)}
              >
                {s === 'all'
                  ? `Todas (${pagination.total})`
                  : DECOMMISSION_STATUS[s as keyof typeof DECOMMISSION_STATUS]?.label ?? s}
              </Button>
            ))}
            <div className="ml-auto">
              <Button variant="ghost" size="sm" onClick={() => fetchActs(1, statusFilter)} disabled={loading} className="h-7">
                <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />)}
        </div>
      ) : acts.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Trash2 className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground">No hay solicitudes de baja</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {acts.map((req: any) => {
            const statusCfg = DECOMMISSION_STATUS[req.status as keyof typeof DECOMMISSION_STATUS] ?? DECOMMISSION_STATUS.PENDING
            const StatusIcon = statusCfg.icon
            const assetName = req.equipment
              ? `${req.equipment.code} — ${req.equipment.brand} ${req.equipment.model}`
              : req.license?.name ?? '—'

            return (
              <Card
                key={req.id}
                className={cn(
                  'cursor-pointer transition-all hover:shadow-md border-l-4',
                  req.status === 'PENDING' ? 'border-l-red-400' : 'border-l-transparent'
                )}
                onClick={() => router.push(`/inventory/decommission`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        {req.act?.folio && (
                          <span className="font-mono font-semibold text-sm">{req.act.folio}</span>
                        )}
                        <Badge className={cn('flex items-center gap-1 text-xs px-2 py-0.5 border', statusCfg.color)}>
                          <StatusIcon className="h-3 w-3" />
                          {statusCfg.label}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {req.assetType === 'EQUIPMENT' ? 'Equipo' : 'Licencia'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1.5 text-sm mb-1">
                        <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="font-medium truncate">{assetName}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          Solicitado por: <strong className="text-foreground ml-0.5">{req.requester?.name}</strong>
                        </span>
                        {req.reviewer && (
                          <span>Revisado por: <strong className="text-foreground">{req.reviewer.name}</strong></span>
                        )}
                      </div>
                    </div>
                    <div className="text-right text-xs text-muted-foreground shrink-0 space-y-1">
                      <div className="flex items-center gap-1 justify-end">
                        <Calendar className="h-3 w-3" />
                        {fmtDate(req.createdAt)}
                      </div>
                      {req.reviewedAt && (
                        <div className="text-xs">Revisada: {fmtDate(req.reviewedAt)}</div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <PaginationBar pagination={pagination} loading={loading} onPage={(p) => fetchActs(p)} />
    </div>
  )
}

// ── Componentes compartidos ───────────────────────────────────────────────────

function StatusFilterBar({
  statusFilter, total, loading, onFilterChange, onRefresh,
}: {
  statusFilter: string
  total: number
  loading: boolean
  onFilterChange: (s: string) => void
  onRefresh: () => void
}) {
  return (
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
                onClick={() => onFilterChange(s)}
              >
                {s === 'all' ? `Todas (${total})` : cfg?.label}
              </Button>
            )
          })}
          <div className="ml-auto">
            <Button variant="ghost" size="sm" onClick={onRefresh} disabled={loading} className="h-7">
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function ActsList({
  acts, loading, emptyMessage, renderCard,
}: {
  acts: any[]
  loading: boolean
  emptyMessage: string
  renderCard: (act: any) => React.ReactNode
}) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />)}
      </div>
    )
  }
  if (acts.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <FileText className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground">{emptyMessage}</p>
        </CardContent>
      </Card>
    )
  }
  return <div className="space-y-3">{acts.map(renderCard)}</div>
}

function ActCard({
  act, highlight, accentColor = 'yellow', actionBadge, extraBadge, subtitle, onClick,
}: {
  act: any
  highlight?: boolean
  accentColor?: 'yellow' | 'purple'
  actionBadge?: string
  extraBadge?: React.ReactNode
  subtitle: React.ReactNode
  onClick: () => void
}) {
  const cfg = STATUS_CONFIG[act.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.PENDING
  const StatusIcon = cfg.icon
  const borderColor = highlight
    ? accentColor === 'purple' ? 'border-l-purple-400 bg-purple-50/10' : 'border-l-yellow-400 bg-yellow-50/20'
    : 'border-l-transparent'
  const badgeColor = accentColor === 'purple'
    ? 'bg-purple-500 text-white border-0'
    : 'bg-yellow-500 text-white border-0'

  return (
    <Card
      className={cn('cursor-pointer transition-all hover:shadow-md border-l-4', borderColor)}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className="font-mono font-semibold text-sm">{act.folio}</span>
              <Badge className={cn('flex items-center gap-1 text-xs px-2 py-0.5 border', cfg.color)}>
                <StatusIcon className="h-3 w-3" />
                {cfg.label}
              </Badge>
              {actionBadge && <Badge className={cn('text-xs', badgeColor)}>{actionBadge}</Badge>}
              {extraBadge}
            </div>
            <div className="flex items-center gap-1.5 text-sm mb-1">
              <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="font-medium">{act.equipmentSnapshot?.code ?? act.equipment?.code}</span>
              <span className="text-muted-foreground">—</span>
              <span className="text-muted-foreground truncate">
                {act.equipmentSnapshot?.brand ?? act.equipment?.brand}{' '}
                {act.equipmentSnapshot?.model ?? act.equipment?.model}
              </span>
            </div>
            {subtitle}
          </div>
          <div className="text-right text-xs text-muted-foreground shrink-0 space-y-1">
            <div className="flex items-center gap-1 justify-end">
              <Calendar className="h-3 w-3" />
              {fmtDate(act.createdAt)}
            </div>
            {act.status === 'PENDING' && act.expirationDate && (
              <div className={cn(
                'text-xs',
                new Date(act.expirationDate) < new Date() ? 'text-red-500 font-medium' : 'text-muted-foreground'
              )}>
                Expira: {fmtDate(act.expirationDate)}
              </div>
            )}
            {act.acceptedAt && <div className="text-green-600 text-xs">Firmada: {fmtDate(act.acceptedAt)}</div>}
            <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function PaginationBar({
  pagination, loading, onPage,
}: {
  pagination: { page: number; pages: number }
  loading: boolean
  onPage: (p: number) => void
}) {
  if (pagination.pages <= 1) return null
  return (
    <div className="flex justify-center gap-2">
      <Button variant="outline" size="sm" disabled={pagination.page <= 1 || loading} onClick={() => onPage(pagination.page - 1)}>
        Anterior
      </Button>
      <span className="flex items-center text-sm text-muted-foreground px-2">
        Página {pagination.page} de {pagination.pages}
      </span>
      <Button variant="outline" size="sm" disabled={pagination.page >= pagination.pages || loading} onClick={() => onPage(pagination.page + 1)}>
        Siguiente
      </Button>
    </div>
  )
}

// ── Tabs config ───────────────────────────────────────────────────────────────

const TABS = [
  { key: 'delivery',     label: 'Actas de Entrega',    icon: TruckIcon },
  { key: 'return',       label: 'Actas de Devolución', icon: ArrowLeftRight },
  { key: 'decommission', label: 'Actas de Baja',       icon: Trash2 },
] as const

type TabKey = typeof TABS[number]['key']

// ── Página principal ──────────────────────────────────────────────────────────

function ActsPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { data: session } = useSession()

  const tabParam = searchParams.get('tab') as TabKey | null
  const activeTab: TabKey = TABS.some(t => t.key === tabParam) ? tabParam! : 'delivery'

  const setTab = (key: TabKey) => {
    router.push(`/inventory/acts?tab=${key}`)
  }

  const isSuperAdmin = (session?.user as any)?.isSuperAdmin === true
  const isAdmin = session?.user?.role === 'ADMIN'
  const canManage = (session?.user as any)?.canManageInventory === true

  // Clientes sin gestión solo ven entrega y devolución (no bajas)
  const visibleTabs = isAdmin || isSuperAdmin || canManage
    ? TABS
    : TABS.filter(t => t.key !== 'decommission')

  const subtitleMap: Record<TabKey, string> = {
    delivery:     'Actas de entrega de activos con firma digital',
    return:       'Actas de devolución de activos asignados',
    decommission: 'Solicitudes y actas de baja de activos',
  }

  return (
    <ModuleLayout
      title="Actas"
      subtitle={subtitleMap[activeTab]}
    >
      <div className="space-y-5">
        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit flex-wrap">
          {visibleTabs.map(tab => {
            const Icon = tab.icon
            const isActive = tab.key === activeTab
            return (
              <button
                key={tab.key}
                onClick={() => setTab(tab.key)}
                className={cn(
                  'flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-background shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.label.split(' ')[1]}</span>
              </button>
            )
          })}
        </div>

        {/* Contenido del tab activo */}
        {activeTab === 'delivery'     && <DeliveryActsTab />}
        {activeTab === 'return'       && <ReturnActsTab />}
        {activeTab === 'decommission' && <DecommissionActsTab />}
      </div>
    </ModuleLayout>
  )
}

export default function ActsPage() {
  return (
    <Suspense>
      <ActsPageContent />
    </Suspense>
  )
}
