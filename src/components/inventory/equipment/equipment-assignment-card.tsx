/**
 * Equipment Assignment Card Component
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDate } from '@/lib/utils'
import type { Assignment } from './utils/equipment-types'

interface EquipmentAssignmentCardProps {
  assignment: Assignment
}

export function EquipmentAssignmentCard({ assignment }: EquipmentAssignmentCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Asignación Actual</CardTitle>
      </CardHeader>
      <CardContent className='space-y-2'>
        <div>
          <label className='text-sm font-medium text-muted-foreground'>Asignado a</label>
          <p className='text-sm'>{assignment.receiver?.name}</p>
          <p className='text-xs text-muted-foreground'>{assignment.receiver?.email}</p>
        </div>
        <div>
          <label className='text-sm font-medium text-muted-foreground'>Fecha de Asignación</label>
          <p className='text-sm'>{formatDate(assignment.startDate)}</p>
        </div>
        {assignment.endDate && (
          <div>
            <label className='text-sm font-medium text-muted-foreground'>Fecha de Devolución</label>
            <p className='text-sm'>{formatDate(assignment.endDate)}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
