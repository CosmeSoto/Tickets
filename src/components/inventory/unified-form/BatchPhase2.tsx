'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { Wand2, AlertCircle } from 'lucide-react'
import { BatchCommonData, BatchIndividualData } from './BatchForm'
import { CodeGenerator } from './CodeGenerator'

interface BatchPhase2Props {
  quantity: number
  commonData: BatchCommonData
  warehouses: any[]
  onBack: () => void
}

export function BatchPhase2({ quantity, commonData, warehouses, onBack }: BatchPhase2Props) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showCodeGenerator, setShowCodeGenerator] = useState(false)
  const [validationErrors, setValidationErrors] = useState<Record<number, string>>({})

  // Inicializar array de equipos individuales
  const [equipmentData, setEquipmentData] = useState<BatchIndividualData[]>(
    Array.from({ length: quantity }, () => ({
      code: '',
      serialNumber: '',
      physicalLocation: '',
      warehouseId: commonData.warehouseId || '',
    }))
  )

  const updateEquipment = (index: number, field: keyof BatchIndividualData, value: string) => {
    const newData = [...equipmentData]
    newData[index] = { ...newData[index], [field]: value }
    setEquipmentData(newData)

    // Limpiar error de validación al editar
    if (validationErrors[index]) {
      const newErrors = { ...validationErrors }
      delete newErrors[index]
      setValidationErrors(newErrors)
    }
  }

  const handleCodesGenerated = (codes: string[]) => {
    const newData = equipmentData.map((item, index) => ({
      ...item,
      code: codes[index] || item.code,
    }))
    setEquipmentData(newData)
    setShowCodeGenerator(false)
  }

  const validateData = (): boolean => {
    const errors: Record<number, string> = {}
    const codes = new Set<string>()

    equipmentData.forEach((item, index) => {
      // Validar código requerido
      if (!item.code.trim()) {
        errors[index] = 'El código es requerido'
        return
      }

      // Validar código duplicado
      if (codes.has(item.code)) {
        errors[index] = 'Código duplicado'
      } else {
        codes.add(item.code)
      }
    })

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async () => {
    if (!validateData()) {
      toast.error('Por favor corrige los errores en el formulario')
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch('/api/inventory/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commonData,
          equipmentData,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Error al crear lote')
      }

      const result = await response.json()
      toast.success(`Lote creado exitosamente: ${result.batchCode}`)
      router.push(`/inventory/batches/${result.batchId}`)
      router.refresh()
    } catch (error: any) {
      toast.error(error.message || 'Error al crear lote')
      console.error(error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const hasErrors = Object.keys(validationErrors).length > 0
  const allCodesEntered = equipmentData.every(item => item.code.trim())

  return (
    <div className='space-y-6'>
      {/* Resumen de Datos Comunes */}
      <Card>
        <CardHeader>
          <CardTitle>Resumen de Datos Comunes</CardTitle>
        </CardHeader>
        <CardContent className='grid grid-cols-2 md:grid-cols-4 gap-4 text-sm'>
          <div>
            <span className='text-gray-500'>Cantidad:</span>
            <p className='font-semibold'>{quantity} equipos</p>
          </div>
          <div>
            <span className='text-gray-500'>Proveedor:</span>
            <p className='font-semibold'>{commonData.supplierId}</p>
          </div>
          {commonData.condition && (
            <div>
              <span className='text-gray-500'>Condición:</span>
              <p className='font-semibold'>{commonData.condition}</p>
            </div>
          )}
          {commonData.unitPrice && (
            <div>
              <span className='text-gray-500'>Precio Unitario:</span>
              <p className='font-semibold'>${commonData.unitPrice.toFixed(2)}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Generador de Códigos */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center justify-between'>
            <span>Datos Individuales</span>
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={() => setShowCodeGenerator(true)}
              className='flex items-center gap-2'
            >
              <Wand2 className='w-4 h-4' />
              Generar Códigos
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {hasErrors && (
            <div className='mb-4 p-3 bg-red-50 border border-red-200 rounded flex items-start gap-2'>
              <AlertCircle className='w-5 h-5 text-red-600 mt-0.5' />
              <div>
                <p className='font-semibold text-red-800'>Errores de validación</p>
                <p className='text-sm text-red-600'>
                  Hay {Object.keys(validationErrors).length} equipos con errores. Revisa los campos
                  marcados.
                </p>
              </div>
            </div>
          )}

          <div className='overflow-x-auto'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className='w-12'>#</TableHead>
                  <TableHead className='min-w-[200px]'>Código *</TableHead>
                  <TableHead className='min-w-[200px]'>Número de Serie</TableHead>
                  <TableHead className='min-w-[200px]'>Ubicación Física</TableHead>
                  <TableHead className='min-w-[200px]'>Bodega</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {equipmentData.map((item, index) => (
                  <TableRow key={index} className={validationErrors[index] ? 'bg-red-50' : ''}>
                    <TableCell className='font-medium'>{index + 1}</TableCell>
                    <TableCell>
                      <Input
                        value={item.code}
                        onChange={e => updateEquipment(index, 'code', e.target.value)}
                        placeholder='EQ-001'
                        className={validationErrors[index] ? 'border-red-500' : ''}
                      />
                      {validationErrors[index] && (
                        <p className='text-xs text-red-500 mt-1'>{validationErrors[index]}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Input
                        value={item.serialNumber}
                        onChange={e => updateEquipment(index, 'serialNumber', e.target.value)}
                        placeholder='SN123456'
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={item.physicalLocation}
                        onChange={e => updateEquipment(index, 'physicalLocation', e.target.value)}
                        placeholder='Oficina 101'
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={item.warehouseId}
                        onValueChange={value => updateEquipment(index, 'warehouseId', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder='Seleccionar' />
                        </SelectTrigger>
                        <SelectContent>
                          {warehouses.map(wh => (
                            <SelectItem key={wh.id} value={wh.id}>
                              {wh.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Botones de Acción */}
      <div className='flex justify-between'>
        <Button type='button' variant='outline' onClick={onBack}>
          ← Volver
        </Button>
        <Button onClick={handleSubmit} disabled={isSubmitting || !allCodesEntered}>
          {isSubmitting ? 'Creando Lote...' : `Crear Lote (${quantity} equipos)`}
        </Button>
      </div>

      {/* Modal Generador de Códigos */}
      {showCodeGenerator && (
        <CodeGenerator
          quantity={quantity}
          onGenerate={handleCodesGenerated}
          onClose={() => setShowCodeGenerator(false)}
        />
      )}
    </div>
  )
}
