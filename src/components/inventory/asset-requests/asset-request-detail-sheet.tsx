/**
 * Sheet lateral con detalle completo de solicitud de activo
 * Incluye historial de comentarios y acciones según rol y estado
 */

'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import {
  RefreshCw,
  CheckCircle,
  XCircle,
  Eye,
  Package,
  MessageSquare,
  AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { inventoryToast as toast } from '@/lib/utils/inventory-toast'
import { AssetRequestStatusBadge } from './asset-request-status-badge'
import { ApproveRejectDialog } from './approve-reject-dialog'
import {
  ASSET_TYPE_LABELS,
  formatNeededByDate,
  isAssetRequestOverdue,
} from '@/lib/utils/asset-request-utils'
import type { AssetRequestStatus, AssetType } from '@prisma/client'

// ── Types ──────────────────────────────────────────────────────────────────────

interface AssetRequest {
  id: string
  code: string
  assetType: AssetType
  description: string
  justification: string
  status: AssetRequestStatus
  quantity: number
  neededBy: string | null
  familyId: string
  familyName?: string
  familyCode?: string
  assetId: string | null
  assetName?: string | null
  requesterId: string
  requesterName?: string
  requesterEmail?: string
  reviewedById: string | null
  reviewerName?: string | null
  reviewedAt: string | null
  reviewerComment: string | null
  fulfilledById: string | null
  fulfillerName?: string | null
  fulfilledAt: string | null
  reviewComments: Array<{
    userId: string
    userName: string
    comment: string
    timestamp: string
  }>
  createdAt: string
  updatedAt: string
}

interface AssetRequestDetailSheetProps {
  requestId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

// ── Component ──────────────────────────────────────────────────────────────────

export function AssetRequestDetailSheet({
  requestId,
  open,
  onOpenChange,
  onSuccess,
}: AssetRequestDetailSheetProps) {
  const { data: session } = useSession()

  // ── State ──────────────────────────────────────────────────────────────────

  const [loading, setLoading] = useState(false)
  const [request, setRequest] = useState<AssetRequest | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [newComment, setNewComment] = useState('')
  const [addingComment, setAddingComment] = useState(false)

  const [actionLoading, setActionLoading] = useState(false)
  const [approveRejectDialog, setApproveRejectDialog] = useState<{
    open: boolean
    action: 'APPROVED' | 'REJECTED'
  }>({ open: false, action: 'APPROVED' })

  // ── Fetch request detail ───────────────────────────────────────────────────

  useEffect(() => {
    if (!requestId || !open) {
      setRequest(null)
      setError(null)
      return
    }

    const fetchDetail = async () => {
      setLoading(true)
      setError(null)

      try {
        const res = await fetch(`/api/inventory/asset-requests/${requestId}`)

        if (!res.ok) {
          if (res.status === 404) {
            throw new Error('Solicitud no encontrada')
          }
          const errorData = await res.json().catch(() => ({}))
          throw new Error(errorData.error || 'Error al cargar solicitud')
        }

        const data = await res.json()
        setRequest(data)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error desconocido'
        setError(message)
        toast({
          title: 'Error al cargar solicitud',
          description: message,
          variant: 'destructive',
        })
      } finally {
        setLoading(false)
      }
    }

    fetchDetail()
  }, [requestId, open, toast])

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleMarkUnderReview = async () => {
    if (!request) return

    setActionLoading(true)
    try {
      const res = await fetch(`/api/inventory/asset-requests/${request.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'UNDER_REVIEW' }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || 'Error al actualizar estado')
      }

      toast({
        title: 'Estado actualizado',
        description: 'La solicitud está ahora en revisión',
      })

      // Refresh detail
      const refreshRes = await fetch(`/api/inventory/asset-requests/${request.id}`)
      if (refreshRes.ok) {
        const data = await refreshRes.json()
        setRequest(data)
      }

      onSuccess?.()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido'
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setActionLoading(false)
    }
  }

  const handleMarkFulfilled = async () => {
    if (!request) return

    setActionLoading(true)
    try {
      const res = await fetch(`/api/inventory/asset-requests/${request.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'FULFILLED' }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || 'Error al actualizar estado')
      }

      toast({
        title: 'Solicitud entregada',
        description: 'La solicitud se marcó como entregada',
      })

      // Refresh detail
      const refreshRes = await fetch(`/api/inventory/asset-requests/${request.id}`)
      if (refreshRes.ok) {
        const data = await refreshRes.json()
        setRequest(data)
      }

      onSuccess?.()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido'
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setActionLoading(false)
    }
  }

