'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, Activity, CheckCircle2, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ModuleLine } from './module-panel-chips'

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
  credentialsEnabled?: boolean
  canManageCredentials?: boolean
  canRequestAssets?: boolean
  canAccessKnowledge?: boolean
  /** Vista del propio usuario: copy en 2ª persona y nota de solo lectura */
  selfView?: boolean
  /** Si false, el detalle queda siempre visible (sin acordeón). Default true. */
  collapsible?: boolean
  defaultCollapsed?: boolean
  hideGuides?: boolean
  /** Muestra chips de módulos con la misma resolución del API (evita desfase con flags crudos) */
  showModuleChips?: boolean
}

interface ModulesData {
  tickets: boolean
  inventory: boolean
  patrols: boolean
  news: boolean
  forms: boolean
  credentials: boolean
  canManageNews?: boolean
  canManageForms?: boolean
  canManageCredentials?: boolean
  canManageInventory?: boolean
  canRequestAssets?: boolean
  canAccessKnowledge?: boolean
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
      credentials: boolean
    }
  }>
}

const MODULE_CHIP_LABELS = [
  { key: 'tickets' as const, label: '🎫 Tickets' },
  { key: 'inventory' as const, label: '📦 Inventario' },
  { key: 'patrols' as const, label: '🛡️ Rondas' },
  { key: 'credentials' as const, label: '🔐 Credenciales' },
  { key: 'news' as const, label: '📰 Noticias' },
  { key: 'forms' as const, label: '📄 Documentos' },
]

