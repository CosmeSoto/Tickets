import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { EquipmentDetail } from '@/components/inventory/equipment-detail'
import { Skeleton } from '@/components/ui/skeleton'

interface EquipmentDetailPageProps {
  params: {
    id: string
  }
}

export default async function EquipmentDetailPage({ params }: EquipmentDetailPageProps) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    notFound()
  }

  return (
    <div className="container mx-auto py-6">
      <Suspense fallback={<EquipmentDetailSkeleton />}>
        <EquipmentDetail 
          equipmentId={params.id} 
          userRole={session.user.role}
          userId={session.user.id}
        />
      </Suspense>
    </div>
  )
}

function EquipmentDetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-64" />
      <div className="grid gap-6 md:grid-cols-2">
        <Skeleton className="h-96" />
        <Skeleton className="h-96" />
      </div>
      <Skeleton className="h-64" />
    </div>
  )
}
