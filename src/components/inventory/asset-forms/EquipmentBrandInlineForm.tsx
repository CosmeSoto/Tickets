'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { InlineSelectOption } from '@/components/ui/inline-create-select'

interface Props {
  familyId?: string
  item?: InlineSelectOption
  onSuccess: (item: InlineSelectOption) => void
  onCancel: () => void
  /** true = configuración admin; false = formularios de activos */
  adminApi?: boolean
}

export function EquipmentBrandInlineForm({
  familyId,
  item,
  onSuccess,
  onCancel,
  adminApi = false,
}: Props) {
  const isEdit = !!item
  const [name, setName] = useState(item?.name ?? '')
  const [code, setCode] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleNameChange = (v: string) => {
    setName(v)
    if (!isEdit && !code) {
      setCode(
        v
          .toUpperCase()
          .replace(/\s+/g, '_')
          .replace(/[^A-Z0-9_]/g, '')
          .slice(0, 20)
      )
    }
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    e?.stopPropagation()
    setError('')
    if (!name.trim()) {
      setError('El nombre es obligatorio')
      return
    }
    if (!isEdit && !familyId) {
      setError('Selecciona un área antes de crear la marca')
      return
    }
    if (!isEdit && !code.trim()) {
      setError('El código es obligatorio')
      return
    }
    setLoading(true)
    try {
      const base = adminApi ? '/api/admin/inventory/brands' : '/api/inventory/brands'
      const url = isEdit ? `${base}/${item!.id}` : base
      const method = isEdit ? 'PUT' : 'POST'
      const body: any = {
        name: name.trim(),
        description: description.trim() || undefined,
        familyId: familyId,
      }
      if (!isEdit) {
        body.code = code.trim()
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al guardar')
      onSuccess({ id: data.id, name: data.name })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form data-inline-create-form onSubmit={handleSubmit} className='space-y-4'>
      <div className='space-y-1'>
        <Label>
          Nombre <span className='text-destructive'>*</span>
        </Label>
        <Input
          value={name}
          onChange={e => handleNameChange(e.target.value)}
          placeholder='Ej: Dell, Apple, HP...'
          autoFocus
        />
      </div>
      {!isEdit && (
        <div className='space-y-1'>
          <Label>
            Código <span className='text-destructive'>*</span>
          </Label>
          <Input
            value={code}
            onChange={e =>
              setCode(
                e.target.value
                  .toUpperCase()
                  .replace(/\s+/g, '_')
                  .replace(/[^A-Z0-9_]/g, '')
              )
            }
            placeholder='Ej: DELL'
            maxLength={20}
          />
          <p className='text-xs text-muted-foreground'>
            Solo letras mayúsculas, números y guión bajo. No se puede cambiar después.
          </p>
        </div>
      )}
      <div className='space-y-1'>
        <Label>Descripción</Label>
        <Textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder='Descripción opcional de la marca'
          rows={3}
        />
      </div>
      {error && <p className='text-sm text-destructive'>{error}</p>}
      <div className='flex justify-end gap-2 pt-1'>
        <Button type='button' variant='outline' onClick={onCancel} disabled={loading}>
          Cancelar
        </Button>
        <Button type='button' onClick={() => void handleSubmit()} disabled={loading}>
          {loading && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
          {isEdit ? 'Guardar cambios' : 'Crear marca'}
        </Button>
      </div>
    </form>
  )
}
