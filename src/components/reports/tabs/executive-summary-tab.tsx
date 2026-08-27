'use client'

import { useState } from 'react'
import { BarChart3, TrendingUp, Clock, ShieldCheck } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TableColumnsMenu, type TableColumnDef } from '@/components/common/table-columns-menu'
import type { FamilyExecutiveSummary } from '../utils/report-types'
import { formatMinutes, slaColor } from '../utils/report-formatters'
import { TabLoadingState, TabEmptyState } from './shared-tab-states'

const COLUMN_DEFS: TableColumnDef[] = [
  { key: 'family', label: 'Familia', required: true },
  { key: 'total', label: 'Total', required: true },
  { key: 'open', label: 'Abiertos' },
  { key: 'inProgress', label: 'En progreso' },
  { key: 'completed', label: 'Completados' },
  { key: 'avgTime', label: 'T. promedio' },
  { key: 'sla', label: 'SLA' },
]
const DEFAULT_VISIBLE = COLUMN_DEFS.map(c => c.key)

interface ExecutiveSummaryTabProps {
  data: FamilyExecutiveSummary[]
  loading: boolean
  isAllFamilies: boolean
  /** Clic en una fila → salta a "Detalle" filtrado por esa familia. */
  onFamilyClick?: (familyId: string) => void
}

function KPICard({
  label,
  sublabel,
  value,
  colorClass = 'text-foreground',
  icon: Icon,
}: {
  label: string
  sublabel?: string
  value: string | number
  colorClass?: string
  icon?: React.ElementType
}) {
  return (
    <Card>
      <CardContent className='pt-4 pb-3'>
        <div className='flex items-start justify-between'>
          <div>
            <p className='text-xs text-muted-foreground'>{label}</p>
            {sublabel && <p className='text-[10px] text-muted-foreground/60 mt-0.5'>{sublabel}</p>}
          </div>
          {Icon && <Icon className='h-4 w-4 text-muted-foreground/40' />}
        </div>
        <p className={`text-2xl font-bold mt-1 ${colorClass}`}>{value}</p>
      </CardContent>
    </Card>
  )
}

