'use client'

import { ModelCard } from './ModelCard'
import { useRouter } from 'next/navigation'

interface ModelData {
  modelId: string
  brand: string
  model: string
  typeName: string
  total: number
  available: number
  assigned: number
  maintenance: number
  retired: number
  batchCount: number
  individualCount: number
}

interface ModelCardsProps {
  models: ModelData[]
}

export function ModelCards({ models }: ModelCardsProps) {
  const router = useRouter()

  if (models.length === 0) {
    return (
      <div className='text-center py-12'>
        <p className='text-muted-foreground'>No hay modelos registrados</p>
      </div>
    )
  }

  return (
    <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
      {models.map(model => (
        <ModelCard
          key={model.modelId}
          brand={model.brand}
          model={model.model}
          typeName={model.typeName}
          total={model.total}
          available={model.available}
          assigned={model.assigned}
          maintenance={model.maintenance}
          retired={model.retired}
          batchCount={model.batchCount}
          individualCount={model.individualCount}
          onClick={() => router.push(`/inventory/models/${model.modelId}`)}
        />
      ))}
    </div>
  )
}
