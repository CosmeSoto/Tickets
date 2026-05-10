'use client'

import { Badge } from '@/components/ui/badge'
import { Package } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface BatchBadgeProps {
  batchId: string
  batchCode?: string
  onClick?: () => void
}

export function BatchBadge({ batchId, batchCode, onClick }: BatchBadgeProps) {
  const router = useRouter()

  const handleClick = () => {
    if (onClick) {
      onClick()
    } else {
      router.push(`/inventory/batches/${batchId}`)
    }
  }

  return (
    <Badge
      variant='secondary'
      className='cursor-pointer hover:bg-secondary/80 transition-colors flex items-center gap-1'
      onClick={handleClick}
    >
      <Package className='w-3 h-3' />
      {batchCode || `Lote #${batchId.substring(0, 8)}`}
    </Badge>
  )
}
