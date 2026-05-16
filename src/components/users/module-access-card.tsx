'use client'

import { useState } from 'react'
import { ChevronDown, Search, RefreshCw } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { getModuleEmoji, getModuleRoleDescription } from '@/hooks/use-system-modules'
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
  /** Familia nativa del usuario (por departamento) */
  nativeFamilyId?: string | null
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
  }
  /** Familias de solo lectura (fuera del scope del admin) */
  readOnlyFamilyIds?: string[]
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
  onAssignFamily,
  onUnassignFamily,
  options,
  readOnlyFamilyIds = [],
  loading,
  disabled,
}: ModuleAccessCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [search, setSearch] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)
  const { toast } = useToast()

  const assignedSet = new Set(assignedFamilyIds)
  const readOnlySet = new Set(readOnlyFamilyIds)

  const filteredFamilies = families.filter(
    f =>
      f.isActive &&
      (search === '' ||
        f.name.toLowerCase().includes(search.toLowerCase()) ||
        f.code.toLowerCase().includes(search.toLowerCase()))
  )

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
          {enabled && totalAssigned > 0 && (
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
          {/* Opciones específicas del módulo */}
          {options && (
            <div className='px-3 py-2 space-y-2 border-b border-primary/10'>
              {options.onToggleManager !== undefined && (
                <div className='flex items-center justify-between'>
                  <div className='flex items-center gap-1.5'>
                    <span className='text-xs'>🔧</span>
                    <p className='text-[11px] font-medium'>Gestión completa</p>
                  </div>
                  <Switch
                    checked={options.canManageInventory ?? false}
                    onCheckedChange={options.onToggleManager}
                    disabled={disabled}
                    className='scale-90'
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
            </div>
          )}

          {/* Selector de familias — desplegable */}
          <div className='px-3 py-2'>
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

            {expanded && (
              <div className='mt-2 space-y-2'>
                {/* Buscador */}
                <div className='relative'>
                  <Search className='absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground' />
                  <Input
                    placeholder='Buscar familia...'
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className='pl-7 h-7 text-xs'
                  />
                </div>

                {/* Lista de familias */}
                {loading ? (
                  <div className='flex items-center justify-center py-4'>
                    <RefreshCw className='h-4 w-4 animate-spin text-muted-foreground' />
                  </div>
                ) : (
                  <div className='space-y-1 max-h-48 overflow-y-auto pr-1'>
                    {filteredFamilies.map(family => {
                      const isNative = nativeFamilyId === family.id
                      const isAssigned = assignedSet.has(family.id) || isNative
                      const isReadOnly = readOnlySet.has(family.id)
                      const isSaving = savingId === family.id
                      const isDisabled = isSaving || isNative || isReadOnly

                      return (
                        <div
                          key={family.id}
                          className={cn(
                            'flex items-center justify-between rounded-md border px-2.5 py-1.5',
                            isNative && 'bg-primary/5 border-primary/20'
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
                              <p className='text-xs font-medium leading-none'>{family.name}</p>
                              <p className='text-[10px] text-muted-foreground font-mono'>
                                {family.code}
                              </p>
                            </div>
                          </div>
                          <div className='flex items-center gap-1'>
                            {isNative && (
                              <Badge
                                variant='outline'
                                className='text-[9px] px-1 py-0 border-primary/30 text-primary'
                              >
                                Nativa
                              </Badge>
                            )}
                            {isSaving && (
                              <RefreshCw className='h-3 w-3 animate-spin text-muted-foreground' />
                            )}
                          </div>
                        </div>
                      )
                    })}
                    {filteredFamilies.length === 0 && (
                      <p className='text-center text-xs text-muted-foreground py-3'>
                        {search ? 'Sin resultados' : 'No hay familias activas'}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
