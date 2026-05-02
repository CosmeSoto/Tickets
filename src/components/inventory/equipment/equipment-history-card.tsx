/**
 * Equipment History Card Component
 */

import { FileText } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EquipmentHistory } from '../equipment-history'
import type { EquipmentHistoryEvent } from '@/types/inventory/equipment'

interface EquipmentHistoryCardProps {
  history: EquipmentHistoryEvent[]
}

export function EquipmentHistoryCard({ history }: EquipmentHistoryCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <FileText className='h-5 w-5' />
          Historial
        </CardTitle>
        <CardDescription>Registro completo de eventos del equipo</CardDescription>
      </CardHeader>
      <CardContent>
        <EquipmentHistory history={history} />
      </CardContent>
    </Card>
  )
}
