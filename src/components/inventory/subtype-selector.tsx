import { Monitor, Wrench, Key } from 'lucide-react'
import { AssetSubtype } from '@/lib/inventory/family-config'

interface SubtypeSelectorProps {
  allowedSubtypes: AssetSubtype[]
  onSelect: (subtype: AssetSubtype) => void
}

const SUBTYPE_CONFIG: Record<AssetSubtype, { icon: React.ElementType; label: string }> = {
  EQUIPMENT: { icon: Monitor, label: 'Equipo Físico' },
  MRO: { icon: Wrench, label: 'Material MRO' },
  LICENSE: { icon: Key, label: 'Contrato / Licencia' },
}

export function SubtypeSelector({ allowedSubtypes, onSelect }: SubtypeSelectorProps) {
  return (
    <div className="flex flex-wrap gap-4">
      {allowedSubtypes.map((subtype) => {
        const { icon: Icon, label } = SUBTYPE_CONFIG[subtype]
        return (
          <button
            key={subtype}
            type="button"
            onClick={() => onSelect(subtype)}
            className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card p-6 shadow-sm transition-colors hover:border-primary/50 hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 cursor-pointer min-w-[140px]"
          >
            <Icon className="h-8 w-8 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">{label}</span>
          </button>
        )
      })}
    </div>
  )
}
