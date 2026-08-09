'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Plus, X } from 'lucide-react'

export type FieldType = 'text' | 'number' | 'select' | 'date' | 'boolean'

export interface CustomFieldFormData {
  fieldName: string
  fieldLabel: string
  fieldType: FieldType
  fieldOptions?: any
  isRequired: boolean
  order?: number
  helpText?: string
}

interface CustomFieldFormProps {
  initialData?: Partial<CustomFieldFormData>
  onSubmit: (data: CustomFieldFormData) => Promise<void>
  onCancel: () => void
  isEdit?: boolean
}

export function CustomFieldForm({
  initialData,
  onSubmit,
  onCancel,
  isEdit = false,
}: CustomFieldFormProps) {
  const [formData, setFormData] = useState<CustomFieldFormData>({
    fieldName: initialData?.fieldName || '',
    fieldLabel: initialData?.fieldLabel || '',
    fieldType: initialData?.fieldType || 'text',
    fieldOptions: initialData?.fieldOptions || null,
    isRequired: initialData?.isRequired || false,
    order: initialData?.order,
    helpText: initialData?.helpText || '',
  })

  const [selectOptions, setSelectOptions] = useState<string[]>(
    Array.isArray(initialData?.fieldOptions) ? initialData.fieldOptions : []
  )
  const [newOption, setNewOption] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const dataToSubmit = {
        ...formData,
        fieldOptions:
          formData.fieldType === 'select'
            ? selectOptions
            : formData.fieldType === 'number'
              ? formData.fieldOptions
              : null,
      }

      await onSubmit(dataToSubmit)
    } catch (error) {
      console.error('Error submitting form:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const addSelectOption = () => {
    if (newOption.trim() && !selectOptions.includes(newOption.trim())) {
      setSelectOptions([...selectOptions, newOption.trim()])
      setNewOption('')
    }
  }

  const removeSelectOption = (option: string) => {
    setSelectOptions(selectOptions.filter(o => o !== option))
  }

  return (
    <form onSubmit={handleSubmit} className='space-y-4'>
      {/* Field Name */}
      <div className='space-y-2'>
        <Label htmlFor='fieldName'>
          Nombre del Campo <span className='text-red-500'>*</span>
        </Label>
        <Input
          id='fieldName'
          value={formData.fieldName}
          onChange={e =>
            setFormData({
              ...formData,
              fieldName: e.target.value.toLowerCase().replace(/\s/g, '_'),
            })
          }
          placeholder='color, talla, material'
          required
          disabled={isEdit}
          pattern='[a-z_]+'
          title='Solo minúsculas y guiones bajos'
        />
        <p className='text-xs text-muted-foreground'>
          Solo minúsculas y guiones bajos. No se puede cambiar después de crear.
        </p>
      </div>

      {/* Field Label */}
      <div className='space-y-2'>
        <Label htmlFor='fieldLabel'>
          Etiqueta <span className='text-red-500'>*</span>
        </Label>
        <Input
          id='fieldLabel'
          value={formData.fieldLabel}
          onChange={e => setFormData({ ...formData, fieldLabel: e.target.value })}
          placeholder='Color, Talla, Material'
          required
        />
        <p className='text-xs text-muted-foreground'>Nombre visible para los usuarios</p>
      </div>

      {/* Field Type */}
      <div className='space-y-2'>
        <Label htmlFor='fieldType'>
          Tipo de Campo <span className='text-red-500'>*</span>
        </Label>
        <Select
          value={formData.fieldType}
          onValueChange={(value: FieldType) => setFormData({ ...formData, fieldType: value })}
          disabled={isEdit}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='text'>Texto</SelectItem>
            <SelectItem value='number'>Número</SelectItem>
            <SelectItem value='select'>Selección (Dropdown)</SelectItem>
            <SelectItem value='date'>Fecha</SelectItem>
            <SelectItem value='boolean'>Sí/No</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Select Options */}
      {formData.fieldType === 'select' && (
        <div className='space-y-2'>
          <Label>
            Opciones <span className='text-red-500'>*</span>
          </Label>
          <div className='flex gap-2'>
            <Input
              value={newOption}
              onChange={e => setNewOption(e.target.value)}
              placeholder='Agregar opción'
              onKeyPress={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addSelectOption()
                }
              }}
            />
            <Button type='button' onClick={addSelectOption} size='sm'>
              <Plus className='h-4 w-4' />
            </Button>
          </div>
          <div className='flex flex-wrap gap-2 mt-2'>
            {selectOptions.map(option => (
              <div
                key={option}
                className='flex items-center gap-1 bg-secondary px-2 py-1 rounded-md text-sm'
              >
                <span>{option}</span>
                <button
                  type='button'
                  onClick={() => removeSelectOption(option)}
                  className='text-muted-foreground hover:text-foreground'
                >
                  <X className='h-3 w-3' />
                </button>
              </div>
            ))}
          </div>
          {selectOptions.length === 0 && (
            <p className='text-xs text-red-500'>Debes agregar al menos una opción</p>
          )}
        </div>
      )}

      {/* Number Range */}
      {formData.fieldType === 'number' && (
        <div className='grid grid-cols-2 gap-4'>
          <div className='space-y-2'>
            <Label htmlFor='minValue'>Valor Mínimo</Label>
            <Input
              id='minValue'
              type='number'
              value={formData.fieldOptions?.min || ''}
              onChange={e =>
                setFormData({
                  ...formData,
                  fieldOptions: {
                    ...formData.fieldOptions,
                    min: e.target.value ? Number(e.target.value) : undefined,
                  },
                })
              }
              placeholder='Opcional'
            />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='maxValue'>Valor Máximo</Label>
            <Input
              id='maxValue'
              type='number'
              value={formData.fieldOptions?.max || ''}
              onChange={e =>
                setFormData({
                  ...formData,
                  fieldOptions: {
                    ...formData.fieldOptions,
                    max: e.target.value ? Number(e.target.value) : undefined,
                  },
                })
              }
              placeholder='Opcional'
            />
          </div>
        </div>
      )}

      {/* Text Max Length */}
      {formData.fieldType === 'text' && (
        <div className='space-y-2'>
          <Label htmlFor='maxLength'>Longitud Máxima</Label>
          <Input
            id='maxLength'
            type='number'
            value={formData.fieldOptions?.maxLength || ''}
            onChange={e =>
              setFormData({
                ...formData,
                fieldOptions: {
                  maxLength: e.target.value ? Number(e.target.value) : undefined,
                },
              })
            }
            placeholder='Opcional (ej: 100)'
          />
        </div>
      )}

      {/* Is Required */}
      <div className='flex items-center space-x-2'>
        <Switch
          id='isRequired'
          checked={formData.isRequired}
          onCheckedChange={checked => setFormData({ ...formData, isRequired: checked })}
        />
        <Label htmlFor='isRequired' className='cursor-pointer'>
          Campo requerido
        </Label>
      </div>

      {/* Order */}
      <div className='space-y-2'>
        <Label htmlFor='order'>Orden de Aparición</Label>
        <Input
          id='order'
          type='number'
          value={formData.order ?? ''}
          onChange={e =>
            setFormData({
              ...formData,
              order: e.target.value === '' ? undefined : Number(e.target.value),
            })
          }
          min='0'
          placeholder={isEdit ? undefined : 'Automático (al final)'}
        />
        <p className='text-xs text-muted-foreground'>
          {isEdit
            ? 'Los campos se mostrarán en orden ascendente'
            : 'Vacío = se coloca al final del listado'}
        </p>
      </div>

      {/* Help Text */}
      <div className='space-y-2'>
        <Label htmlFor='helpText'>Texto de Ayuda</Label>
        <Textarea
          id='helpText'
          value={formData.helpText}
          onChange={e => setFormData({ ...formData, helpText: e.target.value })}
          placeholder='Texto descriptivo para ayudar al usuario'
          rows={2}
          maxLength={255}
        />
      </div>

      {/* Actions */}
      <div className='flex justify-end gap-2 pt-4'>
        <Button type='button' variant='outline' onClick={onCancel} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button
          type='submit'
          disabled={
            isSubmitting ||
            !formData.fieldName ||
            !formData.fieldLabel ||
            (formData.fieldType === 'select' && selectOptions.length === 0)
          }
        >
          {isSubmitting ? 'Guardando...' : isEdit ? 'Actualizar' : 'Crear Campo'}
        </Button>
      </div>
    </form>
  )
}
