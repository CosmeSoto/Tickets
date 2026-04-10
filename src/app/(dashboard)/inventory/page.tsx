'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { RoleDashboardLayout } from '@/components/layout/role-dashboard-layout'
import { UnifiedInventoryList } from '@/components/inventory/unified-inventory-list'
import { Button } from '@/components/ui/button'
import { Plus, Package, User } from 'lucide-react'
import Link from 'next/link'

function InventoryContent() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()

  const familyId = searchParams.get('familyId') ?? undefined
  const tab = searchParams.get('tab') ?? 'family'   // 'family' | 'mine'

  const role = session?.user?.role
  const isClient = role === 'CLIENT'
  const canManageInventory = (session?.user as any)?.canManageInventory === true

  // Usuarios que gestionan familias Y también pueden tener equipos asignados personalmente
  const isManager = canManageInventory
  // Cliente sin gestión: solo ve sus equipos asignados
  const isClientOnly = isClient && !canManageInventory

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
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

  const canCreate = role === 'ADMIN' || role === 'TECHNICIAN' || canManageInventory

  // Título y subtítulo según contexto
  const title = isClientOnly ? 'Mis Equipos' : 'Inventario'
  const subtitle = isClientOnly
    ? 'Equipos asignados a tu cuenta'
    : 'Gestiona el inventario de activos tecnológicos'

  const setTab = (t: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', t)
    if (t === 'mine') params.delete('familyId')
    router.push(`/inventory?${params.toString()}`)
  }

  return (
    <RoleDashboardLayout
      title={title}
      subtitle={subtitle}
      headerActions={
        canCreate && tab !== 'mine' ? (
          <Link href="/inventory/equipment/new">
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Activo
            </Button>
          </Link>
        ) : undefined
      }
    >
      {/* Tabs solo para gestores/admins/técnicos que también tienen equipos asignados */}
      {isManager && (
        <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit mb-4">
          <button
            onClick={() => setTab('family')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab !== 'mine'
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Package className="h-4 w-4" />
            Inventario de Familias
          </button>
          <button
            onClick={() => setTab('mine')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === 'mine'
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <User className="h-4 w-4" />
            Mis Equipos
          </button>
        </div>
      )}

      <UnifiedInventoryList
        initialFamilyId={tab !== 'mine' ? familyId : undefined}
        personalOnly={tab === 'mine'}
      />
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
