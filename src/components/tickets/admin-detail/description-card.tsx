'use client'

import { MapPin, AlertCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TICKET_STATUSES, TICKET_PRIORITIES, type Ticket } from '@/hooks/use-ticket-data'

interface DescriptionCardProps {
  ticket: Ticket
  isEditing: boolean
  saveError: string | null
  editForm: {
    title: string
    description: string
    status: Ticket['status']
    priority: Ticket['priority']
    assigneeId: string
  }
  onEditFormChange: (field: keyof DescriptionCardProps['editForm'], value: string) => void
}

export function DescriptionCard({
  ticket,
  isEditing,
  saveError,
  editForm,
  onEditFormChange,
}: DescriptionCardProps) {
  return (
    <>
      <Card>
        <CardContent className='pt-5 space-y-3'>
          {isEditing ? (
            <>
              <div>
                <Label htmlFor='title'>Título</Label>
                <Input
                  id='title'
                  value={editForm.title}
                  onChange={e => onEditFormChange('title', e.target.value)}
                  className='mt-1'
                />
              </div>
              <div>
                <Label htmlFor='desc'>Descripción</Label>
                <Textarea
                  id='desc'
                  value={editForm.description}
                  onChange={e => onEditFormChange('description', e.target.value)}
                  rows={4}
                  className='mt-1'
                />
              </div>
              <div className='grid grid-cols-2 gap-3'>
                <div>
                  <Label>Estado</Label>
                  <Select
                    value={editForm.status}
                    onValueChange={v => onEditFormChange('status', v)}
                  >
                    <SelectTrigger className='mt-1'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TICKET_STATUSES.map(s => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Prioridad</Label>
                  <Select
                    value={editForm.priority}
                    onValueChange={v => onEditFormChange('priority', v)}
                  >
                    <SelectTrigger className='mt-1'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TICKET_PRIORITIES.map(p => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          ) : (
            <>
              <p className='text-sm text-foreground whitespace-pre-wrap leading-relaxed'>
                {ticket.description}
              </p>
              {(ticket as any).location && (
                <div className='flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 px-3 py-2'>
                  <MapPin className='h-4 w-4 text-amber-600 mt-0.5 shrink-0' />
                  <div>
                    <p className='text-xs font-semibold text-amber-700'>Ubicación del problema</p>
                    <p className='text-sm text-amber-800'>{(ticket as any).location}</p>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {saveError && isEditing && (
        <Card className='border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950'>
          <CardContent className='pt-4 pb-4 flex items-start gap-3'>
            <AlertCircle className='h-5 w-5 text-red-600 shrink-0 mt-0.5' />
            <div>
              <p className='font-medium text-red-900 dark:text-red-100 text-sm'>Error al guardar</p>
              <p className='text-xs text-red-800 dark:text-red-200 mt-0.5'>{saveError}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  )
}
