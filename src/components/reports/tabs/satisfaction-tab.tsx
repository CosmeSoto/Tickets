'use client'

import { Star, SmilePlus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { SatisfactionReport } from '../utils/report-types'
import { TabLoadingState, TabEmptyState } from './shared-tab-states'

interface SatisfactionTabProps {
  data: SatisfactionReport | null
  loading: boolean
}

function RatingBar({ count, total, star }: { count: number; total: number; star: number }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  const color = star >= 4 ? 'bg-emerald-500' : star === 3 ? 'bg-amber-500' : 'bg-destructive'
  return (
    <div className='flex items-center gap-3'>
      <span className='text-xs text-amber-500 dark:text-amber-400 w-20 shrink-0 font-medium'>
        {'★'.repeat(star)}
        {'☆'.repeat(5 - star)}
      </span>
      <div className='flex-1 h-2 bg-muted rounded-full overflow-hidden'>
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className='text-xs text-muted-foreground w-20 text-right shrink-0'>
        {count} ({pct}%)
      </span>
    </div>
  )
}

const CAT_LABELS: Record<string, string> = {
  responseTime: 'Tiempo de respuesta',
  technicalSkill: 'Habilidad técnica',
  communication: 'Comunicación',
  problemResolution: 'Resolución del problema',
}

export function SatisfactionTab({ data, loading }: SatisfactionTabProps) {
  if (loading) return <TabLoadingState />
  if (!data || data.totalRatings === 0)
    return (
      <TabEmptyState message='No hay calificaciones registradas para los filtros seleccionados.' />
    )

  const stars = [5, 4, 3, 2, 1]

  return (
    <div className='space-y-4'>
      {/* KPIs */}
      <div className='grid grid-cols-2 sm:grid-cols-4 gap-3'>
        <Card>
          <CardContent className='pt-4 pb-3'>
            <p className='text-xs text-muted-foreground'>Total calificaciones</p>
            <p className='text-2xl font-bold mt-1'>{data.totalRatings}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className='pt-4 pb-3'>
            <p className='text-xs text-muted-foreground'>Promedio general</p>
            <p className='text-2xl font-bold mt-1 text-amber-500 dark:text-amber-400'>
              {data.avgRating !== null ? `★ ${data.avgRating.toFixed(1)}` : '—'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className='pt-4 pb-3'>
            <p className='text-xs text-muted-foreground'>Satisfacción</p>
            <p
              className={`text-2xl font-bold mt-1 ${
                data.satisfactionRate !== null
                  ? data.satisfactionRate >= 80
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : data.satisfactionRate >= 60
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-destructive'
                  : 'text-muted-foreground'
              }`}
            >
              {data.satisfactionRate !== null ? `${data.satisfactionRate}%` : '—'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className='pt-4 pb-3'>
            <p className='text-xs text-muted-foreground'>Calificaciones 4-5★</p>
            <p className='text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400'>
              {((data.distribution[4] ?? 0) + (data.distribution[5] ?? 0)).toLocaleString()}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-2 gap-4'>
        {/* Distribución */}
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2 text-base'>
              <Star className='h-4 w-4' />
              Distribución de calificaciones
            </CardTitle>
          </CardHeader>
          <CardContent className='space-y-3'>
            {stars.map(star => (
              <RatingBar
                key={star}
                star={star}
                count={data.distribution[star] ?? 0}
                total={data.totalRatings}
              />
            ))}
          </CardContent>
        </Card>

        {/* Por categoría */}
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2 text-base'>
              <SmilePlus className='h-4 w-4' />
              Por categoría
            </CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            {Object.entries(CAT_LABELS).map(([key, label]) => {
              const val = data.categoryAverages[key as keyof typeof data.categoryAverages]
              const pct = val !== null ? (val / 5) * 100 : 0
              const color =
                pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-500' : 'bg-destructive'
              return (
                <div key={key} className='space-y-1.5'>
                  <div className='flex justify-between text-sm'>
                    <span className='text-muted-foreground'>{label}</span>
                    <span className='font-medium text-amber-500 dark:text-amber-400'>
                      {val !== null ? `★ ${val.toFixed(1)}` : '—'}
                    </span>
                  </div>
                  <div className='h-1.5 bg-muted rounded-full overflow-hidden'>
                    <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>

      {/* Por familia */}
      {data.byFamily.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Por familia</CardTitle>
            <CardDescription>Comparativa entre familias de soporte</CardDescription>
          </CardHeader>
          <CardContent>
            <div className='overflow-x-auto rounded-md border border-border'>
              <table className='w-full text-sm'>
                <thead>
                  <tr className='border-b bg-muted/50'>
                    <th className='text-left px-4 py-2.5 font-medium text-muted-foreground'>
                      Familia
                    </th>
                    <th className='text-right px-4 py-2.5 font-medium text-muted-foreground'>
                      Calificaciones
                    </th>
                    <th className='text-right px-4 py-2.5 font-medium text-muted-foreground'>
                      Promedio
                    </th>
                    <th className='px-4 py-2.5 font-medium text-muted-foreground'>Satisfacción</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byFamily.map(row => {
                    const color =
                      row.satisfactionRate >= 80
                        ? 'bg-emerald-500'
                        : row.satisfactionRate >= 60
                          ? 'bg-amber-500'
                          : 'bg-destructive'
                    return (
                      <tr
                        key={row.familyId}
                        className='border-b last:border-0 hover:bg-muted/30 transition-colors'
                      >
                        <td className='px-4 py-2.5'>
                          <div className='flex items-center gap-2'>
                            {row.familyColor && (
                              <span
                                className='inline-block h-2.5 w-2.5 rounded-full shrink-0'
                                style={{ backgroundColor: row.familyColor }}
                              />
                            )}
                            <span className='font-medium text-foreground'>{row.familyName}</span>
                            <Badge variant='outline' className='text-xs hidden sm:inline-flex'>
                              {row.familyCode}
                            </Badge>
                          </div>
                        </td>
                        <td className='px-4 py-2.5 text-right text-foreground'>
                          {row.totalRatings}
                        </td>
                        <td className='px-4 py-2.5 text-right font-medium text-amber-500 dark:text-amber-400'>
                          ★ {row.avgRating.toFixed(1)}
                        </td>
                        <td className='px-4 py-2.5'>
                          <div className='flex items-center gap-2'>
                            <div className='flex-1 h-1.5 bg-muted rounded-full overflow-hidden min-w-[80px]'>
                              <div
                                className={`h-full rounded-full ${color}`}
                                style={{ width: `${row.satisfactionRate}%` }}
                              />
                            </div>
                            <span
                              className={`text-xs font-medium w-9 text-right shrink-0 ${
                                row.satisfactionRate >= 80
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : row.satisfactionRate >= 60
                                    ? 'text-amber-600 dark:text-amber-400'
                                    : 'text-destructive'
                              }`}
                            >
                              {row.satisfactionRate}%
                            </span>
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
      )}
    </div>
  )
}
