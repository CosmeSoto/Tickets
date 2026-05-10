'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Package, Calendar, DollarSign, TrendingUp } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface BatchData {
  id: string
  batchCode: string
  description?: string | null
  modelBrand: string
  modelName: string
  quantity: number
  supplierName: string
  purchaseDate: Date
  unitPrice: number
  totalPrice: number
  metrics: {
    available: number
    assigned: number
    utilizationRate: number
  }
}

interface BatchListProps {
  batches: BatchData[]
}

export function BatchList({ batches }: BatchListProps) {
  const router = useRouter()

  if (batches.length === 0) {
    return (
      <div className='text-center py-12'>
        <p className='text-muted-foreground'>No hay lotes registrados</p>
      </div>
    )
  }

  return (
    <div className='space-y-4'>
      {batches.map(batch => (
        <Card
          key={batch.id}
          className='cursor-pointer hover:shadow-md transition-shadow'
          onClick={() => router.push(`/inventory/batches/${batch.id}`)}
        >
          <CardContent className='p-6'>
            <div className='flex items-start justify-between'>
              <div className='flex-1'>
                <div className='flex items-center gap-3 mb-2'>
                  <Package className='w-5 h-5 text-blue-600' />
                  <h3 className='text-lg font-semibold'>{batch.batchCode}</h3>
                  <Badge variant='secondary'>{batch.quantity} equipos</Badge>
                </div>

                <p className='text-sm text-muted-foreground mb-3'>
                  {batch.modelBrand} {batch.modelName}
                </p>

                <div className='grid grid-cols-2 md:grid-cols-4 gap-4 text-sm'>
                  <div className='flex items-center gap-2'>
                    <Calendar className='w-4 h-4 text-gray-500' />
                    <span>{format(new Date(batch.purchaseDate), 'PP', { locale: es })}</span>
                  </div>

                  <div className='flex items-center gap-2'>
                    <DollarSign className='w-4 h-4 text-gray-500' />
                    <span>${batch.unitPrice.toFixed(2)} c/u</span>
                  </div>

                  <div className='flex items-center gap-2'>
                    <TrendingUp className='w-4 h-4 text-gray-500' />
                    <span>{batch.metrics.utilizationRate.toFixed(1)}% utilización</span>
                  </div>

                  <div>
                    <span className='text-green-600 font-medium'>
                      {batch.metrics.available} disponibles
                    </span>
                  </div>
                </div>

                {batch.description && (
                  <p className='text-sm text-muted-foreground mt-3'>{batch.description}</p>
                )}
              </div>

              <Button variant='ghost' size='sm'>
                Ver Detalles →
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
