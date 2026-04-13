'use client'

import { RefreshCw, Building, ChevronRight, Home, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { CategorySelector } from '@/components/ui/category-selector'
import { TechnicianSelector } from '@/components/ui/technician-selector'
import { DepartmentSelector } from '@/components/ui/department-selector'
import { AssignmentStrategyPreview } from '@/components/ui/assignment-strategy-preview'
import { CategoryHierarchyModal } from '@/components/ui/category-hierarchy'
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
  onLoadAvailableParents: (excludeId?: string, familyId?: string) => void
  onLoadDepartments: (familyId?: string | null) => void
  onLoadTechnicians: (familyId?: string) => void
  families?: { id: string; name: string; code: string; color: string | null }[]
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
  onLoadTechnicians,
  families = [],
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

  // Derivar familia del padre seleccionado (o del departamento actual)
  const derivedFamilyId = (() => {
    // 1. familyId explícito en el formData (nivel 1 sin padre)
    if (formData.familyId) return formData.familyId
    // 2. Derivar del padre seleccionado
    if (formData.parentId) {
      const parent = availableParents.find(p => p.id === formData.parentId)
      // Intentar desde el departamento del padre en el array departments
      const parentDept = departments.find((d: any) => d.id === parent?.departmentId)
      if (parentDept?.familyId) return parentDept.familyId
      // Fallback: desde la relación departments del padre (si viene del API)
      const parentDeptRel = (parent as any)?.departments
      if (parentDeptRel?.familyId) return parentDeptRel.familyId
    }
    // 3. Derivar del departamento ya seleccionado
    if (formData.departmentId) {
      const dept = departments.find((d: any) => d.id === formData.departmentId)
      if (dept?.familyId) return dept.familyId
      if (dept?.family?.id) return dept.family.id
    }
    return null
  })()

  const derivedFamily = families.find(f => f.id === derivedFamilyId) ?? null

  // Departamentos filtrados por familia derivada
  const filteredDepartments = derivedFamilyId
    ? departments.filter((d: any) => d.familyId === derivedFamilyId)
    : departments

  // Construir la ruta de jerarquía completa (incluyendo la categoría actual)
  const getHierarchyPath = () => {
    // Crear un mapa de todas las categorías disponibles
    const allCategories = new Map()
    
    // Agregar availableParents
    availableParents.forEach(cat => {
      allCategories.set(cat.id, cat)
    })
    
    // Agregar la categoría que se está editando si existe
    if (editingCategory) {
      allCategories.set(editingCategory.id, editingCategory)
    }
    
    // Función recursiva para construir la ruta completa
    const buildPath = (category: CategoryData | any): any[] => {
      if (!category) {
        return []
      }
      
      // Si no tiene padre, es la raíz
      if (!category.categories && !category.parentId) {
        const rootInfo = {
          id: category.id,
          name: category.name,
          level: category.level,
          color: category.color,
          levelName: category.levelName || getLevelNameByNumber(category.level),
          technicians: category.technician_assignments || []
        }
        return [rootInfo]
      }
      
      // Buscar el padre en los datos disponibles
      let parentCategory: CategoryData | any = null
      if (category.categories) {
        // Prisma usa 'categories' para la relación padre
        parentCategory = category.categories
      } else if (category.parentId) {
        parentCategory = allCategories.get(category.parentId)
      }
      
      // Construir recursivamente desde el padre
      const parentPath = parentCategory ? buildPath(parentCategory) : []
      const currentInfo = {
        id: category.id,
        name: category.name,
        level: category.level,
        color: category.color,
        levelName: category.levelName || getLevelNameByNumber(category.level),
        technicians: category.technician_assignments || []
      }
      
      return [...parentPath, currentInfo]
    }
    
    let result = []
    
    // Si estamos editando una categoría existente, incluir toda la ruta hasta ella
    if (editingCategory) {
      result = buildPath(editingCategory as CategoryData)
    }
    // Si estamos creando una nueva categoría, construir ruta del padre + nueva categoría
    else if (formData.parentId) {
      const parentCategory = allCategories.get(formData.parentId)
      if (parentCategory) {
        const parentPath = buildPath(parentCategory)
        const newCategoryInfo = {
          id: 'new',
          name: formData.name || 'Nueva Categoría',
          level: getResultingLevel(),
          color: formData.color,
          levelName: getResultingLevelName(),
          technicians: []
        }
        result = [...parentPath, newCategoryInfo]
      }
    }
    // Categoría de nivel 1 (sin padre)
    else {
      const editingCat = editingCategory as CategoryData | null
      result = [{
        id: editingCat?.id || 'new',
        name: formData.name || editingCat?.name || 'Nueva Categoría',
        level: 1,
        color: formData.color,
        levelName: 'Principal',
        technicians: editingCat?.technician_assignments || []
      }]
    }
    
    return result
  }

  // Función auxiliar para obtener el nombre del nivel
  const getLevelNameByNumber = (level: number): string => {
    switch (level) {
      case 1: return 'Principal'
      case 2: return 'Subcategoría'
      case 3: return 'Especialidad'
      case 4: return 'Detalle'
      default: return 'Máximo'
    }
  }

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
      <DialogContent className='max-w-2xl max-h-[90vh] overflow-y-auto' aria-describedby={undefined}>
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

          {/* ── PASO 1: Familia ── */}
          <div className='space-y-3 border rounded-lg p-3 bg-muted/30'>
            <div className='space-y-2'>
              <Label className='text-sm font-medium'>
                Familia *
              </Label>
              {formData.parentId ? (
                // Familia derivada del padre — solo lectura
                <div className='flex items-center gap-2 px-3 py-2 rounded-md border bg-background text-sm'>
                  {derivedFamily ? (
                    <>
                      <span
                        className='inline-block h-3 w-3 rounded-full flex-shrink-0'
                        style={{ backgroundColor: derivedFamily.color ?? '#6B7280' }}
                      />
                      <span className='font-medium'>{derivedFamily.name}</span>
                      <span className='text-muted-foreground text-xs'>({derivedFamily.code})</span>
                      <span className='text-xs text-muted-foreground ml-auto'>Heredada del padre</span>
                    </>
                  ) : (
                    <span className='text-muted-foreground text-xs'>Sin familia asignada al padre</span>
                  )}
                </div>
              ) : (
                <div className='flex flex-wrap gap-2'>
                  {families.map((f) => (
                    <button
                      key={f.id}
                      type='button'
                      disabled={submitting}
                      onClick={() => {
                        setFormData({ ...formData, familyId: f.id, departmentId: null, parentId: null })
                        onLoadDepartments(f.id)
                        onLoadAvailableParents(editingCategory?.id, f.id)
                        onLoadTechnicians(f.id)
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium transition-colors ${
                        formData.familyId === f.id
                          ? 'text-white border-transparent'
                          : 'bg-background hover:bg-muted'
                      }`}
                      style={
                        formData.familyId === f.id
                          ? { backgroundColor: f.color ?? '#6B7280', borderColor: f.color ?? '#6B7280' }
                          : { borderColor: f.color ?? '#6B7280', color: f.color ?? '#6B7280' }
                      }
                    >
                      <span
                        className='inline-block h-2 w-2 rounded-full'
                        style={{ backgroundColor: formData.familyId === f.id ? 'white' : (f.color ?? '#6B7280') }}
                      />
                      {f.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ── PASO 2: Departamento (solo si hay familia) ── */}
            {(derivedFamilyId || formData.parentId) && (
              <div className='space-y-2'>
                <div className='flex items-center justify-between'>
                  <Label htmlFor='departmentId' className='text-sm font-medium'>
                    Departamento *
                  </Label>
                  <button
                    type='button'
                    onClick={() => onLoadDepartments(derivedFamilyId)}
                    disabled={submitting}
                    className='text-xs text-muted-foreground hover:text-foreground flex items-center gap-1'
                  >
                    <RefreshCw className='h-3 w-3' />
                    Actualizar
                  </button>
                </div>
                <DepartmentSelector
                  departments={filteredDepartments}
                  value={formData.departmentId}
                  onChange={(deptId) => setFormData({ ...formData, departmentId: deptId })}
                  placeholder='Seleccionar departamento...'
                  disabled={submitting}
                />
                {formErrors.departmentId && (
                  <p className='text-sm text-red-600'>{formErrors.departmentId}</p>
                )}
                {formData.departmentId && (
                  <div className='text-xs text-green-600 bg-green-50 p-2 rounded flex items-start gap-2'>
                    <Building className='h-4 w-4 mt-0.5 flex-shrink-0' />
                    <span>
                      <strong>Auto-asignación inteligente:</strong> Los tickets se asignarán preferentemente a técnicos de este departamento.
                    </span>
                  </div>
                )}
              </div>
            )}

            {!derivedFamilyId && !formData.parentId && (
              <p className='text-xs text-amber-600 bg-amber-50 p-2 rounded'>
                ⚠️ Selecciona primero una familia para continuar.
              </p>
            )}
          </div>

          {/* ── PASO 3: Categoría Padre (solo si hay familia seleccionada) ── */}
          {derivedFamilyId && (
            <div className='space-y-2'>
              <div className='flex items-center justify-between'>
                <Label htmlFor='parentId'>Categoría Padre</Label>
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  onClick={() => onLoadAvailableParents(editingCategory?.id, derivedFamilyId ?? undefined)}
                  disabled={submitting}
                  className='text-xs px-2 py-1'
                >
                  <RefreshCw className='h-3 w-3 mr-1' />
                  Actualizar
                </Button>
              </div>

              {/* Nivel resultante */}
              <div className='bg-blue-50 dark:bg-blue-950 p-3 rounded-lg border border-blue-200 dark:border-blue-800'>
                <div className='text-sm font-medium text-blue-700 dark:text-blue-300 mb-2'>
                  📊 Nivel de la Categoría
                </div>
                <div className='flex items-center justify-between text-sm'>
                  <span className='text-blue-600 dark:text-blue-400'>Nivel resultante:</span>
                  <Badge variant='outline' className='font-medium'>
                    Nivel {getResultingLevel()} - {getResultingLevelName()}
                  </Badge>
                </div>
                <div className='text-xs text-blue-600 dark:text-blue-400 mt-1'>
                  {getResultingLevel() === 1 && '🏠 Categoría principal (sin padre)'}
                  {getResultingLevel() === 2 && '📁 Subcategoría de nivel 2'}
                  {getResultingLevel() === 3 && '🔖 Especialidad de nivel 3'}
                  {getResultingLevel() === 4 && '🎯 Detalle específico (nivel máximo)'}
                </div>
                {getResultingLevel() === 4 && (
                  <div className='text-xs text-amber-600 bg-amber-50 p-2 rounded mt-1'>
                    ⚠️ Nivel máximo alcanzado. No se pueden crear subcategorías.
                  </div>
                )}
              </div>

              <CategorySelector
                categories={availableParents}
                value={formData.parentId}
                onChange={(categoryId) => setFormData({ ...formData, parentId: categoryId })}
                placeholder='Buscar categoría padre...'
                disabled={submitting}
              />

              {availableParents.length === 0 && (
                <p className='text-xs text-muted-foreground bg-muted p-2 rounded'>
                  No hay categorías padre disponibles en esta familia. Se creará como categoría principal.
                </p>
              )}

              {/* Ruta de jerarquía */}
              {(formData.parentId || (editingCategory && editingCategory.level > 1)) && (
                <div className='bg-slate-50 dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800'>
                  <div className='text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 flex items-center'>
                    <Home className='h-4 w-4 mr-2' />
                    Ruta de Jerarquía
                  </div>
                  <div className='text-sm text-slate-600 dark:text-slate-400'>
                    {getHierarchyPath().map((item, index, array) => {
                      const isLast = index === array.length - 1
                      return (
                        <span key={`${item.id}-${index}`}>
                          <span className={isLast ? 'font-medium text-slate-900 dark:text-slate-100' : ''}>{item.name}</span>
                          {!isLast && <span className='mx-1 text-slate-400'>→</span>}
                        </span>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── PASO 4: Datos de la categoría ── */}
          <div className='space-y-4'>
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

          {/* Sección de Asignación de Técnicos - Simplificada */}
          <div className='space-y-3 border-t pt-4'>
            <div className='flex items-center justify-between'>
              <Label className='text-sm font-medium'>Técnicos Asignados</Label>
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
            
            {/* Información compacta sobre cascada */}
            {formData.technician_assignments.length === 0 && (
              <div className='text-xs bg-amber-50 p-2 rounded text-amber-700'>
                💡 Sin técnicos asignados. Se usará cascada inteligente hacia niveles superiores.
              </div>
            )}
          </div>

          {/* Vista Previa de Asignación - Simplificada */}
          <div className="space-y-3 border-t pt-4">
            <Label className="text-sm font-medium">🎯 Vista Previa de Asignación</Label>
            
            <AssignmentStrategyPreview
              categoryId={editingCategory?.id || null}
              categoryLevel={getResultingLevel()}
              hierarchyPath={getHierarchyPath()}
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