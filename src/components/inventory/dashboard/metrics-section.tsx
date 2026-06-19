'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { MetricCard, MetricCardSkeleton } from './metric-card'
import {
  Package,
  DollarSign,
  CheckCircle,
  User,
  Wrench,
  CreditCard,
  FileText,
  ClipboardList,
} from 'lucide-react'

interface DashboardStats {
  totalEquipment: number
  equipmentByStatus: Record<string, number>
  totalValue: number
  rentalMonthlyCost: number
  pendingRequests: number
  pendingActs: number
}

interface MetricsSectionProps {
  /** Rol del usuario — controla qué métricas financieras se muestran */
  userRole?: string
}

export function MetricsSection({ userRole: propRole }: MetricsSectionProps) {
  const { data: session } = useSession()
  const userRole = propRole || session?.user?.role
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch('/api/inventory/dashboard/stats')

      if (!res.ok) {
        throw new Error('Error al cargar estadísticas')
      }

      const data = await res.json()
      setStats(data)
    } catch (err) {
      console.error('Error fetching stats:', err)
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'>
        {Array.from({ length: 8 }).map((_, i) => (
          <MetricCardSkeleton key={i} />
        ))}
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div className='rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive'>
        {error || 'No se pudieron cargar las estadísticas'}
      </div>
    )
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  // Métricas financieras solo para ADMIN (no para TECHNICIAN ni gestores sin rol ADMIN)
  const showFinancialMetrics = userRole === 'ADMIN'

  return (
    <div className='space-y-4'>
      {/* Primera fila: Métricas principales */}
      <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'>
        <MetricCard
          title='Total de Activos'
          value={stats.totalEquipment.toLocaleString()}
          icon={Package}
          color='blue'
          subtitle='Equipos registrados'
        />
        {showFinancialMetrics && (
          <MetricCard
            title='Valor Total'
            value={formatCurrency(stats.totalValue)}
            icon={DollarSign}
            color='green'
            subtitle='Valor de inventario'
          />
        )}
        <MetricCard
          title='Disponibles'
          value={(stats.equipmentByStatus.AVAILABLE || 0).toLocaleString()}
          icon={CheckCircle}
          color='green'
          subtitle='Listos para asignar'
        />
        <MetricCard
          title='Asignados'
          value={(stats.equipmentByStatus.ASSIGNED || 0).toLocaleString()}
          icon={User}
          color='blue'
          subtitle='En uso actualmente'
        />
      </div>

      {/* Segunda fila: Métricas secundarias */}
      <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'>
        <MetricCard
          title='En Mantenimiento'
          value={(stats.equipmentByStatus.MAINTENANCE || 0).toLocaleString()}
          icon={Wrench}
          color='yellow'
          subtitle='Requieren atención'
        />
        {showFinancialMetrics && (
          <MetricCard
            title='Costo de Arrendamientos'
            value={formatCurrency(stats.rentalMonthlyCost)}
            icon={CreditCard}
            color='purple'
            subtitle='Mensual'
          />
        )}
        <MetricCard
          title='Solicitudes Pendientes'
          value={stats.pendingRequests.toLocaleString()}
          icon={ClipboardList}
          color={stats.pendingRequests > 0 ? 'yellow' : 'gray'}
          subtitle='Por aprobar'
        />
        <MetricCard
          title='Actas Pendientes'
          value={stats.pendingActs.toLocaleString()}
          icon={FileText}
          color={stats.pendingActs > 0 ? 'yellow' : 'gray'}
          subtitle='Por firmar'
        />
      </div>
    </div>
  )
}
