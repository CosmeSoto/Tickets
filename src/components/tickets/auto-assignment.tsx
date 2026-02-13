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
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface AutoAssignmentProps {
  ticketId: string
  currentAssignee?: {
    id: string
    name: string
    email: string
  }
  onAssignmentComplete?: () => void
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
  onAssignmentComplete,
}: AutoAssignmentProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AssignmentResult | null>(null)
  const [error, setError] = useState('')
  const { toast } = useToast()

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
        toast({
          title: 'Éxito',
          description: 'Ticket asignado automáticamente',
        })
        onAssignmentComplete?.()
      } else {
        // Intentar parsear el error JSON, si falla usar texto plano
        let errorMessage = 'Error al asignar ticket'
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorData.message || errorMessage
        } catch (jsonError) {
          // Si no se puede parsear como JSON, usar el texto de la respuesta
          const errorText = await response.text()
          errorMessage = errorText || `Error ${response.status}: ${response.statusText}`
        }
        
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

  const resetDialog = () => {
    setResult(null)
    setError('')
    setLoading(false)
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={open => {
        setIsOpen(open)
        if (!open) resetDialog()
      }}
    >
      <DialogTrigger asChild>
        <Button variant='outline' className='flex items-center space-x-2'>
          <Bot className='h-4 w-4' />
          <span>Asignación Automática</span>
        </Button>
      </DialogTrigger>
      <DialogContent className='max-w-md'>
        <DialogHeader>
          <DialogTitle className='flex items-center space-x-2'>
            <Bot className='h-5 w-5 text-blue-600' />
            <span>Asignación Automática</span>
          </DialogTitle>
          <DialogDescription>
            El sistema seleccionará automáticamente el mejor técnico para este ticket
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4'>
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
                <Zap className='h-4 w-4 text-blue-600' />
                <span>Especialización en categoría</span>
              </div>
              <div className='flex items-center space-x-2 text-sm'>
                <Clock className='h-4 w-4 text-purple-600' />
                <span>Disponibilidad y actividad</span>
              </div>
              <div className='flex items-center space-x-2 text-sm'>
                <AlertCircle className='h-4 w-4 text-orange-600' />
                <span>Experiencia con prioridades</span>
              </div>
            </CardContent>
          </Card>

          {/* Resultado */}
          {result && (
            <Card className='border-green-200 bg-green-50'>
              <CardHeader className='pb-3'>
                <CardTitle className='text-sm flex items-center space-x-2'>
                  <CheckCircle className='h-4 w-4 text-green-600' />
                  <span>Asignación Completada</span>
                </CardTitle>
              </CardHeader>
              <CardContent className='space-y-3'>
                <div className='flex items-center space-x-2'>
                  <User className='h-4 w-4 text-muted-foreground' />
                  <div>
                    <p className='font-medium text-sm'>{result.assignedTechnician.name}</p>
                    <p className='text-xs text-muted-foreground'>{result.assignedTechnician.email}</p>
                  </div>
                </div>
                <Separator />
                <div>
                  <p className='text-xs font-medium text-foreground mb-1'>Razón de asignación:</p>
                  <p className='text-xs text-muted-foreground'>
                    {result.assignedTechnician.assignmentReason}
                  </p>
                </div>
                <Badge className='bg-green-100 text-green-800'>
                  Estado actualizado a "En Progreso"
                </Badge>
              </CardContent>
            </Card>
          )}

          {/* Error */}
          {error && (
            <Alert variant='destructive'>
              <AlertCircle className='h-4 w-4' />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Acciones */}
          <div className='flex justify-end space-x-2 pt-4'>
            <Button variant='outline' onClick={() => setIsOpen(false)} disabled={loading}>
              {result ? 'Cerrar' : 'Cancelar'}
            </Button>
            {!result && (
              <Button
                onClick={handleAutoAssign}
                disabled={loading}
                className='flex items-center space-x-2'
              >
                {loading ? (
                  <>
                    <Loader2 className='h-4 w-4 animate-spin' />
                    <span>Asignando...</span>
                  </>
                ) : (
                  <>
                    <Bot className='h-4 w-4' />
                    <span>Asignar Automáticamente</span>
                  </>
                )}
              </Button>
            )}
          </div>
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
