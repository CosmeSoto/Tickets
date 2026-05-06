'use client'

import { useState } from 'react'
import { Users, Search, Star } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import type { TechnicianPerformance } from '../utils/report-types'
import { formatMinutes } from '../utils/report-formatters'
import { TabLoadingState, TabEmptyState } from './shared-tab-states'

interface TechniciansTabProps {
  data: TechnicianPerformance[]
  loading: boolean
}

function EfficiencyBar({ value }: { value: number }) {
  const color = value >= 80 ? 'bg-emerald-500' : value >= 50 ? 'bg-amber-500' : 'bg-destructive'
  return (
    <div className='flex items-center gap-2'>
      <div className='flex-1 h-1.5 bg-muted rounded-full overflow-hidden min-w-[60px]'>
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span
        className={`text-xs font-medium w-9 text-right ${
          value >= 80
            ? 'text-emerald-600 dark:text-emerald-400'
            : value >= 50
              ? 'text-amber-600 dark:text-amber-400'
              : 'text-destructive'
        }`}
      >
        {value}%
      </span>
    </div>
  )
}

export function TechniciansTab({ data, loading }: TechniciansTabProps) {
  const [search, setSearch] = useState('')

  if (loading) return <TabLoadingState />
  if (data.length === 0)
    return <TabEmptyState message='No hay datos de técnicos para los filtros seleccionados.' />

  const filtered = data.filter(
    t =>
      t.technicianName?.toLowerCase().includes(search.toLowerCase()) ||
      t.technicianEmail?.toLowerCase().includes(search.toLowerCase())
  )

  const totalAssigned = data.reduce((s, t) => s + t.assignedTickets, 0)
  const totalResolved = data.reduce((s, t) => s + t.resolvedTickets, 0)
  const withRating = data.filter(t => t.avgRating !== null)
  const avgRating =
    withRating.length > 0
      ? Math.round((withRating.reduce((s, t) => s + t.avgRating!, 0) / withRating.length) * 10) / 10
      : null
  const globalEfficiency = totalAssigned > 0 ? Math.round((totalResolved / totalAssigned) * 100) : 0

  return (
    <div className='space-y-4'>
      {/* KPIs */}
      <div className='grid grid-cols-2 sm:grid-cols-4 gap-3'>
        <Card>
          <CardContent className='pt-4 pb-3'>
            <p className='text-xs text-muted-foreground'>Técnicos activos</p>
            <p className='text-2xl font-bold mt-1'>{data.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className='pt-4 pb-3'>
            <p className='text-xs text-muted-foreground'>Tickets asignados</p>
            <p className='text-2xl font-bold mt-1'>{totalAssigned.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className='pt-4 pb-3'>
            <p className='text-xs text-muted-foreground'>Eficiencia global</p>
            <p
              className={`text-2xl font-bold mt-1 ${
                globalEfficiency >= 80
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : globalEfficiency >= 50
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-destructive'
              }`}
            >
              {globalEfficiency}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className='pt-4 pb-3'>
            <p className='text-xs text-muted-foreground'>Calificación promedio</p>
            <p className='text-2xl font-bold mt-1 text-amber-500 dark:text-amber-400'>
              {avgRating !== null ? `★ ${avgRating.toFixed(1)}` : '—'}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3'>
            <div>
              <CardTitle className='flex items-center gap-2 text-base'>
                <Users className='h-4 w-4' />
                Rendimiento por técnico
              </CardTitle>
              <CardDescription>Ordenado por tickets resueltos</CardDescription>
            </div>
            <div className='relative w-full sm:w-64'>
              <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none' />
              <Input
                placeholder='Buscar técnico...'
                value={search}
                onChange={e => setSearch(e.target.value)}
                className='pl-9'
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className='overflow-x-auto rounded-md border border-border'>
            <table className='w-full text-sm'>
              <thead>
                <tr className='border-b bg-muted/50'>
                  <th className='text-left px-4 py-2.5 font-medium text-muted-foreground'>
                    Técnico
                  </th>
                  <th className='text-right px-4 py-2.5 font-medium text-muted-foreground'>
                    Asignados
                  </th>
                  <th className='text-right px-4 py-2.5 font-medium text-muted-foreground'>
                    Resueltos
                  </th>
                  <th className='px-4 py-2.5 font-medium text-muted-foreground hidden md:table-cell'>
                    Eficiencia
                  </th>
                  <th className='text-right px-4 py-2.5 font-medium text-muted-foreground hidden lg:table-cell'>
                    T. promedio
                  </th>
                  <th className='text-right px-4 py-2.5 font-medium text-muted-foreground'>
                    Calificación
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(tech => {
                  const efficiency =
                    tech.assignedTickets > 0
                      ? Math.round((tech.resolvedTickets / tech.assignedTickets) * 100)
                      : 0
                  return (
                    <tr
                      key={tech.technicianId}
                      className='border-b last:border-0 hover:bg-muted/30 transition-colors'
                    >
                      <td className='px-4 py-2.5'>
                        <p className='font-medium text-foreground'>{tech.technicianName}</p>
                        <p className='text-xs text-muted-foreground'>{tech.technicianEmail}</p>
                      </td>
                      <td className='px-4 py-2.5 text-right text-foreground'>
                        {tech.assignedTickets}
                      </td>
                      <td className='px-4 py-2.5 text-right font-medium text-emerald-600 dark:text-emerald-400'>
                        {tech.resolvedTickets}
                      </td>
                      <td className='px-4 py-2.5 hidden md:table-cell'>
                        <EfficiencyBar value={efficiency} />
                      </td>
                      <td className='px-4 py-2.5 text-right text-muted-foreground hidden lg:table-cell'>
                        {formatMinutes(tech.avgResolutionTimeMinutes)}
                      </td>
                      <td className='px-4 py-2.5 text-right'>
                        {tech.avgRating !== null ? (
                          <span className='font-medium text-amber-500 dark:text-amber-400 flex items-center justify-end gap-1'>
                            <Star className='h-3 w-3 fill-current' />
                            {tech.avgRating.toFixed(1)}
                          </span>
                        ) : (
                          <span className='text-muted-foreground'>—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className='px-4 py-8 text-center text-muted-foreground text-sm'>
                      No se encontraron técnicos con ese criterio.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
