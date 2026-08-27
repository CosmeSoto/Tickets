'use client'

import { useState, useEffect } from 'react'
import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import {
  Bot,
  User,
  Zap,
  Target,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  Users,
  UserCheck,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface AutoAssignmentProps {
  ticketId: string
  currentAssignee?: {
    id: string
    name: string
    email: string
  }
  /** Familia del ticket — para ofrecer candidatos manuales (rol + familia nativa/asignada) si la auto-asignación falla. */
  familyId?: string | null
  onAssignmentComplete?: (assignedTechnician?: { id: string; name: string; email: string }) => void
  onOpenChange?: (open: boolean) => void
}

interface ManualCandidate {
  id: string
  name: string
  email: string
  role: string
  isSuperAdmin?: boolean
  department?: { id: string; name: string; color?: string | null } | null
}

interface AssignmentResult {
  ticket: any
  assignedTechnician: {
    id: string
    name: string
    email: string
    assignmentReason: string
  }
  reason: string
}

export function AutoAssignment({
  ticketId,
  currentAssignee,
  familyId,
  onAssignmentComplete,
  onOpenChange,
}: AutoAssignmentProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [configLoading, setConfigLoading] = useState(true)
  const [autoAssignmentEnabled, setAutoAssignmentEnabled] = useState(true)
  const [result, setResult] = useState<AssignmentResult | null>(null)
  const [error, setError] = useState('')
  const [candidates, setCandidates] = useState<ManualCandidate[] | null>(null)
  const [candidatesLoading, setCandidatesLoading] = useState(false)
  const [manualAssigningId, setManualAssigningId] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    fetch('/api/config/tickets')
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (data && typeof data.autoAssignmentEnabled === 'boolean') {
          setAutoAssignmentEnabled(data.autoAssignmentEnabled)
        }
      })
      .catch(() => {})
      .finally(() => setConfigLoading(false))
  }, [])

  const handleAutoAssign = async () => {
    setLoading(true)
    setError('')
    setResult(null)

    try {
      const response = await fetch(`/api/tickets/${ticketId}/assign?mode=auto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workloadBalance: true,
          skillMatch: true,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setResult(data)
        // NO llamar onAssignmentComplete aquí — esperar a que el usuario cierre el dialog
      } else {
        const errorData = await response
          .json()
          .catch(() => ({ error: `Error ${response.status}: ${response.statusText}` }))
        const errorMessage = errorData.error || errorData.message || 'Error al asignar ticket'
        setError(errorMessage)
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error en asignación automática:', error)
      const errorMessage = error instanceof Error ? error.message : 'Error interno del servidor'
      setError(errorMessage)
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  // Cuando la asignación automática falla (típicamente "no hay técnico en el
  // departamento de la categoría"), ofrecer de una vez el picker manual en
  // vez de dejar al admin con un callejón sin salida — mismos candidatos
  // (rol + familia nativa/asignada) que ya usa el resto de la app para
  // resolutores de categoría.
  useEffect(() => {
    if (!error || !familyId) {
      setCandidates(null)
      return
    }
    setCandidatesLoading(true)
    fetch(
      `/api/users?purpose=categoryResolvers&roles=TECHNICIAN,ADMIN&isActive=true&familyId=${familyId}&limit=100`
    )
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        setCandidates(data?.success && Array.isArray(data.data) ? data.data : [])
      })
      .catch(() => setCandidates([]))
      .finally(() => setCandidatesLoading(false))
  }, [error, familyId])

  const handleManualAssign = async (candidate: ManualCandidate) => {
    setManualAssigningId(candidate.id)
    try {
      const response = await fetch(`/api/tickets/${ticketId}/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assigneeId: candidate.id }),
      })
      const data = await response.json().catch(() => null)
      if (response.ok && data?.success) {
        setError('')
        setCandidates(null)
        setResult({
          ticket: data.data?.ticket,
          assignedTechnician: {
            id: candidate.id,
            name: candidate.name,
            email: candidate.email,
            assignmentReason: 'Asignado manualmente desde el listado de disponibles',
          },
          reason: 'Asignado manualmente',
        })
      } else {
        const errorMessage = data?.message || 'No se pudo asignar el ticket'
        toast({ title: 'Error', description: errorMessage, variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error de conexión', variant: 'destructive' })
    } finally {
      setManualAssigningId(null)
    }
  }

  const resetDialog = () => {
    setResult(null)
    setError('')
    setCandidates(null)
    setLoading(false)
  }

  const handleClose = () => {
    setIsOpen(false)
    onOpenChange?.(false)
    // Si hubo asignación exitosa, notificar al padre al cerrar
    if (result) {
      onAssignmentComplete?.(result.assignedTechnician)
    }
    resetDialog()
  }

  if (configLoading || !autoAssignmentEnabled) {
    return null
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={open => {
        if (!open) handleClose()
        else {
          setIsOpen(true)
          onOpenChange?.(true)
        }
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant='outline'
          size='sm'
          className='flex items-center space-x-2'
          onClick={() => {
            setIsOpen(true)
            onOpenChange?.(true)
          }}
        >
          <Bot className='h-4 w-4' />
          <span>Asignación Automática</span>
        </Button>
      </DialogTrigger>
      <DialogContent className='max-w-md' aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className='flex items-center space-x-2'>
            <Bot className='h-5 w-5 text-primary' />
            <span>Asignación Automática</span>
          </DialogTitle>
          <DialogDescription>
            El sistema seleccionará automáticamente el mejor técnico para este ticket
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4'>
          {/* Resultado exitoso — mostrado prominentemente */}
          {result ? (
            <div className='space-y-4'>
              <div className='rounded-lg border-2 border-green-500 bg-green-50 dark:bg-green-950/30 p-4'>
                <div className='flex items-center space-x-2 mb-3'>
                  <CheckCircle className='h-5 w-5 text-green-600 dark:text-green-400' />
                  <span className='font-semibold text-green-800 dark:text-green-300 text-base'>
                    ¡Técnico asignado exitosamente!
                  </span>
                </div>
                <div className='flex items-center space-x-3 mb-3'>
                  <div className='w-10 h-10 rounded-full bg-green-200 dark:bg-green-800 flex items-center justify-center flex-shrink-0'>
                    <User className='h-5 w-5 text-green-700 dark:text-green-300' />
                  </div>
                  <div>
                    <p className='font-semibold text-foreground text-sm'>
                      {result.assignedTechnician.name}
                    </p>
                    <p className='text-xs text-muted-foreground'>
                      {result.assignedTechnician.email}
                    </p>
                  </div>
                </div>
                <Separator className='my-3' />
                <div>
                  <p className='text-xs font-semibold text-foreground mb-1'>Razón de asignación:</p>
                  <p className='text-sm text-muted-foreground leading-relaxed'>
                    {result.assignedTechnician.assignmentReason}
                  </p>
                </div>
                <div className='mt-3'>
                  <Badge className='bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-300'>
                    Estado actualizado a &quot;En Progreso&quot;
                  </Badge>
                </div>
              </div>

              <div className='flex justify-end'>
                <Button onClick={handleClose} className='w-full'>
                  <CheckCircle className='h-4 w-4 mr-2' />
                  Entendido, cerrar
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* Estado actual */}
              <Card>
                <CardHeader className='pb-3'>
                  <CardTitle className='text-sm'>Estado Actual</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className='flex items-center space-x-2'>
                    <User className='h-4 w-4 text-muted-foreground' />
                    {currentAssignee ? (
                      <div>
                        <p className='font-medium text-sm'>{currentAssignee.name}</p>
                        <p className='text-xs text-muted-foreground'>{currentAssignee.email}</p>
                      </div>
                    ) : (
                      <span className='text-muted-foreground text-sm'>Sin asignar</span>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Criterios de asignación */}
              <Card>
                <CardHeader className='pb-3'>
                  <CardTitle className='text-sm'>Criterios de Asignación</CardTitle>
                </CardHeader>
                <CardContent className='space-y-3'>
                  <div className='flex items-center space-x-2 text-sm'>
                    <Target className='h-4 w-4 text-green-600' />
                    <span>Carga de trabajo balanceada</span>
                  </div>
                  <div className='flex items-center space-x-2 text-sm'>
                    <Zap className='h-4 w-4 text-primary' />
                    <span>Especialización en categoría</span>
                  </div>
                  <div className='flex items-center space-x-2 text-sm'>
                    <Clock className='h-4 w-4 text-muted-foreground' />
                    <span>Disponibilidad y actividad</span>
                  </div>
                  <div className='flex items-center space-x-2 text-sm'>
                    <AlertCircle className='h-4 w-4 text-orange-600' />
                    <span>Experiencia con prioridades</span>
                  </div>
                </CardContent>
              </Card>

              {/* Error */}
              {error && (
                <Alert variant='destructive'>
                  <AlertCircle className='h-4 w-4' />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* La auto-asignación no encontró a nadie — ofrecer el picker manual
                  ahí mismo, con los mismos candidatos (rol + familia nativa/asignada)
                  que el resto de la app usa para resolutores de categoría. */}
              {error && (
                <Card>
                  <CardHeader className='pb-3'>
                    <CardTitle className='text-sm flex items-center gap-2'>
                      <UserCheck className='h-4 w-4' />
                      Asignar manualmente
                    </CardTitle>
                    <CardDescription className='text-xs'>
                      Técnicos y admins de la familia de este ticket
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {!familyId ? (
                      <p className='text-xs text-muted-foreground italic'>
                        Este ticket no tiene familia asignada — no se pueden sugerir candidatos.
                      </p>
                    ) : candidatesLoading ? (
                      <div className='flex items-center justify-center py-3'>
                        <Loader2 className='h-4 w-4 animate-spin text-muted-foreground' />
                      </div>
                    ) : !candidates || candidates.length === 0 ? (
                      <p className='text-xs text-muted-foreground italic'>
                        Nadie disponible en esta familia por ahora.
                      </p>
                    ) : (
                      <div className='space-y-1.5 max-h-56 overflow-y-auto'>
                        {candidates.map(candidate => (
                          <div
                            key={candidate.id}
                            className='flex items-center justify-between gap-2 rounded-md border px-2 py-1.5'
                          >
                            <div className='min-w-0'>
                              <div className='flex items-center gap-1.5'>
                                <p className='text-xs font-medium truncate'>{candidate.name}</p>
                                <Badge variant='outline' className='text-[10px] px-1 py-0'>
                                  {candidate.isSuperAdmin
                                    ? 'Super Admin'
                                    : candidate.role === 'ADMIN'
                                      ? 'Admin'
                                      : 'Técnico'}
                                </Badge>
                              </div>
                              <p className='text-[11px] text-muted-foreground truncate'>
                                {candidate.email}
                                {candidate.department ? ` · ${candidate.department.name}` : ''}
                              </p>
                            </div>
                            <Button
                              size='sm'
                              variant='outline'
                              className='h-7 px-2 text-xs flex-shrink-0'
                              disabled={manualAssigningId === candidate.id}
                              onClick={() => handleManualAssign(candidate)}
                            >
                              {manualAssigningId === candidate.id ? (
                                <Loader2 className='h-3 w-3 animate-spin' />
                              ) : (
                                'Asignar'
                              )}
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Acciones */}
              <div className='flex justify-end space-x-2 pt-2'>
                <Button variant='outline' onClick={handleClose} disabled={loading}>
                  Cancelar
                </Button>
                <Button onClick={handleAutoAssign} disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className='h-4 w-4 animate-spin mr-2' />
                      <span>Asignando...</span>
                    </>
                  ) : (
                    <>
                      <Bot className='h-4 w-4 mr-2' />
                      <span>Asignar Automáticamente</span>
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Componente para mostrar estadísticas de asignación automática
export function AssignmentStats() {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/assignment/stats')
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      }
    } catch (error) {
      console.error('Error al cargar estadísticas:', error)
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => {
    fetchStats()
  }, [])

  if (loading) {
    return (
      <Card>
        <CardContent className='pt-6'>
          <div className='flex items-center justify-center py-4'>
            <Loader2 className='h-6 w-6 animate-spin' />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!stats) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center space-x-2'>
          <Bot className='h-5 w-5' />
          <span>Estadísticas de Asignación Automática</span>
        </CardTitle>
        <CardDescription>Rendimiento del sistema de asignación inteligente</CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='grid grid-cols-2 gap-4'>
          <div className='text-center'>
            <div className='text-2xl font-bold text-blue-600'>{stats.totalAutoAssignments}</div>
            <div className='text-sm text-muted-foreground'>Asignaciones Automáticas</div>
          </div>
          <div className='text-center'>
            <div className='text-2xl font-bold text-green-600'>{stats.successRate.toFixed(1)}%</div>
            <div className='text-sm text-muted-foreground'>Tasa de Éxito</div>
          </div>
        </div>

        <Separator />

        <div className='text-center'>
          <div className='text-lg font-semibold'>{stats.avgAssignmentTime}</div>
          <div className='text-sm text-muted-foreground'>Tiempo Promedio de Asignación</div>
        </div>

        <Separator />

        <div>
          <h4 className='font-medium mb-3 flex items-center space-x-2'>
            <Users className='h-4 w-4' />
            <span>Carga de Trabajo por Técnico</span>
          </h4>
          <div className='space-y-2'>
            {stats.technicianWorkloads.slice(0, 5).map((tech: any) => (
              <div key={tech.id} className='flex items-center justify-between text-sm'>
                <span className='font-medium'>{tech.name}</span>
                <div className='flex items-center space-x-2'>
                  <span className='text-muted-foreground'>{tech.activeTickets} tickets</span>
                  <Badge
                    variant={
                      tech.workloadLevel === 'Baja'
                        ? 'default'
                        : tech.workloadLevel === 'Media'
                          ? 'secondary'
                          : tech.workloadLevel === 'Alta'
                            ? 'destructive'
                            : 'destructive'
                    }
                    className='text-xs'
                  >
                    {tech.workloadLevel}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
