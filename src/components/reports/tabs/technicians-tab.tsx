'use client'

/**
 * Technicians Tab Component
 * Shows technician performance metrics
 */

import { useState } from 'react'
import { Users } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import type { TechnicianPerformance } from '../utils/report-types'
import { formatMinutes } from '../utils/report-formatters'

interface TechniciansTabProps {
  data: TechnicianPerformance[]
  loading: boolean
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

export function TechniciansTab({ data, loading }: TechniciansTabProps) {
  const [search, setSearch] = useState('')

  const filtered = data.filter(
    t =>
      t.technicianName?.toLowerCase().includes(search.toLowerCase()) ||
      t.technicianEmail?.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return <TabLoadingState />
  if (data.length === 0)
    return (
      <TabEmptyState message='No hay datos de rendimiento de técnicos para los filtros seleccionados.' />
    )

  const totalAssigned = data.reduce((s, t) => s + t.assignedTickets, 0)
  const totalResolved = data.reduce((s, t) => s + t.resolvedTickets, 0)
  const withRating = data.filter(t => t.avgRating !== null)
  const avgRating =
    withRating.length > 0
      ? Math.round((withRating.reduce((s, t) => s + t.avgRating!, 0) / withRating.length) * 10) / 10
      : null

  return (
    <div className='space-y-4'>
      {/* KPI Cards */}
      <div className='grid grid-cols-2 sm:grid-cols-4 gap-3'>
        <Card>
          <CardContent className='pt-4 pb-3'>
            <p className='text-xs text-muted-foreground'>Técnicos Activos</p>
            <p className='text-2xl font-bold mt-1'>{data.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className='pt-4 pb-3'>
            <p className='text-xs text-muted-foreground'>Tickets Asignados</p>
            <p className='text-2xl font-bold mt-1'>{totalAssigned.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className='pt-4 pb-3'>
            <p className='text-xs text-muted-foreground'>Tickets Resueltos</p>
            <p className='text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400'>
              {totalResolved.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className='pt-4 pb-3'>
            <p className='text-xs text-muted-foreground'>Calificación Promedio</p>
            <p className='text-2xl font-bold mt-1 text-amber-600 dark:text-amber-400'>
              {avgRating !== null ? `★ ${avgRating.toFixed(1)}` : '—'}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Users className='h-5 w-5' />
            Rendimiento de Técnicos
          </CardTitle>
          <CardDescription>Métricas de desempeño por técnico filtradas por familia</CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <input
            type='text'
            placeholder='Buscar técnico...'
            value={search}
            onChange={e => setSearch(e.target.value)}
            className='w-full sm:w-72 px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring'
          />
          <div className='overflow-x-auto'>
            <table className='w-full text-sm'>
              <thead>
                <tr className='border-b bg-muted/50'>
                  <th className='text-left p-3 font-medium'>Técnico</th>
                  <th className='text-right p-3 font-medium'>Asignados</th>
                  <th className='text-right p-3 font-medium'>Resueltos</th>
                  <th className='text-right p-3 font-medium'>Eficiencia</th>
                  <th className='text-right p-3 font-medium'>Tiempo Prom.</th>
                  <th className='text-right p-3 font-medium'>Calificación</th>
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
                      className='border-b hover:bg-muted/30 transition-colors'
                    >
                      <td className='p-3'>
                        <div>
                          <p className='font-medium'>{tech.technicianName}</p>
                          <p className='text-xs text-muted-foreground'>{tech.technicianEmail}</p>
                        </div>
                      </td>
                      <td className='p-3 text-right'>{tech.assignedTickets}</td>
                      <td className='p-3 text-right text-emerald-600 dark:text-emerald-400 font-medium'>
                        {tech.resolvedTickets}
                      </td>
                      <td className='p-3 text-right'>
                        <span
                          className={`font-semibold ${
                            efficiency >= 80
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : efficiency >= 50
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-red-600 dark:text-red-400'
                          }`}
                        >
                          {efficiency}%
                        </span>
                      </td>
                      <td className='p-3 text-right text-muted-foreground'>
                        {formatMinutes(tech.avgResolutionTimeMinutes)}
                      </td>
                      <td className='p-3 text-right'>
                        {tech.avgRating !== null ? (
                          <span className='font-medium text-amber-600 dark:text-amber-400'>
                            ★ {tech.avgRating.toFixed(1)}
                          </span>
                        ) : (
                          <span className='text-muted-foreground'>—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <p className='text-center text-muted-foreground py-6 text-sm'>
                No se encontraron técnicos con ese criterio de búsqueda.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
