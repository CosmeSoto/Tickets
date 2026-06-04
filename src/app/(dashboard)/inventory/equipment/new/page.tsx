'use client'

import { Suspense, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { UnifiedAssetForm } from '@/components/inventory/unified-asset-form'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowLeft, Loader2 } from 'lucide-react'

function NewEquipmentPageContent() {
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
      <ModuleLayout title='Nuevo Activo Individual' subtitle='Cargando...'>
        <div className='flex items-center justify-center h-64'>
          <Loader2 className='h-8 w-8 animate-spin text-primary' />
        </div>
      </ModuleLayout>
    )
  }

  if (!session?.user || session.user.role === 'CLIENT') return null

  return (
    <ModuleLayout
      title='Nuevo Activo Individual'
      subtitle='Registra un activo individual en el inventario'
    >
      <div className='max-w-4xl mx-auto space-y-4'>
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
            <UnifiedAssetForm
              defaultFamilyId={defaultFamilyId}
              onSuccess={() => router.push('/inventory')}
              onCancel={() => router.push('/inventory/new')}
            />
          </CardContent>
        </Card>
      </div>
    </ModuleLayout>
  )
}

function NewEquipmentPageSuspenseFallback() {
  return (
    <ModuleLayout title='Nuevo Activo Individual' subtitle='Cargando...'>
      <div className='flex items-center justify-center h-64'>
        <Loader2 className='h-8 w-8 animate-spin text-primary' />
      </div>
    </ModuleLayout>
  )
}

export default function NewEquipmentPage() {
  return (
    <Suspense fallback={<NewEquipmentPageSuspenseFallback />}>
      <NewEquipmentPageContent />
    </Suspense>
  )
}
