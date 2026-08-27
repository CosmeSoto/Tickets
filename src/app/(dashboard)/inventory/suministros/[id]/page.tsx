'use client'

import { use } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthReady } from '@/hooks/auth/use-auth-ready'
import { useEffect } from 'react'
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { ConsumableDetail } from '@/components/inventory/consumable-detail'

interface PageProps {
  params: Promise<{ id: string }>
}

export default function SuministroDetailPage({ params }: PageProps) {
  const { id } = use(params)
  const { data: session, status } = useAuthReady()
  const router = useRouter()

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  if (status === 'loading') {
    return (
      <ModuleLayout title='Cargando...' subtitle='Obteniendo información del suministro'>
        <div className='flex items-center justify-center h-64'>
          <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-primary' />
        </div>
      </ModuleLayout>
    )
  }

  if (!session?.user) return null

  return (
    <ModuleLayout
      title='Detalle del Suministro'
      subtitle='Información completa del material / suministro'
    >
      <ConsumableDetail
        consumableId={id}
        userRole={session.user.role}
        userId={session.user.id}
        isSuperAdmin={(session.user as { isSuperAdmin?: boolean }).isSuperAdmin === true}
      />
    </ModuleLayout>
  )
}
