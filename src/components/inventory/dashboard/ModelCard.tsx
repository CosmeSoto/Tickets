'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Laptop, Package } from 'lucide-react'

interface ModelCardProps {
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
  onClick?: () => void
}

export function ModelCard({
  brand,
  model,
  typeName,
  total,
  available,
  assigned,
  maintenance,
  retired,
  batchCount,
  individualCount,
  onClick,
}: ModelCardProps) {
  const utilizationRate = total > 0 ? (assigned / total) * 100 : 0

  const getUtilizationColor = (rate: number) => {
    if (rate < 70) return 'bg-green-500'
    if (rate < 90) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  return (
    <Card className='cursor-pointer hover:shadow-lg transition-shadow' onClick={onClick}>
      <CardHeader>
        <div className='flex items-start justify-between'>
          <div className='flex items-center gap-3'>
            <div className='w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center'>
              <Laptop className='w-6 h-6 text-gray-600' />
            </div>
            <div>
              <CardTitle className='text-lg'>
                {brand} {model}
              </CardTitle>
              <p className='text-sm text-muted-foreground'>{typeName}</p>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className='space-y-4'>
        <div className='grid grid-cols-3 gap-4 text-center'>
          <div>
            <p className='text-2xl font-bold'>{total}</p>
            <p className='text-xs text-muted-foreground'>Total</p>
          </div>
          <div>
            <p className='text-2xl font-bold text-green-600'>{available}</p>
            <p className='text-xs text-muted-foreground'>Disponibles</p>
          </div>
          <div>
            <p className='text-2xl font-bold text-blue-600'>{assigned}</p>
            <p className='text-xs text-muted-foreground'>Asignados</p>
          </div>
        </div>

        {maintenance > 0 && (
          <div className='text-center'>
            <p className='text-lg font-semibold text-orange-600'>{maintenance}</p>
            <p className='text-xs text-muted-foreground'>En Mantenimiento</p>
          </div>
        )}

        <div className='space-y-2'>
          <div className='flex justify-between text-sm'>
            <span>Tasa de Utilización</span>
            <span className='font-medium'>{utilizationRate.toFixed(1)}%</span>
          </div>
          <Progress value={utilizationRate} className={getUtilizationColor(utilizationRate)} />
        </div>

        {(batchCount > 0 || individualCount > 0) && (
          <div className='pt-2 border-t flex gap-2'>
            {batchCount > 0 && (
              <Badge variant='secondary' className='flex items-center gap-1'>
                <Package className='w-3 h-3' />
                {batchCount} lote(s)
              </Badge>
            )}
            {individualCount > 0 && (
              <Badge variant='outline'>{individualCount} individual(es)</Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
