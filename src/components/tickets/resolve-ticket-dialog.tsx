'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Star, Info } from 'lucide-react'
import { toast } from 'sonner'

interface ResolveTicketDialogProps {
  ticketId: string
  ticketTitle: string
  ticketDescription: string
  categoryId: string
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export function ResolveTicketDialog({
  ticketId,
  ticketTitle,
  ticketDescription,
  categoryId,
  isOpen,
  onClose,
  onSuccess,
}: ResolveTicketDialogProps) {
  const [loading, setLoading] = useState(false)
  const [resolutionComment, setResolutionComment] = useState('')

  const handleResolve = async () => {
    if (!resolutionComment.trim()) {
      toast.error('Por favor agrega un comentario de resolución')
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`/api/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'RESOLVED',
          resolutionComment,
        }),
      })

      if (!response.ok) {
        throw new Error('Error al resolver ticket')
      }

      toast.success('Ticket resuelto. Se notificará al cliente para que califique el servicio.')
      handleClose()
      onSuccess?.()
    } catch (error) {
      toast.error('Error al resolver ticket')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setResolutionComment('')
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Resolver Ticket</DialogTitle>
          <DialogDescription>
            Marca este ticket como resuelto y documenta la solución
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Comentario de resolución */}
          <div className="space-y-2">
            <Label htmlFor="resolution">
              Comentario de Resolución <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="resolution"
              value={resolutionComment}
              onChange={(e) => setResolutionComment(e.target.value)}
              placeholder="Describe cómo se resolvió el problema..."
              rows={6}
              maxLength={1000}
            />
            <p className="text-xs text-muted-foreground">
              {resolutionComment.length}/1000 caracteres
            </p>
          </div>

          {/* Info del nuevo flujo */}
          <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950 p-4 space-y-2">
            <div className="flex items-start gap-3">
              <Star className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  Flujo de cierre con calificación
                </p>
                <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                  <li>1. El ticket pasará a estado <strong>Resuelto</strong></li>
                  <li>2. Se notificará al cliente para que califique el servicio</li>
                  <li>3. Cuando el cliente califique, el ticket se cerrará automáticamente</li>
                  <li>4. Una vez cerrado, podrás promoverlo a artículo de conocimiento</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleResolve} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Resolver Ticket
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
