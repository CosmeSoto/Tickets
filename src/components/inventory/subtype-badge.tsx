import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { AssetSubtype } from '@/lib/inventory/family-config'
import { getSubtypeConfig } from '@/lib/utils/inventory-utils'

interface SubtypeBadgeProps {
  subtype: AssetSubtype
  size?: 'sm' | 'md'
}

export function SubtypeBadge({ subtype, size = 'md' }: SubtypeBadgeProps) {
  const config = getSubtypeConfig(subtype)
  return (
    <Badge className={cn(config.className, size === 'sm' && 'px-1.5 py-0 text-[10px]')}>
      {config.label}
    </Badge>
  )
}
