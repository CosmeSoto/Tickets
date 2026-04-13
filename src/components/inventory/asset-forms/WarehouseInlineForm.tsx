'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import type { InlineSelectOption } from '@/components/ui/inline-create-select'

interface Props {
  onSuccess: (item: InlineSelectOption) => void
  onCancel: () => void
}

export function WarehouseInlineForm({ onSuccess, onCancel }: Props) {
  const { toast } = useToast()
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!name.trim()) { setError('El nombre es obligatorio'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/inventory/warehouses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), location: location.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al crear')
      toast({ title: 'Bodega creada', description: data.name })
      onSuccess({ id: data.id, name: data.name, description: data.location })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <Label>Nombre <span className="text-destructive">*</span></Label>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Bodega Principal, Almacén TI..." autoFocus />
      </div>
      <div className="space-y-1">
        <Label>Ubicación</Label>
        <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="Ej: Piso 2, Edificio A" />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>Cancelar</Button>
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Crear bodega
        </Button>
      </div>
    </form>
  )
}
