'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Plus, Edit, Trash2, MoveUp, MoveDown } from 'lucide-react'
import { CustomFieldForm, CustomFieldFormData, FieldType } from './custom-field-form'
import { useToast } from '@/hooks/use-toast'

interface CustomField {
  id: string
  familyId: string
  fieldName: string
  fieldLabel: string
  fieldType: FieldType
  fieldOptions?: any
  isRequired: boolean
  order: number
  helpText?: string | null
}

interface CustomFieldsManagerProps {
  familyId: string
}

export function CustomFieldsManager({ familyId }: CustomFieldsManagerProps) {
  const [fields, setFields] = useState<CustomField[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingField, setEditingField] = useState<CustomField | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    loadFields()
  }, [familyId])

  const loadFields = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/inventory/families/${familyId}/custom-fields`)
      if (!response.ok) throw new Error('Error al cargar campos')
      const data = await response.json()
      setFields(data)
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los campos personalizados',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreate = async (data: CustomFieldFormData) => {
    try {
      const response = await fetch(`/api/inventory/families/${familyId}/custom-fields`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Error al crear campo')
      }

      toast({
        title: 'Campo creado',
        description: `El campo "${data.fieldLabel}" se creó exitosamente`,
      })

      setIsDialogOpen(false)
      loadFields()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Error al crear campo',
        variant: 'destructive',
      })
      throw error
    }
  }

  const handleUpdate = async (data: CustomFieldFormData) => {
    if (!editingField) return

    try {
      const response = await fetch(
        `/api/inventory/families/${familyId}/custom-fields/${editingField.id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        }
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Error al actualizar campo')
      }

      toast({
        title: 'Campo actualizado',
        description: `El campo "${data.fieldLabel}" se actualizó exitosamente`,
      })

      setIsDialogOpen(false)
      setEditingField(null)
      loadFields()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Error al actualizar campo',
        variant: 'destructive',
      })
      throw error
    }
  }

  const handleDelete = async (field: CustomField) => {
    if (
      !confirm(
        `¿Estás seguro de eliminar el campo "${field.fieldLabel}"? Esto eliminará todos los valores asociados.`
      )
    ) {
      return
    }

    try {
      const response = await fetch(
        `/api/inventory/families/${familyId}/custom-fields/${field.id}`,
        {
          method: 'DELETE',
        }
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Error al eliminar campo')
      }

      toast({
        title: 'Campo eliminado',
        description: `El campo "${field.fieldLabel}" se eliminó exitosamente`,
      })

      loadFields()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Error al eliminar campo',
        variant: 'destructive',
      })
    }
  }

  const handleReorder = async (field: CustomField, direction: 'up' | 'down') => {
    const currentIndex = fields.findIndex(f => f.id === field.id)
    const newOrder = direction === 'up' ? field.order - 1 : field.order + 1

    try {
      const response = await fetch(
        `/api/inventory/families/${familyId}/custom-fields/${field.id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order: newOrder }),
        }
      )

      if (!response.ok) throw new Error('Error al reordenar')

      loadFields()
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo reordenar el campo',
        variant: 'destructive',
      })
    }
  }

  const getFieldTypeBadge = (type: FieldType) => {
    const variants: Record<FieldType, { label: string; variant: any }> = {
      text: { label: 'Texto', variant: 'default' },
      number: { label: 'Número', variant: 'secondary' },
      select: { label: 'Selección', variant: 'outline' },
      date: { label: 'Fecha', variant: 'default' },
      boolean: { label: 'Sí/No', variant: 'secondary' },
    }

    const config = variants[type]
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  if (isLoading) {
    return <div className='text-center py-8'>Cargando campos personalizados...</div>
  }

  return (
    <div className='space-y-4'>
      <div className='flex justify-between items-center'>
        <div>
          <h3 className='text-lg font-semibold'>Campos Personalizados</h3>
          <p className='text-sm text-muted-foreground'>
            Define atributos adicionales para los equipos de esta familia
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingField(null)
            setIsDialogOpen(true)
          }}
        >
          <Plus className='h-4 w-4 mr-2' />
          Nuevo Campo
        </Button>
      </div>

      {fields.length === 0 ? (
        <div className='text-center py-12 border-2 border-dashed rounded-lg'>
          <p className='text-muted-foreground mb-4'>No hay campos personalizados configurados</p>
          <Button
            variant='outline'
            onClick={() => {
              setEditingField(null)
              setIsDialogOpen(true)
            }}
          >
            <Plus className='h-4 w-4 mr-2' />
            Crear Primer Campo
          </Button>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Orden</TableHead>
              <TableHead>Campo</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Requerido</TableHead>
              <TableHead>Opciones</TableHead>
              <TableHead className='text-right'>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fields.map((field, index) => (
              <TableRow key={field.id}>
                <TableCell>
                  <div className='flex items-center gap-1'>
                    <span className='text-sm text-muted-foreground'>{field.order}</span>
                    <div className='flex flex-col'>
                      <Button
                        variant='ghost'
                        size='sm'
                        className='h-4 w-4 p-0'
                        onClick={() => handleReorder(field, 'up')}
                        disabled={index === 0}
                      >
                        <MoveUp className='h-3 w-3' />
                      </Button>
                      <Button
                        variant='ghost'
                        size='sm'
                        className='h-4 w-4 p-0'
                        onClick={() => handleReorder(field, 'down')}
                        disabled={index === fields.length - 1}
                      >
                        <MoveDown className='h-3 w-3' />
                      </Button>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div>
                    <div className='font-medium'>{field.fieldLabel}</div>
                    <div className='text-xs text-muted-foreground'>{field.fieldName}</div>
                    {field.helpText && (
                      <div className='text-xs text-muted-foreground mt-1'>{field.helpText}</div>
                    )}
                  </div>
                </TableCell>
                <TableCell>{getFieldTypeBadge(field.fieldType)}</TableCell>
                <TableCell>
                  {field.isRequired ? (
                    <Badge variant='destructive'>Sí</Badge>
                  ) : (
                    <Badge variant='outline'>No</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {field.fieldType === 'select' && Array.isArray(field.fieldOptions) && (
                    <div className='text-xs text-muted-foreground'>
                      {field.fieldOptions.length} opciones
                    </div>
                  )}
                  {field.fieldType === 'number' && field.fieldOptions && (
                    <div className='text-xs text-muted-foreground'>
                      {field.fieldOptions.min !== undefined && `Min: ${field.fieldOptions.min}`}
                      {field.fieldOptions.max !== undefined && ` Max: ${field.fieldOptions.max}`}
                    </div>
                  )}
                </TableCell>
                <TableCell className='text-right'>
                  <div className='flex justify-end gap-2'>
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={() => {
                        setEditingField(field)
                        setIsDialogOpen(true)
                      }}
                    >
                      <Edit className='h-4 w-4' />
                    </Button>
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={() => handleDelete(field)}
                      className='text-destructive hover:text-destructive'
                    >
                      <Trash2 className='h-4 w-4' />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className='max-w-2xl max-h-[90vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>
              {editingField ? 'Editar Campo Personalizado' : 'Nuevo Campo Personalizado'}
            </DialogTitle>
            <DialogDescription>
              {editingField
                ? 'Modifica las propiedades del campo personalizado'
                : 'Crea un nuevo campo personalizado para esta familia'}
            </DialogDescription>
          </DialogHeader>
          <CustomFieldForm
            initialData={editingField || undefined}
            onSubmit={editingField ? handleUpdate : handleCreate}
            onCancel={() => {
              setIsDialogOpen(false)
              setEditingField(null)
            }}
            isEdit={!!editingField}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
