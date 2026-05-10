import { Suspense } from 'react'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { ModelAggregationService } from '@/lib/services/model-aggregation.service'
import { prisma } from '@/lib/prisma'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Plus } from 'lucide-react'
import Link from 'next/link'
import { Skeleton } from '@/components/ui/skeleton'
import { ModelCards } from '@/components/inventory/dashboard/ModelCards'
import { InventoryFiltersClient } from '@/components/inventory/filters/InventoryFiltersClient'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ModelSortClient } from '@/components/inventory/model/ModelSortClient'

interface SearchParams {
  search?: string
  typeId?: string
  departmentId?: string
  sort?: string
}

async function getModelsData(filters: SearchParams) {
  const [models, types, departments] = await Promise.all([
    ModelAggregationService.getAllModels({
      search: filters.search,
      typeId: filters.typeId,
      departmentId: filters.departmentId,
    }),
    prisma.equipment_types.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
    prisma.departments.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
  ])

  // Ordenamiento
  const sorted = [...models]
  switch (filters.sort) {
    case 'utilization':
      sorted.sort((a, b) => b.utilizationRate - a.utilizationRate)
      break
    case 'alphabetical':
      sorted.sort((a, b) => `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`))
      break
    case 'quantity':
    default:
      sorted.sort((a, b) => b.total - a.total)
      break
  }

  return { models: sorted, types, departments }
}

function LoadingSkeleton() {
  return (
    <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
      {[...Array(6)].map((_, i) => (
        <Skeleton key={i} className='h-48' />
      ))}
    </div>
  )
}

async function ModelsContent({ searchParams }: { searchParams: SearchParams }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/auth/signin')

  const { models, types, departments } = await getModelsData(searchParams)

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
          <h1 className='text-2xl font-bold'>Modelos de Equipos</h1>
          <p className='text-muted-foreground mt-1'>
            {models.length} modelo{models.length !== 1 ? 's' : ''} registrado
            {models.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link href='/inventory/new'>
          <Button className='flex items-center gap-2'>
            <Plus className='w-4 h-4' />
            Nuevo Activo
          </Button>
        </Link>
      </div>

      <div className='flex flex-wrap gap-3 mb-6'>
        <div className='flex-1'>
          <InventoryFiltersClient
            types={types.map(t => ({ id: t.id, name: t.name }))}
            departments={departments.map(d => ({ id: d.id, name: d.name }))}
            initialSearch={searchParams.search}
            initialType={searchParams.typeId}
            initialDepartment={searchParams.departmentId}
          />
        </div>
        <ModelSortClient initialSort={searchParams.sort} />
      </div>

      {modelData.length === 0 ? (
        <div className='text-center py-16 text-muted-foreground'>
          <p className='text-lg'>No se encontraron modelos</p>
          <p className='text-sm mt-1'>Intenta ajustar los filtros de búsqueda</p>
        </div>
      ) : (
        <ModelCards models={modelData} />
      )}
    </div>
  )
}

export default function ModelsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <ModelsContent searchParams={searchParams} />
    </Suspense>
  )
}
