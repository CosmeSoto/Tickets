import * as React from 'react'
import { Badge, BadgeProps } from './badge'
import { designSystem } from '@/lib/ui/design-system'
import { cn } from '@/lib/utils'
import { getStatusConfig, getPriorityConfig, type Ticket } from '@/hooks/use-ticket-data'
import { 
  USER_ROLE_COLORS,
  type UserRole
} from '@/lib/constants/user-constants'

// Status Badge Props
interface StatusBadgeProps extends Omit<BadgeProps, 'variant'> {
  status: Ticket['status']
  size?: 'sm' | 'md' | 'lg'
}

// Priority Badge Props
interface PriorityBadgeProps extends Omit<BadgeProps, 'variant'> {
  priority: Ticket['priority']
  size?: 'sm' | 'md' | 'lg'
}

// Status Badge Component
export const StatusBadge = React.forwardRef<HTMLDivElement, StatusBadgeProps>(
  ({ status, size = 'md', className, ...props }, ref) => {
    const config = getStatusConfig(status)
    if (!config) return null

    const sizeStyles = {
      sm: 'px-2 py-0.5 text-xs',
      md: 'px-2.5 py-0.5 text-xs',
      lg: 'px-3 py-1 text-sm',
    }

    const statusDotColors = {
      OPEN: 'bg-blue-500',
      IN_PROGRESS: 'bg-yellow-500',
      RESOLVED: 'bg-green-500',
      CLOSED: 'bg-muted0',
      ON_HOLD: 'bg-purple-500'
    }

    return (
      <div
        ref={ref}
        className={cn(
          'inline-flex items-center font-medium border rounded-full',
          config.color.replace('bg-', 'bg-').replace('text-', 'text-') + ' border-current border-opacity-20',
          sizeStyles[size],
          className
        )}
        {...props}
      >
        <div className={cn(
          'w-1.5 h-1.5 rounded-full mr-1.5',
          statusDotColors[status] || 'bg-muted0'
        )} />
        {config.label}
      </div>
    )
  }
)
StatusBadge.displayName = 'StatusBadge'

// Priority Badge Component
export const PriorityBadge = React.forwardRef<HTMLDivElement, PriorityBadgeProps>(
  ({ priority, size = 'md', className, ...props }, ref) => {
    const config = getPriorityConfig(priority)
    if (!config) return null

    const sizeStyles = {
      sm: 'px-2 py-0.5 text-xs',
      md: 'px-2.5 py-0.5 text-xs',
      lg: 'px-3 py-1 text-sm',
    }

    const priorityIcons = {
      LOW: '↓',
      MEDIUM: '→',
      HIGH: '↑',
      URGENT: '⚠',
    }

    return (
      <div
        ref={ref}
        className={cn(
          'inline-flex items-center font-medium border rounded-full',
          config.color.replace('bg-', 'bg-').replace('text-', 'text-') + ' border-current border-opacity-20',
          sizeStyles[size],
          className
        )}
        {...props}
      >
        <span className="mr-1">{priorityIcons[priority]}</span>
        {config.label}
      </div>
    )
  }
)
PriorityBadge.displayName = 'PriorityBadge'

// Category Badge Component
interface CategoryBadgeProps extends Omit<BadgeProps, 'variant'> {
  category: {
    name: string
    color?: string
  }
  size?: 'sm' | 'md' | 'lg'
}

export const CategoryBadge = React.forwardRef<HTMLDivElement, CategoryBadgeProps>(
  ({ category, size = 'md', className, ...props }, ref) => {
    const sizeStyles = {
      sm: 'px-2 py-0.5 text-xs',
      md: 'px-2.5 py-0.5 text-xs',
      lg: 'px-3 py-1 text-sm',
    }

    const backgroundColor = category.color || designSystem.colors.gray[100]
    const textColor = category.color ? 'white' : designSystem.colors.gray[800]

    return (
      <div
        ref={ref}
        className={cn(
          'inline-flex items-center font-medium border-0 rounded-full',
          sizeStyles[size],
          className
        )}
        style={{
          backgroundColor,
          color: textColor,
        }}
        {...props}
      >
        {category.name}
      </div>
    )
  }
)
CategoryBadge.displayName = 'CategoryBadge'

// User Badge Component
interface UserBadgeProps extends Omit<BadgeProps, 'variant'> {
  user: {
    name: string
    email?: string
    role?: UserRole
  }
  size?: 'sm' | 'md' | 'lg'
  showRole?: boolean
}

export const UserBadge = React.forwardRef<HTMLDivElement, UserBadgeProps>(
  ({ user, size = 'md', showRole = false, className, ...props }, ref) => {
    const sizeStyles = {
      sm: 'px-2 py-0.5 text-xs',
      md: 'px-2.5 py-0.5 text-xs',
      lg: 'px-3 py-1 text-sm',
    }

    const roleColor = user.role && USER_ROLE_COLORS[user.role] 
      ? USER_ROLE_COLORS[user.role]
      : 'bg-muted text-foreground border-border'

    return (
      <div
        ref={ref}
        className={cn(
          'inline-flex items-center font-medium border rounded-full',
          showRole ? roleColor : 'bg-muted text-foreground border-border',
          sizeStyles[size],
          className
        )}
        title={user.email}
        {...props}
      >
        <div className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5" />
        {user.name}
        {showRole && user.role && (
          <span className="ml-1 opacity-75">
            ({user.role.toLowerCase()})
          </span>
        )}
      </div>
    )
  }
)
UserBadge.displayName = 'UserBadge'