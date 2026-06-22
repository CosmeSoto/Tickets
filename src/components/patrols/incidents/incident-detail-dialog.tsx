'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, ExternalLink } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'

interface IncidentDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  incidentId: string | null
  onActionComplete?: () => void
}

interface IncidentDetail {
  id: string
  description: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  status: 'OPEN' | 'RESOLVED' | 'ESCALATED'
  createdAt: string
  resolvedAt: string | null
  agent?: { id: string; name: string }
  checkpoint?: { id: string; name: string; location: string }
  patrol?: { id: string; route: { name: string }; scheduledStart: string }
  photos?: { id: string; path: string; url?: string }[]
  ticket?: { id: string; ticketCode: string; status: string } | null
}

interface EscalateFamily {
  id: string
  name: string
}

interface EscalateFamiliesData {
  canSelectFamily: boolean
  families: EscalateFamily[]
  defaultFamilyId: string
}

const SEVERITY_BADGE: Record<string, string> = {
  LOW: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  MEDIUM: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  HIGH: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  CRITICAL: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
}
const SEVERITY_LABELS: Record<string, string> = {
  LOW: 'Baja',
  MEDIUM: 'Media',
  HIGH: 'Alta',
  CRITICAL: 'Crítica',
}
const STATUS_BADGE: Record<string, string> = {
  OPEN: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  RESOLVED: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  ESCALATED: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
}
const STATUS_LABELS: Record<string, string> = {
  OPEN: 'Abierta',
  RESOLVED: 'Resuelta',
  ESCALATED: 'Escalada',
}

