/**
 * Componente de tarjeta de estadísticas reutilizable
 * Usado en dashboards de todos los roles
 */

'use client'

import { LucideIcon, TrendingUp, TrendingDown, AlertTriangle, CheckCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface StatsCardProps {
  title: string
  value: string | number
  description?: string
  icon: LucideIcon
  trend?: {
    value: number
    label: string
    isPositive?: boolean
  }
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'gray' | 'primary' | 'yellow'
  loading?: boolean
  onClick?: () => void
  badge?: {
    text: string
    variant?: 'default' | 'secondary' | 'destructive' | 'outline'
  }
  status?: 'normal' | 'warning' | 'error' | 'success'
  subtitle?: string
}

const colorClasses = {
  blue: {
    bg: 'bg-blue-50 dark:bg-blue-950/50',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-200 dark:border-blue-800',
    icon: 'text-blue-600 dark:text-blue-400',
    gradient: 'from-blue-500/10 to-blue-600/5',
  },
  green: {
    bg: 'bg-green-50 dark:bg-green-950/50',
    text: 'text-green-700 dark:text-green-300',
    border: 'border-green-200 dark:border-green-800',
    icon: 'text-green-600 dark:text-green-400',
    gradient: 'from-green-500/10 to-green-600/5',
  },
  purple: {
    bg: 'bg-purple-50 dark:bg-purple-950/50',
    text: 'text-purple-700 dark:text-purple-300',
    border: 'border-purple-200 dark:border-purple-800',
    icon: 'text-purple-600 dark:text-purple-400',
    gradient: 'from-purple-500/10 to-purple-600/5',
  },
  orange: {
    bg: 'bg-orange-50 dark:bg-orange-950/50',
    text: 'text-orange-700 dark:text-orange-300',
    border: 'border-orange-200 dark:border-orange-800',
    icon: 'text-orange-600 dark:text-orange-400',
    gradient: 'from-orange-500/10 to-orange-600/5',
  },
  red: {
    bg: 'bg-red-50 dark:bg-red-950/50',
    text: 'text-red-700 dark:text-red-300',
    border: 'border-red-200 dark:border-red-800',
    icon: 'text-red-600 dark:text-red-400',
    gradient: 'from-red-500/10 to-red-600/5',
  },
  gray: {
    bg: 'bg-gray-50 dark:bg-gray-950/50',
    text: 'text-gray-700 dark:text-gray-300',
    border: 'border-gray-200 dark:border-gray-800',
    icon: 'text-gray-600 dark:text-gray-400',
    gradient: 'from-gray-500/10 to-gray-600/5',
  },
  primary: {
    bg: 'bg-primary/5 dark:bg-primary/10',
    text: 'text-primary',
    border: 'border-primary/20',
    icon: 'text-primary',
    gradient: 'from-primary/10 to-primary/5',
  },
  yellow: {
    bg: 'bg-yellow-50 dark:bg-yellow-950/50',
    text: 'text-yellow-700 dark:text-yellow-300',
    border: 'border-yellow-200 dark:border-yellow-800',
    icon: 'text-yellow-600 dark:text-yellow-400',
    gradient: 'from-yellow-500/10 to-yellow-600/5',
  },
}

const statusIndicators = {
  normal: null,
  warning: { icon: AlertTriangle, color: 'text-yellow-500' },
  error: { icon: AlertTriangle, color: 'text-red-500' },
  success: { icon: CheckCircle, color: 'text-green-500' },
}

export function StatsCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  color = 'blue',
  loading = false,
  onClick,
  badge,
  status = 'normal',
  subtitle,
}: StatsCardProps) {
  const colors = colorClasses[color]
  const statusIndicator = statusIndicators[status]

  if (loading) {
    return (
      <Card className="animate-pulse">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-12"></div>
          </div>
          <div className="space-y-2">
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card
      className={cn(
        'relative overflow-hidden transition-all duration-200 hover:shadow-md border',
        colors.border,
        onClick && 'cursor-pointer hover:scale-[1.02] active:scale-[0.98]',
        `bg-gradient-to-br ${colors.gradient}`
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        {/* Header con icono y badges */}
        <div className="flex items-center justify-between mb-3">
          <div className={cn('p-2 rounded-lg', colors.bg)}>
            <Icon className={cn('h-5 w-5', colors.icon)} />
          </div>
          <div className="flex items-center space-x-1">
            {statusIndicator && (
              <statusIndicator.icon className={cn('h-3 w-3', statusIndicator.color)} />
            )}
            {badge && (
              <Badge 
                variant={badge.variant || 'default'}
                className="text-xs px-2 py-0.5 h-5"
              >
                {badge.text}
              </Badge>
            )}
            {trend && (
              <div
                className={cn(
                  'flex items-center space-x-1 text-xs font-medium px-1.5 py-0.5 rounded-full',
                  trend.isPositive 
                    ? 'text-green-700 bg-green-100 dark:text-green-300 dark:bg-green-900/30' 
                    : 'text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-900/30'
                )}
              >
                {trend.isPositive ? (
                  <TrendingUp className="h-2.5 w-2.5" />
                ) : (
                  <TrendingDown className="h-2.5 w-2.5" />
                )}
                <span className="text-xs font-bold">
                  {trend.value > 0 ? '+' : ''}{trend.value}%
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Contenido principal */}
        <div className="space-y-1">
          {/* Valor principal */}
          <div className="text-2xl font-bold text-foreground tracking-tight">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </div>
          
          {/* Título */}
          <div className="text-sm font-medium text-foreground leading-tight">
            {title}
          </div>
          
          {/* Subtítulo */}
          {subtitle && (
            <div className="text-xs text-muted-foreground">
              {subtitle}
            </div>
          )}
          
          {/* Descripción más pequeña */}
          {description && (
            <div className="text-xs text-muted-foreground line-clamp-1">
              {description}
            </div>
          )}
          
          {/* Trend label */}
          {trend && (
            <div className="text-xs text-muted-foreground">
              {trend.label}
            </div>
          )}
        </div>

        {/* Barra de progreso más delgada */}
        {typeof value === 'string' && value.includes('%') && (
          <div className="mt-3">
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
              <div
                className={cn(
                  'h-1.5 rounded-full transition-all duration-700 ease-out',
                  colors.bg.replace('50', '400').replace('950/50', '600')
                )}
                style={{ 
                  width: value,
                  background: `linear-gradient(90deg, ${colors.icon.includes('blue') ? '#3B82F6' : 
                    colors.icon.includes('green') ? '#10B981' :
                    colors.icon.includes('purple') ? '#8B5CF6' :
                    colors.icon.includes('orange') ? '#F59E0B' :
                    colors.icon.includes('red') ? '#EF4444' : '#6B7280'} 0%, ${colors.icon.includes('blue') ? '#1D4ED8' : 
                    colors.icon.includes('green') ? '#059669' :
                    colors.icon.includes('purple') ? '#7C3AED' :
                    colors.icon.includes('orange') ? '#D97706' :
                    colors.icon.includes('red') ? '#DC2626' : '#4B5563'} 100%)`
                }}
              />
            </div>
          </div>
        )}

        {/* Indicador de estado más pequeño */}
        {status !== 'normal' && (
          <div className={cn(
            'absolute top-2 right-2 w-2 h-2 rounded-full',
            status === 'success' && 'bg-green-500',
            status === 'warning' && 'bg-yellow-500',
            status === 'error' && 'bg-red-500'
          )} />
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Componente de tarjeta de estadística para espacios pequeños
 */
export function SmallStatsCard({
  title,
  value,
  icon: Icon,
  color = 'blue',
  onClick,
}: Pick<StatsCardProps, 'title' | 'value' | 'icon' | 'color' | 'onClick'>) {
  const colors = colorClasses[color]

  return (
    <Card
      className={cn(
        'transition-all hover:shadow-md border',
        onClick && 'cursor-pointer hover:scale-105'
      )}
      onClick={onClick}
    >
      <CardContent className="p-3">
        <div className="flex items-center space-x-3">
          <div className={cn('p-2 rounded-lg', colors.bg)}>
            <Icon className={cn('h-4 w-4', colors.icon)} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-lg font-bold text-foreground">
              {typeof value === 'number' ? value.toLocaleString() : value}
            </div>
            <div className="text-xs text-muted-foreground truncate">{title}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Componente de tarjeta de estadística simétrica
 * Diseño uniforme para todos los roles y módulos
 */
export function SymmetricStatsCard({
  title,
  value,
  icon: Icon,
  color = 'blue',
  badge,
  trend,
  onClick,
  status = 'normal',
  role, // Tema por rol
}: Pick<StatsCardProps, 'title' | 'value' | 'icon' | 'color' | 'badge' | 'trend' | 'onClick' | 'status'> & {
  role?: 'ADMIN' | 'TECHNICIAN' | 'CLIENT'
}) {
  const colors = colorClasses[color]
  const statusIndicator = statusIndicators[status]

  // Temas por rol para consistencia visual
  const roleTheme = role ? {
    ADMIN: 'border-l-purple-500 hover:bg-purple-50/50 dark:hover:bg-purple-950/30',
    TECHNICIAN: 'border-l-green-500 hover:bg-green-50/50 dark:hover:bg-green-950/30', 
    CLIENT: 'border-l-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-950/30'
  }[role] : colors.border

  return (
    <Card
      className={cn(
        'relative overflow-hidden transition-all duration-200 hover:shadow-lg border-l-4 h-[70px]',
        role ? roleTheme : colors.border,
        onClick && 'cursor-pointer hover:scale-[1.01] active:scale-[0.99]',
        'bg-white dark:bg-gray-950 hover:bg-gray-50 dark:hover:bg-gray-900'
      )}
      onClick={onClick}
    >
      <CardContent className="p-2 h-full flex items-center">
        {/* Icono */}
        <div className={cn('p-1 rounded-md mr-2 flex-shrink-0', colors.bg)}>
          <Icon className={cn('h-3.5 w-3.5', colors.icon)} />
        </div>

        {/* Contenido principal horizontal */}
        <div className="flex-1 min-w-0 flex items-center justify-between">
          <div className="flex-1 min-w-0">
            {/* Valor principal */}
            <div className={cn('text-lg font-bold tracking-tight leading-none', colors.text)}>
              {typeof value === 'number' ? value.toLocaleString() : value}
            </div>
            
            {/* Título */}
            <div className="text-xs font-medium text-muted-foreground leading-tight truncate">
              {title}
            </div>
          </div>

          {/* Badges y trend en la derecha */}
          <div className="flex items-center space-x-1 flex-shrink-0 ml-2">
            {statusIndicator && (
              <statusIndicator.icon className={cn('h-2 w-2', statusIndicator.color)} />
            )}
            {badge && (
              <Badge 
                variant={badge.variant || 'default'}
                className="text-xs px-1 py-0 h-3 leading-none"
              >
                {badge.text}
              </Badge>
            )}
            {trend && (
              <div
                className={cn(
                  'flex items-center space-x-0.5 text-xs font-medium px-1 py-0.5 rounded-sm',
                  trend.isPositive 
                    ? 'text-green-700 bg-green-100 dark:text-green-300 dark:bg-green-900/30' 
                    : 'text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-900/30'
                )}
              >
                {trend.isPositive ? (
                  <TrendingUp className="h-1.5 w-1.5" />
                ) : (
                  <TrendingDown className="h-1.5 w-1.5" />
                )}
                <span className="text-xs font-bold">
                  {trend.value > 0 ? '+' : ''}{trend.value}%
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Indicador de estado */}
        {status !== 'normal' && (
          <div className={cn(
            'absolute top-1 right-1 w-1 h-1 rounded-full',
            status === 'success' && 'bg-green-500',
            status === 'warning' && 'bg-yellow-500',
            status === 'error' && 'bg-red-500'
          )} />
        )}
      </CardContent>
    </Card>
  )
}
