'use client'

/**
 * EquipmentTypeInlineForm — formulario compacto para crear un tipo de equipo
 * desde dentro de otro formulario (sin navegar a Catálogos).
 */

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import type { InlineSelectOption } from '@/components/ui/inline-create-select'

interface Props {
  familyId: string
  onSuccess: (item: InlineSelectOption) => void
  onCancel: () => void
}

export function EquipmentTypeInlineForm({ familyId, onSuccess, onCancel }: Props) {
  const { toast } = useToast()
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Auto-generar código desde el nombre
  const handleNameChange = (v: string) => {
    setName(v)
    if (!code) {
      setCode(v.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '').slice(0, 20))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!name.trim() || !code.trim()) {
      setError('Nombre y código son obligatorios')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/admin/equipment-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), code: code.trim(), familyId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al crear tipo')
      toast({ title: 'Tipo creado', description: data.name })
      onSuccess({ id: data.id, name: data.name })
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
        <Input
          value={name}
          onChange={e => handleNameChange(e.target.value)}
          placeholder="Ej: Laptop, Monitor, Impresora..."
          autoFocus
        />
      </div>
      <div className="space-y-1">
        <Label>Código <span className="text-destructive">*</span></Label>
        <Input
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, ''))}
          placeholder="Ej: LAPTOP"
          maxLength={20}
        />
        <p className="text-xs text-muted-foreground">Solo letras mayúsculas, números y guión bajo.</p>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>Cancelar</Button>
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Crear tipo
        </Button>
      </div>
    </form>
  )
}
