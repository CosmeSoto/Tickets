import { Suspense } from 'react'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { EquipmentSummaryWidget } from '@/components/inventory/equipment-summary-widget'
import { EquipmentList } from '@/components/inventory/equipment-list'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import Link from 'next/link'
import { Skeleton } from '@/components/ui/skeleton'

export default async function InventoryPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect('/login')
  }

  const canCreate = session.user.role === 'ADMIN' || session.user.role === 'TECHNICIAN'

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Inventario de Equipos</h1>
          <p className="text-muted-foreground">
            Gestiona el inventario de equipos tecnológicos
          </p>
        </div>
        {canCreate && (
          <Link href="/inventory/equipment/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Equipo
            </Button>
          </Link>
        )}
      </div>

      {/* Summary Widgets */}
      <Suspense fallback={<SummaryWidgetsSkeleton />}>
        <EquipmentSummaryWidget 
          userRole={session.user.role} 
          userId={session.user.id} 
        />
      </Suspense>

      {/* Equipment List */}
      <Suspense fallback={<EquipmentListSkeleton />}>
        <EquipmentList 
          userRole={session.user.role} 
          userId={session.user.id} 
        />
      </Suspense>
    </div>
  )
}

function SummaryWidgetsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {[...Array(4)].map((_, i) => (
        <Skeleton key={i} className="h-32" />
      ))}
    </div>
  )
}

function EquipmentListSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-12" />
      <Skeleton className="h-96" />
    </div>
  )
}
