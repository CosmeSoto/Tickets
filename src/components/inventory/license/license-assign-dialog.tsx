'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { SimpleSelect } from '@/components/ui/simple-select'
import { SearchableSelect, type SearchableSelectOption } from '@/components/ui/searchable-select'
import { AssignableUserSelect } from '@/components/inventory/shared/AssignableUserSelect'
import { useActiveDepartments } from '@/contexts/departments-context'
import { useFetch } from '@/hooks/common/use-fetch'
import { Loader2, UserCheck } from 'lucide-react'

type Scope = 'Individual' | 'Departamento' | 'Empresa'

type LicenseAssignDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  licenseId: string
  licenseName: string
  familyId?: string | null
  /** Contrato vinculado a esta licencia, si existe — habilita el atajo de responsable. */
  contractId?: string | null
  currentScope?: string | null
  currentUserId?: string | null
  /** Nombre/email del usuario ya asignado (license.user) — evita que el campo se vea vacío. */
  currentUser?: { id: string; name: string; email: string } | null
  currentDepartmentId?: string | null
  currentEquipmentId?: string | null
  onAssigned: () => void
}

const SCOPE_FROM_API: Record<string, Scope> = {
  INDIVIDUAL: 'Individual',
  DEPARTMENT: 'Departamento',
  COMPANY: 'Empresa',
  Individual: 'Individual',
  Departamento: 'Departamento',
  Empresa: 'Empresa',
}

