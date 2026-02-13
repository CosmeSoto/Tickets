/**
 * Componente base estandarizado para paneles de estadísticas
 * Elimina redundancias y mantiene consistencia visual
 */

'use client'

import { Card, CardContent } from '@/components/ui/card'
import { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface StatCard {
  title: string
  value: number | string
  icon: LucideIcon
  color: string
  bgColor: string
  borderColor: string
  description: string
  percentage?: number
  isTime?: boolean
  isPercentage?: boolean
}

interface StatsPanelBaseProps {
  statCards: StatCard[]
  loading?: boolean
  columns?: 'auto' | 4 | 5 | 6
  className?: string
}

export function StatsPanelBase({ 
  statCards, 
  loading = false, 
  columns = 4,
  className 
}: StatsPanelBaseProps) {
  const gridCols = {
    'auto': 'grid-cols-1 md:grid-cols-2 lg:grid-cols-auto',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
    5: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-5',
    6: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-6'
  }

  if (loading) {
    return (
      <div className={cn(`grid ${gridCols[columns]} gap-4 mb-6`, className)}>
        {[...Array(statCards.length || 8)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="h-16 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className={cn(`grid ${gridCols[columns]} gap-4 mb-6`, className)}>
      {statCards.map((stat, index) => {
        const Icon = stat.icon
        return (
          <Card 
            key={index} 
            className={cn(
              "border-l-4 hover:shadow-md transition-shadow",
              stat.borderColor
            )}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <div className={cn("p-2 rounded-lg", stat.bgColor)}>
                      <Icon className={cn("h-4 w-4", stat.color)} />
                    </div>
                    <p className="text-xs font-medium text-muted-foreground">
                      {stat.title}
                    </p>
                  </div>
                  
                  <div className="space-y-1">
                    <p className={cn(
                      "text-2xl font-bold",
                      stat.color
                    )}>
                      {stat.isTime 
                        ? stat.value 
                        : stat.isPercentage 
                          ? stat.value 
                          : typeof stat.value === 'number' 
                            ? stat.value.toLocaleString() 
                            : stat.value
                      }
                    </p>
                    
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        {stat.description}
                      </p>
                      {stat.percentage !== undefined && !stat.isPercentage && (
                        <span className={cn(
                          "text-xs font-semibold px-2 py-0.5 rounded-full",
                          stat.bgColor,
                          stat.color
                        )}>
                          {stat.percentage}%
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}