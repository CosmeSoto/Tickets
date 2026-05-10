'use client'

import { useState } from 'react'
import { BatchPhase1 } from './BatchPhase1'
import { BatchPhase2 } from './BatchPhase2'
import { Button } from '@/components/ui/button'
import { ChevronLeft } from 'lucide-react'

interface BatchFormProps {
  quantity: number
  equipmentTypes: any[]
  departments: any[]
  warehouses: any[]
  suppliers: any[]
  models: any[]
}

export interface BatchCommonData {
  modelId: string
  supplierId: string
  departmentId?: string
  condition?: string
  propertyType?: string
  purchaseDate?: Date
  unitPrice?: number
  invoiceNumber?: string
  purchaseOrderNumber?: string
  warehouseId?: string
  customValues?: Record<string, any>
  accessories?: Array<{ name: string; quantity: number }>
  notes?: string
}

export interface BatchIndividualData {
  code: string
  serialNumber?: string
  physicalLocation?: string
  warehouseId?: string
}

export function BatchForm({
  quantity,
  equipmentTypes,
  departments,
  warehouses,
  suppliers,
  models,
}: BatchFormProps) {
  const [phase, setPhase] = useState<1 | 2>(1)
  const [commonData, setCommonData] = useState<BatchCommonData | null>(null)

  const handlePhase1Complete = (data: BatchCommonData) => {
    setCommonData(data)
    setPhase(2)
  }

  const handleBack = () => {
    setPhase(1)
  }

  return (
    <div className='space-y-4'>
      {/* Indicador de Fase */}
      <div className='bg-white p-4 rounded-lg shadow'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-4'>
            <div
              className={`flex items-center justify-center w-8 h-8 rounded-full ${
                phase === 1 ? 'bg-blue-600 text-white' : 'bg-green-600 text-white'
              }`}
            >
              1
            </div>
            <span className={phase === 1 ? 'font-semibold' : 'text-gray-500'}>Datos Comunes</span>
          </div>

          <div className='flex-1 h-0.5 bg-gray-300 mx-4' />

          <div className='flex items-center gap-4'>
            <div
              className={`flex items-center justify-center w-8 h-8 rounded-full ${
                phase === 2 ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-600'
              }`}
            >
              2
            </div>
            <span className={phase === 2 ? 'font-semibold' : 'text-gray-500'}>
              Datos Individuales ({quantity} equipos)
            </span>
          </div>
        </div>
      </div>

      {/* Botón Volver (solo en fase 2) */}
      {phase === 2 && (
        <Button
          type='button'
          variant='outline'
          onClick={handleBack}
          className='flex items-center gap-2'
        >
          <ChevronLeft className='w-4 h-4' />
          Volver a Datos Comunes
        </Button>
      )}

      {/* Formularios por Fase */}
      {phase === 1 ? (
        <BatchPhase1
          equipmentTypes={equipmentTypes}
          departments={departments}
          warehouses={warehouses}
          suppliers={suppliers}
          models={models}
          onComplete={handlePhase1Complete}
          initialData={commonData}
        />
      ) : (
        <BatchPhase2
          quantity={quantity}
          commonData={commonData!}
          warehouses={warehouses}
          onBack={handleBack}
        />
      )}
    </div>
  )
}
