'use client'

/**
 * Módulo de Reportes Multi-Familia
 * Requisitos: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 14.1, 14.2, 14.5, 14.7
 */

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
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
  Star,
  SmilePlus,
  Crown,
} from 'lucide-react'
import { RoleDashboardLayout } from '@/components/layout/role-dashboard-layout'
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { FamilyCombobox } from '@/components/ui/family-combobox'
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
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

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

interface SatisfactionReport {
  totalRatings: number
  avgRating: number | null
  distribution: Record<number, number>
  categoryAverages: {
    responseTime: number | null
    technicalSkill: number | null
    communication: number | null
    problemResolution: number | null
  }
  satisfactionRate: number | null
  byFamily: {
    familyId: string
    familyName: string
    familyCode: string
    familyColor: string | null
    totalRatings: number
    avgRating: number
    satisfactionRate: number
  }[]
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
  const bom = '\uFEFF'
  const encoded = encodeURIComponent(bom + content)
  const a = document.createElement('a')
  a.href = `data:text/csv;charset=utf-8,${encoded}`
  a.download = filename
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
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

function exportSatisfactionCSV(data: SatisfactionReport, familyName: string): void {
  const header = ['Familia', 'Total Calificaciones', 'Promedio', 'Tasa Satisfacción (%)', '★1', '★2', '★3', '★4', '★5']
  const rows = data.byFamily.length > 0
    ? data.byFamily.map((r) => [
        r.familyName,
        String(r.totalRatings),
        String(r.avgRating),
        String(r.satisfactionRate),
        '—', '—', '—', '—', '—',
      ])
    : [[
        familyName,
        String(data.totalRatings),
        data.avgRating !== null ? String(data.avgRating) : '—',
        data.satisfactionRate !== null ? String(data.satisfactionRate) : '—',
        String(data.distribution[1] ?? 0),
        String(data.distribution[2] ?? 0),
        String(data.distribution[3] ?? 0),
        String(data.distribution[4] ?? 0),
        String(data.distribution[5] ?? 0),
      ]]
  downloadCSV(`satisfaccion-${familyName}-${new Date().toISOString().split('T')[0]}.csv`, [header, ...rows])
}
// ─── PDF / Print Export ───────────────────────────────────────────────────────

function exportPDF(
  family: Family | null,
  tab: string,
  executiveData: FamilyExecutiveSummary[],
  techniciansData: TechnicianPerformance[],
  trendsData: TemporalTrendPoint[],
  slaData: SLAComplianceRow[],
  satisfactionData: SatisfactionReport | null,
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
    satisfaction: 'Satisfacción del Cliente',
  }

