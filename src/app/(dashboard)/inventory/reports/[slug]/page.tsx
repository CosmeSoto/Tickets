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
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from 'lucide-react'
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { DateInput } from '@/components/ui/date-input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ListTableToolbar } from '@/components/common/list-table-toolbar'
import { useExport } from '@/hooks/common/use-export'
import Link from 'next/link'
import {
  ALL_FILTER,
  canAccessTemplate,
  getDefaultFilterValues,
  getTemplateBySlug,
  resolveUserReportRole,
} from '@/lib/inventory/reports/catalog'

const URGENCY_COLORS: Record<string, string> = {
  Crítico: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  Alto: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  Normal: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
}

// ── Tabla de datos con paginación y búsqueda ──────────────────────────────────

const PAGE_SIZE = 25

function DataTable({ rows, reportName }: { rows: Record<string, unknown>[]; reportName?: string }) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const filtered = useMemo(() => {
    let result = rows
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(row =>
        Object.values(row).some(v => v != null && String(v).toLowerCase().includes(q))
      )
    }
    if (sortKey) {
      const dir = sortDir === 'asc' ? 1 : -1
      result = [...result].sort((a, b) => {
        const av = a[sortKey]
        const bv = b[sortKey]
        if (av == null) return 1
        if (bv == null) return -1
        if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
        return String(av).localeCompare(String(bv), 'es', { sensitivity: 'base' }) * dir
      })
    }
    return result
  }, [rows, search, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  useEffect(() => {
    setPage(1)
  }, [search, sortKey, sortDir])

  // Export — usa los datos filtrados y ordenados actuales
  const headers = rows.length > 0 ? Object.keys(rows[0]) : []
  const { exportCSV, exportExcel, exportPDF, exporting } = useExport({
    filename: reportName
      ? `reporte-${reportName.toLowerCase().replace(/\s+/g, '-')}`
      : 'reporte-inventario',
    title: reportName ?? 'Reporte de Inventario',
    subtitle: `${filtered.length} registros`,
    getData: () => filtered,
    columns: headers.map(h => ({ key: h, label: formatHeader(h) })),
  })

  if (rows.length === 0) {
    return (
      <div className='text-center py-12 text-muted-foreground'>
        <FileText className='h-8 w-8 mx-auto mb-2 opacity-50' />
        <p>No hay datos para mostrar con los filtros aplicados.</p>
      </div>
    )
  }

  return (
    <div className='space-y-3'>
      <div className='px-4 pt-4 space-y-3'>
        <ListTableToolbar
          title={
            <span className='text-xs text-muted-foreground'>
              {filtered.length} de {rows.length} registros
            </span>
          }
          showViewToggle={false}
          export={{
            onExportCSV: exportCSV,
            onExportExcel: exportExcel,
            onExportPDF: exportPDF,
            loading: exporting,
            disabled: filtered.length === 0,
          }}
          endActions={
            <div className='relative flex-1 min-w-[180px] max-w-xs'>
              <Filter className='absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground' />
              <Input
                placeholder='Buscar en resultados...'
                value={search}
                onChange={e => setSearch(e.target.value)}
                className='pl-8 h-8 text-sm'
              />
              {search && (
                <button
                  type='button'
                  onClick={() => setSearch('')}
                  className='absolute right-2 top-1/2 -translate-y-1/2'
                >
                  <X className='h-3.5 w-3.5 text-muted-foreground' />
                </button>
              )}
            </div>
          }
        />
      </div>

      {/* Tabla */}
      <div className='overflow-x-auto'>
        <table className='min-w-full text-sm divide-y divide-border'>
          <thead className='bg-muted/50'>
            <tr>
              {headers.map(h => (
                <th
                  key={h}
                  onClick={() => toggleSort(h)}
                  className='px-3 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap text-xs uppercase tracking-wide cursor-pointer select-none hover:text-foreground transition-colors'
                >
                  {formatHeader(h)}
                  {sortKey === h ? (
                    sortDir === 'asc' ? (
                      <ArrowUp className='h-3 w-3 ml-1 inline text-foreground' />
                    ) : (
                      <ArrowDown className='h-3 w-3 ml-1 inline text-foreground' />
                    )
                  ) : (
                    <ArrowUpDown className='h-3 w-3 ml-1 inline text-muted-foreground/40' />
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className='divide-y divide-border bg-card'>
            {paginated.map((row, i) => (
              <tr key={i} className='hover:bg-muted/40 transition-colors'>
                {headers.map(h => {
                  const val = row[h]
                  const strVal = val == null ? '—' : String(val)

                  if (h === 'urgencia' && typeof val === 'string') {
                    return (
                      <td key={h} className='px-3 py-2.5'>
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${URGENCY_COLORS[val] ?? 'bg-muted text-muted-foreground'}`}
                        >
                          {val}
                        </span>
                      </td>
                    )
                  }

                  if (h === 'tipo' && typeof val === 'string') {
                    return (
                      <td key={h} className='px-3 py-2.5'>
                        <Badge variant='outline' className='text-xs font-normal'>
                          {val}
                        </Badge>
                      </td>
                    )
                  }

                  // Columnas de valor monetario
                  if (
                    (h === 'costo' ||
                      h === 'valorTotal' ||
                      h.toLowerCase().includes('valor') ||
                      h.toLowerCase().includes('costo')) &&
                    strVal.startsWith('$')
                  ) {
                    return (
                      <td key={h} className='px-3 py-2.5 font-mono text-xs text-right'>
                        {strVal}
                      </td>
                    )
                  }

                  // Columnas numéricas
                  if (
                    h === 'diasRestantes' ||
                    h === 'cantidad' ||
                    h === 'equiposActivos' ||
                    h === 'licencias' ||
                    h === 'materiales'
                  ) {
                    return (
                      <td key={h} className='px-3 py-2.5 text-right tabular-nums'>
                        {strVal}
                      </td>
                    )
                  }

                  return (
                    <td
                      key={h}
                      className='px-3 py-2.5 text-foreground max-w-[200px] truncate'
                      title={strVal}
                    >
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
        <div className='flex items-center justify-between px-4 pb-4 text-sm text-muted-foreground'>
          <span>
            Página {page} de {totalPages} · {filtered.length} registros
          </span>
          <div className='flex items-center gap-1'>
            <Button
              variant='outline'
              size='icon'
              className='h-7 w-7'
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className='h-4 w-4' />
            </Button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const pageNum =
                totalPages <= 5 ? i + 1 : Math.max(1, Math.min(page - 2, totalPages - 4)) + i
              return (
                <Button
                  key={pageNum}
                  variant={pageNum === page ? 'default' : 'outline'}
                  size='icon'
                  className='h-7 w-7 text-xs'
                  onClick={() => setPage(pageNum)}
                >
                  {pageNum}
                </Button>
              )
            })}
            <Button
              variant='outline'
              size='icon'
              className='h-7 w-7'
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              <ChevronRight className='h-4 w-4' />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function formatHeader(key: string): string {
  const MAP: Record<string, string> = {
    fecha: 'Fecha',
    equipo: 'Equipo',
    codigoEquipo: 'Código',
    familia: 'Familia',
    tipo: 'Tipo',
    estado: 'Estado',
    descripcion: 'Descripción',
    tecnico: 'Técnico',
    costo: 'Costo',
    fechaCompletado: 'Completado',
    equipmentCode: 'Código',
    equipmentName: 'Equipo',
    usuarioAsignado: 'Usuario',
    fechaAsignacion: 'Asignación',
    fechaFin: 'Fin',
    tipoAsignacion: 'Tipo',
    nombre: 'Nombre',
    codigo: 'Código',
    fechaVencimiento: 'Vencimiento',
    diasRestantes: 'Días',
    urgencia: 'Urgencia',
    consumible: 'Suministro',
    cantidad: 'Cantidad',
    unidad: 'Unidad',
    motivo: 'Motivo',
    usuario: 'Usuario',
    folio: 'Folio',
    fechaBaja: 'Fecha Baja',
    tipoActivo: 'Tipo',
    nombreActivo: 'Nombre',
    codigoActivo: 'Código',
    solicitadoPor: 'Solicitado por',
    aprobadoPor: 'Aprobado por',
    subtipo: 'Subtipo',
    valorTotal: 'Valor Total',
    ubicacionFisica: 'Ubicación',
    bodega: 'Bodega',
    departamento: 'Departamento',
    equiposActivos: 'Equipos',
    valorEquipos: 'Valor Equipos',
    costoRentaMensual: 'Renta/Mes',
    costoRentaAnual: 'Renta/Año',
    licencias: 'Licencias',
    valorLicencias: 'Valor Lic.',
    materiales: 'Materiales',
    valorMateriales: 'Valor Mat.',
    costoMantenimiento: 'Mant.',
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

  const config = getTemplateBySlug(slug)
  const reportName = config?.name ?? slug
  const isSuperAdmin = (session?.user as any)?.isSuperAdmin === true
  const canManageInventory = (session?.user as any)?.canManageInventory === true
  const userLevel = resolveUserReportRole(
    session?.user?.role ?? '',
    isSuperAdmin,
    canManageInventory
  )

  // Filtros del reporte — defaults usan 'all' como centinela (Radix no permite value="")
  const familyId = searchParams.get('familyId') ?? undefined
  const [filterValues, setFilterValues] = useState<Record<string, string>>(() => {
    const defaults = getDefaultFilterValues(config?.filters ?? [])
    // Prefill desde query (ej. ficha suministro → ?consumableId=&type=EXIT)
    const fromUrl: Record<string, string> = {}
    searchParams.forEach((value, key) => {
      if (key === 'familyId' || key === 'format' || !value) return
      fromUrl[key] = value
    })
    return { ...defaults, ...fromUrl }
  })
  const scopedConsumableId = filterValues.consumableId || searchParams.get('consumableId') || ''

  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState<'csv' | 'pdf' | 'xlsx' | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  const buildParams = useCallback(() => {
    const params = new URLSearchParams()
    if (familyId) params.set('familyId', familyId)
    Object.entries(filterValues).forEach(([k, v]) => {
      // Omitir el centinela 'all' y valores vacíos — la API interpreta ausencia como "sin filtro"
      if (v && v !== ALL_FILTER) params.set(k, v)
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

  const handleExport = (format: 'csv' | 'pdf' | 'xlsx') => {
    setExporting(format)
    const params = buildParams()
    params.set('format', format)
    const a = document.createElement('a')
    a.href = `/api/inventory/reports/${slug}?${params}`
    a.download = `reporte-${slug}-${new Date().toISOString().split('T')[0]}.${format === 'xlsx' ? 'xlsx' : format}`
    document.body.appendChild(a)
    a.click()
    if (a && a.parentNode) a.parentNode.removeChild(a)
    setTimeout(() => setExporting(null), 1500)
  }

  // Hay filtros activos si algún select no es 'all' o alguna fecha está rellena
  const hasActiveFilters = Object.entries(filterValues).some(([, v]) => v && v !== ALL_FILTER)

  if (status === 'loading') {
    return (
      <ModuleLayout title='Cargando...' loading>
        <div />
      </ModuleLayout>
    )
  }

  if (!session?.user) return null

  // Verificar acceso al slug según rol
  if (!canAccessTemplate(slug, userLevel as 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER')) {
    return (
      <ModuleLayout title='Acceso restringido' subtitle='No tienes permiso para ver este reporte'>
        <div className='flex flex-col items-center justify-center py-20 gap-3 text-center'>
          <AlertTriangle className='h-10 w-10 text-amber-500' />
          <p className='text-muted-foreground max-w-sm'>
            {slug === 'financial-summary'
              ? 'El resumen financiero global solo está disponible para el Super Administrador.'
              : 'No tienes permiso para acceder a este reporte.'}
          </p>
          <Link href='/inventory/reports'>
            <Button variant='outline' size='sm'>
              Volver a reportes
            </Button>
          </Link>
        </div>
      </ModuleLayout>
    )
  }

  const roleSubtitle =
    userLevel === 'SUPER_ADMIN'
      ? 'Vista global — todas las familias'
      : userLevel === 'ADMIN'
        ? 'Todas las familias'
        : 'Datos de tus familias asignadas'

  return (
    <ModuleLayout title={reportName} subtitle={`${config?.description ?? ''} · ${roleSubtitle}`}>
      <div className='space-y-5'>
        {/* Volver */}
        <Link
          href='/inventory/reports'
          className='inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors'
        >
          <ChevronLeft className='h-4 w-4' />
          Volver a reportes
        </Link>

        {/* Filtros del reporte */}
        {config && config.filters.length > 0 && (
          <Card>
            <CardHeader className='pb-3'>
              <CardTitle className='text-sm font-medium flex items-center gap-2'>
                <Filter className='h-4 w-4' />
                Filtros
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className='flex flex-wrap gap-4 items-end'>
                {config.filters.map(f => (
                  <div key={f.key} className='flex flex-col gap-1.5 min-w-[160px]'>
                    <Label className='text-xs text-muted-foreground flex items-center gap-1'>
                      {f.type === 'date' && <Calendar className='h-3 w-3' />}
                      {f.label}
                    </Label>
                    {f.type === 'date' ? (
                      <DateInput
                        value={filterValues[f.key] ?? ''}
                        onChange={e =>
                          setFilterValues(prev => ({ ...prev, [f.key]: e.target.value }))
                        }
                        className='h-9 text-sm'
                        clearable
                      />
                    ) : (
                      <Select
                        value={filterValues[f.key] ?? ALL_FILTER}
                        onValueChange={v => setFilterValues(prev => ({ ...prev, [f.key]: v }))}
                      >
                        <SelectTrigger className='h-9 text-sm'>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {f.options?.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                ))}
                <Button size='sm' onClick={fetchReport} disabled={loading} className='h-9'>
                  {loading ? (
                    <Loader2 className='h-4 w-4 mr-1.5 animate-spin' />
                  ) : (
                    <RefreshCw className='h-4 w-4 mr-1.5' />
                  )}
                  Aplicar
                </Button>
                {hasActiveFilters && (
                  <Button
                    size='sm'
                    variant='ghost'
                    className='h-9 text-muted-foreground'
                    onClick={() => {
                      const defaults: Record<string, string> = {}
                      config.filters.forEach(f => {
                        if (f.type === 'select' && f.options?.[0])
                          defaults[f.key] = f.options[0].value
                      })
                      if (slug === 'expiring') defaults['days'] = '90'
                      // No conservar scope de URL (consumableId, etc.)
                      setFilterValues(defaults)
                    }}
                  >
                    <X className='h-3.5 w-3.5 mr-1' />
                    Limpiar
                  </Button>
                )}
              </div>
              {scopedConsumableId && (
                <div className='mt-3 flex flex-wrap items-center gap-2 text-xs'>
                  <Badge variant='secondary'>Filtrado por un suministro</Badge>
                  <Button
                    size='sm'
                    variant='ghost'
                    className='h-7 text-muted-foreground'
                    onClick={() => {
                      setFilterValues(prev => {
                        const next = { ...prev }
                        delete next.consumableId
                        return next
                      })
                    }}
                  >
                    <X className='h-3 w-3 mr-1' />
                    Quitar filtro de suministro
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Estado de carga / error */}
        {loading && (
          <div className='flex items-center justify-center py-20'>
            <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
          </div>
        )}

        {!loading && error && (
          <div className='flex flex-col items-center justify-center py-16 gap-3 text-center'>
            <AlertTriangle className='h-8 w-8 text-destructive' />
            <p className='text-sm text-muted-foreground'>{error}</p>
            <Button variant='outline' size='sm' onClick={fetchReport}>
              <RefreshCw className='h-4 w-4 mr-1.5' />
              Reintentar
            </Button>
          </div>
        )}

        {!loading && !error && reportData && (
          <>
            {/* Indicadores ejecutivos */}
            <div
              className={`grid gap-4 ${reportData.summary.length === 4 ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-1 sm:grid-cols-3'}`}
            >
              {reportData.summary.map((item, i) => (
                <Card key={i}>
                  <CardHeader className='pb-2'>
                    <CardTitle className='text-xs font-medium text-muted-foreground uppercase tracking-wide'>
                      {item.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className='pt-0'>
                    <p className='text-2xl font-bold leading-tight'>{item.value}</p>
                    <p className='text-xs text-muted-foreground mt-1 leading-snug'>
                      {item.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Metadatos + botones de exportación */}
            <div className='flex items-center justify-between flex-wrap gap-3'>
              <p className='text-xs text-muted-foreground'>
                {reportData.totalCount} registro{reportData.totalCount !== 1 ? 's' : ''}
                {familyId && ' · filtrado por área'}
                {' · '}Generado el{' '}
                {new Date(reportData.generatedAt).toLocaleString('es-MX', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
              <div className='flex gap-2'>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => handleExport('csv')}
                  disabled={!!exporting}
                >
                  {exporting === 'csv' ? (
                    <Loader2 className='h-4 w-4 mr-1.5 animate-spin' />
                  ) : (
                    <Download className='h-4 w-4 mr-1.5' />
                  )}
                  Exportar CSV
                </Button>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => handleExport('xlsx')}
                  disabled={!!exporting}
                >
                  {exporting === 'xlsx' ? (
                    <Loader2 className='h-4 w-4 mr-1.5 animate-spin' />
                  ) : (
                    <Download className='h-4 w-4 mr-1.5' />
                  )}
                  Exportar Excel
                </Button>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => handleExport('pdf')}
                  disabled={!!exporting}
                >
                  {exporting === 'pdf' ? (
                    <Loader2 className='h-4 w-4 mr-1.5 animate-spin' />
                  ) : (
                    <FileText className='h-4 w-4 mr-1.5' />
                  )}
                  Exportar PDF
                </Button>
              </div>
            </div>

            {/* Tabla de datos */}
            <Card>
              <CardContent className='p-0'>
                <DataTable rows={reportData.data} reportName={config?.name} />
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
