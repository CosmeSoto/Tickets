/**
 * Ticket Global Rules Tab Component
 */

import { Info, Layers, Users, Clock, Bell } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Family, GlobalSettings } from '@/hooks/use-ticket-settings'

interface TicketGlobalTabProps {
  families: Family[]
  globalSettings: GlobalSettings
  onSetGlobal: <K extends keyof GlobalSettings>(key: K, value: GlobalSettings[K]) => void
}

export function TicketGlobalTab({ families, globalSettings, onSetGlobal }: TicketGlobalTabProps) {
  return (
    <div className='max-w-2xl space-y-6'>
      <div className='flex items-start gap-3 p-4 rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800'>
        <Info className='h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0' />
        <p className='text-sm text-blue-800 dark:text-blue-300'>
          Estas reglas aplican a <strong>todo el sistema</strong>, independientemente del área. Los
          cambios aquí afectan a todos los usuarios.
        </p>
      </div>

      {/* Default family */}
      <Card>
        <CardHeader>
          <CardTitle className='text-base flex items-center gap-2'>
            <Layers className='h-4 w-4' />
            Área de respaldo del sistema
          </CardTitle>
          <CardDescription>
            Cuando un ticket no tiene área asignada, se envía aquí automáticamente. No recibe
            tickets de otras áreas — solo los que quedan sin área determinada.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select
            value={globalSettings.defaultFamilyId}
            onValueChange={v => onSetGlobal('defaultFamilyId', v)}
          >
            <SelectTrigger>
              <SelectValue placeholder='Sin área de respaldo configurada' />
            </SelectTrigger>
            <SelectContent>
              {families
                .filter(f => f.ticketFamilyConfig?.ticketsEnabled)
                .map(f => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <p className='text-xs text-muted-foreground mt-2'>
            Solo una área puede ser el respaldo. Si no configuras ninguna, los tickets sin área
            quedan sin asignar.
          </p>
        </CardContent>
      </Card>

      {/* Max tickets per user */}
      <Card>
        <CardHeader>
          <CardTitle className='text-base flex items-center gap-2'>
            <Users className='h-4 w-4' />
            Límite de tickets por usuario
          </CardTitle>
          <CardDescription>
            Un usuario no podrá crear más tickets si ya tiene este número abiertos al mismo tiempo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className='flex items-center gap-4'>
            <Input
              type='number'
              min={1}
              max={100}
              value={globalSettings.maxTicketsPerUser}
              onChange={e => onSetGlobal('maxTicketsPerUser', parseInt(e.target.value) || 10)}
              className='w-24 font-mono'
            />
            <p className='text-sm text-muted-foreground'>tickets abiertos máximo por usuario</p>
          </div>
        </CardContent>
      </Card>

      {/* Auto close */}
      <Card>
        <CardHeader>
          <CardTitle className='text-base flex items-center gap-2'>
            <Clock className='h-4 w-4' />
            Cierre automático de tickets resueltos
          </CardTitle>
          <CardDescription>
            Cuando un técnico resuelve un ticket, el cliente tiene este plazo para calificarlo. Si
            no lo hace, el ticket se cierra automáticamente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className='flex items-center gap-4'>
            <Input
              type='number'
              min={1}
              max={30}
              value={globalSettings.autoCloseDays}
              onChange={e => onSetGlobal('autoCloseDays', parseInt(e.target.value) || 3)}
              className='w-24 font-mono'
            />
            <p className='text-sm text-muted-foreground'>
              días para calificar antes del cierre automático
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Auto assignment */}
      <Card>
        <CardHeader>
          <CardTitle className='text-base flex items-center gap-2'>
            <Bell className='h-4 w-4' />
            Asignación automática de técnicos
          </CardTitle>
          <CardDescription>
            Cuando se crea un ticket, el sistema puede asignarlo automáticamente al técnico con
            menor carga de trabajo en esa categoría
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className='flex items-center justify-between p-3 border rounded-lg'>
            <div>
              <p className='text-sm font-medium'>Activar asignación automática</p>
              <p className='text-xs text-muted-foreground'>
                Los tickets nuevos se asignan sin intervención manual
              </p>
            </div>
            <Switch
              checked={globalSettings.autoAssignmentEnabled}
              onCheckedChange={v => onSetGlobal('autoAssignmentEnabled', v)}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
