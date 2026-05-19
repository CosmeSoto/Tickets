'use client'

import { Loader2, CheckCircle, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { TICKET_STATUSES, formatDate, type Ticket } from '@/hooks/use-ticket-data'
import { getStatusColor, getStatusIconColor, getStatusLabel } from '@/lib/utils/ticket-utils'
import { cn } from '@/lib/utils'

interface StatusControlCardProps {
  ticket: Ticket
  isRequester: boolean
  isSuperAdmin: boolean
  updatingStatus: boolean
  newStatus: Ticket['status']
  onStatusUpdate: (targetStatus?: Ticket['status']) => Promise<void>
  onForceClose: () => Promise<void>
}

const availableStatuses = (ticket: Ticket, isSuperAdmin: boolean): Ticket['status'][] => {
  if (isSuperAdmin) {
    return ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'ON_HOLD']
  }

  const adminTransitions: Record<string, Ticket['status'][]> = {
    OPEN: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'ON_HOLD'],
    IN_PROGRESS: ['IN_PROGRESS', 'OPEN', 'RESOLVED', 'CLOSED', 'ON_HOLD'],
    ON_HOLD: ['ON_HOLD', 'OPEN', 'IN_PROGRESS', 'RESOLVED'],
    RESOLVED: ['RESOLVED', 'IN_PROGRESS', 'CLOSED'],
    CLOSED: ['CLOSED', 'RESOLVED'],
  }

  const techTransitions: Record<string, Ticket['status'][]> = {
    OPEN: ['OPEN', 'IN_PROGRESS'],
    IN_PROGRESS: ['IN_PROGRESS', 'RESOLVED', 'ON_HOLD'],
    ON_HOLD: ['ON_HOLD', 'IN_PROGRESS'],
    RESOLVED: ['RESOLVED', 'IN_PROGRESS'],
    CLOSED: ['CLOSED'],
  }

  if (adminTransitions[ticket.status]) {
    return adminTransitions[ticket.status]
  }

  return techTransitions[ticket.status] ?? [ticket.status]
}

const getDotColor = (status: string) => {
  switch (status) {
    case 'OPEN':
      return 'bg-blue-500'
    case 'IN_PROGRESS':
      return 'bg-blue-500'
    case 'RESOLVED':
      return 'bg-green-500'
    case 'ON_HOLD':
      return 'bg-amber-500'
    default:
      return 'bg-gray-500'
  }
}

export function StatusControlCard({
  ticket,
  isRequester,
  isSuperAdmin,
  updatingStatus,
  newStatus,
  onStatusUpdate,
  onForceClose,
}: StatusControlCardProps) {
  if (ticket.status === 'CLOSED' || isRequester) {
    return null
  }

  return (
    <Card className='border border-border'>
      <CardHeader className='pb-2 pt-4 px-4'>
        <CardTitle className='text-sm font-semibold flex items-center gap-2'>
          <span
            className={cn('inline-block w-2.5 h-2.5 rounded-full', getDotColor(ticket.status))}
          />
          Estado: {getStatusLabel(ticket.status)}
        </CardTitle>
      </CardHeader>
      <CardContent className='px-4 pb-4 space-y-1.5'>
        {availableStatuses(ticket, isSuperAdmin)
          .filter(s => s !== ticket.status)
          .map(s => {
            const isPrimary = s === 'RESOLVED' || (ticket.status === 'OPEN' && s === 'IN_PROGRESS')

            return (
              <button
                key={s}
                onClick={() => onStatusUpdate(s)}
                disabled={updatingStatus}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-60 disabled:cursor-not-allowed',
                  isPrimary
                    ? cn(
                        'text-white',
                        s === 'RESOLVED'
                          ? 'bg-green-600 hover:bg-green-700'
                          : s === 'IN_PROGRESS'
                            ? 'bg-blue-600 hover:bg-blue-700'
                            : s === 'ON_HOLD'
                              ? 'bg-amber-600 hover:bg-amber-700'
                              : 'bg-blue-600 hover:bg-blue-700'
                      )
                    : 'border border-border bg-background hover:bg-muted text-foreground'
                )}
              >
                <span className='flex items-center gap-2'>
                  {updatingStatus && newStatus === s ? (
                    <Loader2 className='h-3.5 w-3.5 animate-spin' />
                  ) : (
                    <span className={cn('w-2 h-2 rounded-full', getDotColor(s))} />
                  )}
                  {getStatusLabel(s)}
                </span>
                <ChevronRight className='h-3.5 w-3.5 opacity-50' />
              </button>
            )
          })}
        {availableStatuses(ticket, isSuperAdmin).includes('RESOLVED') &&
          ticket.status !== 'RESOLVED' && (
            <p className='text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md p-2 mt-1'>
              Al marcar como Resuelto, el solicitante recibirá una notificación para calificar.
            </p>
          )}
        {isSuperAdmin && ticket.status !== 'OPEN' && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant='outline'
                size='sm'
                className='w-full mt-1 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800 hover:bg-green-50 dark:hover:bg-green-950/30'
              >
                <CheckCircle className='h-4 w-4 mr-2' />
                Cerrar directamente
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Cerrar ticket directamente?</AlertDialogTitle>
                <AlertDialogDescription>
                  Como Super Admin puedes cerrar este ticket sin esperar la calificación del
                  solicitante.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={onForceClose} className='bg-red-600 hover:bg-red-700'>
                  Cerrar Ticket
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </CardContent>
    </Card>
  )
}
