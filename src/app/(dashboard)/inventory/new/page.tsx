import { Suspense } from 'react'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import {
  getHomePathForRole,
  loginPathWithReturnTo,
  canAccessInventory,
} from '@/lib/navigation/role-home-path'
import { UnifiedEquipmentForm } from '@/components/inventory/unified-form/UnifiedEquipmentForm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

async function getFormData() {
  const [equipmentTypes, departments, warehouses, suppliers, models] = await Promise.all([
    prisma.equipment_types.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      include: {
        attributes: {
          orderBy: { order: 'asc' },
        },
      },
    }),
    prisma.departments.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
    }),
    prisma.warehouses.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    }),
    prisma.suppliers.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    }),
    prisma.equipment_models.findMany({
      where: { isActive: true },
      orderBy: [{ brand: 'asc' }, { model: 'asc' }],
      include: {
        type: {
          include: {
            attributes: {
              orderBy: { order: 'asc' },
            },
          },
        },
      },
    }),
  ])

  return {
    equipmentTypes,
    departments,
    warehouses,
    suppliers,
    models,
  }
}

function FormSkeleton() {
  return (
    <div className='space-y-6'>
      <Card>
        <CardHeader>
          <Skeleton className='h-8 w-64' />
        </CardHeader>
        <CardContent>
          <Skeleton className='h-12 w-full' />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <Skeleton className='h-6 w-48' />
        </CardHeader>
        <CardContent className='space-y-4'>
          <Skeleton className='h-10 w-full' />
          <Skeleton className='h-10 w-full' />
          <Skeleton className='h-10 w-full' />
        </CardContent>
      </Card>
    </div>
  )
}

async function FormContent() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect(loginPathWithReturnTo('/inventory/new'))
  }

  // Verificar permisos
  if (!canAccessInventory(session.user)) {
    redirect(getHomePathForRole(session.user.role))
  }

  const formData = await getFormData()

  return (
    <div className='container mx-auto py-6 px-4'>
      <div className='mb-6'>
        <h1 className='text-3xl font-bold'>Crear Activos</h1>
        <p className='text-gray-600 mt-2'>
          Crea uno o varios equipos de forma individual o por lote
        </p>
      </div>

      <UnifiedEquipmentForm
        equipmentTypes={formData.equipmentTypes}
        departments={formData.departments}
        warehouses={formData.warehouses}
        suppliers={formData.suppliers}
        models={formData.models}
      />
    </div>
  )
}

export default function NewEquipmentPage() {
  return (
    <Suspense fallback={<FormSkeleton />}>
      <FormContent />
    </Suspense>
  )
}
