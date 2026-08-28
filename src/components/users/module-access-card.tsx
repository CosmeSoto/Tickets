'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronDown, Search, RefreshCw, Lock, Info } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  getModuleEmoji,
  getModuleRoleDescription,
  getAdditionalFamilyHint,
} from '@/hooks/use-system-modules'
import { useToast } from '@/hooks/use-toast'

export interface ModuleFamily {
  id: string
  name: string
  code: string
  color?: string | null
  isActive: boolean
}

interface ModuleAccessCardProps {
  moduleKey: string
  moduleName: string
  role: string
  enabled: boolean
  onToggle: (enabled: boolean) => void
  /** Familias disponibles para asignar */
  families: ModuleFamily[]
  /** IDs de familias asignadas a este módulo */
  assignedFamilyIds: string[]
  /** Familia nativa del usuario (por departamento) — siempre aparece fija arriba, sin edición */
  nativeFamilyId?: string | null
  /** Objeto completo de la familia nativa, para mostrarla aunque no esté en `families` */
  nativeFamily?: ModuleFamily | null
  /** Callback al asignar/desasignar familia */
  onAssignFamily: (familyId: string) => Promise<any>
  onUnassignFamily: (familyId: string) => Promise<any>
  /** Opciones específicas del módulo */
  options?: {
    /** Inventario: gestión completa */
    canManageInventory?: boolean
    onToggleManager?: (v: boolean) => void
    /** Inventario: solicitar activos */
    canRequestAssets?: boolean
    onToggleRequestAssets?: (v: boolean) => void
    /** Inventario: aprobar bajas definitivas de activos (solo ADMIN, no super admin) */
    canApproveDecommission?: boolean
    onToggleApproveDecommission?: (v: boolean) => void
    /** Tickets: Base de conocimientos */
    canAccessKnowledge?: boolean
    onToggleAccessKnowledge?: (v: boolean) => void
    /** Noticias: puede crear y publicar noticias */
    canManageNews?: boolean
    onToggleManageNews?: (v: boolean) => void
    /** Documentos: puede crear, editar y eliminar documentos */
    canManageForms?: boolean
    onToggleManageForms?: (v: boolean) => void
    /** Credenciales: ver/editar de roles inferiores (no es requisito para crear propias) */
    canManageCredentials?: boolean
    onToggleManageCredentials?: (v: boolean) => void
    /** Procesos: puede crear, versionar y gobernar procedimientos */
    canManageProcesses?: boolean
    onToggleManageProcesses?: (v: boolean) => void
    /** Accesos: puede emitir y revocar pases QR */
    canManageAccess?: boolean
    onToggleManageAccess?: (v: boolean) => void
  }
  /** Familias de solo lectura (fuera del scope del admin) */
  readOnlyFamilyIds?: string[]
  /** Oculta el selector de familias de esta tarjeta (y su badge de conteo)
   *  cuando se muestra en otro lugar — ej. Noticias/Documentos, que comparten
   *  un único selector "Áreas de contenido" (ver ContentFamiliesCard) para no
   *  duplicar la misma lista dos veces en el modal. */
  hideFamilies?: boolean
  loading?: boolean
  disabled?: boolean
}

