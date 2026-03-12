'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Package, CheckCircle, UserCheck, Wrench, AlertTriangle, XCircle } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import type { EquipmentSummary } from '@/types/inventory/equipment'

interface EquipmentSummaryWidgetProps {
  userRole: string
  userId: string
}

export function EquipmentSummaryWidget({ userRole, userId }: EquipmentSummaryWidgetProps) {
  const [summary, setSummary] = useState<EquipmentSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadSummary()
  }, [])

  const loadSummary = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/inventory/equipment/summary')
      
      if (response.ok) {
        const data = await response.json()
        setSummary(data)
      }
    } catch (error) {
      console.error('Error cargando resumen:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cargando...</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">-</div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (!summary) {
    return null
  }

  const widgets = [
    {
      title: 'Total de Equipos',
      value: summary.total,
      icon: Package,
      color: 'text-blue-500',
    },
    {
      title: 'Disponibles',
      value: summary.available,
      icon: CheckCircle,
      color: 'text-green-500',
    },
    {
      title: 'Asignados',
      value: summary.assigned,
      icon: UserCheck,
      color: 'text-purple-500',
    },
    {
      title: 'En Mantenimiento',
      value: summary.maintenance,
      icon: Wrench,
      color: 'text-yellow-500',
    },
  ]

  // Solo mostrar widgets adicionales para ADMIN
  if (userRole === 'ADMIN') {
    widgets.push(
      {
        title: 'Dañados',
        value: summary.damaged,
        icon: AlertTriangle,
        color: 'text-red-500',
      },
      {
        title: 'Retirados',
        value: summary.retired,
        icon: XCircle,
        color: 'text-gray-500',
      }
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {widgets.map((widget) => {
          const Icon = widget.icon
          return (
            <Card key={widget.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{widget.title}</CardTitle>
                <Icon className={`h-4 w-4 ${widget.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{widget.value}</div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Valor Total del Inventario (solo ADMIN) */}
      {userRole === 'ADMIN' && summary.totalValue > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Total del Inventario</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.totalValue)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Basado en precios de compra registrados
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
