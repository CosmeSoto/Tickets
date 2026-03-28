'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { RoleDashboardLayout } from '@/components/layout/role-dashboard-layout'
import { Input } from '@/components/ui/input'
import { Search, FileSignature, Monitor, RefreshCw, AlertTriangle, CheckCircle, XCircle } from 'lucide-react'

interface ContractItem {
  id: string
  name: string
  type: 'EQUIPMENT' | 'LICENSE'
  contractNumber?: string
  supplier?: string
  startDate?: string
  endDate?: string
  monthlyCost?: number
  status: 'ACTIVE' | 'EXPIRING' | 'EXPIRED'
  daysUntilExpiry?: number
  familyName?: string
}

const STATUS_CONFIG = {
  ACTIVE:   { label: 'Vigente',       icon: CheckCircle,    cls: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  EXPIRING: { label: 'Por vencer',    icon: AlertTriangle,  cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
  EXPIRED:  { label: 'Vencido',       icon: XCircle,        cls: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
}

const TYPE_CONFIG = {
  EQUIPMENT: { label: 'Equipo en arrendamiento', icon: Monitor,        cls: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  LICENSE:   { label: 'Licencia / Suscripción',  icon: FileSignature,  cls: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' },
}

function fmtDate(d?: string) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function fmtCurrency(n?: number) {
  if (n == null) return '—'
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n)
}

export default function ContractsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [items, setItems] = useState<ContractItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'EQUIPMENT' | 'LICENSE'>('ALL')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'EXPIRING' | 'EXPIRED'>('ALL')

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  const fetchContracts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/inventory/contracts')
      if (res.ok) {
        const data = await res.json()
        setItems(data.items ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchContracts() }, [fetchContracts])

  const filtered = items.filter(item => {
    if (typeFilter !== 'ALL' && item.type !== typeFilter) return false
    if (statusFilter !== 'ALL' && item.status !== statusFilter) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      return (
        item.name.toLowerCase().includes(q) ||
        (item.contractNumber ?? '').toLowerCase().includes(q) ||
        (item.supplier ?? '').toLowerCase().includes(q)
      )
    }
    return true
  })

  const counts = {
    total: items.length,
    active: items.filter(i => i.status === 'ACTIVE').length,
    expiring: items.filter(i => i.status === 'EXPIRING').length,
    expired: items.filter(i => i.status === 'EXPIRED').length,
  }

  if (status === 'loading') return null

  return (
    <RoleDashboardLayout
      title="Contratos y Suscripciones"
      subtitle="Vista unificada de equipos en arrendamiento y licencias con suscripción activa"
    >
      <div className="space-y-5">
        {/* Resumen */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total', value: counts.total, cls: 'text-foreground' },
            { label: 'Vigentes', value: counts.active, cls: 'text-green-600' },
            { label: 'Por vencer', value: counts.expiring, cls: 'text-amber-600' },
            { label: 'Vencidos', value: counts.expired, cls: 'text-red-600' },
          ].map(c => (
            <div key={c.label} className="rounded-lg border border-border bg-card p-4">
              <p className={`text-2xl font-bold ${c.cls}`}>{c.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{c.label}</p>
            </div>
          ))}
        </div>

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nombre, N° contrato o proveedor..."
              className="pl-9"
            />
          </div>
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value as typeof typeFilter)}
            className="flex h-10 rounded-md border border-border bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-52"
          >
            <option value="ALL">Todos los tipos</option>
            <option value="EQUIPMENT">Equipos arrendados</option>
            <option value="LICENSE">Licencias / Suscripciones</option>
          </select>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}
            className="flex h-10 rounded-md border border-border bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-44"
          >
            <option value="ALL">Todos los estados</option>
            <option value="ACTIVE">Vigentes</option>
            <option value="EXPIRING">Por vencer</option>
            <option value="EXPIRED">Vencidos</option>
          </select>
          <button
            type="button"
            onClick={fetchContracts}
            className="flex h-10 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm hover:bg-accent transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {/* Tabla */}
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Tipo</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Nombre</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">N° Contrato</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">Proveedor</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">Vencimiento</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden xl:table-cell">Costo mensual</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    <div className="flex items-center justify-center gap-2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      Cargando contratos…
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    {items.length === 0
                      ? 'No hay contratos registrados. Los contratos aparecen aquí cuando creas equipos en arrendamiento o licencias con suscripción.'
                      : 'Sin resultados para los filtros aplicados.'}
                  </td>
                </tr>
              ) : (
                filtered.map(item => {
                  const typeCfg = TYPE_CONFIG[item.type]
                  const statusCfg = STATUS_CONFIG[item.status]
                  const TypeIcon = typeCfg.icon
                  const StatusIcon = statusCfg.icon
                  return (
                    <tr
                      key={`${item.type}-${item.id}`}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => router.push(
                        item.type === 'EQUIPMENT'
                          ? `/inventory/equipment/${item.id}`
                          : `/inventory/licenses/${item.id}`
                      )}
                    >
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${typeCfg.cls}`}>
                          <TypeIcon className="h-3 w-3" />
                          <span className="hidden sm:inline">{typeCfg.label}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground">{item.name}</td>
                      <td className="px-4 py-3 text-muted-foreground font-mono text-xs hidden md:table-cell">
                        {item.contractNumber ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{item.supplier ?? '—'}</td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className={item.status !== 'ACTIVE' ? 'font-medium' : ''}>
                          {fmtDate(item.endDate)}
                        </span>
                        {item.daysUntilExpiry != null && item.daysUntilExpiry >= 0 && item.status !== 'ACTIVE' && (
                          <span className="ml-1 text-xs text-muted-foreground">
                            ({item.daysUntilExpiry}d)
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden xl:table-cell">{fmtCurrency(item.monthlyCost)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${statusCfg.cls}`}>
                          <StatusIcon className="h-3 w-3" />
                          {statusCfg.label}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {filtered.length > 0 && (
          <p className="text-xs text-muted-foreground text-right">
            {filtered.length} contrato{filtered.length !== 1 ? 's' : ''}
            {filtered.length !== items.length && ` de ${items.length}`}
          </p>
        )}
      </div>
    </RoleDashboardLayout>
  )
}
