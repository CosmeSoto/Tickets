'use client'

import { useState, useEffect, useCallback, use, Suspense, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Download,
  FileText,
  Loader2,
  AlertTriangle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Filter,
  X,
} from 'lucide-react'
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import Link from 'next/link'

// ── Configuración de reportes ─────────────────────────────────────────────────

// Valor centinela para "sin filtro" en selects — Radix no permite value=""
const ALL = 'all'

const REPORT_CONFIG: Record<string, {
  name: string
  description: string
  filters: Array<{ key: string; label: string; type: 'date' | 'select'; options?: { value: string; label: string }[] }>
}> = {
  summary: {
    name: '¿Qué tenemos?',
    description: 'Inventario total por familia y subtipo',
    filters: [
      {
        key: 'subtype',
        label: 'Tipo de activo',
        type: 'select',
        options: [
          { value: ALL, label: 'Todos' },
          { value: 'EQUIPMENT', label: 'Equipos' },
          { value: 'MRO', label: 'Materiales MRO' },
          { value: 'LICENSE', label: 'Licencias/Contratos' },
        ],
      },
    ],
  },
  assignments: {
    name: '¿Quién tiene qué?',
    description: 'Asignaciones activas de equipos',
    filters: [
      { key: 'dateFrom', label: 'Desde', type: 'date' },
      { key: 'dateTo', label: 'Hasta', type: 'date' },
    ],
  },
  expiring: {
    name: '¿Qué está por vencer?',
    description: 'Contratos, licencias y garantías próximas a caducar',
    filters: [
      {
        key: 'days',
        label: 'Horizonte',
        type: 'select',
        options: [
          { value: '30', label: 'Próximos 30 días' },
          { value: '60', label: 'Próximos 60 días' },
          { value: '90', label: 'Próximos 90 días' },
          { value: '180', label: 'Próximos 6 meses' },
          { value: '365', label: 'Próximo año' },
        ],
      },
    ],
  },
  'stock-movements': {
    name: '¿Qué se ha consumido?',
    description: 'Movimientos de stock MRO por período',
    filters: [
      { key: 'dateFrom', label: 'Desde', type: 'date' },
      { key: 'dateTo', label: 'Hasta', type: 'date' },
      {
        key: 'type',
        label: 'Tipo de movimiento',
        type: 'select',
        options: [
          { value: ALL, label: 'Todos' },
          { value: 'ENTRY', label: 'Entradas' },
          { value: 'EXIT', label: 'Salidas' },
          { value: 'ADJUSTMENT', label: 'Ajustes' },
        ],
      },
    ],
  },
  decommissioned: {
    name: '¿Qué se ha dado de baja?',
    description: 'Activos retirados del inventario',
    filters: [
      { key: 'dateFrom', label: 'Desde', type: 'date' },
      { key: 'dateTo', label: 'Hasta', type: 'date' },
    ],
  },
  maintenance: {
    name: 'Historial de mantenimientos',
    description: 'Registros de mantenimiento con costos',
    filters: [
      { key: 'dateFrom', label: 'Desde', type: 'date' },
      { key: 'dateTo', label: 'Hasta', type: 'date' },
      {
        key: 'status',
        label: 'Estado',
        type: 'select',
        options: [
          { value: ALL, label: 'Todos' },
          { value: 'COMPLETED', label: 'Completados' },
          { value: 'SCHEDULED', label: 'Programados' },
          { value: 'REQUESTED', label: 'Solicitados' },
          { value: 'CANCELLED', label: 'Cancelados' },
        ],
      },
    ],
  },
  locations: {
    name: '¿Dónde están los equipos?',
    description: 'Ubicación física actual de cada equipo',
    filters: [
      {
        key: 'onlyWithLocation',
        label: 'Mostrar',
        type: 'select',
        options: [
          { value: ALL, label: 'Todos los equipos' },
          { value: 'true', label: 'Solo con ubicación registrada' },
        ],
      },
    ],
  },
  'financial-summary': {
    name: 'Resumen Financiero Global',
    description: 'Valor total del inventario por familia',
    filters: [],
  },
}

// ── Acceso por rol ────────────────────────────────────────────────────────────

/** Slugs accesibles para cada nivel de acceso */
const ROLE_ACCESS: Record<string, string[]> = {
  SUPER_ADMIN: ['summary', 'assignments', 'expiring', 'maintenance', 'stock-movements', 'decommissioned', 'locations', 'financial-summary'],
  ADMIN:       ['summary', 'assignments', 'expiring', 'maintenance', 'stock-movements', 'decommissioned', 'locations'],
  MANAGER:     ['summary', 'assignments', 'expiring', 'maintenance', 'stock-movements', 'decommissioned', 'locations'],
}

