'use client'

import { Badge } from '@/components/ui/badge'
import { AssetType } from '@prisma/client'
import { Monitor, Key, Wrench } from 'lucide-react'

interface AssetTypeBadgeProps {
  type: AssetType
  className?: string
}

const TYPE_CONFIG: Record<AssetType, { label: string; icon: any; color: string }> = {
  EQUIPMENT: {
    label: 'Equipo',
    icon: Monitor,
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  },
  LICENSE: {
    label: 'Licencia',
    icon: Key,
    color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  },
  MAINTENANCE: {
    label: 'Mantenimiento',
    icon: Wrench,
    color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  },
}

export function AssetTypeBadge({ type, className }: AssetTypeBadgeProps) {
  const config = TYPE_CONFIG[type]
  const Icon = config.icon

  return (
    <Badge variant='outline' className={`${config.color} ${className}`}>
      <Icon className='mr-1 h-3 w-3' />
      {config.label}
    </Badge>
  )
}