  if (tab === 'satisfaction' && satisfactionData) {
    tableHTML = `
      <table>
        <thead><tr>
          <th>Familia</th><th>Calificaciones</th><th>Promedio</th><th>Satisfacción %</th>
        </tr></thead>
        <tbody>
          ${satisfactionData.byFamily.length > 0
            ? satisfactionData.byFamily.map((r) => `<tr>
                <td>${r.familyName}</td><td>${r.totalRatings}</td>
                <td>★ ${r.avgRating}</td><td>${r.satisfactionRate}%</td>
              </tr>`).join('')
            : `<tr><td colspan="4">Total: ${satisfactionData.totalRatings} calificaciones · Promedio: ★ ${satisfactionData.avgRating ?? '—'} · Satisfacción: ${satisfactionData.satisfactionRate ?? '—'}%</td></tr>`
          }
        </tbody>
      </table>`
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

  // Usar Blob en lugar de data: URL (Chrome bloquea data: URLs en window.open)
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const win = window.open(url, '_blank')
  if (win) {
    win.focus()
    // Revocar el URL del blob después de que la ventana cargue
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ReportsPage() {
  const { data: session } = useSession()
  const isSuperAdmin = (session?.user as any)?.isSuperAdmin === true

  // Families
  const [families, setFamilies] = useState<Family[]>([])
  const [selectedFamilyId, setSelectedFamilyId] = useState<string>('all')

  // Active tab
  const [activeTab, setActiveTab] = useState<'executive' | 'technicians' | 'trends' | 'sla' | 'satisfaction'>('executive')

  // Granularity for trends
  const [granularity, setGranularity] = useState<'day' | 'week' | 'month'>('month')

  // Date range filter
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')

  // Data
  const [executiveData, setExecutiveData] = useState<FamilyExecutiveSummary[]>([])
  const [techniciansData, setTechniciansData] = useState<TechnicianPerformance[]>([])
  const [trendsData, setTrendsData] = useState<TemporalTrendPoint[]>([])
  const [slaData, setSlaData] = useState<SLAComplianceRow[]>([])
  const [satisfactionData, setSatisfactionData] = useState<SatisfactionReport | null>(null)

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

      // Build date query params
      const dateParams = new URLSearchParams()
      if (startDate) dateParams.set('startDate', startDate)
      if (endDate) dateParams.set('endDate', endDate)
      const dateSuffix = dateParams.toString() ? `&${dateParams.toString()}` : ''
      const dateQuery = dateParams.toString() ? `?${dateParams.toString()}` : ''

      if (activeTab === 'executive') {
        const url = familyParam === 'all' ? `${baseUrl}${dateQuery}` : `${baseUrl}?type=executive${dateSuffix}`
        const res = await fetch(url)
        const json = await res.json()
        if (json.success) setExecutiveData(Array.isArray(json.data) ? json.data : [json.data])
      } else if (activeTab === 'technicians') {
        const res = await fetch(`${baseUrl}?type=technicians${dateSuffix}`)
        const json = await res.json()
        if (json.success) setTechniciansData(json.data ?? [])
      } else if (activeTab === 'trends') {
        const res = await fetch(`${baseUrl}?type=trends&granularity=${granularity}${dateSuffix}`)
        const json = await res.json()
        if (json.success) setTrendsData(json.data ?? [])
      } else if (activeTab === 'sla') {
        const res = await fetch(`${baseUrl}?type=sla${dateSuffix}`)
        const json = await res.json()
        if (json.success) setSlaData(json.data ?? [])
      } else if (activeTab === 'satisfaction') {
        const res = await fetch(`${baseUrl}?type=satisfaction${dateSuffix}`)
        const json = await res.json()
        if (json.success) setSatisfactionData(json.data ?? null)
      }
    } catch {
      setError('Error al cargar los datos del reporte.')
    } finally {
      setLoadingData(false)
    }
  }, [selectedFamilyId, activeTab, granularity, startDate, endDate])

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
    else if (activeTab === 'satisfaction' && satisfactionData) exportSatisfactionCSV(satisfactionData, familyDisplayName)
    logExport('csv')
  }, [activeTab, executiveData, techniciansData, trendsData, slaData, satisfactionData, familyDisplayName, logExport])

  // ── PDF handler ──
  const handleExportPDF = useCallback(() => {
    exportPDF(selectedFamily, activeTab, executiveData, techniciansData, trendsData, slaData, satisfactionData, granularity)
    logExport('pdf')
  }, [selectedFamily, activeTab, executiveData, techniciansData, trendsData, slaData, satisfactionData, granularity, logExport])

  return (
    <ModuleLayout
      title="Reportes Multi-Familia"
      subtitle={isSuperAdmin ? "Vista global — todas las familias" : "Análisis de desempeño de tus familias asignadas"}
    >
    <div className="space-y-6">
      {/* Global family filter */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Familia */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">Familia:</span>
              {loadingFamilies ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FamilyCombobox
                  families={families.map(f => ({ id: f.id, name: f.name, code: f.code, color: f.color }))}
                  value={selectedFamilyId}
                  onValueChange={setSelectedFamilyId}
                  allowAll
                  allowClear
                  popoverWidth="260px"
                  className="w-52"
                  disabled={loadingFamilies}
                />
              )}
              {/* Badge de alcance */}
              {isSuperAdmin ? (
                <Badge className="bg-amber-100 text-amber-700 border-amber-200 flex items-center gap-1 shrink-0">
                  <Crown className="h-3 w-3" />
                  Vista global
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground shrink-0">
                  Tus familias
                </Badge>
              )}
            </div>

            <div className="w-px h-6 bg-border hidden sm:block" />

            {/* Date range */}
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium text-muted-foreground whitespace-nowrap">Desde:</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-36 h-9 text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium text-muted-foreground whitespace-nowrap">Hasta:</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-36 h-9 text-sm"
              />
            </div>
            {(startDate || endDate) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setStartDate(''); setEndDate('') }}
                className="text-muted-foreground h-9"
              >
                Limpiar
              </Button>
            )}

            {selectedFamily && (
              <div className="flex items-center gap-2 ml-auto">
                <span
                  className="inline-block h-3 w-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: selectedFamily.color ?? '#6B7280' }}
                />
                <span className="text-sm font-medium">{selectedFamily.name}</span>
                <Badge variant="secondary" className="font-mono text-xs">{selectedFamily.code}</Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="py-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <span className="text-sm text-destructive">{error}</span>
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
        <div className="flex flex-col gap-2">
          {/* Tabs — scroll horizontal en mobile */}
          <div className="overflow-x-auto -mx-1 px-1">
            <TabsList className="inline-flex w-max min-w-full sm:w-full sm:grid sm:grid-cols-5">
              <TabsTrigger value="executive" className="flex items-center gap-1.5 whitespace-nowrap">
                <BarChart3 className="h-4 w-4 flex-shrink-0" />
                <span className="hidden lg:inline">Resumen Ejecutivo</span>
                <span className="lg:hidden">Resumen</span>
              </TabsTrigger>
              <TabsTrigger value="technicians" className="flex items-center gap-1.5 whitespace-nowrap">
                <Users className="h-4 w-4 flex-shrink-0" />
                <span>Técnicos</span>
              </TabsTrigger>
              <TabsTrigger value="trends" className="flex items-center gap-1.5 whitespace-nowrap">
                <TrendingUp className="h-4 w-4 flex-shrink-0" />
                <span>Tendencias</span>
              </TabsTrigger>
              <TabsTrigger value="sla" className="flex items-center gap-1.5 whitespace-nowrap">
                <ShieldCheck className="h-4 w-4 flex-shrink-0" />
                <span className="hidden lg:inline">Cumplimiento SLA</span>
                <span className="lg:hidden">SLA</span>
              </TabsTrigger>
              <TabsTrigger value="satisfaction" className="flex items-center gap-1.5 whitespace-nowrap">
                <Star className="h-4 w-4 flex-shrink-0" />
                <span className="hidden lg:inline">Satisfacción</span>
                <span className="lg:hidden">★</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Action buttons — siempre en su propia fila, alineados a la derecha */}
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadReportData}
              disabled={loadingData}
            >
              <RefreshCw className={`h-4 w-4 mr-1.5 ${loadingData ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Actualizar</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              disabled={loadingData}
            >
              <Download className="h-4 w-4 mr-1.5" />
              <span className="hidden sm:inline">CSV</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportPDF}
              disabled={loadingData}
            >
              <FileDown className="h-4 w-4 mr-1.5" />
              <span className="hidden sm:inline">PDF</span>
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

        {/* ── Tab: Satisfacción del Cliente ── */}
        <TabsContent value="satisfaction">
          <SatisfactionTab data={satisfactionData} loading={loadingData} />
        </TabsContent>
      </Tabs>
    </div>
    </ModuleLayout>
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

  // Aggregate KPIs
  const totalTickets = data.reduce((s, r) => s + r.totalTickets, 0)
  const totalOpen = data.reduce((s, r) => s + r.openTickets, 0)
  const totalResolved = data.reduce((s, r) => s + r.resolvedTickets, 0)
  const avgSLA = data.length > 0
    ? Math.round(data.reduce((s, r) => s + r.slaComplianceRate, 0) / data.length * 10) / 10
    : 0
  const resolutionRate = totalTickets > 0 ? Math.round((totalResolved / totalTickets) * 1000) / 10 : 0

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Total Tickets</p>
            <p className="text-2xl font-bold mt-1">{totalTickets.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Abiertos</p>
            <p className="text-2xl font-bold mt-1 text-orange-600">{totalOpen.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Tasa de Resolución</p>
            <p className={`text-2xl font-bold mt-1 ${resolutionRate >= 80 ? 'text-green-600' : resolutionRate >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
              {resolutionRate}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Cumplimiento SLA</p>
            <p className={`text-2xl font-bold mt-1 ${slaColor(avgSLA)}`}>{avgSLA}%</p>
          </CardContent>
        </Card>
      </div>

      {isAllFamilies && (
        <Card className="bg-muted/30 border-border">
          <CardContent className="py-3">
            <p className="text-sm text-muted-foreground font-medium">
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
      t.technicianName?.toLowerCase().includes(search.toLowerCase()) ||
      t.technicianEmail?.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return <TabLoadingState />
  if (data.length === 0) return <TabEmptyState message="No hay datos de rendimiento de técnicos para los filtros seleccionados." />

  const totalAssigned = data.reduce((s, t) => s + t.assignedTickets, 0)
  const totalResolved = data.reduce((s, t) => s + t.resolvedTickets, 0)
  const withRating = data.filter((t) => t.avgRating !== null)
  const avgRating = withRating.length > 0
    ? Math.round(withRating.reduce((s, t) => s + t.avgRating!, 0) / withRating.length * 10) / 10
    : null

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Técnicos Activos</p>
            <p className="text-2xl font-bold mt-1">{data.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Tickets Asignados</p>
            <p className="text-2xl font-bold mt-1">{totalAssigned.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Tickets Resueltos</p>
            <p className="text-2xl font-bold mt-1 text-green-600">{totalResolved.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Calificación Promedio</p>
            <p className="text-2xl font-bold mt-1 text-amber-600">
              {avgRating !== null ? `★ ${avgRating.toFixed(1)}` : '—'}
            </p>
          </CardContent>
        </Card>
      </div>

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
    </div>
  )
}

// ── Trends Tab ─────────────────────────────────────────────────────────────────

// Palette for multi-family stacked bars
const FAMILY_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#6366f1',
]

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
  if (data.length === 0) return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Tendencias Temporales
          </CardTitle>
          <Select value={granularity} onValueChange={(v) => onGranularityChange(v as typeof granularity)}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Diario</SelectItem>
              <SelectItem value="week">Semanal</SelectItem>
              <SelectItem value="month">Mensual</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <TabEmptyState message="No hay datos de tendencias para el período seleccionado." />
      </CardContent>
    </Card>
  )

  // Totales para KPIs
  const totalTickets = data.reduce((s, d) => s + d.count, 0)
  const periods = Array.from(new Set(data.map(d => d.period))).sort()
  const lastPeriodCount = (() => {
    const last = periods[periods.length - 1]
    return data.filter(d => d.period === last).reduce((s, d) => s + d.count, 0)
  })()
  const prevPeriodCount = (() => {
    if (periods.length < 2) return null
    const prev = periods[periods.length - 2]
    return data.filter(d => d.period === prev).reduce((s, d) => s + d.count, 0)
  })()
  const trend = prevPeriodCount !== null && prevPeriodCount > 0
    ? Math.round(((lastPeriodCount - prevPeriodCount) / prevPeriodCount) * 100)
    : null

  // Build chart data
  const { chartData, familyKeys } = (() => {
    if (!isAllFamilies) {
      return {
        chartData: data.map((d) => ({ period: d.period, count: d.count })),
        familyKeys: [] as string[],
      }
    }
    const familyNames = Array.from(new Set(data.map((d) => d.familyName ?? 'Sin familia')))
    const periodMap = new Map<string, Record<string, number>>()
    for (const d of data) {
      const fname = d.familyName ?? 'Sin familia'
      if (!periodMap.has(d.period)) periodMap.set(d.period, {})
      periodMap.get(d.period)![fname] = (periodMap.get(d.period)![fname] ?? 0) + d.count
    }
    const chartData = Array.from(periodMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, counts]) => ({ period, ...counts }))
    return { chartData, familyKeys: familyNames }
  })()

  // Table data
  const tableData = (() => {
    if (!isAllFamilies) return data.map((d) => ({ period: d.period, count: d.count }))
    const map = new Map<string, number>()
    for (const d of data) map.set(d.period, (map.get(d.period) ?? 0) + d.count)
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, count]) => ({ period, count }))
  })()

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Total en el período</p>
            <p className="text-2xl font-bold mt-1">{totalTickets.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Último período</p>
            <p className="text-2xl font-bold mt-1">{lastPeriodCount.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Variación vs anterior</p>
            <p className={`text-2xl font-bold mt-1 ${
              trend === null ? 'text-muted-foreground'
              : trend > 0 ? 'text-orange-600'
              : trend < 0 ? 'text-green-600'
              : 'text-muted-foreground'
            }`}>
              {trend === null ? '—' : `${trend > 0 ? '+' : ''}${trend}%`}
            </p>
          </CardContent>
        </Card>
      </div>

    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Tendencias Temporales
            </CardTitle>
            <CardDescription>
              Volumen de tickets creados por período{isAllFamilies ? ' — desglose por familia' : ''}
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
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6 }} />
                {isAllFamilies && familyKeys.length > 0 ? (
                  <>
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    {familyKeys.map((fname, i) => (
                      <Bar
                        key={fname}
                        dataKey={fname}
                        stackId="a"
                        fill={FAMILY_COLORS[i % FAMILY_COLORS.length]}
                        radius={i === familyKeys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                        name={fname}
                      />
                    ))}
                  </>
                ) : (
                  <Bar dataKey="count" fill={FAMILY_COLORS[0]} radius={[4, 4, 0, 0]} name="Tickets" />
                )}
              </BarChart>
            </ResponsiveContainer>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium">Período</th>
                    <th className="text-right p-3 font-medium">Tickets</th>
                    <th className="text-right p-3 font-medium">Variación</th>
                  </tr>
                </thead>
                <tbody>
                  {tableData.map((row, idx) => {
                    const prev = idx > 0 ? tableData[idx - 1].count : null
                    const delta = prev !== null && prev > 0
                      ? Math.round(((row.count - prev) / prev) * 100)
                      : null
                    return (
                      <tr key={row.period} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="p-3 font-mono text-sm">{row.period}</td>
                        <td className="p-3 text-right font-semibold">{row.count}</td>
                        <td className="p-3 text-right">
                          {delta === null ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <span className={delta > 0 ? 'text-orange-600' : delta < 0 ? 'text-green-600' : 'text-muted-foreground'}>
                              {delta > 0 ? '+' : ''}{delta}%
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 bg-muted/50 font-semibold">
                    <td className="p-3">Total</td>
                    <td className="p-3 text-right">{totalTickets.toLocaleString()}</td>
                    <td className="p-3 text-right text-muted-foreground">—</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
      </CardContent>
    </Card>
    </div>
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

// ── Satisfaction Tab ───────────────────────────────────────────────────────────

function SatisfactionTab({ data, loading }: { data: SatisfactionReport | null; loading: boolean }) {
  if (loading) return <TabLoadingState />
  if (!data || data.totalRatings === 0) return <TabEmptyState message="No hay calificaciones registradas para los filtros seleccionados." />

  const stars = [5, 4, 3, 2, 1]
  const starLabels: Record<number, string> = { 5: 'Excelente', 4: 'Bueno', 3: 'Regular', 2: 'Malo', 1: 'Muy malo' }
  const catLabels: Record<string, string> = {
    responseTime: 'Tiempo de Respuesta',
    technicalSkill: 'Habilidad Técnica',
    communication: 'Comunicación',
    problemResolution: 'Resolución del Problema',
  }

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Total Calificaciones</p>
            <p className="text-2xl font-bold mt-1">{data.totalRatings}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Promedio General</p>
            <p className="text-2xl font-bold mt-1 text-amber-500">
              {data.avgRating !== null ? `★ ${data.avgRating.toFixed(1)}` : '—'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Tasa de Satisfacción</p>
            <p className={`text-2xl font-bold mt-1 ${
              data.satisfactionRate !== null
                ? data.satisfactionRate >= 80 ? 'text-green-600' : data.satisfactionRate >= 60 ? 'text-yellow-600' : 'text-red-600'
                : 'text-muted-foreground'
            }`}>
              {data.satisfactionRate !== null ? `${data.satisfactionRate}%` : '—'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Calificaciones 4-5★</p>
            <p className="text-2xl font-bold mt-1 text-green-600">
              {((data.distribution[4] ?? 0) + (data.distribution[5] ?? 0)).toLocaleString()}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Distribución de estrellas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Star className="h-4 w-4" />
              Distribución de Calificaciones
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {stars.map((star) => {
              const count = data.distribution[star] ?? 0
              const pct = data.totalRatings > 0 ? Math.round((count / data.totalRatings) * 100) : 0
              return (
                <div key={star} className="flex items-center gap-3">
                  <span className="text-sm font-medium w-20 flex-shrink-0 text-amber-500">
                    {'★'.repeat(star)}{'☆'.repeat(5 - star)}
                  </span>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${star >= 4 ? 'bg-green-500' : star === 3 ? 'bg-yellow-500' : 'bg-red-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-sm text-muted-foreground w-16 text-right flex-shrink-0">
                    {count} ({pct}%)
                  </span>
                </div>
              )
            })}
          </CardContent>
        </Card>

        {/* Promedios por categoría */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <SmilePlus className="h-4 w-4" />
              Calificación por Categoría
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(catLabels).map(([key, label]) => {
              const val = data.categoryAverages[key as keyof typeof data.categoryAverages]
              const pct = val !== null ? (val / 5) * 100 : 0
              return (
                <div key={key} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-medium text-amber-500">
                      {val !== null ? `★ ${val.toFixed(1)}` : '—'}
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${pct >= 80 ? 'bg-green-500' : pct >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>

      {/* Desglose por familia */}
      {data.byFamily.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Satisfacción por Familia</CardTitle>
            <CardDescription>Comparativa de calificaciones entre familias de soporte</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium">Familia</th>
                    <th className="text-right p-3 font-medium">Calificaciones</th>
                    <th className="text-right p-3 font-medium">Promedio</th>
                    <th className="text-right p-3 font-medium">Satisfacción</th>
                    <th className="p-3 font-medium">Barra</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byFamily.map((row) => (
                    <tr key={row.familyId} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          {row.familyColor && (
                            <span className="inline-block h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: row.familyColor }} />
                          )}
                          <span className="font-medium">{row.familyName}</span>
                          <Badge variant="outline" className="text-xs">{row.familyCode}</Badge>
                        </div>
                      </td>
                      <td className="p-3 text-right">{row.totalRatings}</td>
                      <td className="p-3 text-right font-medium text-amber-500">★ {row.avgRating.toFixed(1)}</td>
                      <td className="p-3 text-right">
                        <span className={`font-semibold ${row.satisfactionRate >= 80 ? 'text-green-600' : row.satisfactionRate >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                          {row.satisfactionRate}%
                        </span>
                      </td>
                      <td className="p-3 min-w-[120px]">
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${row.satisfactionRate >= 80 ? 'bg-green-500' : row.satisfactionRate >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                            style={{ width: `${row.satisfactionRate}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
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
