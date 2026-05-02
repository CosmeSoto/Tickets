'use client'

import { useState, useMemo } from 'react'
import { Search, RefreshCw, Lock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'

export interface FamilyOption {
  id: string
  name: string
  code: string
  color?: string | null
  isActive: boolean
}

export interface FamilyAssignmentSectionProps {
  families: FamilyOption[]
  assignedFamilyIds: string[]
  nativeFamilyId?: string | null
  /** Families outside ADMIN scope — shown with lock icon, checkbox disabled */
  readOnlyFamilyIds?: string[]
  onAssign: (familyId: string) => Promise<void>
  onUnassign: (
    familyId: string
  ) => Promise<{ requiresConfirmation?: boolean; activeTickets?: number } | void>
  isLoading?: boolean
  error?: string | null
}

export function FamilyAssignmentSection({
  families,
  assignedFamilyIds,
  nativeFamilyId,
  readOnlyFamilyIds = [],
  onAssign,
  onUnassign,
  isLoading,
  error,
}: FamilyAssignmentSectionProps) {
  const [savingId, setSavingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const assignedSet = useMemo(() => new Set(assignedFamilyIds), [assignedFamilyIds])
  const readOnlySet = useMemo(() => new Set(readOnlyFamilyIds), [readOnlyFamilyIds])

  const filtered = families.filter(
    f =>
      f.isActive &&
      (search === '' ||
        f.name.toLowerCase().includes(search.toLowerCase()) ||
        f.code.toLowerCase().includes(search.toLowerCase()))
  )

  const handleToggle = async (family: FamilyOption, checked: boolean) => {
    if (savingId) return
    setSavingId(family.id)
    try {
      if (checked) {
        await onAssign(family.id)
      } else {
        await onUnassign(family.id)
      }
    } finally {
      setSavingId(null)
    }
  }

  if (isLoading) {
    return (
      <div className='flex items-center gap-2 py-6 text-sm text-muted-foreground justify-center'>
        <RefreshCw className='h-4 w-4 animate-spin' />
        Cargando familias...
      </div>
    )
  }

  return (
    <div className='space-y-3'>
      <div className='relative'>
        <Search className='absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground' />
        <Input
          placeholder='Buscar familia...'
          value={search}
          onChange={e => setSearch(e.target.value)}
          className='pl-8 h-8 text-sm'
        />
      </div>

      {filtered.length === 0 ? (
        <p className='text-center text-sm text-muted-foreground py-4'>
          {search ? 'Sin resultados' : 'No hay familias activas'}
        </p>
      ) : (
        <div className='space-y-1.5 md:max-h-64 md:overflow-y-auto md:pr-1'>
          {filtered.map(family => {
            const isNative = nativeFamilyId === family.id
            const isReadOnly = readOnlySet.has(family.id)
            const isAssigned = assignedSet.has(family.id) || isNative
            const isSaving = savingId === family.id
            const isDisabled = isSaving || isNative || isReadOnly

            return (
              <div
                key={family.id}
                className={`flex items-center justify-between rounded-lg border px-3 py-2.5 ${
                  isNative ? 'bg-primary/5 border-primary/20' : ''
                }`}
              >
                <div className='flex items-center gap-3'>
                  <Checkbox
                    checked={isAssigned}
                    onCheckedChange={v => !isDisabled && handleToggle(family, !!v)}
                    disabled={isDisabled}
                    className={isDisabled ? 'opacity-60 cursor-not-allowed' : ''}
                  />
                  {family.color && (
                    <div
                      className='w-3 h-3 rounded-full flex-shrink-0'
                      style={{ backgroundColor: family.color }}
                    />
                  )}
                  <div>
                    <p className='text-sm font-medium leading-none'>{family.name}</p>
                    <p className='text-xs text-muted-foreground mt-0.5 font-mono'>{family.code}</p>
                  </div>
                </div>
                <div className='flex items-center gap-2'>
                  {isNative && (
                    <Badge
                      variant='outline'
                      className='text-[10px] px-1.5 py-0 border-primary/30 text-primary bg-primary/5'
                    >
                      Nativa
                    </Badge>
                  )}
                  {isReadOnly && !isNative && (
                    <Lock className='h-3.5 w-3.5 text-muted-foreground' />
                  )}
                  {isSaving && (
                    <RefreshCw className='h-3.5 w-3.5 animate-spin text-muted-foreground' />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {error && <p className='text-sm text-destructive'>{error}</p>}
    </div>
  )
}
