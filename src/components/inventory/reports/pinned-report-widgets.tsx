'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Columns2, GripVertical, LayoutGrid, Loader2, Pin } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ALL_FILTER } from '@/lib/inventory/reports/catalog'
import type { InventorySavedReport, ReportResponse } from '@/lib/inventory/reports/types'
import { getDatasetById } from '@/lib/inventory/reports/catalog'
import { cn } from '@/lib/utils'
import { PinnedWidgetMiniChart } from './pinned-widget-mini-chart'

interface PinnedPreview {
  report: InventorySavedReport
  preview: ReportResponse | null
  error?: string
}

const MAX_PINNED = 6

function buildRunParams(saved: InventorySavedReport): URLSearchParams {
  const params = new URLSearchParams()
  if (saved.kind === 'DATASET') {
    params.set('dataset', saved.targetId)
  } else {
    params.set('template', saved.targetId)
  }

  const groupBy = saved.filterValues.groupBy
  const isGrouped = Boolean(groupBy && groupBy !== ALL_FILTER)
  params.set('limit', isGrouped ? '8' : '1')

  if (saved.familyId) params.set('familyId', saved.familyId)
  if (saved.visibleColumns.length) params.set('columns', saved.visibleColumns.join(','))
  Object.entries(saved.filterValues).forEach(([key, value]) => {
    if (value && value !== ALL_FILTER) params.set(key, value)
  })
  return params
}

function reorderItems<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  const next = [...items]
  const [moved] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, moved)
  return next
}

function widgetSpanClass(span: number): string {
  if (span === 3) return 'sm:col-span-2 lg:col-span-3'
  if (span === 2) return 'sm:col-span-2'
  return ''
}

function isGroupedReport(report: InventorySavedReport, preview: ReportResponse | null): boolean {
  if (preview?.meta?.grouped) return true
  const groupBy = report.filterValues.groupBy
  return Boolean(groupBy && groupBy !== ALL_FILTER)
}

