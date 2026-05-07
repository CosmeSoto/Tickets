/**
 * Badge de estado para solicitudes de activos
 * Usa variantes semánticas de shadcn Badge — NO colores hexadecimales hardcodeados
 */

import { Badge } from '@/components/ui/badge'
import { AssetRequestStatus } from '@prisma/client'
import {
  ASSET_REQUEST_STATUS_LABELS,
  getAssetRequestStatusBadgeVariant,
} from '@/lib/utils/asset-request-utils'
import { cn } from '@/lib/utils'

interface AssetRequestStatusBadgeProps {
  status: AssetRequestStatus
  className?: string
}

export function AssetRequestStatusBadge({ status, className }: AssetRequestStatusBadgeProps) {
  const { variant, className: badgeClassName } = getAssetRequestStatusBadgeVariant(status)
  const label = ASSET_REQUEST_STATUS_LABELS[status] || status

  return (
    <Badge variant={variant} className={cn(badgeClassName, className)}>
      {label}
    </Badge>
  )
}
