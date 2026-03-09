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
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Badge } from '@/components/ui/badge'
import { Plus, X, Save, User, HelpCircle, Info, Zap, Users, Shield } from 'lucide-react'
import type { 
  Technician, 
  TechnicianFormData, 
  Department, 
  Category 
} from '@/types/technicians'
import { validateTechnicianForm } from '../TechnicianManagement.module'
import { SimpleCategoryAssignment } from './SimpleCategoryAssignment'

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
    
    // Validar que estemos en modo edición o promoción
    if (!isEditing && !isPromoting) {
      toast({
        title: 'Operación no disponible',
        description: 'Los técnicos se crean promoviendo usuarios. Por favor, selecciona un usuario primero.',
        variant: 'destructive'
      })
      onClose()
      return
    }
    
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
          assignments: formData.assignedCategories.map(a => ({
            categoryId: a.categoryId,
            priorityLevel: a.priority,
            maxTickets: a.maxTickets
          }))
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
        // Nueva categoría al PRINCIPIO
        {
          categoryId: '',
          priority: 2, // Regular por defecto
          maxTickets: 10,
          autoAssign: true
        },
        ...prev.assignedCategories
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
              <p className="text-sm text-muted-foreground">
                Los datos personales solo se pueden editar desde el módulo de usuarios
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-blue-900">
                  <strong>Nota:</strong> Nombre, email, teléfono y departamento están bloqueados. Para editarlos, ve al módulo de usuarios del administrador.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Nombre completo *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Nombre del técnico"
                    className={errors.name ? 'border-red-500' : ''}
                    disabled={true} // Siempre bloqueado - editar desde usuarios
                  />
                  {errors.name && <p className="text-sm text-red-500 mt-1">{errors.name}</p>}
                  <p className="text-xs text-muted-foreground mt-1">
                    Editar desde el módulo de usuarios
                  </p>
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
                    disabled={true} // Siempre bloqueado - editar desde usuarios
                  />
                  {errors.email && <p className="text-sm text-red-500 mt-1">{errors.email}</p>}
                  <p className="text-xs text-muted-foreground mt-1">
                    Editar desde el módulo de usuarios
                  </p>
                </div>

                <div>
                  <Label htmlFor="phone">Teléfono</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="+1 234 567 8900"
                    className={errors.phone ? 'border-red-500' : ''}
                    disabled={true} // Siempre bloqueado - editar desde usuarios
                  />
                  {errors.phone && <p className="text-sm text-red-500 mt-1">{errors.phone}</p>}
                  <p className="text-xs text-muted-foreground mt-1">
                    Editar desde el módulo de usuarios
                  </p>
                </div>

                <div>
                  <Label htmlFor="department">Departamento</Label>
                  <Select 
                    value={formData.departmentId || 'none'} 
                    onValueChange={(value) => setFormData(prev => ({ 
                      ...prev, 
                      departmentId: value === 'none' ? null : value 
                    }))}
                    disabled={true} // Siempre bloqueado - editar desde usuarios
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
                  <p className="text-xs text-muted-foreground mt-1">
                    Editar desde el módulo de usuarios
                  </p>
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

          {/* Asignaciones de categorías - SIMPLIFICADO */}
          <SimpleCategoryAssignment
            assignments={formData.assignedCategories}
            availableCategories={availableCategories}
            errors={errors}
            onAdd={addCategoryAssignment}
            onRemove={removeCategoryAssignment}
            onUpdate={updateCategoryAssignment}
          />

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