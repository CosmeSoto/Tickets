'use client'

/**
 * SLA Tab Component
 * Shows SLA compliance metrics by family and priority
 */

import { ShieldCheck } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { SLAComplianceRow } from '../utils/report-types'
import { priorityLabel, priorityColor, slaColor } from '../utils/report-formatters'
import { TabLoadingState, TabEmptyState } from './shared-tab-states'

interface SLATabProps {
  data: SLAComplianceRow[]
  loading: boolean
}

export function SLATab({ data, loading }: SLATabProps) {
  if (loading) return <TabLoadingState />
  if (data.length === 0)
    return (
      <TabEmptyState message='No hay datos de cumplimiento de SLA para los filtros seleccionados.' />
    )

  // Group by family
  const byFamily = data.reduce<Record<string, SLAComplianceRow[]>>((acc, row) => {
    if (!acc[row.familyId]) acc[row.familyId] = []
    acc[row.familyId].push(row)
    return acc
  }, {})

  const priorities = ['URGENT', 'HIGH', 'MEDIUM', 'LOW']

  return (
    <div className='space-y-4'>
      {Object.entries(byFamily).map(([familyId, rows]) => {
        const familyName = rows[0]?.familyName ?? familyId
        const totalAll = rows.reduce((s, r) => s + r.total, 0)
        const compliantAll = rows.reduce((s, r) => s + r.compliant, 0)
        const overallRate = totalAll > 0 ? Math.round((compliantAll / totalAll) * 1000) / 10 : 0

        return (
          <Card key={familyId}>
            <CardHeader className='pb-3'>
              <div className='flex items-center justify-between'>
                <CardTitle className='text-base flex items-center gap-2'>
                  <ShieldCheck className='h-4 w-4' />
                  {familyName}
                </CardTitle>
                <div className='flex items-center gap-2'>
                  <span className='text-sm text-muted-foreground'>Tasa global:</span>
                  <span className={`font-bold text-lg ${slaColor(overallRate)}`}>
                    {overallRate}%
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className='overflow-x-auto'>
                <table className='w-full text-sm'>
                  <thead>
                    <tr className='border-b bg-muted/50'>
                      <th className='text-left p-3 font-medium'>Prioridad</th>
                      <th className='text-right p-3 font-medium'>Total</th>
                      <th className='text-right p-3 font-medium'>Cumplidos</th>
                      <th className='text-right p-3 font-medium'>Incumplidos</th>
                      <th className='text-right p-3 font-medium'>Tasa SLA</th>
                      <th className='p-3 font-medium'>Barra</th>
                    </tr>
                  </thead>
                  <tbody>
                    {priorities.map(priority => {
                      const row = rows.find(r => r.priority === priority)
                      if (!row) return null
                      return (
                        <tr key={priority} className='border-b hover:bg-muted/30 transition-colors'>
                          <td className='p-3'>
                            <Badge className={priorityColor(priority)}>
                              {priorityLabel(priority)}
                            </Badge>
                          </td>
                          <td className='p-3 text-right'>{row.total}</td>
                          <td className='p-3 text-right text-emerald-600 dark:text-emerald-400 font-medium'>
                            {row.compliant}
                          </td>
                          <td className='p-3 text-right text-red-600 dark:text-red-400 font-medium'>
                            {row.breached}
                          </td>
                          <td className='p-3 text-right'>
                            <span className={`font-semibold ${slaColor(row.complianceRate)}`}>
                              {row.complianceRate}%
                            </span>
                          </td>
                          <td className='p-3 min-w-[120px]'>
                            <div className='h-2 bg-muted rounded-full overflow-hidden'>
                              <div
                                className={`h-full rounded-full transition-all ${
                                  row.complianceRate >= 90
                                    ? 'bg-emerald-500'
                                    : row.complianceRate >= 70
                                      ? 'bg-amber-500'
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
