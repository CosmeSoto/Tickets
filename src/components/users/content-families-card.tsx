'use client'

/**
 * Selector de "Áreas de contenido" — único, compartido entre Noticias y
 * Documentos (user_family_access.module = 'content'). Antes cada módulo
 * mostraba su propia tarjeta con el mismo selector de familias duplicado
 * (mismo estado, mismos checks), lo que agrandaba el modal y confundía:
 * marcar una familia en Noticias también la activaba en Documentos porque
 * en el backend siempre fue el mismo permiso — solo la UI lo repetía dos
 * veces. Esta tarjeta reemplaza esas dos secciones por una sola.
 */

import { useState, useEffect, useRef } from 'react'
import { ChevronDown, Search, RefreshCw, Lock } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { getAdditionalFamilyHint } from '@/hooks/use-system-modules'
import type { ModuleFamily } from '@/components/users/module-access-card'

interface ContentFamiliesCardProps {
  /** Se muestra solo si Noticias y/o Documentos están activos. */
  active: boolean
  role: string
  families: ModuleFamily[]
  assignedFamilyIds: string[]
  nativeFamilyId?: string | null
  nativeFamily?: ModuleFamily | null
  onAssignFamily: (familyId: string) => Promise<any>
  onUnassignFamily: (familyId: string) => Promise<any>
  readOnlyFamilyIds?: string[]
  loading?: boolean
  disabled?: boolean
}

export function ContentFamiliesCard({
  active,
  role,
  families,
  assignedFamilyIds,
  nativeFamilyId,
  nativeFamily,
  onAssignFamily,
  onUnassignFamily,
  readOnlyFamilyIds = [],
  loading,
  disabled,
}: ContentFamiliesCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [search, setSearch] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)

  // Auto-expandir cuando pasa de inactivo a activo (mismo comportamiento
  // que las demás tarjetas de módulo al habilitarse).
  const prevActiveRef = useRef(active)
  useEffect(() => {
    if (active && !prevActiveRef.current) setExpanded(true)
    if (!active) {
      setExpanded(false)
      setSearch('')
    }
    prevActiveRef.current = active
  }, [active])

  if (!active) return null

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
  const totalAssigned = assignedFamilyIds.length + (nativeFamilyId ? 1 : 0)
  const hint = getAdditionalFamilyHint('content', role)

  const handleToggle = async (familyId: string, checked: boolean) => {
    if (savingId) return
    setSavingId(familyId)
    try {
      if (checked) {
        await onAssignFamily(familyId)
      } else {
        await onUnassignFamily(familyId)
      }
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className='rounded-xl border-2 border-primary/40 bg-primary/5'>
      <button
        type='button'
        onClick={() => setExpanded(!expanded)}
        className='w-full flex items-center justify-between p-3'
      >
        <div className='flex items-center gap-2.5 min-w-0 text-left'>
          <span className='text-xl leading-none'>🗂️</span>
          <div className='min-w-0'>
            <p className='text-sm font-semibold leading-tight text-primary'>Áreas de contenido</p>
            <p className='text-[10px] text-muted-foreground leading-tight mt-0.5'>
              Compartidas entre Noticias y Documentos
            </p>
          </div>
        </div>
        <div className='flex items-center gap-2 shrink-0'>
          {totalAssigned > 0 && (
            <Badge variant='secondary' className='text-[10px] px-1.5 py-0'>
              {totalAssigned} familia{totalAssigned !== 1 ? 's' : ''}
            </Badge>
          )}
          <ChevronDown
            className={cn(
              'h-4 w-4 text-muted-foreground transition-transform',
              expanded && 'rotate-180'
            )}
          />
        </div>
      </button>

      {expanded && (
        <div className='border-t border-primary/20 px-3 py-2 space-y-2'>
          {hint && <p className='text-[10px] text-muted-foreground px-0.5'>{hint}</p>}

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
                      <Checkbox checked disabled className='opacity-60 cursor-not-allowed' />
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
                  const isDisabled = disabled || isSaving || isReadOnly

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
                          onCheckedChange={v => !isDisabled && handleToggle(family.id, !!v)}
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
                        {isReadOnly && <Lock className='h-3 w-3 text-muted-foreground' />}
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
                  <p className='text-center text-xs text-muted-foreground py-2'>Sin resultados</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
