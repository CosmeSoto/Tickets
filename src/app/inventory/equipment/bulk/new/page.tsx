'use client'

import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'
import { BulkEquipmentForm } from '@/components/inventory/equipment/BulkEquipmentForm'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowLeft, Loader2 } from 'lucide-react'

/**
 * Alta de lote masivo — vive bajo `app/inventory` para alinear rutas con el layout
 * de inventario y con la generación de tipos de Next.js.
 */
export default function NewBulkEquipmentPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const defaultFamilyId = searchParams.get('familyId') ?? undefined

  const canManageInventory = (session?.user as any)?.canManageInventory === true

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
    else if (
      status === 'authenticated' &&
      session?.user?.role === 'CLIENT' &&
      !canManageInventory
    ) {
      router.push('/inventory')
    }
  }, [status, session, router, canManageInventory])

  if (status === 'loading') {
    return (
      <div className='max-w-5xl mx-auto px-4 py-8 flex flex-col items-center justify-center min-h-[40vh] gap-3'>
        <Loader2 className='h-10 w-10 animate-spin text-primary' />
        <p className='text-sm text-muted-foreground'>Cargando...</p>
      </div>
    )
  }

  if (!session?.user || (session.user.role === 'CLIENT' && !canManageInventory)) return null

  const subtitle = defaultFamilyId
    ? 'Selecciona el tipo de activo y completa los datos del lote'
    : 'Selecciona la familia y completa los datos del lote'

  return (
    <div className='max-w-5xl mx-auto px-4 py-6 space-y-4'>
      <div>
        <h1 className='text-2xl sm:text-3xl font-bold tracking-tight'>Nuevo lote de activos</h1>
        <p className='text-muted-foreground text-sm sm:text-base mt-1'>{subtitle}</p>
      </div>

      <button
        type='button'
        onClick={() => router.push('/inventory/new')}
        className='flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors'
      >
        <ArrowLeft className='h-4 w-4' />
        Cambiar modalidad o familia
      </button>

      <Card>
        <CardContent className='pt-6'>
          <BulkEquipmentForm
            defaultFamilyId={defaultFamilyId}
            onSuccess={() => {
              setTimeout(() => router.push('/inventory'), 3000)
            }}
            onCancel={() => router.push('/inventory/new')}
          />
        </CardContent>
      </Card>
    </div>
  )
}