export function PinnedReportWidgets() {
  const router = useRouter()
  const [items, setItems] = useState<PinnedPreview[]>([])
  const [loading, setLoading] = useState(true)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)
  const [savingOrder, setSavingOrder] = useState(false)

  const loadPinned = useCallback(async () => {
    setLoading(true)
    try {
      const listRes = await fetch('/api/inventory/reports/saved?pinned=true')
      if (!listRes.ok) {
        setItems([])
        return
      }
      const { savedReports } = await listRes.json()
      const pinned: InventorySavedReport[] = (savedReports ?? []).slice(0, MAX_PINNED)

      const previews = await Promise.all(
        pinned.map(async (report: InventorySavedReport) => {
          try {
            const res = await fetch(`/api/inventory/reports/run?${buildRunParams(report)}`)
            if (!res.ok) {
              const json = await res.json().catch(() => ({}))
              return { report, preview: null, error: json.error ?? 'Error al ejecutar' }
            }
            const preview = await res.json()
            return { report, preview }
          } catch {
            return { report, preview: null, error: 'Error de red' }
          }
        })
      )

      setItems(previews)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPinned()
  }, [loadPinned])

  const persistOrder = async (nextItems: PinnedPreview[]) => {
    setSavingOrder(true)
    try {
      const res = await fetch('/api/inventory/reports/saved/reorder', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: nextItems.map(item => item.report.id) }),
      })
      if (!res.ok) {
        await loadPinned()
      }
    } catch {
      await loadPinned()
    } finally {
      setSavingOrder(false)
    }
  }

  const cycleSpan = async (reportId: string, currentSpan: number) => {
    const nextSpan = currentSpan >= 3 ? 1 : currentSpan + 1
    try {
      const res = await fetch(`/api/inventory/reports/saved/${reportId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinnedSpan: nextSpan }),
      })
      if (res.ok) {
        setItems(prev =>
          prev.map(item =>
            item.report.id === reportId
              ? { ...item, report: { ...item.report, pinnedSpan: nextSpan } }
              : item
          )
        )
      }
    } catch {
      /* ignore */
    }
  }

  const handleDrop = (targetIndex: number) => {
    if (dragIndex === null || dragIndex === targetIndex) {
      setDragIndex(null)
      setOverIndex(null)
      return
    }
    const nextItems = reorderItems(items, dragIndex, targetIndex)
    setItems(nextItems)
    setDragIndex(null)
    setOverIndex(null)
    void persistOrder(nextItems)
  }

  if (loading) {
    return (
      <Card>
        <CardContent className='py-8 flex justify-center'>
          <Loader2 className='h-6 w-6 animate-spin text-muted-foreground' />
        </CardContent>
      </Card>
    )
  }

  if (items.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-base flex items-center gap-2'>
          <LayoutGrid className='h-4 w-4' />
          Panel de reportes anclados
          {savingOrder && (
            <Loader2 className='h-3.5 w-3.5 animate-spin text-muted-foreground' />
          )}
        </CardTitle>
        <CardDescription>
          Arrastra para reordenar · usa el icono de columnas para cambiar el ancho (1–3)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
          {items.map(({ report, preview, error }, index) => {
            const primary = preview?.summary?.[0]
            const datasetLabel = getDatasetById(report.targetId)?.name ?? report.targetId
            const isDragging = dragIndex === index
            const isDropTarget = overIndex === index && dragIndex !== null && dragIndex !== index
            const grouped = isGroupedReport(report, preview)
            const chartRows = grouped ? (preview?.data as Record<string, unknown>[]) : []

            return (
              <div
                key={report.id}
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragEnd={() => {
                  setDragIndex(null)
                  setOverIndex(null)
                }}
                onDragOver={event => {
                  event.preventDefault()
                  setOverIndex(index)
                }}
                onDragLeave={() => {
                  if (overIndex === index) setOverIndex(null)
                }}
                onDrop={event => {
                  event.preventDefault()
                  handleDrop(index)
                }}
                className={cn(
                  'rounded-lg border p-4 transition-all',
                  widgetSpanClass(report.pinnedSpan ?? 1),
                  isDragging && 'opacity-50 scale-[0.98]',
                  isDropTarget && 'ring-2 ring-primary border-primary/50 bg-primary/5'
                )}
              >
                <div className='flex items-start gap-2 mb-2'>
                  <button
                    type='button'
                    aria-label='Arrastrar widget'
                    className='cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground shrink-0 mt-0.5 touch-none'
                    onMouseDown={event => event.stopPropagation()}
                  >
                    <GripVertical className='h-4 w-4' />
                  </button>
                  <button
                    type='button'
                    onClick={() => {
                      if (report.kind === 'DATASET') {
                        router.push(`/inventory/reports/explore?saved=${report.id}`)
                      } else {
                        router.push(`/inventory/reports/${report.targetId}`)
                      }
                    }}
                    className='flex-1 min-w-0 text-left hover:opacity-80 transition-opacity'
                  >
                    <div className='flex items-start justify-between gap-2'>
                      <p className='font-medium text-sm truncate'>{report.name}</p>
                      <Pin className='h-3.5 w-3.5 text-primary shrink-0 mt-0.5' />
                    </div>
                    <p className='text-xs text-muted-foreground truncate mt-1'>{datasetLabel}</p>
                  </button>
                  <Button
                    type='button'
                    variant='ghost'
                    size='icon'
                    className='h-7 w-7 shrink-0'
                    title={`Ancho: ${report.pinnedSpan ?? 1} columna(s)`}
                    onClick={() => cycleSpan(report.id, report.pinnedSpan ?? 1)}
                  >
                    <Columns2 className='h-3.5 w-3.5' />
                  </Button>
                </div>
                {error ? (
                  <p className='text-xs text-destructive pl-6'>{error}</p>
                ) : primary ? (
                  <div className='pl-6'>
                    <p className='text-2xl font-semibold'>{primary.value}</p>
                    <p className='text-xs text-muted-foreground mt-1'>{primary.title}</p>
                    {preview?.totalCount != null && (
                      <p className='text-xs text-muted-foreground mt-1'>
                        {preview.totalCount} {grouped ? 'grupos' : 'registros'}
                      </p>
                    )}
                    {grouped && chartRows.length > 0 && (
                      <PinnedWidgetMiniChart rows={chartRows} />
                    )}
                  </div>
                ) : (
                  <p className='text-xs text-muted-foreground pl-6'>Sin datos</p>
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
