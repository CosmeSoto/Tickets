/**
 * Dialog para aprobar o rechazar solicitudes de activos
 * Validación de comentario obligatorio (mínimo 10 caracteres)
 * Integración con EquipmentSelectorDialog para quantity > 1
 */

'use client'

import { useState, useEffect } from 'react'
import { CheckCircle, XCircle, RefreshCw, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { validateReviewerComment } from '@/lib/validations/inventory/asset-request'
import { EquipmentSelectorDialog } from './EquipmentSelectorDialog'

// ── Types ──────────────────────────────────────────────────────────────────────

interface ApproveRejectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  requestId: string
  requestCode: string
  action: 'APPROVED' | 'REJECTED'
  quantity?: number
  assetTypeId?: string
  assetType?: string
  onSuccess: () => void
}

// ── Component ──────────────────────────────────────────────────────────────────

export function ApproveRejectDialog({
  open,
  onOpenChange,
  requestId,
  requestCode,
  action,
  quantity = 1,
  assetTypeId,
  assetType,
  onSuccess,
}: ApproveRejectDialogProps) {
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showEquipmentSelector, setShowEquipmentSelector] = useState(false)

  const isApprove = action === 'APPROVED'
  const isValid = validateReviewerComment(comment)
  const needsEquipmentSelection = isApprove && assetType === 'EQUIPMENT' && assetTypeId

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open) {
      setComment('')
      setError(null)
      setShowEquipmentSelector(false)
    }
  }, [open])

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!isValid) {
      setError('El comentario debe tener al menos 10 caracteres')
      return
    }

    // Si es aprobación con quantity > 1, abrir selector de equipos
    if (needsEquipmentSelection) {
      setShowEquipmentSelector(true)
      return
    }

    // Proceder con aprobación/rechazo normal
    await submitApprovalOrRejection()
  }

  const submitApprovalOrRejection = async (equipmentIds?: string[]) => {
    setSubmitting(true)
    setError(null)

    try {
      // Si hay equipmentIds, usar el endpoint de aprobación con equipos
      if (equipmentIds && equipmentIds.length > 0) {
        const res = await fetch(`/api/inventory/asset-requests/${requestId}/approve`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            comment,
            equipmentIds,
          }),
        })

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}))
          throw new Error(errorData.message || errorData.error || 'Error al aprobar solicitud')
        }
      } else {
        // Aprobación/rechazo normal sin selección de equipos
        const res = await fetch(`/api/inventory/asset-requests/${requestId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: action,
            comment,
          }),
        })

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}))
          throw new Error(errorData.error || 'Error al actualizar solicitud')
        }
      }

      onSuccess()
      onOpenChange(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido'
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleEquipmentSelectionConfirm = async (equipmentIds: string[]) => {
    await submitApprovalOrRejection(equipmentIds)
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const title = isApprove ? 'Aprobar Solicitud' : 'Rechazar Solicitud'
  const description = isApprove
    ? `Estás a punto de aprobar la solicitud ${requestCode}. Esta acción notificará al solicitante.`
    : `Estás a punto de rechazar la solicitud ${requestCode}. Esta acción notificará al solicitante.`

  const Icon = isApprove ? CheckCircle : XCircle
  const iconColor = isApprove ? 'text-green-600' : 'text-destructive'
  const buttonVariant = isApprove ? 'default' : 'destructive'
  const buttonText = isApprove ? 'Aprobar' : 'Rechazar'

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className='max-w-md' aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2'>
              <Icon className={`h-5 w-5 ${iconColor}`} />
              {title}
            </DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit}>
            <div className='space-y-4 py-4'>
              {/* Comentario obligatorio */}
              <div className='space-y-2'>
                <Label htmlFor='comment'>
                  Comentario *
                  <span className='text-xs text-muted-foreground ml-2'>(mínimo 10 caracteres)</span>
                </Label>
                <Textarea
                  id='comment'
                  value={comment}
                  onChange={e => {
                    setComment(e.target.value)
                    setError(null)
                  }}
                  placeholder={
                    isApprove
                      ? 'Explica por qué se aprueba esta solicitud...'
                      : 'Explica por qué se rechaza esta solicitud...'
                  }
                  rows={4}
                  disabled={submitting}
                  className={!isValid && comment.length > 0 ? 'border-destructive' : ''}
                />

                {/* Contador de caracteres */}
                <div className='flex items-center justify-between text-xs'>
                  <span
                    className={
                      isValid
                        ? 'text-green-600 dark:text-green-400'
                        : comment.length > 0
                          ? 'text-destructive'
                          : 'text-muted-foreground'
                    }
                  >
                    {comment.length} / 10 caracteres
                  </span>
                  {isValid && (
                    <span className='text-green-600 dark:text-green-400 flex items-center gap-1'>
                      <CheckCircle className='h-3 w-3' />
                      Válido
                    </span>
                  )}
                </div>

                {/* Mensaje de error de validación */}
                {!isValid && comment.length > 0 && (
                  <p className='text-xs text-destructive'>
                    Faltan {10 - comment.length} caracteres
                  </p>
                )}
              </div>

              {/* Alert de error */}
              {error && (
                <Alert variant='destructive'>
                  <AlertCircle className='h-4 w-4' />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Información adicional */}
              <Alert>
                <AlertCircle className='h-4 w-4' />
                <AlertDescription>
                  {isApprove ? (
                    needsEquipmentSelection ? (
                      <>
                        Esta solicitud requiere <strong>{quantity} equipos</strong>. En el siguiente
                        paso podrás seleccionar los equipos específicos a asignar.
                      </>
                    ) : (
                      'El solicitante recibirá una notificación de aprobación. Asegúrate de coordinar la entrega del activo.'
                    )
                  ) : (
                    'El solicitante recibirá una notificación de rechazo con tu comentario.'
                  )}
                </AlertDescription>
              </Alert>
            </div>

            <DialogFooter>
              <Button
                type='button'
                variant='outline'
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                Cancelar
              </Button>
              <Button type='submit' variant={buttonVariant} disabled={submitting || !isValid}>
                {submitting ? (
                  <>
                    <RefreshCw className='h-4 w-4 mr-2 animate-spin' />
                    Procesando...
                  </>
                ) : (
                  <>
                    <Icon className='h-4 w-4 mr-2' />
                    {needsEquipmentSelection ? 'Continuar' : buttonText}
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Equipment Selector Dialog */}
      {needsEquipmentSelection && assetTypeId && (
        <EquipmentSelectorDialog
          open={showEquipmentSelector}
          onOpenChange={setShowEquipmentSelector}
          requestCode={requestCode}
          assetTypeId={assetTypeId}
          quantity={quantity}
          onConfirm={handleEquipmentSelectionConfirm}
        />
      )}
    </>
  )
}