export function ModuleAccessCard({
  moduleKey,
  moduleName,
  role,
  enabled,
  onToggle,
  families,
  assignedFamilyIds,
  nativeFamilyId,
  nativeFamily,
  onAssignFamily,
  onUnassignFamily,
  options,
  readOnlyFamilyIds = [],
  hideFamilies = false,
  loading,
  disabled,
}: ModuleAccessCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [search, setSearch] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)
  const { toast } = useToast()

  // Auto-expandir cuando el módulo se activa, para que la familia nativa
  // sea visible inmediatamente sin que el usuario tenga que hacer clic extra.
  const prevEnabledRef = useRef(enabled)
  useEffect(() => {
    if (enabled && !prevEnabledRef.current) {
      setExpanded(true)
    }
    if (!enabled) {
      setExpanded(false)
      setSearch('')
    }
    prevEnabledRef.current = enabled
  }, [enabled])

  const assignedSet = new Set(assignedFamilyIds)
  const readOnlySet = new Set(readOnlyFamilyIds)

  const resolvedNativeFamily: ModuleFamily | null =
    nativeFamily ?? (nativeFamilyId ? (families.find(f => f.id === nativeFamilyId) ?? null) : null)

  const additionalFamilies = families.filter(f => f.isActive && f.id !== nativeFamilyId)

  const filteredFamilies = additionalFamilies.filter(
    f =>
      search === '' ||
      f.name.toLowerCase().includes(search.toLowerCase()) ||
      f.code.toLowerCase().includes(search.toLowerCase())
  )

  const showAdditionalFamilySelector = additionalFamilies.length > 0 || !!nativeFamilyId
  const showFamiliesSection = !!resolvedNativeFamily || showAdditionalFamilySelector

  const handleFamilyToggle = async (familyId: string, checked: boolean) => {
    if (savingId) return
    setSavingId(familyId)
    try {
      if (checked) {
        await onAssignFamily(familyId)
      } else {
        await onUnassignFamily(familyId)
      }
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Error al cambiar la asignación de la familia',
        variant: 'destructive',
      })
    } finally {
      setSavingId(null)
    }
  }

  const totalAssigned = assignedFamilyIds.length + (nativeFamilyId ? 1 : 0)

  return (
    <div
      className={cn(
        'rounded-xl border-2 transition-all duration-150',
        enabled
          ? 'border-primary/40 bg-primary/5'
          : 'border-border bg-background hover:border-border/80'
      )}
    >
      {/* Header — toggle del módulo */}
      <div className='flex items-center justify-between p-3'>
        <div className='flex items-center gap-2.5 min-w-0'>
          <span className='text-xl leading-none'>{getModuleEmoji(moduleKey)}</span>
          <div className='min-w-0'>
            <p
              className={cn(
                'text-sm font-semibold leading-tight',
                enabled ? 'text-primary' : 'text-foreground'
              )}
            >
              {moduleName}
            </p>
            <p className='text-[10px] text-muted-foreground leading-tight mt-0.5'>
              {getModuleRoleDescription(moduleKey, role)}
            </p>
          </div>
        </div>
        <div className='flex items-center gap-2'>
          {enabled && !hideFamilies && totalAssigned > 0 && (
            <Badge variant='secondary' className='text-[10px] px-1.5 py-0'>
              {totalAssigned} familia{totalAssigned !== 1 ? 's' : ''}
            </Badge>
          )}
          <Switch checked={enabled} onCheckedChange={onToggle} disabled={disabled} />
        </div>
      </div>

      {/* Contenido expandible — solo cuando está habilitado */}
      {enabled && (
        <div className='border-t border-primary/20'>
          {/* Opciones específicas del módulo (ej. inventario / crear contenido) */}
          {options && (
            <div className='px-3 py-2 space-y-2 border-b border-primary/10'>
              {options.onToggleManager !== undefined && (
                <div className='flex items-center justify-between gap-2'>
                  <div className='min-w-0'>
                    <div className='flex items-center gap-1.5'>
                      <span className='text-xs'>🔧</span>
                      <p className='text-[11px] font-medium'>Gestión completa</p>
                    </div>
                    <p className='text-[10px] text-muted-foreground mt-0.5 pl-5'>
                      Solo técnicos y administradores. El cliente nunca es gestor: ve asignados y
                      puede solicitar si está habilitado.
                    </p>
                  </div>
                  <Switch
                    checked={options.canManageInventory ?? false}
                    onCheckedChange={options.onToggleManager}
                    disabled={disabled}
                    className='scale-90 shrink-0'
                  />
                </div>
              )}
              {options.onToggleApproveDecommission !== undefined && (
                <div className='flex items-center justify-between gap-2'>
                  <div className='min-w-0'>
                    <div className='flex items-center gap-1.5'>
                      <span className='text-xs'>🗑️</span>
                      <p className='text-[11px] font-medium'>Aprobar bajas definitivas</p>
                    </div>
                    <p className='text-[10px] text-muted-foreground mt-0.5 pl-5'>
                      Puede aprobar la baja definitiva de activos de su(s) familia(s). El Super
                      Admin siempre puede, sin necesidad de este permiso.
                    </p>
                  </div>
                  <Switch
                    checked={options.canApproveDecommission ?? false}
                    onCheckedChange={options.onToggleApproveDecommission}
                    disabled={disabled}
                    className='scale-90 shrink-0'
                  />
                </div>
              )}
              {options.onToggleRequestAssets !== undefined && (
                <div className='flex items-center justify-between'>
                  <div className='flex items-center gap-1.5'>
                    <span className='text-xs'>📋</span>
                    <p className='text-[11px] font-medium'>Solicitar activos</p>
                  </div>
                  <Switch
                    checked={options.canRequestAssets ?? false}
                    onCheckedChange={options.onToggleRequestAssets}
                    disabled={disabled}
                    className='scale-90'
                  />
                </div>
              )}
              {options.onToggleAccessKnowledge !== undefined && (
                <div className='flex items-center justify-between gap-2'>
                  <div className='min-w-0'>
                    <div className='flex items-center gap-1.5'>
                      <span className='text-xs'>📚</span>
                      <p className='text-[11px] font-medium'>Base de conocimientos</p>
                    </div>
                    <p className='text-[10px] text-muted-foreground mt-0.5 pl-5'>
                      Ver y usar artículos de ayuda del módulo Tickets. Independiente del rol.
                    </p>
                  </div>
                  <Switch
                    checked={options.canAccessKnowledge ?? false}
                    onCheckedChange={options.onToggleAccessKnowledge}
                    disabled={disabled}
                    className='scale-90 shrink-0'
                  />
                </div>
              )}
              {options.onToggleManageNews !== undefined && (
                <div className='flex items-center justify-between gap-2'>
                  <div className='min-w-0'>
                    <div className='flex items-center gap-1.5'>
                      <span className='text-xs'>✏️</span>
                      <p className='text-[11px] font-medium'>Crear y publicar noticias</p>
                    </div>
                    <p className='text-[10px] text-muted-foreground mt-0.5 pl-5'>
                      {role === 'CLIENT'
                        ? 'Solo para su área. Sin esto, solo puede ver noticias.'
                        : 'Sin esto, solo puede ver noticias del feed.'}
                    </p>
                  </div>
                  <Switch
                    checked={options.canManageNews ?? false}
                    onCheckedChange={options.onToggleManageNews}
                    disabled={disabled}
                    className='scale-90 shrink-0'
                  />
                </div>
              )}
              {options.onToggleManageForms !== undefined && (
                <div className='flex items-center justify-between gap-2'>
                  <div className='min-w-0'>
                    <div className='flex items-center gap-1.5'>
                      <span className='text-xs'>✏️</span>
                      <p className='text-[11px] font-medium'>Crear y gestionar documentos</p>
                    </div>
                    <p className='text-[10px] text-muted-foreground mt-0.5 pl-5'>
                      {role === 'CLIENT'
                        ? 'Solo para su área. Sin esto, solo puede ver/descargar.'
                        : 'Sin esto, solo puede ver y descargar documentos.'}
                    </p>
                  </div>
                  <Switch
                    checked={options.canManageForms ?? false}
                    onCheckedChange={options.onToggleManageForms}
                    disabled={disabled}
                    className='scale-90 shrink-0'
                  />
                </div>
              )}
              {options.onToggleManageCredentials !== undefined && (
                <div className='flex items-center justify-between gap-2'>
                  <div className='min-w-0'>
                    <div className='flex items-center gap-1.5'>
                      <span className='text-xs'>🔐</span>
                      <p className='text-[11px] font-medium'>Ver credenciales inferiores</p>
                    </div>
                    <p className='text-[10px] text-muted-foreground mt-0.5 pl-5'>
                      {role === 'ADMIN'
                        ? 'Solo en tu familia nativa: ver y editar las de técnicos y clientes. En familias asignadas no se ven solas: alguien debe compartírtelas. Crear propias no requiere este permiso.'
                        : 'Solo en tu familia nativa: ver y editar las de clientes. En familias asignadas no se ven solas: alguien debe compartírtelas. Crear propias no requiere este permiso.'}
                    </p>
                  </div>
                  <Switch
                    checked={options.canManageCredentials ?? false}
                    onCheckedChange={options.onToggleManageCredentials}
                    disabled={disabled}
                    className='scale-90 shrink-0'
                  />
                </div>
              )}
              {options.onToggleManageProcesses !== undefined && (
                <div className='flex items-center justify-between gap-2'>
                  <div className='min-w-0'>
                    <div className='flex items-center gap-1.5'>
                      <span className='text-xs'>🔀</span>
                      <p className='text-[11px] font-medium'>Crear y gestionar procesos</p>
                    </div>
                    <p className='text-[10px] text-muted-foreground mt-0.5 pl-5'>
                      Sin esto, solo puede consultar procedimientos publicados.
                    </p>
                  </div>
                  <Switch
                    checked={options.canManageProcesses ?? false}
                    onCheckedChange={options.onToggleManageProcesses}
                    disabled={disabled}
                    className='scale-90 shrink-0'
                  />
                </div>
              )}
              {options.onToggleManageAccess !== undefined && (
                <div className='flex items-center justify-between gap-2'>
                  <div className='min-w-0'>
                    <div className='flex items-center gap-1.5'>
                      <span className='text-xs'>🪪</span>
                      <p className='text-[11px] font-medium'>Emitir y revocar pases</p>
                    </div>
                    <p className='text-[10px] text-muted-foreground mt-0.5 pl-5'>
                      Sin esto, solo puede verificar QR de personas autorizadas.
                    </p>
                  </div>
                  <Switch
                    checked={options.canManageAccess ?? false}
                    onCheckedChange={options.onToggleManageAccess}
                    disabled={disabled}
                    className='scale-90 shrink-0'
                  />
                </div>
              )}
            </div>
          )}
          {/* Sin toggle de crear: solo lectura del módulo */}
          {enabled &&
            !options?.onToggleManageNews &&
            !options?.onToggleManageForms &&
            (moduleKey === 'news' || moduleKey === 'forms') &&
            role !== 'ADMIN' && (
              <div className='flex items-center gap-2 px-3 py-2 bg-muted/40 border-b border-primary/10'>
                <Info className='h-3.5 w-3.5 text-muted-foreground shrink-0' />
                <p className='text-[11px] text-muted-foreground'>
                  Con el módulo activo solo puede <span className='font-medium'>ver</span>. Activa
                  el permiso de crear cuando deba publicar contenido.
                </p>
              </div>
            )}

          {/* ── Sección de familias — solo si hay familias relevantes y no se
              muestra ya en otro lugar (ver hideFamilies) ── */}
          {showFamiliesSection && !hideFamilies && (
            <div className='px-3 py-2'>
              {showAdditionalFamilySelector && (
                <>
                  <button
                    type='button'
                    onClick={() => setExpanded(!expanded)}
                    className='w-full flex items-center justify-between text-xs font-medium text-muted-foreground hover:text-foreground transition-colors'
                  >
                    <span>Familias asignadas</span>
                    <ChevronDown
                      className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-180')}
                    />
                  </button>

                  {getAdditionalFamilyHint(moduleKey, role) && (
                    <p className='text-[10px] text-muted-foreground mt-1 mb-0.5 px-0.5'>
                      {getAdditionalFamilyHint(moduleKey, role)}
                    </p>
                  )}

                  {expanded && (
                    <div className='mt-2 space-y-2'>
                      <div className='relative'>
                        <Search className='absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground' />
                        <Input
                          placeholder='Buscar familia...'
                          value={search}
                          onChange={e => setSearch(e.target.value)}
                          className='pl-7 h-7 text-xs'
                        />
                      </div>

                      {loading ? (
                        <div className='flex items-center justify-center py-4'>
                          <RefreshCw className='h-4 w-4 animate-spin text-muted-foreground' />
                        </div>
                      ) : (
                        <div className='space-y-1'>
                          {resolvedNativeFamily && (
                            <>
                              <p className='text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-0.5 pt-1'>
                                Familia nativa
                              </p>
                              <div className='flex items-center justify-between rounded-md border border-primary/30 bg-primary/5 px-2.5 py-1.5'>
                                <div className='flex items-center gap-2'>
                                  <Checkbox
                                    checked
                                    disabled
                                    className='opacity-60 cursor-not-allowed'
                                  />
                                  {resolvedNativeFamily.color && (
                                    <div
                                      className='w-2.5 h-2.5 rounded-full flex-shrink-0'
                                      style={{ backgroundColor: resolvedNativeFamily.color }}
                                    />
                                  )}
                                  <div>
                                    <p className='text-xs font-medium leading-none'>
                                      {resolvedNativeFamily.name}
                                    </p>
                                    <p className='text-[10px] text-muted-foreground font-mono'>
                                      {resolvedNativeFamily.code}
                                    </p>
                                  </div>
                                </div>
                                <div className='flex items-center gap-1'>
                                  <Badge
                                    variant='outline'
                                    className='text-[9px] px-1 py-0 border-primary/30 text-primary'
                                  >
                                    Nativa
                                  </Badge>
                                  <Lock className='h-3 w-3 text-primary/40' />
                                </div>
                              </div>
                              {filteredFamilies.length > 0 && (
                                <p className='text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-0.5 pt-1'>
                                  Familias adicionales
                                </p>
                              )}
                            </>
                          )}

                          <div className='space-y-1 max-h-48 overflow-y-auto pr-1'>
                            {filteredFamilies.map(family => {
                              const isAssigned = assignedSet.has(family.id)
                              const isReadOnly = readOnlySet.has(family.id)
                              const isSaving = savingId === family.id
                              const isDisabled = isSaving || isReadOnly

                              return (
                                <div
                                  key={family.id}
                                  className={cn(
                                    'flex items-center justify-between rounded-md border px-2.5 py-1.5',
                                    isReadOnly && 'opacity-50 bg-muted/20'
                                  )}
                                >
                                  <div className='flex items-center gap-2'>
                                    <Checkbox
                                      checked={isAssigned}
                                      onCheckedChange={v =>
                                        !isDisabled && handleFamilyToggle(family.id, !!v)
                                      }
                                      disabled={isDisabled}
                                      className={isDisabled ? 'opacity-60' : ''}
                                    />
                                    {family.color && (
                                      <div
                                        className='w-2.5 h-2.5 rounded-full flex-shrink-0'
                                        style={{ backgroundColor: family.color }}
                                      />
                                    )}
                                    <div>
                                      <p className='text-xs font-medium leading-none'>
                                        {family.name}
                                      </p>
                                      <p className='text-[10px] text-muted-foreground font-mono'>
                                        {family.code}
                                      </p>
                                    </div>
                                  </div>
                                  <div className='flex items-center gap-1'>
                                    {isReadOnly && (
                                      <Lock className='h-3 w-3 text-muted-foreground' />
                                    )}
                                    {isSaving && (
                                      <RefreshCw className='h-3 w-3 animate-spin text-muted-foreground' />
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                            {filteredFamilies.length === 0 && !resolvedNativeFamily && (
                              <p className='text-center text-xs text-muted-foreground py-3'>
                                {search ? 'Sin resultados' : 'No hay familias activas'}
                              </p>
                            )}
                            {filteredFamilies.length === 0 && resolvedNativeFamily && search && (
                              <p className='text-center text-xs text-muted-foreground py-2'>
                                Sin resultados
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
