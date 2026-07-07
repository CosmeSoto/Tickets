'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SearchableSelect } from '@/components/ui/searchable-select'
import type { InlineSelectOption } from '@/components/ui/inline-create-select'
import { useFamilyOptions } from '@/hooks/use-family-options'

interface Props {
  /** Si se pasa, pre-selecciona la familia */
  defaultFamilyId?: string
  onSuccess: (item: InlineSelectOption) => void
  onCancel: () => void
}

export function WarehouseInlineForm({ defaultFamilyId, onSuccess, onCancel }: Props) {
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [familyId, setFamilyId] = useState(defaultFamilyId ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const { families } = useFamilyOptions()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setError('')
    if (!name.trim()) {
      setError('El nombre es obligatorio')
      return
    }
    if (!familyId) {
      setError('Debes seleccionar una familia para la bodega')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/inventory/warehouses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          location: location.trim() || undefined,
          familyId,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al crear')
      onSuccess({
        id: data.id,
        name: data.name,
        description: [data.location, data.family?.name].filter(Boolean).join(' · ') || undefined,
      })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className='space-y-4'>
      <div className='space-y-1'>
        <Label>
          Nombre <span className='text-destructive'>*</span>
        </Label>
        <Input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder='Ej: Bodega Principal, Almacén TI...'
          autoFocus
        />
      </div>
      <div className='space-y-1'>
        <Label>Ubicación</Label>
        <Input
          value={location}
          onChange={e => setLocation(e.target.value)}
          placeholder='Ej: Piso 2, Edificio A'
        />
      </div>
      <div className='space-y-1'>
        <Label>
          Familia <span className='text-destructive'>*</span>
        </Label>
        <SearchableSelect
          options={families}
          value={familyId}
          onChange={setFamilyId}
          placeholder='Selecciona una familia...'
        />
        <p className='text-xs text-muted-foreground'>
          Las bodegas pertenecen a una sola familia y solo son visibles para esa área.
        </p>
      </div>
      {error && <p className='text-sm text-destructive'>{error}</p>}
      <div className='flex justify-end gap-2 pt-1'>
        <Button type='button' variant='outline' onClick={onCancel} disabled={loading}>
          Cancelar
        </Button>
        <Button type='submit' disabled={loading}>
          {loading && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
          Crear bodega
        </Button>
      </div>
    </form>
  )
}
