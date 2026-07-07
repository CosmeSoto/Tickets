'use client'

import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { InlineSelectOption } from '@/components/ui/inline-create-select'

interface Props {
  item?: InlineSelectOption
  onSuccess: (item: InlineSelectOption) => void
  onCancel: () => void
}

export function FormCategoryInlineForm({ item, onSuccess, onCancel }: Props) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (item) {
      setName(item.name)
      setDescription(item.description || '')
    } else {
      setName('')
      setDescription('')
    }
  }, [item])

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    e?.stopPropagation()
    setError('')

    if (!name.trim()) {
      setError('El nombre es obligatorio')
      return
    }

    setLoading(true)
    try {
      const url = item ? `/api/admin/form-categories/${item.id}` : '/api/admin/form-categories'
      const method = item ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Error al guardar')
      }

      // La API devuelve { category: { id, name, description, ... } }
      const saved = data.category

      onSuccess({
        id: saved.id,
        name: saved.name,
        description: saved.description ?? undefined,
      })
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
          onChange={e => setName(e.target.value)}
          placeholder='Ej: Manuales, Políticas, Formularios...'
          autoFocus
        />
      </div>
      <div className='space-y-1'>
        <Label>Descripción</Label>
        <Textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder='Breve descripción de la categoría...'
          rows={3}
        />
      </div>
      {error && <p className='text-sm text-destructive'>{error}</p>}
      <div className='flex justify-end gap-2 pt-1'>
        <Button type='button' variant='outline' onClick={onCancel} disabled={loading}>
          Cancelar
        </Button>
        <Button type='submit' disabled={loading}>
          {loading && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
          {item ? 'Actualizar' : 'Crear'}
        </Button>
      </div>
    </form>
  )
}
