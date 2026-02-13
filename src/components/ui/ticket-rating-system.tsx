'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card'
import { Button } from './button'
import { Textarea } from './textarea'
import { Badge } from './badge'
import { 
  Star, 
  MessageSquare, 
  User,
  CheckCircle
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

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
}

export function TicketRatingSystem({ 
  ticketId, 
  technicianId,
  canRate = false, 
  showTechnicianStats = false,
  mode = 'client'
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
      problemResolution: 0
    }
  })

  useEffect(() => {
    loadRatingData()
  }, [ticketId, technicianId])

  const loadRatingData = async () => {
    try {
      setLoading(true)
      
      // Cargar calificación existente
      const ratingResponse = await fetch(`/api/tickets/${ticketId}/rating`)
      if (ratingResponse.ok) {
        const ratingData = await ratingResponse.json()
        if (ratingData.success && ratingData.data) {
          setRating(ratingData.data)
        }
      }

      // Cargar estadísticas del técnico si se requiere
      if (showTechnicianStats && technicianId) {
        const statsResponse = await fetch(`/api/technicians/${technicianId}/stats`)
        if (statsResponse.ok) {
          const statsData = await statsResponse.json()
          if (statsData.success && statsData.data) {
            setTechnicianStats(statsData.data)
          }
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
        variant: "destructive",
        title: "Error",
        description: "Por favor selecciona una calificación general"
      })
      return
    }

    try {
      setSubmitting(true)
      const response = await fetch(`/api/tickets/${ticketId}/rating`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newRating)
      })

      if (!response.ok) {
        throw new Error('Error al enviar calificación')
      }

      const data = await response.json()
      
      if (data.success) {
        toast({
          title: "Calificación enviada",
          description: "Gracias por tu feedback. Nos ayuda a mejorar nuestro servicio."
        })
        loadRatingData() // Recargar datos
      }
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo enviar la calificación"
      })
    } finally {
      setSubmitting(false)
    }
  }

  const StarRating = ({ 
    value, 
    onChange, 
    readonly = false, 
    size = 'md' 
  }: { 
    value: number
    onChange?: (rating: number) => void
    readonly?: boolean
    size?: 'sm' | 'md' | 'lg'
  }) => {
    const sizeClasses = {
      sm: 'h-4 w-4',
      md: 'h-5 w-5',
      lg: 'h-6 w-6'
    }

    const handleStarClick = (star: number) => {
      if (!readonly && onChange) {
        onChange(star)
      }
    }

    return (
      <div className="flex items-center space-x-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            disabled={readonly}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              handleStarClick(star)
            }}
            className={`${sizeClasses[size]} ${
              readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110 transition-transform'
            } ${
              star <= value
                ? 'text-yellow-400 fill-current'
                : 'text-gray-300 hover:text-yellow-200'
            } focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-opacity-50 rounded`}
            aria-label={`Calificar con ${star} estrella${star !== 1 ? 's' : ''}`}
          >
            <Star className="w-full h-full" />
          </button>
        ))}
      </div>
    )
  }

  const CategoryRating = ({ 
    label, 
    value, 
    onChange, 
    readonly = false 
  }: { 
    label: string
    value: number
    onChange?: (rating: number) => void
    readonly?: boolean
  }) => (
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <StarRating 
        value={value} 
        onChange={onChange} 
        readonly={readonly} 
        size="sm"
      />
    </div>
  )

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Calificación existente */}
      {rating && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Star className="h-5 w-5 text-yellow-400" />
              <span>Calificación del Servicio</span>
            </CardTitle>
            <CardDescription>
              Evaluación del cliente sobre la resolución del ticket
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center space-x-2">
                  <StarRating value={rating.rating} readonly size="lg" />
                  <span className="text-2xl font-bold text-foreground">
                    {rating.rating}/5
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Calificado por {rating.client.name}
                </p>
              </div>
              <div className="text-right">
                <Badge variant="outline">
                  {new Date(rating.createdAt).toLocaleDateString()}
                </Badge>
              </div>
            </div>

            {/* Calificaciones por categoría */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
              <CategoryRating 
                label="Tiempo de Respuesta" 
                value={rating.categories.responseTime} 
                readonly 
              />
              <CategoryRating 
                label="Habilidad Técnica" 
                value={rating.categories.technicalSkill} 
                readonly 
              />
              <CategoryRating 
                label="Comunicación" 
                value={rating.categories.communication} 
                readonly 
              />
              <CategoryRating 
                label="Resolución del Problema" 
                value={rating.categories.problemResolution} 
                readonly 
              />
            </div>

            {/* Feedback del cliente */}
            {rating.feedback && (
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="flex items-start space-x-2">
                  <MessageSquare className="h-4 w-4 text-blue-600 mt-1" />
                  <div>
                    <p className="text-sm font-medium text-blue-900">
                      Comentarios del cliente:
                    </p>
                    <p className="text-sm text-blue-800 mt-1">
                      "{rating.feedback}"
                    </p>
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
          <CardHeader>
            <CardTitle>Calificar el Servicio</CardTitle>
            <CardDescription>
              Tu opinión nos ayuda a mejorar la calidad de nuestro soporte
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Calificación general */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Calificación General
              </label>
              <div className="flex items-center space-x-4">
                <StarRating 
                  value={newRating.rating} 
                  onChange={(rating) => setNewRating(prev => ({ ...prev, rating }))}
                  size="lg"
                />
                <span className="text-lg font-medium text-foreground">
                  {newRating.rating > 0 && `${newRating.rating}/5`}
                </span>
              </div>
            </div>

            {/* Calificaciones detalladas */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-3">
                Calificación Detallada
              </label>
              <div className="space-y-3 p-4 bg-muted rounded-lg">
                <CategoryRating 
                  label="Tiempo de Respuesta" 
                  value={newRating.categories.responseTime}
                  onChange={(rating) => setNewRating(prev => ({
                    ...prev,
                    categories: { ...prev.categories, responseTime: rating }
                  }))}
                />
                <CategoryRating 
                  label="Habilidad Técnica" 
                  value={newRating.categories.technicalSkill}
                  onChange={(rating) => setNewRating(prev => ({
                    ...prev,
                    categories: { ...prev.categories, technicalSkill: rating }
                  }))}
                />
                <CategoryRating 
                  label="Comunicación" 
                  value={newRating.categories.communication}
                  onChange={(rating) => setNewRating(prev => ({
                    ...prev,
                    categories: { ...prev.categories, communication: rating }
                  }))}
                />
                <CategoryRating 
                  label="Resolución del Problema" 
                  value={newRating.categories.problemResolution}
                  onChange={(rating) => setNewRating(prev => ({
                    ...prev,
                    categories: { ...prev.categories, problemResolution: rating }
                  }))}
                />
              </div>
            </div>

            {/* Comentarios */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Comentarios (Opcional)
              </label>
              <Textarea
                placeholder="Comparte tu experiencia y sugerencias para mejorar..."
                value={newRating.feedback}
                onChange={(e) => setNewRating(prev => ({ ...prev, feedback: e.target.value }))}
                rows={4}
              />
            </div>

            {/* Botón de envío */}
            <Button 
              onClick={handleSubmitRating} 
              disabled={submitting || newRating.rating === 0}
              className="w-full"
            >
              {submitting ? 'Enviando...' : 'Enviar Calificación'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Estadísticas del técnico */}
      {showTechnicianStats && technicianStats && mode === 'admin' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <User className="h-5 w-5" />
              <span>Estadísticas del Técnico</span>
            </CardTitle>
            <CardDescription>
              Rendimiento y calificaciones históricas
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Resumen general */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center justify-center space-x-1 mb-2">
                  <StarRating value={Math.round(technicianStats.averageRating)} readonly size="sm" />
                </div>
                <div className="text-2xl font-bold text-blue-900">
                  {technicianStats.averageRating.toFixed(1)}
                </div>
                <div className="text-sm text-blue-700">Promedio General</div>
              </div>
              
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-900">
                  {technicianStats.totalRatings}
                </div>
                <div className="text-sm text-green-700">Total Calificaciones</div>
              </div>
              
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-900">
                  {technicianStats.recentRatings.filter(r => r.rating >= 4).length}
                </div>
                <div className="text-sm text-purple-700">Calificaciones 4+</div>
              </div>
            </div>

            {/* Promedios por categoría */}
            <div>
              <h4 className="font-medium text-foreground mb-3">Rendimiento por Categoría</h4>
              <div className="space-y-2">
                <CategoryRating 
                  label="Tiempo de Respuesta" 
                  value={Math.round(technicianStats.categoryAverages.responseTime)} 
                  readonly 
                />
                <CategoryRating 
                  label="Habilidad Técnica" 
                  value={Math.round(technicianStats.categoryAverages.technicalSkill)} 
                  readonly 
                />
                <CategoryRating 
                  label="Comunicación" 
                  value={Math.round(technicianStats.categoryAverages.communication)} 
                  readonly 
                />
                <CategoryRating 
                  label="Resolución del Problema" 
                  value={Math.round(technicianStats.categoryAverages.problemResolution)} 
                  readonly 
                />
              </div>
            </div>

            {/* Calificaciones recientes */}
            {technicianStats.recentRatings.length > 0 && (
              <div>
                <h4 className="font-medium text-foreground mb-3">Calificaciones Recientes</h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {technicianStats.recentRatings.slice(0, 5).map((recentRating) => (
                    <div key={recentRating.id} className="flex items-center justify-between p-2 bg-muted rounded">
                      <div className="flex items-center space-x-2">
                        <StarRating value={recentRating.rating} readonly size="sm" />
                        <span className="text-sm text-muted-foreground">
                          {new Date(recentRating.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      {recentRating.feedback && (
                        <MessageSquare className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}