'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CategorySelectorWrapper } from '@/features/category-selection/components/CategorySelectorWrapper'
import { useSession } from 'next-auth/react'

interface TicketFormProps {
  onSubmit?: (data: any) => void
  initialData?: any
  isLoading?: boolean
}

export function TicketForm({ onSubmit, initialData, isLoading = false }: TicketFormProps) {
  const { data: session } = useSession()
  const [formData, setFormData] = useState({
    title: initialData?.title || '',
    description: initialData?.description || '',
    priority: initialData?.priority || 'medium',
    categoryId: initialData?.categoryId || initialData?.category || '',
    ...initialData
  })
  const [categoryError, setCategoryError] = useState<string>('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate category selection
    if (!formData.categoryId) {
      setCategoryError('Por favor selecciona una categoría para el ticket')
      return
    }
    
    setCategoryError('')
    onSubmit?.(formData)
  }

  const handleChange = (field: string, value: string) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }))
  }

  const handleCategoryChange = (categoryId: string) => {
    setFormData((prev: any) => ({ ...prev, categoryId }))
    setCategoryError('')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {initialData ? 'Editar Ticket' : 'Crear Nuevo Ticket'}
        </CardTitle>
        <CardDescription>
          {initialData 
            ? 'Modifica los detalles del ticket' 
            : 'Completa la información para crear un nuevo ticket'
          }
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="title">Título</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => handleChange('title', e.target.value)}
              placeholder="Describe brevemente el problema"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Proporciona detalles adicionales sobre el problema"
              rows={4}
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="priority">Prioridad</Label>
              <Select value={formData.priority} onValueChange={(value) => handleChange('priority', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona la prioridad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baja</SelectItem>
                  <SelectItem value="medium">Media</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="urgent">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Enhanced Category Selector */}
          <div className="space-y-2">
            <Label htmlFor="category">Categoría *</Label>
            <CategorySelectorWrapper
              value={formData.categoryId}
              onChange={handleCategoryChange}
              ticketTitle={formData.title}
              ticketDescription={formData.description}
              clientId={session?.user?.id}
              error={categoryError}
              disabled={disabled}
            />
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" disabled={isLoading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Guardando...' : (initialData ? 'Actualizar' : 'Crear Ticket')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

export default TicketForm