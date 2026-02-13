'use client'

import dynamic from 'next/dynamic'
import { Skeleton } from '@/components/ui/skeleton'

// Lazy load the heavy reports component with charts
const ReportsPage = dynamic(() => import('@/components/reports/reports-page'), {
  loading: () => (
    <div className="space-y-4 p-6">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-64 w-full" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    </div>
  ),
  ssr: false, // Reports with charts don't need SSR
})

export default function ReportsRoute() {
  return <ReportsPage />
}
