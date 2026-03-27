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

interface FamilyFilterBarProps {
  families: Array<{
    id: string
    name: string
    icon?: string | null
    color?: string | null
  }>
  selectedId?: string | null
  onChange: (familyId: string | null) => void
}

export function FamilyFilterBar({ families, selectedId, onChange }: FamilyFilterBarProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {/* Chip "Todos" */}
      <button
        type="button"
        onClick={() => onChange(null)}
        className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ${
          selectedId === null || selectedId === undefined
            ? 'bg-gray-800 text-white'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      >
        Todos
      </button>

      {/* Chips de familias */}
      {families.map((family) => {
        const color = family.color ?? '#6B7280'
        const isActive = family.id === selectedId
        const IconComponent = family.icon ? (ICON_MAP[family.icon] ?? null) : null

        return (
          <button
            key={family.id}
            type="button"
            onClick={() => onChange(family.id)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
            style={
              isActive
                ? { backgroundColor: color + '20', color, outlineColor: color }
                : { backgroundColor: '#F3F4F6', color: '#4B5563' }
            }
          >
            {IconComponent && (
              <IconComponent style={{ width: 14, height: 14 }} />
            )}
            {family.name}
          </button>
        )
      })}
    </div>
  )
}
