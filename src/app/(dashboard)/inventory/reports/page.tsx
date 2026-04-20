'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  Package, Users, Clock, ShoppingCart, Trash2,
  Wrench, BarChart3, MapPin, Crown, Lock,
} from 'lucide-react'
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FamilyCombobox } from '@/components/ui/family-combobox'
import { useFetch } from '@/hooks/common/use-fetch'

// ── Definición completa de reportes ──────────────────────────────────────────

type ReportRole = 'ADMIN' | 'SUPER_ADMIN' | 'MANAGER'

interface ReportDef {
  slug: string
  name: string
  description: string
  icon: React.ElementType
  color: string
  bg: string
  /** Roles que pueden ver este reporte */
  roles: ReportRole[]
}

const ALL_REPORTS: ReportDef[] = [
  {
    slug: 'summary',
    name: '¿Qué tenemos?',
    description: 'Inventario total por familia y subtipo con conteos y valor estimado',
    icon: Package,
    color: 'text-blue-600',
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    roles: ['ADMIN', 'SUPER_ADMIN', 'MANAGER'],
  },
  {
    slug: 'assignments',
    name: '¿Quién tiene qué?',
    description: 'Lista de activos asignados con usuario, fecha de asignación y estado',
    icon: Users,
    color: 'text-green-600',
    bg: 'bg-green-50 dark:bg-green-950/30',
    roles: ['ADMIN', 'SUPER_ADMIN', 'MANAGER'],
  },
  {
    slug: 'expiring',
    name: '¿Qué está por vencer?',
    description: 'Contratos, licencias y garantías próximas a caducar ordenados por urgencia',
    icon: Clock,
    color: 'text-orange-600',
    bg: 'bg-orange-50 dark:bg-orange-950/30',
    roles: ['ADMIN', 'SUPER_ADMIN', 'MANAGER'],
  },
  {
    slug: 'maintenance',
    name: 'Historial de mantenimientos',
    description: 'Registros de mantenimiento por equipo y período con costos',
    icon: Wrench,
    color: 'text-teal-600',
    bg: 'bg-teal-50 dark:bg-teal-950/30',
    roles: ['ADMIN', 'SUPER_ADMIN', 'MANAGER'],
  },
  {
    slug: 'stock-movements',
    name: '¿Qué se ha consumido?',
    description: 'Movimientos de stock MRO por período con totales por material',
    icon: ShoppingCart,
    color: 'text-purple-600',
    bg: 'bg-purple-50 dark:bg-purple-950/30',
    // Gestores de inventario también pueden ver consumibles de sus familias
    roles: ['ADMIN', 'SUPER_ADMIN', 'MANAGER'],
  },
  {
    slug: 'decommissioned',
    name: '¿Qué se ha dado de baja?',
    description: 'Activos retirados del inventario con motivo, fecha y responsable',
    icon: Trash2,
    color: 'text-red-600',
    bg: 'bg-red-50 dark:bg-red-950/30',
    roles: ['ADMIN', 'SUPER_ADMIN', 'MANAGER'],
  },
  {
    slug: 'locations',
    name: '¿Dónde están los equipos?',
    description: 'Ubicación física actual de cada equipo, bodega asignada y usuario responsable',
    icon: MapPin,
    color: 'text-indigo-600',
    bg: 'bg-indigo-50 dark:bg-indigo-950/30',
    roles: ['ADMIN', 'SUPER_ADMIN', 'MANAGER'],
  },
  {
    slug: 'financial-summary',
    name: 'Resumen Financiero Global',
    description: 'Valor total del inventario, costos de renta y mantenimiento de todas las familias',
    icon: BarChart3,
    color: 'text-amber-600',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    // Solo Super Admin — acceso a datos financieros globales
    roles: ['SUPER_ADMIN'],
  },
]

// ── Subtítulos por rol ────────────────────────────────────────────────────────

