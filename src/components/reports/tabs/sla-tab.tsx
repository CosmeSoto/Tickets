'use client'

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

function SLABar({ value }: { value: number }) {
  const color = value >= 90 ? 'bg-emerald-500' : value >= 70 ? 'bg-amber-500' : 'bg-destructive'
  return (
    <div className='flex items-center gap-2 min-w-[100px]'>
      <div className='flex-1 h-1.5 bg-muted rounded-full overflow-hidden'>
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className={`text-xs font-medium w-9 text-right shrink-0 ${slaColor(value)}`}>
        {value}%
      </span>
    </div>
  )
}

export function SLATab({ data, loading }: SLATabProps) {
  if (loading) return <TabLoadingState />
  if (data.length === 0)
    return <TabEmptyState message='No hay datos de SLA para los filtros seleccionados.' />

  const byFamily = data.reduce<Record<string, SLAComplianceRow[]>>((acc, row) => {
    if (!acc[row.familyId]) acc[row.familyId] = []
    acc[row.familyId].push(row)
    return acc
  }, {})

  const priorities = ['URGENT', 'HIGH', 'MEDIUM', 'LOW']

  // KPIs globales
  const totalAll = data.reduce((s, r) => s + r.total, 0)
  const compliantAll = data.reduce((s, r) => s + r.compliant, 0)
  const breachedAll = data.reduce((s, r) => s + r.breached, 0)
  const globalRate = totalAll > 0 ? Math.round((compliantAll / totalAll) * 1000) / 10 : 0

  return (
    <div className='space-y-4'>
      {/* KPIs globales */}
      <div className='grid grid-cols-2 sm:grid-cols-4 gap-3'>
        <Card>
          <CardContent className='pt-4 pb-3'>
            <p className='text-xs text-muted-foreground'>Total evaluados</p>
            <p className='text-2xl font-bold mt-1'>{totalAll.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className='pt-4 pb-3'>
            <p className='text-xs text-muted-foreground'>Cumplidos</p>
            <p className='text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400'>
              {compliantAll.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className='pt-4 pb-3'>
            <p className='text-xs text-muted-foreground'>Incumplidos</p>
            <p
              className={`text-2xl font-bold mt-1 ${breachedAll > 0 ? 'text-destructive' : 'text-muted-foreground'}`}
            >
              {breachedAll.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className='pt-4 pb-3'>
            <p className='text-xs text-muted-foreground'>Tasa global</p>
            <p className={`text-2xl font-bold mt-1 ${slaColor(globalRate)}`}>{globalRate}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Por familia */}
      {Object.entries(byFamily).map(([familyId, rows]) => {
        const familyName = rows[0]?.familyName ?? familyId
        const totalFam = rows.reduce((s, r) => s + r.total, 0)
        const compliantFam = rows.reduce((s, r) => s + r.compliant, 0)
        const overallRate = totalFam > 0 ? Math.round((compliantFam / totalFam) * 1000) / 10 : 0

        return (
          <Card key={familyId}>
            <CardHeader className='pb-3'>
              <div className='flex items-center justify-between'>
                <CardTitle className='text-base flex items-center gap-2'>
                  <ShieldCheck className='h-4 w-4' />
                  {familyName}
                </CardTitle>
                <div className='flex items-center gap-2'>
                  <span className='text-xs text-muted-foreground'>{totalFam} tickets</span>
                  <span className={`font-bold text-lg ${slaColor(overallRate)}`}>
                    {overallRate}%
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className='overflow-x-auto rounded-md border border-border'>
                <table className='w-full text-sm'>
                  <thead>
                    <tr className='border-b bg-muted/50'>
                      <th className='text-left px-4 py-2.5 font-medium text-muted-foreground'>
                        Prioridad
                      </th>
                      <th className='text-right px-4 py-2.5 font-medium text-muted-foreground'>
                        Total
                      </th>
                      <th className='text-right px-4 py-2.5 font-medium text-muted-foreground'>
                        Cumplidos
                      </th>
                      <th className='text-right px-4 py-2.5 font-medium text-muted-foreground hidden sm:table-cell'>
                        Incumplidos
                      </th>
                      <th className='px-4 py-2.5 font-medium text-muted-foreground'>Tasa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {priorities.map(priority => {
                      const row = rows.find(r => r.priority === priority)
                      if (!row) return null
                      return (
                        <tr
                          key={priority}
                          className='border-b last:border-0 hover:bg-muted/30 transition-colors'
                        >
                          <td className='px-4 py-2.5'>
                            <Badge className={priorityColor(priority)} variant='outline'>
                              {priorityLabel(priority)}
                            </Badge>
                          </td>
                          <td className='px-4 py-2.5 text-right text-foreground'>{row.total}</td>
                          <td className='px-4 py-2.5 text-right font-medium text-emerald-600 dark:text-emerald-400'>
                            {row.compliant}
                          </td>
                          <td className='px-4 py-2.5 text-right hidden sm:table-cell'>
                            <span
                              className={
                                row.breached > 0
                                  ? 'font-medium text-destructive'
                                  : 'text-muted-foreground'
                              }
                            >
                              {row.breached}
                            </span>
                          </td>
                          <td className='px-4 py-2.5'>
                            <SLABar value={row.complianceRate} />
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
