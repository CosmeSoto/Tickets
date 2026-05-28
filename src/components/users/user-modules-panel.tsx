/**
 * UserModulesPanel
 *
 * Panel que muestra el estado de acceso a módulos del sistema
 * - Verifica acceso a Tickets e Inventario
 * - Muestra familias asignadas por módulo
 * - Proporciona guías de activación
 */

'use client'

import { useState, useEffect } from 'react'
import { Activity } from 'lucide-react'
import { ModuleStatusCard } from './module-status-card'

interface UserModulesPanelProps {
  userId: string
  role: string
  canManageInventory: boolean
  ticketsEnabled?: boolean
  inventoryEnabled?: boolean
  patrolsEnabled?: boolean
  newsEnabled?: boolean
  formsEnabled?: boolean
  canManageForms?: boolean
  /** Si es true, el panel inicia colapsado sin auto-expandir */
  defaultCollapsed?: boolean
  /** Si es true, no muestra guías de "Cómo activar" para módulos inactivos */
  hideGuides?: boolean
}

export function UserModulesPanel({
  userId,
  role,
  canManageInventory,
  ticketsEnabled,
  inventoryEnabled,
  patrolsEnabled,
  newsEnabled,
  formsEnabled,
  canManageForms,
  defaultCollapsed = false,
  hideGuides = false,
}: UserModulesPanelProps) {
  const [data, setData] = useState<{
    tickets: boolean
    inventory: boolean
    patrols: boolean
    news: boolean
    forms: boolean
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
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/user/modules?userId=${userId}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        setData(d)
        if (!defaultCollapsed && d && (!d.tickets || !d.inventory)) setExpanded(true)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [
    userId,
    canManageInventory,
    ticketsEnabled,
    inventoryEnabled,
    patrolsEnabled,
    newsEnabled,
    formsEnabled,
    canManageForms,
  ])

  const isAdminRole = role === 'ADMIN'
  const hasFamilies = data && data.families.length > 0
  const ticketsActive = data?.tickets ?? false
  const inventoryActive = data?.inventory ?? false
  const patrolsActive = data?.patrols ?? false
  const newsActive = newsEnabled ?? false
  const formsActive = formsEnabled ?? false

  const getTicketsGuide = () => {
    if (ticketsActive) return null
    if (isAdminRole)
      return {
        type: 'info' as const,
        steps: ['Admin → Usuarios → [Usuario]', 'Sección Familias asignadas'],
      }
    if (role === 'TECHNICIAN')
      return hasFamilies
        ? {
            type: 'warning' as const,
            steps: ['Admin → Configuración → Tickets', 'Seleccionar familia → Activar módulo'],
          }
        : {
            type: 'warning' as const,
            steps: ['Admin → Familias → [Familia]', 'Personal → Técnicos de Tickets → Agregar'],
          }
    return { type: 'info' as const, steps: ['Activar el toggle "Tickets" en la sección anterior'] }
  }

  const getInventoryGuide = () => {
    if (inventoryActive) return null
    if (isAdminRole)
      return {
        type: 'info' as const,
        steps: ['Admin → Usuarios → [Usuario]', 'Sección Familias asignadas'],
      }
    if (role === 'TECHNICIAN') {
      if (!canManageInventory)
        return {
          type: 'warning' as const,
          steps: [
            'Activar "Inventario" en la sección anterior',
            'Admin → Familias → [Familia]',
            'Personal → Gestores de Inventario → Agregar',
          ],
        }
      return hasFamilies
        ? {
            type: 'warning' as const,
            steps: ['Admin → Configuración → Inventario', 'Seleccionar familia → Activar módulo'],
          }
        : {
            type: 'warning' as const,
            steps: ['Admin → Familias → [Familia]', 'Personal → Gestores de Inventario → Agregar'],
          }
    }
    return {
      type: 'info' as const,
      steps: ['Activar el toggle "Inventario" en la sección anterior'],
    }
  }

  if (loading) {
    return (
      <div className='flex items-center gap-2 py-1'>
        <div className='w-2 h-2 rounded-full bg-muted-foreground/30 animate-pulse' />
        <p className='text-[11px] text-muted-foreground'>Verificando acceso...</p>
      </div>
    )
  }

  return (
    <div className='rounded-lg border overflow-hidden'>
      {/* Header colapsable */}
      <button
        type='button'
        onClick={() => setExpanded(v => !v)}
        className='w-full flex items-center justify-between px-3 py-2 bg-muted/30 hover:bg-muted/50 transition-colors'
      >
        <div className='flex items-center gap-2'>
          <Activity className='h-3.5 w-3.5 text-muted-foreground' />
          <span className='text-xs font-semibold text-foreground'>Estado de acceso</span>
          {/* Resumen compacto de módulos */}
          <div className='flex items-center gap-1'>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                ticketsActive ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
              }`}
            >
              🎫 {ticketsActive ? 'ON' : 'OFF'}
            </span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                inventoryActive ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
              }`}
            >
              📦 {inventoryActive ? 'ON' : 'OFF'}
            </span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                patrolsActive ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
              }`}
            >
              🛡️ {patrolsActive ? 'ON' : 'OFF'}
            </span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                newsActive ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
              }`}
            >
              📰 {newsActive ? 'ON' : 'OFF'}
            </span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                formsActive ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
              }`}
            >
              📄 {formsActive ? 'ON' : 'OFF'}
            </span>
          </div>
        </div>
        <svg
          className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`}
          viewBox='0 0 24 24'
          fill='none'
          stroke='currentColor'
          strokeWidth='2'
        >
          <path d='M6 9l6 6 6-6' strokeLinecap='round' strokeLinejoin='round' />
        </svg>
      </button>

      {/* Contenido expandible */}
      {expanded && (
        <div className='p-2.5 space-y-2 border-t'>
          <ModuleStatusCard
            emoji='🎫'
            name='Tickets'
            active={ticketsActive}
            families={data?.families.filter(f => f.modules.tickets)}
            guide={hideGuides ? null : getTicketsGuide()}
          />
          <ModuleStatusCard
            emoji='📦'
            name='Inventario'
            active={inventoryActive}
            families={data?.families.filter(f => f.modules.inventory)}
            guide={hideGuides ? null : getInventoryGuide()}
            badge={role === 'TECHNICIAN' && !canManageInventory ? 'Requiere Gestor' : undefined}
          />
          <ModuleStatusCard
            emoji='🛡️'
            name='Rondas y Patrullajes'
            active={patrolsActive}
            families={data?.families.filter(f => f.modules.patrols)}
            guide={
              hideGuides || patrolsActive
                ? null
                : {
                    type: 'info' as const,
                    steps: [
                      'Activar el toggle "Rondas" en la sección anterior',
                      'Admin → Configuración → Rondas → Seleccionar área → Activar módulo',
                    ],
                  }
            }
          />
          <ModuleStatusCard
            emoji='📰'
            name='Noticias y Comunicados'
            active={newsActive}
            families={[]}
            guide={
              hideGuides || newsActive
                ? null
                : {
                    type: 'info' as const,
                    steps: ['Activar el toggle "Noticias y Comunicados" en la sección anterior'],
                  }
            }
          />
          <ModuleStatusCard
            emoji='📄'
            name='Formularios y Documentos'
            active={formsActive}
            families={[]}
            guide={
              hideGuides || formsActive
                ? null
                : {
                    type: 'info' as const,
                    steps: ['Activar el toggle "Formularios y Documentos" en la sección anterior'],
                  }
            }
            badge={canManageForms ? 'Gestor' : undefined}
          />
        </div>
      )}
    </div>
  )
}
