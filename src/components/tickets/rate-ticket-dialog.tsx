'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Star, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface RateTicketDialogProps {
  ticketId: string
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

interface Rating {
  overall: number
  responseTime: number
  technicalSkill: number
  communication: number
  problemResolution: number
}

export function RateTicketDialog({
  ticketId,
  isOpen,
  onClose,
  onSuccess,
}: RateTicketDialogProps) {
  const [loading, setLoading] = useState(false)
  const [ratings, setRatings] = useState<Rating>({
    overall: 0,
    responseTime: 0,
    technicalSkill: 0,
    communication: 0,
    problemResolution: 0,
  })
  const [comments, setComments] = useState('')

  const handleRatingChange = (category: keyof Rating, value: number) => {
    setRatings(prev => ({ ...prev, [category]: value }))
  }

  const handleSubmit = async () => {
    // Validar que al menos la calificación general esté completa
    if (ratings.overall === 0) {
      toast.error('Por favor califica el servicio general')
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`/api/tickets/${ticketId}/rate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...ratings,
          comments: comments || undefined,
        }),
      })

      if (!response.ok) {
        throw new Error('Error al enviar calificación')
      }

      toast.success('Gracias por tu calificación')
      onSuccess?.()
      handleClose()
    } catch (error) {
      toast.error('Error al enviar calificación')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setRatings({
      overall: 0,
      responseTime: 0,
      technicalSkill: 0,
      communication: 0,
      problemResolution: 0,
    })
    setComments('')
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Califica el Servicio</DialogTitle>
          <DialogDescription>
            Tu opinión nos ayuda a mejorar nuestro servicio
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Calificación General */}
          <RatingField
            label="Calificación General"
            description="¿Cómo calificarías el servicio en general?"
            value={ratings.overall}
            onChange={(value) => handleRatingChange('overall', value)}
            required
          />

          {/* Tiempo de Respuesta */}
          <RatingField
            label="Tiempo de Respuesta"
            description="¿Qué tan rápido fue la respuesta?"
            value={ratings.responseTime}
            onChange={(value) => handleRatingChange('responseTime', value)}
          />

          {/* Habilidad Técnica */}
          <RatingField
            label="Habilidad Técnica"
            description="¿El técnico demostró conocimiento?"
            value={ratings.technicalSkill}
            onChange={(value) => handleRatingChange('technicalSkill', value)}
          />

          {/* Comunicación */}
          <RatingField
            label="Comunicación"
            description="¿La comunicación fue clara y profesional?"
            value={ratings.communication}
            onChange={(value) => handleRatingChange('communication', value)}
          />

          {/* Resolución del Problema */}
          <RatingField
            label="Resolución del Problema"
            description="¿Se resolvió tu problema satisfactoriamente?"
            value={ratings.problemResolution}
            onChange={(value) => handleRatingChange('problemResolution', value)}
          />

          {/* Comentarios */}
          <div className="space-y-2">
            <Label htmlFor="comments">
              Comentarios Adicionales (Opcional)
            </Label>
            <Textarea
              id="comments"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Cuéntanos más sobre tu experiencia..."
              rows={4}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground">
              {comments.length}/500 caracteres
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enviar Calificación
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface RatingFieldProps {
  label: string
  description: string
  value: number
  onChange: (value: number) => void
  required?: boolean
}

function RatingField({
  label,
  description,
  value,
  onChange,
  required = false,
}: RatingFieldProps) {
  return (
    <div className="space-y-2">
      <Label>
        {label} {required && <span className="text-red-500">*</span>}
      </Label>
      <p className="text-sm text-muted-foreground">{description}</p>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className="transition-transform hover:scale-110"
          >
            <Star
              className={`h-8 w-8 ${
                star <= value
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'text-gray-300'
              }`}
            />
          </button>
        ))}
        {value > 0 && (
          <span className="ml-2 text-sm text-muted-foreground self-center">
            {value} de 5
          </span>
        )}
      </div>
    </div>
  )
}
