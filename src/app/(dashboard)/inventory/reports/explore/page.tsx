'use client'

import { Suspense, useEffect } from 'react'
import { useAuthReady } from '@/hooks/auth/use-auth-ready'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { ReportExplorer } from '@/components/inventory/reports/report-explorer'
import { ReportBackLink } from '@/components/inventory/reports/report-back-link'
import { hasInventoryReportsAccess } from '@/lib/inventory/reports/catalog'

function ExploreContent() {
  const searchParams = useSearchParams()
  const initialDataset = searchParams.get('dataset') ?? undefined
  const initialSaved = searchParams.get('saved') ?? undefined
  return <ReportExplorer initialDatasetId={initialDataset} initialSavedId={initialSaved} />
}

export default function InventoryReportsExplorePage() {
  const { data: session, status } = useAuthReady()
  const router = useRouter()
  const role = session?.user?.role ?? ''
  const isSuperAdmin = (session?.user as { isSuperAdmin?: boolean })?.isSuperAdmin === true
  const canManageInventory =
    (session?.user as { canManageInventory?: boolean })?.canManageInventory === true

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
      return
    }
    if (
      status === 'authenticated' &&
      !hasInventoryReportsAccess(role, isSuperAdmin, canManageInventory)
    ) {
      router.push('/unauthorized')
    }
  }, [status, router, role, isSuperAdmin, canManageInventory])

  if (status === 'loading') {
    return (
      <ModuleLayout title='Explorador de reportes' loading>
        <div />
      </ModuleLayout>
    )
  }

  if (!session?.user) return null
  if (!hasInventoryReportsAccess(role, isSuperAdmin, canManageInventory)) return null

  return (
    <ModuleLayout
      title='Explorador de reportes'
      subtitle='Consulta flexible por dataset — filtra, elige columnas y exporta'
    >
      <div className='space-y-4'>
        <ReportBackLink />
        <Suspense
          fallback={
            <div className='flex items-center justify-center h-64'>
              <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
            </div>
          }
        >
          <ExploreContent />
        </Suspense>
      </div>
    </ModuleLayout>
  )
}
