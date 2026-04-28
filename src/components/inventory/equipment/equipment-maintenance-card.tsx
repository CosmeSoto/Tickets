/**
 * Equipment Maintenance Card Component
 */

import { Wrench, ExternalLink } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDate, formatCurrency } from '@/lib/utils'
import {
  MAINTENANCE_STATUS_BADGE,
  MAINTENANCE_STATUS_LABEL,
  MAINTENANCE_TYPE_LABEL,
} from './utils/equipment-constants'
import type { MaintenanceRecord, EquipmentStatus } from './utils/equipment-types'

interface EquipmentMaintenanceCardProps {
  maintenanceRecords: MaintenanceRecord[]
  equipmentStatus: EquipmentStatus
}

export function EquipmentMaintenanceCard({
  maintenanceRecords,
  equipmentStatus,
}: EquipmentMaintenanceCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <Wrench className='h-5 w-5' />
          Mantenimientos
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className='space-y-3'>
          {maintenanceRecords.map((record, index) => {
            const isActive = equipmentStatus === 'MAINTENANCE' && index === 0
            return (
              <a
                key={record.id}
                href={`/inventory/maintenance/${record.id}`}
                className={`flex justify-between items-start p-3 rounded-lg border transition-colors hover:bg-muted/50 cursor-pointer ${
                  isActive
                    ? 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30'
                    : 'border-border'
                }`}
              >
                <div className='space-y-1'>
                  <div className='flex items-center gap-2'>
                    <span className='font-medium text-sm'>
                      {MAINTENANCE_TYPE_LABEL[record.type]}
                    </span>
                    {record.status && (
                      <Badge
                        className={`text-xs ${MAINTENANCE_STATUS_BADGE[record.status] || 'bg-muted text-muted-foreground'}`}
                      >
                        {MAINTENANCE_STATUS_LABEL[record.status] || record.status}
                      </Badge>
                    )}
                  </div>
                  <p className='text-sm text-muted-foreground'>{record.description}</p>
                  <p className='text-xs text-muted-foreground'>
                    {formatDate(record.date)}
                    {record.technician?.name ? ` — ${record.technician.name}` : ''}
                  </p>
                </div>
                <div className='flex items-center gap-2 flex-shrink-0'>
                  {record.cost && (
                    <span className='text-sm font-medium'>{formatCurrency(record.cost)}</span>
                  )}
                  <ExternalLink className='h-3 w-3 text-muted-foreground' />
                </div>
              </a>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
