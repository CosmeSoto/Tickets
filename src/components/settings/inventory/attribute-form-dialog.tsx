/**
 * Attribute Form Dialog Component
 * Formulario para crear/editar atributos
 */

'use client'

import { useState, useEffect } from 'react'
import { Plus, X } from 'lucide-react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import type { Attribute, AttributeType, CreateAttributeData } from '@/hooks/inventory/use-attribute-management'

// ── Types ──────────────────────────────────────────────────────────────────

interface AttributeFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  attribute: Attribute | null
  onSave: (data: CreateAttributeData) => Promise<boolean>
  saving: boolean
}

const ATTRIBUTE_TYPES: { value: AttributeType; label: string }[] = [
  { value: 'text', label: 'Texto' },
  { value: 'number', label: 'Número' },
  { value: 'select', label: 'Selección' },
  { value: 'date', label: 'Fecha' },
  { value: 'boolean', label: 'Sí/No' },
]

// ── Component ──────────────────────────────────────────────────────────────

export function AttributeFormDialog({
  open,
  onOpenChange,
  attribute,
  onSave,
  saving,
}: AttributeFormDialogProps) {
  const isEditing = !!attribute

  const [formData, setFormData] = useState({
    attributeName: '',
    attributeLabel: '',
    attributeType: 'text' as AttributeType,
    options: [] as string[],
    isRequired: false,
    isVisible: true,
    helpText: '',
  })

  const [optionInput, setOptionInput] = useState('')
  const [nameError, setNameError] = useState('')

  // Load attribute data when editing
  useEffect(() => {
    if (attribute) {
      setFormData({
        attributeName: attribute.attributeName,
        attributeLabel: attribute.attributeLabel,
        attributeType: attribute.attributeType,
        options: attribute.options?.options || [],
        isRequired: attribute.isRequired,
        isVisible: attribute.isVisible,
        helpText: attribute.helpText || '',
      })
    } else {
      setFormData({
        attributeName: '',
        attributeLabel: '',
        attributeType: 'text',
        options: [],
        isRequired: false,
        isVisible: true,
        helpText: '',
      })
    }
    setNameError('')
    setOptionInput('')
  }, [attribute, open])

  // Validate attribute name
  const validateName = (name: string): boolean => {
    if (!name) {
      setNameError('El nombre es requerido')
      return false
    }
    if (!/^[a-z_]+$/.test(name)) {
      setNameError('Solo minúsculas y guiones bajos')
      return false
    }
    setNameError('')
    return true
  }

  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateName(formData.attributeName)) return
    if (!formData.attributeLabel) return

    const data: CreateAttributeData = {
      attributeName: formData.attributeName,
      attributeLabel: formData.attributeLabel,
      attributeType: formData.attributeType,
      isRequired: formData.isRequired,
      isVisible: formData.isVisible,
      helpText: formData.helpText || undefined,
    }

    // Add options for select type
    if (formData.attributeType === 'select' && formData.options.length > 0) {
      data.options = { options: formData.options }
    }

    const success = await onSave(data)
    if (success) {
      onOpenChange(false)
    }
  }

  // Handle add option
  const handleAddOption = () => {
    if (!optionInput.trim()) return
    if (formData.options.includes(optionInput.trim())) return

    setFormData(prev => ({
      ...prev,
      options: [...prev.options, optionInput.trim()],
    }))
    setOptionInput('')
  }

  // Handle remove option
  const handleRemoveOption = (index: number) => {
    setFormData(prev => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== index),
    }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-2xl max-h-[90vh] overflow-y-auto'>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEditing ? 'Editar Atributo' : 'Nuevo Atributo'}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? 'Modifica las propiedades del atributo'
                : 'Crea un nuevo atributo personalizado'}
            </DialogDescription>
          </DialogHeader>

          <div className='space-y-4 py-4'>
            <div className='grid grid-cols-2 gap-4'>
              <div className='space-y-2'>
                <Label htmlFor='attr-name'>
                  Nombre técnico <span className='text-destructive'>*</span>
                </Label>
                <Input
                  id='attr-name'
                  value={formData.attributeName}
                  onChange={e => {
                    setFormData(prev => ({ ...prev, attributeName: e.target.value }))
                    validateName(e.target.value)
                  }}
                  placeholder='ej: numero_serie'
                  className={nameError ? 'border-destructive' : ''}
                  disabled={saving || isEditing}
                />
                {nameError && <p className='text-xs text-destructive'>{nameError}</p>}
                {isEditing && (
                  <p className='text-xs text-muted-foreground'>
                    El nombre técnico no se puede cambiar
                  </p>
                )}
              </div>

              <div className='space-y-2'>
                <Label htmlFor='attr-label'>
                  Etiqueta <span className='text-destructive'>*</span>
                </Label>
                <Input
                  id='attr-label'
                  value={formData.attributeLabel}
                  onChange={e =>
                    setFormData(prev => ({ ...prev, attributeLabel: e.target.value }))
                  }
                  placeholder='ej: Número de Serie'
                  disabled={saving}
                />
              </div>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='attr-type'>Tipo de dato</Label>
              <Select
                value={formData.attributeType}
                onValueChange={v =>
                  setFormData(prev => ({ ...prev, attributeType: v as AttributeType }))
                }
                disabled={saving}
              >
                <SelectTrigger id='attr-type'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ATTRIBUTE_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {formData.attributeType === 'select' && (
              <div className='space-y-2'>
                <Label>Opciones</Label>
                <div className='flex gap-2'>
                  <Input
                    value={optionInput}
                    onChange={e => setOptionInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAddOption()
                      }
                    }}
                    placeholder='Escribe una opción y presiona Enter'
                    disabled={saving}
                  />
                  <Button
                    type='button'
                    onClick={handleAddOption}
                    disabled={saving || !optionInput.trim()}
                  >
                    <Plus className='h-4 w-4' />
                  </Button>
                </div>
                {formData.options.length > 0 && (
                  <div className='flex flex-wrap gap-2 mt-2'>
                    {formData.options.map((opt, idx) => (
                      <Badge key={idx} variant='secondary' className='gap-1'>
                        {opt}
                        <button
                          type='button'
                          onClick={() => handleRemoveOption(idx)}
                          className='ml-1 hover:text-destructive'
                          disabled={saving}
                        >
                          <X className='h-3 w-3' />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className='space-y-2'>
              <Label htmlFor='attr-help'>Texto de ayuda (opcional)</Label>
              <Textarea
                id='attr-help'
                value={formData.helpText}
                onChange={e => setFormData(prev => ({ ...prev, helpText: e.target.value }))}
                placeholder='Descripción o instrucciones para este campo'
                rows={2}
                disabled={saving}
              />
            </div>

            <div className='flex items-center gap-4'>
              <div className='flex items-center gap-2'>
                <Switch
                  id='attr-required'
                  checked={formData.isRequired}
                  onCheckedChange={v => setFormData(prev => ({ ...prev, isRequired: v }))}
                  disabled={saving}
                />
                <Label htmlFor='attr-required' className='cursor-pointer'>
                  Requerido
                </Label>
              </div>
              <div className='flex items-center gap-2'>
                <Switch
                  id='attr-visible'
                  checked={formData.isVisible}
                  onCheckedChange={v => setFormData(prev => ({ ...prev, isVisible: v }))}
                  disabled={saving}
                />
                <Label htmlFor='attr-visible' className='cursor-pointer'>
                  Visible
                </Label>
              </div>
            </div>
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
            <Button type='submit' disabled={saving || !formData.attributeLabel}>
              {saving
                ? isEditing
                  ? 'Actualizando...'
                  : 'Creando...'
                : isEditing
                  ? 'Actualizar'
                  : 'Crear'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