export function ExecutiveSummaryTab({
  data,
  loading,
  isAllFamilies,
  onFamilyClick,
}: ExecutiveSummaryTabProps) {
  const [columnOrder, setColumnOrder] = useState<string[]>(COLUMN_DEFS.map(c => c.key))
  const [visibleColumns, setVisibleColumns] = useState<string[]>(DEFAULT_VISIBLE)

  if (loading) return <TabLoadingState />
  if (data.length === 0)
    return <TabEmptyState message='No hay datos para los filtros seleccionados.' />

  const totalTickets = data.reduce((s, r) => s + r.totalTickets, 0)
  const totalOpen = data.reduce((s, r) => s + r.openTickets, 0)
  const totalInProgress = data.reduce((s, r) => s + r.inProgressTickets, 0)
  const totalResolved = data.reduce((s, r) => s + r.resolvedTickets, 0) // estado RESOLVED (pendiente calificación)
  const totalClosed = data.reduce((s, r) => s + r.closedTickets, 0) // estado CLOSED (ciclo completo)
  const totalCompleted = totalResolved + totalClosed // todos los finalizados

  const avgSLA =
    data.length > 0
      ? Math.round((data.reduce((s, r) => s + r.slaComplianceRate, 0) / data.length) * 10) / 10
      : 0

  const resolutionRate =
    totalTickets > 0 ? Math.round((totalCompleted / totalTickets) * 1000) / 10 : 0

  const avgResolution = (() => {
    const withTime = data.filter(r => r.avgResolutionTimeMinutes !== null)
    if (withTime.length === 0) return null
    const totalMin = withTime.reduce(
      (s, r) => s + (r.avgResolutionTimeMinutes ?? 0) * r.totalTickets,
      0
    )
    const totalW = withTime.reduce((s, r) => s + r.totalTickets, 0)
    return totalW > 0 ? Math.round(totalMin / totalW) : null
  })()

  return (
    <div className='space-y-4'>
      {/* Fila 1 — métricas principales */}
      <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3'>
        <KPICard label='Total tickets' value={totalTickets.toLocaleString()} icon={BarChart3} />
        <KPICard
          label='Pendientes'
          sublabel='Abiertos + en progreso'
          value={(totalOpen + totalInProgress).toLocaleString()}
          colorClass={
            totalOpen + totalInProgress > 0
              ? 'text-amber-600 dark:text-amber-400'
              : 'text-foreground'
          }
          icon={TrendingUp}
        />
        <KPICard
          label='Completados'
          sublabel='Resueltos + cerrados'
          value={totalCompleted.toLocaleString()}
          colorClass='text-emerald-600 dark:text-emerald-400'
        />
        <KPICard
          label='Tasa de resolución'
          value={`${resolutionRate}%`}
          colorClass={
            resolutionRate >= 80
              ? 'text-emerald-600 dark:text-emerald-400'
              : resolutionRate >= 50
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-destructive'
          }
        />
      </div>

      {/* Fila 2 — métricas secundarias */}
      <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3'>
        <KPICard
          label='Abiertos'
          sublabel='Sin atender'
          value={totalOpen.toLocaleString()}
          colorClass={
            totalOpen > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'
          }
        />
        <KPICard
          label='En progreso'
          sublabel='Siendo atendidos'
          value={totalInProgress.toLocaleString()}
          colorClass={totalInProgress > 0 ? 'text-primary' : 'text-muted-foreground'}
        />
        <KPICard
          label='Cumplimiento SLA'
          value={`${avgSLA}%`}
          colorClass={slaColor(avgSLA)}
          icon={ShieldCheck}
        />
        <KPICard
          label='Tiempo promedio'
          sublabel='De resolución'
          value={avgResolution !== null ? formatMinutes(avgResolution) : '—'}
          icon={Clock}
        />
      </div>

      {/* Tabla por familia */}
      <Card>
        <CardHeader>
          <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3'>
            <div>
              <CardTitle className='flex items-center gap-2 text-base'>
                <BarChart3 className='h-4 w-4' />
                Desglose por familia
              </CardTitle>
              {isAllFamilies && (
                <CardDescription>Comparativa de todas las familias activas</CardDescription>
              )}
            </div>
            <TableColumnsMenu
              columns={COLUMN_DEFS}
              order={columnOrder}
              visible={visibleColumns}
              onOrderChange={setColumnOrder}
              onVisibleChange={setVisibleColumns}
              storageKey='reports-summary-columns-v1'
              defaultVisible={DEFAULT_VISIBLE}
              className='sm:ml-auto'
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className='overflow-x-auto rounded-md border border-border'>
            <table className='w-full text-sm'>
              <thead>
                <tr className='border-b bg-muted/50'>
                  {columnOrder
                    .filter(k => visibleColumns.includes(k))
                    .map(key => {
                      switch (key) {
                        case 'family':
                          return (
                            <th
                              key={key}
                              className='text-left px-4 py-2.5 font-medium text-muted-foreground'
                            >
                              Familia
                            </th>
                          )
                        case 'total':
                          return (
                            <th
                              key={key}
                              className='text-right px-4 py-2.5 font-medium text-muted-foreground'
                            >
                              Total
                            </th>
                          )
                        case 'open':
                          return (
                            <th
                              key={key}
                              className='text-right px-4 py-2.5 font-medium text-muted-foreground'
                            >
                              Abiertos
                            </th>
                          )
                        case 'inProgress':
                          return (
                            <th
                              key={key}
                              className='text-right px-4 py-2.5 font-medium text-muted-foreground'
                            >
                              En progreso
                            </th>
                          )
                        case 'completed':
                          return (
                            <th
                              key={key}
                              className='text-right px-4 py-2.5 font-medium text-muted-foreground'
                            >
                              Completados
                              <span className='block text-[10px] font-normal opacity-60'>
                                resueltos + cerrados
                              </span>
                            </th>
                          )
                        case 'avgTime':
                          return (
                            <th
                              key={key}
                              className='text-right px-4 py-2.5 font-medium text-muted-foreground'
                            >
                              T. promedio
                            </th>
                          )
                        case 'sla':
                          return (
                            <th
                              key={key}
                              className='text-right px-4 py-2.5 font-medium text-muted-foreground'
                            >
                              SLA
                            </th>
                          )
                        default:
                          return null
                      }
                    })}
                </tr>
              </thead>
              <tbody>
                {data.map(row => {
                  const completed = row.resolvedTickets + row.closedTickets
                  return (
                    <tr
                      key={row.familyId}
                      className={`border-b last:border-0 hover:bg-muted/30 transition-colors ${
                        onFamilyClick ? 'cursor-pointer' : ''
                      }`}
                      onClick={() => onFamilyClick?.(row.familyId)}
                      title={onFamilyClick ? 'Ver tickets de esta familia en Detalle' : undefined}
                    >
                      {columnOrder
                        .filter(k => visibleColumns.includes(k))
                        .map(key => {
                          switch (key) {
                            case 'family':
                              return (
                                <td key={key} className='px-4 py-2.5'>
                                  <div className='flex items-center gap-2'>
                                    {row.familyColor && (
                                      <span
                                        className='inline-block h-2.5 w-2.5 rounded-full shrink-0'
                                        style={{ backgroundColor: row.familyColor }}
                                      />
                                    )}
                                    <span className='font-medium text-foreground'>
                                      {row.familyName}
                                    </span>
                                    <Badge
                                      variant='outline'
                                      className='text-xs hidden sm:inline-flex'
                                    >
                                      {row.familyCode}
                                    </Badge>
                                  </div>
                                </td>
                              )
                            case 'total':
                              return (
                                <td
                                  key={key}
                                  className='px-4 py-2.5 text-right font-semibold text-foreground'
                                >
                                  {row.totalTickets}
                                </td>
                              )
                            case 'open':
                              return (
                                <td key={key} className='px-4 py-2.5 text-right'>
                                  <span
                                    className={
                                      row.openTickets > 0
                                        ? 'text-amber-600 dark:text-amber-400 font-medium'
                                        : 'text-muted-foreground'
                                    }
                                  >
                                    {row.openTickets}
                                  </span>
                                </td>
                              )
                            case 'inProgress':
                              return (
                                <td key={key} className='px-4 py-2.5 text-right'>
                                  <span
                                    className={
                                      row.inProgressTickets > 0
                                        ? 'text-primary font-medium'
                                        : 'text-muted-foreground'
                                    }
                                  >
                                    {row.inProgressTickets}
                                  </span>
                                </td>
                              )
                            case 'completed':
                              return (
                                <td key={key} className='px-4 py-2.5 text-right'>
                                  <span className='text-emerald-600 dark:text-emerald-400 font-medium'>
                                    {completed}
                                  </span>
                                </td>
                              )
                            case 'avgTime':
                              return (
                                <td
                                  key={key}
                                  className='px-4 py-2.5 text-right text-muted-foreground'
                                >
                                  {formatMinutes(row.avgResolutionTimeMinutes)}
                                </td>
                              )
                            case 'sla':
                              return (
                                <td key={key} className='px-4 py-2.5 text-right'>
                                  <span
                                    className={`font-semibold ${slaColor(row.slaComplianceRate)}`}
                                  >
                                    {row.slaComplianceRate}%
                                  </span>
                                </td>
                              )
                            default:
                              return null
                          }
                        })}
                    </tr>
                  )
                })}
              </tbody>
              {data.length > 1 && (
                <tfoot>
                  <tr className='border-t-2 bg-muted/50 font-semibold'>
                    {columnOrder
                      .filter(k => visibleColumns.includes(k))
                      .map(key => {
                        switch (key) {
                          case 'family':
                            return (
                              <td key={key} className='px-4 py-2.5 text-foreground'>
                                Total
                              </td>
                            )
                          case 'total':
                            return (
                              <td key={key} className='px-4 py-2.5 text-right text-foreground'>
                                {totalTickets}
                              </td>
                            )
                          case 'open':
                            return (
                              <td
                                key={key}
                                className='px-4 py-2.5 text-right text-amber-600 dark:text-amber-400'
                              >
                                {totalOpen}
                              </td>
                            )
                          case 'inProgress':
                            return (
                              <td key={key} className='px-4 py-2.5 text-right text-primary'>
                                {totalInProgress}
                              </td>
                            )
                          case 'completed':
                            return (
                              <td
                                key={key}
                                className='px-4 py-2.5 text-right text-emerald-600 dark:text-emerald-400'
                              >
                                {totalCompleted}
                              </td>
                            )
                          case 'avgTime':
                            return (
                              <td
                                key={key}
                                className='px-4 py-2.5 text-right text-muted-foreground'
                              >
                                {avgResolution !== null ? formatMinutes(avgResolution) : '—'}
                              </td>
                            )
                          case 'sla':
                            return (
                              <td key={key} className='px-4 py-2.5 text-right'>
                                <span className={`font-semibold ${slaColor(avgSLA)}`}>
                                  {avgSLA}%
                                </span>
                              </td>
                            )
                          default:
                            return null
                        }
                      })}
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
