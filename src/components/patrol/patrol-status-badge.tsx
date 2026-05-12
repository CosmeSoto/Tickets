'use client'

import { Badge } from '@/components/ui/badge'
import { getPatrolStatusColor, PATROL_STATUS_LABELS_ES } from '@/lib/utils/patrol-utils'

interface PatrolStatusBadgeProps {
  status: string
  className?: string
}

export function PatrolStatusBadge({ status, className }: PatrolStatusBadgeProps) {
  return (
    <Badge className={`${getPatrolStatusColor(status)} border-0 font-medium ${className ?? ''}`}>
      {PATROL_STATUS_LABELS_ES[status] ?? status}
    </Badge>
  )
}
