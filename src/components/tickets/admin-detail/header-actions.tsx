'use client'

import { useRouter } from 'next/navigation'
import { BookOpen, Lightbulb, UserX, Loader2, Edit, Save, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
import { AutoAssignment } from '@/components/tickets/auto-assignment'
import type { Ticket } from '@/hooks/use-ticket-data'

interface HeaderActionsProps {
  ticket: Ticket
  isEditing: boolean
  unassigning: boolean
  assignmentDialogOpen: boolean
  sessionUser?: { id: string; role?: string; isSuperAdmin?: boolean }
  onEdit: () => void
  onCancelEdit: () => void
  onSave: () => void
  onUnassign: () => void
  onAssignmentComplete: () => Promise<void>
  onAssignmentOpenChange: (open: boolean) => void
}

export function HeaderActions({
  ticket,
  isEditing,
  unassigning,
  assignmentDialogOpen,
  sessionUser,
  onEdit,
  onCancelEdit,
  onSave,
  onUnassign,
  onAssignmentComplete,
  onAssignmentOpenChange,
}: HeaderActionsProps) {
  const router = useRouter()
  const isRequester = ticket.client?.id === sessionUser?.id
  const isAssignedResolver = ticket.assignee?.id === sessionUser?.id

  return (
    <div className='flex flex-wrap items-center gap-2'>
      {(ticket.status === 'RESOLVED' || ticket.status === 'CLOSED') &&
        (isAssignedResolver || (!isRequester && sessionUser?.role === 'ADMIN')) &&
        (ticket.knowledgeArticleId ? (
          <Button
            variant='outline'
            size='sm'
            onClick={() => router.push(`/admin/knowledge/${ticket.knowledgeArticleId}`)}
          >
            <BookOpen className='h-4 w-4 sm:mr-2' />
            <span className='hidden sm:inline'>Ver Artículo</span>
          </Button>
        ) : (
          <Button
            variant='outline'
            size='sm'
            onClick={() => router.push(`/admin/knowledge/new?fromTicket=${ticket.id}`)}
          >
            <Lightbulb className='h-4 w-4 sm:mr-2' />
            <span className='hidden sm:inline'>Crear Artículo</span>
          </Button>
        ))}

      {!['RESOLVED', 'CLOSED'].includes(ticket.status) &&
        (ticket.assignee ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant='outline' size='sm' disabled={unassigning}>
                {unassigning ? (
                  <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                ) : (
                  <UserX className='h-4 w-4 sm:mr-2' />
                )}
                <span className='hidden sm:inline'>Desasignar</span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Desasignar técnico?</AlertDialogTitle>
                <AlertDialogDescription>
                  Se removerá a <strong>{ticket.assignee.name}</strong> y el estado volverá a
                  &quot;Abierto&quot;.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={onUnassign}>Confirmar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : (
          <AutoAssignment
            ticketId={ticket.id}
            currentAssignee={ticket.assignee}
            onAssignmentComplete={onAssignmentComplete}
            onOpenChange={onAssignmentOpenChange}
          />
        ))}

      {!isEditing ? (
        <Button size='sm' onClick={onEdit}>
          <Edit className='h-4 w-4 sm:mr-2' />
          <span className='hidden sm:inline'>Editar</span>
        </Button>
      ) : (
        <>
          <Button variant='outline' size='sm' onClick={onCancelEdit}>
            <X className='h-4 w-4 sm:mr-2' />
            <span className='hidden sm:inline'>Cancelar</span>
          </Button>
          <Button size='sm' onClick={onSave}>
            <Save className='h-4 w-4 sm:mr-2' />
            <span className='hidden sm:inline'>Guardar</span>
          </Button>
        </>
      )}
    </div>
  )
}
