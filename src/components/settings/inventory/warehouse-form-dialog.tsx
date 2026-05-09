/**
 * Component: WarehouseFormDialog
 * Diálogo para crear/editar bodegas
 */

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Warehouse, WarehouseManager } from '@/hooks/inventory/use-warehouse-management'

interface WarehouseFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  warehouse: Warehouse | null
  availableManagers: WarehouseManager[]
  onSave: (data: any) => Promise<void>
  saving: boolean
}

export function WarehouseFormDialog({
  open,
  onOpenChange,
  warehouse,
  availableManagers,
  onSave,
  saving,
}: WarehouseFormDialogProps) {
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [description, setDescription] = useState('')
  const [managerId, setManagerId] = useState<string | undefined>(undefined)
  const [isActive, setIsActive] = useState(true)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const isEditing = !!warehouse

  // Cargar datos del warehouse al abrir en modo edición
  useEffect(() => {
    if (warehouse) {
      setName(warehouse.name)
      setLocation(warehouse.location || '')
      setDescription(warehouse.description || '')
      setManagerId(warehouse.managerId || undefined)
      setIsActive(warehouse.isActive)
    } else {
      // Reset form
      setName('')
      setLocation('')
      setDescription('')
      setManagerId(undefined)
      setIsActive(true)
    }
    setErrors({})
  }, [warehouse, open])

  const validate = () => {
    const newErrors: Record<string, string> = {}

    if (!name.trim()) {
      newErrors.name = 'El nombre es requerido'
    } else if (name.length < 2) {
      newErrors.name = 'El nombre debe tener al menos 2 caracteres'
    } else if (name.length > 100) {
      newErrors.name = 'El nombre no puede exceder 100 caracteres'
    }

    if (location && location.length > 200) {
      newErrors.location = 'La ubicación no puede exceder 200 caracteres'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validate()) {
      return
    }

    const data = {
      name: name.trim(),
      location: location.trim() || undefined,
      description: description.trim() || undefined,
      managerId: managerId,
      isActive,
    }

    await onSave(data)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[500px]'>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Editar Bodega' : 'Nueva Bodega'}</DialogTitle>
            <DialogDescription>
              {isEditing
                ? 'Modifica los datos de la bodega'
                : 'Completa los datos para crear una nueva bodega'}
            </DialogDescription>
          </DialogHeader>

          <div className='space-y-4 py-4'>
            {/* Nombre */}
            <div className='space-y-2'>
              <Label htmlFor='name'>
                Nombre <span className='text-destructive'>*</span>
              </Label>
              <Input
                id='name'
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder='Ej: Bodega Principal'
                maxLength={100}
                disabled={saving}
                className={errors.name ? 'border-destructive' : ''}
              />
              {errors.name && <p className='text-xs text-destructive'>{errors.name}</p>}
            </div>

            {/* Ubicación */}
            <div className='space-y-2'>
              <Label htmlFor='location'>Ubicación</Label>
              <Input
                id='location'
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder='Ej: Edificio A, Piso 2'
                maxLength={200}
                disabled={saving}
                className={errors.location ? 'border-destructive' : ''}
              />
              {errors.location && <p className='text-xs text-destructive'>{errors.location}</p>}
            </div>

            {/* Descripción */}
            <div className='space-y-2'>
              <Label htmlFor='description'>Descripción</Label>
              <Textarea
                id='description'
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder='Descripción opcional de la bodega'
                rows={3}
                disabled={saving}
              />
            </div>

            {/* Manager */}
            <div className='space-y-2'>
              <Label htmlFor='manager'>Responsable</Label>
              <Select 
                value={managerId || 'none'} 
                onValueChange={(value) => setManagerId(value === 'none' ? undefined : value)} 
                disabled={saving}
              >
                <SelectTrigger id='manager'>
                  <SelectValue placeholder='Sin responsable asignado' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='none'>Sin responsable</SelectItem>
                  {availableManagers.map(manager => (
                    <SelectItem key={manager.id} value={manager.id}>
                      {manager.name} ({manager.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className='text-xs text-muted-foreground'>
                Solo usuarios con permisos de gestión de inventario
              </p>
            </div>

            {/* Estado */}
            {isEditing && (
              <div className='flex items-center justify-between p-3 border rounded-lg'>
                <div>
                  <Label htmlFor='isActive' className='cursor-pointer'>
                    Bodega activa
                  </Label>
                  <p className='text-xs text-muted-foreground'>
                    Las bodegas inactivas no aparecen en los formularios
                  </p>
                </div>
                <Switch
                  id='isActive'
                  checked={isActive}
                  onCheckedChange={setIsActive}
                  disabled={saving}
                />
              </div>
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
              {saving ? 'Guardando...' : isEditing ? 'Guardar Cambios' : 'Crear Bodega'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
