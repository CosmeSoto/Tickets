'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card'
import { Button } from './button'
import { Textarea } from './textarea'
import { Badge } from './badge'
import { Star, MessageSquare, User, CheckCircle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip'

interface Rating {
  id: string
  ticketId: string
  rating: number
  feedback?: string
  categories: {
    responseTime: number
    technicalSkill: number
    communication: number
    problemResolution: number
  }
  client: {
    id: string
    name: string
    email: string
  }
  technician: {
    id: string
    name: string
    email: string
  }
  createdAt: string
  isPublic: boolean
}

interface TechnicianStats {
  averageRating: number
  totalRatings: number
  categoryAverages: {
    responseTime: number
    technicalSkill: number
    communication: number
    problemResolution: number
  }
  recentRatings: Rating[]
}

interface TicketRatingSystemProps {
  ticketId: string
  technicianId?: string
  canRate?: boolean
  showTechnicianStats?: boolean
  mode?: 'client' | 'admin'
  /** Fuerza recarga (p. ej. tras SSE status/rating o al cerrar el modal) */
  refreshKey?: number
  onRatingSubmitted?: () => void
}

export function TicketRatingSystem({
  ticketId,
  technicianId,
  canRate = false,
  showTechnicianStats = false,
  mode = 'client',
  refreshKey = 0,
  onRatingSubmitted,
}: TicketRatingSystemProps) {
  const { toast } = useToast()
  const [rating, setRating] = useState<Rating | null>(null)
  const [technicianStats, setTechnicianStats] = useState<TechnicianStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Form state para nueva calificación
  const [newRating, setNewRating] = useState({
    rating: 0,
    feedback: '',
    categories: {
      responseTime: 0,
      technicalSkill: 0,
      communication: 0,
      problemResolution: 0,
    },
  })

  useEffect(() => {
    loadRatingData()
  }, [ticketId, technicianId, canRate, refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadRatingData = async () => {
    try {
      setLoading(true)

      // Cargar calificación existente
      const ratingResponse = await fetch(`/api/tickets/${ticketId}/rating?_t=${Date.now()}`, {
        cache: 'no-store',
      })
      if (ratingResponse.ok) {
        const ratingData = await ratingResponse.json()
        if (ratingData.success && ratingData.data) {
          setRating(ratingData.data)
        } else {
          setRating(null)
        }
      } else {
        setRating(null)
      }

      // Estadísticas históricas del técnico (solo si el caller las pide explícitamente,
      // p. ej. la vista de admin de un ticket resuelto)
      if (showTechnicianStats && technicianId) {
        try {
          const statsResponse = await fetch(`/api/technicians/${technicianId}/stats`, {
            cache: 'no-store',
          })
          if (statsResponse.ok) {
            const statsData = await statsResponse.json()
            if (statsData.success) setTechnicianStats(statsData.data)
          }
        } catch (statsErr) {
          console.error('Error loading technician stats:', statsErr)
        }
      }
    } catch (err) {
      console.error('Error loading rating data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitRating = async () => {
    if (newRating.rating === 0) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Por favor selecciona una calificación general',
      })
      return
    }

    try {
      setSubmitting(true)
      const response = await fetch(`/api/tickets/${ticketId}/rating`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newRating),
      })

      if (!response.ok) {
        throw new Error('Error al enviar calificación')
      }

      const data = await response.json()

      if (data.success) {
        toast({
          title: 'Calificación enviada',
          description: 'Gracias por tu feedback. El ticket ha sido cerrado automáticamente.',
        })
        // Mostrar la calificación al instante (sin esperar otro GET / remount)
        if (data.data) setRating(data.data)
        else await loadRatingData()
        onRatingSubmitted?.()
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo enviar la calificación',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const StarRating = ({
    value,
    onChange,
    readonly = false,
    size = 'md',
  }: {
    value: number
    onChange?: (rating: number) => void
    readonly?: boolean
    size?: 'sm' | 'md' | 'lg'
  }) => {
    const sizeClasses = {
      sm: 'h-4 w-4',
      md: 'h-5 w-5',
      lg: 'h-6 w-6',
    }

    const handleStarClick = (star: number) => {
      if (!readonly && onChange) {
        onChange(star)
      }
    }

    return (
      <div className='flex items-center space-x-1'>
        {[1, 2, 3, 4, 5].map(star => (
          <button
            key={star}
            type='button'
            disabled={readonly}
            onClick={e => {
              e.preventDefault()
              e.stopPropagation()
              handleStarClick(star)
            }}
            className={`${sizeClasses[size]} ${
              readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110 transition-transform'
            } ${
              star <= value ? 'text-yellow-400 fill-current' : 'text-gray-300 hover:text-yellow-200'
            } focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-opacity-50 rounded`}
            aria-label={`Calificar con ${star} estrella${star !== 1 ? 's' : ''}`}
          >
            <Star className='w-full h-full' />
          </button>
        ))}
      </div>
    )
  }

  const CategoryRating = ({
    label,
    value,
    onChange,
    readonly = false,
  }: {
    label: string
    value: number
    onChange?: (rating: number) => void
    readonly?: boolean
  }) => (
    <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-1'>
      <span className='text-xs font-medium text-foreground'>{label}</span>
      <StarRating value={value} onChange={onChange} readonly={readonly} size='sm' />
    </div>
  )

  if (loading) {
    return (
      <Card>
        <CardContent className='pt-6'>
          <div className='flex items-center justify-center py-8'>
            <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-primary'></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className='space-y-6'>
      {/* Mensaje cuando no hay calificación aún */}
      {!rating && !canRate && (
        <Card
          className={
            mode === 'admin'
              ? 'border-border bg-muted/30'
              : 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950'
          }
        >
          <CardContent className='pt-4 pb-4'>
            <div className='flex items-start space-x-2'>
              <Star
                className={`h-4 w-4 mt-0.5 flex-shrink-0 ${
                  mode === 'admin' ? 'text-muted-foreground' : 'text-blue-600 dark:text-blue-400'
                }`}
              />
              <div>
                {mode === 'admin' ? (
                  <>
                    <h4 className='font-medium text-foreground mb-1 text-sm'>Sin calificación</h4>
                    <p className='text-xs text-muted-foreground'>
                      El cliente podrá calificar este ticket cuando el técnico lo marque como
                      resuelto.
                    </p>
                  </>
                ) : (
                  <>
                    <h4 className='font-medium text-blue-900 dark:text-blue-100 mb-1 text-sm'>
                      Calificación no disponible aún
                    </h4>
                    <p className='text-xs text-blue-800 dark:text-blue-200'>
                      Podrás calificar este ticket una vez que el técnico lo marque como{' '}
                      <strong>resuelto</strong>. Tu calificación cerrará el ticket automáticamente.
                    </p>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Calificación existente */}
      {rating && (
        <Card>
          <CardHeader className='pb-3'>
            <CardTitle className='flex items-center space-x-2 text-base'>
              <Star className='h-4 w-4 text-yellow-400' />
              <span>Calificación del Servicio</span>
            </CardTitle>
            <CardDescription className='text-xs'>
              Evaluación del cliente sobre la resolución del ticket
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4 pt-0'>
            <div className='flex items-center justify-between'>
              <div>
                <div className='flex items-center space-x-2'>
                  <StarRating value={rating.rating} readonly size='md' />
                  <span className='text-xl font-bold text-foreground'>{rating.rating}/5</span>
                </div>
                <p className='text-xs text-muted-foreground mt-1'>
                  Calificado por {rating.client.name}
                </p>
              </div>
              <div className='text-right'>
                <Badge variant='outline' className='text-xs'>
                  {new Date(rating.createdAt).toLocaleDateString()}
                </Badge>
              </div>
            </div>

            {/* Calificaciones por categoría */}
            <div className='grid grid-cols-1 gap-3 p-3 bg-muted rounded-lg'>
              <CategoryRating
                label='Tiempo de Respuesta'
                value={rating.categories.responseTime}
                readonly
              />
              <CategoryRating
                label='Habilidad Técnica'
                value={rating.categories.technicalSkill}
                readonly
              />
              <CategoryRating
                label='Comunicación'
                value={rating.categories.communication}
                readonly
              />
              <CategoryRating
                label='Resolución del Problema'
                value={rating.categories.problemResolution}
                readonly
              />
            </div>

            {/* Feedback del cliente */}
            {rating.feedback && (
              <div className='p-3 bg-blue-50 rounded-lg'>
                <div className='flex items-start space-x-2'>
                  <MessageSquare className='h-3.5 w-3.5 text-blue-600 mt-0.5' />
                  <div>
                    <p className='text-xs font-medium text-blue-900'>Comentarios del cliente:</p>
                    <p className='text-xs text-blue-800 mt-1'>&quot;{rating.feedback}&quot;</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Formulario para nueva calificación */}
      {canRate && !rating && (
        <Card>
          <CardHeader className='pb-3'>
            <CardTitle className='text-base'>Calificar el Servicio</CardTitle>
            <CardDescription className='text-xs'>
              Tu opinión nos ayuda a mejorar la calidad de nuestro soporte
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-5 pt-0'>
            {/* Calificación general */}
            <div>
              <label className='block text-xs font-medium text-foreground mb-2'>
                Calificación General
              </label>
              <div className='flex items-center space-x-3'>
                <StarRating
                  value={newRating.rating}
                  onChange={rating => setNewRating(prev => ({ ...prev, rating }))}
                  size='md'
                />
                <span className='text-sm font-medium text-foreground'>
                  {newRating.rating > 0 && `${newRating.rating}/5`}
                </span>
              </div>
            </div>

            {/* Calificaciones detalladas */}
            <div>
              <label className='block text-xs font-medium text-foreground mb-2'>
                Calificación Detallada
              </label>
              <div className='space-y-2 p-3 bg-muted rounded-lg'>
                <CategoryRating
                  label='Tiempo de Respuesta'
                  value={newRating.categories.responseTime}
                  onChange={rating =>
                    setNewRating(prev => ({
                      ...prev,
                      categories: { ...prev.categories, responseTime: rating },
                    }))
                  }
                />
                <CategoryRating
                  label='Habilidad Técnica'
                  value={newRating.categories.technicalSkill}
                  onChange={rating =>
                    setNewRating(prev => ({
                      ...prev,
                      categories: { ...prev.categories, technicalSkill: rating },
                    }))
                  }
                />
                <CategoryRating
                  label='Comunicación'
                  value={newRating.categories.communication}
                  onChange={rating =>
                    setNewRating(prev => ({
                      ...prev,
                      categories: { ...prev.categories, communication: rating },
                    }))
                  }
                />
                <CategoryRating
                  label='Resolución del Problema'
                  value={newRating.categories.problemResolution}
                  onChange={rating =>
                    setNewRating(prev => ({
                      ...prev,
                      categories: { ...prev.categories, problemResolution: rating },
                    }))
                  }
                />
              </div>
            </div>

            {/* Comentarios */}
            <div>
              <label className='block text-xs font-medium text-foreground mb-2'>
                Comentarios (Opcional)
              </label>
              <Textarea
                placeholder='Comparte tu experiencia y sugerencias para mejorar...'
                value={newRating.feedback}
                onChange={e => setNewRating(prev => ({ ...prev, feedback: e.target.value }))}
                rows={3}
                className='text-xs'
              />
            </div>

            {/* Botón de envío */}
            <Button
              onClick={handleSubmitRating}
              disabled={submitting || newRating.rating === 0}
              className='w-full text-xs h-9'
            >
              {submitting ? 'Enviando...' : 'Enviar Calificación'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Estadísticas del técnico */}
      {showTechnicianStats && technicianStats && mode === 'admin' && (
        <Card>
          <CardHeader className='pb-3'>
            <CardTitle className='flex items-center space-x-2 text-base'>
              <User className='h-4 w-4' />
              <span>Estadísticas del Técnico</span>
            </CardTitle>
            <CardDescription className='text-xs'>
              Rendimiento y calificaciones históricas
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4 pt-0'>
            {/* Resumen general */}
            <div className='grid grid-cols-3 gap-2'>
              <div className='text-center p-2 bg-blue-50 dark:bg-blue-950/50 rounded-lg'>
                <div className='flex items-center justify-center mb-1'>
                  <StarRating
                    value={Math.round(technicianStats.averageRating)}
                    readonly
                    size='sm'
                  />
                </div>
                <div className='text-base font-bold text-blue-900 dark:text-blue-300 leading-tight'>
                  {technicianStats.averageRating.toFixed(1)}
                </div>
                <div className='text-[10px] text-blue-700 dark:text-blue-400 leading-tight mt-0.5'>
                  Promedio General
                </div>
              </div>

              <div className='text-center p-2 bg-green-50 dark:bg-green-950/50 rounded-lg'>
                <div className='text-base font-bold text-green-900 dark:text-green-300 leading-tight'>
                  {technicianStats.totalRatings}
                </div>
                <div className='text-[10px] text-green-700 dark:text-green-400 leading-tight mt-0.5'>
                  Total Calific.
                </div>
              </div>

              <div className='text-center p-2 bg-purple-50 dark:bg-purple-950/50 rounded-lg'>
                <div className='text-base font-bold text-purple-900 dark:text-purple-300 leading-tight'>
                  {technicianStats.recentRatings.filter(r => r.rating >= 4).length}
                </div>
                <div className='text-[10px] text-purple-700 dark:text-purple-400 leading-tight mt-0.5'>
                  Calific. 4+
                </div>
              </div>
            </div>

            {/* Promedios por categoría */}
            <div>
              <h4 className='font-medium text-foreground mb-2 text-sm'>
                Rendimiento por Categoría
              </h4>
              <div className='space-y-2'>
                <CategoryRating
                  label='Tiempo de Respuesta'
                  value={Math.round(technicianStats.categoryAverages.responseTime)}
                  readonly
                />
                <CategoryRating
                  label='Habilidad Técnica'
                  value={Math.round(technicianStats.categoryAverages.technicalSkill)}
                  readonly
                />
                <CategoryRating
                  label='Comunicación'
                  value={Math.round(technicianStats.categoryAverages.communication)}
                  readonly
                />
                <CategoryRating
                  label='Resolución del Problema'
                  value={Math.round(technicianStats.categoryAverages.problemResolution)}
                  readonly
                />
              </div>
            </div>

            {/* Calificaciones recientes */}
            {technicianStats.recentRatings.length > 0 && (
              <div>
                <h4 className='font-medium text-foreground mb-2 text-sm'>
                  Calificaciones Recientes
                </h4>
                <div className='space-y-2 max-h-52 overflow-y-auto'>
                  <TooltipProvider>
                    {technicianStats.recentRatings.slice(0, 5).map(recentRating => (
                      <div key={recentRating.id} className='p-2 bg-muted rounded space-y-1'>
                        <div className='flex items-center justify-between gap-2'>
                          <span className='text-xs font-medium text-foreground truncate'>
                            {recentRating.client?.name ?? 'Cliente'}
                          </span>
                          <div className='flex items-center gap-2 shrink-0'>
                            <StarRating value={recentRating.rating} readonly size='sm' />
                            <span className='text-xs text-muted-foreground'>
                              {new Date(recentRating.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        {recentRating.feedback && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <p className='flex items-center gap-1 text-xs text-muted-foreground italic truncate cursor-default'>
                                <MessageSquare className='h-3 w-3 shrink-0' />
                                <span className='truncate'>
                                  &quot;{recentRating.feedback}&quot;
                                </span>
                              </p>
                            </TooltipTrigger>
                            <TooltipContent side='top' className='max-w-xs'>
                              <p className='text-xs'>{recentRating.feedback}</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    ))}
                  </TooltipProvider>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
