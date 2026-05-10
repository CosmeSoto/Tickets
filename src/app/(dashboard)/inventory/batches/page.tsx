import { Suspense } from 'react'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { BatchService } from '@/lib/services/batch-inventory.service'
import { prisma } from '@/lib/prisma'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Plus } from 'lucide-react'
import Link from 'next/link'
import { Skeleton } from '@/components/ui/skeleton'
import { BatchList } from '@/components/inventory/dashboard/BatchList'
import { InventoryFiltersClient } from '@/components/inventory/filters/InventoryFiltersClient'
import { getHomePathForRole, loginPathWithReturnTo } from '@/lib/navigation/role-home-path'

interface SearchParams {
  search?: string
  typeId?: string
  departmentId?: string
}

async function getBatchesData(filters: SearchParams) {
  const [batches, types, departments] = await Promise.all([
    BatchService.getAll({
      typeId: filters.typeId,
      departmentId: filters.departmentId,
    }),
    prisma.equipment_types.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
    prisma.departments.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
  ])

  // Filtrar por búsqueda de texto en marca/modelo
  const filtered = filters.search
    ? batches.filter(
        b =>
          b.model.brand.toLowerCase().includes(filters.search!.toLowerCase()) ||
          b.model.model.toLowerCase().includes(filters.search!.toLowerCase()) ||
          b.batchCode.toLowerCase().includes(filters.search!.toLowerCase())
      )
    : batches

  return { batches: filtered, types, departments }
}

function LoadingSkeleton() {
  return (
    <div className='space-y-4'>
      {[...Array(5)].map((_, i) => (
        <Skeleton key={i} className='h-20 w-full' />
      ))}
    </div>
  )
}

async function BatchesContent({ searchParams }: { searchParams: SearchParams }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect(loginPathWithReturnTo('/inventory/batches'))
  if (!session.user.inventoryEnabled && !session.user.canManageInventory) {
    redirect(getHomePathForRole(session.user.role))
  }

  const { batches, types, departments } = await getBatchesData(searchParams)

  const batchData = batches.map(b => ({
    id: b.id,
    batchCode: b.batchCode,
    description: b.description,
    modelBrand: b.model.brand,
    modelName: b.model.model,
    quantity: b.quantity,
    supplierName: b.supplier?.name || '—',
    purchaseDate: b.purchaseDate,
    unitPrice: b.unitPrice,
    totalPrice: b.totalPrice,
    metrics: b.metrics,
  }))

  return (
    <div className='container mx-auto py-6 px-4'>
      <Link href='/inventory'>
        <Button variant='ghost' size='sm' className='flex items-center gap-2 mb-4 -ml-2'>
          <ArrowLeft className='w-4 h-4' />
          Volver al Inventario
        </Button>
      </Link>

      <div className='flex items-center justify-between mb-6'>
        <div>
          <h1 className='text-2xl font-bold'>Lotes de Equipos</h1>
          <p className='text-muted-foreground mt-1'>
            {batches.length} lote{batches.length !== 1 ? 's' : ''} registrado
            {batches.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link href='/inventory/new'>
          <Button className='flex items-center gap-2'>
            <Plus className='w-4 h-4' />
            Nuevo Lote
          </Button>
        </Link>
      </div>

      <InventoryFiltersClient
        types={types.map(t => ({ id: t.id, name: t.name }))}
        departments={departments.map(d => ({ id: d.id, name: d.name }))}
        initialSearch={searchParams.search}
        initialType={searchParams.typeId}
        initialDepartment={searchParams.departmentId}
      />

      <BatchList batches={batchData} />
    </div>
  )
}

export default function BatchesPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <BatchesContent searchParams={searchParams} />
    </Suspense>
  )
}
