'use client'

import { CheckCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { DepartmentData, DepartmentFormData } from '@/hooks/use-departments'

interface DepartmentFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingDepartment: DepartmentData | null
  formData: DepartmentFormData
  setFormData: (data: DepartmentFormData) => void
  onSubmit: (e: React.FormEvent) => Promise<void>
  submitting: boolean
  departments: DepartmentData[]
}

const COLORS = [
  { value: '#3B82F6', label: 'Azul', class: 'bg-blue-500' },
  { value: '#10B981', label: 'Verde', class: 'bg-green-500' },
  { value: '#F59E0B', label: 'Naranja', class: 'bg-orange-500' },
  { value: '#EF4444', label: 'Rojo', class: 'bg-red-500' },
  { value: '#8B5CF6', label: 'Púrpura', class: 'bg-purple-500' },
  { value: '#EC4899', label: 'Rosa', class: 'bg-pink-500' },
  { value: '#14B8A6', label: 'Turquesa', class: 'bg-teal-500' },
  { value: '#F97316', label: 'Naranja Oscuro', class: 'bg-orange-600' },
  { value: '#6366F1', label: 'Índigo', class: 'bg-indigo-500' },
  { value: '#06B6D4', label: 'Cian', class: 'bg-cyan-500' },
]

export function DepartmentFormDialog({
  open,
  onOpenChange,
  editingDepartment,
  formData,
  setFormData,
  onSubmit,
  submitting,
  departments,
}: DepartmentFormDialogProps) {
  
  const handleClose = () => {
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-md'>
        <DialogHeader>
          <DialogTitle>
            {editingDepartment ? 'Editar Departamento' : 'Nuevo Departamento'}
          </DialogTitle>
          <DialogDescription>
            {editingDepartment
              ? 'Actualiza la información del departamento'
              : 'Crea un nuevo departamento para tu organización'}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={onSubmit}>
          <div className='space-y-4 py-4'>
            {/* Nombre */}
            <div className='space-y-2'>
              <Label htmlFor='name'>Nombre *</Label>
              <Input
                id='name'
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder='Ej: Soporte Técnico'
                required
                disabled={submitting}
              />
            </div>

            {/* Descripción */}
            <div className='space-y-2'>
              <Label htmlFor='description'>Descripción</Label>
              <Textarea
                id='description'
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder='Descripción del departamento'
                rows={3}
                disabled={submitting}
              />
            </div>

            {/* Color */}
            <div className='space-y-2'>
              <Label>Color</Label>
              <div className='grid grid-cols-5 gap-2'>
                {COLORS.map((color) => (
                  <button
                    key={color.value}
                    type='button'
                    onClick={() => setFormData({ ...formData, color: color.value })}
                    className={`h-10 w-10 rounded-full ${color.class} ${
                      formData.color === color.value
                        ? 'ring-2 ring-offset-2 ring-blue-500'
                        : ''
                    } transition-all hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed`}
                    title={color.label}
                    disabled={submitting}
                  />
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Color seleccionado: {COLORS.find(c => c.value === formData.color)?.label || 'Personalizado'}
              </p>
            </div>

            {/* Orden */}
            <div className='space-y-2'>
              <Label htmlFor='order'>Orden de visualización</Label>
              <Input
                id='order'
                type='number'
                value={formData.order}
                onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })}
                min={0}
                max={999}
                disabled={submitting}
              />
              <p className="text-xs text-muted-foreground">
                Posición en listas y selectores (0 = primero, números menores aparecen antes)
              </p>
            </div>

            {/* Estado activo */}
            <div className='flex items-center space-x-2'>
              <input
                type='checkbox'
                id='isActive'
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className='h-4 w-4 rounded border-border text-blue-600 focus:ring-blue-500'
                disabled={submitting}
              />
              <Label htmlFor='isActive' className='cursor-pointer'>
                Departamento activo
              </Label>
            </div>
            
            {!formData.isActive && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <p className="text-sm text-yellow-800">
                  ⚠️ Los departamentos inactivos no aparecerán en formularios de creación
                </p>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button 
              type='button' 
              variant='outline' 
              onClick={handleClose}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button 
              type='submit' 
              disabled={submitting || !formData.name.trim()}
            >
              {submitting ? (
                <>
                  <RefreshCw className='h-4 w-4 mr-2 animate-spin' />
                  Guardando...
                </>
              ) : (
                <>
                  <CheckCircle className='h-4 w-4 mr-2' />
                  {editingDepartment ? 'Actualizar' : 'Crear'}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}