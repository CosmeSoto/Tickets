'use client'

import { Clock, Package, Edit, UserPlus, RotateCcw, Wrench, AlertCircle } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'
import type { EquipmentHistoryEvent } from '@/types/inventory/equipment'

interface EquipmentHistoryProps {
  history: EquipmentHistoryEvent[]
}

const EVENT_ICONS: Record<string, any> = {
  CREATED: Package,
  UPDATED: Edit,
  ASSIGNED: UserPlus,
  RETURNED: RotateCcw,
  MAINTENANCE: Wrench,
  STATUS_CHANGE: AlertCircle,
  CONDITION_CHANGE: AlertCircle,
}

const EVENT_COLORS: Record<string, string> = {
  CREATED: 'text-green-500',
  UPDATED: 'text-blue-500',
  ASSIGNED: 'text-purple-500',
  RETURNED: 'text-orange-500',
  MAINTENANCE: 'text-yellow-500',
  STATUS_CHANGE: 'text-red-500',
  CONDITION_CHANGE: 'text-red-500',
}

export function EquipmentHistory({ history }: EquipmentHistoryProps) {
  if (!history || history.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No hay eventos registrados
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {history.map((event) => {
        const Icon = EVENT_ICONS[event.type] || Clock
        const colorClass = EVENT_COLORS[event.type] || 'text-muted-foreground'

        return (
          <div key={event.id} className="flex gap-4">
            <div className={`flex-shrink-0 ${colorClass}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="flex-1 space-y-1">
              <p className="text-sm font-medium">{event.description}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>{formatDateTime(event.timestamp)}</span>
                {event.userName && (
                  <>
                    <span>•</span>
                    <span>{event.userName}</span>
                  </>
                )}
              </div>
              {event.metadata && Object.keys(event.metadata).length > 0 && (
                <div className="mt-2 rounded-md bg-muted/50 p-2 text-xs text-muted-foreground space-y-1">
                  {Object.entries(event.metadata).map(([key, value]) => (
                    <div key={key} className="flex gap-2">
                      <span className="font-medium min-w-[120px]">{key}:</span>
                      <span>{String(value)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
