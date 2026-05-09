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
import { CalendarIcon, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface TypeAttribute {
  id: string
  attributeName: string
  attributeLabel: string
  attributeType: 'text' | 'number' | 'select' | 'date' | 'boolean'
  options?: { options?: string[] } | null
  isRequired: boolean
  isVisible: boolean
  order: number
  helpText?: string | null
}

interface AttributeValue {
  fieldName: string
  fieldValue: string
}

interface TypeAttributesInputProps {
  typeId: string
  assetType: 'equipment' | 'license' | 'consumable'
  values: AttributeValue[]
  onChange: (values: AttributeValue[]) => void
  errors?: Record<string, string>
}

/**
 * Componente para renderizar atributos personalizados por tipo de activo.
 * Solo muestra atributos visibles y ordenados según configuración.
 */
export function TypeAttributesInput({
  typeId,
  assetType,
  values,
  onChange,
  errors = {},
}: TypeAttributesInputProps) {
  const [attributes, setAttributes] = useState<TypeAttribute[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (typeId) {
      loadAttributes()
    } else {
      setAttributes([])
      setIsLoading(false)
    }
  }, [typeId, assetType])

  const loadAttributes = async () => {
    try {
      setIsLoading(true)

      // Determinar el endpoint según el tipo de activo
      const endpoint = `/api/admin/inventory/${assetType}-types/${typeId}/attributes`

      const response = await fetch(endpoint)
      if (!response.ok) {
        console.error('Error al cargar atributos:', response.statusText)
        setAttributes([])
        return
      }

      const data = await response.json()

      // Normalizar respuesta - puede ser array directo o { attributes: [] }
      const attributesArray = Array.isArray(data) ? data : data.attributes || []

      // Filtrar solo atributos visibles y ordenar
      const visibleAttributes = attributesArray
        .filter((attr: TypeAttribute) => attr.isVisible)
        .sort((a: TypeAttribute, b: TypeAttribute) => a.order - b.order)

      console.log('📋 Atributos cargados:', {
        typeId,
        assetType,
        total: data.length,
        visible: visibleAttributes.length,
        attributes: visibleAttributes.map((a: TypeAttribute) => ({
          name: a.attributeName,
          label: a.attributeLabel,
          type: a.attributeType,
          required: a.isRequired,
        })),
      })

      setAttributes(visibleAttributes)
    } catch (error) {
      console.error('Error loading type attributes:', error)
      setAttributes([])
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

  const renderField = (attribute: TypeAttribute) => {
    const value = getValue(attribute.attributeName)
    const error = errors[attribute.attributeName]

    switch (attribute.attributeType) {
      case 'text':
        return (
          <div key={attribute.id} className='space-y-2'>
            <Label htmlFor={attribute.attributeName}>
              {attribute.attributeLabel}
              {attribute.isRequired && <span className='text-destructive ml-1'>*</span>}
            </Label>
            <Input
              id={attribute.attributeName}
              value={value}
              onChange={e => setValue(attribute.attributeName, e.target.value)}
              placeholder={
                attribute.helpText || `Ingrese ${attribute.attributeLabel.toLowerCase()}`
              }
              required={attribute.isRequired}
            />
            {attribute.helpText && (
              <p className='text-xs text-muted-foreground'>{attribute.helpText}</p>
            )}
            {error && <p className='text-xs text-destructive'>{error}</p>}
          </div>
        )

      case 'number':
        return (
          <div key={attribute.id} className='space-y-2'>
            <Label htmlFor={attribute.attributeName}>
              {attribute.attributeLabel}
              {attribute.isRequired && <span className='text-destructive ml-1'>*</span>}
            </Label>
            <Input
              id={attribute.attributeName}
              type='number'
              value={value}
              onChange={e => setValue(attribute.attributeName, e.target.value)}
              placeholder={
                attribute.helpText || `Ingrese ${attribute.attributeLabel.toLowerCase()}`
              }
              required={attribute.isRequired}
            />
            {attribute.helpText && (
              <p className='text-xs text-muted-foreground'>{attribute.helpText}</p>
            )}
            {error && <p className='text-xs text-destructive'>{error}</p>}
          </div>
        )

      case 'select':
        const options = attribute.options?.options || []
        return (
          <div key={attribute.id} className='space-y-2'>
            <Label htmlFor={attribute.attributeName}>
              {attribute.attributeLabel}
              {attribute.isRequired && <span className='text-destructive ml-1'>*</span>}
            </Label>
            <Select value={value} onValueChange={val => setValue(attribute.attributeName, val)}>
              <SelectTrigger>
                <SelectValue placeholder={`Seleccione ${attribute.attributeLabel.toLowerCase()}`} />
              </SelectTrigger>
              <SelectContent>
                {options.map((option: string) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {attribute.helpText && (
              <p className='text-xs text-muted-foreground'>{attribute.helpText}</p>
            )}
            {error && <p className='text-xs text-destructive'>{error}</p>}
          </div>
        )

      case 'date':
        return (
          <div key={attribute.id} className='space-y-2'>
            <Label htmlFor={attribute.attributeName}>
              {attribute.attributeLabel}
              {attribute.isRequired && <span className='text-destructive ml-1'>*</span>}
            </Label>
            <Popover modal={false}>
              <PopoverTrigger asChild>
                <Button variant='outline' className='w-full justify-start text-left font-normal'>
                  <CalendarIcon className='mr-2 h-4 w-4' />
                  {value ? format(new Date(value), 'PPP', { locale: es }) : 'Seleccionar fecha'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className='w-auto p-0' align='start'>
                <Calendar
                  mode='single'
                  selected={value ? new Date(value) : undefined}
                  onSelect={date =>
                    setValue(attribute.attributeName, date ? date.toISOString() : '')
                  }
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            {attribute.helpText && (
              <p className='text-xs text-muted-foreground'>{attribute.helpText}</p>
            )}
            {error && <p className='text-xs text-destructive'>{error}</p>}
          </div>
        )

      case 'boolean':
        return (
          <div key={attribute.id} className='space-y-2'>
            <div className='flex items-center space-x-2'>
              <Switch
                id={attribute.attributeName}
                checked={value === 'true'}
                onCheckedChange={checked =>
                  setValue(attribute.attributeName, checked ? 'true' : 'false')
                }
              />
              <Label htmlFor={attribute.attributeName} className='cursor-pointer'>
                {attribute.attributeLabel}
                {attribute.isRequired && <span className='text-destructive ml-1'>*</span>}
              </Label>
            </div>
            {attribute.helpText && (
              <p className='text-xs text-muted-foreground ml-8'>{attribute.helpText}</p>
            )}
            {error && <p className='text-xs text-destructive ml-8'>{error}</p>}
          </div>
        )

      default:
        return null
    }
  }

  // No mostrar nada si no hay typeId seleccionado
  if (!typeId) {
    return null
  }

  if (isLoading) {
    return (
      <div className='flex items-center justify-center py-8 text-sm text-muted-foreground'>
        <Loader2 className='h-4 w-4 animate-spin mr-2' />
        Cargando atributos...
      </div>
    )
  }

  // No mostrar nada si no hay atributos visibles
  if (attributes.length === 0) {
    return null
  }

  return (
    <div className='space-y-4'>
      <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
        {attributes.map(attribute => renderField(attribute))}
      </div>
    </div>
  )
}
