'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { RoleDashboardLayout } from '@/components/layout/role-dashboard-layout'
import { EquipmentSummaryWidget } from '@/components/inventory/equipment-summary-widget'
import { EquipmentList } from '@/components/inventory/equipment-list'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import Link from 'next/link'

export default function InventoryPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  if (status === 'loading') {
    return (
      <RoleDashboardLayout title="Cargando..." subtitle="Obteniendo información">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </RoleDashboardLayout>
    )
  }

  if (!session?.user) return null

  const canCreate = session.user.role === 'ADMIN' || session.user.role === 'TECHNICIAN'

  return (
    <RoleDashboardLayout
      title="Inventario de Equipos"
      subtitle="Gestiona el inventario de equipos tecnológicos"
      headerActions={
        canCreate ? (
          <Link href="/inventory/equipment/new">
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Equipo
            </Button>
          </Link>
        ) : undefined
      }
    >
      <div className="space-y-6">
        <EquipmentSummaryWidget userRole={session.user.role} userId={session.user.id} />
        <EquipmentList userRole={session.user.role} userId={session.user.id} />
      </div>
    </RoleDashboardLayout>
  )
}
