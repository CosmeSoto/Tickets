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

interface StatusControlCardProps {
  ticket: Ticket
  isRequester: boolean
  isSuperAdmin: boolean
  updatingStatus: boolean
  newStatus: Ticket['status']
  onStatusUpdate: (targetStatus?: Ticket['status']) => Promise<void>
  onForceClose: () => Promise<void>
}

const getStatusLabel = (s: string) => TICKET_STATUSES.find(x => x.value === s)?.label ?? s

const availableStatuses = (ticket: Ticket, isSuperAdmin: boolean): Ticket['status'][] => {
  if (isSuperAdmin) {
    // SUPER ADMIN: TODOS LOS ESTADOS DISPONIBLES, SIN RESTRICCIONES
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

  // Verificar si es ADMIN normal (no super admin)
  if (adminTransitions[ticket.status]) {
    return adminTransitions[ticket.status]
  }

  return techTransitions[ticket.status] ?? [ticket.status]
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

  const borderClasses =
    ticket.status === 'OPEN'
      ? 'border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950'
      : ticket.status === 'IN_PROGRESS'
        ? 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950'
        : ticket.status === 'RESOLVED'
          ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950'
          : ticket.status === 'ON_HOLD'
            ? 'border-purple-200 bg-purple-50 dark:border-purple-800 dark:bg-purple-950'
            : 'border-border'

  const dotColor =
    ticket.status === 'OPEN'
      ? 'bg-orange-500'
      : ticket.status === 'IN_PROGRESS'
        ? 'bg-yellow-500'
        : ticket.status === 'RESOLVED'
          ? 'bg-green-500'
          : ticket.status === 'ON_HOLD'
            ? 'bg-purple-500'
            : 'bg-gray-500'

  return (
    <Card className={`border-2 ${borderClasses}`}>
      <CardHeader className='pb-2 pt-4 px-4'>
        <CardTitle className='text-sm font-semibold flex items-center gap-2'>
          <span className={`inline-block w-2.5 h-2.5 rounded-full ${dotColor}`} />
          Estado: {getStatusLabel(ticket.status)}
        </CardTitle>
      </CardHeader>
      <CardContent className='px-4 pb-4 space-y-2'>
        {availableStatuses(ticket, isSuperAdmin)
          .filter(s => s !== ticket.status)
          .map(s => {
            const isPrimary = s === 'RESOLVED' || (ticket.status === 'OPEN' && s === 'IN_PROGRESS')
            const statusDotColor =
              s === 'OPEN'
                ? 'bg-orange-500'
                : s === 'IN_PROGRESS'
                  ? 'bg-yellow-500'
                  : s === 'RESOLVED'
                    ? 'bg-green-500'
                    : s === 'ON_HOLD'
                      ? 'bg-purple-500'
                      : 'bg-gray-500'
            const btnColor =
              s === 'RESOLVED'
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : s === 'IN_PROGRESS'
                  ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
                  : s === 'ON_HOLD'
                    ? 'bg-purple-500 hover:bg-purple-600 text-white'
                    : s === 'OPEN'
                      ? 'bg-orange-500 hover:bg-orange-600 text-white'
                      : 'bg-gray-500 hover:bg-gray-600 text-white'
            return (
              <button
                key={s}
                onClick={() => onStatusUpdate(s)}
                disabled={updatingStatus}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all disabled:opacity-60 disabled:cursor-not-allowed
                  ${isPrimary ? btnColor : 'border border-border bg-background hover:bg-muted text-foreground'}`}
              >
                <span className='flex items-center gap-2'>
                  {updatingStatus && newStatus === s ? (
                    <Loader2 className='h-3.5 w-3.5 animate-spin' />
                  ) : (
                    <span className={`w-2 h-2 rounded-full ${statusDotColor}`} />
                  )}
                  {getStatusLabel(s)}
                </span>
                <ChevronRight className='h-3.5 w-3.5 opacity-50' />
              </button>
            )
          })}
        {availableStatuses(ticket, isSuperAdmin).includes('RESOLVED') &&
          ticket.status !== 'RESOLVED' && (
            <p className='text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 mt-1'>
              Al marcar como Resuelto, el solicitante recibirá una notificación para calificar.
            </p>
          )}
        {isSuperAdmin && ticket.status !== 'OPEN' && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant='outline'
                size='sm'
                className='w-full mt-1 border-green-500 text-green-700 hover:bg-green-50'
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
                <AlertDialogAction onClick={onForceClose}>Cerrar Ticket</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </CardContent>
    </Card>
  )
}
