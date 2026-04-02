'use client'

/**
 * Módulo de Reportes Multi-Familia
 * Requisitos: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 14.1, 14.2, 14.5, 14.7
 */

import { useState, useEffect, useCallback } from 'react'
import {
  BarChart3,
  Download,
  RefreshCw,
  Users,
  TrendingUp,
  ShieldCheck,
  FileText,
  Loader2,
  AlertCircle,
  FileDown,
} from 'lucide-react'
import { RoleDashboardLayout } from '@/components/layout/role-dashboard-layout'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Family {
  id: string
  name: string
  code: string
  color: string | null
}

interface FamilyExecutiveSummary {
  familyId: string
  familyName: string
  familyCode: string
  familyColor: string | null
  totalTickets: number
  openTickets: number
  inProgressTickets: number
  resolvedTickets: number
  closedTickets: number
  avgResolutionTimeMinutes: number | null
  slaComplianceRate: number
}

interface TechnicianPerformance {
  technicianId: string
  technicianName: string
  technicianEmail: string
  assignedTickets: number
  resolvedTickets: number
  avgResolutionTimeMinutes: number | null
  avgRating: number | null
}

interface TemporalTrendPoint {
  period: string
  count: number
  familyId?: string
  familyName?: string
}

interface SLAComplianceRow {
  familyId: string
  familyName: string
  priority: string
  total: number
  compliant: number
  breached: number
  complianceRate: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMinutes(minutes: number | null): string {
  if (minutes === null || minutes === undefined) return '—'
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function priorityLabel(p: string): string {
  const map: Record<string, string> = {
    LOW: 'Baja',
    MEDIUM: 'Media',
    HIGH: 'Alta',
    URGENT: 'Urgente',
  }
  return map[p] ?? p
}

function priorityColor(p: string): string {
  const map: Record<string, string> = {
    LOW: 'bg-gray-100 text-gray-700',
    MEDIUM: 'bg-blue-100 text-blue-700',
    HIGH: 'bg-orange-100 text-orange-700',
    URGENT: 'bg-red-100 text-red-700',
  }
  return map[p] ?? 'bg-gray-100 text-gray-700'
}

function slaColor(rate: number): string {
  if (rate >= 90) return 'text-green-600'
  if (rate >= 70) return 'text-yellow-600'
  return 'text-red-600'
}

// ─── CSV Export ───────────────────────────────────────────────────────────────

function downloadCSV(filename: string, rows: string[][]): void {
  const content = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function exportExecutiveCSV(data: FamilyExecutiveSummary[], familyName: string): void {
  const header = [
    'Familia',
    'Código',
    'Total Tickets',
    'Abiertos',
    'En Progreso',
    'Resueltos',
    'Cerrados',
    'Tiempo Prom. Resolución',
    'Cumplimiento SLA (%)',
  ]
  const rows = data.map((r) => [
    r.familyName,
    r.familyCode,
    String(r.totalTickets),
    String(r.openTickets),
    String(r.inProgressTickets),
    String(r.resolvedTickets),
    String(r.closedTickets),
    formatMinutes(r.avgResolutionTimeMinutes),
    String(r.slaComplianceRate),
  ])
  downloadCSV(`resumen-ejecutivo-${familyName}-${new Date().toISOString().split('T')[0]}.csv`, [header, ...rows])
}

function exportTechniciansCSV(data: TechnicianPerformance[], familyName: string): void {
  const header = [
    'Técnico',
    'Email',
    'Tickets Asignados',
    'Tickets Resueltos',
    'Tiempo Prom. Resolución',
    'Calificación Promedio',
  ]
  const rows = data.map((r) => [
    r.technicianName,
    r.technicianEmail,
    String(r.assignedTickets),
    String(r.resolvedTickets),
    formatMinutes(r.avgResolutionTimeMinutes),
    r.avgRating !== null ? String(r.avgRating) : '—',
  ])
  downloadCSV(`rendimiento-tecnicos-${familyName}-${new Date().toISOString().split('T')[0]}.csv`, [header, ...rows])
}

function exportTrendsCSV(data: TemporalTrendPoint[], familyName: string): void {
  const header = ['Período', 'Familia', 'Cantidad de Tickets']
  const rows = data.map((r) => [r.period, r.familyName ?? familyName, String(r.count)])
  downloadCSV(`tendencias-${familyName}-${new Date().toISOString().split('T')[0]}.csv`, [header, ...rows])
}

function exportSLACSV(data: SLAComplianceRow[], familyName: string): void {
  const header = [
    'Familia',
    'Prioridad',
    'Total',
    'Cumplidos',
    'Incumplidos',
    'Tasa de Cumplimiento (%)',
  ]
  const rows = data.map((r) => [
    r.familyName,
    priorityLabel(r.priority),
    String(r.total),
    String(r.compliant),
    String(r.breached),
    String(r.complianceRate),
  ])
  downloadCSV(`cumplimiento-sla-${familyName}-${new Date().toISOString().split('T')[0]}.csv`, [header, ...rows])
}

// ─── PDF / Print Export ───────────────────────────────────────────────────────

function exportPDF(
  family: Family | null,
  tab: string,
  executiveData: FamilyExecutiveSummary[],
  techniciansData: TechnicianPerformance[],
  trendsData: TemporalTrendPoint[],
  slaData: SLAComplianceRow[],
  granularity: string
): void {
  const familyName = family ? family.name : 'Todas las familias'
  const familyCode = family ? family.code : 'ALL'
  const familyColor = family?.color ?? '#6B7280'
  const date = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })

  let tableHTML = ''

  if (tab === 'executive') {
    tableHTML = `
      <table>
        <thead><tr>
          <th>Familia</th><th>Código</th><th>Total</th><th>Abiertos</th>
          <th>Resueltos</th><th>Tiempo Prom.</th><th>SLA %</th>
        </tr></thead>
        <tbody>
          ${executiveData.map((r) => `<tr>
            <td>${r.familyName}</td><td>${r.familyCode}</td><td>${r.totalTickets}</td>
            <td>${r.openTickets}</td><td>${r.resolvedTickets}</td>
            <td>${formatMinutes(r.avgResolutionTimeMinutes)}</td>
            <td>${r.slaComplianceRate}%</td>
          </tr>`).join('')}
        </tbody>
      </table>`
  } else if (tab === 'technicians') {
    tableHTML = `
      <table>
        <thead><tr>
          <th>Técnico</th><th>Email</th><th>Asignados</th><th>Resueltos</th>
          <th>Tiempo Prom.</th><th>Calificación</th>
        </tr></thead>
        <tbody>
          ${techniciansData.map((r) => `<tr>
            <td>${r.technicianName}</td><td>${r.technicianEmail}</td>
            <td>${r.assignedTickets}</td><td>${r.resolvedTickets}</td>
            <td>${formatMinutes(r.avgResolutionTimeMinutes)}</td>
            <td>${r.avgRating ?? '—'}</td>
          </tr>`).join('')}
        </tbody>
      </table>`
  } else if (tab === 'trends') {
    tableHTML = `
      <table>
        <thead><tr><th>Período</th><th>Familia</th><th>Tickets</th></tr></thead>
        <tbody>
          ${trendsData.map((r) => `<tr>
            <td>${r.period}</td><td>${r.familyName ?? familyName}</td><td>${r.count}</td>
          </tr>`).join('')}
        </tbody>
      </table>`
  } else if (tab === 'sla') {
    tableHTML = `
      <table>
        <thead><tr>
          <th>Familia</th><th>Prioridad</th><th>Total</th>
          <th>Cumplidos</th><th>Incumplidos</th><th>Tasa %</th>
        </tr></thead>
        <tbody>
          ${slaData.map((r) => `<tr>
            <td>${r.familyName}</td><td>${priorityLabel(r.priority)}</td>
            <td>${r.total}</td><td>${r.compliant}</td><td>${r.breached}</td>
            <td>${r.complianceRate}%</td>
          </tr>`).join('')}
        </tbody>
      </table>`
  }

  const tabLabels: Record<string, string> = {
    executive: 'Resumen Ejecutivo',
    technicians: 'Rendimiento de Técnicos',
    trends: `Tendencias Temporales (${granularity === 'day' ? 'Diario' : granularity === 'week' ? 'Semanal' : 'Mensual'})`,
    sla: 'Cumplimiento de SLA',
  }

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Reporte — ${familyName}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #1f2937; }
    .header { border-left: 6px solid ${familyColor}; padding: 12px 16px; margin-bottom: 24px; background: #f9fafb; }
    .header h1 { margin: 0 0 4px; font-size: 20px; }
    .header p { margin: 0; color: #6b7280; font-size: 13px; }
    .badge { display: inline-block; background: ${familyColor}22; color: ${familyColor}; border: 1px solid ${familyColor}55; border-radius: 4px; padding: 2px 8px; font-size: 12px; font-weight: 600; margin-left: 8px; }
    h2 { font-size: 16px; margin: 0 0 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { background: #f3f4f6; text-align: left; padding: 8px 10px; border-bottom: 2px solid #e5e7eb; }
    td { padding: 7px 10px; border-bottom: 1px solid #e5e7eb; }
    tr:nth-child(even) td { background: #f9fafb; }
    .footer { margin-top: 24px; font-size: 11px; color: #9ca3af; text-align: right; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>Sistema de Tickets — ${tabLabels[tab] ?? tab} <span class="badge">${familyCode}</span></h1>
    <p>${familyName} &nbsp;·&nbsp; Generado el ${date}</p>
  </div>
  <h2>${tabLabels[tab] ?? tab}</h2>
  ${tableHTML}
  <div class="footer">Reporte generado automáticamente · ${date}</div>
  <script>window.onload = function() { window.print(); }<\/script>
</body>
</html>`

  const blob = new Blob([html], { type: 'text/html;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const win = window.open(url, '_blank')
  if (win) win.focus()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ReportsPage() {
  // Families
  const [families, setFamilies] = useState<Family[]>([])
  const [selectedFamilyId, setSelectedFamilyId] = useState<string>('all')

  // Active tab
  const [activeTab, setActiveTab] = useState<'executive' | 'technicians' | 'trends' | 'sla'>('executive')

  // Granularity for trends
  const [granularity, setGranularity] = useState<'day' | 'week' | 'month'>('month')

  // Data
  const [executiveData, setExecutiveData] = useState<FamilyExecutiveSummary[]>([])
  const [techniciansData, setTechniciansData] = useState<TechnicianPerformance[]>([])
  const [trendsData, setTrendsData] = useState<TemporalTrendPoint[]>([])
  const [slaData, setSlaData] = useState<SLAComplianceRow[]>([])

  // Loading states
  const [loadingFamilies, setLoadingFamilies] = useState(true)
  const [loadingData, setLoadingData] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Audit log helper
  const logExport = useCallback(async (format: string) => {
    try {
      await fetch('/api/audit/export-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'REPORT_EXPORTED',
          format,
          familyId: selectedFamilyId,
          tab: activeTab,
        }),
      })
    } catch {
      // Non-critical — don't block export
    }
  }, [selectedFamilyId, activeTab])

  // Load families list
  useEffect(() => {
    async function loadFamilies() {
      try {
        const res = await fetch('/api/families')
        const json = await res.json()
        if (json.success) {
          setFamilies(json.data ?? [])
        }
      } catch {
        // ignore
      } finally {
        setLoadingFamilies(false)
      }
    }
    loadFamilies()
  }, [])

  // Load report data when family or tab changes
  const loadReportData = useCallback(async () => {
    setLoadingData(true)
    setError(null)
    try {
      const familyParam = selectedFamilyId === 'all' ? 'all' : selectedFamilyId
      const baseUrl =
        familyParam === 'all'
          ? '/api/reports/families'
          : `/api/reports/families/${familyParam}`

      if (activeTab === 'executive') {
        const url = familyParam === 'all' ? baseUrl : `${baseUrl}?type=executive`
        const res = await fetch(url)
        const json = await res.json()
        if (json.success) setExecutiveData(Array.isArray(json.data) ? json.data : [json.data])
      } else if (activeTab === 'technicians') {
        const res = await fetch(`${baseUrl}?type=technicians`)
        const json = await res.json()
        if (json.success) setTechniciansData(json.data ?? [])
      } else if (activeTab === 'trends') {
        const res = await fetch(`${baseUrl}?type=trends&granularity=${granularity}`)
        const json = await res.json()
        if (json.success) setTrendsData(json.data ?? [])
      } else if (activeTab === 'sla') {
        const res = await fetch(`${baseUrl}?type=sla`)
        const json = await res.json()
        if (json.success) setSlaData(json.data ?? [])
      }
    } catch (e) {
      setError('Error al cargar los datos del reporte.')
    } finally {
      setLoadingData(false)
    }
  }, [selectedFamilyId, activeTab, granularity])

  useEffect(() => {
    loadReportData()
  }, [loadReportData])

  const selectedFamily = families.find((f) => f.id === selectedFamilyId) ?? null
  const familyDisplayName = selectedFamily ? selectedFamily.name : 'Todas las familias'

  // ── CSV handlers ──
  const handleExportCSV = useCallback(() => {
    if (activeTab === 'executive') exportExecutiveCSV(executiveData, familyDisplayName)
    else if (activeTab === 'technicians') exportTechniciansCSV(techniciansData, familyDisplayName)
    else if (activeTab === 'trends') exportTrendsCSV(trendsData, familyDisplayName)
    else if (activeTab === 'sla') exportSLACSV(slaData, familyDisplayName)
    logExport('csv')
  }, [activeTab, executiveData, techniciansData, trendsData, slaData, familyDisplayName, logExport])

  // ── PDF handler ──
  const handleExportPDF = useCallback(() => {
    exportPDF(selectedFamily, activeTab, executiveData, techniciansData, trendsData, slaData, granularity)
    logExport('pdf')
  }, [selectedFamily, activeTab, executiveData, techniciansData, trendsData, slaData, granularity, logExport])

  return (
    <RoleDashboardLayout title="Reportes Multi-Familia" subtitle="Análisis de desempeño por familia de soporte">
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reportes Multi-Familia</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Análisis de desempeño por familia de soporte
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadReportData} disabled={loadingData}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loadingData ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      {/* Global family filter */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Filtrar por familia:</span>
              {loadingFamilies ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Select value={selectedFamilyId} onValueChange={setSelectedFamilyId}>
                  <SelectTrigger className="w-56">
                    <SelectValue placeholder="Seleccionar familia" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las familias</SelectItem>
                    {families.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        <div className="flex items-center gap-2">
                          {f.color && (
                            <span
                              className="inline-block h-3 w-3 rounded-full flex-shrink-0"
                              style={{ backgroundColor: f.color }}
                            />
                          )}
                          {f.name}
                          <Badge variant="outline" className="text-xs ml-1">
                            {f.code}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            {selectedFamily && (
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-4 w-4 rounded-full"
                  style={{ backgroundColor: selectedFamily.color ?? '#6B7280' }}
                />
                <span className="text-sm font-medium">{selectedFamily.name}</span>
                <Badge variant="secondary">{selectedFamily.code}</Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <span className="text-sm text-red-700">{error}</span>
            <Button variant="outline" size="sm" onClick={loadReportData} className="ml-auto">
              Reintentar
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as typeof activeTab)}
        className="space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <TabsList className="grid grid-cols-4 w-full sm:w-auto">
            <TabsTrigger value="executive" className="flex items-center gap-1.5">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Resumen Ejecutivo</span>
              <span className="sm:hidden">Resumen</span>
            </TabsTrigger>
            <TabsTrigger value="technicians" className="flex items-center gap-1.5">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Técnicos</span>
              <span className="sm:hidden">Técnicos</span>
            </TabsTrigger>
            <TabsTrigger value="trends" className="flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4" />
              <span className="hidden sm:inline">Tendencias</span>
              <span className="sm:hidden">Tendencias</span>
            </TabsTrigger>
            <TabsTrigger value="sla" className="flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Cumplimiento SLA</span>
              <span className="sm:hidden">SLA</span>
            </TabsTrigger>
          </TabsList>

          {/* Export buttons */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              disabled={loadingData}
            >
              <Download className="h-4 w-4 mr-1.5" />
              Exportar CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportPDF}
              disabled={loadingData}
            >
              <FileDown className="h-4 w-4 mr-1.5" />
              Exportar PDF
            </Button>
          </div>
        </div>

        {/* ── Tab: Resumen Ejecutivo ── */}
        <TabsContent value="executive">
          <ExecutiveSummaryTab
            data={executiveData}
            loading={loadingData}
            isAllFamilies={selectedFamilyId === 'all'}
          />
        </TabsContent>

        {/* ── Tab: Rendimiento de Técnicos ── */}
        <TabsContent value="technicians">
          <TechniciansTab data={techniciansData} loading={loadingData} />
        </TabsContent>

        {/* ── Tab: Tendencias Temporales ── */}
        <TabsContent value="trends">
          <TrendsTab
            data={trendsData}
            loading={loadingData}
            granularity={granularity}
            onGranularityChange={setGranularity}
            isAllFamilies={selectedFamilyId === 'all'}
          />
        </TabsContent>

        {/* ── Tab: Cumplimiento de SLA ── */}
        <TabsContent value="sla">
          <SLATab data={slaData} loading={loadingData} />
        </TabsContent>
      </Tabs>
    </div>
    </RoleDashboardLayout>
  )
}

// ─── Tab Components ───────────────────────────────────────────────────────────

// ── Executive Summary Tab ──────────────────────────────────────────────────────

function ExecutiveSummaryTab({
  data,
  loading,
  isAllFamilies,
}: {
  data: FamilyExecutiveSummary[]
  loading: boolean
  isAllFamilies: boolean
}) {
  if (loading) return <TabLoadingState />
  if (data.length === 0) return <TabEmptyState message="No hay datos de resumen ejecutivo para los filtros seleccionados." />

  return (
    <div className="space-y-4">
      {isAllFamilies && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="py-3">
            <p className="text-sm text-blue-700 font-medium">
              Vista comparativa — mostrando todas las familias activas
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Resumen Ejecutivo por Familia
          </CardTitle>
          <CardDescription>
            Total de tickets, estado y cumplimiento de SLA por familia de soporte
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium">Familia</th>
                  <th className="text-right p-3 font-medium">Total</th>
                  <th className="text-right p-3 font-medium">Abiertos</th>
                  <th className="text-right p-3 font-medium">En Progreso</th>
                  <th className="text-right p-3 font-medium">Resueltos</th>
                  <th className="text-right p-3 font-medium">Cerrados</th>
                  <th className="text-right p-3 font-medium">Tiempo Prom.</th>
                  <th className="text-right p-3 font-medium">SLA %</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row) => (
                  <tr key={row.familyId} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        {row.familyColor && (
                          <span
                            className="inline-block h-3 w-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: row.familyColor }}
                          />
                        )}
                        <span className="font-medium">{row.familyName}</span>
                        <Badge variant="outline" className="text-xs">
                          {row.familyCode}
                        </Badge>
                      </div>
                    </td>
                    <td className="p-3 text-right font-semibold">{row.totalTickets}</td>
                    <td className="p-3 text-right">
                      <span className="text-yellow-600 font-medium">{row.openTickets}</span>
                    </td>
                    <td className="p-3 text-right">
                      <span className="text-blue-600 font-medium">{row.inProgressTickets}</span>
                    </td>
                    <td className="p-3 text-right">
                      <span className="text-green-600 font-medium">{row.resolvedTickets}</span>
                    </td>
                    <td className="p-3 text-right text-muted-foreground">{row.closedTickets}</td>
                    <td className="p-3 text-right text-muted-foreground">
                      {formatMinutes(row.avgResolutionTimeMinutes)}
                    </td>
                    <td className="p-3 text-right">
                      <span className={`font-semibold ${slaColor(row.slaComplianceRate)}`}>
                        {row.slaComplianceRate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              {data.length > 1 && (
                <tfoot>
                  <tr className="border-t-2 bg-muted/50 font-semibold">
                    <td className="p-3">Total</td>
                    <td className="p-3 text-right">{data.reduce((s, r) => s + r.totalTickets, 0)}</td>
                    <td className="p-3 text-right text-yellow-600">{data.reduce((s, r) => s + r.openTickets, 0)}</td>
                    <td className="p-3 text-right text-blue-600">{data.reduce((s, r) => s + r.inProgressTickets, 0)}</td>
                    <td className="p-3 text-right text-green-600">{data.reduce((s, r) => s + r.resolvedTickets, 0)}</td>
                    <td className="p-3 text-right text-muted-foreground">{data.reduce((s, r) => s + r.closedTickets, 0)}</td>
                    <td className="p-3 text-right text-muted-foreground">—</td>
                    <td className="p-3 text-right">
                      <span className={`font-semibold ${slaColor(
                        data.length > 0
                          ? Math.round(data.reduce((s, r) => s + r.slaComplianceRate, 0) / data.length * 10) / 10
                          : 0
                      )}`}>
                        {data.length > 0
                          ? (Math.round(data.reduce((s, r) => s + r.slaComplianceRate, 0) / data.length * 10) / 10)
                          : 0}%
                      </span>
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ── Technicians Tab ────────────────────────────────────────────────────────────

function TechniciansTab({
  data,
  loading,
}: {
  data: TechnicianPerformance[]
  loading: boolean
}) {
  const [search, setSearch] = useState('')

  const filtered = data.filter(
    (t) =>
      t.technicianName.toLowerCase().includes(search.toLowerCase()) ||
      t.technicianEmail.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return <TabLoadingState />
  if (data.length === 0) return <TabEmptyState message="No hay datos de rendimiento de técnicos para los filtros seleccionados." />

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Rendimiento de Técnicos
        </CardTitle>
        <CardDescription>
          Métricas de desempeño por técnico filtradas por familia
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <input
          type="text"
          placeholder="Buscar técnico..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-72 px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">Técnico</th>
                <th className="text-right p-3 font-medium">Asignados</th>
                <th className="text-right p-3 font-medium">Resueltos</th>
                <th className="text-right p-3 font-medium">Eficiencia</th>
                <th className="text-right p-3 font-medium">Tiempo Prom.</th>
                <th className="text-right p-3 font-medium">Calificación</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((tech) => {
                const efficiency =
                  tech.assignedTickets > 0
                    ? Math.round((tech.resolvedTickets / tech.assignedTickets) * 100)
                    : 0
                return (
                  <tr key={tech.technicianId} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="p-3">
                      <div>
                        <p className="font-medium">{tech.technicianName}</p>
                        <p className="text-xs text-muted-foreground">{tech.technicianEmail}</p>
                      </div>
                    </td>
                    <td className="p-3 text-right">{tech.assignedTickets}</td>
                    <td className="p-3 text-right text-green-600 font-medium">{tech.resolvedTickets}</td>
                    <td className="p-3 text-right">
                      <span
                        className={`font-semibold ${
                          efficiency >= 80
                            ? 'text-green-600'
                            : efficiency >= 50
                            ? 'text-yellow-600'
                            : 'text-red-600'
                        }`}
                      >
                        {efficiency}%
                      </span>
                    </td>
                    <td className="p-3 text-right text-muted-foreground">
                      {formatMinutes(tech.avgResolutionTimeMinutes)}
                    </td>
                    <td className="p-3 text-right">
                      {tech.avgRating !== null ? (
                        <span className="font-medium text-amber-600">
                          ★ {tech.avgRating.toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p className="text-center text-muted-foreground py-6 text-sm">
              No se encontraron técnicos con ese criterio de búsqueda.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ── Trends Tab ─────────────────────────────────────────────────────────────────

function TrendsTab({
  data,
  loading,
  granularity,
  onGranularityChange,
  isAllFamilies,
}: {
  data: TemporalTrendPoint[]
  loading: boolean
  granularity: 'day' | 'week' | 'month'
  onGranularityChange: (g: 'day' | 'week' | 'month') => void
  isAllFamilies: boolean
}) {
  if (loading) return <TabLoadingState />

  // Aggregate data for chart: when all families, group by period summing counts
  const chartData = (() => {
    if (!isAllFamilies) {
      return data.map((d) => ({ period: d.period, count: d.count }))
    }
    // Group by period
    const map = new Map<string, number>()
    for (const d of data) {
      map.set(d.period, (map.get(d.period) ?? 0) + d.count)
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, count]) => ({ period, count }))
  })()

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Tendencias Temporales
            </CardTitle>
            <CardDescription>
              Volumen de tickets creados por período
            </CardDescription>
          </div>
          <Select value={granularity} onValueChange={(v) => onGranularityChange(v as typeof granularity)}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Diario</SelectItem>
              <SelectItem value="week">Semanal</SelectItem>
              <SelectItem value="month">Mensual</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <TabEmptyState message="No hay datos de tendencias para el período seleccionado." />
        ) : (
          <div className="space-y-6">
            {/* Chart */}
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="period"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 6 }}
                  formatter={(value: number) => [value, 'Tickets']}
                />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Tickets" />
              </BarChart>
            </ResponsiveContainer>

            {/* Table fallback */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium">Período</th>
                    <th className="text-right p-3 font-medium">Tickets</th>
                  </tr>
                </thead>
                <tbody>
                  {chartData.map((row) => (
                    <tr key={row.period} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="p-3 font-mono text-sm">{row.period}</td>
                      <td className="p-3 text-right font-semibold">{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── SLA Tab ────────────────────────────────────────────────────────────────────

function SLATab({
  data,
  loading,
}: {
  data: SLAComplianceRow[]
  loading: boolean
}) {
  if (loading) return <TabLoadingState />
  if (data.length === 0) return <TabEmptyState message="No hay datos de cumplimiento de SLA para los filtros seleccionados." />

  // Group by family
  const byFamily = data.reduce<Record<string, SLAComplianceRow[]>>((acc, row) => {
    if (!acc[row.familyId]) acc[row.familyId] = []
    acc[row.familyId].push(row)
    return acc
  }, {})

  const priorities = ['URGENT', 'HIGH', 'MEDIUM', 'LOW']

  return (
    <div className="space-y-4">
      {Object.entries(byFamily).map(([familyId, rows]) => {
        const familyName = rows[0]?.familyName ?? familyId
        const totalAll = rows.reduce((s, r) => s + r.total, 0)
        const compliantAll = rows.reduce((s, r) => s + r.compliant, 0)
        const overallRate = totalAll > 0 ? Math.round((compliantAll / totalAll) * 1000) / 10 : 0

        return (
          <Card key={familyId}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" />
                  {familyName}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Tasa global:</span>
                  <span className={`font-bold text-lg ${slaColor(overallRate)}`}>
                    {overallRate}%
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-3 font-medium">Prioridad</th>
                      <th className="text-right p-3 font-medium">Total</th>
                      <th className="text-right p-3 font-medium">Cumplidos</th>
                      <th className="text-right p-3 font-medium">Incumplidos</th>
                      <th className="text-right p-3 font-medium">Tasa SLA</th>
                      <th className="p-3 font-medium">Barra</th>
                    </tr>
                  </thead>
                  <tbody>
                    {priorities.map((priority) => {
                      const row = rows.find((r) => r.priority === priority)
                      if (!row) return null
                      return (
                        <tr key={priority} className="border-b hover:bg-muted/30 transition-colors">
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${priorityColor(priority)}`}>
                              {priorityLabel(priority)}
                            </span>
                          </td>
                          <td className="p-3 text-right">{row.total}</td>
                          <td className="p-3 text-right text-green-600 font-medium">{row.compliant}</td>
                          <td className="p-3 text-right text-red-600 font-medium">{row.breached}</td>
                          <td className="p-3 text-right">
                            <span className={`font-semibold ${slaColor(row.complianceRate)}`}>
                              {row.complianceRate}%
                            </span>
                          </td>
                          <td className="p-3 min-w-[120px]">
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  row.complianceRate >= 90
                                    ? 'bg-green-500'
                                    : row.complianceRate >= 70
                                    ? 'bg-yellow-500'
                                    : 'bg-red-500'
                                }`}
                                style={{ width: `${row.complianceRate}%` }}
                              />
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

// ── Shared UI ──────────────────────────────────────────────────────────────────

function TabLoadingState() {
  return (
    <Card>
      <CardContent className="flex items-center justify-center py-16">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">Cargando datos...</p>
        </div>
      </CardContent>
    </Card>
  )
}

function TabEmptyState({ message }: { message: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
        <FileText className="h-12 w-12 text-muted-foreground" />
        <p className="text-sm text-muted-foreground text-center max-w-sm">{message}</p>
      </CardContent>
    </Card>
  )
}
