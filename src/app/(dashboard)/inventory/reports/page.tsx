'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  Package,
  Users,
  Clock,
  ShoppingCart,
  Trash2,
  Wrench,
  Loader2,
  BarChart3,
  MapPin,
} from 'lucide-react'
import { RoleDashboardLayout } from '@/components/layout/role-dashboard-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FamilyFilterBar } from '@/components/inventory/family-filter-bar'

const REPORTS = [
  {
    slug: 'summary',
    name: '¿Qué tenemos?',
    description: 'Inventario total por familia y subtipo con conteos y valor estimado',
    icon: Package,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
  },
  {
    slug: 'assignments',
    name: '¿Quién tiene qué?',
    description: 'Lista de activos asignados con usuario, fecha de asignación y estado',
    icon: Users,
    color: 'text-green-600',
    bg: 'bg-green-50',
  },
  {
    slug: 'expiring',
    name: '¿Qué está por vencer?',
    description: 'Contratos, licencias y materiales próximos a caducar ordenados por urgencia',
    icon: Clock,
    color: 'text-orange-600',
    bg: 'bg-orange-50',
  },
  {
    slug: 'stock-movements',
    name: '¿Qué se ha consumido?',
    description: 'Movimientos de stock MRO por período con totales por material',
    icon: ShoppingCart,
    color: 'text-purple-600',
    bg: 'bg-purple-50',
  },
  {
    slug: 'decommissioned',
    name: '¿Qué se ha dado de baja?',
    description: 'Activos retirados del inventario con motivo y fecha',
    icon: Trash2,
    color: 'text-red-600',
    bg: 'bg-red-50',
  },
  {
    slug: 'maintenance',
    name: 'Historial de mantenimientos',
    description: 'Registros de mantenimiento por equipo y período con costos',
    icon: Wrench,
    color: 'text-teal-600',
    bg: 'bg-teal-50',
  },
  {
    slug: 'locations',
    name: '¿Dónde están los equipos?',
    description: 'Ubicación física actual de cada equipo, bodega asignada y usuario responsable',
    icon: MapPin,
    color: 'text-indigo-600',
    bg: 'bg-indigo-50',
  },
]

export default function InventoryReportsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [selectedFamilyId, setSelectedFamilyId] = useState<string | null>(null)
  const [families, setFamilies] = useState<Array<{ id: string; name: string; icon?: string | null; color?: string | null }>>([])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  useEffect(() => {
    fetch('/api/inventory/families')
      .then(r => r.json())
      .then(d => setFamilies(d.families ?? []))
      .catch(() => {})
  }, [])

  if (status === 'loading') {
    return (
      <RoleDashboardLayout title="Cargando..." subtitle="Obteniendo información">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </RoleDashboardLayout>
    )
  }

  if (!session?.user) return null

  const handleCardClick = (slug: string) => {
    const params = new URLSearchParams()
    if (selectedFamilyId) params.set('familyId', selectedFamilyId)
    const query = params.toString()
    router.push(`/inventory/reports/${slug}${query ? `?${query}` : ''}`)
  }

  return (
    <RoleDashboardLayout
      title="Reportes de Inventario"
      subtitle="Consulta el estado del inventario con lenguaje claro y sencillo"
    >
      <div className="space-y-6">
        {/* Filtro por familia */}
        {families.length > 0 && (
          <div>
            <p className="text-sm text-muted-foreground mb-2">Filtrar por familia:</p>
            <FamilyFilterBar
              families={families}
              selectedId={selectedFamilyId}
              onChange={setSelectedFamilyId}
            />
          </div>
        )}

        {/* Tarjetas de reportes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {REPORTS.map((report) => {
            const Icon = report.icon
            return (
              <Card
                key={report.slug}
                className="cursor-pointer hover:shadow-md hover:border-primary/40 transition-all"
                onClick={() => handleCardClick(report.slug)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${report.bg}`}>
                      <Icon className={`h-5 w-5 ${report.color}`} />
                    </div>
                    <CardTitle className="text-base leading-tight">{report.name}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <CardDescription className="text-sm">{report.description}</CardDescription>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Nota informativa */}
        <div className="flex items-start gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg p-4">
          <BarChart3 className="h-4 w-4 mt-0.5 shrink-0" />
          <p>
            Haz clic en cualquier reporte para ver los datos detallados. Puedes exportar cada reporte en CSV o PDF desde la vista individual.
            {selectedFamilyId && ' Los reportes mostrarán solo los datos de la familia seleccionada.'}
          </p>
        </div>
      </div>
    </RoleDashboardLayout>
  )
}
