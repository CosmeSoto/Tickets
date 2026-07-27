'use client'

import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { DateInput } from '@/components/ui/date-input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AssignableUserSelect } from '@/components/inventory/shared/AssignableUserSelect'
import { getEquipmentDisplayName } from '@/lib/utils/equipment-display'
import type { AssignmentForm } from '../utils/equipment-types'

interface AssignmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  equipmentCode: string
  equipmentTypeName?: string
  equipmentBrandName?: string
  equipmentModelName?: string
  /** familyId del equipo — filtra los usuarios asignables */
  familyId?: string
  form: AssignmentForm
  onFormChange: (form: AssignmentForm) => void
  onSubmit: () => void
  submitting: boolean
  accessories: string[]
}

export function AssignmentDialog({
  open,
  onOpenChange,
  equipmentCode,
  equipmentTypeName,
  equipmentBrandName,
  equipmentModelName,
  familyId,
  form,
  onFormChange,
  onSubmit,
  submitting,
}: AssignmentDialogProps) {
  const displayName = getEquipmentDisplayName({
    equipmentCode,
    equipmentTypeName,
    equipmentBrandName,
    equipmentModelName,
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Asignar Equipo</DialogTitle>
          <DialogDescription>
            Asigna el equipo <span className='font-semibold'>{displayName}</span> a un usuario.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={e => {
            e.preventDefault()
            onSubmit()
          }}
        >
          <div className='space-y-4 py-2'>
            {/* Selector de usuario con departamento auto-rellenado */}
            <AssignableUserSelect
              familyId={familyId}
              value={form.receiverId}
              onChange={userId => onFormChange({ ...form, receiverId: userId })}
              required
            />

            {/* Tipo de asignación */}
            <div className='space-y-2'>
              <Label>
                Tipo de Asignación <span className='text-destructive'>*</span>
              </Label>
              <Select
                value={form.assignmentType}
                onValueChange={v => onFormChange({ ...form, assignmentType: v as any })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='PERMANENT'>
                    <div className='flex flex-col'>
                      <span>Permanente</span>
                      <span className='text-xs text-muted-foreground font-normal'>
                        Herramienta de trabajo habitual — sin fecha de devolución
                      </span>
                    </div>
                  </SelectItem>
                  <SelectItem value='TEMPORARY'>
                    <div className='flex flex-col'>
                      <span>Temporal</span>
                      <span className='text-xs text-muted-foreground font-normal'>
                        Uso por período definido — fecha de devolución
                      </span>
                    </div>
                  </SelectItem>
                  <SelectItem value='LOAN'>
                    <div className='flex flex-col'>
                      <span>Préstamo externo</span>
                      <span className='text-xs text-muted-foreground font-normal'>
                        Equipo prestado a tercero o de tercero — fecha de devolución
                      </span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Fecha de inicio */}
            <div className='space-y-2'>
              <Label>
                Fecha de Inicio <span className='text-destructive'>*</span>
              </Label>
              <DateInput
                value={form.startDate}
                onChange={e => onFormChange({ ...form, startDate: e.target.value })}
              />
            </div>

            {/* Fecha de fin — solo temporal y préstamo, opcional */}
            {(form.assignmentType === 'TEMPORARY' || form.assignmentType === 'LOAN') && (
              <div className='space-y-2'>
                <Label>
                  Fecha de Devolución{' '}
                  <span className='text-xs text-muted-foreground font-normal'>(opcional)</span>
                </Label>
                <DateInput
                  value={form.endDate}
                  onChange={e => onFormChange({ ...form, endDate: e.target.value })}
                  clearable
                />
                <p className='text-xs text-muted-foreground'>
                  Si no se conoce la fecha, puede dejarse vacía y actualizarse después.
                </p>
              </div>
            )}

            {/* Observaciones */}
            <div className='space-y-2'>
              <Label>Observaciones</Label>
              <Textarea
                value={form.observations}
                onChange={e => onFormChange({ ...form, observations: e.target.value })}
                placeholder='Observaciones adicionales...'
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button type='submit' disabled={submitting || !form.receiverId}>
              {submitting && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
              Asignar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
