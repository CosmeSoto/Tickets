'use client'

import { useState } from 'react'
import { CheckCircle, XCircle, Download, Loader2, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'

const CONDITION_LABELS: Record<string, string> = {
  NEW: 'Nuevo', LIKE_NEW: 'Como Nuevo', GOOD: 'Bueno', FAIR: 'Regular', POOR: 'Malo',
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  PENDING:  { label: 'Pendiente', color: 'bg-amber-100 text-amber-800' },
  APPROVED: { label: 'Aprobada',  color: 'bg-green-100 text-green-800' },
  REJECTED: { label: 'Rechazada', color: 'bg-red-100 text-red-800' },
}

interface DecommissionApprovalPanelProps {
  request: any
  isAdmin: boolean
  onActionComplete?: () => void
}

export function DecommissionApprovalPanel({ request, isAdmin, onActionComplete }: DecommissionApprovalPanelProps) {
  const { toast } = useToast()
  const [approveOpen, setApproveOpen] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [rejectionError, setRejectionError] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)

  const assetName = request.equipment
    ? `${request.equipment.code} — ${request.equipment.brand} ${request.equipment.model}`
    : request.license?.name || '—'

  const handleApprove = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/inventory/decommission-acts/${request.id}/approve`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Error al aprobar')
      toast({ title: 'Solicitud aprobada', description: `Folio generado: ${json.folio}` })
      setApproveOpen(false)
      onActionComplete?.()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const handleReject = async () => {
    if (rejectionReason.trim().length < 10) {
      setRejectionError('El motivo debe tener al menos 10 caracteres')
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/inventory/decommission-acts/${request.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejectionReason: rejectionReason.trim() }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Error al rechazar')
      toast({ title: 'Solicitud rechazada' })
      setRejectOpen(false)
      setRejectionReason('')
      onActionComplete?.()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const statusCfg = STATUS_CONFIG[request.status] || { label: request.status, color: '' }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold text-lg">{assetName}</h3>
          <p className="text-sm text-muted-foreground">
            {request.assetType === 'EQUIPMENT' ? 'Equipo' : 'Licencia'} · Solicitado por {request.requester?.name || request.requester?.email}
          </p>
        </div>
        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${statusCfg.color}`}>
          {statusCfg.label}
        </span>
      </div>

      <Separator />

      {/* Motivo */}
      <div>
        <Label className="text-xs uppercase text-muted-foreground">Motivo de baja</Label>
        <p className="mt-1 text-sm whitespace-pre-wrap">{request.reason}</p>
      </div>

      {/* Condición (equipos) */}
      {request.condition && (
        <div>
          <Label className="text-xs uppercase text-muted-foreground">Condición del equipo</Label>
          <p className="mt-1 text-sm">{CONDITION_LABELS[request.condition] || request.condition}</p>
        </div>
      )}

      {/* Imágenes adjuntas */}
      {request.attachments?.length > 0 && (
        <div>
          <Label className="text-xs uppercase text-muted-foreground">Evidencia fotográfica ({request.attachments.length})</Label>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {request.attachments.map((att: any) => {
              const url = att.url || `/api/uploads/decommission/${request.id}/${att.filename}`
              return (
                <button
                  key={att.id}
                  type="button"
                  className="relative aspect-square rounded-md overflow-hidden border bg-muted hover:opacity-90 transition-opacity"
                  onClick={() => setSelectedImage(url)}
                >
                  <img src={url} alt={att.originalName} className="w-full h-full object-cover" />
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Acta generada (si ya fue aprobada) */}
      {request.act && (
        <div className="rounded-md bg-green-50 border border-green-200 px-4 py-3 dark:bg-green-900/20 dark:border-green-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-green-800 dark:text-green-300">
              <FileText className="h-4 w-4" />
              <span>Acta generada: <strong>{request.act.folio}</strong></span>
            </div>
            {request.act.pdfPath && (
              <a href={`/api/uploads/${request.act.pdfPath.replace('/uploads/', '')}`} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm">
                  <Download className="mr-2 h-3 w-3" /> Descargar PDF
                </Button>
              </a>
            )}
          </div>
        </div>
      )}

      {/* Motivo de rechazo (si fue rechazada) */}
      {request.status === 'REJECTED' && request.rejectionReason && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 dark:bg-red-900/20 dark:border-red-800">
          <Label className="text-xs uppercase text-red-700 dark:text-red-400">Motivo de rechazo</Label>
          <p className="mt-1 text-sm text-red-800 dark:text-red-300">{request.rejectionReason}</p>
        </div>
      )}

      {/* Acciones ADMIN */}
      {isAdmin && request.status === 'PENDING' && (
        <div className="flex gap-3 pt-2">
          <Button onClick={() => setApproveOpen(true)} className="flex-1 bg-green-600 hover:bg-green-700">
            <CheckCircle className="mr-2 h-4 w-4" /> Aprobar
          </Button>
          <Button variant="destructive" onClick={() => setRejectOpen(true)} className="flex-1">
            <XCircle className="mr-2 h-4 w-4" /> Rechazar
          </Button>
        </div>
      )}

      {/* AlertDialog Aprobar */}
      <AlertDialog open={approveOpen} onOpenChange={setApproveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Aprobar solicitud de baja?</AlertDialogTitle>
            <AlertDialogDescription>
              Se dará de baja <strong>{assetName}</strong>. Esta acción generará el acta oficial y no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleApprove}
              disabled={loading}
              className="bg-green-600 hover:bg-green-700"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar aprobación
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AlertDialog Rechazar */}
      <AlertDialog open={rejectOpen} onOpenChange={o => { setRejectOpen(o); if (!o) { setRejectionReason(''); setRejectionError('') } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rechazar solicitud de baja</AlertDialogTitle>
            <AlertDialogDescription>
              Indica el motivo del rechazo. El solicitante recibirá una notificación.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-6 pb-2">
            <Textarea
              value={rejectionReason}
              onChange={e => { setRejectionReason(e.target.value); setRejectionError('') }}
              placeholder="Motivo del rechazo (mínimo 10 caracteres)..."
              rows={3}
            />
            {rejectionError && <p className="mt-1 text-xs text-destructive">{rejectionError}</p>}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleReject} disabled={loading} className="bg-destructive hover:bg-destructive/90">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar rechazo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Lightbox imagen */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setSelectedImage(null)}
        >
          <img src={selectedImage} alt="Evidencia" className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain" />
        </div>
      )}
    </div>
  )
}
