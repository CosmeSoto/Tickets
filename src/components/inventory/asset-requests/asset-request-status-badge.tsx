'use client'

import { Badge } from '@/components/ui/badge'
import { AssetRequestStatus } from '@prisma/client'
import { Clock, CheckCircle, XCircle, Eye, Package } from 'lucide-react'

interface AssetRequestStatusBadgeProps {
  status: AssetRequestStatus
  className?: string
}

const STATUS_CONFIG: Record<
  AssetRequestStatus,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: any }
> = {
  PENDING: {
    label: 'Pendiente',
    variant: 'secondary',
    icon: Clock,
  },
  UNDER_REVIEW: {
    label: 'En Revisión',
    variant: 'default',
    icon: Eye,
  },
  APPROVED: {
    label: 'Aprobada',
    variant: 'default',
    icon: CheckCircle,
  },
  REJECTED: {
    label: 'Rechazada',
    variant: 'destructive',
    icon: XCircle,
  },
  FULFILLED: {
    label: 'Cumplida',
    variant: 'outline',
    icon: Package,
  },
}

export function AssetRequestStatusBadge({ status, className }: AssetRequestStatusBadgeProps) {
  const config = STATUS_CONFIG[status]
  const Icon = config.icon

  return (
    <Badge variant={config.variant} className={className}>
      <Icon className='mr-1 h-3 w-3' />
      {config.label}
    </Badge>
  )
}
