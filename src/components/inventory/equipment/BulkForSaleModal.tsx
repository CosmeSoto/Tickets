'use client'

/**
 * BulkForSaleModal
 * Modal para marcar múltiples equipos como "En Venta"
 * Permite establecer un precio común o precios individuales
 */

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Loader2, DollarSign } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface Equipment {
  id: string
  code: string
  serialNumber: string
  brand: string
  model: string
}

interface BulkForSaleModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  equipment: Equipment[]
  onSuccess: () => void
}

export function BulkForSaleModal({
  open,
  onOpenChange,
  equipment,
  onSuccess,
}: BulkForSaleModalProps) {
  const { toast } = useToast()
  const [submitting, setSubmitting] = useState(false)
  const [commonPrice, setCommonPrice] = useState<number>(0)
  const [individualPrices, setIndividualPrices] = useState<Record<string, number>>({})
  const [useIndividualPrices, setUseIndividualPrices] = useState(false)

  const handleSubmit = async () => {
    // Validar que haya precio común o precios individuales
    if (!useIndividualPrices && (!commonPrice || commonPrice <= 0)) {
      toast({
        title: 'Precio inválido',
        description: 'Debes establecer un precio común válido',
        variant: 'destructive',
      })
      return
    }

    if (useIndividualPrices) {
      const missingPrices = equipment.filter(
        eq => !individualPrices[eq.id] || individualPrices[eq.id] <= 0
      )
      if (missingPrices.length > 0) {
        toast({
          title: 'Precios incompletos',
          description: `Faltan precios para ${missingPrices.length} equipos`,
          variant: 'destructive',
        })
        return
      }
    }

    setSubmitting(true)

    try {
      const response = await fetch('/api/inventory/equipment/bulk-actions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          equipmentIds: equipment.map(eq => eq.id),
          action: 'FOR_SALE',
          salePrice: useIndividualPrices ? undefined : commonPrice,
          individualPrices: useIndividualPrices ? individualPrices : undefined,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Error al marcar equipos en venta')
      }

      const result = await response.json()

      toast({
        title: 'Equipos marcados en venta',
        description: `Se marcaron ${result.updatedCount} equipos como "En Venta"`,
      })

      onSuccess()
      onOpenChange(false)
    } catch (err: any) {
      console.error('Error:', err)
      toast({
        title: 'Error',
        description: err.message || 'Error desconocido',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-4xl max-h-[90vh]'>
        <DialogHeader>
          <DialogTitle>Marcar Equipos en Venta</DialogTitle>
          <DialogDescription>
            Establece el precio de venta para {equipment.length} equipos seleccionados
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-6 overflow-y-auto max-h-[calc(90vh-120px)]'>
          {/* Precio Común */}
          <div className='space-y-2'>
            <div className='flex items-center gap-2'>
              <input
                type='checkbox'
                id='useCommonPrice'
                checked={!useIndividualPrices}
                onChange={e => setUseIndividualPrices(!e.target.checked)}
                className='h-4 w-4'
              />
              <Label htmlFor='useCommonPrice'>Usar precio común para todos</Label>
            </div>

            {!useIndividualPrices && (
              <div className='flex items-center gap-2'>
                <DollarSign className='h-5 w-5 text-gray-400' />
                <Input
                  type='number'
                  step='0.01'
                  min={0}
                  value={commonPrice || ''}
                  onChange={e => setCommonPrice(parseFloat(e.target.value) || 0)}
                  placeholder='Ej: 1500.00'
                  className='flex-1'
                />
              </div>
            )}
          </div>

          {/* Precios Individuales */}
          {useIndividualPrices && (
            <div className='space-y-2'>
              <Label>Precios Individuales</Label>
              <div className='border rounded-md max-h-96 overflow-y-auto'>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Marca / Modelo</TableHead>
                      <TableHead>Serial</TableHead>
                      <TableHead className='w-48'>Precio</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {equipment.map(eq => (
                      <TableRow key={eq.id}>
                        <TableCell className='font-mono text-sm'>{eq.code}</TableCell>
                        <TableCell>
                          {eq.brand} {eq.model}
                        </TableCell>
                        <TableCell className='text-sm text-gray-600'>{eq.serialNumber}</TableCell>
                        <TableCell>
                          <Input
                            type='number'
                            step='0.01'
                            min={0}
                            value={individualPrices[eq.id] || ''}
                            onChange={e =>
                              setIndividualPrices(prev => ({
                                ...prev,
                                [eq.id]: parseFloat(e.target.value) || 0,
                              }))
                            }
                            placeholder='0.00'
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Resumen */}
          <div className='bg-gray-50 p-4 rounded-md'>
            <h4 className='font-semibold mb-2'>Resumen</h4>
            <ul className='text-sm space-y-1'>
              <li>Equipos seleccionados: {equipment.length}</li>
              {!useIndividualPrices && commonPrice > 0 && (
                <>
                  <li>Precio unitario: ${commonPrice.toLocaleString()}</li>
                  <li>
                    Valor total estimado: ${(commonPrice * equipment.length).toLocaleString()}
                  </li>
                </>
              )}
              {useIndividualPrices && (
                <li>
                  Valor total estimado: $
                  {Object.values(individualPrices)
                    .reduce((sum, price) => sum + price, 0)
                    .toLocaleString()}
                </li>
              )}
            </ul>
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
          <Button type='button' onClick={handleSubmit} disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                Procesando...
              </>
            ) : (
              'Marcar en Venta'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
