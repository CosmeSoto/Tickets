/**
 * Barra de estadísticas con badges
 * Grid responsive con colores semánticos
 */

'use client'

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Stat } from '@/types/common'

export interface StatsBarProps {
  stats: Stat[]
  columns?: number
  className?: string
  loading?: boolean
}

const colorClasses = {
  blue: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300',
  green: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300',
  yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-300',
  purple: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300',
  orange: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300',
  red: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300',
  gray: 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-950 dark:text-gray-300'
}

export function StatsBar({ 
  stats, 
  columns = 4, 
  className,
  loading = false 
}: StatsBarProps) {
  if (loading) {
    return (
      <div className={cn(
        'grid gap-4',
        columns === 2 && 'grid-cols-1 sm:grid-cols-2',
        columns === 3 && 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
        columns === 4 && 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
        columns === 5 && 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5',
        className
      )}>
        {Array.from({ length: columns }).map((_, i) => (
          <Card key={i} className='p-4'>
            <div className='animate-pulse space-y-2'>
              <div className='h-4 bg-muted rounded w-20' />
              <div className='h-8 bg-muted rounded w-16' />
            </div>
          </Card>
        ))}
      </div>
    )
  }

  if (stats.length === 0) {
    return null
  }

  return (
    <div className={cn(
      'grid gap-4',
      columns === 2 && 'grid-cols-1 sm:grid-cols-2',
      columns === 3 && 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
      columns === 4 && 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
      columns === 5 && 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5',
      className
    )}>
      {stats.map((stat, index) => (
        <StatCard key={index} stat={stat} />
      ))}
    </div>
  )
}

interface StatCardProps {
  stat: Stat
}

function StatCard({ stat }: StatCardProps) {
  const colorClass = colorClasses[stat.color || 'gray']
  const isClickable = !!stat.onClick

  return (
    <Card
      className={cn(
        'p-4 transition-all',
        isClickable && 'cursor-pointer hover:shadow-md hover:scale-105'
      )}
      onClick={stat.onClick}
      title={stat.tooltip}
    >
      <div className='flex items-start justify-between'>
        <div className='flex-1'>
          <p className='text-sm font-medium text-muted-foreground mb-1'>
            {stat.label}
          </p>
          <div className='flex items-baseline space-x-2'>
            <p className='text-2xl font-bold'>
              {stat.value}
            </p>
            {stat.trend && (
              <Badge 
                variant='outline' 
                className={cn(
                  'h-5 px-1.5 text-xs',
                  stat.trend.direction === 'up' 
                    ? 'text-green-600 border-green-200' 
                    : 'text-red-600 border-red-200'
                )}
              >
                {stat.trend.direction === 'up' ? (
                  <TrendingUp className='h-3 w-3 mr-1' />
                ) : (
                  <TrendingDown className='h-3 w-3 mr-1' />
                )}
                {Math.abs(stat.trend.value)}%
              </Badge>
            )}
          </div>
        </div>
        
        {stat.icon && (
          <div className={cn(
            'p-2 rounded-lg border',
            colorClass
          )}>
            {stat.icon}
          </div>
        )}
      </div>
    </Card>
  )
}
