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

interface TypeAttribute {
  id: string
  attributeName: string
  attributeLabel: string
  attributeType: 'text' | 'number' | 'select' | 'date' | 'boolean'
  options?: any
  isRequired: boolean
  isVisible: boolean
  helpText?: string | null
  order: number
}

interface AttributeValue {
  attributeName: string
  attributeValue: string
}

interface TypeAttributesInputProps {
  assetType: 'equipment' | 'license' | 'consumable'
  typeId: string
  values: AttributeValue[]
  onChange: (values: AttributeValue[]) => void
  errors?: Record<string, string>
}

/**
 * Componente para renderizar atributos específicos de un tipo de activo
 * Reemplaza a CustomFieldsInput con el nuevo sistema de atributos por tipo
 */
export function TypeAttributesInput({
  assetType,
  typeId,
  values,
  onChange,
  errors = {},
}: TypeAttributesInputProps) {
  const [attributes, setAttributes] = useState<TypeAttribute[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (typeId) {
      loadAttributes()
    }
  }, [typeId, assetType])

  const loadAttributes = async () => {
    try {
      setIsLoading(true)
      const endpoint = `/api/admin/inventory/${assetType}-types/${typeId}/attributes`
      const response = await fetch(endpoint)
      
      if (!response.ok) {
        if (response.status === 404) {
          // No hay atributos configurados para este tipo
          setAttributes([])
          return
        }
        throw new Error('Error al cargar atributos')
      }
      
      const data = await response.json()
      
      // Filtrar solo atributos visibles y ordenar
      const visibleAttributes = data
        .filter((attr: TypeAttribute) => attr.isVisible)
        .sort((a: TypeAttribute, b: TypeAttribute) => a.order - b.order)
      
      console.log('📋 Atributos de tipo cargados:', {
        assetType,
        typeId,
        attributesCount: visibleAttributes.length,
        attributes: visibleAttributes.map((a: TypeAttribute) => ({
          name: a.attributeName,
          label: a.attributeLabel,
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

  const getValue = (attributeName: string): string => {
    return values.find(v => v.attributeName === attributeName)?.attributeValue || ''
  }

  const setValue = (attributeName: string, attributeValue: string) => {
    const newValues = values.filter(v => v.attributeName !== attributeName)
    if (attributeValue) {
      newValues.push({ attributeName, attributeValue })
    }
    onChange(newValues)
  }

  const renderAttribute = (attribute: TypeAttribute) => {
    const value = getValue(attribute.attributeName)
    const error = errors[attribute.attributeName]

    switch (attribute.attributeType) {
      case 'text':
        return (
          <div key={attribute.id} className='space-y-2'>
            <Label htmlFor={attribute.attributeName}>
              {attribute.attributeLabel}
              {attribute.isRequired && <span className='text-red-500 ml-1'>*</span>}
            </Label>
            <Input
              id={attribute.attributeName}
              value={value}
              onChange={e => setValue(attribute.attributeName, e.target.value)}
              placeholder={attribute.helpText || `Ingrese ${attribute.attributeLabel.toLowerCase()}`}
              required={attribute.isRequired}
            />
            {attribute.helpText && (
              <p className='text-xs text-muted-foreground'>{attribute.helpText}</p>
            )}
            {error && <p className='text-xs text-red-500'>{error}</p>}
          </div>
        )

      case 'number':
        return (
          <div key={attribute.id} className='space-y-2'>
            <Label htmlFor={attribute.attributeName}>
              {attribute.attributeLabel}
              {attribute.isRequired && <span className='text-red-500 ml-1'>*</span>}
            </Label>
            <Input
              id={attribute.attributeName}
              type='number'
              value={value}
              onChange={e => setValue(attribute.attributeName, e.target.value)}
              placeholder={attribute.helpText || `Ingrese ${attribute.attributeLabel.toLowerCase()}`}
              required={attribute.isRequired}
            />
            {attribute.helpText && (
              <p className='text-xs text-muted-foreground'>{attribute.helpText}</p>
            )}
            {error && <p className='text-xs text-red-500'>{error}</p>}
          </div>
        )

      case 'select':
        const options = Array.isArray(attribute.options) ? attribute.options : []
        return (
          <div key={attribute.id} className='space-y-2'>
            <Label htmlFor={attribute.attributeName}>
              {attribute.attributeLabel}
              {attribute.isRequired && <span className='text-red-500 ml-1'>*</span>}
            </Label>
            <Select value={value} onValueChange={val => setValue(attribute.attributeName, val)}>
              <SelectTrigger>
                <SelectValue
                  placeholder={`Seleccione ${attribute.attributeLabel.toLowerCase()}`}
                />
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
            {error && <p className='text-xs text-red-500'>{error}</p>}
          </div>
        )

      case 'date':
        return (
          <div key={attribute.id} className='space-y-2'>
            <Label htmlFor={attribute.attributeName}>
              {attribute.attributeLabel}
              {attribute.isRequired && <span className='text-red-500 ml-1'>*</span>}
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
            {error && <p className='text-xs text-red-500'>{error}</p>}
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
                {attribute.isRequired && <span className='text-red-500 ml-1'>*</span>}
              </Label>
            </div>
            {attribute.helpText && (
              <p className='text-xs text-muted-foreground ml-8'>{attribute.helpText}</p>
            )}
            {error && <p className='text-xs text-red-500 ml-8'>{error}</p>}
          </div>
        )

      default:
        return null
    }
  }

  if (isLoading) {
    return (
      <div className='text-sm text-muted-foreground py-4 text-center'>
        Cargando atributos del tipo...
      </div>
    )
  }

  if (attributes.length === 0) {
    return null // No mostrar nada si no hay atributos configurados
  }

  return (
    <div className='space-y-4'>
      <div className='border-t pt-4'>
        <h3 className='text-sm font-semibold mb-4 flex items-center gap-2'>
          <span className='h-1 w-1 rounded-full bg-primary' />
          Atributos Específicos del Tipo
        </h3>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          {attributes.map(attribute => renderAttribute(attribute))}
        </div>
      </div>
    </div>
  )
}
