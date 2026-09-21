'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns'
import { ArrowLeft, Download, FileText, RefreshCw } from 'lucide-react'
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DateInput } from '@/components/ui/date-input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getStatusLabel } from '@/components/ui/resolution-plan/plan-helpers'

type DatePreset = 'today' | 'week' | 'month' | 'custom' | 'all'

interface CatalogData {
  canFilterByTechnician: boolean
  technicians: { id: string; name: string }[]
  families: { id: string; name: string; color: string | null }[]
}

interface ReportTaskRow {
  id: string
  origin: 'ticket' | 'personal'
  title: string
  status: string
  priority: string
  dueDate: string | null
  completedAt: string | null
  assigneeName: string | null
  familyName: string | null
  ticketTitle: string | null
}

interface ReportSummary {
  total: number
  overdueCount: number
  byStatus: { status: string; count: number }[]
  byOrigin: { origin: string; count: number }[]
  byFamily: { familyName: string; count: number }[]
  byTechnician: { name: string; count: number }[]
}

const ORIGIN_LABEL: Record<string, string> = { ticket: 'Ticket', personal: 'Independiente' }
const PAGE_SIZE = 25

function todayStr(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

export default function PlannerReportsPage() {
  const router = useRouter()

  const [catalog, setCatalog] = useState<CatalogData | null>(null)
  const [preset, setPreset] = useState<DatePreset>('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [origin, setOrigin] = useState('all')
  const [status, setStatus] = useState('all')
  const [familyId, setFamilyId] = useState('all')
  const [userId, setUserId] = useState('all')
  const [page, setPage] = useState(1)

  const [rows, setRows] = useState<ReportTaskRow[]>([])
  const [summary, setSummary] = useState<ReportSummary | null>(null)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState<'csv' | 'pdf' | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/planner/reports/catalog')
      .then(res => res.json())
      .then(setCatalog)
      .catch(() => {})
  }, [])

  const applyPreset = (p: DatePreset) => {
    setPreset(p)
    const now = new Date()
    if (p === 'today') {
      setFrom(todayStr())
      setTo(todayStr())
    } else if (p === 'week') {
      setFrom(format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'))
      setTo(format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'))
    } else if (p === 'month') {
      setFrom(format(startOfMonth(now), 'yyyy-MM-dd'))
      setTo(format(endOfMonth(now), 'yyyy-MM-dd'))
    } else if (p === 'all') {
      setFrom('')
      setTo('')
    }
  }

  const runReport = useCallback(
    async (exportFormat: 'json' | 'csv' | 'pdf' = 'json', targetPage = page) => {
      const body = {
        from: from || undefined,
        to: to || undefined,
        origin,
        status,
        familyId,
        userId,
        page: targetPage,
        pageSize: PAGE_SIZE,
        format: exportFormat,
      }
      if (exportFormat !== 'json') {
        setExporting(exportFormat)
        try {
          const res = await fetch('/api/planner/reports/run', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
          if (!res.ok) throw new Error('No fue posible exportar el reporte.')
          const blob = await res.blob()
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `reporte-tareas.${exportFormat}`
          a.click()
          URL.revokeObjectURL(url)
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Error exportando el reporte.')
        } finally {
          setExporting(null)
        }
        return
      }

      setLoading(true)
      try {
        const res = await fetch('/api/planner/reports/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'No fue posible cargar el reporte.')
        setRows(data.tasks ?? [])
        setSummary(data.summary ?? null)
        setTotal(data.total ?? 0)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error cargando el reporte.')
      } finally {
        setLoading(false)
      }
    },
    [from, to, origin, status, familyId, userId, page]
  )

  // Si cambió algún filtro (no solo la página), se vuelve a la página 1 —
  // de lo contrario, filtrar estando en la página 3 muestra una tabla vacía
  // sobre un total distinto de cero hasta que el usuario navega a mano.
  const filtersKey = JSON.stringify({ from, to, origin, status, familyId, userId })
  const prevFiltersKey = useRef(filtersKey)
  useEffect(() => {
    const filtersChanged = prevFiltersKey.current !== filtersKey
    prevFiltersKey.current = filtersKey
    if (filtersChanged && page !== 1) {
      // Solo actualiza la página — este mismo efecto se vuelve a ejecutar
      // con page=1 y filtersChanged ya en false, y ESA corrida es la que
      // pide el reporte. Pedirlo también acá duplicaba la misma consulta.
      setPage(1)
      return
    }
    void runReport('json', page)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey, page])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <ModuleLayout
      title='Reportes de Tareas'
      subtitle='Cumplimiento por técnico, por área, y de ticket vs. independientes — sin tope de antigüedad.'
      loading={loading && rows.length === 0}
      error={error}
      onRetry={() => void runReport('json', page)}
      headerActions={
        <div className='flex gap-2'>
          <Button variant='outline' size='sm' onClick={() => router.push('/planner')}>
            <ArrowLeft className='mr-2 h-4 w-4' />
            Volver
          </Button>
          <Button
            variant='outline'
            size='sm'
            disabled={exporting !== null}
            onClick={() => void runReport('csv')}
          >
            <Download className='mr-2 h-4 w-4' />
            {exporting === 'csv' ? 'Exportando...' : 'CSV'}
          </Button>
          <Button
            variant='outline'
            size='sm'
            disabled={exporting !== null}
            onClick={() => void runReport('pdf')}
          >
            <FileText className='mr-2 h-4 w-4' />
            {exporting === 'pdf' ? 'Exportando...' : 'PDF'}
          </Button>
        </div>
      }
    >
      <div className='space-y-4'>
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Filtros</CardTitle>
          </CardHeader>
          <CardContent className='space-y-3'>
            <div className='flex flex-wrap gap-1.5'>
              {(
                [
                  ['today', 'Hoy'],
                  ['week', 'Esta semana'],
                  ['month', 'Este mes'],
                  ['custom', 'Rango personalizado'],
                  ['all', 'Sin filtro de fecha'],
                ] as [DatePreset, string][]
              ).map(([p, label]) => (
                <Button
                  key={p}
                  type='button'
                  size='sm'
                  variant={preset === p ? 'default' : 'outline'}
                  className='h-7 text-xs'
                  onClick={() => applyPreset(p)}
                >
                  {label}
                </Button>
              ))}
            </div>

            <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5'>
              <DateInput
                value={from}
                onChange={e => {
                  setFrom(e.target.value)
                  setPreset('custom')
                }}
                placeholder='Desde'
                clearable
              />
              <DateInput
                value={to}
                onChange={e => {
                  setTo(e.target.value)
                  setPreset('custom')
                }}
                placeholder='Hasta'
                clearable
              />

              <Select value={origin} onValueChange={setOrigin}>
                <SelectTrigger>
                  <SelectValue placeholder='Origen' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>Todos los orígenes</SelectItem>
                  <SelectItem value='ticket'>Solo de ticket</SelectItem>
                  <SelectItem value='personal'>Solo independientes</SelectItem>
                </SelectContent>
              </Select>

              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue placeholder='Estado' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>Todos los estados</SelectItem>
                  <SelectItem value='pending'>Pendiente</SelectItem>
                  <SelectItem value='in_progress'>En progreso</SelectItem>
                  <SelectItem value='completed'>Completada</SelectItem>
                  <SelectItem value='blocked'>Bloqueada</SelectItem>
                  <SelectItem value='overdue'>Vencidas</SelectItem>
                </SelectContent>
              </Select>

              {catalog && catalog.families.length > 0 && (
                <Select value={familyId} onValueChange={setFamilyId}>
                  <SelectTrigger>
                    <SelectValue placeholder='Área' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='all'>Todas las áreas</SelectItem>
                    <SelectItem value='none'>Sin área</SelectItem>
                    {catalog.families.map(f => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {catalog?.canFilterByTechnician && (
                <Select value={userId} onValueChange={setUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder='Técnico' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='all'>Todos los técnicos</SelectItem>
                    {catalog.technicians.map(t => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </CardContent>
        </Card>

        {summary && (
          <div className='grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6'>
            <SummaryCard label='Total' value={summary.total} />
            <SummaryCard label='Vencidas' value={summary.overdueCount} destructive />
            {summary.byStatus.map(s => (
              <SummaryCard key={s.status} label={getStatusLabel(s.status)} value={s.count} />
            ))}
          </div>
        )}

        {summary && (summary.byTechnician.length > 0 || summary.byFamily.length > 0) && (
          <div className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
            {summary.byTechnician.length > 0 && (
              <BreakdownCard
                title='Por técnico'
                items={summary.byTechnician.map(t => ({ label: t.name, count: t.count }))}
              />
            )}
            {summary.byFamily.length > 0 && (
              <BreakdownCard
                title='Por área'
                items={summary.byFamily.map(f => ({ label: f.familyName, count: f.count }))}
              />
            )}
          </div>
        )}

        <Card>
          <CardHeader className='flex flex-row items-center justify-between'>
            <CardTitle className='text-base'>Tareas ({total})</CardTitle>
            {loading && <RefreshCw className='h-4 w-4 animate-spin text-muted-foreground' />}
          </CardHeader>
          <CardContent className='overflow-x-auto'>
            <table className='w-full text-sm'>
              <thead>
                <tr className='border-b text-left text-xs text-muted-foreground'>
                  <th className='py-2 pr-3'>Título</th>
                  <th className='py-2 pr-3'>Origen</th>
                  <th className='py-2 pr-3'>Estado</th>
                  <th className='py-2 pr-3'>Fecha límite</th>
                  <th className='py-2 pr-3'>Responsable</th>
                  <th className='py-2 pr-3'>Área</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} className='border-b last:border-0'>
                    <td className='py-2 pr-3 font-medium'>{r.title}</td>
                    <td className='py-2 pr-3 text-muted-foreground'>{ORIGIN_LABEL[r.origin]}</td>
                    <td className='py-2 pr-3'>{getStatusLabel(r.status)}</td>
                    <td className='py-2 pr-3 text-muted-foreground'>
                      {r.dueDate ? new Date(r.dueDate).toLocaleDateString('es-ES') : '—'}
                    </td>
                    <td className='py-2 pr-3 text-muted-foreground'>
                      {r.assigneeName ?? 'Sin asignar'}
                    </td>
                    <td className='py-2 pr-3 text-muted-foreground'>
                      {r.familyName ?? 'Sin área'}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && !loading && (
                  <tr>
                    <td colSpan={6} className='py-6 text-center text-muted-foreground'>
                      No hay tareas para estos filtros.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {totalPages > 1 && (
              <div className='mt-3 flex items-center justify-between text-xs text-muted-foreground'>
                <span>
                  Página {page} de {totalPages}
                </span>
                <div className='flex gap-2'>
                  <Button
                    size='sm'
                    variant='outline'
                    disabled={page <= 1}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                  >
                    Anterior
                  </Button>
                  <Button
                    size='sm'
                    variant='outline'
                    disabled={page >= totalPages}
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ModuleLayout>
  )
}

function SummaryCard({
  label,
  value,
  destructive,
}: {
  label: string
  value: number
  destructive?: boolean
}) {
  return (
    <Card>
      <CardContent className='p-3'>
        <p className='text-xs text-muted-foreground'>{label}</p>
        <p
          className={`text-xl font-semibold ${destructive && value > 0 ? 'text-destructive' : ''}`}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  )
}

function BreakdownCard({
  title,
  items,
}: {
  title: string
  items: { label: string; count: number }[]
}) {
  const max = Math.max(1, ...items.map(i => i.count))
  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-base'>{title}</CardTitle>
      </CardHeader>
      <CardContent className='space-y-2'>
        {items.slice(0, 10).map(item => (
          <div key={item.label} className='space-y-1'>
            <div className='flex items-center justify-between text-xs'>
              <span className='truncate'>{item.label}</span>
              <span className='text-muted-foreground'>{item.count}</span>
            </div>
            <div className='h-1.5 w-full rounded-full bg-muted'>
              <div
                className='h-1.5 rounded-full bg-primary'
                style={{ width: `${(item.count / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
