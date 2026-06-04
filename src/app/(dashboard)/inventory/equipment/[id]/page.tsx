'use client'

import { use } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useEffect } from 'react'
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { EquipmentDetail } from '@/components/inventory/equipment-detail'

interface EquipmentDetailPageProps {
  params: Promise<{ id: string }>
}

export default function EquipmentDetailPage({ params }: EquipmentDetailPageProps) {
  const { id } = use(params)
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  if (status === 'loading') {
    return (
      <ModuleLayout title='Cargando...' subtitle='Obteniendo información del equipo'>
        <div className='flex items-center justify-center h-64'>
          <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-primary' />
        </div>
      </ModuleLayout>
    )
  }

  if (!session?.user) {
    return null
  }

  return (
    <ModuleLayout title='Detalle del Equipo' subtitle='Información completa del equipo'>
      <EquipmentDetail
        equipmentId={id}
        userRole={session.user.role}
        userId={session.user.id}
        isSuperAdmin={(session.user as any)?.isSuperAdmin === true}
      />
    </ModuleLayout>
  )
}
