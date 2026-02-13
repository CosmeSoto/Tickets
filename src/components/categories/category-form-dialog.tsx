'use client'

import { RefreshCw, Building } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { CategorySelector } from '@/components/ui/category-selector'
import { TechnicianSelector } from '@/components/ui/technician-selector'
import { DepartmentSelector } from '@/components/ui/department-selector'
import { AssignmentStrategyPreview } from '@/components/ui/assignment-strategy-preview'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { CategoryData, FormData } from '@/hooks/use-categories'
import { useCategoryTechnicians } from '@/hooks/use-category-technicians'

interface CategoryFormDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  editingCategory: CategoryData | null
  formData: FormData
  setFormData: (data: FormData) => void
  formErrors: Record<string, string>
  submitting: boolean
  availableParents: CategoryData[]
  availableTechnicians: any[]
  departments: any[]
  onSubmit: (e: React.FormEvent) => void
  onLoadAvailableParents: (excludeId?: string) => void
  onLoadDepartments: () => void
}

export function CategoryFormDialog({
  isOpen,
  onOpenChange,
  editingCategory,
  formData,
  setFormData,
  formErrors,
  submitting,
  availableParents,
  availableTechnicians,
  departments,
  onSubmit,
  onLoadAvailableParents,
  onLoadDepartments,
}: CategoryFormDialogProps) {
  
  const {
    addTechnician,
    removeTechnician,
    updateTechnicianPriority,
    updateTechnicianMaxTickets,
    toggleTechnicianAutoAssign,
    getLevelDescription,
  } = useCategoryTechnicians({
    formData,
    setFormData,
    availableTechnicians,
  })

  const getResultingLevel = () => {
    if (!formData.parentId) return 1
    const parent = availableParents.find(p => p.id === formData.parentId)
    return (parent?.level || 0) + 1
  }

  const getResultingLevelName = () => {
    const level = getResultingLevel()
    switch (level) {
      case 1: return 'Principal'
      case 2: return 'Subcategoría'
      case 3: return 'Especialidad'
      case 4: return 'Detalle'
      default: return 'Máximo'
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-2xl max-h-[90vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>
            {editingCategory ? 'Editar Categoría' : 'Nueva Categoría'}
          </DialogTitle>
          <DialogDescription>
            {editingCategory
              ? 'Modifica los datos de la categoría'
              : 'Crea una nueva categoría para organizar los tickets'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className='space-y-4'>
          {/* Nombre */}
          <div className='space-y-2'>
            <Label htmlFor='name'>Nombre *</Label>
            <Input
              id='name'
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder='Nombre de la categoría'
              disabled={submitting}
            />
            {formErrors.name && <p className='text-sm text-red-600'>{formErrors.name}</p>}
          </div>

          {/* Descripción */}
          <div className='space-y-2'>
            <Label htmlFor='description'>Descripción</Label>
            <Textarea
              id='description'
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              placeholder='Descripción opcional'
              rows={3}
              disabled={submitting}
            />
          </div>

          {/* Color */}
          <div className='space-y-2'>
            <Label htmlFor='color'>Color *</Label>
            <div className='flex items-center space-x-2'>
              <Input
                id='color'
                type='color'
                value={formData.color}
                onChange={e => setFormData({ ...formData, color: e.target.value })}
                className='w-16 h-10'
                disabled={submitting}
              />
              <Input
                value={formData.color}
                onChange={e => setFormData({ ...formData, color: e.target.value })}
                placeholder='#6B7280'
                className='flex-1'
                disabled={submitting}
              />
            </div>
            {formErrors.color && <p className='text-sm text-red-600'>{formErrors.color}</p>}
          </div>

          {/* Categoría Padre */}
          <div className='space-y-2'>
            <div className='flex items-center justify-between'>
              <Label htmlFor='parentId'>Categoría Padre</Label>
              <Button
                type='button'
                variant='outline'
                size='sm'
                onClick={() => onLoadAvailableParents(editingCategory?.id)}
                disabled={submitting}
                className='text-xs px-2 py-1'
              >
                <RefreshCw className='h-3 w-3 mr-1' />
                Actualizar
              </Button>
            </div>
            
            <CategorySelector
              categories={availableParents}
              value={formData.parentId}
              onChange={(categoryId) => {
                setFormData({ ...formData, parentId: categoryId })
              }}
              placeholder="Buscar categoría padre..."
              disabled={submitting}
            />
            
            {availableParents.length === 0 && (
              <p className='text-xs text-amber-600 bg-amber-50 p-2 rounded'>
                ⚠️ No hay categorías padre disponibles. Haz clic en "Actualizar" para recargar.
              </p>
            )}
            
            {formData.parentId && (
              <div className='text-xs text-blue-600 bg-blue-50 p-2 rounded'>
                <strong>Nivel resultante:</strong> {getResultingLevel()} - {getResultingLevelName()}
              </div>
            )}
          </div>

          {/* Departamento */}
          <div className='space-y-2'>
            <div className='flex items-center justify-between'>
              <Label htmlFor='departmentId'>Departamento (Opcional)</Label>
              <Button
                type='button'
                variant='outline'
                size='sm'
                onClick={onLoadDepartments}
                disabled={submitting}
                className='text-xs px-2 py-1'
              >
                <RefreshCw className='h-3 w-3 mr-1' />
                Actualizar
              </Button>
            </div>
            
            <DepartmentSelector
              departments={departments}
              value={formData.departmentId}
              onChange={(deptId) => {
                setFormData({ ...formData, departmentId: deptId })
              }}
              placeholder="Seleccionar departamento..."
              disabled={submitting}
            />
            
            {departments.length === 0 && (
              <p className='text-xs text-amber-600 bg-amber-50 p-2 rounded'>
                ⚠️ No hay departamentos disponibles. Haz clic en "Actualizar" para recargar.
              </p>
            )}
            
            {formData.departmentId && (
              <div className='text-xs text-green-600 bg-green-50 p-2 rounded flex items-start space-x-2'>
                <Building className='h-4 w-4 mt-0.5 flex-shrink-0' />
                <div>
                  <strong>Auto-asignación inteligente:</strong> Al asignar un departamento, se priorizarán técnicos de este departamento cuando se creen tickets en esta categoría.
                </div>
              </div>
            )}
          </div>

          {/* Estado Activo */}
          <div className='flex items-center space-x-2'>
            <input
              type='checkbox'
              id='isActive'
              checked={formData.isActive}
              onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
              className='rounded'
              disabled={submitting}
            />
            <Label htmlFor='isActive'>Categoría activa</Label>
          </div>

          {/* Sección de Asignación de Técnicos */}
          <div className='space-y-3 border-t pt-4'>
            <div className='flex items-center justify-between'>
              <Label className='text-sm font-medium'>Asignación de Técnicos por Niveles</Label>
              <Badge variant='outline' className='text-xs'>
                {getLevelDescription(getResultingLevel())}
              </Badge>
            </div>
            
            <TechnicianSelector
              technicians={availableTechnicians}
              technicianAssignments={formData.technician_assignments}
              onAdd={addTechnician}
              onRemove={removeTechnician}
              onUpdatePriority={updateTechnicianPriority}
              onUpdateMaxTickets={updateTechnicianMaxTickets}
              onToggleAutoAssign={toggleTechnicianAutoAssign}
              disabled={submitting}
              categoryLevel={getResultingLevel()}
            />
            
            {/* Información sobre estrategia de asignación por niveles */}
            <div className='text-xs bg-muted p-3 rounded-lg space-y-2'>
              <div className='font-medium text-foreground'>💡 Estrategia de Asignación por Niveles:</div>
              <div className='space-y-1 text-muted-foreground'>
                <div><strong>Nivel 1 (Principal):</strong> Técnicos generalistas que pueden manejar cualquier problema</div>
                <div><strong>Nivel 2 (Subcategoría):</strong> Técnicos especializados en el área específica</div>
                <div><strong>Nivel 3 (Especialidad):</strong> Expertos con conocimiento profundo</div>
                <div><strong>Nivel 4 (Detalle):</strong> Súper especialistas para problemas muy específicos</div>
              </div>
              <div className='mt-2 p-2 bg-blue-50 rounded text-blue-700'>
                <strong>Cascada Inteligente:</strong> Si no hay técnicos disponibles en este nivel, 
                el sistema buscará automáticamente en niveles superiores (padre → abuelo → bisabuelo).
              </div>
            </div>
          </div>

          {/* Preview de Estrategia de Asignación */}
          <div className='space-y-3 border-t pt-4'>
            <Label className='text-sm font-medium'>Vista Previa de Asignación Automática</Label>
            <AssignmentStrategyPreview
              categoryId={editingCategory?.id || null}
              categoryLevel={getResultingLevel()}
            />
          </div>

          <DialogFooter>
            <Button 
              type='button' 
              variant='outline' 
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button type='submit' disabled={submitting}>
              {submitting ? (
                <>
                  <RefreshCw className='h-4 w-4 mr-2 animate-spin' />
                  {editingCategory ? 'Actualizando...' : 'Creando...'}
                </>
              ) : (
                editingCategory ? 'Actualizar' : 'Crear'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}