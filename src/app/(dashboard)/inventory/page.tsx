'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { RoleDashboardLayout } from '@/components/layout/role-dashboard-layout'
import { UnifiedInventoryList } from '@/components/inventory/unified-inventory-list'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import Link from 'next/link'

function InventoryContent() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()

  const familyId = searchParams.get('familyId') ?? undefined

  const role = session?.user?.role
  const isClient = role === 'CLIENT'

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  if (status === 'loading') {
    return (
      <RoleDashboardLayout title="Cargando..." subtitle="Obteniendo información">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        </div>
      </RoleDashboardLayout>
    )
  }

  if (!session?.user) return null

  const title = isClient ? 'Mis Equipos' : 'Inventario'
  const subtitle = isClient
    ? 'Equipos asignados a tu cuenta'
    : 'Gestiona el inventario de activos tecnológicos'

  const canCreate = role === 'ADMIN' || role === 'TECHNICIAN'

  return (
    <RoleDashboardLayout
      title={title}
      subtitle={subtitle}
      headerActions={
        canCreate ? (
          <Link href="/inventory/equipment/new">
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Activo
            </Button>
          </Link>
        ) : undefined
      }
    >
      <UnifiedInventoryList initialFamilyId={familyId} />
    </RoleDashboardLayout>
  )
}

export default function InventoryPage() {
  return (
    <Suspense>
      <InventoryContent />
    </Suspense>
  )
}
