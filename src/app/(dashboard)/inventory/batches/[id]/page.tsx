import { Suspense } from 'react'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { BatchService } from '@/lib/services/batch-inventory.service'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ArrowLeft,
  Package,
  Calendar,
  DollarSign,
  Building2,
  Warehouse,
  FileText,
  List,
  Clock,
} from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Skeleton } from '@/components/ui/skeleton'
import { BatchMetrics } from '@/components/inventory/batch/BatchMetrics'
import { BatchEquipmentList } from '@/components/inventory/batch/BatchEquipmentList'
import { BatchHistory } from '@/components/inventory/batch/BatchHistory'
import { DeleteBatchButton } from '@/components/inventory/batch/DeleteBatchButton'
import {
  getHomePathForRole,
  loginPathWithReturnTo,
  canAccessInventory,
} from '@/lib/navigation/role-home-path'

async function getBatchData(batchId: string) {
  const [details, history] = await Promise.all([
    BatchService.getDetails(batchId),
    BatchService.getHistory(batchId),
  ])
  return { details, history }
}

function LoadingSkeleton() {
  return (
    <div className='container mx-auto py-6 px-4 space-y-6'>
      <Skeleton className='h-10 w-48' />
      <Skeleton className='h-16 w-full' />
      <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className='h-28' />
        ))}
      </div>
      <Skeleton className='h-64 w-full' />
    </div>
  )
}

async function BatchDetailContent({ batchId }: { batchId: string }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect(loginPathWithReturnTo(`/inventory/batches/${batchId}`))
  if (!canAccessInventory(session.user)) {
    redirect(getHomePathForRole(session.user.role))
  }

  let batchData
  try {
    batchData = await getBatchData(batchId)
  } catch {
    notFound()
  }

  const { details: batch, history } = batchData

  return (
    <div className='container mx-auto py-6 px-4'>
      {/* Breadcrumb / Volver */}
      <Link href='/inventory'>
        <Button variant='ghost' size='sm' className='flex items-center gap-2 mb-4 -ml-2'>
          <ArrowLeft className='w-4 h-4' />
          Volver al Inventario
        </Button>
      </Link>

      {/* Header */}
      <div className='flex items-start justify-between mb-6'>
        <div>
          <div className='flex items-center gap-3 mb-1'>
            <Package className='w-7 h-7 text-blue-600' />
            <h1 className='text-2xl font-bold'>{batch.batchCode}</h1>
            <Badge variant='secondary'>{batch.quantity} equipos</Badge>
          </div>
          <p className='text-muted-foreground ml-10'>
            {batch.model.brand} {batch.model.model} · {batch.model.type?.name}
          </p>
        </div>
        <DeleteBatchButton batchId={batch.id} batchCode={batch.batchCode} />
      </div>

      {/* Métricas */}
      <div className='mb-6'>
        <BatchMetrics metrics={batch.metrics} />
      </div>

      {/* Info del lote */}
      <Card className='mb-6'>
        <CardHeader>
          <CardTitle className='text-base flex items-center gap-2'>
            <FileText className='w-4 h-4' />
            Información del Lote
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'>
            <div className='flex items-center gap-3'>
              <Calendar className='w-4 h-4 text-muted-foreground shrink-0' />
              <div>
                <p className='text-xs text-muted-foreground'>Fecha de Compra</p>
                <p className='font-medium text-sm'>
                  {format(new Date(batch.purchaseDate), 'PPP', { locale: es })}
                </p>
              </div>
            </div>

            <div className='flex items-center gap-3'>
              <DollarSign className='w-4 h-4 text-muted-foreground shrink-0' />
              <div>
                <p className='text-xs text-muted-foreground'>Precio Unitario / Total</p>
                <p className='font-medium text-sm'>
                  ${batch.unitPrice.toFixed(2)} / ${batch.totalPrice.toFixed(2)}
                </p>
              </div>
            </div>

            <div className='flex items-center gap-3'>
              <Building2 className='w-4 h-4 text-muted-foreground shrink-0' />
              <div>
                <p className='text-xs text-muted-foreground'>Proveedor</p>
                <p className='font-medium text-sm'>{batch.supplier?.name || '—'}</p>
              </div>
            </div>

            {batch.department && (
              <div className='flex items-center gap-3'>
                <Building2 className='w-4 h-4 text-muted-foreground shrink-0' />
                <div>
                  <p className='text-xs text-muted-foreground'>Departamento</p>
                  <p className='font-medium text-sm'>{batch.department.name}</p>
                </div>
              </div>
            )}

            {batch.invoiceNumber && (
              <div>
                <p className='text-xs text-muted-foreground'>Nº Factura</p>
                <p className='font-medium text-sm font-mono'>{batch.invoiceNumber}</p>
              </div>
            )}

            {batch.purchaseOrderNumber && (
              <div>
                <p className='text-xs text-muted-foreground'>Orden de Compra</p>
                <p className='font-medium text-sm font-mono'>{batch.purchaseOrderNumber}</p>
              </div>
            )}

            {batch.condition && (
              <div>
                <p className='text-xs text-muted-foreground'>Condición</p>
                <p className='font-medium text-sm'>{batch.condition}</p>
              </div>
            )}

            {batch.notes && (
              <div className='sm:col-span-2 lg:col-span-3'>
                <p className='text-xs text-muted-foreground'>Notas</p>
                <p className='text-sm'>{batch.notes}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabs: Equipos / Historial */}
      <Tabs defaultValue='equipment'>
        <TabsList>
          <TabsTrigger value='equipment' className='flex items-center gap-2'>
            <List className='w-4 h-4' />
            Equipos ({batch.equipment.length})
          </TabsTrigger>
          <TabsTrigger value='history' className='flex items-center gap-2'>
            <Clock className='w-4 h-4' />
            Historial
          </TabsTrigger>
        </TabsList>

        <TabsContent value='equipment' className='mt-4'>
          <BatchEquipmentList equipment={batch.equipment as any} />
        </TabsContent>

        <TabsContent value='history' className='mt-4'>
          <BatchHistory history={history as any} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default function BatchDetailPage({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <BatchDetailContent batchId={params.id} />
    </Suspense>
  )
}
