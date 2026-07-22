'use client'

/**
 * Diálogo para mover un departamento a otra familia/área.
 * Solo cambia familyId (+ sync de categorías en el API). No altera usuarios ni tickets históricos.
 */

import { useEffect, useState } from 'react'
import { ArrowRightLeft, RefreshCw, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { DepartmentData } from '@/hooks/use-departments'

type FamilyOption = {
  id: string
  name: string
  code: string
  color?: string | null
  isActive: boolean
}

interface MoveDepartmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  department: DepartmentData | null
  currentFamilyId: string
  currentFamilyName: string
  onMoved: () => void
  onError?: (message: string) => void
  onSuccess?: (message: string) => void
}

export function MoveDepartmentDialog({
  open,
  onOpenChange,
  department,
  currentFamilyId,
  currentFamilyName,
  onMoved,
  onError,
  onSuccess,
}: MoveDepartmentDialogProps) {
  const [families, setFamilies] = useState<FamilyOption[]>([])
  const [loadingFamilies, setLoadingFamilies] = useState(false)
  const [targetFamilyId, setTargetFamilyId] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) {
      setTargetFamilyId('')
      return
    }

    let cancelled = false
    ;(async () => {
      setLoadingFamilies(true)
      try {
        const res = await fetch('/api/families?includeInactive=true', { cache: 'no-store' })
        const data = await res.json()
        const list: FamilyOption[] = (data.data ?? data.families ?? []).filter(
          (f: FamilyOption) => f.id !== currentFamilyId && f.isActive !== false
        )
        if (!cancelled) setFamilies(list)
      } catch {
        if (!cancelled) setFamilies([])
      } finally {
        if (!cancelled) setLoadingFamilies(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [open, currentFamilyId])

  const handleConfirm = async () => {
    if (!department || !targetFamilyId) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/departments/${department.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ familyId: targetFamilyId }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        onError?.(data.error || data.message || 'No se pudo mover el departamento')
        return
      }
      const targetName = families.find(f => f.id === targetFamilyId)?.name ?? 'la familia destino'
      const synced = data.categoriesSynced ?? 0
      onSuccess?.(
        synced > 0
          ? `"${department.name}" movido a ${targetName}. ${synced} categoría(s) sincronizada(s).`
          : `"${department.name}" movido a ${targetName}.`
      )
      onOpenChange(false)
      onMoved()
    } catch {
      onError?.('Error de conexión al mover el departamento')
    } finally {
      setSubmitting(false)
    }
  }

  const usersCount = department?._count?.users ?? 0
  const catsCount = department?._count?.categories ?? 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-md' aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <ArrowRightLeft className='h-4 w-4' />
            Mover departamento
          </DialogTitle>
          <DialogDescription>
            Reasigna el departamento a otra área/familia del organigrama. Los usuarios del
            departamento se mantienen; las categorías pasan a la familia destino.
          </DialogDescription>
        </DialogHeader>

        {department && (
          <div className='space-y-4 py-2'>
            <div className='rounded-lg border bg-muted/40 px-3 py-2.5 text-sm'>
              <p className='font-medium'>{department.name}</p>
              <p className='text-xs text-muted-foreground mt-0.5'>
                Familia actual: {currentFamilyName}
              </p>
              <p className='text-xs text-muted-foreground mt-1'>
                {usersCount} usuario(s) · {catsCount} categoría(s)
              </p>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='target-family'>Familia destino *</Label>
              <Select
                value={targetFamilyId}
                onValueChange={setTargetFamilyId}
                disabled={loadingFamilies || submitting}
              >
                <SelectTrigger id='target-family'>
                  <SelectValue
                    placeholder={
                      loadingFamilies ? 'Cargando familias…' : 'Seleccionar familia destino'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {families.map(f => (
                    <SelectItem key={f.id} value={f.id}>
                      <span className='flex items-center gap-2'>
                        {f.color && (
                          <span
                            className='inline-block h-2 w-2 rounded-full shrink-0'
                            style={{ backgroundColor: f.color }}
                          />
                        )}
                        {f.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!loadingFamilies && families.length === 0 && (
                <p className='text-xs text-muted-foreground'>
                  No hay otras familias activas disponibles.
                </p>
              )}
            </div>

            <div className='flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-900 dark:text-amber-100'>
              <AlertTriangle className='h-4 w-4 shrink-0 mt-0.5' />
              <div>
                <p className='font-medium'>Restricción</p>
                <p className='mt-0.5 opacity-90'>
                  No se permite el movimiento si hay tickets abiertos o en progreso asociados a
                  categorías de este departamento. Los tickets cerrados conservan su familia
                  histórica.
                </p>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            type='button'
            variant='outline'
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button
            type='button'
            onClick={handleConfirm}
            disabled={submitting || !targetFamilyId || !department}
          >
            {submitting ? (
              <>
                <RefreshCw className='h-4 w-4 mr-2 animate-spin' />
                Moviendo…
              </>
            ) : (
              <>
                <ArrowRightLeft className='h-4 w-4 mr-2' />
                Confirmar movimiento
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
