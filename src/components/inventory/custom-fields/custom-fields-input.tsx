'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { CalendarIcon } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface CustomField {
  id: string
  fieldName: string
  fieldLabel: string
  fieldType: 'text' | 'number' | 'select' | 'date' | 'boolean'
  fieldOptions?: any
  isRequired: boolean
  helpText?: string | null
}

interface CustomFieldValue {
  fieldName: string
  fieldValue: string
}

interface CustomFieldsInputProps {
  familyId: string
  equipmentId?: string
  values: CustomFieldValue[]
  onChange: (values: CustomFieldValue[]) => void
  errors?: Record<string, string>
}

export function CustomFieldsInput({
  familyId,
  equipmentId,
  values,
  onChange,
  errors = {},
}: CustomFieldsInputProps) {
  const [fields, setFields] = useState<CustomField[]>([])
  const [isLoading, setIsLoading] = useState(true)

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
      console.error('Error loading custom fields:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const getValue = (fieldName: string): string => {
    return values.find(v => v.fieldName === fieldName)?.fieldValue || ''
  }

  const setValue = (fieldName: string, fieldValue: string) => {
    const newValues = values.filter(v => v.fieldName !== fieldName)
    if (fieldValue) {
      newValues.push({ fieldName, fieldValue })
    }
    onChange(newValues)
  }

  const renderField = (field: CustomField) => {
    const value = getValue(field.fieldName)
    const error = errors[field.fieldName]

    switch (field.fieldType) {
      case 'text':
        return (
          <div key={field.id} className='space-y-2'>
            <Label htmlFor={field.fieldName}>
              {field.fieldLabel}
              {field.isRequired && <span className='text-red-500 ml-1'>*</span>}
            </Label>
            <Input
              id={field.fieldName}
              value={value}
              onChange={e => setValue(field.fieldName, e.target.value)}
              placeholder={field.helpText || `Ingrese ${field.fieldLabel.toLowerCase()}`}
              required={field.isRequired}
              maxLength={field.fieldOptions?.maxLength}
            />
            {field.helpText && <p className='text-xs text-muted-foreground'>{field.helpText}</p>}
            {error && <p className='text-xs text-red-500'>{error}</p>}
          </div>
        )

      case 'number':
        return (
          <div key={field.id} className='space-y-2'>
            <Label htmlFor={field.fieldName}>
              {field.fieldLabel}
              {field.isRequired && <span className='text-red-500 ml-1'>*</span>}
            </Label>
            <Input
              id={field.fieldName}
              type='number'
              value={value}
              onChange={e => setValue(field.fieldName, e.target.value)}
              placeholder={field.helpText || `Ingrese ${field.fieldLabel.toLowerCase()}`}
              required={field.isRequired}
              min={field.fieldOptions?.min}
              max={field.fieldOptions?.max}
            />
            {field.helpText && <p className='text-xs text-muted-foreground'>{field.helpText}</p>}
            {field.fieldOptions?.min !== undefined && field.fieldOptions?.max !== undefined && (
              <p className='text-xs text-muted-foreground'>
                Rango: {field.fieldOptions.min} - {field.fieldOptions.max}
              </p>
            )}
            {error && <p className='text-xs text-red-500'>{error}</p>}
          </div>
        )

      case 'select':
        return (
          <div key={field.id} className='space-y-2'>
            <Label htmlFor={field.fieldName}>
              {field.fieldLabel}
              {field.isRequired && <span className='text-red-500 ml-1'>*</span>}
            </Label>
            <Select value={value} onValueChange={val => setValue(field.fieldName, val)}>
              <SelectTrigger>
                <SelectValue placeholder={`Seleccione ${field.fieldLabel.toLowerCase()}`} />
              </SelectTrigger>
              <SelectContent>
                {Array.isArray(field.fieldOptions) &&
                  field.fieldOptions.map((option: string) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {field.helpText && <p className='text-xs text-muted-foreground'>{field.helpText}</p>}
            {error && <p className='text-xs text-red-500'>{error}</p>}
          </div>
        )

      case 'date':
        return (
          <div key={field.id} className='space-y-2'>
            <Label htmlFor={field.fieldName}>
              {field.fieldLabel}
              {field.isRequired && <span className='text-red-500 ml-1'>*</span>}
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant='outline' className='w-full justify-start text-left font-normal'>
                  <CalendarIcon className='mr-2 h-4 w-4' />
                  {value ? format(new Date(value), 'PPP', { locale: es }) : 'Seleccionar fecha'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className='w-auto p-0'>
                <Calendar
                  mode='single'
                  selected={value ? new Date(value) : undefined}
                  onSelect={date => setValue(field.fieldName, date ? date.toISOString() : '')}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            {field.helpText && <p className='text-xs text-muted-foreground'>{field.helpText}</p>}
            {error && <p className='text-xs text-red-500'>{error}</p>}
          </div>
        )

      case 'boolean':
        return (
          <div key={field.id} className='space-y-2'>
            <div className='flex items-center space-x-2'>
              <Switch
                id={field.fieldName}
                checked={value === 'true'}
                onCheckedChange={checked => setValue(field.fieldName, checked ? 'true' : 'false')}
              />
              <Label htmlFor={field.fieldName} className='cursor-pointer'>
                {field.fieldLabel}
                {field.isRequired && <span className='text-red-500 ml-1'>*</span>}
              </Label>
            </div>
            {field.helpText && (
              <p className='text-xs text-muted-foreground ml-8'>{field.helpText}</p>
            )}
            {error && <p className='text-xs text-red-500 ml-8'>{error}</p>}
          </div>
        )

      default:
        return null
    }
  }

  if (isLoading) {
    return <div className='text-sm text-muted-foreground'>Cargando campos personalizados...</div>
  }

  if (fields.length === 0) {
    return null
  }

  return (
    <div className='space-y-4'>
      <div className='border-t pt-4'>
        <h3 className='text-sm font-semibold mb-4'>Atributos Personalizados</h3>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          {fields.map(field => renderField(field))}
        </div>
      </div>
    </div>
  )
}