function ModuleChip({ enabled, label }: { enabled: boolean; label: string }) {
  return (
    <div
      className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border transition-colors ${
        enabled
          ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-400'
          : 'border-border bg-muted/50 text-muted-foreground'
      }`}
    >
      {enabled ? <CheckCircle2 className='h-3 w-3' /> : <XCircle className='h-3 w-3' />}
      {label}
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
  credentialsEnabled,
  canManageCredentials,
  canRequestAssets,
  canAccessKnowledge,
  selfView = false,
  collapsible = true,
  defaultCollapsed = false,
  hideGuides = false,
  showModuleChips = false,
}: UserModulesPanelProps) {
  const [data, setData] = useState<ModulesData | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(!defaultCollapsed)
  const showDetail = !collapsible || expanded

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
    canAccessKnowledge,
    ticketsEnabled,
    inventoryEnabled,
    patrolsEnabled,
    newsEnabled,
    canManageNews,
    formsEnabled,
    canManageForms,
    credentialsEnabled,
    canManageCredentials,
  ])

  if (loading) {
    return (
      <div className='space-y-2.5'>
        {showModuleChips && (
          <div className='space-y-2'>
            <p className='text-xs font-semibold text-muted-foreground uppercase tracking-wide'>
              Módulos habilitados
            </p>
            <div className='flex flex-wrap gap-2'>
              {MODULE_CHIP_LABELS.map(m => (
                <div
                  key={m.key}
                  className='h-7 w-24 rounded-full bg-muted/60 animate-pulse'
                  aria-hidden
                />
              ))}
            </div>
          </div>
        )}
        <div className='flex items-center gap-2 py-1'>
          <div className='w-2 h-2 rounded-full bg-muted-foreground/30 animate-pulse' />
          <p className='text-[11px] text-muted-foreground'>Calculando perfil de acceso...</p>
        </div>
      </div>
    )
  }

  if (!data) return null

  // Resolución canónica del API (misma que usa la navegación)
  const active = {
    tickets: data.tickets,
    inventory: data.inventory,
    patrols: data.patrols,
    news: data.news,
    forms: data.forms,
    credentials: data.credentials ?? false,
  }

  const manageInventory = data.canManageInventory ?? canManageInventory
  const requestAssets = data.canRequestAssets ?? canRequestAssets ?? false
  const accessKnowledge = data.canAccessKnowledge ?? canAccessKnowledge ?? true
  const manageNews = data.canManageNews ?? canManageNews ?? false
  const manageForms = data.canManageForms ?? canManageForms ?? false
  const manageCredentials = data.canManageCredentials ?? canManageCredentials ?? false

  const activeCount = Object.values(active).filter(Boolean).length

  // Familias por módulo con su color
  const familiesByModule = (mod: keyof typeof active) =>
    data.families
      .filter(f => f.modules[mod])
      .map(f => ({ id: f.id, name: f.name, color: f.color ?? null }))

  // Capacidades contextuales por rol
  const ticketsCap =
    role === 'ADMIN'
      ? selfView
        ? 'Gestionas y supervisas tickets de tus familias asignadas'
        : 'Gestiona y supervisa tickets de sus familias asignadas'
      : role === 'TECHNICIAN'
        ? selfView
          ? 'Atiendes tickets asignados · creas tickets propios'
          : 'Atiende tickets asignados · crea tickets propios'
        : selfView
          ? 'Creas y das seguimiento a tus propios tickets de soporte'
          : 'Crea y hace seguimiento de sus propios tickets de soporte'

  const inventoryCap = manageInventory
    ? selfView
      ? 'Gestión completa: activos, asignaciones y mantenimientos'
      : 'Gestión completa: activos, asignaciones, mantenimientos'
    : requestAssets
      ? selfView
        ? 'Ves tus equipos asignados · puedes solicitar nuevos activos'
        : 'Ve sus equipos asignados · puede solicitar nuevos activos'
      : selfView
        ? 'Consultas los equipos asignados a tu perfil'
        : 'Consulta los equipos asignados a su perfil'

  const patrolsCap =
    role === 'ADMIN'
      ? selfView
        ? 'Supervisas rondas, ves reportes y configuras rutas'
        : 'Supervisa rondas, ve reportes y configura rutas'
      : role === 'TECHNICIAN'
        ? selfView
          ? 'Ejecutas rondas programadas · puedes supervisar tu instalación'
          : 'Ejecuta rondas programadas · puede supervisar su instalación'
        : selfView
          ? 'Ejecutas rondas de seguridad asignadas como agente'
          : 'Ejecuta rondas de seguridad asignadas como agente'

  const newsCap = manageNews
    ? selfView
      ? 'Lees comunicados · creas y publicas noticias para los usuarios'
      : 'Lee comunicados · crea y publica noticias para todos los usuarios'
    : selfView
      ? 'Lees noticias y comunicados según tu perfil'
      : 'Lee noticias y comunicados según su perfil'

  const formsCap = manageForms
    ? selfView
      ? 'Descargas documentos · creas y gestionas los de tus familias'
      : 'Descarga documentos · crea y gestiona los de sus familias'
    : selfView
      ? 'Consultas y descargas documentos disponibles para tu perfil'
      : 'Consulta y descarga documentos disponibles para su perfil'

  const credentialsCap = manageCredentials
    ? role === 'ADMIN'
      ? 'Propias + compartidas + credenciales de técnicos y clientes del área'
      : role === 'TECHNICIAN'
        ? 'Propias + compartidas + credenciales de clientes del área'
        : 'Propias + compartidas'
    : selfView
      ? 'Crear y ver las tuyas + las que te compartan'
      : 'Crear y ver propias + las que le compartan'

  // Permisos adicionales por módulo
  const ticketsPerms: Array<{ icon: string; label: string }> = []
  if (accessKnowledge) ticketsPerms.push({ icon: '📚', label: 'Base de conocimientos' })

  const inventoryPerms: Array<{ icon: string; label: string }> = []
  if (manageInventory) inventoryPerms.push({ icon: '🔧', label: 'Gestión completa' })
  if (requestAssets) inventoryPerms.push({ icon: '📋', label: 'Solicitar activos' })

  const newsPerms: Array<{ icon: string; label: string }> = []
  if (manageNews) newsPerms.push({ icon: '✏️', label: 'Crear y publicar noticias' })

  const formsPerms: Array<{ icon: string; label: string }> = []
  if (manageForms) formsPerms.push({ icon: '✏️', label: 'Crear y gestionar documentos' })

  const credentialsPerms: Array<{ icon: string; label: string }> = []
  if (manageCredentials)
    credentialsPerms.push({ icon: '🔐', label: 'Ver credenciales inferiores' })

  const allModules = [
    {
      key: 'tickets' as const,
      emoji: '🎫',
      label: 'Tickets de Soporte',
      cap: ticketsCap,
      perms: ticketsPerms,
    },
    {
      key: 'inventory' as const,
      emoji: '📦',
      label: 'Inventario',
      cap: inventoryCap,
      perms: inventoryPerms,
    },
    {
      key: 'patrols' as const,
      emoji: '🛡️',
      label: 'Rondas y Patrullajes',
      cap: patrolsCap,
      perms: [] as Array<{ icon: string; label: string }>,
    },
    { key: 'news' as const, emoji: '📰', label: 'Noticias', cap: newsCap, perms: newsPerms },
    { key: 'forms' as const, emoji: '📄', label: 'Documentos', cap: formsCap, perms: formsPerms },
    {
      key: 'credentials' as const,
      emoji: '🔐',
      label: 'Credenciales',
      cap: credentialsCap,
      perms: credentialsPerms,
    },
  ]

  return (
    <div className='space-y-3'>
      {showModuleChips && (
        <div className='space-y-2.5'>
          <p className='text-xs font-semibold text-muted-foreground uppercase tracking-wide'>
            Módulos habilitados
          </p>
          <div className='flex flex-wrap gap-2'>
            {MODULE_CHIP_LABELS.map(m => (
              <ModuleChip key={m.key} enabled={active[m.key]} label={m.label} />
            ))}
          </div>
          {!hideGuides && activeCount < MODULE_CHIP_LABELS.length && (
            <p className='text-[11px] text-muted-foreground'>
              {selfView
                ? 'Los chips reflejan tu acceso real en el menú. Si falta un módulo, contacta a tu administrador.'
                : 'Los chips reflejan el acceso real (flags + familias asignadas), igual que el menú del usuario.'}
            </p>
          )}
        </div>
      )}

      <div className='rounded-lg border overflow-hidden'>
        {/* Header */}
        {collapsible ? (
          <button
            type='button'
            onClick={() => setExpanded(v => !v)}
            className='w-full flex items-center justify-between px-3 py-2.5 sm:px-4 bg-muted/30 hover:bg-muted/50 transition-colors'
          >
            <div className='flex items-center gap-2'>
              <Activity className='h-3.5 w-3.5 text-muted-foreground' />
              <span className='text-xs font-semibold text-foreground'>
                {selfView ? 'Tu perfil de acceso' : 'Perfil de acceso'}
              </span>
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
        ) : (
          <div className='w-full flex items-center px-3 py-2.5 sm:px-4 bg-muted/30'>
            <div className='flex items-center gap-2'>
              <Activity className='h-3.5 w-3.5 text-muted-foreground' />
              <span className='text-xs font-semibold text-foreground'>
                {selfView ? 'Tu perfil de acceso' : 'Perfil de acceso'}
              </span>
              <span className='text-[10px] text-muted-foreground'>
                · {activeCount}/{allModules.length} módulos activos
              </span>
            </div>
          </div>
        )}

        {/* Detalle */}
        {showDetail && (
          <div className='px-3 py-3 sm:px-4 border-t space-y-1.5'>
            {allModules.map(m => (
              <ModuleLine
                key={m.key}
                emoji={m.emoji}
                label={m.label}
                active={active[m.key]}
                capability={m.cap}
                extraPermissions={active[m.key] && m.perms.length > 0 ? m.perms : undefined}
                families={
                  active[m.key] && m.key !== 'news' && m.key !== 'forms'
                    ? familiesByModule(m.key as 'tickets' | 'inventory' | 'patrols' | 'credentials')
                    : undefined
                }
              />
            ))}
            {selfView && (
              <p className='pt-2 text-[11px] text-muted-foreground leading-relaxed'>
                Este resumen es solo consulta. Los módulos y familias los asigna un administrador;
                coinciden con lo que ves en el menú lateral.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
