'use client'

/**
 * RoleBadge — componente centralizado para mostrar el badge de rol de un usuario.
 * Maneja automáticamente la diferenciación entre Admin y Super Admin.
 *
 * Uso:
 *   <RoleBadge role={user.role} isSuperAdmin={user.isSuperAdmin} />
 *   <RoleBadge role={user.role} isSuperAdmin={user.isSuperAdmin} size="sm" />
 */

import { Badge } from '@/components/ui/badge'
import { Shield, Wrench, UserCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/lib/constants/user-constants'
import { USER_ROLE_COLORS, USER_ROLE_LABELS, USER_ROLE_ICONS } from '@/lib/constants/user-constants'

// ── Ícono SVG de corona inline (no depende de lucide) ────────────────────────
function CrownIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm2.7 2a1 1 0 0 0 0 2h8.6a1 1 0 0 0 0-2H7.7z" />
    </svg>
  )
}

// ── Helpers exportados para uso fuera del componente ─────────────────────────

export function getRoleLabel(role: string, isSuperAdmin?: boolean): string {
  if (role === 'ADMIN' && isSuperAdmin) return 'Super Admin'
  return USER_ROLE_LABELS[role as UserRole] ?? role
}

export function getRoleColor(role: string, isSuperAdmin?: boolean): string {
  if (role === 'ADMIN' && isSuperAdmin) {
    return 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700'
  }
  return USER_ROLE_COLORS[role as UserRole] ?? 'bg-gray-100 text-gray-700 border-gray-200'
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface RoleBadgeProps {
  role: string
  isSuperAdmin?: boolean
  className?: string
  /** 'sm' = h-3 w-3, 'md' = h-3.5 w-3.5 (default) */
  iconSize?: 'sm' | 'md'
}

// ── Componente ────────────────────────────────────────────────────────────────

export function RoleBadge({ role, isSuperAdmin, className, iconSize = 'md' }: RoleBadgeProps) {
  const iconClass = iconSize === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'
  const RoleIcon = USER_ROLE_ICONS[role as UserRole]

  if (role === 'ADMIN' && isSuperAdmin) {
    return (
      <Badge
        className={cn(
          'flex items-center gap-1 w-fit text-xs',
          'bg-amber-100 text-amber-700 border-amber-300',
          'dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700',
          className
        )}
      >
        <CrownIcon className={iconClass} />
        Super Admin
      </Badge>
    )
  }

  if (!RoleIcon) {
    return (
      <Badge className={cn('w-fit text-xs', USER_ROLE_COLORS[role as UserRole], className)}>
        {USER_ROLE_LABELS[role as UserRole] ?? role}
      </Badge>
    )
  }

  return (
    <Badge className={cn('flex items-center gap-1 w-fit text-xs', USER_ROLE_COLORS[role as UserRole], className)}>
      <RoleIcon className={iconClass} />
      {USER_ROLE_LABELS[role as UserRole]}
    </Badge>
  )
}
