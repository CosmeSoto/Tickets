'use client'

import { useState, useEffect, useCallback, use, Suspense } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowLeft,
  Download,
  FileText,
  Loader2,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react'
import { RoleDashboardLayout } from '@/components/layout/role-dashboard-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

const REPORT_NAMES: Record<string, string> = {
  summary: '¿Qué tenemos?',
  assignments: '¿Quién tiene qué?',
  expiring: '¿Qué está por vencer?',
  'stock-movements': '¿Qué se ha consumido?',
  decommissioned: '¿Qué se ha dado de baja?',
  maintenance: 'Historial de mantenimientos',
  locations: '¿Dónde están los equipos?',
}

interface SummaryItem {
  title: string
  value: string | number
  description: string
}

interface ReportData {
  summary: SummaryItem[]
  data: Record<string, unknown>[]
  filters: Record<string, unknown>
  generatedAt: string
  totalCount: number
}

// Urgency badge colors for expiring report
const URGENCY_COLORS: Record<string, string> = {
  Crítico: 'bg-red-100 text-red-800',
  Alto: 'bg-orange-100 text-orange-800',
  Normal: 'bg-green-100 text-green-800',
}

function DataTable({ rows }: { rows: Record<string, unknown>[] }) {
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
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm divide-y divide-border">
        <thead className="bg-muted/50">
          <tr>
            {headers.map((h) => (
              <th
                key={h}
                className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap"
              >
                {formatHeader(h)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-card">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-muted/40">
              {headers.map((h) => {
                const val = row[h]
                const strVal = val == null ? '—' : String(val)

                // Render urgency as badge
                if (h === 'urgencia' && typeof val === 'string') {
                  return (
                    <td key={h} className="px-3 py-2">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${URGENCY_COLORS[val] ?? 'bg-muted text-muted-foreground'}`}
                      >
                        {val}
                      </span>
                    </td>
                  )
                }

                // Render tipo as badge
                if (h === 'tipo' && typeof val === 'string') {
                  return (
                    <td key={h} className="px-3 py-2">
                      <Badge variant="outline" className="text-xs">
                        {val}
                      </Badge>
                    </td>
                  )
                }

                return (
                  <td key={h} className="px-3 py-2 text-foreground">
                    {strVal}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
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
    consumible: 'Consumible',
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
    cantidad_: 'Cantidad',
    valorTotal: 'Valor Total',
  }
  return MAP[key] ?? key
}

function ReportSlugContent({ slug }: { slug: string }) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()

  const familyId = searchParams.get('familyId') ?? undefined
  const reportName = REPORT_NAMES[slug] ?? slug

  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState<'csv' | 'pdf' | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  const fetchReport = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (familyId) params.set('familyId', familyId)
      const res = await fetch(`/api/inventory/reports/${slug}?${params}`)
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? `Error ${res.status}`)
      }
      const json = await res.json()
      setReportData(json)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el reporte')
    } finally {
      setLoading(false)
    }
  }, [slug, familyId])

  useEffect(() => {
    if (status === 'authenticated') {
      fetchReport()
    }
  }, [fetchReport, status])

  const handleExport = async (format: 'csv' | 'pdf') => {
    setExporting(format)
    try {
      const params = new URLSearchParams({ format })
      if (familyId) params.set('familyId', familyId)
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
      // silently fail — user can retry
    } finally {
      setExporting(null)
    }
  }

  if (status === 'loading') {
    return (
      <RoleDashboardLayout title="Cargando..." subtitle="">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </RoleDashboardLayout>
    )
  }

  if (!session?.user) return null

  return (
    <RoleDashboardLayout
      title={reportName}
      subtitle={familyId ? 'Filtrado por familia seleccionada' : 'Todos los datos del inventario'}
      headerActions={
        <Button variant="ghost" size="sm" onClick={() => router.push('/inventory/reports')}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Volver
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Botones de exportación */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <p className="text-sm text-muted-foreground">
            {reportData
              ? `${reportData.totalCount} registro${reportData.totalCount !== 1 ? 's' : ''} · Generado el ${new Date(reportData.generatedAt).toLocaleString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`
              : ' '}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport('csv')}
              disabled={loading || !!exporting}
            >
              {exporting === 'csv' ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-1" />
              )}
              Exportar CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport('pdf')}
              disabled={loading || !!exporting}
            >
              {exporting === 'pdf' ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <FileText className="h-4 w-4 mr-1" />
              )}
              Exportar PDF
            </Button>
          </div>
        </div>

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
              <RefreshCw className="h-4 w-4 mr-1" />
              Reintentar
            </Button>
          </div>
        )}

        {!loading && !error && reportData && (
          <>
            {/* Resumen ejecutivo — 3 indicadores */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {reportData.summary.map((item, i) => (
                <Card key={i}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {item.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-2xl font-bold">{item.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Tabla de datos */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Datos del reporte</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <DataTable rows={reportData.data} />
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </RoleDashboardLayout>
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
