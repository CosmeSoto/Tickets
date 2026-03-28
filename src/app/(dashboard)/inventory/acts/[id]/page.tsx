'use client'

import { useEffect, useState, useCallback, use } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { RoleDashboardLayout } from '@/components/layout/role-dashboard-layout'
import {
  Download, FileText, Shield, Package, User, Calendar,
  CheckCircle, XCircle, Clock, AlertTriangle, Copy, ExternalLink, Check, Eye,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { cn } from '@/lib/utils'

interface PageProps { params: Promise<{ id: string }> }

const STATUS_CONFIG = {
  PENDING:  { label: 'Pendiente de firma', color: 'bg-yellow-100 text-yellow-800 border-yellow-300', icon: Clock },
  ACCEPTED: { label: 'Aceptada y firmada', color: 'bg-green-100 text-green-800 border-green-300',   icon: CheckCircle },
  REJECTED: { label: 'Rechazada',          color: 'bg-red-100 text-red-800 border-red-300',          icon: XCircle },
  EXPIRED:  { label: 'Expirada',           color: 'bg-muted text-muted-foreground border-border',       icon: AlertTriangle },
}

const EQUIPMENT_TYPE_LABELS: Record<string, string> = {
  LAPTOP: 'Laptop', DESKTOP: 'Desktop', MONITOR: 'Monitor', PRINTER: 'Impresora',
  PHONE: 'Teléfono', TABLET: 'Tablet', KEYBOARD: 'Teclado', MOUSE: 'Mouse',
  HEADSET: 'Audífonos', WEBCAM: 'Webcam', DOCKING_STATION: 'Docking Station',
  UPS: 'UPS', ROUTER: 'Router', SWITCH: 'Switch', OTHER: 'Otro',
}

const CONDITION_LABELS: Record<string, string> = {
  NEW: 'Nuevo', LIKE_NEW: 'Como Nuevo', GOOD: 'Bueno', FAIR: 'Regular', POOR: 'Malo',
}

function fmtDate(d: string | Date) { return format(new Date(d), "d 'de' MMMM 'de' yyyy", { locale: es }) }
function fmtDateTime(d: string | Date) { return format(new Date(d), "d 'de' MMMM 'de' yyyy 'a las' HH:mm", { locale: es }) }

export default function ActDetailPage({ params: paramsPromise }: PageProps) {
  const params = use(paramsPromise)
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()

  const [act, setAct] = useState<any>(null)
  const [canAccept, setCanAccept] = useState(false)
  const [isExpired, setIsExpired] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [showAcceptDialog, setShowAcceptDialog] = useState(false)
  const [showRejectDialog, setShowRejectDialog] = useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [copied, setCopied] = useState(false)

  const fetchAct = useCallback(async () => {
    try {
      const res = await fetch(`/api/inventory/acts/${params.id}`, { cache: 'no-store' })
      if (!res.ok) { setLoading(false); return }
      const data = await res.json()
      setAct(data.act)
      setCanAccept(data.canAccept)
      setIsExpired(data.isExpired)
    } catch { /* silencioso */ }
    finally { setLoading(false) }
  }, [params.id])

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return }
    if (session?.user) fetchAct()
  }, [params.id, session, status, router, fetchAct])

  const handleDownloadPdf = () => {
    // Descarga directa via URL — evita blob: URLs que el navegador bloquea en HTTP
    const a = document.createElement('a')
    a.href = `/api/inventory/acts/${params.id}/pdf`
    a.download = `Acta_Entrega_${act?.folio?.replace(/\//g, '-') ?? params.id}.pdf`
    a.click()
  }

  const handlePreviewPdf = () => {
    // Abrir en nueva pestaña directamente desde la API
    window.open(`/api/inventory/acts/${params.id}/pdf`, '_blank', 'noopener,noreferrer')
  }

  const handleAccept = async () => {
    if (!acceptedTerms) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/inventory/acts/${params.id}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: act.acceptanceToken, acceptedTerms: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al aceptar')
      toast({ title: 'Acta aceptada', description: 'Has firmado el acta de entrega exitosamente.' })
      setShowAcceptDialog(false)
      await fetchAct()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally { setSubmitting(false) }
  }

  const handleReject = async () => {
    if (rejectReason.trim().length < 10) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/inventory/acts/${params.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: act.acceptanceToken, reason: rejectReason.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al rechazar')
      toast({ title: 'Acta rechazada', description: 'Has rechazado el acta de entrega.' })
      setShowRejectDialog(false)
      setRejectReason('')
      await fetchAct()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally { setSubmitting(false) }
  }

  const copyLink = () => {
    const text = `${window.location.origin}/acts/${act.id}/accept?token=${act.acceptanceToken}`
    // Fallback para contextos sin HTTPS o sin Clipboard API
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(() => fallbackCopy(text))
    } else {
      fallbackCopy(text)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const fallbackCopy = (text: string) => {
    const el = document.createElement('textarea')
    el.value = text
    el.style.position = 'fixed'
    el.style.opacity = '0'
    document.body.appendChild(el)
    el.focus()
    el.select()
    document.execCommand('copy')
    document.body.removeChild(el)
  }

  if (!session?.user) return null

  if (loading) {
    return (
      <RoleDashboardLayout title="Cargando acta..." subtitle="">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        </div>
      </RoleDashboardLayout>
    )
  }

  if (!act) {
    return (
      <RoleDashboardLayout title="Acta no encontrada" subtitle="">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Acta no encontrada</AlertTitle>
          <AlertDescription>El acta que buscas no existe o no tienes permisos para verla.</AlertDescription>
        </Alert>
      </RoleDashboardLayout>
    )
  }

  const userId = session.user.id
  const userRole = session.user.role
  const isDeliverer = act.delivererInfo?.id === userId
  const isReceiver = act.receiverInfo?.id === userId
  const isAdmin = userRole === 'ADMIN'
  const canDownload = act.status === 'ACCEPTED' && (isDeliverer || isReceiver || isAdmin)
  const equipmentId = act.assignment?.equipmentId

  if (!isDeliverer && !isReceiver && !isAdmin) {
    return (
      <RoleDashboardLayout title="Acceso Denegado" subtitle="">
        <Alert variant="destructive">
          <Shield className="h-4 w-4" />
          <AlertTitle>Sin permisos</AlertTitle>
          <AlertDescription>No tienes permisos para ver esta acta de entrega.</AlertDescription>
        </Alert>
      </RoleDashboardLayout>
    )
  }

  const statusCfg = STATUS_CONFIG[act.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.PENDING
  const StatusIcon = statusCfg.icon

  return (
    <RoleDashboardLayout
      title={`Acta ${act.folio}`}
      subtitle="Acta de entrega"
      headerActions={
        <div className="flex gap-2 flex-wrap">
          {canDownload && (
            <>
              <Button
                variant="outline"
                onClick={handlePreviewPdf}
                disabled={loadingPreview}
              >
                <Eye className="mr-2 h-4 w-4" />
                {loadingPreview ? 'Cargando...' : 'Vista previa'}
              </Button>
              <Button
                onClick={handleDownloadPdf}
                disabled={downloadingPdf}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <Download className="mr-2 h-4 w-4" />
                {downloadingPdf ? 'Generando...' : 'Descargar PDF'}
              </Button>
            </>
          )}
          {equipmentId && (
            <Button variant="outline" onClick={() => router.push(`/inventory/equipment/${equipmentId}`)}>
              <Package className="mr-2 h-4 w-4" />
              Ver equipo
            </Button>
          )}
        </div>
      }
    >
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Banners contextuales */}
        {act.status === 'PENDING' && isReceiver && canAccept && (
          <Alert className="border-yellow-400 bg-yellow-50">
            <Clock className="h-4 w-4 text-yellow-600" />
            <AlertTitle className="text-yellow-800">Acción requerida — Debes firmar esta acta</AlertTitle>
            <AlertDescription className="text-yellow-700">
              Tienes pendiente aceptar o rechazar la entrega del equipo <strong>{act.equipmentSnapshot?.code}</strong>.
              Expira el <strong>{fmtDate(act.expirationDate)}</strong>.
            </AlertDescription>
          </Alert>
        )}
        {act.status === 'PENDING' && isReceiver && isExpired && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Acta expirada</AlertTitle>
            <AlertDescription>Esta acta expiró el {fmtDate(act.expirationDate)} sin ser firmada.</AlertDescription>
          </Alert>
        )}
        {act.status === 'PENDING' && isDeliverer && !isReceiver && (
          <Alert className="border-blue-400 bg-blue-50">
            <FileText className="h-4 w-4 text-blue-600" />
            <AlertTitle className="text-blue-800">Esperando firma del receptor</AlertTitle>
            <AlertDescription className="text-blue-700">
              Pendiente de firma por <strong>{act.receiverInfo?.name}</strong>. Expira el <strong>{fmtDate(act.expirationDate)}</strong>.
            </AlertDescription>
          </Alert>
        )}
        {act.status === 'ACCEPTED' && (
          <Alert className="border-green-400 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-800">Acta firmada y aceptada</AlertTitle>
            <AlertDescription className="text-green-700">
              Firmada el {fmtDateTime(act.acceptedAt)} — El PDF está disponible para descarga.
            </AlertDescription>
          </Alert>
        )}
        {act.status === 'REJECTED' && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertTitle>Acta rechazada</AlertTitle>
            <AlertDescription>
              Rechazada el {fmtDateTime(act.rejectedAt)}.
              {act.rejectionReason && <> Motivo: <strong>{act.rejectionReason}</strong></>}
            </AlertDescription>
          </Alert>
        )}

        {/* Encabezado del acta */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div>
                <CardTitle className="text-2xl font-mono">{act.folio}</CardTitle>
                <CardDescription className="mt-1">Creada el {fmtDateTime(act.createdAt)}</CardDescription>
              </div>
              <Badge className={cn('flex items-center gap-1.5 px-3 py-1 border text-sm', statusCfg.color)}>
                <StatusIcon className="h-4 w-4" />
                {statusCfg.label}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Shield className="h-4 w-4" />
              {isAdmin && !isDeliverer && !isReceiver && <span>Viendo como <strong>Administrador</strong></span>}
              {isDeliverer && isReceiver && <span>Eres el <strong>Entregador y Receptor</strong> (autoasignación)</span>}
              {isDeliverer && !isReceiver && <span>Eres el <strong>Entregador</strong> del equipo</span>}
              {isReceiver && !isDeliverer && <span>Eres el <strong>Receptor</strong> del equipo</span>}
              {isAdmin && (isDeliverer || isReceiver) && <span className="ml-1">(también Administrador)</span>}
            </p>
          </CardContent>
        </Card>

        {/* Equipo */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Package className="h-5 w-5" />
              Equipo entregado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
              {[
                ['Código', act.equipmentSnapshot?.code],
                ['Número de Serie', act.equipmentSnapshot?.serialNumber || '—'],
                ['Tipo', EQUIPMENT_TYPE_LABELS[act.equipmentSnapshot?.type] || act.equipmentSnapshot?.type],
                ['Marca', act.equipmentSnapshot?.brand],
                ['Modelo', act.equipmentSnapshot?.model],
                ['Condición', CONDITION_LABELS[act.equipmentSnapshot?.condition] || act.equipmentSnapshot?.condition],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
                  <p className="font-medium">{value}</p>
                </div>
              ))}
            </div>
            {act.accessories && act.accessories.length > 0 && (
              <>
                <Separator className="my-4" />
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Accesorios incluidos</p>
                <ul className="space-y-1">
                  {act.accessories.map((acc: string, i: number) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary" />{acc}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </CardContent>
        </Card>

        {/* Entregador y Receptor */}
        <div className="grid gap-4 md:grid-cols-2">
          {[
            { title: 'Entregado por', info: act.delivererInfo, isMe: isDeliverer },
            { title: 'Recibido por',  info: act.receiverInfo,  isMe: isReceiver },
          ].map(({ title, info, isMe }) => (
            <Card key={title}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <User className="h-4 w-4" />{title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <p className="font-semibold">{info?.name}</p>
                <p className="text-sm text-muted-foreground">{info?.email}</p>
                {info?.department && <p className="text-sm text-muted-foreground">{info.department}</p>}
                {isMe && <Badge variant="outline" className="text-xs mt-1">Tú</Badge>}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Fechas */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-4 w-4" />Fechas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Creación</p>
                <p className="text-sm font-medium">{fmtDateTime(act.createdAt)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Expira</p>
                <p className={cn('text-sm font-medium', isExpired && act.status === 'PENDING' && 'text-red-600')}>
                  {fmtDate(act.expirationDate)}
                </p>
              </div>
              {act.acceptedAt && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Firmada</p>
                  <p className="text-sm font-medium text-green-700">{fmtDateTime(act.acceptedAt)}</p>
                </div>
              )}
              {act.rejectedAt && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Rechazada</p>
                  <p className="text-sm font-medium text-red-600">{fmtDateTime(act.rejectedAt)}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Firma digital */}
        {act.status === 'ACCEPTED' && act.verificationHash && (
          <Card className="border-green-200">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base text-green-800">
                <Shield className="h-4 w-4" />Firma Digital
              </CardTitle>
              <CardDescription>Verificación criptográfica de la aceptación</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Hash de verificación</p>
                <p className="font-mono text-xs break-all bg-muted p-2 rounded">{act.verificationHash}</p>
              </div>
              {act.signatureIp && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">IP de firma</p>
                  <p className="font-mono text-sm">{act.signatureIp}</p>
                </div>
              )}
              {act.signatureTimestamp && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Fecha y hora exacta</p>
                  <p className="text-sm font-medium">{fmtDateTime(act.signatureTimestamp)}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Observaciones */}
        {act.observations && (
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Observaciones</CardTitle></CardHeader>
            <CardContent><p className="text-sm whitespace-pre-wrap">{act.observations}</p></CardContent>
          </Card>
        )}

        {/* Enlace para compartir */}
        {act.status === 'PENDING' && (isDeliverer || isAdmin) && !isExpired && (
          <Card className="border-blue-200">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <ExternalLink className="h-4 w-4" />Enlace de firma para el receptor
              </CardTitle>
              <CardDescription>
                Comparte con <strong>{act.receiverInfo?.name}</strong> para que pueda firmar el acta
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={`${typeof window !== 'undefined' ? window.location.origin : ''}/acts/${act.id}/accept?token=${act.acceptanceToken}`}
                  className="flex-1 px-3 py-2 text-xs border rounded-md bg-muted font-mono"
                />
                <Button variant="outline" size="sm" onClick={copyLink}>
                  {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                  {copied ? 'Copiado' : 'Copiar'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Descarga PDF — visible para todos los participantes cuando está aceptada */}
        {canDownload && (
          <Card className="border-green-200 bg-green-50/30">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base text-green-800">
                <Download className="h-4 w-4" />PDF del Acta
              </CardTitle>
              <CardDescription>
                El acta fue firmada digitalmente. Puedes previsualizar o descargar el PDF oficial con el logo de la empresa.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={handlePreviewPdf}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  Vista previa
                </Button>
                <Button
                  onClick={handleDownloadPdf}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Descargar PDF
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Incluye firma digital, QR de verificación y logo de la empresa
              </p>
            </CardContent>
          </Card>
        )}

        {/* Acciones del receptor */}
        {act.status === 'PENDING' && isReceiver && canAccept && (
          <Card className="border-yellow-300 bg-yellow-50/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Tu acción requerida</CardTitle>
              <CardDescription>Revisa los detalles del equipo y confirma si la entrega es correcta</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={() => setShowAcceptDialog(true)}>
                  <CheckCircle className="mr-2 h-4 w-4" />Aceptar y Firmar
                </Button>
                <Button variant="outline" className="border-red-300 text-red-600 hover:bg-red-50" onClick={() => setShowRejectDialog(true)}>
                  <XCircle className="mr-2 h-4 w-4" />Rechazar entrega
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

      </div>

      {/* Dialog: Aceptar */}
      <AlertDialog open={showAcceptDialog} onOpenChange={setShowAcceptDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aceptar y firmar acta de entrega</AlertDialogTitle>
            <AlertDialogDescription>
              Al aceptar, confirmas que recibiste el equipo <strong>{act.equipmentSnapshot?.code}</strong> ({act.equipmentSnapshot?.brand} {act.equipmentSnapshot?.model}) en las condiciones descritas. Esta acción genera una firma digital y no puede deshacerse.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex items-start gap-3 px-1 py-2">
            <Checkbox id="terms" checked={acceptedTerms} onCheckedChange={(v) => setAcceptedTerms(!!v)} />
            <Label htmlFor="terms" className="text-sm leading-relaxed cursor-pointer">
              Confirmo que he revisado el equipo y los accesorios listados, y que la información del acta es correcta. Acepto la responsabilidad del equipo recibido.
            </Label>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleAccept} disabled={!acceptedTerms || submitting} className="bg-green-600 hover:bg-green-700">
              {submitting ? 'Firmando...' : 'Confirmar y Firmar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog: Rechazar */}
      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rechazar acta de entrega</AlertDialogTitle>
            <AlertDialogDescription>
              Indica el motivo del rechazo. El entregador será notificado y el equipo volverá a su estado anterior.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-1 py-2">
            <Textarea
              placeholder="Describe el motivo del rechazo (mínimo 10 caracteres)..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground mt-1">{rejectReason.length}/10 caracteres mínimos</p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleReject} disabled={rejectReason.trim().length < 10 || submitting} className="bg-red-600 hover:bg-red-700">
              {submitting ? 'Rechazando...' : 'Confirmar Rechazo'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog: Vista previa PDF */}
      <Dialog open={showPdfPreview} onOpenChange={(open) => {
        setShowPdfPreview(open)
        // Liberar el object URL al cerrar para no acumular memoria
        if (!open && pdfPreviewUrl) {
          URL.revokeObjectURL(pdfPreviewUrl)
          setPdfPreviewUrl(null)
        }
      }}>
        <DialogContent className="max-w-4xl w-full h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-5 pb-3 border-b flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Vista previa — {act?.folio}
            </DialogTitle>
            <DialogDescription>
              Revisa el acta antes de descargarla. El PDF incluye firma digital y QR de verificación.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 px-4 pb-4 pt-3 flex flex-col gap-3">
            {pdfPreviewUrl ? (
              <iframe
                src={pdfPreviewUrl}
                className="w-full flex-1 rounded border border-border"
                title={`Vista previa acta ${act?.folio}`}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
              </div>
            )}
            <div className="flex justify-end gap-2 flex-shrink-0">
              <Button variant="outline" onClick={() => setShowPdfPreview(false)}>
                Cerrar
              </Button>
              <Button
                onClick={handleDownloadPdf}
                disabled={downloadingPdf}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <Download className="mr-2 h-4 w-4" />
                {downloadingPdf ? 'Descargando...' : 'Descargar PDF'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </RoleDashboardLayout>
  )
}
