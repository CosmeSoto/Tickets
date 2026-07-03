'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { AlertTriangle, Layers, TrendingUp, Package, RefreshCw } from 'lucide-react'
import type { BatchUtilizationOverview } from '@/types/inventory/batch-inventory'

export function BatchUtilizationDashboard() {
  const [data, setData] = useState<BatchUtilizationOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/inventory/batches/utilization-overview')
      if (!res.ok) throw new Error('Error al cargar datos')
      setData(await res.json())
    } catch (err) {
      setData(null)
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (loading) {
    return (
      <div className='space-y-4'>
        <div className='grid grid-cols-2 sm:grid-cols-4 gap-3'>
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className='h-20 rounded-lg' />
          ))}
        </div>
        <Skeleton className='h-48 rounded-lg' />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className='rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive flex items-center justify-between gap-3'>
        <span>{error ?? 'Sin datos'}</span>
        <Button variant='outline' size='sm' onClick={load}>
          Reintentar
        </Button>
      </div>
    )
  }

  const { summary, criticalBatches, byModel } = data

  if (summary.totalBatches === 0) return null

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between gap-2'>
        <h3 className='text-sm font-semibold flex items-center gap-2'>
          <TrendingUp className='h-4 w-4 text-primary' />
          Utilización de lotes
        </h3>
        <Button variant='ghost' size='sm' onClick={load} className='h-8 gap-1.5 text-xs'>
          <RefreshCw className='h-3.5 w-3.5' />
          Actualizar
        </Button>
      </div>

      <div className='grid grid-cols-2 sm:grid-cols-4 gap-3'>
        <Card>
          <CardContent className='p-3 text-center'>
            <p className='text-2xl font-bold'>{summary.totalBatches}</p>
            <p className='text-xs text-muted-foreground'>Lotes activos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className='p-3 text-center'>
            <p className='text-2xl font-bold'>{summary.avgUtilization.toFixed(0)}%</p>
            <p className='text-xs text-muted-foreground'>Utilización promedio</p>
          </CardContent>
        </Card>
        <Card className={summary.criticalCount > 0 ? 'border-red-300 dark:border-red-800' : ''}>
          <CardContent className='p-3 text-center'>
            <p className={`text-2xl font-bold ${summary.criticalCount > 0 ? 'text-red-600' : ''}`}>
              {summary.criticalCount}
            </p>
            <p className='text-xs text-muted-foreground'>Alertas críticas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className='p-3 text-center'>
            <p className='text-2xl font-bold text-green-600'>{summary.totalAvailable}</p>
            <p className='text-xs text-muted-foreground'>Disponibles (total)</p>
          </CardContent>
        </Card>
      </div>

      {criticalBatches.length > 0 && (
        <Card className='border-amber-200 dark:border-amber-800'>
          <CardHeader className='pb-2 pt-4'>
            <CardTitle className='text-sm flex items-center gap-2'>
              <AlertTriangle className='h-4 w-4 text-amber-600' />
              Lotes que requieren atención
            </CardTitle>
          </CardHeader>
          <CardContent className='space-y-2 pb-4'>
            {criticalBatches.map(b => (
              <Link
                key={b.id}
                href={`/inventory/batches/${b.id}`}
                className='flex items-center justify-between gap-3 rounded-md border p-3 hover:bg-muted/50 transition-colors'
              >
                <div className='min-w-0'>
                  <div className='flex items-center gap-2 flex-wrap'>
                    <span className='font-mono font-semibold text-sm'>{b.batchCode}</span>
                    <Badge variant={b.alertLevel === 'critical' ? 'destructive' : 'secondary'}>
                      {b.topAlert}
                    </Badge>
                  </div>
                  <p className='text-xs text-muted-foreground truncate mt-0.5'>
                    {b.brandModel}
                    {b.typeName ? ` · ${b.typeName}` : ''}
                  </p>
                </div>
                <div className='text-right shrink-0 text-xs'>
                  <p className='font-semibold'>{b.metrics.utilizationRate.toFixed(0)}% uso</p>
                  <p className='text-muted-foreground'>{b.metrics.available} disp.</p>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {byModel.length > 0 && (
        <Card>
          <CardHeader className='pb-2 pt-4'>
            <CardTitle className='text-sm flex items-center gap-2'>
              <Layers className='h-4 w-4' />
              Utilización por modelo
            </CardTitle>
          </CardHeader>
          <CardContent className='space-y-4 pb-4'>
            {byModel.map(row => (
              <div key={row.modelId} className='space-y-1.5'>
                <div className='flex items-center justify-between gap-2 text-sm'>
                  <div className='min-w-0 truncate'>
                    <span className='font-medium'>
                      {row.brand} {row.model}
                    </span>
                    {row.typeName && (
                      <span className='text-muted-foreground text-xs ml-1.5'>{row.typeName}</span>
                    )}
                  </div>
                  <div className='flex items-center gap-2 shrink-0 text-xs text-muted-foreground'>
                    <span>
                      {row.batchCount} lote{row.batchCount !== 1 ? 's' : ''}
                    </span>
                    <span className='font-semibold text-foreground'>
                      {row.utilizationRate.toFixed(0)}%
                    </span>
                  </div>
                </div>
                <Progress
                  value={Math.min(row.utilizationRate, 100)}
                  className={`h-2 ${row.utilizationRate >= 90 ? '[&>div]:bg-red-500' : row.utilizationRate >= 70 ? '[&>div]:bg-amber-500' : ''}`}
                />
                <p className='text-xs text-muted-foreground'>
                  {row.available} disponibles · {row.assigned} asignados · {row.totalUnits} total
                </p>
              </div>
            ))}
            <Button variant='link' size='sm' asChild className='px-0 h-auto'>
              <Link href='/inventory/models'>
                <Package className='h-3.5 w-3.5 mr-1' />
                Ver catálogo de modelos
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