function getUserLevel(role: string, isSuperAdmin: boolean, canManage: boolean): string {
  if (isSuperAdmin) return 'SUPER_ADMIN'
  if (role === 'ADMIN') return 'ADMIN'
  if (canManage) return 'MANAGER'
  return 'MANAGER'
}

function canAccessSlug(slug: string, level: string): boolean {
  return (ROLE_ACCESS[level] ?? ROLE_ACCESS.MANAGER).includes(slug)
}

const URGENCY_COLORS: Record<string, string> = {
  Crítico: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  Alto: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  Normal: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
}

// ── Tabla de datos con paginación y búsqueda ──────────────────────────────────

const PAGE_SIZE = 25

function DataTable({ rows }: { rows: Record<string, unknown>[] }) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    if (!search.trim()) return rows
    const q = search.toLowerCase()
    return rows.filter((row) =>
      Object.values(row).some((v) => v != null && String(v).toLowerCase().includes(q))
    )
  }, [rows, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // Reset page when search changes
  useEffect(() => { setPage(1) }, [search])

  if (rows.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No hay datos para mostrar con los filtros aplicados.</p>
      </div>
    )
  }

  const headers = Object.keys(rows[0])

  return (
    <div className="space-y-3">
      {/* Búsqueda en tabla */}
      {rows.length > PAGE_SIZE && (
        <div className="flex items-center gap-2 px-4 pt-4">
          <div className="relative flex-1 max-w-xs">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar en resultados..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2">
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
          </div>
          <span className="text-xs text-muted-foreground shrink-0">
            {filtered.length} de {rows.length} registros
          </span>
        </div>
      )}

      {/* Tabla */}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm divide-y divide-border">
          <thead className="bg-muted/50">
            <tr>
              {headers.map((h) => (
                <th
                  key={h}
                  className="px-3 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap text-xs uppercase tracking-wide"
                >
                  {formatHeader(h)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-card">
            {paginated.map((row, i) => (
              <tr key={i} className="hover:bg-muted/40 transition-colors">
                {headers.map((h) => {
                  const val = row[h]
                  const strVal = val == null ? '—' : String(val)

                  if (h === 'urgencia' && typeof val === 'string') {
                    return (
                      <td key={h} className="px-3 py-2.5">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${URGENCY_COLORS[val] ?? 'bg-muted text-muted-foreground'}`}>
                          {val}
                        </span>
                      </td>
                    )
                  }

                  if (h === 'tipo' && typeof val === 'string') {
                    return (
                      <td key={h} className="px-3 py-2.5">
                        <Badge variant="outline" className="text-xs font-normal">{val}</Badge>
                      </td>
                    )
                  }

                  // Columnas de valor monetario
                  if ((h === 'costo' || h === 'valorTotal' || h.toLowerCase().includes('valor') || h.toLowerCase().includes('costo')) && strVal.startsWith('$')) {
                    return (
                      <td key={h} className="px-3 py-2.5 font-mono text-xs text-right">{strVal}</td>
                    )
                  }

                  // Columnas numéricas
                  if (h === 'diasRestantes' || h === 'cantidad' || h === 'equiposActivos' || h === 'licencias' || h === 'materiales') {
                    return (
                      <td key={h} className="px-3 py-2.5 text-right tabular-nums">{strVal}</td>
                    )
                  }

                  return (
                    <td key={h} className="px-3 py-2.5 text-foreground max-w-[200px] truncate" title={strVal}>
                      {strVal}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 pb-4 text-sm text-muted-foreground">
          <span>
            Página {page} de {totalPages} · {filtered.length} registros
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const pageNum = totalPages <= 5 ? i + 1 : Math.max(1, Math.min(page - 2, totalPages - 4)) + i
              return (
                <Button
                  key={pageNum}
                  variant={pageNum === page ? 'default' : 'outline'}
                  size="icon"
                  className="h-7 w-7 text-xs"
                  onClick={() => setPage(pageNum)}
                >
                  {pageNum}
                </Button>
              )
            })}
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function formatHeader(key: string): string {
  const MAP: Record<string, string> = {
    fecha: 'Fecha', equipo: 'Equipo', codigoEquipo: 'Código', familia: 'Familia',
    tipo: 'Tipo', estado: 'Estado', descripcion: 'Descripción', tecnico: 'Técnico',
    costo: 'Costo', fechaCompletado: 'Completado', equipmentCode: 'Código',
    equipmentName: 'Equipo', usuarioAsignado: 'Usuario', fechaAsignacion: 'Asignación',
    fechaFin: 'Fin', tipoAsignacion: 'Tipo', nombre: 'Nombre', codigo: 'Código',
    fechaVencimiento: 'Vencimiento', diasRestantes: 'Días', urgencia: 'Urgencia',
    consumible: 'Consumible', cantidad: 'Cantidad', unidad: 'Unidad', motivo: 'Motivo',
    usuario: 'Usuario', folio: 'Folio', fechaBaja: 'Fecha Baja', tipoActivo: 'Tipo',
    nombreActivo: 'Nombre', codigoActivo: 'Código', solicitadoPor: 'Solicitado por',
    aprobadoPor: 'Aprobado por', subtipo: 'Subtipo', valorTotal: 'Valor Total',
    ubicacionFisica: 'Ubicación', bodega: 'Bodega', departamento: 'Departamento',
    equiposActivos: 'Equipos', valorEquipos: 'Valor Equipos', costoRentaMensual: 'Renta/Mes',
    costoRentaAnual: 'Renta/Año', licencias: 'Licencias', valorLicencias: 'Valor Lic.',
    materiales: 'Materiales', valorMateriales: 'Valor Mat.', costoMantenimiento: 'Mant.',
  }
  return MAP[key] ?? key.replace(/([A-Z])/g, ' $1').trim()
}

// ── Componente principal ──────────────────────────────────────────────────────

interface ReportData {
  summary: Array<{ title: string; value: string | number; description: string }>
  data: Record<string, unknown>[]
  filters: Record<string, unknown>
  generatedAt: string
  totalCount: number
}

function ReportSlugContent({ slug }: { slug: string }) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()

  const config = REPORT_CONFIG[slug]
  const reportName = config?.name ?? slug
  const isSuperAdmin = (session?.user as any)?.isSuperAdmin === true
  const canManageInventory = (session?.user as any)?.canManageInventory === true
  const userLevel = getUserLevel(session?.user?.role ?? '', isSuperAdmin, canManageInventory)

  // Filtros del reporte — defaults usan 'all' como centinela (Radix no permite value="")
  const familyId = searchParams.get('familyId') ?? undefined
  const [filterValues, setFilterValues] = useState<Record<string, string>>(() => {
    const defaults: Record<string, string> = {}
    config?.filters.forEach((f) => {
      if (f.type === 'select' && f.options?.[0]) {
        defaults[f.key] = f.options[0].value // primer option (puede ser 'all' o un valor real)
      }
    })
    if (slug === 'expiring') defaults['days'] = '90'
    return defaults
  })

  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState<'csv' | 'pdf' | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  const buildParams = useCallback(() => {
    const params = new URLSearchParams()
    if (familyId) params.set('familyId', familyId)
    Object.entries(filterValues).forEach(([k, v]) => {
      // Omitir el centinela 'all' y valores vacíos — la API interpreta ausencia como "sin filtro"
      if (v && v !== ALL) params.set(k, v)
    })
    return params
  }, [familyId, filterValues])

  const fetchReport = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/inventory/reports/${slug}?${buildParams()}`)
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? `Error ${res.status}`)
      }
      setReportData(await res.json())
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el reporte')
    } finally {
      setLoading(false)
    }
  }, [slug, buildParams])

  useEffect(() => {
    if (status === 'authenticated') fetchReport()
  }, [fetchReport, status])

  const handleExport = async (format: 'csv' | 'pdf') => {
    setExporting(format)
    try {
      const params = buildParams()
      params.set('format', format)
      const res = await fetch(`/api/inventory/reports/${slug}?${params}`)
      if (!res.ok) throw new Error('Error al exportar')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `reporte-${slug}-${new Date().toISOString().split('T')[0]}.${format}`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      // silently fail
    } finally {
      setExporting(null)
    }
  }

  // Hay filtros activos si algún select no es 'all' o alguna fecha está rellena
  const hasActiveFilters = Object.entries(filterValues).some(([, v]) => v && v !== ALL)

  if (status === 'loading') {
    return (
      <ModuleLayout title="Cargando..." loading>
        <div />
      </ModuleLayout>
    )
  }

  if (!session?.user) return null

  // Verificar acceso al slug según rol
  if (!canAccessSlug(slug, userLevel)) {
    return (
      <ModuleLayout title="Acceso restringido" subtitle="No tienes permiso para ver este reporte">
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
          <AlertTriangle className="h-10 w-10 text-amber-500" />
          <p className="text-muted-foreground max-w-sm">
            {slug === 'financial-summary'
              ? 'El resumen financiero global solo está disponible para el Super Administrador.'
              : 'No tienes permiso para acceder a este reporte.'}
          </p>
          <Link href="/inventory/reports">
            <Button variant="outline" size="sm">Volver a reportes</Button>
          </Link>
        </div>
      </ModuleLayout>
    )
  }

  const roleSubtitle = userLevel === 'SUPER_ADMIN'
    ? 'Vista global — todas las familias'
    : userLevel === 'ADMIN'
      ? 'Todas las familias'
      : 'Datos de tus familias asignadas'

  return (
    <ModuleLayout
      title={reportName}
      subtitle={`${config?.description ?? ''} · ${roleSubtitle}`}
    >
      <div className="space-y-5">
        {/* Volver */}
        <Link href="/inventory/reports" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="h-4 w-4" />
          Volver a reportes
        </Link>

        {/* Filtros del reporte */}
        {config && config.filters.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Filtros
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4 items-end">
                {config.filters.map((f) => (
                  <div key={f.key} className="flex flex-col gap-1.5 min-w-[160px]">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                      {f.type === 'date' && <Calendar className="h-3 w-3" />}
                      {f.label}
                    </Label>
                    {f.type === 'date' ? (
                      <Input
                        type="date"
                        value={filterValues[f.key] ?? ''}
                        onChange={(e) => setFilterValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
                        className="h-9 text-sm"
                      />
                    ) : (
                      <Select
                        value={filterValues[f.key] ?? ALL}
                        onValueChange={(v) => setFilterValues((prev) => ({ ...prev, [f.key]: v }))}
                      >
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {f.options?.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                ))}
                <Button size="sm" onClick={fetchReport} disabled={loading} className="h-9">
                  {loading ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1.5" />}
                  Aplicar
                </Button>
                {hasActiveFilters && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-9 text-muted-foreground"
                    onClick={() => {
                      const defaults: Record<string, string> = {}
                      config.filters.forEach((f) => {
                        if (f.type === 'select' && f.options?.[0]) defaults[f.key] = f.options[0].value
                      })
                      if (slug === 'expiring') defaults['days'] = '90'
                      setFilterValues(defaults)
                    }}
                  >
                    <X className="h-3.5 w-3.5 mr-1" />
                    Limpiar
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Estado de carga / error */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && error && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <AlertTriangle className="h-8 w-8 text-destructive" />
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchReport}>
              <RefreshCw className="h-4 w-4 mr-1.5" />
              Reintentar
            </Button>
          </div>
        )}

        {!loading && !error && reportData && (
          <>
            {/* Indicadores ejecutivos */}
            <div className={`grid gap-4 ${reportData.summary.length === 4 ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-1 sm:grid-cols-3'}`}>
              {reportData.summary.map((item, i) => (
                <Card key={i}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {item.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-2xl font-bold leading-tight">{item.value}</p>
                    <p className="text-xs text-muted-foreground mt-1 leading-snug">{item.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Metadatos + botones de exportación */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <p className="text-xs text-muted-foreground">
                {reportData.totalCount} registro{reportData.totalCount !== 1 ? 's' : ''}
                {familyId && ' · filtrado por área'}
                {' · '}Generado el {new Date(reportData.generatedAt).toLocaleString('es-MX', {
                  day: '2-digit', month: '2-digit', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExport('csv')}
                  disabled={!!exporting}
                >
                  {exporting === 'csv'
                    ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    : <Download className="h-4 w-4 mr-1.5" />}
                  Exportar CSV
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExport('pdf')}
                  disabled={!!exporting}
                >
                  {exporting === 'pdf'
                    ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    : <FileText className="h-4 w-4 mr-1.5" />}
                  Exportar PDF
                </Button>
              </div>
            </div>

            {/* Tabla de datos */}
            <Card>
              <CardContent className="p-0">
                <DataTable rows={reportData.data} />
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </ModuleLayout>
  )
}

export default function ReportSlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  return (
    <Suspense>
      <ReportSlugContent slug={slug} />
    </Suspense>
  )
}
