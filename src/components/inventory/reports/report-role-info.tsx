'use client'

import { Crown, Info, Shield, Users } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { InventoryReportRole } from '@/lib/inventory/reports/types'
import {
  getReportRoleCapabilities,
} from '@/lib/inventory/reports/catalog'

const ROLE_ICONS: Record<InventoryReportRole, typeof Shield> = {
  SUPER_ADMIN: Crown,
  ADMIN: Shield,
  MANAGER: Users,
}

export function ReportRoleInfo({ userRole }: { userRole: InventoryReportRole }) {
  const caps = getReportRoleCapabilities(userRole)
  const Icon = ROLE_ICONS[userRole]

  return (
    <Card className='border-muted bg-muted/20'>
      <CardContent className='pt-4 pb-4'>
        <div className='flex flex-col sm:flex-row sm:items-start gap-3'>
          <div className='flex items-center gap-2 shrink-0'>
            <Icon className='h-4 w-4 text-primary' />
            <Badge variant='outline'>{caps.label}</Badge>
          </div>
          <div className='space-y-2 text-sm text-muted-foreground flex-1'>
            <p className='flex items-start gap-2'>
              <Info className='h-4 w-4 shrink-0 mt-0.5' />
              <span>{caps.description}</span>
            </p>
            <ul className='grid gap-1 sm:grid-cols-2 text-xs'>
              <li>
                <strong className='text-foreground'>Datos:</strong> {caps.dataScope}
              </li>
              <li>
                <strong className='text-foreground'>Plantillas:</strong> {caps.templateAccess}
              </li>
              <li>
                <strong className='text-foreground'>Guardar / anclar:</strong>{' '}
                {caps.canSaveReports ? 'Sí' : 'No'}
              </li>
              <li>
                <strong className='text-foreground'>Envíos programados:</strong>{' '}
                {caps.canScheduleEmail ? 'Sí (requiere consulta guardada)' : 'No'}
              </li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
