'use client'

import { useAuthReady } from '@/hooks/auth/use-auth-ready'
import { useRouter } from 'next/navigation'
import { useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { UnifiedInventoryList } from '@/components/inventory/unified-inventory-list'
import { BatchesTab } from '@/components/inventory/dashboard/BatchesTab'
import { Button } from '@/components/ui/button'
import { Plus, Package, User, Layers, Upload } from 'lucide-react'
import Link from 'next/link'

function InventoryContent() {
  const { data: session, status } = useAuthReady()
  const router = useRouter()
  const searchParams = useSearchParams()
  const familyId = searchParams.get('familyId') ?? undefined
  const tab = searchParams.get('tab') ?? 'family'

  const role = session?.user?.role
  const isClient = role === 'CLIENT'
  const isSuperAdmin = (session?.user as any)?.isSuperAdmin === true
  const canManageInventory = (session?.user as any)?.canManageInventory === true
  const isManager = canManageInventory
  const isClientOnly = isClient && !canManageInventory
  const isAdmin = role === 'ADMIN'
  // Lotes: Super Admin o gestión completa (incluye ADMIN de familia con el toggle)
  const canSeeBatches = isSuperAdmin || canManageInventory

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  if (status === 'loading') {
    return (
      <ModuleLayout title='Cargando...' loading={true}>
        <div />
      </ModuleLayout>
    )
  }

  if (!session?.user) return null

  const canCreate = isSuperAdmin || canManageInventory || role === 'TECHNICIAN'
  const title = isClientOnly ? 'Mis Activos' : 'Inventario'
  const subtitle = isClientOnly
    ? 'Activos asignados a tu cuenta'
    : 'Equipos, licencias y materiales de tu organización'

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
    <>
      <ModuleLayout
        title={title}
        subtitle={subtitle}
        headerActions={
          canCreate && tab !== 'mine' ? (
            <div className='flex items-center gap-2'>
              <Button size='sm' variant='outline' asChild>
                <Link href='/inventory/import'>
                  <Upload className='mr-2 h-4 w-4' />
                  Importar
                </Link>
              </Button>
              <Button size='sm' asChild>
                <Link
                  href={
                    tab === 'batches'
                      ? '/inventory/new?mode=bulk'
                      : '/inventory/new?mode=individual'
                  }
                >
                  <Plus className='mr-2 h-4 w-4' />
                  {tab === 'batches' ? 'Nuevo Lote' : 'Nuevo Activo'}
                </Link>
              </Button>
            </div>
          ) : undefined
        }
      >
        {/* Tabs: Inventario / Lotes / Mis Equipos — para ADMIN y gestores */}
        {(isAdmin || isManager) && (
          <div className='flex gap-1 p-1 bg-muted rounded-lg w-fit mb-4'>
            <button
              onClick={() => setTab('family')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                tab !== 'mine' && tab !== 'batches'
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Package className='h-4 w-4' />
              Inventario
            </button>
            {canSeeBatches && (
              <button
                onClick={() => setTab('batches')}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  tab === 'batches'
                    ? 'bg-background shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Layers className='h-4 w-4' />
                Lotes
              </button>
            )}
            <button
              onClick={() => setTab('mine')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                tab === 'mine'
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <User className='h-4 w-4' />
              Mis Equipos
            </button>
          </div>
        )}

        {/* Tab: Lotes — visible para ADMIN y gestores */}
        {tab === 'batches' && canSeeBatches ? (
          <BatchesTab canCreate={isAdmin || canManageInventory} embedded />
        ) : (
          <UnifiedInventoryList
            initialFamilyId={tab !== 'mine' ? familyId : undefined}
            personalOnly={tab === 'mine'}
            showDashboard={tab !== 'mine' && tab !== 'batches'}
          />
        )}
      </ModuleLayout>
    </>
  )
}
export default function InventoryPage() {
  return (
    <Suspense>
      <InventoryContent />
    </Suspense>
  )
}
