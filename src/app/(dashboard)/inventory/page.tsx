import { Suspense } from 'react'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import Link from 'next/link'
import { InventoryTabs } from '@/components/inventory/dashboard/InventoryTabs'
import { ModelCards } from '@/components/inventory/dashboard/ModelCards'
import { BatchList } from '@/components/inventory/dashboard/BatchList'
import { ModelAggregationService } from '@/lib/services/model-aggregation.service'
import { BatchService } from '@/lib/services/batch-inventory.service'
import { EquipmentService } from '@/lib/services/equipment-inventory.service'
import { Skeleton } from '@/components/ui/skeleton'
import { InventoryFiltersClient } from '@/components/inventory/filters/InventoryFiltersClient'
import { prisma } from '@/lib/prisma'

interface SearchParams {
  search?: string
  typeId?: string
  departmentId?: string
  status?: string
}

async function getInventoryData(filters: SearchParams) {
  const [models, batches, allEquipment, types, departments] = await Promise.all([
    ModelAggregationService.getAllModels({
      search: filters.search,
      typeId: filters.typeId,
      departmentId: filters.departmentId,
    }),
    BatchService.getAll({
      typeId: filters.typeId,
      departmentId: filters.departmentId,
    }),
    EquipmentService.getPaginated(1, 50, {
      search: filters.search,
      typeId: filters.typeId,
      departmentId: filters.departmentId,
      status: filters.status,
    }),
    prisma.equipment_types.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    }),
    prisma.departments.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    }),
  ])

  return { models, batches, allEquipment, types, departments }
}

function LoadingSkeleton() {
  return (
    <div className='space-y-6'>
      <Skeleton className='h-12 w-full' />
      <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
        <Skeleton className='h-64' />
        <Skeleton className='h-64' />
        <Skeleton className='h-64' />
      </div>
    </div>
  )
}

async function InventoryContent({ searchParams }: { searchParams: SearchParams }) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect('/auth/signin')
  }

  if (!session.user.inventoryEnabled && !session.user.canManageInventory) {
    redirect('/dashboard')
  }

  const { models, batches, allEquipment, types, departments } = await getInventoryData(searchParams)

  // Transformar datos para componentes
  const modelData = models.map(m => ({
    modelId: m.modelId,
    brand: m.brand,
    model: m.model,
    typeName: m.typeName,
    total: m.total,
    available: m.available,
    assigned: m.assigned,
    maintenance: m.maintenance,
    retired: m.retired,
    batchCount: m.batchCount,
    individualCount: m.individualCount,
  }))

  const batchData = batches.map(b => ({
    id: b.id,
    batchCode: b.batchCode,
    description: b.description,
    modelBrand: b.model.brand,
    modelName: b.model.model,
    quantity: b.quantity,
    supplierName: b.supplier?.name ?? '—',
    purchaseDate: b.purchaseDate,
    unitPrice: b.unitPrice,
    totalPrice: b.totalPrice,
    metrics: b.metrics,
  }))

  return (
    <div className='container mx-auto py-6 px-4'>
      <div className='flex items-center justify-between mb-6'>
        <div>
          <h1 className='text-3xl font-bold'>Inventario</h1>
          <p className='text-gray-600 mt-2'>
            Gestiona tus activos por modelo, lote o vista completa
          </p>
        </div>
        <Link href='/inventory/new'>
          <Button className='flex items-center gap-2'>
            <Plus className='w-4 h-4' />
            Crear Activos
          </Button>
        </Link>
      </div>

      <InventoryFiltersClient
        types={types.map(t => ({ id: t.id, name: t.name }))}
        departments={departments.map(d => ({ id: d.id, name: d.name }))}
        initialSearch={searchParams.search}
        initialType={searchParams.typeId}
        initialDepartment={searchParams.departmentId}
        initialStatus={searchParams.status}
      />

      <InventoryTabs
        modelView={<ModelCards models={modelData} />}
        batchView={<BatchList batches={batchData} />}
        allView={
          <div className='text-center py-12'>
            <p className='text-muted-foreground'>Vista de tabla completa - En desarrollo</p>
          </div>
        }
      />
    </div>
  )
}

export default function InventoryPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <InventoryContent searchParams={searchParams} />
    </Suspense>
  )
}
