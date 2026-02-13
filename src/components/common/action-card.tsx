/**
 * Componente de tarjeta de acción
 * Diseño simétrico y consistente para todos los roles
 */

'use client'

import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

type ColorVariant = 'blue' | 'green' | 'purple' | 'orange' | 'primary' | 'red' | 'yellow'
type UserRole = 'ADMIN' | 'TECHNICIAN' | 'CLIENT'

interface ActionCardProps {
  href: string
  icon: LucideIcon
  title: string
  description: string
  color?: ColorVariant
  role?: UserRole
  badge?: string | number
  onClick?: () => void
  disabled?: boolean
}

const colorClasses: Record<ColorVariant, { 
  border: string
  bg: string
  icon: string
  hover: string
}> = {
  blue: {
    border: 'border-l-blue-500',
    bg: 'bg-blue-100 dark:bg-blue-900/50',
    icon: 'text-blue-600 dark:text-blue-400',
    hover: 'hover:border-blue-300 hover:bg-blue-50/50',
  },
  green: {
    border: 'border-l-green-500',
    bg: 'bg-green-100 dark:bg-green-900/50',
    icon: 'text-green-600 dark:text-green-400',
    hover: 'hover:border-green-300 hover:bg-green-50/50',
  },
  purple: {
    border: 'border-l-purple-500',
    bg: 'bg-purple-100 dark:bg-purple-900/50',
    icon: 'text-purple-600 dark:text-purple-400',
    hover: 'hover:border-purple-300 hover:bg-purple-50/50',
  },
  orange: {
    border: 'border-l-orange-500',
    bg: 'bg-orange-100 dark:bg-orange-900/50',
    icon: 'text-orange-600 dark:text-orange-400',
    hover: 'hover:border-orange-300 hover:bg-orange-50/50',
  },
  red: {
    border: 'border-l-red-500',
    bg: 'bg-red-100 dark:bg-red-900/50',
    icon: 'text-red-600 dark:text-red-400',
    hover: 'hover:border-red-300 hover:bg-red-50/50',
  },
  yellow: {
    border: 'border-l-yellow-500',
    bg: 'bg-yellow-100 dark:bg-yellow-900/50',
    icon: 'text-yellow-600 dark:text-yellow-400',
    hover: 'hover:border-yellow-300 hover:bg-yellow-50/50',
  },
  primary: {
    border: 'border-l-primary',
    bg: 'bg-primary/10',
    icon: 'text-primary',
    hover: 'hover:border-primary/50 hover:bg-primary/5',
  },
}

// Temas por rol para consistencia visual
const roleThemes: Record<UserRole, {
  border: string
  hover: string
}> = {
  ADMIN: {
    border: 'border-l-purple-500',
    hover: 'hover:border-purple-300 hover:bg-purple-50/30 dark:hover:bg-purple-950/30',
  },
  TECHNICIAN: {
    border: 'border-l-green-500', 
    hover: 'hover:border-green-300 hover:bg-green-50/30 dark:hover:bg-green-950/30',
  },
  CLIENT: {
    border: 'border-l-blue-500',
    hover: 'hover:border-blue-300 hover:bg-blue-50/30 dark:hover:bg-blue-950/30',
  },
}

export function ActionCard({
  href,
  icon: Icon,
  title,
  description,
  color = 'primary',
  role,
  badge,
  onClick,
  disabled = false,
}: ActionCardProps) {
  const colors = colorClasses[color]
  const roleTheme = role ? roleThemes[role] : null

  const cardContent = (
    <Card
      className={cn(
        'h-[100px] transition-all duration-200 cursor-pointer border-l-4 group',
        'hover:shadow-md hover:scale-[1.01] active:scale-[0.99]',
        role ? roleTheme?.border : colors.border,
        role ? roleTheme?.hover : colors.hover,
        disabled && 'opacity-50 cursor-not-allowed hover:scale-100 hover:shadow-none'
      )}
      onClick={disabled ? undefined : onClick}
    >
      <CardContent className='p-3 h-full flex items-center'>
        {/* Icono */}
        <div className={cn(
          'p-2 rounded-lg mr-3 flex-shrink-0 transition-colors',
          colors.bg,
          'group-hover:scale-110'
        )}>
          <Icon className={cn('h-5 w-5', colors.icon)} />
        </div>

        {/* Contenido principal */}
        <div className='flex-1 min-w-0'>
          <div className='flex items-start justify-between mb-1'>
            <h3 className='font-semibold text-foreground text-sm leading-tight truncate'>
              {title}
            </h3>
            {badge !== undefined && (
              <Badge 
                variant="secondary" 
                className="text-xs ml-2 flex-shrink-0 h-4 px-1.5"
              >
                {badge}
              </Badge>
            )}
          </div>
          <p className='text-xs text-muted-foreground line-clamp-2 leading-relaxed'>
            {description}
          </p>
        </div>

        {/* Indicador visual de acción */}
        <div className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-1 h-8 bg-gradient-to-b from-transparent via-primary/50 to-transparent rounded-full" />
        </div>
      </CardContent>
    </Card>
  )

  if (disabled || onClick) {
    return cardContent
  }

  return <Link href={href}>{cardContent}</Link>
}

/**
 * Grid de acciones rápidas con layout responsivo
 */
interface ActionGridProps {
  actions: Omit<ActionCardProps, 'role'>[]
  role?: UserRole
  columns?: 1 | 2 | 3 | 4
  className?: string
}

export function ActionGrid({
  actions,
  role,
  columns = 2,
  className
}: ActionGridProps) {
  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
  }

  return (
    <div className={cn(
      'grid gap-4',
      gridCols[columns],
      className
    )}>
      {actions.map((action, index) => (
        <ActionCard
          key={`${action.href}-${index}`}
          {...action}
          role={role}
        />
      ))}
    </div>
  )
}