export function IncidentDetailDialog({
  open,
  onOpenChange,
  incidentId,
  onActionComplete,
}: IncidentDetailDialogProps) {
  const { toast } = useToast()
  const [incident, setIncident] = useState<IncidentDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [confirmAction, setConfirmAction] = useState<'resolve' | 'escalate' | null>(null)

  // Estado del selector de familia para escalado
  const [escalateFamilies, setEscalateFamilies] = useState<EscalateFamiliesData | null>(null)
  const [escalateFamiliesLoading, setEscalateFamiliesLoading] = useState(false)
  const [selectedFamilyId, setSelectedFamilyId] = useState<string>('')

  const fetchIncident = useCallback(async () => {
    if (!incidentId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/patrols/incidents/${incidentId}`)
      if (!res.ok) throw new Error('Error al cargar la novedad')
      const json = await res.json()
      setIncident(json.data || json)
    } catch {
      toast({
        title: 'Error',
        description: 'No se pudo cargar el detalle de la novedad',
        variant: 'destructive',
      })
      onOpenChange(false)
    } finally {
      setLoading(false)
    }
  }, [incidentId, toast, onOpenChange])

  useEffect(() => {
    if (open && incidentId) {
      fetchIncident()
    } else {
      setIncident(null)
      setEscalateFamilies(null)
      setSelectedFamilyId('')
    }
  }, [open, incidentId, fetchIncident])

  // Cargar familias disponibles cuando el usuario abre el diálogo de confirmación de escalado
  const handleEscalateClick = useCallback(async () => {
    if (!incidentId) return
    setConfirmAction('escalate')

    // Evitar recargar si ya tenemos los datos
    if (escalateFamilies) return

    setEscalateFamiliesLoading(true)
    try {
      const res = await fetch(`/api/patrols/incidents/${incidentId}/escalate`)
      if (!res.ok) throw new Error('Error al cargar familias')
      const json = await res.json()
      const data: EscalateFamiliesData = json.data
      setEscalateFamilies(data)
      setSelectedFamilyId(data.defaultFamilyId)
    } catch {
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las áreas disponibles',
        variant: 'destructive',
      })
      setConfirmAction(null)
    } finally {
      setEscalateFamiliesLoading(false)
    }
  }, [incidentId, escalateFamilies, toast])

  const handleAction = async () => {
    if (!incident || !confirmAction) return
    setActionLoading(true)
    try {
      if (confirmAction === 'resolve') {
        const res = await fetch(`/api/patrols/incidents/${incident.id}/resolve`, {
          method: 'POST',
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || 'Error al resolver la novedad')
        }
        toast({ title: 'Éxito', description: 'Novedad marcada como resuelta', variant: 'success' })
      } else {
        // Escalado: enviar familyId solo si el selector estaba disponible
        const body: Record<string, string> = {}
        if (escalateFamilies?.canSelectFamily && selectedFamilyId) {
          body.familyId = selectedFamilyId
        }

        const res = await fetch(`/api/patrols/incidents/${incident.id}/escalate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || 'Error al escalar la novedad')
        }
        const json = await res.json()
        const ticketCode =
          json.data?.ticketCode ||
          (json.data?.ticketId ? String(json.data.ticketId).slice(-8).toUpperCase() : '')
        const familyName =
          escalateFamilies?.families.find(f => f.id === selectedFamilyId)?.name ?? ''
        const familyMsg = familyName ? ` → ${familyName}` : ''
        toast({
          title: 'Éxito',
          description: `Ticket #${ticketCode} creado${familyMsg}`,
          variant: 'success',
        })
      }

      onActionComplete?.()
      onOpenChange(false)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al ejecutar la acción'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setActionLoading(false)
      setConfirmAction(null)
    }
  }

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString('es-CO', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    } catch {
      return dateStr
    }
  }

  const selectedFamilyName = escalateFamilies?.families.find(f => f.id === selectedFamilyId)?.name

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className='sm:max-w-lg max-h-[90vh] overflow-y-auto max-w-[95vw] w-full p-4 sm:p-6'>
          <DialogHeader>
            <DialogTitle>Detalle de Novedad</DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className='flex items-center justify-center py-12'>
              <Loader2 className='h-6 w-6 animate-spin text-muted-foreground' />
            </div>
          ) : incident ? (
            <div className='space-y-4'>
              {/* Badges */}
              <div className='flex items-center gap-2 flex-wrap'>
                <Badge className={`text-xs ${SEVERITY_BADGE[incident.severity]}`}>
                  {SEVERITY_LABELS[incident.severity]}
                </Badge>
                <Badge className={`text-xs ${STATUS_BADGE[incident.status]}`}>
                  {STATUS_LABELS[incident.status]}
                </Badge>
              </div>

              {/* Description */}
              <div>
                <p className='text-sm font-medium text-muted-foreground mb-1'>Descripción:</p>
                <p className='text-sm'>{incident.description}</p>
              </div>

              {/* Context info */}
              <div className='space-y-1.5 text-sm'>
                {incident.checkpoint && (
                  <p>
                    📍 Checkpoint: <span className='font-medium'>{incident.checkpoint.name}</span>
                  </p>
                )}
                {incident.patrol?.route && (
                  <p>
                    🛤️ Ruta: <span className='font-medium'>{incident.patrol.route.name}</span>
                  </p>
                )}
                {incident.agent && (
                  <p>
                    👤 Agente: <span className='font-medium'>{incident.agent.name}</span>
                  </p>
                )}
                <p>
                  📅 Fecha: <span className='font-medium'>{formatDate(incident.createdAt)}</span>
                </p>
              </div>

              {/* Photo */}
              {incident.photos && incident.photos.length > 0 && (
                <div>
                  <img
                    src={incident.photos[0].url || `/uploads/${incident.photos[0].path}`}
                    alt='Foto de novedad'
                    className='w-full max-h-64 object-contain rounded-md border'
                  />
                </div>
              )}

              {/* Status-specific info */}
              {incident.status === 'RESOLVED' && incident.resolvedAt && (
                <p className='text-sm text-green-600 dark:text-green-400'>
                  ✅ Resuelta el {formatDate(incident.resolvedAt)}
                </p>
              )}
              {incident.status === 'ESCALATED' && incident.ticket && (
                <a
                  href={`/admin/tickets/${incident.ticket.id}`}
                  className='inline-flex items-center gap-1 text-sm text-primary hover:underline'
                >
                  <ExternalLink className='h-3.5 w-3.5' />
                  🔗 Escalada — Ticket #{incident.ticket.ticketCode}
                </a>
              )}

              {/* Actions */}
              {incident.status === 'OPEN' && (
                <div className='flex items-center gap-2 pt-2 border-t'>
                  <Button
                    size='sm'
                    className='bg-green-600 hover:bg-green-700 text-white'
                    onClick={() => setConfirmAction('resolve')}
                    disabled={actionLoading}
                  >
                    Resolver
                  </Button>
                  <Button
                    size='sm'
                    className='bg-amber-500 hover:bg-amber-600 text-white'
                    onClick={handleEscalateClick}
                    disabled={actionLoading}
                  >
                    Escalar a Ticket
                  </Button>
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Confirmation AlertDialog */}
      <AlertDialog
        open={confirmAction !== null}
        onOpenChange={v => {
          if (!v) setConfirmAction(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction === 'resolve' ? 'Resolver novedad' : 'Escalar a Ticket'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === 'resolve'
                ? '¿Marcar esta novedad como resuelta?'
                : '¿Escalar esta novedad a un ticket? Se creará un ticket con los datos de la novedad.'}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {/* Selector de familia — solo para escalado cuando hay más de 1 opción */}
          {confirmAction === 'escalate' && (
            <div className='py-2'>
              {escalateFamiliesLoading ? (
                <div className='flex items-center gap-2 text-sm text-muted-foreground'>
                  <Loader2 className='h-4 w-4 animate-spin' />
                  Cargando áreas disponibles…
                </div>
              ) : escalateFamilies?.canSelectFamily ? (
                <div className='space-y-2'>
                  <Label htmlFor='escalate-family-select' className='text-sm font-medium'>
                    Área destino del ticket
                  </Label>
                  <Select
                    value={selectedFamilyId}
                    onValueChange={setSelectedFamilyId}
                    disabled={actionLoading}
                  >
                    <SelectTrigger id='escalate-family-select' className='w-full'>
                      <SelectValue placeholder='Selecciona un área…' />
                    </SelectTrigger>
                    <SelectContent>
                      {escalateFamilies.families.map(f => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.name}
                          {f.id === escalateFamilies.defaultFamilyId && (
                            <span className='ml-1.5 text-xs text-muted-foreground'>(origen)</span>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedFamilyId && selectedFamilyId !== escalateFamilies.defaultFamilyId && (
                    <p className='text-xs text-amber-600 dark:text-amber-400'>
                      ⚠️ El ticket se creará en <strong>{selectedFamilyName}</strong>, diferente al
                      área de la ronda.
                    </p>
                  )}
                </div>
              ) : (
                escalateFamilies && (
                  <p className='text-sm text-muted-foreground'>
                    📁 Área:{' '}
                    <span className='font-medium'>{escalateFamilies.families[0]?.name}</span>
                  </p>
                )
              )}
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAction}
              disabled={actionLoading || escalateFamiliesLoading}
            >
              {actionLoading && <Loader2 className='h-4 w-4 mr-2 animate-spin' />}
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
