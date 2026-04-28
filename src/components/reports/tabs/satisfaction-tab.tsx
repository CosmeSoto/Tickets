'use client'

/**
 * Satisfaction Tab Component
 * Shows customer satisfaction metrics and ratings distribution
 */

import { Star, SmilePlus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { SatisfactionReport } from '../utils/report-types'
import { TabLoadingState, TabEmptyState } from './shared-tab-states'

interface SatisfactionTabProps {
  data: SatisfactionReport | null
  loading: boolean
}

export function SatisfactionTab({ data, loading }: SatisfactionTabProps) {
  if (loading) return <TabLoadingState />
  if (!data || data.totalRatings === 0)
    return (
      <TabEmptyState message='No hay calificaciones registradas para los filtros seleccionados.' />
    )

  const stars = [5, 4, 3, 2, 1]
  const catLabels: Record<string, string> = {
    responseTime: 'Tiempo de Respuesta',
    technicalSkill: 'Habilidad Técnica',
    communication: 'Comunicación',
    problemResolution: 'Resolución del Problema',
  }

  return (
    <div className='space-y-4'>
      {/* KPI Cards */}
      <div className='grid grid-cols-2 sm:grid-cols-4 gap-3'>
        <Card>
          <CardContent className='pt-4 pb-3'>
            <p className='text-xs text-muted-foreground'>Total Calificaciones</p>
            <p className='text-2xl font-bold mt-1'>{data.totalRatings}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className='pt-4 pb-3'>
            <p className='text-xs text-muted-foreground'>Promedio General</p>
            <p className='text-2xl font-bold mt-1 text-amber-500 dark:text-amber-400'>
              {data.avgRating !== null ? `★ ${data.avgRating.toFixed(1)}` : '—'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className='pt-4 pb-3'>
            <p className='text-xs text-muted-foreground'>Tasa de Satisfacción</p>
            <p
              className={`text-2xl font-bold mt-1 ${
                data.satisfactionRate !== null
                  ? data.satisfactionRate >= 80
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : data.satisfactionRate >= 60
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-red-600 dark:text-red-400'
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
        {/* Distribución de estrellas */}
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2 text-base'>
              <Star className='h-4 w-4' />
              Distribución de Calificaciones
            </CardTitle>
          </CardHeader>
          <CardContent className='space-y-3'>
            {stars.map(star => {
              const count = data.distribution[star] ?? 0
              const pct = data.totalRatings > 0 ? Math.round((count / data.totalRatings) * 100) : 0
              return (
                <div key={star} className='flex items-center gap-3'>
                  <span className='text-sm font-medium w-20 flex-shrink-0 text-amber-500 dark:text-amber-400'>
                    {'★'.repeat(star)}
                    {'☆'.repeat(5 - star)}
                  </span>
                  <div className='flex-1 h-2 bg-muted rounded-full overflow-hidden'>
                    <div
                      className={`h-full rounded-full ${star >= 4 ? 'bg-emerald-500' : star === 3 ? 'bg-amber-500' : 'bg-red-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className='text-sm text-muted-foreground w-16 text-right flex-shrink-0'>
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
            <CardTitle className='flex items-center gap-2 text-base'>
              <SmilePlus className='h-4 w-4' />
              Calificación por Categoría
            </CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            {Object.entries(catLabels).map(([key, label]) => {
              const val = data.categoryAverages[key as keyof typeof data.categoryAverages]
              const pct = val !== null ? (val / 5) * 100 : 0
              return (
                <div key={key} className='space-y-1'>
                  <div className='flex justify-between text-sm'>
                    <span className='text-muted-foreground'>{label}</span>
                    <span className='font-medium text-amber-500 dark:text-amber-400'>
                      {val !== null ? `★ ${val.toFixed(1)}` : '—'}
                    </span>
                  </div>
                  <div className='h-2 bg-muted rounded-full overflow-hidden'>
                    <div
                      className={`h-full rounded-full ${pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
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
            <CardTitle className='text-base'>Satisfacción por Familia</CardTitle>
            <CardDescription>
              Comparativa de calificaciones entre familias de soporte
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className='overflow-x-auto'>
              <table className='w-full text-sm'>
                <thead>
                  <tr className='border-b bg-muted/50'>
                    <th className='text-left p-3 font-medium'>Familia</th>
                    <th className='text-right p-3 font-medium'>Calificaciones</th>
                    <th className='text-right p-3 font-medium'>Promedio</th>
                    <th className='text-right p-3 font-medium'>Satisfacción</th>
                    <th className='p-3 font-medium'>Barra</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byFamily.map(row => (
                    <tr key={row.familyId} className='border-b hover:bg-muted/30 transition-colors'>
                      <td className='p-3'>
                        <div className='flex items-center gap-2'>
                          {row.familyColor && (
                            <span
                              className='inline-block h-3 w-3 rounded-full flex-shrink-0'
                              style={{ backgroundColor: row.familyColor }}
                            />
                          )}
                          <span className='font-medium'>{row.familyName}</span>
                          <Badge variant='outline' className='text-xs'>
                            {row.familyCode}
                          </Badge>
                        </div>
                      </td>
                      <td className='p-3 text-right'>{row.totalRatings}</td>
                      <td className='p-3 text-right font-medium text-amber-500 dark:text-amber-400'>
                        ★ {row.avgRating.toFixed(1)}
                      </td>
                      <td className='p-3 text-right'>
                        <span
                          className={`font-semibold ${row.satisfactionRate >= 80 ? 'text-emerald-600 dark:text-emerald-400' : row.satisfactionRate >= 60 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}
                        >
                          {row.satisfactionRate}%
                        </span>
                      </td>
                      <td className='p-3 min-w-[120px]'>
                        <div className='h-2 bg-muted rounded-full overflow-hidden'>
                          <div
                            className={`h-full rounded-full ${row.satisfactionRate >= 80 ? 'bg-emerald-500' : row.satisfactionRate >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
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
