'use client'

import { useEffect, useState, useCallback, use } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { ModuleLayout } from '@/components/common/layout/module-layout'
import {
  Download, Eye, FileText, Shield, Package, User, Calendar,
  CheckCircle, XCircle, Clock, AlertTriangle, ChevronLeft,
  Trash2, Copy, Check, ExternalLink,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { PdfPreviewModal } from '@/components/ui/pdf-preview-modal'

interface PageProps { params: Promise<{ id: string }> }

const STATUS_CONFIG = {
  PENDING: { label: 'Pendiente de firma', color: 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-500/20 dark:text-yellow-300 dark:border-yellow-500/40', icon: Clock },
  ACCEPTED: { label: 'Aceptada y firmada', color: 'bg-green-100 text-green-800 border-green-300 dark:bg-green-500/20 dark:text-green-300 dark:border-green-500/40', icon: CheckCircle },
  REJECTED: { label: 'Rechazada', color: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-500/20 dark:text-red-300 dark:border-red-500/40', icon: XCircle },
  EXPIRED: { label: 'Expirada', color: 'bg-muted text-muted-foreground border-border', icon: AlertTriangle },
}

const CONDITION_LABELS: Record<string, string> = {
  NEW: 'Nuevo', LIKE_NEW: 'Como Nuevo', GOOD: 'Bueno', FAIR: 'Regular',
  POOR: 'Malo', EXCELLENT: 'Excelente', DAMAGED: 'Dañado',
}

function fmtDate(d: string | Date) { return format(new Date(d), "d 'de' MMMM 'de' yyyy", { locale: es }) }
function fmtDateTime(d: string | Date) { return format(new Date(d), "d 'de' MMMM 'de' yyyy 'a las' HH:mm", { locale: es }) }

export default function ReturnActDetailPage({ params: paramsPromise }: PageProps) {
  const params = use(paramsPromise)
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()

  const [act, setAct] = useState<any>(null)
  const [canAccept, setCanAccept] = useState(false)
  const [isExpired, setIsExpired] = useState(false)
  const [accessLevel, setAccessLevel] = useState<string>('participant')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showPdfPreview, setShowPdfPreview] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showAcceptDialog, setShowAcceptDialog] = useState(false)
  const [showRejectDialog, setShowRejectDialog] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [copied, setCopied] = useState(false)

  const fetchAct = useCallback(async () => {
    try {
      const res = await fetch(`/api/inventory/return-acts/${params.id}`, { cache: 'no-store' })
      if (!res.ok) { setLoading(false); return }
      const data = await res.json()
      setAct(data.act ?? data)
      setCanAccept(data.canAccept ?? false)
      setIsExpired(data.isExpired ?? false)
      setAccessLevel(data.accessLevel ?? 'participant')
    } catch { /* silencioso */ }
    finally { setLoading(false) }
  }, [params.id])

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return }
    if (session?.user) fetchAct()
  }, [params.id, session, status, router, fetchAct])


  const handleAccept = async () => {
    if (!acceptedTerms) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/inventory/return-acts/${params.id}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: act.acceptanceToken, acceptedTerms: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al aceptar')
      toast({ title: 'Devolución aceptada', description: 'Has firmado el acta de devolución.' })
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
      const res = await fetch(`/api/inventory/return-acts/${params.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: act.acceptanceToken, reason: rejectReason.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al rechazar')
      toast({ title: 'Acta rechazada' })
      setShowRejectDialog(false)
      setRejectReason('')
      await fetchAct()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally { setSubmitting(false) }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const res = await fetch(`/api/inventory/return-acts/${params.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al eliminar')
      toast({ title: 'Acta eliminada', description: 'El acta de devolución fue eliminada permanentemente.' })
      setShowDeleteDialog(false)
      router.push('/inventory/acts?tab=return')
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally { setDeleting(false) }
  }

  const copyLink = () => {
    const text = `${window.location.origin}/acts/return/${act.id}/accept?token=${act.acceptanceToken}`
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(() => fallbackCopy(text))
    } else { fallbackCopy(text) }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const fallbackCopy = (text: string) => {
    const el = document.createElement('textarea')
    el.value = text; el.style.position = 'fixed'; el.style.opacity = '0'
    document.body.appendChild(el); el.focus(); el.select()
    document.execCommand('copy'); if (el && el.parentNode) el.parentNode.removeChild(el)
  }

  if (!session?.user) return null
  if (loading) return <ModuleLayout title='Cargando acta...' loading><div /></ModuleLayout>
  if (!act) return (
    <ModuleLayout title='Acta no encontrada' subtitle=''>
      <Alert variant='destructive'>
        <AlertTriangle className='h-4 w-4' />
        <AlertTitle>Acta no encontrada</AlertTitle>
        <AlertDescription>El acta que buscas no existe o no tienes permisos para verla.</AlertDescription>
      </Alert>
    </ModuleLayout>
  )

  const userId = session.user.id
  const userRole = session.user.role
  const isSuperAdmin = (session.user as any)?.isSuperAdmin === true
  const isAdmin = userRole === 'ADMIN'
  const isAdminOrManager = isAdmin || accessLevel === 'manager'
  // En devolución: receiverInfo = quien devuelve, delivererInfo = quien recibe la devolución
  const isReturner = act.receiverInfo?.id === userId
  const isReceiver = act.delivererInfo?.id === userId
  const canDownload = act.status === 'ACCEPTED' && (isReturner || isReceiver || isAdminOrManager)
  const canSign = canAccept && isReceiver  // quien recibe la devolución firma

  const statusCfg = STATUS_CONFIG[act.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.PENDING
  const StatusIcon = statusCfg.icon
  const folio = act.folio ?? params.id


  return (
    <ModuleLayout title={`Acta ${folio}`} subtitle={`Acta de devolución · ${statusCfg.label}`}>
      <div className='max-w-4xl mx-auto space-y-6'>

        {/* Nav + botón eliminar SuperAdmin */}
        <div className='flex items-center justify-between'>
          <button onClick={() => router.push('/inventory/acts?tab=return')}
            className='inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors'>
            <ChevronLeft className='h-4 w-4' />
            Volver a actas de devolución
          </button>
          {isSuperAdmin && (
            <Button variant='outline' size='sm'
              className='border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400'
              onClick={() => setShowDeleteDialog(true)}>
              <Trash2 className='mr-2 h-4 w-4' />
              Eliminar acta
            </Button>
          )}
        </div>

        {/* Banners */}
        {act.status === 'PENDING' && isReceiver && canAccept && (
          <Alert className='border-yellow-400 bg-yellow-50 dark:bg-yellow-500/10 dark:border-yellow-500/40'>
            <Clock className='h-4 w-4 text-yellow-600 dark:text-yellow-400' />
            <AlertTitle className='text-yellow-800 dark:text-yellow-300'>Acción requerida — Debes confirmar la devolución</AlertTitle>
            <AlertDescription className='text-yellow-700 dark:text-yellow-400'>
              Tienes pendiente confirmar la recepción del equipo devuelto.
            </AlertDescription>
          </Alert>
        )}
        {act.status === 'PENDING' && isReturner && !isReceiver && (
          <Alert className='border-blue-400 bg-blue-50 dark:bg-blue-500/10 dark:border-blue-500/40'>
            <FileText className='h-4 w-4 text-blue-600 dark:text-blue-400' />
            <AlertTitle className='text-blue-800 dark:text-blue-300'>Esperando confirmación</AlertTitle>
            <AlertDescription className='text-blue-700 dark:text-blue-400'>
              Pendiente de confirmación por <strong>{act.delivererInfo?.name}</strong>.
            </AlertDescription>
          </Alert>
        )}
        {act.status === 'ACCEPTED' && (
          <Alert className='border-green-400 bg-green-50 dark:bg-green-500/10 dark:border-green-500/40'>
            <CheckCircle className='h-4 w-4 text-green-600 dark:text-green-400' />
            <AlertTitle className='text-green-800 dark:text-green-300'>Devolución completada</AlertTitle>
            <AlertDescription className='text-green-700 dark:text-green-400'>
              Firmada el {fmtDateTime(act.acceptedAt)} — El PDF está disponible.
            </AlertDescription>
          </Alert>
        )}
        {act.status === 'REJECTED' && (
          <Alert variant='destructive'>
            <XCircle className='h-4 w-4' />
            <AlertTitle>Acta rechazada</AlertTitle>
            <AlertDescription>
              Rechazada el {fmtDateTime(act.rejectedAt)}.
              {act.rejectionReason && <> Motivo: <strong>{act.rejectionReason}</strong></>}
            </AlertDescription>
          </Alert>
        )}

        {/* Encabezado */}
        <Card>
          <CardHeader>
            <div className='flex items-start justify-between flex-wrap gap-3'>
              <div>
                <CardTitle className='text-2xl font-mono'>{folio}</CardTitle>
                <CardDescription className='mt-1'>Creada el {fmtDateTime(act.createdAt)}</CardDescription>
              </div>
              <Badge className={cn('flex items-center gap-1.5 px-3 py-1 border text-sm', statusCfg.color)}>
                <StatusIcon className='h-4 w-4' />
                {statusCfg.label}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className='text-sm text-muted-foreground flex items-center gap-2'>
              <Shield className='h-4 w-4' />
              {isSuperAdmin && !isReturner && !isReceiver && <span>Viendo como <strong>Super Administrador</strong></span>}
              {isAdmin && !isSuperAdmin && !isReturner && !isReceiver && <span>Viendo como <strong>Administrador</strong></span>}
              {accessLevel === 'manager' && !isReturner && !isReceiver && <span>Viendo como <strong>Gestor de Inventario</strong></span>}
              {isReturner && isReceiver && <span>Eres el <strong>Entregador y Receptor</strong></span>}
              {isReturner && !isReceiver && <span>Eres quien <strong>devuelve</strong> el equipo</span>}
              {isReceiver && !isReturner && <span>Eres quien <strong>recibe</strong> la devolución</span>}
            </p>
          </CardContent>
        </Card>

        {/* Equipo */}
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2 text-base'>
              <Package className='h-5 w-5' />
              Equipo devuelto
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className='grid gap-4 sm:grid-cols-2 md:grid-cols-3'>
              {[
                ['Código', act.equipmentSnapshot?.code ?? act.assignment?.equipment?.code],
                ['N° de Serie', act.equipmentSnapshot?.serialNumber ?? act.assignment?.equipment?.serialNumber ?? '—'],
                ['Marca', act.equipmentSnapshot?.brand ?? act.assignment?.equipment?.brand],
                ['Modelo', act.equipmentSnapshot?.model ?? act.assignment?.equipment?.model],
                ['Condición al devolver', CONDITION_LABELS[act.returnCondition] ?? act.returnCondition ?? '—'],
              ].map(([label, value]) => (
                <div key={label as string}>
                  <p className='text-xs text-muted-foreground uppercase tracking-wide mb-1'>{label}</p>
                  <p className='font-medium'>{value ?? '—'}</p>
                </div>
              ))}
            </div>
            {act.inspectionNotes && (
              <>
                <Separator className='my-4' />
                <p className='text-xs text-muted-foreground uppercase tracking-wide mb-1'>Notas de inspección</p>
                <p className='text-sm'>{act.inspectionNotes}</p>
              </>
            )}
            {act.missingAccessories && act.missingAccessories.length > 0 && (
              <>
                <Separator className='my-4' />
                <p className='text-xs text-muted-foreground uppercase tracking-wide mb-2'>Accesorios faltantes</p>
                <ul className='space-y-1'>
                  {act.missingAccessories.map((acc: string, i: number) => (
                    <li key={i} className='flex items-center gap-2 text-sm text-destructive'>
                      <div className='h-1.5 w-1.5 rounded-full bg-destructive' />
                      {acc}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </CardContent>
        </Card>

        {/* Participantes */}
        <div className='grid gap-4 md:grid-cols-2'>
          {[
            { title: 'Devuelto por', info: act.receiverInfo, isMe: isReturner },
            { title: 'Recibido por', info: act.delivererInfo, isMe: isReceiver },
          ].map(({ title, info, isMe }) => (
            <Card key={title}>
              <CardHeader className='pb-3'>
                <CardTitle className='flex items-center gap-2 text-base'>
                  <User className='h-4 w-4' />
                  {title}
                </CardTitle>
              </CardHeader>
              <CardContent className='space-y-1'>
                <p className='font-semibold'>{info?.name}</p>
                <p className='text-sm text-muted-foreground'>{info?.email}</p>
                {info?.department && <p className='text-sm text-muted-foreground'>{info.department}</p>}
                {isMe && <Badge variant='outline' className='text-xs mt-1'>Tú</Badge>}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Fechas */}
        <Card>
          <CardHeader className='pb-3'>
            <CardTitle className='flex items-center gap-2 text-base'>
              <Calendar className='h-4 w-4' />
              Fechas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className='grid gap-3 sm:grid-cols-2 md:grid-cols-3'>
              <div>
                <p className='text-xs text-muted-foreground uppercase tracking-wide mb-1'>Creación</p>
                <p className='text-sm font-medium'>{fmtDateTime(act.createdAt)}</p>
              </div>
              {act.returnDate && (
                <div>
                  <p className='text-xs text-muted-foreground uppercase tracking-wide mb-1'>Fecha de devolución</p>
                  <p className='text-sm font-medium'>{fmtDate(act.returnDate)}</p>
                </div>
              )}
              <div>
                <p className='text-xs text-muted-foreground uppercase tracking-wide mb-1'>Expira</p>
                <p className={cn('text-sm font-medium', isExpired && act.status === 'PENDING' && 'text-red-600')}>
                  {fmtDate(act.expirationDate)}
                </p>
              </div>
              {act.acceptedAt && (
                <div>
                  <p className='text-xs text-muted-foreground uppercase tracking-wide mb-1'>Firmada</p>
                  <p className='text-sm font-medium text-green-700'>{fmtDateTime(act.acceptedAt)}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Firma digital */}
        {act.status === 'ACCEPTED' && act.verificationHash && (
          <Card className='border-green-200'>
            <CardHeader className='pb-3'>
              <CardTitle className='flex items-center gap-2 text-base text-green-800'>
                <Shield className='h-4 w-4' />
                Firma Digital
              </CardTitle>
              <CardDescription>Verificación criptográfica de la aceptación</CardDescription>
            </CardHeader>
            <CardContent className='space-y-3'>
              <div>
                <p className='text-xs text-muted-foreground uppercase tracking-wide mb-1'>Hash de verificación</p>
                <p className='font-mono text-xs break-all bg-muted p-2 rounded'>{act.verificationHash}</p>
              </div>
              {act.signatureIp && (
                <div>
                  <p className='text-xs text-muted-foreground uppercase tracking-wide mb-1'>IP de firma</p>
                  <p className='font-mono text-sm'>{act.signatureIp}</p>
                </div>
              )}
              {act.signatureTimestamp && (
                <div>
                  <p className='text-xs text-muted-foreground uppercase tracking-wide mb-1'>Fecha y hora exacta</p>
                  <p className='text-sm font-medium'>{fmtDateTime(act.signatureTimestamp)}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Enlace para compartir — para quien devuelve o admin/gestor */}
        {act.status === 'PENDING' && (isReturner || isAdminOrManager) && !isExpired && (
          <Card className='border-blue-200'>
            <CardHeader className='pb-3'>
              <CardTitle className='flex items-center gap-2 text-base'>
                <ExternalLink className='h-4 w-4' />
                Enlace de firma para quien recibe
              </CardTitle>
              <CardDescription>
                Comparte con <strong>{act.delivererInfo?.name}</strong> para que confirme la recepción
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className='flex gap-2'>
                <input readOnly
                  value={`${typeof window !== 'undefined' ? window.location.origin : ''}/acts/return/${act.id}/accept?token=${act.acceptanceToken}`}
                  className='flex-1 px-3 py-2 text-xs border rounded-md bg-muted font-mono' />
                <Button variant='outline' size='sm' onClick={copyLink}>
                  {copied ? <Check className='h-4 w-4 text-green-600' /> : <Copy className='h-4 w-4' />}
                  {copied ? 'Copiado' : 'Copiar'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* PDF */}
        {canDownload && (
          <Card className='border-green-200 dark:border-green-500/40 bg-green-50/30 dark:bg-green-500/10'>
            <CardHeader className='pb-3'>
              <CardTitle className='flex items-center gap-2 text-base text-green-800 dark:text-green-300'>
                <FileText className='h-4 w-4' />
                PDF del Acta de Devolución
              </CardTitle>
              <CardDescription>Acta firmada digitalmente. Puedes previsualizar o descargar el PDF oficial.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className='flex flex-wrap gap-2'>
                <Button variant='outline' onClick={() => setShowPdfPreview(true)}>
                  <Eye className='mr-2 h-4 w-4' />
                  Vista previa
                </Button>
                <Button onClick={() => {
                  const a = document.createElement('a')
                  a.href = `/api/inventory/return-acts/${params.id}/pdf`
                  a.download = `Acta_Devolucion_${folio.replace(/\//g, '-')}.pdf`
                  a.click()
                }} className='bg-green-600 hover:bg-green-700 text-white'>
                  <Download className='mr-2 h-4 w-4' />
                  Descargar PDF
                </Button>
              </div>
              <p className='text-xs text-muted-foreground mt-2'>Incluye firma digital, QR de verificación y logo de la empresa</p>
            </CardContent>
          </Card>
        )}

        {/* Acción del receptor */}
        {act.status === 'PENDING' && canSign && (
          <Card className='border-yellow-300 dark:border-yellow-500/40 bg-yellow-50/30 dark:bg-yellow-500/10'>
            <CardHeader className='pb-3'>
              <CardTitle className='text-base'>Tu acción requerida</CardTitle>
              <CardDescription>Confirma que recibiste el equipo devuelto en las condiciones indicadas</CardDescription>
            </CardHeader>
            <CardContent>
              <div className='flex flex-wrap gap-3'>
                <Button className='bg-green-600 hover:bg-green-700 text-white' onClick={() => setShowAcceptDialog(true)}>
                  <CheckCircle className='mr-2 h-4 w-4' />
                  Confirmar recepción
                </Button>
                <Button variant='outline' className='border-red-300 text-red-600 hover:bg-red-50' onClick={() => setShowRejectDialog(true)}>
                  <XCircle className='mr-2 h-4 w-4' />
                  Rechazar devolución
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Dialog: Confirmar recepción */}
      <AlertDialog open={showAcceptDialog} onOpenChange={setShowAcceptDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar recepción del equipo</AlertDialogTitle>
            <AlertDialogDescription>
              Al confirmar, certificas que recibiste el equipo devuelto. Esta acción genera una firma digital y no puede deshacerse.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className='flex items-start gap-3 px-1 py-2'>
            <Checkbox id='terms' checked={acceptedTerms} onCheckedChange={v => setAcceptedTerms(!!v)} />
            <Label htmlFor='terms' className='text-sm leading-relaxed cursor-pointer'>
              Confirmo que he inspeccionado el equipo devuelto y que la información del acta es correcta.
            </Label>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleAccept} disabled={!acceptedTerms || submitting} className='bg-green-600 hover:bg-green-700'>
              {submitting ? 'Firmando...' : 'Confirmar y Firmar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog: Rechazar */}
      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rechazar devolución</AlertDialogTitle>
            <AlertDialogDescription>Indica el motivo del rechazo.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className='px-1 py-2'>
            <Textarea placeholder='Describe el motivo del rechazo (mínimo 10 caracteres)...'
              value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={4} className='resize-none' />
            <p className='text-xs text-muted-foreground mt-1'>{rejectReason.length}/10 caracteres mínimos</p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleReject} disabled={rejectReason.trim().length < 10 || submitting} className='bg-red-600 hover:bg-red-700'>
              {submitting ? 'Rechazando...' : 'Confirmar Rechazo'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog: Eliminar (SuperAdmin) */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar acta permanentemente</AlertDialogTitle>
            <AlertDialogDescription>
              Estás a punto de eliminar el acta <strong>{folio}</strong>. Esta acción es irreversible. La auditoría quedará registrada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className='bg-red-600 hover:bg-red-700'>
              {deleting ? 'Eliminando...' : 'Eliminar permanentemente'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Vista previa PDF */}
      {showPdfPreview && (
        <PdfPreviewModal
          previewUrl={`/api/inventory/return-acts/${params.id}/preview`}
          downloadUrl={`/api/inventory/return-acts/${params.id}/pdf`}
          fileName={`Acta_Devolucion_${folio.replace(/\//g, '-')}.pdf`}
          title={`Vista previa — ${folio}`}
          onClose={() => setShowPdfPreview(false)}
        />
      )}
    </ModuleLayout>
  )
}
