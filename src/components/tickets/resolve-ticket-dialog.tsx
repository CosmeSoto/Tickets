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
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2, BookOpen } from 'lucide-react'
import { toast } from 'sonner'
import { CreateArticleDialog } from '@/components/knowledge/create-article-dialog'

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
  const [createArticle, setCreateArticle] = useState(false)
  const [showArticleDialog, setShowArticleDialog] = useState(false)

  const handleResolve = async () => {
    // Validar comentario
    if (!resolutionComment.trim()) {
      toast.error('Por favor agrega un comentario de resolución')
      return
    }

    setLoading(true)
    try {
      // Resolver ticket
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

      toast.success('Ticket resuelto exitosamente')

      // Si se marcó crear artículo, abrir diálogo
      if (createArticle) {
        handleClose()
        setShowArticleDialog(true)
      } else {
        handleClose()
        onSuccess?.()
      }
    } catch (error) {
      toast.error('Error al resolver ticket')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setResolutionComment('')
    setCreateArticle(false)
    onClose()
  }

  const handleArticleSuccess = (articleId: string) => {
    toast.success('Artículo creado exitosamente')
    setShowArticleDialog(false)
    onSuccess?.()
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-2xl">
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

            {/* Checkbox crear artículo */}
            <div className="flex items-start space-x-3 rounded-lg border p-4 bg-muted/50">
              <Checkbox
                id="create-article"
                checked={createArticle}
                onCheckedChange={(checked) => setCreateArticle(checked as boolean)}
              />
              <div className="flex-1">
                <Label
                  htmlFor="create-article"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex items-center gap-2"
                >
                  <BookOpen className="h-4 w-4" />
                  Crear artículo de conocimiento
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Documenta esta solución para ayudar a otros usuarios con problemas similares
                </p>
              </div>
            </div>

            {createArticle && (
              <div className="rounded-lg border p-4 bg-blue-50 dark:bg-blue-950">
                <p className="text-sm text-blue-900 dark:text-blue-100">
                  ℹ️ Después de resolver el ticket, se abrirá un formulario para crear el artículo de conocimiento.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleClose} disabled={loading}>
              Cancelar
            </Button>
            <Button onClick={handleResolve} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {createArticle ? 'Resolver y Crear Artículo' : 'Resolver Ticket'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de crear artículo */}
      <CreateArticleDialog
        isOpen={showArticleDialog}
        onClose={() => setShowArticleDialog(false)}
        ticketId={ticketId}
        ticketTitle={ticketTitle}
        ticketDescription={ticketDescription}
        categoryId={categoryId}
        onSuccess={handleArticleSuccess}
      />
    </>
  )
}
