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

export function UnitOfMeasureInlineForm({ onSuccess, onCancel }: Props) {
  const { toast } = useToast()
  const [name, setName] = useState('')
  const [symbol, setSymbol] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleNameChange = (v: string) => {
    setName(v)
    if (!code) {
      setCode(v.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '').slice(0, 10))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!name.trim() || !symbol.trim() || !code.trim()) {
      setError('Nombre, símbolo y código son obligatorios')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/inventory/units-of-measure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), symbol: symbol.trim(), code: code.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al crear')
      toast({ title: 'Unidad creada', description: `${data.name} (${data.symbol})` })
      // El display en el select muestra "nombre (símbolo)"
      onSuccess({ id: data.id, name: `${data.name} (${data.symbol})` })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1 col-span-2">
          <Label>Nombre <span className="text-destructive">*</span></Label>
          <Input value={name} onChange={e => handleNameChange(e.target.value)} placeholder="Ej: Kilogramo, Litro, Unidad..." autoFocus />
        </div>
        <div className="space-y-1">
          <Label>Símbolo <span className="text-destructive">*</span></Label>
          <Input value={symbol} onChange={e => setSymbol(e.target.value)} placeholder="Ej: kg, L, u" maxLength={10} />
        </div>
        <div className="space-y-1">
          <Label>Código <span className="text-destructive">*</span></Label>
          <Input
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, ''))}
            placeholder="Ej: KG"
            maxLength={10}
          />
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>Cancelar</Button>
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Crear unidad
        </Button>
      </div>
    </form>
  )
}
