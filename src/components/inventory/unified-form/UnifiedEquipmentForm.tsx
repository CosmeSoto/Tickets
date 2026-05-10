'use client'

import { useState } from 'react'
import { QuantitySelector } from './QuantitySelector'
import { IndividualForm } from './IndividualForm'
import { BatchForm } from './BatchForm'

interface UnifiedEquipmentFormProps {
  equipmentTypes: any[]
  departments: any[]
  warehouses: any[]
  suppliers: any[]
  models: any[]
}

export function UnifiedEquipmentForm({
  equipmentTypes,
  departments,
  warehouses,
  suppliers,
  models,
}: UnifiedEquipmentFormProps) {
  const [quantity, setQuantity] = useState(1)

  return (
    <div className='space-y-6'>
      <div className='bg-white p-6 rounded-lg shadow'>
        <h2 className='text-2xl font-bold mb-4'>Crear Activos</h2>

        <QuantitySelector value={quantity} onChange={setQuantity} min={1} max={100} />
      </div>

      {quantity === 1 ? (
        <IndividualForm
          equipmentTypes={equipmentTypes}
          departments={departments}
          warehouses={warehouses}
          models={models}
        />
      ) : (
        <BatchForm
          quantity={quantity}
          equipmentTypes={equipmentTypes}
          departments={departments}
          warehouses={warehouses}
          suppliers={suppliers}
          models={models}
        />
      )}
    </div>
  )
}
