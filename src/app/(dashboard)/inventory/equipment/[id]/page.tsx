'use client'

import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useEffect } from 'react'
import { RoleDashboardLayout } from '@/components/layout/role-dashboard-layout'
import { EquipmentDetail } from '@/components/inventory/equipment-detail'

interface EquipmentDetailPageProps {
  params: {
    id: string
  }
}

export default function EquipmentDetailPage({ params }: EquipmentDetailPageProps) {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  if (status === 'loading') {
    return (
      <RoleDashboardLayout title="Cargando..." subtitle="Obteniendo información del equipo">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </RoleDashboardLayout>
    )
  }

  if (!session?.user) {
    return null
  }

  return (
    <RoleDashboardLayout
      title="Detalle del Equipo"
      subtitle="Información completa del equipo"
    >
      <EquipmentDetail 
        equipmentId={params.id} 
        userRole={session.user.role}
        userId={session.user.id}
      />
    </RoleDashboardLayout>
  )
}
