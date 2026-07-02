'use client'

import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Layers, ExternalLink, CheckCircle, UserCheck } from 'lucide-react'
import { BatchUtilizationAlerts } from '@/components/inventory/batch/BatchUtilizationAlerts'
import type { BatchMetrics } from '@/types/inventory/batch-inventory'

interface EquipmentBatchCardProps {
  batch: {
    id: string
    batchCode: string
    quantity: number
    purchaseDate: Date | string
    unitPrice?: number | null
  }
  batchMetrics?: BatchMetrics | null
}

export function EquipmentBatchCard({ batch, batchMetrics }: EquipmentBatchCardProps) {
  return (
    <Card>
      <CardHeader className='pb-3'>
        <CardTitle className='text-base flex items-center gap-2'>
          <Layers className='h-4 w-4 text-primary' />
          Lote de ingreso
        </CardTitle>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='flex items-start justify-between gap-3'>
          <div>
            <p className='font-mono font-semibold text-lg'>{batch.batchCode}</p>
            <p className='text-sm text-muted-foreground mt-0.5'>
              Ingresado el {format(new Date(batch.purchaseDate), 'dd MMM yyyy', { locale: es })}
              {batch.unitPrice != null && batch.unitPrice > 0 && (
                <span> · ${batch.unitPrice.toFixed(2)} c/u</span>
              )}
            </p>
            <p className='text-xs text-muted-foreground mt-1'>
              Este equipo forma parte de un lote de {batch.quantity} unidad
              {batch.quantity !== 1 ? 'es' : ''}.
            </p>
          </div>
          <Button variant='outline' size='sm' asChild className='shrink-0 gap-1.5'>
            <Link href={`/inventory/batches/${batch.id}`}>
              Ver lote
              <ExternalLink className='h-3.5 w-3.5' />
            </Link>
          </Button>
        </div>

        {batchMetrics && batchMetrics.total > 0 && (
          <>
            <div className='flex flex-wrap gap-4 text-sm'>
              <span className='flex items-center gap-1.5 text-green-600'>
                <CheckCircle className='h-4 w-4' />
                <strong>{batchMetrics.available}</strong> disponibles
              </span>
              <span className='flex items-center gap-1.5 text-blue-600'>
                <UserCheck className='h-4 w-4' />
                <strong>{batchMetrics.assigned}</strong> asignados
              </span>
              <span className='text-muted-foreground'>
                {batchMetrics.utilizationRate.toFixed(0)}% utilización del lote
              </span>
            </div>
            <BatchUtilizationAlerts metrics={batchMetrics} />
          </>
        )}
      </CardContent>
    </Card>
  )
}
