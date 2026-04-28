'use client'

/**
 * Executive Summary Tab Component
 * Shows aggregated KPIs and family-level ticket statistics
 */

import { BarChart3 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { FamilyExecutiveSummary } from '../utils/report-types'
import { formatMinutes, slaColor } from '../utils/report-formatters'

interface ExecutiveSummaryTabProps {
  data: FamilyExecutiveSummary[]
  loading: boolean
  isAllFamilies: boolean
}

function TabLoadingState() {
  return (
    <div className='space-y-4'>
      {[...Array(3)].map((_, i) => (
        <div key={i} className='h-32 bg-muted animate-pulse rounded-lg' />
      ))}
    </div>
  )
}

function TabEmptyState({ message }: { message: string }) {
  return (
    <Card>
      <CardContent className='py-12 text-center'>
        <p className='text-muted-foreground'>{message}</p>
      </CardContent>
    </Card>
  )
}

export function ExecutiveSummaryTab({ data, loading, isAllFamilies }: ExecutiveSummaryTabProps) {
  if (loading) return <TabLoadingState />
  if (data.length === 0)
    return (
      <TabEmptyState message='No hay datos de resumen ejecutivo para los filtros seleccionados.' />
    )

  // Aggregate KPIs
  const totalTickets = data.reduce((s, r) => s + r.totalTickets, 0)
  const totalOpen = data.reduce((s, r) => s + r.openTickets, 0)
  const totalResolved = data.reduce((s, r) => s + r.resolvedTickets, 0)
  const avgSLA =
    data.length > 0
      ? Math.round((data.reduce((s, r) => s + r.slaComplianceRate, 0) / data.length) * 10) / 10
      : 0
  const resolutionRate =
    totalTickets > 0 ? Math.round((totalResolved / totalTickets) * 1000) / 10 : 0

  return (
    <div className='space-y-4'>
      {/* KPI Cards */}
      <div className='grid grid-cols-2 sm:grid-cols-4 gap-3'>
        <Card>
          <CardContent className='pt-4 pb-3'>
            <p className='text-xs text-muted-foreground'>Total Tickets</p>
            <p className='text-2xl font-bold mt-1'>{totalTickets.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className='pt-4 pb-3'>
            <p className='text-xs text-muted-foreground'>Abiertos</p>
            <p className='text-2xl font-bold mt-1 text-orange-600 dark:text-orange-400'>
              {totalOpen.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className='pt-4 pb-3'>
            <p className='text-xs text-muted-foreground'>Tasa de Resolución</p>
            <p
              className={`text-2xl font-bold mt-1 ${
                resolutionRate >= 80
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : resolutionRate >= 50
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-red-600 dark:text-red-400'
              }`}
            >
              {resolutionRate}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className='pt-4 pb-3'>
            <p className='text-xs text-muted-foreground'>Cumplimiento SLA</p>
            <p className={`text-2xl font-bold mt-1 ${slaColor(avgSLA)}`}>{avgSLA}%</p>
          </CardContent>
        </Card>
      </div>

      {isAllFamilies && (
        <Card className='bg-muted/30 border-border'>
          <CardContent className='py-3'>
            <p className='text-sm text-muted-foreground font-medium'>
              Vista comparativa — mostrando todas las familias activas
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <BarChart3 className='h-5 w-5' />
            Resumen Ejecutivo por Familia
          </CardTitle>
          <CardDescription>
            Total de tickets, estado y cumplimiento de SLA por familia de soporte
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className='overflow-x-auto'>
            <table className='w-full text-sm'>
              <thead>
                <tr className='border-b bg-muted/50'>
                  <th className='text-left p-3 font-medium'>Familia</th>
                  <th className='text-right p-3 font-medium'>Total</th>
                  <th className='text-right p-3 font-medium'>Abiertos</th>
                  <th className='text-right p-3 font-medium'>En Progreso</th>
                  <th className='text-right p-3 font-medium'>Resueltos</th>
                  <th className='text-right p-3 font-medium'>Cerrados</th>
                  <th className='text-right p-3 font-medium'>Tiempo Prom.</th>
                  <th className='text-right p-3 font-medium'>SLA %</th>
                </tr>
              </thead>
              <tbody>
                {data.map(row => (
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
                    <td className='p-3 text-right font-semibold'>{row.totalTickets}</td>
                    <td className='p-3 text-right'>
                      <span className='text-amber-600 dark:text-amber-400 font-medium'>
                        {row.openTickets}
                      </span>
                    </td>
                    <td className='p-3 text-right'>
                      <span className='text-blue-600 dark:text-blue-400 font-medium'>
                        {row.inProgressTickets}
                      </span>
                    </td>
                    <td className='p-3 text-right'>
                      <span className='text-emerald-600 dark:text-emerald-400 font-medium'>
                        {row.resolvedTickets}
                      </span>
                    </td>
                    <td className='p-3 text-right text-muted-foreground'>{row.closedTickets}</td>
                    <td className='p-3 text-right text-muted-foreground'>
                      {formatMinutes(row.avgResolutionTimeMinutes)}
                    </td>
                    <td className='p-3 text-right'>
                      <span className={`font-semibold ${slaColor(row.slaComplianceRate)}`}>
                        {row.slaComplianceRate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              {data.length > 1 && (
                <tfoot>
                  <tr className='border-t-2 bg-muted/50 font-semibold'>
                    <td className='p-3'>Total</td>
                    <td className='p-3 text-right'>
                      {data.reduce((s, r) => s + r.totalTickets, 0)}
                    </td>
                    <td className='p-3 text-right text-amber-600 dark:text-amber-400'>
                      {data.reduce((s, r) => s + r.openTickets, 0)}
                    </td>
                    <td className='p-3 text-right text-blue-600 dark:text-blue-400'>
                      {data.reduce((s, r) => s + r.inProgressTickets, 0)}
                    </td>
                    <td className='p-3 text-right text-emerald-600 dark:text-emerald-400'>
                      {data.reduce((s, r) => s + r.resolvedTickets, 0)}
                    </td>
                    <td className='p-3 text-right text-muted-foreground'>
                      {data.reduce((s, r) => s + r.closedTickets, 0)}
                    </td>
                    <td className='p-3 text-right text-muted-foreground'>—</td>
                    <td className='p-3 text-right'>
                      <span className={`font-semibold ${slaColor(avgSLA)}`}>{avgSLA}%</span>
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
