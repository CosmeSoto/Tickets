import { Package, User } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

interface AcquisitionRecord {
  date: Date
  quantity: number
  source: 'batch' | 'individual'
  batchId?: string
  supplier?: string
  unitPrice?: number
}

interface AcquisitionTimelineProps {
  acquisitions: AcquisitionRecord[]
}

export function AcquisitionTimeline({ acquisitions }: AcquisitionTimelineProps) {
  if (acquisitions.length === 0) {
    return (
      <div className='text-center py-8 text-muted-foreground'>No hay registros de adquisición</div>
    )
  }

  const sorted = [...acquisitions].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )

  const totalInvested = acquisitions.reduce((sum, a) => sum + (a.unitPrice || 0) * a.quantity, 0)

  const totalUnits = acquisitions.reduce((sum, a) => sum + a.quantity, 0)

  return (
    <div className='space-y-6'>
      {/* Resumen */}
      <div className='grid grid-cols-2 md:grid-cols-3 gap-4'>
        <Card>
          <CardContent className='pt-4'>
            <p className='text-xs text-muted-foreground'>Total Adquisiciones</p>
            <p className='text-2xl font-bold'>{acquisitions.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className='pt-4'>
            <p className='text-xs text-muted-foreground'>Unidades Adquiridas</p>
            <p className='text-2xl font-bold'>{totalUnits}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className='pt-4'>
            <p className='text-xs text-muted-foreground'>Total Invertido</p>
            <p className='text-2xl font-bold'>
              ${totalInvested.toLocaleString('es', { maximumFractionDigits: 0 })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Timeline */}
      <div className='relative'>
        <div className='absolute left-5 top-0 bottom-0 w-0.5 bg-border' />
        <div className='space-y-4'>
          {sorted.map((record, idx) => {
            const isBatch = record.source === 'batch'
            const Icon = isBatch ? Package : User
            const iconColor = isBatch ? 'text-blue-600 bg-blue-100' : 'text-green-600 bg-green-100'

            return (
              <div key={idx} className='relative flex gap-4 pl-12'>
                <div
                  className={`absolute left-0 w-10 h-10 rounded-full flex items-center justify-center ${iconColor}`}
                >
                  <Icon className='w-5 h-5' />
                </div>

                <div className='flex-1 border rounded-lg p-4 bg-card hover:bg-muted/30 transition-colors'>
                  <div className='flex items-start justify-between gap-2'>
                    <div>
                      <div className='flex items-center gap-2 mb-1'>
                        <Badge variant={isBatch ? 'default' : 'secondary'}>
                          {isBatch ? 'Lote' : 'Individual'}
                        </Badge>
                        <span className='font-semibold'>
                          {record.quantity} unidad{record.quantity !== 1 ? 'es' : ''}
                        </span>
                      </div>
                      {record.supplier && (
                        <p className='text-sm text-muted-foreground'>
                          Proveedor: {record.supplier}
                        </p>
                      )}
                      {record.unitPrice && record.unitPrice > 0 && (
                        <p className='text-sm text-muted-foreground'>
                          ${record.unitPrice.toFixed(2)} c/u · Total: $
                          {(record.unitPrice * record.quantity).toFixed(2)}
                        </p>
                      )}
                    </div>
                    <div className='text-right shrink-0'>
                      <p className='text-sm font-medium'>
                        {format(new Date(record.date), 'dd MMM yyyy', { locale: es })}
                      </p>
                      {record.batchId && (
                        <Link
                          href={`/inventory/batches/${record.batchId}`}
                          className='text-xs text-blue-600 hover:underline'
                        >
                          Ver lote →
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
