import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { AssetSubtype } from '@/lib/inventory/family-config'

interface SubtypeBadgeProps {
  subtype: AssetSubtype
  size?: 'sm' | 'md'
}

const subtypeConfig: Record<AssetSubtype, { label: string; className: string }> = {
  EQUIPMENT: {
    label: 'Equipo',
    className: 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100',
  },
  MRO: {
    label: 'Material MRO',
    className: 'bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-100',
  },
  LICENSE: {
    label: 'Contrato/Licencia',
    className: 'bg-green-100 text-green-800 border-green-200 hover:bg-green-100',
  },
}

export function SubtypeBadge({ subtype, size = 'md' }: SubtypeBadgeProps) {
  const config = subtypeConfig[subtype]
  return (
    <Badge
      className={cn(
        config.className,
        size === 'sm' && 'px-1.5 py-0 text-[10px]'
      )}
    >
      {config.label}
    </Badge>
  )
}
