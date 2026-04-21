'use client'

import { useState } from 'react'
import {
  CheckCircle, XCircle, Download, Loader2, FileText,
  Wrench, ArrowUpCircle, Clock, AlertTriangle, User, Calendar,
} from 'lucide-react'
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

// ── Constantes ────────────────────────────────────────────────────────────────

const CONDITION_LABELS: Record<string, string> = {
  NEW: 'Nuevo', LIKE_NEW: 'Como Nuevo', GOOD: 'Bueno', FAIR: 'Regular', POOR: 'Malo',
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType; description: string }> = {
  PENDING:          { label: 'Pendiente',           color: 'bg-amber-100 text-amber-800 border-amber-200',   icon: Clock,         description: 'Esperando dictamen técnico' },
  TECHNICAL_REVIEW: { label: 'Dictamen técnico',    color: 'bg-blue-100 text-blue-800 border-blue-200',      icon: Wrench,        description: 'Técnico emitió dictamen favorable — esperando elevación del gestor' },
  MANAGER_REVIEW:   { label: 'Revisión del gestor', color: 'bg-purple-100 text-purple-800 border-purple-200', icon: ArrowUpCircle, description: 'Gestor elevó al administrador — esperando aprobación' },
  APPROVED:         { label: 'Aprobada',            color: 'bg-green-100 text-green-800 border-green-200',   icon: CheckCircle,   description: 'Solicitud aprobada — activo dado de baja' },
  REJECTED:         { label: 'Rechazada',           color: 'bg-red-100 text-red-800 border-red-200',         icon: XCircle,       description: 'Solicitud rechazada' },
}

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface UserContext {
  id: string
  role: string
  isSuperAdmin: boolean
  canManageInventory: boolean
}

interface DecommissionApprovalPanelProps {
  request: any
  userContext: UserContext
  onActionComplete?: () => void
}

// ── Componente ────────────────────────────────────────────────────────────────

