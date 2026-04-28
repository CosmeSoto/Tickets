/**
 * Return Dialog Component
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
import type { ReturnForm, Assignment } from '../utils/equipment-types'

interface ReturnDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  equipmentCode: string
  currentAssignment?: Assignment
  form: ReturnForm
  onFormChange: (form: ReturnForm) => void
  onSubmit: () => void
  submitting: boolean
}

export function ReturnDialog({
  open,
  onOpenChange,
  equipmentCode,
  currentAssignment,
  form,
  onFormChange,
  onSubmit,
  submitting,
}: ReturnDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Devolver Equipo</DialogTitle>
          <DialogDescription>
            Registra la devolución del equipo <span className='font-semibold'>{equipmentCode}</span>
            .
            {currentAssignment && (
              <span className='block mt-1'>
                Actualmente asignado a:{' '}
                <span className='font-medium'>{currentAssignment.receiver?.name}</span>
              </span>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className='space-y-4 py-2'>
          <div className='space-y-2'>
            <Label>Fecha de Devolución *</Label>
            <Input
              type='date'
              value={form.returnDate}
              onChange={e => onFormChange({ ...form, returnDate: e.target.value })}
            />
          </div>
          <div className='space-y-2'>
            <Label>Condición al Devolver</Label>
            <Select
              value={form.condition}
              onValueChange={v => onFormChange({ ...form, condition: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder='Sin cambio de condición...' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='NEW'>Nuevo</SelectItem>
                <SelectItem value='LIKE_NEW'>Como Nuevo</SelectItem>
                <SelectItem value='GOOD'>Bueno</SelectItem>
                <SelectItem value='FAIR'>Regular</SelectItem>
                <SelectItem value='POOR'>Malo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className='space-y-2'>
            <Label>Observaciones</Label>
            <Textarea
              value={form.observations}
              onChange={e => onFormChange({ ...form, observations: e.target.value })}
              placeholder='Estado del equipo al momento de la devolución...'
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={onSubmit} disabled={submitting}>
            {submitting && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
            Confirmar Devolución
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
