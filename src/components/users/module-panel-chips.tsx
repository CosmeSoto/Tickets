'use client'

import { CheckCircle2, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── FamilyChip ────────────────────────────────────────────────────────────────
export function FamilyChip({ name, color }: { name: string; color?: string | null }) {
  return (
    <span className='inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-background border font-medium'>
      {color && (
        <span className='w-1.5 h-1.5 rounded-full shrink-0' style={{ backgroundColor: color }} />
      )}
      {name}
    </span>
  )
}

// ── PermissionBadge ───────────────────────────────────────────────────────────
export function PermissionBadge({ icon, label }: { icon: string; label: string }) {
  return (
    <span className='inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary font-medium'>
      <span>{icon}</span>
      {label}
    </span>
  )
}

// ── ModuleLine ────────────────────────────────────────────────────────────────
export function ModuleLine({
  emoji,
  label,
  active,
  capability,
  families,
  extraPermissions,
}: {
  emoji: string
  label: string
  active: boolean
  capability: string
  families?: Array<{ id: string; name: string; color?: string | null }>
  extraPermissions?: Array<{ icon: string; label: string }>
}) {
  return (
    <div
      className={cn(
        'rounded-lg border px-3 py-2.5 space-y-1.5 transition-colors',
        active ? 'bg-primary/5 border-primary/20' : 'border-border opacity-50'
      )}
    >
      <div className='flex items-center justify-between gap-2'>
        <div className='flex items-center gap-2 min-w-0'>
          <span className='text-base shrink-0'>{emoji}</span>
          <div className='min-w-0'>
            <span className='text-xs font-semibold text-foreground'>{label}</span>
            {active && (
              <p className='text-[10px] text-muted-foreground leading-snug mt-0.5'>{capability}</p>
            )}
          </div>
        </div>
        <div className='shrink-0'>
          {active ? (
            <CheckCircle2 className='h-3.5 w-3.5 text-primary' />
          ) : (
            <XCircle className='h-3.5 w-3.5 text-muted-foreground/40' />
          )}
        </div>
      </div>

      {active && extraPermissions && extraPermissions.length > 0 && (
        <div className='flex flex-wrap gap-1'>
          {extraPermissions.map(p => (
            <PermissionBadge key={p.label} icon={p.icon} label={p.label} />
          ))}
        </div>
      )}

      {active && families && families.length > 0 && (
        <div className='flex flex-wrap gap-1'>
          {families.map(f => (
            <FamilyChip key={f.id} name={f.name} color={f.color} />
          ))}
        </div>
      )}
    </div>
  )
}
