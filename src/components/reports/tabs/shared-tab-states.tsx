/**
 * Shared loading and empty states for report tabs
 */

import { Loader2, FileText } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

export function TabLoadingState() {
  return (
    <div className='space-y-4'>
      {[...Array(3)].map((_, i) => (
        <div key={i} className='h-32 bg-muted animate-pulse rounded-lg' />
      ))}
    </div>
  )
}

export function TabEmptyState({ message }: { message: string }) {
  return (
    <Card>
      <CardContent className='py-12 text-center'>
        <FileText className='h-12 w-12 text-muted-foreground mx-auto mb-3' />
        <p className='text-muted-foreground'>{message}</p>
      </CardContent>
    </Card>
  )
}
