'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Loader2, Search } from 'lucide-react'
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { ExportButton } from '@/components/common/export-button'
import { useExport } from '@/hooks/common/use-export'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DateTimePicker } from '@/components/ui/date-time-picker'
import {
  PatrolReportDetail,
  type PatrolDetail,
  type Pagination,
} from '@/components/patrols/reports/patrol-report-detail'
import {
  IncidentReportView,
  type IncidentReport,
} from '@/components/patrols/reports/incident-report-view'

// ── Types ───────────────────────────────────────────────────────────────────────

interface Family {
  id: string
  name: string
}

// ── Helpers ─────────────────────────────────────────────────────────────────────

function defaultFrom() {
  const d = new Date()
  d.setDate(d.getDate() - 30)
  return d.toISOString().slice(0, 16)
}

function defaultTo() {
  return new Date().toISOString().slice(0, 16)
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('es-EC', {
    timeZone: 'America/Guayaquil',
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

// ── Page Component ──────────────────────────────────────────────────────────────

export default function PatrolReportsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  // Tab state
  const [activeTab, setActiveTab] = useState<'detail' | 'incidents'>('detail')

  // Filters
  const [dateFrom, setDateFrom] = useState(defaultFrom)
  const [dateTo, setDateTo] = useState(defaultTo)
  const [familyId, setFamilyId] = useState<string>('all')
  const [families, setFamilies] = useState<Family[]>([])

  // Detail tab state
  const [patrols, setPatrols] = useState<PatrolDetail[]>([])
  const [detailPagination, setDetailPagination] = useState<Pagination | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [expandedPatrol, setExpandedPatrol] = useState<string | null>(null)

  // Incidents tab state
  const [incidentData, setIncidentData] = useState<IncidentReport | null>(null)
  const [incidentLoading, setIncidentLoading] = useState(false)

  // ── Fetch families ──────────────────────────────────────────────────────────
  const fetchFamilies = useCallback(async () => {
    try {
      const res = await fetch('/api/families?includeInactive=false&module=patrols')
      const data = await res.json()
      if (data.success) setFamilies(data.data)
    } catch {
      /* silencioso */
    }
  }, [])

  // ── Fetch detail report ─────────────────────────────────────────────────────
  const fetchDetail = useCallback(
    async (page = 1) => {
      setDetailLoading(true)
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: '10',
          dateFrom: new Date(dateFrom).toISOString(),
          dateTo: new Date(dateTo).toISOString(),
        })
        if (familyId && familyId !== 'all') params.set('familyId', familyId)

        const res = await fetch(`/api/patrols/reports/detail?${params}`)
        const json = await res.json()
        if (json.success) {
          setPatrols(json.data)
          setDetailPagination(json.pagination)
        }
      } catch {
        /* silencioso */
      } finally {
        setDetailLoading(false)
      }
    },
    [dateFrom, dateTo, familyId]
  )

  // ── Fetch incident report ───────────────────────────────────────────────────
  const fetchIncidents = useCallback(async () => {
    setIncidentLoading(true)
    try {
      const params = new URLSearchParams({
        dateFrom: new Date(dateFrom).toISOString(),
        dateTo: new Date(dateTo).toISOString(),
      })
      if (familyId && familyId !== 'all') params.set('familyId', familyId)

      const res = await fetch(`/api/patrols/reports/incidents?${params}`)
      const json = await res.json()
      if (json.success) setIncidentData(json.data)
    } catch {
      /* silencioso */
    } finally {
      setIncidentLoading(false)
    }
  }, [dateFrom, dateTo, familyId])

  // ── Export for detail tab ───────────────────────────────────────────────────
  // Genera filas aplanadas: una fila de resumen por patrulla + una fila por checkpoint.
  // Esto permite ver los tiempos de escaneo de cada punto en el reporte exportado.
  const detailExport = useExport({
    filename: 'reporte-patrullas-detalle',
    title: 'Detalle de Patrullas',
    subtitle: `Período: ${new Date(dateFrom).toLocaleDateString('es-EC')} - ${new Date(dateTo).toLocaleDateString('es-EC')}`,
    columns: [
      { key: 'tipo', label: 'Tipo' },
      { key: 'routeName', label: 'Ruta' },
      { key: 'agentName', label: 'Agente' },
      {
        key: 'scheduledStart',
        label: 'Inicio Programado',
        format: (v: string) => (v ? formatDate(v) : ''),
      },
      {
        key: 'isOnTime',
        label: 'Puntualidad',
        format: (v: any) =>
          v === null || v === '' ? '' : v === true || v === 'A tiempo' ? 'A tiempo' : 'Tarde',
      },
      {
        key: 'completionPercentage',
        label: '% Completado',
        format: (v: any) => (v !== '' ? String(v) : ''),
      },
      {
        key: 'durationMinutes',
        label: 'Duración (min)',
        format: (v: any) => (v !== null && v !== '' ? String(v) : '—'),
      },
      { key: 'incidentes', label: 'Incidentes' },
      { key: 'orden', label: 'CP #' },
      { key: 'checkpoint', label: 'Checkpoint' },
      { key: 'escaneado', label: 'Hora Escaneo' },
      { key: 'desdeAnterior', label: 'Desde anterior (min)' },
      { key: 'estadoCP', label: 'Estado CP' },
    ],
    getData: () => {
      const rows: Record<string, any>[] = []
      for (const patrol of patrols) {
        // Fila de resumen de la patrulla
        rows.push({
          tipo: 'PATRULLA',
          routeName: patrol.routeName,
          agentName: patrol.agentName,
          scheduledStart: patrol.scheduledStart,
          isOnTime: patrol.isOnTime === null ? '—' : patrol.isOnTime ? 'A tiempo' : 'Tarde',
          completionPercentage: patrol.completionPercentage,
          durationMinutes: patrol.durationMinutes,
          incidentes: patrol.incidentSummary?.total ?? 0,
          orden: '',
          checkpoint: '',
          escaneado: '',
          desdeAnterior: '',
          estadoCP: '',
        })
        // Una fila por cada checkpoint de la ronda
        for (const cp of patrol.checkpointTimeline) {
          const estadoLabel =
            cp.status === 'ON_TIME' ? 'A tiempo' : cp.status === 'LATE' ? 'Tarde' : 'No escaneado'
          rows.push({
            tipo: 'CHECKPOINT',
            routeName: '',
            agentName: '',
            scheduledStart: '',
            isOnTime: '',
            completionPercentage: '',
            durationMinutes: '',
            incidentes: '',
            orden: cp.order,
            checkpoint: cp.checkpointName,
            escaneado: cp.scannedAt ? formatDate(cp.scannedAt) : '—',
            desdeAnterior: cp.timeFromPrevious !== null ? cp.timeFromPrevious : '—',
            estadoCP: estadoLabel,
          })
        }
      }
      return rows
    },
  })

  // ── Initial load ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      router.push('/login')
      return
    }
    fetchFamilies()
  }, [session, status, router, fetchFamilies])

  // Load data when tab changes
  useEffect(() => {
    if (!session) return
    if (activeTab === 'detail') fetchDetail(1)
    else fetchIncidents()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  const handleSearch = () => {
    if (activeTab === 'detail') fetchDetail(1)
    else fetchIncidents()
  }

  if (status === 'loading' || !session) return null

  const isLoading = activeTab === 'detail' ? detailLoading : incidentLoading

  return (
    <ModuleLayout
      title='Reportes de Rondas'
      subtitle='Análisis de rendimiento y cumplimiento de patrullas'
    >
      {/* ── Filtros compartidos ── */}
      <div className='rounded-lg border bg-card p-4 mb-6'>
        <div className='flex items-center gap-2 mb-4'>
          <Search className='h-4 w-4 text-muted-foreground' />
          <h3 className='text-sm font-medium'>Filtros</h3>
        </div>
        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'>
          <div className='space-y-1.5'>
            <Label className='text-xs'>Desde</Label>
            <DateTimePicker value={dateFrom} onChange={setDateFrom} className='h-9' />
          </div>
          <div className='space-y-1.5'>
            <Label className='text-xs'>Hasta</Label>
            <DateTimePicker value={dateTo} onChange={setDateTo} className='h-9' />
          </div>
          <div className='space-y-1.5'>
            <Label className='text-xs'>Área</Label>
            <Select value={familyId} onValueChange={setFamilyId}>
              <SelectTrigger className='h-9'>
                <SelectValue placeholder='Todas las áreas' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>Todas las áreas</SelectItem>
                {families.map(f => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className='flex items-end'>
            <Button onClick={handleSearch} disabled={isLoading} className='w-full'>
              {isLoading ? (
                <Loader2 className='h-4 w-4 mr-2 animate-spin' />
              ) : (
                <Search className='h-4 w-4 mr-2' />
              )}
              Buscar
            </Button>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className='flex gap-2 mb-6'>
        <Button
          size='sm'
          variant={activeTab === 'detail' ? 'default' : 'outline'}
          onClick={() => setActiveTab('detail')}
        >
          Detalle de Patrullas
        </Button>
        <Button
          size='sm'
          variant={activeTab === 'incidents' ? 'default' : 'outline'}
          onClick={() => setActiveTab('incidents')}
        >
          Incidentes
        </Button>
      </div>

      {/* ── Tab content ── */}
      {activeTab === 'detail' ? (
        <PatrolReportDetail
          patrols={patrols}
          pagination={detailPagination}
          loading={detailLoading}
          expandedPatrol={expandedPatrol}
          onToggleExpand={id => setExpandedPatrol(prev => (prev === id ? null : id))}
          onPageChange={p => fetchDetail(p)}
          exportButton={
            patrols.length > 0 ? (
              <ExportButton
                onExportCSV={detailExport.exportCSV}
                onExportExcel={detailExport.exportExcel}
                onExportPDF={detailExport.exportPDF}
                loading={detailExport.exporting}
                size='sm'
                variant='outline'
              />
            ) : undefined
          }
        />
      ) : (
        <IncidentReportView data={incidentData} loading={incidentLoading} />
      )}
    </ModuleLayout>
  )
}