export function LicenseAssignDialog({
  open,
  onOpenChange,
  licenseId,
  licenseName,
  familyId,
  contractId,
  currentScope,
  currentUserId,
  currentUser,
  currentDepartmentId,
  currentEquipmentId,
  onAssigned,
}: LicenseAssignDialogProps) {
  const [scope, setScope] = useState<Scope>('Individual')
  const [userId, setUserId] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [equipmentId, setEquipmentId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { departments: rawDepartments } = useActiveDepartments()
  const departments: SearchableSelectOption[] = useMemo(
    () => rawDepartments.map(d => ({ id: d.id, name: d.name })),
    [rawDepartments]
  )

  const { data: equipmentRows, loading: loadingEquipment } = useFetch<{
    id: string
    code?: string
    name?: string
    brand?: string
    title?: string
  }>(
    familyId
      ? `/api/inventory/assets?familyId=${familyId}&subtype=EQUIPMENT&pageSize=100`
      : '/api/inventory/assets?subtype=EQUIPMENT&pageSize=100',
    {
      enabled: open && scope === 'Individual' && !!familyId,
      transform: d => d.items ?? d.assets ?? [],
      showErrorToast: false,
    }
  )

  const equipmentOptions: SearchableSelectOption[] = useMemo(
    () =>
      equipmentRows.map(e => ({
        id: e.id,
        name: [e.code, e.brand || e.name || e.title].filter(Boolean).join(' · ') || e.id,
      })),
    [equipmentRows]
  )

  // Responsable ya asignado en el contrato vinculado (contract_assignments) — atajo para
  // no volver a buscarlo en la lista completa cuando coincide con quien usará la licencia.
  const { data: contractAssignments } = useFetch<{
    id: string
    client: { id: string; name: string; email: string }
  }>(contractId ? `/api/inventory/contracts/${contractId}/assignments` : '', {
    enabled: open && scope === 'Individual' && !!contractId,
    transform: d => (d.active ? [d.active] : []),
    showErrorToast: false,
  })
  const contractResponsible = contractAssignments[0]?.client ?? null

  useEffect(() => {
    if (!open) return
    setError(null)
    setScope(SCOPE_FROM_API[String(currentScope ?? '')] ?? 'Individual')
    setUserId(currentUserId ?? '')
    setDepartmentId(currentDepartmentId ?? '')
    setEquipmentId(currentEquipmentId ?? '')
  }, [open, currentScope, currentUserId, currentDepartmentId, currentEquipmentId])

  const handleSubmit = async () => {
    setError(null)
    if (scope === 'Individual' && !userId && !equipmentId) {
      setError('Asigna un usuario o un equipo (no ambos).')
      return
    }
    if (scope === 'Individual' && userId && equipmentId) {
      setError('Una licencia individual no puede ir a usuario y equipo a la vez.')
      return
    }
    if (scope === 'Departamento' && !departmentId) {
      setError('Selecciona un departamento.')
      return
    }

    setSubmitting(true)
    try {
      const scopeMap = {
        Individual: 'INDIVIDUAL',
        Departamento: 'DEPARTMENT',
        Empresa: 'COMPANY',
      } as const

      // Actualizar alcance si cambió
      const putRes = await fetch(`/api/inventory/licenses/${licenseId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope,
          licenseScope: scopeMap[scope],
        }),
      })
      if (!putRes.ok) {
        const j = await putRes.json().catch(() => ({}))
        throw new Error(j.error || 'No se pudo actualizar el alcance')
      }

      const assignBody =
        scope === 'Empresa'
          ? { action: 'unassign' as const }
          : {
              assignedToUser: scope === 'Individual' ? userId || null : null,
              assignedToEquipment: scope === 'Individual' ? equipmentId || null : null,
              assignedToDepartment: scope === 'Departamento' ? departmentId || null : null,
            }

      const res = await fetch(`/api/inventory/licenses/${licenseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(assignBody),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'No se pudo asignar la licencia')
      }

      onAssigned()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado')
    } finally {
      setSubmitting(false)
    }
  }

  const handleUnassign = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/inventory/licenses/${licenseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unassign' }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'No se pudo desasignar')
      }
      onAssigned()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>
            {currentUserId || currentDepartmentId || currentEquipmentId
              ? 'Cambiar asignación'
              : 'Asignar licencia'}
          </DialogTitle>
          <DialogDescription>
            {currentUserId || currentDepartmentId || currentEquipmentId ? (
              <>
                <span className='font-medium text-foreground'>{licenseName}</span> ya está asignada.
                Cambia el alcance o el destinatario, o usa «Desasignar» para quitarla.
              </>
            ) : (
              <>
                Asigna <span className='font-medium text-foreground'>{licenseName}</span> según el
                alcance. El área queda fijada por el tipo de licencia (inventario).
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4 py-1'>
          <div className='space-y-1.5'>
            <Label>Alcance</Label>
            <SimpleSelect value={scope} onChange={e => setScope(e.target.value as Scope)}>
              <option value='Individual'>Individual (usuario o equipo)</option>
              <option value='Departamento'>Departamento</option>
              <option value='Empresa'>Empresa (sin usuario/equipo)</option>
            </SimpleSelect>
          </div>

          {scope === 'Individual' && (
            <>
              {contractResponsible && contractResponsible.id !== userId && (
                <button
                  type='button'
                  onClick={() => {
                    setUserId(contractResponsible.id)
                    setEquipmentId('')
                  }}
                  className='flex w-full items-center gap-2 rounded-md border border-dashed px-3 py-2 text-left text-xs hover:bg-muted/50 transition-colors'
                >
                  <UserCheck className='h-3.5 w-3.5 text-primary shrink-0' />
                  <span>
                    Usar el mismo responsable del contrato:{' '}
                    <span className='font-medium text-foreground'>{contractResponsible.name}</span>
                  </span>
                </button>
              )}
              <AssignableUserSelect
                familyId={familyId ?? undefined}
                value={userId}
                onChange={id => {
                  setUserId(id)
                  if (id) setEquipmentId('')
                }}
                label='Usuario'
                initialUser={currentUser ?? null}
              />
              <div className='space-y-1.5'>
                <Label>O equipo (alternativa)</Label>
                {loadingEquipment ? (
                  <div className='flex items-center gap-2 text-sm text-muted-foreground py-2'>
                    <Loader2 className='h-4 w-4 animate-spin' />
                    Cargando equipos del área…
                  </div>
                ) : (
                  <SearchableSelect
                    options={equipmentOptions}
                    value={equipmentId}
                    onChange={v => {
                      setEquipmentId(v)
                      if (v) setUserId('')
                    }}
                    placeholder='Buscar equipo del área…'
                    emptyLabel='Sin equipo'
                  />
                )}
                <p className='text-xs text-muted-foreground'>
                  Elige usuario o equipo, no ambos. Solo equipos del área de la licencia.
                </p>
              </div>
            </>
          )}

          {scope === 'Departamento' && (
            <div className='space-y-1.5'>
              <Label>Departamento</Label>
              <SearchableSelect
                options={departments}
                value={departmentId}
                onChange={setDepartmentId}
                placeholder='Buscar departamento…'
              />
            </div>
          )}

          {scope === 'Empresa' && (
            <p className='text-sm text-muted-foreground rounded-md border bg-muted/30 px-3 py-2'>
              Alcance empresa: se quita la asignación a usuario, equipo o departamento.
            </p>
          )}

          {error && <p className='text-sm text-destructive'>{error}</p>}
        </div>

        <DialogFooter className='gap-2 sm:gap-2 flex-wrap'>
          {(currentUserId || currentDepartmentId || currentEquipmentId) && (
            <Button
              type='button'
              variant='ghost'
              disabled={submitting}
              onClick={() => void handleUnassign()}
              className='mr-auto'
            >
              Desasignar
            </Button>
          )}
          <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type='button' disabled={submitting} onClick={() => void handleSubmit()}>
            {submitting ? (
              <>
                <Loader2 className='h-4 w-4 mr-1.5 animate-spin' />
                Guardando…
              </>
            ) : (
              'Guardar asignación'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
