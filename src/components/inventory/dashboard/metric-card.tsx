'use client'

import { LucideIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface MetricCardProps {
  title: string
  value: string | number
  icon: LucideIcon
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'gray'
  subtitle?: string
  trend?: {
    value: number
    isPositive: boolean
  }
}

const colorClasses = {
  blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
  green: 'bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400',
  yellow: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-400',
  red: 'bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400',
  purple: 'bg-purple-100 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400',
  gray: 'bg-gray-100 text-gray-600 dark:bg-gray-900/20 dark:text-gray-400',
}

export function MetricCard({
  title,
  value,
  icon: Icon,
  color = 'blue',
  subtitle,
  trend,
}: MetricCardProps) {
  return (
    <Card>
      <CardContent className='p-6'>
        <div className='flex items-start justify-between'>
          <div className='flex-1'>
            <p className='text-sm font-medium text-muted-foreground'>{title}</p>
            <div className='mt-2 flex items-baseline gap-2'>
              <h3 className='text-2xl font-bold'>{value}</h3>
              {trend && (
                <span
                  className={cn(
                    'text-xs font-medium',
                    trend.isPositive ? 'text-green-600' : 'text-red-600'
                  )}
                >
                  {trend.isPositive ? '+' : ''}
                  {trend.value}%
                </span>
              )}
            </div>
            {subtitle && <p className='mt-1 text-xs text-muted-foreground'>{subtitle}</p>}
          </div>
          <div className={cn('rounded-lg p-3', colorClasses[color])}>
            <Icon className='h-5 w-5' />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function MetricCardSkeleton() {
  return (
    <Card>
      <CardContent className='p-6'>
        <div className='flex items-start justify-between'>
          <div className='flex-1 space-y-3'>
            <div className='h-4 w-24 animate-pulse rounded bg-muted' />
            <div className='h-8 w-20 animate-pulse rounded bg-muted' />
          </div>
          <div className='h-11 w-11 animate-pulse rounded-lg bg-muted' />
        </div>
      </CardContent>
    </Card>
  )
}
