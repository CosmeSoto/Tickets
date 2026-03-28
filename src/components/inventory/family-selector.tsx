'use client'

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

interface FamilySelectorProps {
  families: Array<{
    id: string
    name: string
    icon?: string | null
    color?: string | null
    code: string
  }>
  selectedId?: string | null
  onSelect: (familyId: string) => void
  disabled?: boolean
}

export function FamilySelector({
  families,
  selectedId,
  onSelect,
  disabled = false,
}: FamilySelectorProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {families.map((family) => {
        const color = family.color ?? '#6B7280'
        const isSelected = family.id === selectedId
        const IconComponent = family.icon ? (ICON_MAP[family.icon] ?? null) : null

        return (
          <button
            key={family.id}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(family.id)}
            className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 text-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${
              isSelected
                ? 'shadow-sm'
                : 'border-border bg-card hover:border-muted-foreground/30 hover:bg-accent'
            }`}
            style={
              isSelected
                ? {
                    borderColor: color,
                    backgroundColor: color + '10',
                  }
                : undefined
            }
          >
            <span
              className="flex h-10 w-10 items-center justify-center rounded-full"
              style={{ backgroundColor: color + '20', color }}
            >
              {IconComponent ? (
                <IconComponent className="h-5 w-5" />
              ) : (
                <span className="text-xs font-bold">{family.code.slice(0, 2)}</span>
              )}
            </span>
            <span
              className={`text-sm font-medium leading-tight ${isSelected ? '' : 'text-foreground'}`}
              style={isSelected ? { color } : undefined}
            >
              {family.name}
            </span>
          </button>
        )
      })}
    </div>
  )
}
