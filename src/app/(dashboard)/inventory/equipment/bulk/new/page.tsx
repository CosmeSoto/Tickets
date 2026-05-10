'use client'

import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'
import { RoleDashboardLayout } from '@/components/layout/role-dashboard-layout'
import { BulkEquipmentForm } from '@/components/inventory/equipment/BulkEquipmentForm'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowLeft, Loader2 } from 'lucide-react'

export default function NewBulkEquipmentPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const defaultFamilyId = searchParams.get('familyId') ?? undefined

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
    else if (session?.user?.role === 'CLIENT') router.push('/inventory')
  }, [status, session, router])

  if (status === 'loading') {
    return (
      <RoleDashboardLayout title='Nuevo Lote de Activos' subtitle='Cargando...'>
        <div className='flex items-center justify-center h-64'>
          <Loader2 className='h-8 w-8 animate-spin text-primary' />
        </div>
      </RoleDashboardLayout>
    )
  }

  if (!session?.user || session.user.role === 'CLIENT') return null

  const subtitle = defaultFamilyId
    ? 'Selecciona el tipo de activo y completa los datos del lote'
    : 'Selecciona la familia y completa los datos del lote'

  return (
    <RoleDashboardLayout title='Nuevo Lote de Activos' subtitle={subtitle}>
      <div className='max-w-5xl mx-auto space-y-4'>
        {/* Botón volver — regresa a la pantalla de selección */}
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
    </RoleDashboardLayout>
  )
}
