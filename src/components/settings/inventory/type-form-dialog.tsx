/**
 * Type Form Dialog — crear/editar tipos (Equipment, License, Consumable)
 * Solo campos que existen en el schema Prisma.
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
  consumable: { singular: 'Tipo de Suministro', plural: 'Tipos de Suministro' },
}

const EMPTY_FORM: CreateTypeData = {
  name: '',
  description: '',
  familyId: '',
  isActive: true,
  trackMaintenance: false,
}

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
  const [formData, setFormData] = useState<CreateTypeData>(EMPTY_FORM)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (mode === 'edit' && initialData) {
      setFormData({
        name: initialData.name,
        description: initialData.description || '',
        familyId: initialData.familyId,
        isActive: initialData.isActive,
        trackMaintenance:
          typeKind === 'equipment'
            ? Boolean((initialData as { trackMaintenance?: boolean }).trackMaintenance)
            : false,
      })
    } else if (mode === 'create') {
      setFormData({ ...EMPTY_FORM })
    }
    setErrors({})
  }, [mode, initialData, open, typeKind])

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}
    if (!formData.name.trim()) newErrors.name = 'El nombre es requerido'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return
    const payload: CreateTypeData = {
      name: formData.name,
      description: formData.description,
      familyId: formData.familyId,
      isActive: formData.isActive,
      ...(typeKind === 'equipment' ? { trackMaintenance: formData.trackMaintenance } : {}),
    }
    const success = await onSubmit(payload)
    if (success) onOpenChange(false)
  }

  const updateField = <K extends keyof CreateTypeData>(key: K, value: CreateTypeData[K]) => {
    setFormData(prev => ({ ...prev, [key]: value }))
    if (errors[key]) {
      setErrors(prev => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-2xl max-h-[90vh]'>
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? `Nuevo ${labels.singular}` : `Editar ${labels.singular}`}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? `Crea un nuevo tipo para clasificar tus ${
                  typeKind === 'equipment'
                    ? 'equipos'
                    : typeKind === 'license'
                      ? 'licencias'
                      : 'suministros'
                }`
              : 'Modifica la información de este tipo'}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={e => {
            e.preventDefault()
            void handleSubmit()
          }}
        >
          <div className='space-y-4 py-4 overflow-y-auto max-h-[calc(90vh-120px)]'>
            <div className='space-y-2'>
              <Label htmlFor='name'>
                Nombre <span className='text-destructive'>*</span>
              </Label>
              <Input
                id='name'
                value={formData.name}
                onChange={e => updateField('name', e.target.value)}
                placeholder={`Ej: ${
                  typeKind === 'equipment'
                    ? 'Laptop'
                    : typeKind === 'license'
                      ? 'Microsoft Office'
                      : 'Tóner'
                }`}
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

            {typeKind === 'equipment' && (
              <>
                <Separator />
                <div className='space-y-3'>
                  <h4 className='font-semibold text-sm'>Configuración de Equipos</h4>
                  <div className='flex items-center justify-between p-3 border rounded-lg'>
                    <div>
                      <p className='text-sm font-medium'>Rastrear mantenimiento</p>
                      <p className='text-xs text-muted-foreground'>
                        Habilita el registro de mantenimientos preventivos
                      </p>
                    </div>
                    <Switch
                      checked={formData.trackMaintenance || false}
                      onCheckedChange={v => updateField('trackMaintenance', v)}
                      disabled={saving}
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button type='submit' disabled={saving}>
              {saving ? 'Guardando...' : mode === 'create' ? 'Crear' : 'Guardar cambios'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