function getSubtitle(role: string, isSuperAdmin: boolean, canManage: boolean): string {
  if (isSuperAdmin) return 'Vista global — todas las familias y datos financieros'
  if (role === 'ADMIN') return 'Vista completa del inventario de todas las familias'
  if (canManage) return 'Reportes del inventario de tus familias asignadas'
  return 'Reportes de inventario'
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function InventoryReportsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const role = session?.user?.role ?? ''
  const isSuperAdmin = (session?.user as any)?.isSuperAdmin === true
  const canManageInventory = (session?.user as any)?.canManageInventory === true

  const [selectedFamilyId, setSelectedFamilyId] = useState<string | null>(null)

  // Cargar familias con useFetch
  const { data: familiesRaw } = useFetch('/api/inventory/families', {
    transform: (d) => d.families ?? [],
    enabled: status === 'authenticated',
  })
  const families = familiesRaw as Array<{ id: string; name: string; color?: string | null }>

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  if (status === 'loading') {
    return <ModuleLayout title="Reportes de Inventario" loading><div /></ModuleLayout>
  }
  if (!session?.user) return null

  // Determinar el "nivel de acceso" del usuario para filtrar reportes
  const userReportRole: ReportRole = isSuperAdmin
    ? 'SUPER_ADMIN'
    : role === 'ADMIN'
      ? 'ADMIN'
      : canManageInventory
        ? 'MANAGER'
        : 'MANAGER' // fallback — la API filtra por familias de todas formas

  const visibleReports = ALL_REPORTS.filter((r) => r.roles.includes(userReportRole))

  const handleCardClick = (slug: string) => {
    const params = new URLSearchParams()
    if (selectedFamilyId) params.set('familyId', selectedFamilyId)
    const query = params.toString()
    router.push(`/inventory/reports/${slug}${query ? `?${query}` : ''}`)
  }

  const isAdmin = role === 'ADMIN'
  const subtitle = getSubtitle(role, isSuperAdmin, canManageInventory)

  return (
    <ModuleLayout title="Reportes de Inventario" subtitle={subtitle}>
      <div className="space-y-6">

        {/* Selector de familia — solo si hay más de una y el usuario puede ver varias */}
        {families.length > 1 && (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-muted-foreground shrink-0">Filtrar por área:</p>
            <FamilyCombobox
              families={families.map(f => ({
                id: f.id,
                name: f.name,
                code: f.name.slice(0, 3).toUpperCase(),
                color: f.color,
              }))}
              value={selectedFamilyId ?? 'all'}
              onValueChange={(v) => setSelectedFamilyId(v === 'all' ? null : v)}
              allowAll
              allowClear
              popoverWidth="260px"
              className="w-full sm:w-56"
            />
            {isSuperAdmin && (
              <Badge className="bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 flex items-center gap-1 shrink-0">
                <Crown className="h-3 w-3" />
                Vista global
              </Badge>
            )}
            {!isAdmin && !isSuperAdmin && canManageInventory && (
              <span className="text-xs text-muted-foreground">
                Solo verás datos de tus familias asignadas
              </span>
            )}
          </div>
        )}

        {/* Tarjetas de reportes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleReports.map((report) => {
            const Icon = report.icon
            const isSuperAdminOnly = report.roles.length === 1 && report.roles[0] === 'SUPER_ADMIN'

            return (
              <Card
                key={report.slug}
                className={`cursor-pointer hover:shadow-md hover:border-primary/40 transition-all group ${
                  isSuperAdminOnly ? 'border-amber-200 dark:border-amber-800' : ''
                }`}
                onClick={() => handleCardClick(report.slug)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg shrink-0 ${report.bg} group-hover:scale-105 transition-transform`}>
                      <Icon className={`h-5 w-5 ${report.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base leading-tight">{report.name}</CardTitle>
                      {isSuperAdminOnly && (
                        <Badge className="bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 text-xs mt-1 flex items-center gap-1 w-fit">
                          <Crown className="h-2.5 w-2.5" />
                          Solo Super Admin
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <CardDescription className="text-sm leading-relaxed">
                    {report.description}
                  </CardDescription>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Nota informativa contextual */}
        <div className="flex items-start gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg p-4">
          <BarChart3 className="h-4 w-4 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p>
              Haz clic en cualquier reporte para ver los datos detallados con filtros por fecha.
              Puedes exportar en CSV o PDF desde la vista individual.
            </p>
            {!isAdmin && !isSuperAdmin && (
              <p className="flex items-center gap-1">
                <Lock className="h-3 w-3" />
                Los datos están limitados a las familias que tienes asignadas.
              </p>
            )}
            {selectedFamilyId && (
              <p>Los reportes mostrarán solo los datos del área seleccionada.</p>
            )}
          </div>
        </div>
      </div>
    </ModuleLayout>
  )
}
