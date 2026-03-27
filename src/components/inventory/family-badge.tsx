import {
  Building2,
  Wrench,
  Sparkles,
  Shield,
  Monitor,
  TreePine,
  FolderOpen,
  Store,
  type LucideIcon,
} from 'lucide-react'

const ICON_MAP: Record<string, LucideIcon> = {
  'building-2': Building2,
  'wrench': Wrench,
  'sparkles': Sparkles,
  'shield': Shield,
  'monitor': Monitor,
  'tree-pine': TreePine,
  'folder-open': FolderOpen,
  'store': Store,
}

interface FamilyBadgeProps {
  family: { name: string; icon?: string | null; color?: string | null }
  size?: 'sm' | 'md'
}

export function FamilyBadge({ family, size = 'md' }: FamilyBadgeProps) {
  const color = family.color ?? '#6B7280'
  const IconComponent = family.icon ? (ICON_MAP[family.icon] ?? null) : null

  const iconSize = size === 'sm' ? 12 : 16
  const textClass = size === 'sm' ? 'text-xs' : 'text-sm'
  const paddingClass = size === 'sm' ? 'px-2 py-0.5' : 'px-2.5 py-1'

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${textClass} ${paddingClass}`}
      style={{ backgroundColor: color + '20', color }}
    >
      {IconComponent && (
        <IconComponent style={{ width: iconSize, height: iconSize }} />
      )}
      {family.name}
    </span>
  )
}