export function DecommissionApprovalPanel({ request, userContext, onActionComplete }: DecommissionApprovalPanelProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)

  // Dictamen técnico
  const [techOpen, setTechOpen] = useState(false)
  const [techOpinion, setTechOpinion] = useState('')
  const [techRecommend, setTechRecommend] = useState<'APPROVE' | 'REJECT'>('APPROVE')
  const [techError, setTechError] = useState('')

  // Elevación gestor
  const [elevateOpen, setElevateOpen] = useState(false)
  const [managerNotes, setManagerNotes] = useState('')

  // Aprobación admin
  const [approveOpen, setApproveOpen] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [rejectionError, setRejectionError] = useState('')

  // Contrato
  const [lastContractDialog, setLastContractDialog] = useState<{ contractId: string; contractNumber: string } | null>(null)
  const [closingContract, setClosingContract] = useState(false)

  const assetName = request.equipment
    ? `${request.equipment.code} — ${request.equipment.brand} ${request.equipment.model}`
    : request.license?.name || '—'

  const statusCfg = STATUS_CONFIG[request.status] || STATUS_CONFIG.PENDING
  const StatusIcon = statusCfg.icon

  // Determinar qué acciones puede hacer este usuario
  const isAdmin = userContext.role === 'ADMIN'
  const isSuperAdmin = userContext.isSuperAdmin
  const isTechnician = userContext.role === 'TECHNICIAN'
  const isManager = userContext.canManageInventory && !isAdmin

  const canDoTechnicalReview = isTechnician && request.status === 'PENDING'
  const canElevate = (isManager || isAdmin) && ['PENDING', 'TECHNICAL_REVIEW'].includes(request.status)
  const canApprove = isAdmin && ['PENDING', 'MANAGER_REVIEW', ...(isSuperAdmin ? ['TECHNICAL_REVIEW'] : [])].includes(request.status)
  const canReject  = isAdmin && ['PENDING', 'MANAGER_REVIEW', ...(isSuperAdmin ? ['TECHNICAL_REVIEW'] : [])].includes(request.status)

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleTechnicalReview = async () => {
    if (techOpinion.trim().length < 10) { setTechError('El dictamen debe tener al menos 10 caracteres'); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/inventory/decommission-acts/${request.id}/technical-review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opinion: techOpinion.trim(), recommend: techRecommend }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Error al emitir dictamen')
      toast({
        title: techRecommend === 'APPROVE' ? 'Dictamen favorable emitido' : 'Dictamen desfavorable — solicitud rechazada',
        description: techRecommend === 'APPROVE' ? 'El gestor puede ahora elevar la solicitud al administrador.' : undefined,
      })
      setTechOpen(false)
      setTechOpinion('')
      onActionComplete?.()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const handleElevate = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/inventory/decommission-acts/${request.id}/elevate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: managerNotes.trim() || undefined }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Error al elevar')
      toast({ title: 'Solicitud elevada al administrador', description: 'El administrador recibirá una notificación.' })
      setElevateOpen(false)
      setManagerNotes('')
      onActionComplete?.()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/inventory/decommission-acts/${request.id}/approve`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Error al aprobar')
      toast({ title: 'Solicitud aprobada', description: `Folio generado: ${json.folio}` })
      setApproveOpen(false)
      if (json.lastAssetForContract) {
        setLastContractDialog({ contractId: json.contractId, contractNumber: json.contractNumber })
      } else if (json.contractWarning) {
        toast({ title: 'Contrato vinculado', description: `El contrato ${json.contractNumber} seguirá activo para los demás equipos.` })
        onActionComplete?.()
      } else {
        onActionComplete?.()
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const handleReject = async () => {
    if (rejectionReason.trim().length < 10) { setRejectionError('El motivo debe tener al menos 10 caracteres'); return }
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

  const handleCloseContract = async () => {
    if (!lastContractDialog) return
    setClosingContract(true)
    try {
      const res = await fetch(`/api/inventory/licenses/${lastContractDialog.contractId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: false }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Error al cerrar el contrato')
      toast({ title: 'Contrato cerrado', description: `El contrato ${lastContractDialog.contractNumber} fue cerrado.` })
    } catch (err: any) {
      toast({ title: 'Error al cerrar contrato', description: err.message, variant: 'destructive' })
    } finally {
      setClosingContract(false)
      setLastContractDialog(null)
      onActionComplete?.()
    }
  }

  const fmtDate = (d: string) => new Date(d).toLocaleString('es-EC', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* Header: activo + estado */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold text-lg leading-tight">{assetName}</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            {request.assetType === 'EQUIPMENT' ? 'Equipo' : 'Licencia'} · Solicitado por{' '}
            <strong>{request.requester?.name || request.requester?.email}</strong>
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {fmtDate(request.createdAt)}
          </p>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium shrink-0 ${statusCfg.color}`}>
          <StatusIcon className="h-3 w-3" />
          {statusCfg.label}
        </span>
      </div>

      {/* Descripción del estado actual */}
      <div className={`rounded-lg border px-4 py-3 text-sm ${statusCfg.color}`}>
        <p className="font-medium flex items-center gap-1.5">
          <StatusIcon className="h-4 w-4" />
          {statusCfg.description}
        </p>
      </div>

      <Separator />

      {/* Motivo de baja */}
      <div>
        <Label className="text-xs uppercase text-muted-foreground tracking-wide">Motivo de baja</Label>
        <p className="mt-1 text-sm whitespace-pre-wrap">{request.reason}</p>
      </div>

      {/* Condición del equipo */}
      {request.condition && (
        <div>
          <Label className="text-xs uppercase text-muted-foreground tracking-wide">Condición del equipo</Label>
          <p className="mt-1 text-sm">{CONDITION_LABELS[request.condition] || request.condition}</p>
        </div>
      )}

      {/* Evidencia fotográfica */}
      {request.attachments?.length > 0 && (
        <div>
          <Label className="text-xs uppercase text-muted-foreground tracking-wide">
            Evidencia fotográfica ({request.attachments.length})
          </Label>
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

      {/* Dictamen técnico (si existe) */}
      {request.technicianOpinion && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800 px-4 py-3 space-y-1">
          <div className="flex items-center gap-2 text-sm font-medium text-blue-800 dark:text-blue-300">
            <Wrench className="h-4 w-4" />
            Dictamen técnico
          </div>
          <p className="text-sm text-blue-900 dark:text-blue-200">{request.technicianOpinion}</p>
          {request.technician && (
            <p className="text-xs text-blue-700 dark:text-blue-400 flex items-center gap-1">
              <User className="h-3 w-3" />
              {request.technician.name} · {fmtDate(request.technicianReviewAt)}
            </p>
          )}
        </div>
      )}

      {/* Notas del gestor (si existe) */}
      {request.managerNotes && (
        <div className="rounded-lg border border-purple-200 bg-purple-50 dark:bg-purple-950/20 dark:border-purple-800 px-4 py-3 space-y-1">
          <div className="flex items-center gap-2 text-sm font-medium text-purple-800 dark:text-purple-300">
            <ArrowUpCircle className="h-4 w-4" />
            Notas del gestor
          </div>
          <p className="text-sm text-purple-900 dark:text-purple-200">{request.managerNotes}</p>
          {request.manager && (
            <p className="text-xs text-purple-700 dark:text-purple-400 flex items-center gap-1">
              <User className="h-3 w-3" />
              {request.manager.name} · {fmtDate(request.managerElevatedAt)}
            </p>
          )}
        </div>
      )}

      {/* Acta generada (aprobada) */}
      {request.act && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 dark:bg-green-900/20 dark:border-green-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-green-800 dark:text-green-300">
              <FileText className="h-4 w-4" />
              <span>Acta generada: <strong>{request.act.folio}</strong></span>
            </div>
            {request.act.pdfPath && (
              <a href={`/api/inventory/acts/${request.id}/pdf`} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm">
                  <Download className="mr-2 h-3 w-3" /> Descargar PDF
                </Button>
              </a>
            )}
          </div>
        </div>
      )}

      {/* Motivo de rechazo */}
      {request.status === 'REJECTED' && request.rejectionReason && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 dark:bg-red-900/20 dark:border-red-800">
          <Label className="text-xs uppercase text-red-700 dark:text-red-400 tracking-wide">Motivo de rechazo</Label>
          <p className="mt-1 text-sm text-red-800 dark:text-red-300">{request.rejectionReason}</p>
          {request.reviewer && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-1 flex items-center gap-1">
              <User className="h-3 w-3" />
              {request.reviewer.name} · {fmtDate(request.reviewedAt)}
            </p>
          )}
        </div>
      )}

      {/* ── ACCIONES POR ROL ─────────────────────────────────────────────────── */}

      {/* TÉCNICO: emitir dictamen */}
      {canDoTechnicalReview && (
        <div className="rounded-lg border border-blue-200 bg-blue-50/50 dark:bg-blue-950/10 p-4 space-y-2">
          <p className="text-sm font-medium text-blue-800 dark:text-blue-300 flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            Tu acción: Emitir dictamen técnico
          </p>
          <p className="text-xs text-muted-foreground">
            Como técnico asignado a esta familia, debes evaluar el estado del activo y emitir tu dictamen.
          </p>
          <Button size="sm" onClick={() => setTechOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white">
            <Wrench className="mr-2 h-4 w-4" />
            Emitir dictamen técnico
          </Button>
        </div>
      )}

      {/* GESTOR: elevar al admin */}
      {canElevate && (
        <div className="rounded-lg border border-purple-200 bg-purple-50/50 dark:bg-purple-950/10 p-4 space-y-2">
          <p className="text-sm font-medium text-purple-800 dark:text-purple-300 flex items-center gap-2">
            <ArrowUpCircle className="h-4 w-4" />
            Tu acción: Elevar al administrador
          </p>
          <p className="text-xs text-muted-foreground">
            {request.status === 'TECHNICAL_REVIEW'
              ? 'El técnico emitió dictamen favorable. Revisa y eleva al administrador si estás de acuerdo.'
              : 'Puedes elevar esta solicitud directamente al administrador.'}
          </p>
          <Button size="sm" onClick={() => setElevateOpen(true)} className="bg-purple-600 hover:bg-purple-700 text-white">
            <ArrowUpCircle className="mr-2 h-4 w-4" />
            Elevar al administrador
          </Button>
        </div>
      )}

      {/* ADMIN: aprobar / rechazar */}
      {(canApprove || canReject) && (
        <div className="flex gap-3 pt-2">
          {canApprove && (
            <Button onClick={() => setApproveOpen(true)} className="flex-1 bg-green-600 hover:bg-green-700">
              <CheckCircle className="mr-2 h-4 w-4" /> Aprobar baja
            </Button>
          )}
          {canReject && (
            <Button variant="destructive" onClick={() => setRejectOpen(true)} className="flex-1">
              <XCircle className="mr-2 h-4 w-4" /> Rechazar
            </Button>
          )}
        </div>
      )}

      {/* ── DIALOGS ──────────────────────────────────────────────────────────── */}

      {/* Dialog: Dictamen técnico */}
      <AlertDialog open={techOpen} onOpenChange={o => { setTechOpen(o); if (!o) { setTechOpinion(''); setTechError('') } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Emitir dictamen técnico</AlertDialogTitle>
            <AlertDialogDescription>
              Evalúa el estado del activo <strong>{assetName}</strong> y emite tu dictamen técnico.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-6 pb-2 space-y-3">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setTechRecommend('APPROVE')}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  techRecommend === 'APPROVE'
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-border hover:bg-muted'
                }`}
              >
                <CheckCircle className="h-4 w-4 inline mr-1.5" />
                Favorable — procede la baja
              </button>
              <button
                type="button"
                onClick={() => setTechRecommend('REJECT')}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  techRecommend === 'REJECT'
                    ? 'border-red-500 bg-red-50 text-red-700'
                    : 'border-border hover:bg-muted'
                }`}
              >
                <XCircle className="h-4 w-4 inline mr-1.5" />
                Desfavorable — no procede
              </button>
            </div>
            <Textarea
              value={techOpinion}
              onChange={e => { setTechOpinion(e.target.value); setTechError('') }}
              placeholder="Describe el estado técnico del activo, justificación de tu dictamen... (mínimo 10 caracteres)"
              rows={4}
            />
            {techError && <p className="text-xs text-destructive">{techError}</p>}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleTechnicalReview}
              disabled={loading}
              className={techRecommend === 'APPROVE' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-destructive hover:bg-destructive/90'}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar dictamen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog: Elevar al admin */}
      <AlertDialog open={elevateOpen} onOpenChange={o => { setElevateOpen(o); if (!o) setManagerNotes('') }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Elevar solicitud al administrador</AlertDialogTitle>
            <AlertDialogDescription>
              Estás elevando la solicitud de baja de <strong>{assetName}</strong> al administrador para su aprobación final.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-6 pb-2">
            <Textarea
              value={managerNotes}
              onChange={e => setManagerNotes(e.target.value)}
              placeholder="Notas adicionales para el administrador (opcional)..."
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleElevate} disabled={loading} className="bg-purple-600 hover:bg-purple-700">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Elevar al administrador
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog: Aprobar */}
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
            <AlertDialogAction onClick={handleApprove} disabled={loading} className="bg-green-600 hover:bg-green-700">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar aprobación
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog: Rechazar */}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={() => setSelectedImage(null)}>
          <img src={selectedImage} alt="Evidencia" className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain" />
        </div>
      )}

      {/* Dialog: último equipo del contrato */}
      <AlertDialog open={!!lastContractDialog} onOpenChange={open => { if (!open) { setLastContractDialog(null); onActionComplete?.() } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Último equipo del contrato</AlertDialogTitle>
            <AlertDialogDescription>
              Este era el último equipo vinculado al contrato <strong>{lastContractDialog?.contractNumber}</strong>. ¿Deseas cerrar el contrato también?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setLastContractDialog(null); onActionComplete?.() }} disabled={closingContract}>
              No, mantener activo
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleCloseContract} disabled={closingContract}>
              {closingContract && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sí, cerrar contrato
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
