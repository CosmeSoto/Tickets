'use client'

import { useState } from 'react'
import { SymmetricStatsCard } from '@/components/shared/stats-card'
import { StaggerGrid } from '@/components/shared/stagger-grid'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  FolderTree,
  Folder,
  Tag,
  CheckCircle,
  AlertCircle,
  Users,
  Building,
  ChevronDown,
  ChevronUp,
  UserCog,
  ShieldCheck,
} from 'lucide-react'

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface TechnicianCoverage {
  id: string
  name: string
  email: string
  role: string
  categoryCount: number
  totalCapacity: number
  categories: Array<{
    id: string
    name: string
    color: string
    priority: number
    autoAssign: boolean
  }>
}

interface CategoryStats {
  total: number
  active: number
  inactive: number
  filtered?: number
  withTechnicians?: number
  byLevel: {
    level1: number
    level2: number
    level3: number
    level4: number
  }
  byTechnician?: TechnicianCoverage[]
}

interface CategoryStatsPanelProps {
  stats: CategoryStats
  loading?: boolean
  /** Si se pasa, al hacer clic en una fila del panel se activa el filtro */
  onFilterByTechnician?: (technicianId: string | null) => void
  activeTechnicianFilter?: string | null
}

// ── Helper: barra de progreso compacta ───────────────────────────────────────

