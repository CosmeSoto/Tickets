import { Suspense } from 'react'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { ModelAggregationService } from '@/lib/services/model-aggregation.service'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Laptop, Package, User, List, Clock, BarChart3 } from 'lucide-react'
import Link from 'next/link'
import { Skeleton } from '@/components/ui/skeleton'
import { ModelMetrics } from '@/components/inventory/model/ModelMetrics'
import { AcquisitionTimeline } from '@/components/inventory/model/AcquisitionTimeline'
import { ModelBatchComparison } from '@/components/inventory/model/ModelBatchComparison'
import { ModelEquipmentTable } from '@/components/inventory/model/ModelEquipmentTable'

function LoadingSkeleton() {
  return (
    <div className='container mx-auto py-6 px-4 space-y-6'>
      <Skeleton className='h-10 w-48' />
      <Skeleton className='h-16 w-full' />
      <div className='grid grid-cols-2 md:grid-cols-6 gap-4'>
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className='h-24' />
        ))}
      </div>
      <Skeleton className='h-64 w-full' />
    </div>
  )
}

async function ModelDetailContent({ modelId }: { modelId: string }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/auth/signin')

  const modelData = await ModelAggregationService.getModelDetails(modelId)
  if (!modelData) notFound()

  // Obtener comparación de lotes si hay más de uno
  const batchIds = modelData.batches.map((b: any) => b.id)
  const batchComparisons =
    batchIds.length > 0 ? await ModelAggregationService.compareBatches(modelId, batchIds) : []

  // Enriquecer acquisitionHistory con datos del proveedor
  const enrichedHistory = modelData.acquisitionHistory.map((acq: any) => {
    if (acq.source === 'batch' && acq.batchId) {
      const batch = modelData.batches.find((b: any) => b.id === acq.batchId)
      return {
        ...acq,
        supplier: batch?.supplier?.name,
        unitPrice: batch?.unitPrice,
      }
    }
    return acq
  })

  return (
    <div className='container mx-auto py-6 px-4'>
      {/* Volver */}
      <Link href='/inventory'>
        <Button variant='ghost' size='sm' className='flex items-center gap-2 mb-4 -ml-2'>
          <ArrowLeft className='w-4 h-4' />
          Volver al Inventario
        </Button>
      </Link>

      {/* Header */}
      <div className='flex items-start justify-between mb-6'>
        <div className='flex items-center gap-4'>
          <div className='w-14 h-14 bg-muted rounded-xl flex items-center justify-center'>
            <Laptop className='w-7 h-7 text-muted-foreground' />
          </div>
          <div>
            <h1 className='text-2xl font-bold'>
              {modelData.brand} {modelData.model}
            </h1>
            <div className='flex items-center gap-2 mt-1'>
              <Badge variant='outline'>{modelData.typeName}</Badge>
              {modelData.batchCount > 0 && (
                <span className='text-sm text-muted-foreground flex items-center gap-1'>
                  <Package className='w-3 h-3' /> {modelData.batchCount} lote
                  {modelData.batchCount !== 1 ? 's' : ''}
                </span>
              )}
              {modelData.individualCount > 0 && (
                <span className='text-sm text-muted-foreground flex items-center gap-1'>
                  <User className='w-3 h-3' /> {modelData.individualCount} individual
                  {modelData.individualCount !== 1 ? 'es' : ''}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Métricas */}
      <div className='mb-6'>
        <ModelMetrics
          metrics={{
            total: modelData.total,
            available: modelData.available,
            assigned: modelData.assigned,
            maintenance: modelData.maintenance,
            retired: modelData.retired,
            utilizationRate: modelData.utilizationRate,
            totalValue: modelData.totalValue,
            averagePrice: modelData.averagePrice,
          }}
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue='equipment'>
        <TabsList>
          <TabsTrigger value='equipment' className='flex items-center gap-2'>
            <List className='w-4 h-4' />
            Equipos ({modelData.total})
          </TabsTrigger>
          <TabsTrigger value='acquisitions' className='flex items-center gap-2'>
            <Clock className='w-4 h-4' />
            Adquisiciones ({modelData.acquisitionHistory.length})
          </TabsTrigger>
          {batchIds.length > 0 && (
            <TabsTrigger value='comparison' className='flex items-center gap-2'>
              <BarChart3 className='w-4 h-4' />
              Comparar Lotes ({batchIds.length})
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value='equipment' className='mt-4'>
          <ModelEquipmentTable equipment={modelData.equipment as any} />
        </TabsContent>

        <TabsContent value='acquisitions' className='mt-4'>
          <AcquisitionTimeline acquisitions={enrichedHistory} />
        </TabsContent>

        {batchIds.length > 0 && (
          <TabsContent value='comparison' className='mt-4'>
            <ModelBatchComparison batches={batchComparisons} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}

export default function ModelDetailPage({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <ModelDetailContent modelId={params.id} />
    </Suspense>
  )
}
