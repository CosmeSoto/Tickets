'use client'

import { WifiOff, Clock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface PatrolOfflineIndicatorProps {
  isOnline: boolean
  queuedCount: number
}

export function PatrolOfflineIndicator({ isOnline, queuedCount }: PatrolOfflineIndicatorProps) {
  if (isOnline && queuedCount === 0) return null

  return (
    <div className='flex items-center gap-2'>
      {!isOnline && (
        <Badge variant='destructive' className='flex items-center gap-1.5 text-xs font-medium'>
          <WifiOff className='h-3 w-3' />
          Sin conexión
        </Badge>
      )}
      {queuedCount > 0 && (
        <Badge
          variant='outline'
          className='flex items-center gap-1.5 text-xs font-medium border-yellow-400 text-yellow-700 dark:text-yellow-400'
        >
          <Clock className='h-3 w-3' />
          {queuedCount} pendiente{queuedCount !== 1 ? 's' : ''}
        </Badge>
      )}
    </div>
  )
}
