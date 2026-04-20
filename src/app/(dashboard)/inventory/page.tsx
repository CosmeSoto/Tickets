'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { UnifiedInventoryList } from '@/components/inventory/unified-inventory-list'
import { Button } from '@/components/ui/button'
import { Plus, Package, User } from 'lucide-react'
import Link from 'next/link'

function InventoryContent() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()

  const familyId = searchParams.get('familyId') ?? undefined
  const tab = searchParams.get('tab') ?? 'family'

  const role = session?.user?.role
  const isClient = role === 'CLIENT'
  const canManageInventory = (session?.user as any)?.canManageInventory === true
  const isManager = canManageInventory
  const isClientOnly = isClient && !canManageInventory

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  if (status === 'loading') {
    return (
      <ModuleLayout title="Cargando..." loading={true}><div /></ModuleLayout>
    )
  }

  if (!session?.user) return null

  const canCreate = role === 'ADMIN' || role === 'TECHNICIAN' || canManageInventory
  const title = isClientOnly ? 'Mis Activos' : 'Inventario'
  const subtitle = isClientOnly ? 'Activos asignados a tu cuenta' : 'Equipos, licencias y materiales de tu organización'

  const setTab = (t: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', t)
    if (t === 'mine') params.delete('familyId')
    router.push(`/inventory?${params.toString()}`)
  }

  if (isClientOnly) {
    return (
      <ModuleLayout title={title} subtitle={subtitle}>
        <UnifiedInventoryList personalOnly={true} />
      </ModuleLayout>
    )
  }

  return (
    <ModuleLayout
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
      {isManager && (
        <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit mb-4">
          <button
            onClick={() => setTab('family')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab !== 'mine' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Package className="h-4 w-4" />
            Inventario de Familias
          </button>
          <button
            onClick={() => setTab('mine')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === 'mine' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
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
    </ModuleLayout>
  )
}
export default function InventoryPage() {
  return (
    <Suspense>
      <InventoryContent />
    </Suspense>
  )
}