function MiniBar({ pct, color }: { pct: number; color: string }) {
  const clamped = Math.min(100, Math.max(0, pct))
  return (
    <div className='h-1.5 w-full rounded-full bg-muted overflow-hidden'>
      <div
        className='h-full rounded-full transition-all duration-300'
        style={{ width: `${clamped}%`, backgroundColor: color }}
      />
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

export function CategoryStatsPanel({
  stats,
  loading,
  onFilterByTechnician,
  activeTechnicianFilter,
}: CategoryStatsPanelProps) {
  const [coverageOpen, setCoverageOpen] = useState(false)

  if (loading) {
    return (
      <div className='space-y-4 mb-6'>
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
          {[...Array(8)].map((_, i) => (
            <SymmetricStatsCard
              key={i}
              title='Cargando...'
              value='--'
              icon={FolderTree}
              color='gray'
            />
          ))}
        </div>
      </div>
    )
  }

  const activePercentage = stats.total > 0 ? (stats.active / stats.total) * 100 : 0
  const inactivePercentage = stats.total > 0 ? (stats.inactive / stats.total) * 100 : 0
  const technicianCoverage =
    stats.total > 0 ? ((stats.withTechnicians || 0) / stats.total) * 100 : 0

  const technicians = stats.byTechnician ?? []
  const maxCategories = technicians.length > 0 ? technicians[0].categoryCount : 1

  return (
    <div className='space-y-4 mb-6'>
      {/* ── Stat cards ───────────────────────────────────────────────────── */}
      <StaggerGrid className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
        <SymmetricStatsCard
          title='Total Categorías'
          value={stats.total}
          icon={FolderTree}
          color='blue'
          status='normal'
        />

        <SymmetricStatsCard
          title='Categorías Activas'
          value={stats.active}
          icon={CheckCircle}
          color='green'
          status='success'
          badge={{ text: `${activePercentage.toFixed(1)}%`, variant: 'default' }}
        />

        <SymmetricStatsCard
          title='Categorías Inactivas'
          value={stats.inactive}
          icon={AlertCircle}
          color='red'
          status={stats.inactive > 5 ? 'warning' : 'normal'}
          badge={{ text: `${inactivePercentage.toFixed(1)}%`, variant: 'secondary' }}
        />

        <SymmetricStatsCard
          title='Con Técnicos Asignados'
          value={stats.withTechnicians || 0}
          icon={Users}
          color='purple'
          status={
            technicianCoverage >= 80 ? 'success' : technicianCoverage >= 50 ? 'normal' : 'warning'
          }
          badge={{ text: `${technicianCoverage.toFixed(1)}%`, variant: 'outline' }}
        />

        <SymmetricStatsCard
          title='Nivel 1 (Raíz)'
          value={stats.byLevel.level1}
          icon={Building}
          color='blue'
          status='normal'
        />

        <SymmetricStatsCard
          title='Nivel 2 (Departamentos)'
          value={stats.byLevel.level2}
          icon={Folder}
          color='green'
          status='normal'
        />

        <SymmetricStatsCard
          title='Nivel 3 (Servicios)'
          value={stats.byLevel.level3}
          icon={Tag}
          color='orange'
          status='normal'
        />

        <SymmetricStatsCard
          title='Nivel 4 (Especialidades)'
          value={stats.byLevel.level4}
          icon={Tag}
          color='purple'
          trend={{
            value: stats.byLevel.level4 > 10 ? 8 : -3,
            label: 'especialización',
            isPositive: stats.byLevel.level4 > 10,
          }}
        />
      </StaggerGrid>

      {/* ── Panel cobertura por técnico ───────────────────────────────────── */}
      {technicians.length > 0 && (
        <div className='rounded-lg border bg-card overflow-hidden'>
          {/* Cabecera colapsable */}
          <button
            type='button'
            onClick={() => setCoverageOpen(v => !v)}
            className='w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors'
          >
            <div className='flex items-center gap-2'>
              <UserCog className='h-4 w-4 text-muted-foreground' />
              <span className='text-sm font-semibold'>Cobertura por Técnico</span>
              <Badge variant='secondary' className='text-xs'>
                {technicians.length} {technicians.length === 1 ? 'técnico' : 'técnicos'}
              </Badge>
              {activeTechnicianFilter && (
                <Badge variant='default' className='text-xs bg-indigo-600'>
                  Filtro activo
                </Badge>
              )}
            </div>
            {coverageOpen ? (
              <ChevronUp className='h-4 w-4 text-muted-foreground' />
            ) : (
              <ChevronDown className='h-4 w-4 text-muted-foreground' />
            )}
          </button>

          {/* Contenido expandible */}
          {coverageOpen && (
            <div className='border-t'>
              {/* Encabezado de columnas */}
              <div className='grid grid-cols-12 gap-2 px-4 py-2 bg-muted/40 text-xs font-medium text-muted-foreground'>
                <div className='col-span-4'>Técnico</div>
                <div className='col-span-2 text-center'>Categorías</div>
                <div className='col-span-2 text-center'>Capacidad</div>
                <div className='col-span-3'>Distribución</div>
                <div className='col-span-1' />
              </div>

              {/* Filas */}
              <TooltipProvider delayDuration={200}>
                <div className='divide-y'>
                  {technicians.map(tech => {
                    const barPct =
                      maxCategories > 0 ? (tech.categoryCount / maxCategories) * 100 : 0
                    const isFiltered = activeTechnicianFilter === tech.id
                    const barColor = tech.role === 'ADMIN' ? '#6366f1' : '#0ea5e9'

                    return (
                      <div
                        key={tech.id}
                        onClick={() => onFilterByTechnician?.(isFiltered ? null : tech.id)}
                        className={[
                          'grid grid-cols-12 gap-2 px-4 py-2.5 text-sm items-center transition-colors',
                          onFilterByTechnician ? 'cursor-pointer hover:bg-muted/50' : '',
                          isFiltered ? 'bg-indigo-50 dark:bg-indigo-950/30' : '',
                        ].join(' ')}
                      >
                        {/* Nombre + email */}
                        <div className='col-span-4 min-w-0'>
                          <div className='flex items-center gap-1.5 min-w-0'>
                            {tech.role === 'ADMIN' ? (
                              <ShieldCheck className='h-3.5 w-3.5 text-indigo-500 shrink-0' />
                            ) : (
                              <UserCog className='h-3.5 w-3.5 text-sky-500 shrink-0' />
                            )}
                            <span className='font-medium truncate'>{tech.name}</span>
                          </div>
                          <p className='text-xs text-muted-foreground truncate pl-5'>
                            {tech.email}
                          </p>
                        </div>

                        {/* Cantidad de categorías */}
                        <div className='col-span-2 text-center'>
                          <span className='font-semibold tabular-nums'>{tech.categoryCount}</span>
                        </div>

                        {/* Capacidad total */}
                        <div className='col-span-2 text-center text-muted-foreground tabular-nums'>
                          {tech.totalCapacity} tickets
                        </div>

                        {/* Barra de distribución */}
                        <div className='col-span-3'>
                          <MiniBar pct={barPct} color={barColor} />
                        </div>

                        {/* Tooltip con categorías asignadas */}
                        <div className='col-span-1 flex justify-end'>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type='button'
                                onClick={e => e.stopPropagation()}
                                className='text-xs text-muted-foreground hover:text-foreground transition-colors px-1'
                              >
                                Ver
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side='left' className='max-w-xs p-3 space-y-1.5'>
                              <p className='font-semibold text-xs mb-2'>
                                Categorías de {tech.name}
                              </p>
                              {tech.categories
                                .sort((a, b) => a.priority - b.priority)
                                .map(cat => (
                                  <div key={cat.id} className='flex items-center gap-2 text-xs'>
                                    <span
                                      className='w-2 h-2 rounded-full shrink-0'
                                      style={{ backgroundColor: cat.color }}
                                    />
                                    <span className='truncate'>{cat.name}</span>
                                    <span className='text-muted-foreground ml-auto shrink-0'>
                                      P{cat.priority}
                                    </span>
                                    {cat.autoAssign && (
                                      <span className='text-green-600 shrink-0'>●</span>
                                    )}
                                  </div>
                                ))}
                              <p className='text-xs text-muted-foreground pt-1 border-t'>
                                ● Auto-asignación activa
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </TooltipProvider>

              {/* Pie — limpiar filtro si está activo */}
              {activeTechnicianFilter && onFilterByTechnician && (
                <div className='px-4 py-2 border-t bg-muted/30 flex items-center justify-between'>
                  <span className='text-xs text-muted-foreground'>
                    Mostrando categorías del técnico seleccionado
                  </span>
                  <button
                    type='button'
                    onClick={() => onFilterByTechnician(null)}
                    className='text-xs text-indigo-600 hover:underline'
                  >
                    Limpiar filtro
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
