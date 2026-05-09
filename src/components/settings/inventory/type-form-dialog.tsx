/**
 * Type Form Dialog Component (Generic)
 * Formulario reutilizable para crear/editar tipos (Equipment, License, Consumable)
 */

'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import type { TypeKind, AnyType, CreateTypeData } from '@/hooks/inventory/use-type-management'

// ── Types ──────────────────────────────────────────────────────────────────

interface TypeFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  typeKind: TypeKind
  mode: 'create' | 'edit'
  initialData?: AnyType | null
  onSubmit: (data: CreateTypeData) => Promise<boolean>
  saving: boolean
}

const TYPE_LABELS: Record<TypeKind, { singular: string; plural: string }> = {
  equipment: { singular: 'Tipo de Equipo', plural: 'Tipos de Equipo' },
  license: { singular: 'Tipo de Licencia', plural: 'Tipos de Licencia' },
  consumable: { singular: 'Tipo de Consumible', plural: 'Tipos de Consumible' },
}

// ── Component ──────────────────────────────────────────────────────────────

export function TypeFormDialog({
  open,
  onOpenChange,
  typeKind,
  mode,
  initialData,
  onSubmit,
  saving,
}: TypeFormDialogProps) {
  const labels = TYPE_LABELS[typeKind]

  // Form state
  const [formData, setFormData] = useState<CreateTypeData>({
    name: '',
    description: '',
    familyId: '',
    isActive: true,
    // Equipment specific
    requiresSerial: false,
    requiresModel: false,
    trackMaintenance: false,
    // License specific
    requiresKey: false,
    allowMultipleAssignments: false,
    maxAssignments: null,
    // Consumable specific
    trackStock: true,
    minStockLevel: null,
    reorderPoint: null,
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  // Load initial data when editing
  useEffect(() => {
    if (mode === 'edit' && initialData) {
      setFormData({
        name: initialData.name,
        description: initialData.description || '',
        familyId: initialData.familyId,
        isActive: initialData.isActive,
        // Equipment specific
        requiresSerial: (initialData as any).requiresSerial || false,
        requiresModel: (initialData as any).requiresModel || false,
        trackMaintenance: (initialData as any).trackMaintenance || false,
        // License specific
        requiresKey: (initialData as any).requiresKey || false,
        allowMultipleAssignments: (initialData as any).allowMultipleAssignments || false,
        maxAssignments: (initialData as any).maxAssignments || null,
        // Consumable specific
        trackStock: (initialData as any).trackStock !== undefined ? (initialData as any).trackStock : true,
        minStockLevel: (initialData as any).minStockLevel || null,
        reorderPoint: (initialData as any).reorderPoint || null,
      })
    } else if (mode === 'create') {
      // Reset form for create mode
      setFormData({
        name: '',
        description: '',
        familyId: '',
        isActive: true,
        requiresSerial: false,
        requiresModel: false,
        trackMaintenance: false,
        requiresKey: false,
        allowMultipleAssignments: false,
        maxAssignments: null,
        trackStock: true,
        minStockLevel: null,
        reorderPoint: null,
      })
    }
    setErrors({})
  }, [mode, initialData, open])

  // Validate form
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) {
      newErrors.name = 'El nombre es requerido'
    }

    if (typeKind === 'license' && formData.allowMultipleAssignments) {
      if (formData.maxAssignments !== null && formData.maxAssignments < 1) {
        newErrors.maxAssignments = 'Debe ser mayor a 0'
      }
    }

    if (typeKind === 'consumable') {
      if (formData.minStockLevel !== null && formData.minStockLevel < 0) {
        newErrors.minStockLevel = 'No puede ser negativo'
      }
      if (formData.reorderPoint !== null && formData.reorderPoint < 0) {
        newErrors.reorderPoint = 'No puede ser negativo'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Handle submit
  const handleSubmit = async () => {
    if (!validate()) return

    const success = await onSubmit(formData)
    if (success) {
      onOpenChange(false)
    }
  }

  // Update field
  const updateField = <K extends keyof CreateTypeData>(key: K, value: CreateTypeData[K]) => {
    setFormData(prev => ({ ...prev, [key]: value }))
    // Clear error for this field
    if (errors[key]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[key]
        return newErrors
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-2xl max-h-[90vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? `Nuevo ${labels.singular}` : `Editar ${labels.singular}`}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? `Crea un nuevo tipo para clasificar tus ${typeKind === 'equipment' ? 'equipos' : typeKind === 'license' ? 'licencias' : 'consumibles'}`
              : `Modifica la información de este tipo`}
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4 py-4'>
          {/* Basic fields */}
          <div className='space-y-2'>
            <Label htmlFor='name'>
              Nombre <span className='text-destructive'>*</span>
            </Label>
            <Input
              id='name'
              value={formData.name}
              onChange={e => updateField('name', e.target.value)}
              placeholder={`Ej: ${typeKind === 'equipment' ? 'Laptop' : typeKind === 'license' ? 'Microsoft Office' : 'Tóner'}`}
              className={errors.name ? 'border-destructive' : ''}
              disabled={saving}
            />
            {errors.name && <p className='text-xs text-destructive'>{errors.name}</p>}
          </div>

          <div className='space-y-2'>
            <Label htmlFor='description'>Descripción</Label>
            <Textarea
              id='description'
              value={formData.description}
              onChange={e => updateField('description', e.target.value)}
              placeholder='Descripción opcional del tipo'
              rows={3}
              disabled={saving}
            />
          </div>

          <div className='flex items-center gap-2'>
            <Switch
              id='isActive'
              checked={formData.isActive}
              onCheckedChange={v => updateField('isActive', v)}
              disabled={saving}
            />
            <Label htmlFor='isActive' className='cursor-pointer'>
              Activo
            </Label>
          </div>

          <Separator />

          {/* Equipment specific fields */}
          {typeKind === 'equipment' && (
            <div className='space-y-3'>
              <h4 className='font-semibold text-sm'>Configuración de Equipos</h4>
              
              <div className='flex items-center justify-between p-3 border rounded-lg'>
                <div>
                  <p className='text-sm font-medium'>Requiere número de serie</p>
                  <p className='text-xs text-muted-foreground'>
                    Obliga a ingresar un número de serie único
                  </p>
                </div>
                <Switch
                  checked={formData.requiresSerial}
                  onCheckedChange={v => updateField('requiresSerial', v)}
                  disabled={saving}
                />
              </div>

              <div className='flex items-center justify-between p-3 border rounded-lg'>
                <div>
                  <p className='text-sm font-medium'>Requiere modelo</p>
                  <p className='text-xs text-muted-foreground'>
                    Obliga a especificar marca y modelo
                  </p>
                </div>
                <Switch
                  checked={formData.requiresModel}
                  onCheckedChange={v => updateField('requiresModel', v)}
                  disabled={saving}
                />
              </div>

              <div className='flex items-center justify-between p-3 border rounded-lg'>
                <div>
                  <p className='text-sm font-medium'>Rastrear mantenimiento</p>
                  <p className='text-xs text-muted-foreground'>
                    Habilita el registro de mantenimientos preventivos
                  </p>
                </div>
                <Switch
                  checked={formData.trackMaintenance}
                  onCheckedChange={v => updateField('trackMaintenance', v)}
                  disabled={saving}
                />
              </div>
            </div>
          )}

          {/* License specific fields */}
          {typeKind === 'license' && (
            <div className='space-y-3'>
              <h4 className='font-semibold text-sm'>Configuración de Licencias</h4>
              
              <div className='flex items-center justify-between p-3 border rounded-lg'>
                <div>
                  <p className='text-sm font-medium'>Requiere clave de licencia</p>
                  <p className='text-xs text-muted-foreground'>
                    Obliga a ingresar una clave o serial de activación
                  </p>
                </div>
                <Switch
                  checked={formData.requiresKey}
                  onCheckedChange={v => updateField('requiresKey', v)}
                  disabled={saving}
                />
              </div>

              <div className='flex items-center justify-between p-3 border rounded-lg'>
                <div className='flex-1'>
                  <p className='text-sm font-medium'>Permitir asignaciones múltiples</p>
                  <p className='text-xs text-muted-foreground'>
                    Una licencia puede asignarse a varios usuarios
                  </p>
                </div>
                <Switch
                  checked={formData.allowMultipleAssignments}
                  onCheckedChange={v => updateField('allowMultipleAssignments', v)}
                  disabled={saving}
                />
              </div>

              {formData.allowMultipleAssignments && (
                <div className='space-y-2 ml-4'>
                  <Label htmlFor='maxAssignments'>Máximo de asignaciones simultáneas</Label>
                  <Input
                    id='maxAssignments'
                    type='number'
                    min={1}
                    value={formData.maxAssignments || ''}
                    onChange={e =>
                      updateField('maxAssignments', e.target.value ? parseInt(e.target.value) : null)
                    }
                    placeholder='Ej: 5 (dejar vacío para ilimitado)'
                    className={errors.maxAssignments ? 'border-destructive' : ''}
                    disabled={saving}
                  />
                  {errors.maxAssignments && (
                    <p className='text-xs text-destructive'>{errors.maxAssignments}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Consumable specific fields */}
          {typeKind === 'consumable' && (
            <div className='space-y-3'>
              <h4 className='font-semibold text-sm'>Configuración de Consumibles</h4>
              
              <div className='flex items-center justify-between p-3 border rounded-lg'>
                <div>
                  <p className='text-sm font-medium'>Rastrear inventario</p>
                  <p className='text-xs text-muted-foreground'>
                    Controla el stock disponible y movimientos
                  </p>
                </div>
                <Switch
                  checked={formData.trackStock}
                  onCheckedChange={v => updateField('trackStock', v)}
                  disabled={saving}
                />
              </div>

              {formData.trackStock && (
                <>
                  <div className='space-y-2'>
                    <Label htmlFor='minStockLevel'>Nivel mínimo de stock</Label>
                    <Input
                      id='minStockLevel'
                      type='number'
                      min={0}
                      value={formData.minStockLevel || ''}
                      onChange={e =>
                        updateField('minStockLevel', e.target.value ? parseInt(e.target.value) : null)
                      }
                      placeholder='Ej: 10'
                      className={errors.minStockLevel ? 'border-destructive' : ''}
                      disabled={saving}
                    />
                    {errors.minStockLevel && (
                      <p className='text-xs text-destructive'>{errors.minStockLevel}</p>
                    )}
                    <p className='text-xs text-muted-foreground'>
                      Se generará una alerta cuando el stock esté por debajo de este nivel
                    </p>
                  </div>

                  <div className='space-y-2'>
                    <Label htmlFor='reorderPoint'>Punto de reorden</Label>
                    <Input
                      id='reorderPoint'
                      type='number'
                      min={0}
                      value={formData.reorderPoint || ''}
                      onChange={e =>
                        updateField('reorderPoint', e.target.value ? parseInt(e.target.value) : null)
                      }
                      placeholder='Ej: 20'
                      className={errors.reorderPoint ? 'border-destructive' : ''}
                      disabled={saving}
                    />
                    {errors.reorderPoint && (
                      <p className='text-xs text-destructive'>{errors.reorderPoint}</p>
                    )}
                    <p className='text-xs text-muted-foreground'>
                      Nivel sugerido para realizar un nuevo pedido
                    </p>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? 'Guardando...' : mode === 'create' ? 'Crear' : 'Guardar cambios'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
