'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'

interface DynamicAttributesProps {
  equipmentType: any
  values: Record<string, any>
  onChange: (values: Record<string, any>) => void
}

export function DynamicAttributes({ equipmentType, values, onChange }: DynamicAttributesProps) {
  if (!equipmentType?.attributes || equipmentType.attributes.length === 0) {
    return null
  }

  const handleChange = (attributeKey: string, value: any) => {
    onChange({
      ...values,
      [attributeKey]: value,
    })
  }

  const renderAttribute = (attribute: any) => {
    const value = values[attribute.key] || attribute.defaultValue || ''

    switch (attribute.dataType) {
      case 'TEXT':
      case 'STRING':
        return (
          <Input
            value={value}
            onChange={e => handleChange(attribute.key, e.target.value)}
            placeholder={attribute.placeholder || ''}
            required={attribute.isRequired}
          />
        )

      case 'NUMBER':
      case 'INTEGER':
        return (
          <Input
            type='number'
            value={value}
            onChange={e => handleChange(attribute.key, parseFloat(e.target.value) || '')}
            placeholder={attribute.placeholder || ''}
            required={attribute.isRequired}
          />
        )

      case 'BOOLEAN':
        return (
          <div className='flex items-center space-x-2'>
            <Checkbox
              checked={value === true}
              onCheckedChange={checked => handleChange(attribute.key, checked)}
            />
            <span className='text-sm text-gray-600'>{attribute.label}</span>
          </div>
        )

      case 'SELECT':
        if (!attribute.options || attribute.options.length === 0) {
          return <p className='text-sm text-gray-500'>Sin opciones disponibles</p>
        }
        return (
          <Select value={value} onValueChange={val => handleChange(attribute.key, val)}>
            <SelectTrigger>
              <SelectValue placeholder={`Seleccionar ${attribute.label.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              {attribute.options.map((option: string) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )

      case 'TEXTAREA':
        return (
          <Textarea
            value={value}
            onChange={e => handleChange(attribute.key, e.target.value)}
            placeholder={attribute.placeholder || ''}
            rows={3}
            required={attribute.isRequired}
          />
        )

      case 'DATE':
        return (
          <Input
            type='date'
            value={value}
            onChange={e => handleChange(attribute.key, e.target.value)}
            required={attribute.isRequired}
          />
        )

      default:
        return (
          <Input
            value={value}
            onChange={e => handleChange(attribute.key, e.target.value)}
            placeholder={attribute.placeholder || ''}
            required={attribute.isRequired}
          />
        )
    }
  }

  return (
    <div className='space-y-4 pt-4 border-t'>
      <h4 className='font-semibold text-sm text-gray-700'>Atributos de {equipmentType.name}</h4>
      <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
        {equipmentType.attributes.map((attribute: any) => (
          <div key={attribute.key} className='space-y-2'>
            <Label htmlFor={attribute.key}>
              {attribute.label}
              {attribute.isRequired && <span className='text-red-500 ml-1'>*</span>}
            </Label>
            {renderAttribute(attribute)}
            {attribute.helpText && <p className='text-xs text-gray-500'>{attribute.helpText}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}
