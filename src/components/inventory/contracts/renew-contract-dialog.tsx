'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import { Loader2, RefreshCw, Calendar, DollarSign } from 'lucide-react'

interface RenewContractDialogProps {
  contract: {
    id: string
    name: string
    startDate: Date | null
    endDate: Date | null
    totalValue: number | null
    monthlyCost: number | null
    billingCycle: string
    autoRenew: boolean
    renewalNoticeDays: number
    notes: string | null
  }
  open: boolean
  onOpenChange: (open: boolean) => void
  onRenewed?: () => void
}

export function RenewContractDialog({
  contract,
  open,
  onOpenChange,
  onRenewed,
}: RenewContractDialogProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [updateTerms, setUpdateTerms] = useState(false)

  // Calcular fechas sugeridas (1 año desde la fecha de fin actual)
  const suggestedStartDate = contract.endDate
    ? new Date(contract.endDate.getTime() + 24 * 60 * 60 * 1000) // Día siguiente
    : new Date()
  const suggestedEndDate = contract.endDate
    ? new Date(contract.endDate.getTime() + 365 * 24 * 60 * 60 * 1000) // 1 año después
    : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)

  const [formData, setFormData] = useState({
    newStartDate: suggestedStartDate.toISOString().split('T')[0],
    newEndDate: suggestedEndDate.toISOString().split('T')[0],
    totalValue: contract.totalValue?.toString() || '',
    monthlyCost: contract.monthlyCost?.toString() || '',
    billingCycle: contract.billingCycle || 'MONTHLY',
    autoRenew: contract.autoRenew,
    renewalNoticeDays: contract.renewalNoticeDays?.toString() || '30',
    notes: contract.notes || '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const payload: any = {
        newStartDate: formData.newStartDate,
        newEndDate: formData.newEndDate,
      }

      // Solo incluir términos actualizados si el usuario marcó la opción
      if (updateTerms) {
        payload.updateTerms = {
          totalValue: formData.totalValue ? parseFloat(formData.totalValue) : null,
          monthlyCost: formData.monthlyCost ? parseFloat(formData.monthlyCost) : null,
          billingCycle: formData.billingCycle,
          autoRenew: formData.autoRenew,
          renewalNoticeDays: parseInt(formData.renewalNoticeDays),
          notes: formData.notes || null,
        }
      }

      const response = await fetch(`/api/inventory/contracts/${contract.id}/renew`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Error al renovar contrato')
      }

      const renewedContract = await response.json()

      toast.success('Contrato renovado exitosamente', {
        description: `Se ha creado el contrato renovado: ${renewedContract.name}`,
      })

      onOpenChange(false)
      router.refresh()
      onRenewed?.()
    } catch (error) {
      console.error('Error renovando contrato:', error)
      toast.error(error instanceof Error ? error.message : 'Error al renovar contrato')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-2xl max-h-[90vh]'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <RefreshCw className='h-5 w-5' />
            Renovar Contrato
          </DialogTitle>
          <DialogDescription>
            Crear un nuevo contrato vinculado a partir de: <strong>{contract.name}</strong>
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          className='space-y-6 overflow-y-auto max-h-[calc(90vh-120px)]'
        >
          {/* Fechas del nuevo contrato */}
          <div className='space-y-4'>
            <div className='flex items-center gap-2 text-sm font-medium'>
              <Calendar className='h-4 w-4' />
              Período del Nuevo Contrato
            </div>

            <div className='grid grid-cols-2 gap-4'>
              <div className='space-y-2'>
                <Label htmlFor='newStartDate'>Fecha de Inicio *</Label>
                <DateInput
                  id='newStartDate'
                  required
                  value={formData.newStartDate}
                  onChange={e => setFormData({ ...formData, newStartDate: e.target.value })}
                />
              </div>

              <div className='space-y-2'>
                <Label htmlFor='newEndDate'>Fecha de Fin *</Label>
                <DateInput
                  id='newEndDate'
                  required
                  value={formData.newEndDate}
                  onChange={e => setFormData({ ...formData, newEndDate: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Opción de actualizar términos */}
          <div className='flex items-center space-x-2 p-4 bg-muted rounded-lg'>
            <Checkbox
              id='updateTerms'
              checked={updateTerms}
              onCheckedChange={checked => setUpdateTerms(checked as boolean)}
            />
            <Label
              htmlFor='updateTerms'
              className='text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer'
            >
              Actualizar términos del contrato (valores, ciclo de facturación, etc.)
            </Label>
          </div>

          {/* Términos actualizables (solo si está marcado) */}
          {updateTerms && (
            <div className='space-y-4 p-4 border rounded-lg'>
              <div className='flex items-center gap-2 text-sm font-medium'>
                <DollarSign className='h-4 w-4' />
                Términos Económicos
              </div>

              <div className='grid grid-cols-2 gap-4'>
                <div className='space-y-2'>
                  <Label htmlFor='totalValue'>Valor Total</Label>
                  <Input
                    id='totalValue'
                    type='number'
                    step='0.01'
                    placeholder='0.00'
                    value={formData.totalValue}
                    onChange={e => setFormData({ ...formData, totalValue: e.target.value })}
                  />
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='monthlyCost'>Costo Mensual</Label>
                  <Input
                    id='monthlyCost'
                    type='number'
                    step='0.01'
                    placeholder='0.00'
                    value={formData.monthlyCost}
                    onChange={e => setFormData({ ...formData, monthlyCost: e.target.value })}
                  />
                </div>
              </div>

              <div className='space-y-2'>
                <Label htmlFor='billingCycle'>Ciclo de Facturación</Label>
                <Select
                  value={formData.billingCycle}
                  onValueChange={value => setFormData({ ...formData, billingCycle: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='MONTHLY'>Mensual</SelectItem>
                    <SelectItem value='QUARTERLY'>Trimestral</SelectItem>
                    <SelectItem value='BIANNUAL'>Semestral</SelectItem>
                    <SelectItem value='ANNUAL'>Anual</SelectItem>
                    <SelectItem value='ONE_TIME'>Único</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className='space-y-2'>
                <Label htmlFor='renewalNoticeDays'>Días de Aviso de Renovación</Label>
                <Input
                  id='renewalNoticeDays'
                  type='number'
                  min='1'
                  value={formData.renewalNoticeDays}
                  onChange={e => setFormData({ ...formData, renewalNoticeDays: e.target.value })}
                />
              </div>

              <div className='flex items-center space-x-2'>
                <Checkbox
                  id='autoRenew'
                  checked={formData.autoRenew}
                  onCheckedChange={checked =>
                    setFormData({ ...formData, autoRenew: checked as boolean })
                  }
                />
                <Label htmlFor='autoRenew' className='cursor-pointer'>
                  Renovación automática
                </Label>
              </div>

              <div className='space-y-2'>
                <Label htmlFor='notes'>Notas</Label>
                <Textarea
                  id='notes'
                  rows={3}
                  placeholder='Notas adicionales sobre la renovación...'
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type='submit' disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  Renovando...
                </>
              ) : (
                <>
                  <RefreshCw className='mr-2 h-4 w-4' />
                  Renovar Contrato
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
