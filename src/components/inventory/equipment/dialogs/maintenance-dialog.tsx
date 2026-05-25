/**
 * Maintenance Dialog Component
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
import { getEquipmentDisplayName } from '@/lib/utils/equipment-display'
import type { MaintenanceForm, EquipmentType, Assignment } from '../utils/equipment-types'

interface MaintenanceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  equipmentCode: string
  equipmentTypeName?: string
  equipmentBrandName?: string
  equipmentModelName?: string
  equipmentType?: EquipmentType
  currentAssignment?: Assignment
  userRole: string
  form: MaintenanceForm
  onFormChange: (form: MaintenanceForm) => void
  onSubmit: () => void
  submitting: boolean
}

export function MaintenanceDialog({
  open,
  onOpenChange,
  equipmentCode,
  equipmentTypeName,
  equipmentBrandName,
  equipmentModelName,
  equipmentType,
  currentAssignment,
  userRole,
  form,
  onFormChange,
  onSubmit,
  submitting,
}: MaintenanceDialogProps) {
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
          <DialogTitle>
            {userRole === 'CLIENT' ? 'Solicitar Mantenimiento' : 'Registrar Mantenimiento'}
          </DialogTitle>
          <DialogDescription>
            {userRole === 'CLIENT'
              ? `Solicita mantenimiento para el equipo ${displayName}. El equipo técnico revisará tu solicitud.`
              : `Registra un mantenimiento para el equipo ${displayName}.`}
            {(equipmentType as any)?.family?.name && (
              <span className='block mt-1 text-xs text-muted-foreground'>
                Familia: <span className='font-medium'>{(equipmentType as any).family.name}</span>
                {equipmentType?.name ? ` · Tipo: ${equipmentType.name}` : ''}
              </span>
            )}
            {userRole !== 'CLIENT' && currentAssignment && (
              <span className='block mt-1 text-amber-600 dark:text-amber-400'>
                El cliente asignado ({currentAssignment.receiver?.name}) será notificado.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className='space-y-4 py-2'>
          <div className='space-y-2'>
            <Label>Tipo de Mantenimiento *</Label>
            <Select
              value={form.type}
              onValueChange={v => onFormChange({ ...form, type: v as any })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='PREVENTIVE'>Preventivo</SelectItem>
                <SelectItem value='CORRECTIVE'>Correctivo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className='space-y-2'>
            <Label>Descripción *</Label>
            <Textarea
              value={form.description}
              onChange={e => onFormChange({ ...form, description: e.target.value })}
              placeholder='Describe el mantenimiento a realizar...'
            />
          </div>
          <div className='space-y-2'>
            <Label>Fecha Programada *</Label>
            <Input
              type='date'
              value={form.scheduledDate}
              onChange={e => onFormChange({ ...form, scheduledDate: e.target.value })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={onSubmit} disabled={submitting}>
            {submitting && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
