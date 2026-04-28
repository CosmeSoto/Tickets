/**
 * Assignment Dialog Component
 */

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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { UserCombobox } from '@/components/ui/user-combobox'
import type { AssignmentForm } from '../utils/equipment-types'

interface AssignmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  equipmentCode: string
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
  form,
  onFormChange,
  onSubmit,
  submitting,
}: AssignmentDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Asignar Equipo</DialogTitle>
          <DialogDescription>
            Asigna el equipo <span className='font-semibold'>{equipmentCode}</span> a un usuario.
          </DialogDescription>
        </DialogHeader>
        <div className='space-y-4 py-2'>
          <div className='space-y-2'>
            <Label>Usuario *</Label>
            <UserCombobox
              value={form.receiverId}
              onValueChange={v => onFormChange({ ...form, receiverId: v })}
              placeholder='Buscar usuario por nombre o email...'
              emptyText='No se encontraron usuarios'
            />
          </div>
          <div className='space-y-2'>
            <Label>Tipo de Asignación *</Label>
            <Select
              value={form.assignmentType}
              onValueChange={v => onFormChange({ ...form, assignmentType: v as any })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='PERMANENT'>Permanente</SelectItem>
                <SelectItem value='TEMPORARY'>Temporal</SelectItem>
                <SelectItem value='LOAN'>Préstamo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className='space-y-2'>
            <Label>Fecha de Inicio *</Label>
            <Input
              type='date'
              value={form.startDate}
              onChange={e => onFormChange({ ...form, startDate: e.target.value })}
            />
          </div>
          {(form.assignmentType === 'TEMPORARY' || form.assignmentType === 'LOAN') && (
            <div className='space-y-2'>
              <Label>Fecha de Fin *</Label>
              <Input
                type='date'
                value={form.endDate}
                onChange={e => onFormChange({ ...form, endDate: e.target.value })}
              />
            </div>
          )}
          <div className='space-y-2'>
            <Label>Observaciones</Label>
            <Textarea
              value={form.observations}
              onChange={e => onFormChange({ ...form, observations: e.target.value })}
              placeholder='Observaciones adicionales...'
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={onSubmit} disabled={submitting}>
            {submitting && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
            Asignar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