  const handleCancelRequest = async () => {
    if (!request) return

    if (!confirm('¿Estás seguro de que deseas cancelar esta solicitud?')) {
      return
    }

    setActionLoading(true)
    try {
      const res = await fetch(`/api/inventory/asset-requests/${request.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'REJECTED',
          comment: 'Cancelada por el solicitante',
        }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || 'Error al cancelar solicitud')
      }

      toast({
        title: 'Solicitud cancelada',
        description: 'La solicitud se canceló correctamente',
      })

      // Refresh detail
      const refreshRes = await fetch(`/api/inventory/asset-requests/${request.id}`)
      if (refreshRes.ok) {
        const data = await refreshRes.json()
        setRequest(data)
      }

      onSuccess?.()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido'
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setActionLoading(false)
    }
  }

  const handleAddComment = async () => {
    if (!request || !newComment.trim()) return

    setAddingComment(true)
    try {
      const res = await fetch(`/api/inventory/asset-requests/${request.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: newComment.trim() }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || 'Error al agregar comentario')
      }

      toast({
        title: 'Comentario agregado',
        description: 'El comentario se agregó correctamente',
      })

      setNewComment('')

      // Refresh detail
      const refreshRes = await fetch(`/api/inventory/asset-requests/${request.id}`)
      if (refreshRes.ok) {
        const data = await refreshRes.json()
        setRequest(data)
      }

      onSuccess?.()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido'
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setAddingComment(false)
    }
  }

  const handleApproveRejectSuccess = async () => {
    // Refresh detail
    if (request) {
      const refreshRes = await fetch(`/api/inventory/asset-requests/${request.id}`)
      if (refreshRes.ok) {
        const data = await refreshRes.json()
        setRequest(data)
      }
    }
    onSuccess?.()
  }

  // ── Permissions ────────────────────────────────────────────────────────────

  const userRole = session?.user?.role
  const userId = session?.user?.id
  const isSuperAdmin = session?.user?.isSuperAdmin === true
  const isRequester = request?.requesterId === userId
  const isFamilyAdmin = userRole === 'ADMIN' && !isSuperAdmin

  const canMarkUnderReview = isFamilyAdmin && request?.status === 'PENDING' && !actionLoading
  const canApproveReject =
    isSuperAdmin &&
    (request?.status === 'PENDING' || request?.status === 'UNDER_REVIEW') &&
    !actionLoading
  const canMarkFulfilled =
    (isSuperAdmin || isFamilyAdmin) && request?.status === 'APPROVED' && !actionLoading
  const canCancel = isRequester && request?.status === 'PENDING' && !actionLoading
  const canAddComment =
    (isFamilyAdmin && (request?.status === 'PENDING' || request?.status === 'UNDER_REVIEW')) ||
    (isSuperAdmin && request?.status !== 'FULFILLED' && request?.status !== 'REJECTED')

  // ── Render ─────────────────────────────────────────────────────────────────

  const isOverdue = request ? isAssetRequestOverdue(request.neededBy, request.status) : false

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className='w-full sm:max-w-2xl overflow-y-auto'>
          <SheetHeader>
            <SheetTitle>Detalle de Solicitud</SheetTitle>
            <SheetDescription>
              {request ? `Solicitud ${request.code}` : 'Cargando...'}
            </SheetDescription>
          </SheetHeader>

          {loading && (
            <div className='flex items-center justify-center py-12'>
              <RefreshCw className='h-8 w-8 animate-spin text-muted-foreground' />
            </div>
          )}

          {error && (
            <Alert variant='destructive' className='mt-4'>
              <AlertCircle className='h-4 w-4' />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {request && !loading && (
            <div className='space-y-6 mt-6'>
              {/* Header con código y estado */}
              <div className='flex items-center justify-between'>
                <div>
                  <h3 className='text-2xl font-bold'>{request.code}</h3>
                  <p className='text-sm text-muted-foreground'>
                    Creada el {new Date(request.createdAt).toLocaleDateString('es-ES')}
                  </p>
                </div>
                <AssetRequestStatusBadge status={request.status} />
              </div>

              {/* Alert de fecha vencida */}
              {isOverdue && (
                <Alert variant='destructive'>
                  <AlertCircle className='h-4 w-4' />
                  <AlertDescription>
                    Esta solicitud está vencida. Fecha límite:{' '}
                    {formatNeededByDate(request.neededBy)}
                  </AlertDescription>
                </Alert>
              )}

              <Separator />

              {/* Información básica */}
              <div className='space-y-4'>
                <div>
                  <Label className='text-xs text-muted-foreground'>Tipo de Activo</Label>
                  <p className='font-medium'>{ASSET_TYPE_LABELS[request.assetType]}</p>
                </div>

                <div>
                  <Label className='text-xs text-muted-foreground'>Familia</Label>
                  <p className='font-medium'>
                    {request.familyCode} - {request.familyName}
                  </p>
                </div>

                <div>
                  <Label className='text-xs text-muted-foreground'>Descripción</Label>
                  <p className='text-sm'>{request.description}</p>
                </div>

                <div>
                  <Label className='text-xs text-muted-foreground'>Justificación</Label>
                  <p className='text-sm'>{request.justification}</p>
                </div>

                {request.assetName && (
                  <div>
                    <Label className='text-xs text-muted-foreground'>Activo del Catálogo</Label>
                    <p className='text-sm'>{request.assetName}</p>
                  </div>
                )}

                <div className='grid grid-cols-2 gap-4'>
                  <div>
                    <Label className='text-xs text-muted-foreground'>Cantidad</Label>
                    <p className='font-medium'>{request.quantity}</p>
                  </div>

                  {request.neededBy && (
                    <div>
                      <Label className='text-xs text-muted-foreground'>Fecha Estimada</Label>
                      <p className='font-medium'>{formatNeededByDate(request.neededBy)}</p>
                    </div>
                  )}
                </div>

                <div>
                  <Label className='text-xs text-muted-foreground'>Solicitante</Label>
                  <p className='text-sm'>
                    {request.requesterName}
                    {request.requesterEmail && (
                      <span className='text-muted-foreground'> ({request.requesterEmail})</span>
                    )}
                  </p>
                </div>

                {request.reviewerName && (
                  <div>
                    <Label className='text-xs text-muted-foreground'>Revisado por</Label>
                    <p className='text-sm'>
                      {request.reviewerName}
                      {request.reviewedAt && (
                        <span className='text-muted-foreground'>
                          {' '}
                          - {new Date(request.reviewedAt).toLocaleDateString('es-ES')}
                        </span>
                      )}
                    </p>
                    {request.reviewerComment && (
                      <p className='text-sm mt-1 p-2 bg-muted rounded-md'>
                        {request.reviewerComment}
                      </p>
                    )}
                  </div>
                )}

                {request.fulfillerName && (
                  <div>
                    <Label className='text-xs text-muted-foreground'>Entregado por</Label>
                    <p className='text-sm'>
                      {request.fulfillerName}
                      {request.fulfilledAt && (
                        <span className='text-muted-foreground'>
                          {' '}
                          - {new Date(request.fulfilledAt).toLocaleDateString('es-ES')}
                        </span>
                      )}
                    </p>
                  </div>
                )}
              </div>

              <Separator />

              {/* Historial de comentarios */}
              {request.reviewComments && request.reviewComments.length > 0 && (
                <div className='space-y-3'>
                  <Label className='text-sm font-semibold'>Historial de Comentarios</Label>
                  <div className='space-y-2'>
                    {request.reviewComments.map((comment, index) => (
                      <div key={index} className='p-3 bg-muted rounded-md space-y-1'>
                        <div className='flex items-center justify-between'>
                          <span className='text-xs font-medium'>{comment.userName}</span>
                          <span className='text-xs text-muted-foreground'>
                            {new Date(comment.timestamp).toLocaleString('es-ES')}
                          </span>
                        </div>
                        <p className='text-sm'>{comment.comment}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Agregar comentario */}
              {canAddComment && (
                <div className='space-y-2'>
                  <Label htmlFor='newComment'>Agregar Comentario</Label>
                  <Textarea
                    id='newComment'
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                    placeholder='Escribe un comentario...'
                    rows={3}
                    disabled={addingComment}
                  />
                  <Button
                    onClick={handleAddComment}
                    disabled={!newComment.trim() || addingComment}
                    size='sm'
                  >
                    {addingComment ? (
                      <>
                        <RefreshCw className='h-4 w-4 mr-2 animate-spin' />
                        Agregando...
                      </>
                    ) : (
                      <>
                        <MessageSquare className='h-4 w-4 mr-2' />
                        Agregar Comentario
                      </>
                    )}
                  </Button>
                </div>
              )}

              <Separator />

              {/* Acciones */}
              <div className='space-y-2'>
                {canMarkUnderReview && (
                  <Button onClick={handleMarkUnderReview} className='w-full' variant='outline'>
                    <Eye className='h-4 w-4 mr-2' />
                    Marcar en Revisión
                  </Button>
                )}

                {canApproveReject && (
                  <div className='grid grid-cols-2 gap-2'>
                    <Button
                      onClick={() => setApproveRejectDialog({ open: true, action: 'APPROVED' })}
                      variant='default'
                    >
                      <CheckCircle className='h-4 w-4 mr-2' />
                      Aprobar
                    </Button>
                    <Button
                      onClick={() => setApproveRejectDialog({ open: true, action: 'REJECTED' })}
                      variant='destructive'
                    >
                      <XCircle className='h-4 w-4 mr-2' />
                      Rechazar
                    </Button>
                  </div>
                )}

                {canMarkFulfilled && (
                  <Button onClick={handleMarkFulfilled} className='w-full'>
                    <Package className='h-4 w-4 mr-2' />
                    Marcar como Entregada
                  </Button>
                )}

                {canCancel && (
                  <Button onClick={handleCancelRequest} className='w-full' variant='destructive'>
                    <XCircle className='h-4 w-4 mr-2' />
                    Cancelar Solicitud
                  </Button>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Approve/Reject Dialog */}
      {request && (
        <ApproveRejectDialog
          open={approveRejectDialog.open}
          onOpenChange={open => setApproveRejectDialog(prev => ({ ...prev, open }))}
          requestId={request.id}
          requestCode={request.code}
          action={approveRejectDialog.action}
          quantity={request.quantity}
          assetTypeId={request.assetId || undefined}
          assetType={request.assetType}
          onSuccess={handleApproveRejectSuccess}
        />
      )}
    </>
  )
}
