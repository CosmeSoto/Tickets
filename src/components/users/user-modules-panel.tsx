'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, Activity, CheckCircle2, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface UserModulesPanelProps {
  userId: string
  role: string
  canManageInventory: boolean
  ticketsEnabled?: boolean
  inventoryEnabled?: boolean
  patrolsEnabled?: boolean
  newsEnabled?: boolean
  canManageNews?: boolean
  formsEnabled?: boolean
  canManageForms?: boolean
  canRequestAssets?: boolean
  defaultCollapsed?: boolean
  hideGuides?: boolean
}

interface ModulesData {
  tickets: boolean
  inventory: boolean
  patrols: boolean
  news: boolean
  forms: boolean
  canManageNews?: boolean
  canManageForms?: boolean
  families: Array<{
    id: string
    name: string
    code: string
    color?: string | null
    modules: {
      tickets: boolean
      inventory: boolean
      patrols: boolean
      news: boolean
      forms: boolean
    }
  }>
}

// Chip de familia con el color real de la familia
function FamilyChip({ name, color }: { name: string; color?: string | null }) {
  return (
    <span className='inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-background border font-medium'>
      {color && (
        <span className='w-1.5 h-1.5 rounded-full shrink-0' style={{ backgroundColor: color }} />
      )}
      {name}
    </span>
  )
}

// Línea de módulo con icono de estado, descripción y familias
function ModuleLine({
  emoji,
  label,
  active,
  capability,
  role: roleText,
  families,
}: {
  emoji: string
  label: string
  active: boolean
  capability: string
  role?: string
  families?: Array<{ id: string; name: string; color?: string | null }>
}) {
  return (
    <div
      className={cn(
        'rounded-lg border px-3 py-2.5 space-y-1.5 transition-colors',
        active ? 'bg-primary/5 border-primary/20' : 'border-border opacity-50'
      )}
    >
      <div className='flex items-center justify-between gap-2'>
        <div className='flex items-center gap-2 min-w-0'>
          <span className='text-base shrink-0'>{emoji}</span>
          <div className='min-w-0'>
            <span className='text-xs font-semibold text-foreground'>{label}</span>
            {active && (
              <p className='text-[10px] text-muted-foreground leading-snug mt-0.5'>{capability}</p>
            )}
          </div>
        </div>
        <div className='shrink-0'>
          {active ? (
            <CheckCircle2 className='h-3.5 w-3.5 text-primary' />
          ) : (
            <XCircle className='h-3.5 w-3.5 text-muted-foreground/40' />
          )}
        </div>
      </div>
      {active && families && families.length > 0 && (
        <div className='flex flex-wrap gap-1'>
          {families.map(f => (
            <FamilyChip key={f.id} name={f.name} color={f.color} />
          ))}
        </div>
      )}
    </div>
  )
}

export function UserModulesPanel({
  userId,
  role,
  canManageInventory,
  ticketsEnabled,
  inventoryEnabled,
  patrolsEnabled,
  newsEnabled,
  canManageNews,
  formsEnabled,
  canManageForms,
  canRequestAssets,
  defaultCollapsed = false,
  hideGuides = false,
}: UserModulesPanelProps) {
  const [data, setData] = useState<ModulesData | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(!defaultCollapsed)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/user/modules?userId=${userId}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [
    userId,
    canManageInventory,
    canRequestAssets,
    ticketsEnabled,
    inventoryEnabled,
    patrolsEnabled,
    newsEnabled,
    canManageNews,
    formsEnabled,
    canManageForms,
  ])

  if (loading) {
    return (
      <div className='flex items-center gap-2 py-1'>
        <div className='w-2 h-2 rounded-full bg-muted-foreground/30 animate-pulse' />
        <p className='text-[11px] text-muted-foreground'>Calculando perfil de acceso...</p>
      </div>
    )
  }

  if (!data) return null

  const active = {
    tickets: data.tickets,
    inventory: data.inventory,
    patrols: data.patrols,
    news: newsEnabled ?? false,
    forms: formsEnabled ?? false,
  }

  const activeCount = Object.values(active).filter(Boolean).length

  // Familias por módulo con su color
  const familiesByModule = (mod: keyof typeof active) =>
    data.families
      .filter(f => f.modules[mod])
      .map(f => ({ id: f.id, name: f.name, color: f.color ?? null }))

  // Capacidades contextuales por rol
  const ticketsCap =
    role === 'ADMIN'
      ? 'Gestiona y supervisa tickets de sus familias asignadas'
      : role === 'TECHNICIAN'
        ? 'Atiende tickets asignados · crea tickets propios'
        : 'Crea y hace seguimiento de sus propios tickets de soporte'

  const inventoryCap = canManageInventory
    ? 'Gestión completa: activos, asignaciones, mantenimientos'
    : canRequestAssets
      ? 'Ve sus equipos asignados · puede solicitar nuevos activos'
      : 'Consulta los equipos asignados a su perfil'

  const patrolsCap =
    role === 'ADMIN'
      ? 'Supervisa rondas, ve reportes y configura rutas'
      : role === 'TECHNICIAN'
        ? 'Ejecuta rondas programadas · puede supervisar su instalación'
        : 'Ejecuta rondas de seguridad asignadas como agente'

  const newsCap = canManageNews
    ? 'Lee comunicados · crea y publica noticias para todos los usuarios'
    : 'Lee noticias y comunicados según su perfil'

  const formsCap = canManageForms
    ? 'Descarga documentos · crea y gestiona los de sus familias'
    : 'Consulta y descarga documentos disponibles para su perfil'

  const allModules = [
    { key: 'tickets' as const, emoji: '🎫', label: 'Tickets de Soporte', cap: ticketsCap },
    { key: 'inventory' as const, emoji: '📦', label: 'Inventario', cap: inventoryCap },
    { key: 'patrols' as const, emoji: '🛡️', label: 'Rondas y Patrullajes', cap: patrolsCap },
    { key: 'news' as const, emoji: '📰', label: 'Noticias', cap: newsCap },
    { key: 'forms' as const, emoji: '📄', label: 'Documentos', cap: formsCap },
  ]

  return (
    <div className='rounded-lg border overflow-hidden'>
      {/* Header */}
      <button
        type='button'
        onClick={() => setExpanded(v => !v)}
        className='w-full flex items-center justify-between px-3 py-2 bg-muted/30 hover:bg-muted/50 transition-colors'
      >
        <div className='flex items-center gap-2'>
          <Activity className='h-3.5 w-3.5 text-muted-foreground' />
          <span className='text-xs font-semibold text-foreground'>Perfil de acceso</span>
          <span className='text-[10px] text-muted-foreground'>
            · {activeCount}/{allModules.length} módulos activos
          </span>
        </div>
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 text-muted-foreground transition-transform',
            expanded && 'rotate-180'
          )}
        />
      </button>

      {/* Detalle */}
      {expanded && (
        <div className='px-3 py-2.5 border-t space-y-1.5'>
          {allModules.map(m => (
            <ModuleLine
              key={m.key}
              emoji={m.emoji}
              label={m.label}
              active={active[m.key]}
              capability={m.cap}
              families={
                active[m.key] && m.key !== 'news' && m.key !== 'forms'
                  ? familiesByModule(m.key)
                  : undefined
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}
