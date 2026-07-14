'use client'

import { Suspense, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { ReportExplorer } from '@/components/inventory/reports/report-explorer'

function ExploreContent() {
  const searchParams = useSearchParams()
  const initialDataset = searchParams.get('dataset') ?? undefined
  const initialSaved = searchParams.get('saved') ?? undefined
  return (
    <ReportExplorer initialDatasetId={initialDataset} initialSavedId={initialSaved} />
  )
}

export default function InventoryReportsExplorePage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  if (status === 'loading') {
    return (
      <ModuleLayout title='Explorador de reportes' loading>
        <div />
      </ModuleLayout>
    )
  }

  if (!session?.user) return null

  return (
    <ModuleLayout
      title='Explorador de reportes'
      subtitle='Consulta flexible por dataset — filtra, elige columnas y exporta'
    >
      <Suspense
        fallback={
          <div className='flex items-center justify-center h-64'>
            <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
          </div>
        }
      >
        <ExploreContent />
      </Suspense>
    </ModuleLayout>
  )
}
