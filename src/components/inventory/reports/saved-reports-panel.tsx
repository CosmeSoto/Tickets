'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bookmark, CalendarClock, Loader2, Pin, PinOff, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { InventorySavedReport } from '@/lib/inventory/reports/types'
import { getDatasetById, getTemplateBySlug } from '@/lib/inventory/reports/catalog'

export function SavedReportsPanel({
  onScheduleReport,
}: {
  onScheduleReport?: (reportId: string) => void
}) {
  const router = useRouter()
  const [savedReports, setSavedReports] = useState<InventorySavedReport[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const loadSavedReports = useCallback(async () => {
    try {
      const res = await fetch('/api/inventory/reports/saved')
      if (!res.ok) return
      const data = await res.json()
      setSavedReports(data.savedReports ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSavedReports()
  }, [loadSavedReports])

  const handleOpen = (report: InventorySavedReport) => {
    if (report.kind === 'DATASET') {
      router.push(`/inventory/reports/explore?saved=${report.id}`)
      return
    }
    const params = new URLSearchParams()
    if (report.familyId) params.set('familyId', report.familyId)
    Object.entries(report.filterValues).forEach(([key, value]) => {
      if (value) params.set(key, value)
    })
    const query = params.toString()
    router.push(`/inventory/reports/${report.targetId}${query ? `?${query}` : ''}`)
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/inventory/reports/saved/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setSavedReports(prev => prev.filter(r => r.id !== id))
      }
    } finally {
      setDeletingId(null)
    }
  }

  const handleTogglePin = async (report: InventorySavedReport) => {
    const res = await fetch(`/api/inventory/reports/saved/${report.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pinned: !report.pinned }),
    })
    if (!res.ok) return
    const updated: InventorySavedReport = await res.json()
    setSavedReports(prev => prev.map(r => (r.id === updated.id ? updated : r)))
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

  if (savedReports.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-base flex items-center gap-2'>
          <Bookmark className='h-4 w-4' />
          Mis reportes guardados
        </CardTitle>
        <CardDescription>
          Consultas personalizadas con filtros y columnas que guardaste desde el explorador
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
          {savedReports.map(report => {
            const label =
              report.kind === 'DATASET'
                ? getDatasetById(report.targetId)?.name ?? report.targetId
                : getTemplateBySlug(report.targetId)?.name ?? report.targetId

            return (
              <div
                key={report.id}
                className='rounded-lg border p-3 flex flex-col gap-2 hover:bg-muted/30 transition-colors'
              >
                <div className='flex items-start justify-between gap-2'>
                  <button
                    type='button'
                    className='text-left flex-1 min-w-0'
                    onClick={() => handleOpen(report)}
                  >
                    <p className='font-medium truncate'>{report.name}</p>
                    <p className='text-xs text-muted-foreground truncate'>{label}</p>
                  </button>
                  <Button
                    variant='ghost'
                    size='icon'
                    className='h-8 w-8 shrink-0 text-muted-foreground'
                    onClick={() => handleTogglePin(report)}
                    title={report.pinned ? 'Desanclar del panel' : 'Anclar al panel'}
                  >
                    {report.pinned ? (
                      <PinOff className='h-4 w-4 text-primary' />
                    ) : (
                      <Pin className='h-4 w-4' />
                    )}
                  </Button>
                  {onScheduleReport && (
                    <Button
                      variant='ghost'
                      size='icon'
                      className='h-8 w-8 shrink-0 text-muted-foreground'
                      onClick={() => onScheduleReport(report.id)}
                      title='Programar envío por email'
                    >
                      <CalendarClock className='h-4 w-4' />
                    </Button>
                  )}
                  <Button
                    variant='ghost'
                    size='icon'
                    className='h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive'
                    disabled={deletingId === report.id}
                    onClick={() => handleDelete(report.id)}
                  >
                    {deletingId === report.id ? (
                      <Loader2 className='h-4 w-4 animate-spin' />
                    ) : (
                      <Trash2 className='h-4 w-4' />
                    )}
                  </Button>
                </div>
                <div className='flex flex-wrap gap-1.5'>
                  <Badge variant='secondary' className='text-xs'>
                    {report.kind === 'DATASET' ? 'Explorador' : 'Plantilla'}
                  </Badge>
                  {report.pinned && (
                    <Badge variant='default' className='text-xs gap-1'>
                      <Pin className='h-3 w-3' />
                      Anclado
                    </Badge>
                  )}
                  {report.family?.name && (
                    <Badge variant='outline' className='text-xs'>
                      {report.family.name}
                    </Badge>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
