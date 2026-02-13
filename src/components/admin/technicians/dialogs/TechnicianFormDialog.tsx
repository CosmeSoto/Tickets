/**
 * Diálogo de formulario para crear/editar técnicos
 * Autocontenido con toda la lógica de estado y validación
 */

'use client'

import { useState, useEffect } from 'react'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, X, Save, User } from 'lucide-react'
import type { 
  Technician, 
  TechnicianFormData, 
  Department, 
  Category 
} from '@/types/technicians'
import { validateTechnicianForm } from '../TechnicianManagement.module'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingTechnician: Technician | null
  promotingUser: any | null
  departments: Department[]
  availableCategories: Category[]
  onSuccess: () => void
  onClose: () => void
}

const initialFormData: TechnicianFormData = {
  name: '',
  email: '',
  phone: '',
  departmentId: null,
  isActive: true,
  assignedCategories: []
}

export function TechnicianFormDialog({
  open,
  onOpenChange,
  editingTechnician,
  promotingUser,
  departments,
  availableCategories,
  onSuccess,
  onClose
}: Props) {
  const { toast } = useToast()
  const [formData, setFormData] = useState<TechnicianFormData>(initialFormData)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const isEditing = !!editingTechnician
  const isPromoting = !!promotingUser
  const title = isEditing ? 'Editar Técnico' : isPromoting ? 'Promover a Técnico' : 'Crear Técnico'

  // Resetear formulario cuando cambie el modo
  useEffect(() => {
    if (editingTechnician) {
      setFormData({
        name: editingTechnician.name,
        email: editingTechnician.email,
        phone: editingTechnician.phone || '',
        departmentId: editingTechnician.departmentId || null,
        isActive: editingTechnician.isActive,
        assignedCategories: editingTechnician.technicianAssignments?.map(assignment => ({
          categoryId: assignment.category.id,
          priority: assignment.priority,
          maxTickets: assignment.maxTickets,
          autoAssign: assignment.autoAssign
        })) || []
      })
    } else if (promotingUser) {
      setFormData({
        ...initialFormData,
        name: promotingUser.name,
        email: promotingUser.email,
        phone: promotingUser.phone || ''
      })
    } else {
      setFormData(initialFormData)
    }
    setErrors({})
  }, [editingTechnician, promotingUser, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const validation = validateTechnicianForm(formData)
    if (!validation.isValid) {
      setErrors(validation.errors)
      toast({
        title: 'Error de validación',
        description: 'Por favor corrige los errores en el formulario antes de continuar',
        variant: 'destructive'
      })
      return
    }

    setLoading(true)
    setErrors({})
    
    try {
      let url: string
      let method: string
      let payload: any
      
      if (isEditing) {
        // Para técnicos existentes, solo actualizar asignaciones de categorías
        url = `/api/technicians/${editingTechnician.id}`
        method = 'PUT'
        payload = {
          isActive: formData.isActive,
          assignedCategories: formData.assignedCategories
        }
      } else if (isPromoting) {
        // Para promoción de usuarios a técnicos
        url = `/api/users/${promotingUser.id}/promote`
        method = 'POST'
        payload = {
          departmentId: formData.departmentId,
          assignedCategories: formData.assignedCategories
        }
      } else {
        // Crear nuevo técnico (no implementado - se hace desde usuarios)
        toast({
          title: 'Operación no disponible',
          description: 'Los técnicos se crean promoviendo usuarios desde el módulo de usuarios',
          variant: 'destructive'
        })
        return
      }
      
      console.log('🔄 [TECHNICIAN-FORM] Enviando:', { url, method, payload })
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include'
      })

      const result = await response.json()
      console.log('📥 [TECHNICIAN-FORM] Respuesta:', result)

      if (response.ok && result.success) {
        toast({
          title: 'Éxito',
          description: isEditing 
            ? 'Asignaciones de técnico actualizadas correctamente'
            : isPromoting 
              ? 'Usuario promovido a técnico correctamente'
              : 'Técnico creado correctamente'
        })
        onSuccess()
        onClose()
      } else {
        // Manejar errores específicos de validación
        if (result.details && Array.isArray(result.details)) {
          const fieldErrors: Record<string, string> = {}
          result.details.forEach((detail: any) => {
            if (detail.field) {
              fieldErrors[detail.field] = detail.message
            }
          })
          setErrors(fieldErrors)
        }
        
        toast({
          title: 'Error',
          description: result.error || 'Error desconocido',
          variant: 'destructive'
        })
      }
    } catch (error) {
      console.error('❌ [TECHNICIAN-FORM] Error:', error)
      toast({
        title: 'Error de conexión',
        description: 'No se pudo conectar con el servidor. Verifica tu conexión e intenta nuevamente.',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const addCategoryAssignment = () => {
    setFormData(prev => ({
      ...prev,
      assignedCategories: [
        ...prev.assignedCategories,
        {
          categoryId: '',
          priority: 1,
          maxTickets: undefined,
          autoAssign: true
        }
      ]
    }))
  }

  const removeCategoryAssignment = (index: number) => {
    setFormData(prev => ({
      ...prev,
      assignedCategories: prev.assignedCategories.filter((_, i) => i !== index)
    }))
  }

  const updateCategoryAssignment = (index: number, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      assignedCategories: prev.assignedCategories.map((assignment, i) => 
        i === index ? { ...assignment, [field]: value } : assignment
      )
    }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <User className="h-5 w-5" />
            <span>{title}</span>
          </DialogTitle>
          <DialogDescription>
            {isEditing 
              ? 'Modifica la información del técnico'
              : isPromoting 
                ? 'Configura los datos para promover este usuario a técnico'
                : 'Completa la información para crear un nuevo técnico'
            }
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Información básica - Solo lectura para técnicos existentes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Información Básica</CardTitle>
              {isEditing && (
                <p className="text-sm text-muted-foreground">
                  Los datos personales se editan desde el módulo de usuarios
                </p>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Nombre completo *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Nombre del técnico"
                    className={errors.name ? 'border-red-500' : ''}
                    disabled={isEditing} // Solo lectura para técnicos existentes
                  />
                  {errors.name && <p className="text-sm text-red-500 mt-1">{errors.name}</p>}
                  {isEditing && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Editar desde el módulo de usuarios
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="email@ejemplo.com"
                    className={errors.email ? 'border-red-500' : ''}
                    disabled={isEditing || isPromoting} // Solo lectura para técnicos existentes y promociones
                  />
                  {errors.email && <p className="text-sm text-red-500 mt-1">{errors.email}</p>}
                  {isEditing && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Editar desde el módulo de usuarios
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="phone">Teléfono</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="+1 234 567 8900"
                    className={errors.phone ? 'border-red-500' : ''}
                    disabled={isEditing} // Solo lectura para técnicos existentes
                  />
                  {errors.phone && <p className="text-sm text-red-500 mt-1">{errors.phone}</p>}
                  {isEditing && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Editar desde el módulo de usuarios
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="department">Departamento</Label>
                  <Select 
                    value={formData.departmentId || 'none'} 
                    onValueChange={(value) => setFormData(prev => ({ 
                      ...prev, 
                      departmentId: value === 'none' ? null : value 
                    }))}
                    disabled={isEditing} // Solo lectura para técnicos existentes
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar departamento" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin departamento</SelectItem>
                      {departments.map(dept => (
                        <SelectItem key={dept.id} value={dept.id}>
                          <div className="flex items-center space-x-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: dept.color }}
                            />
                            <span>{dept.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {isEditing && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Editar desde el módulo de usuarios
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
                />
                <Label htmlFor="isActive">Técnico activo</Label>
              </div>
            </CardContent>
          </Card>

          {/* Asignaciones de categorías */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Asignaciones de Categorías</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Las prioridades determinan el orden de asignación automática de tickets
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addCategoryAssignment}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar Categoría
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {formData.assignedCategories.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  No hay categorías asignadas. Haz clic en "Agregar Categoría" para comenzar.
                </p>
              ) : (
                <div className="space-y-4">
                  {formData.assignedCategories.map((assignment, index) => (
                    <Card key={index} className="border-dashed">
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between mb-4">
                          <h4 className="font-medium">Asignación {index + 1}</h4>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeCategoryAssignment(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          <div>
                            <Label>Categoría</Label>
                            <Select
                              value={assignment.categoryId}
                              onValueChange={(value) => updateCategoryAssignment(index, 'categoryId', value)}
                            >
                              <SelectTrigger className={errors[`assignedCategories[${index}].categoryId`] ? 'border-red-500' : ''}>
                                <SelectValue placeholder="Seleccionar" />
                              </SelectTrigger>
                              <SelectContent>
                                {availableCategories.map(category => (
                                  <SelectItem key={category.id} value={category.id}>
                                    <div className="flex items-center space-x-2">
                                      <div 
                                        className="w-3 h-3 rounded-full" 
                                        style={{ backgroundColor: category.color }}
                                      />
                                      <span>{category.name}</span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {errors[`assignedCategories[${index}].categoryId`] && (
                              <p className="text-sm text-red-500 mt-1">
                                {errors[`assignedCategories[${index}].categoryId`]}
                              </p>
                            )}
                          </div>

                          <div>
                            <Label>Prioridad</Label>
                            <Select
                              value={assignment.priority.toString()}
                              onValueChange={(value) => updateCategoryAssignment(index, 'priority', parseInt(value))}
                            >
                              <SelectTrigger className={errors[`assignedCategories[${index}].priority`] ? 'border-red-500' : ''}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(priority => (
                                  <SelectItem key={priority} value={priority.toString()}>
                                    Prioridad {priority}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {errors[`assignedCategories[${index}].priority`] && (
                              <p className="text-sm text-red-500 mt-1">
                                {errors[`assignedCategories[${index}].priority`]}
                              </p>
                            )}
                          </div>

                          <div>
                            <Label>Máx. Tickets</Label>
                            <Input
                              type="number"
                              min="1"
                              max="1000"
                              value={assignment.maxTickets || ''}
                              onChange={(e) => updateCategoryAssignment(
                                index, 
                                'maxTickets', 
                                e.target.value ? parseInt(e.target.value) : undefined
                              )}
                              placeholder="Sin límite"
                              className={errors[`assignedCategories[${index}].maxTickets`] ? 'border-red-500' : ''}
                            />
                            {errors[`assignedCategories[${index}].maxTickets`] && (
                              <p className="text-sm text-red-500 mt-1">
                                {errors[`assignedCategories[${index}].maxTickets`]}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center space-x-2 pt-6">
                            <Switch
                              checked={assignment.autoAssign}
                              onCheckedChange={(checked) => updateCategoryAssignment(index, 'autoAssign', checked)}
                            />
                            <Label className="text-sm">Auto-asignar</Label>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              <Save className="h-4 w-4 mr-2" />
              {loading ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}