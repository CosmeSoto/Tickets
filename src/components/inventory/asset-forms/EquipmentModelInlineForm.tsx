'use client'

import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { InlineCreateSelect, type InlineSelectOption } from '@/components/ui/inline-create-select'
import { EquipmentBrandInlineForm } from './EquipmentBrandInlineForm'
interface Props {
  typeId: string
  familyId?: string
  item?: InlineSelectOption & { brandId?: string; model?: string }
  onSuccess: (item: InlineSelectOption & { brandId: string; model: string }) => void
  onCancel: () => void
  initialBrandId?: string
}

export function EquipmentModelInlineForm({
  typeId,
  familyId,
  item,
  onSuccess,
  onCancel,
  initialBrandId,
}: Props) {
  const isEdit = !!item
  const [brandId, setBrandId] = useState<string>(item?.brandId ?? initialBrandId ?? '')
  const isBrandLocked = !isEdit && !!initialBrandId
  const [model, setModel] = useState(item?.model ?? '')
  const [sku, setSku] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [brands, setBrands] = useState<InlineSelectOption[]>([])

  // Cargar marcas
  useEffect(() => {
    const loadBrands = async () => {
      try {
        const params = new URLSearchParams()
        if (familyId) params.set('familyId', familyId)
        const res = await fetch(`/api/inventory/brands?${params}`)
        if (!res.ok) return
        const data = await res.json()
        setBrands(data.brands.map((b: any) => ({ id: b.id, name: b.name })))
      } catch {}
    }
    loadBrands()
  }, [familyId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setError('')
    if (!brandId) {
      setError('La marca es obligatoria')
      return
    }
    if (!model.trim()) {
      setError('El modelo es obligatorio')
      return
    }
    setLoading(true)
    try {
      const url = isEdit ? `/api/inventory/models/${item!.id}` : '/api/inventory/models'
      const method = isEdit ? 'PUT' : 'POST'
      const body = {
        brandId,
        model: model.trim(),
        sku: sku.trim() || undefined,
        typeId,
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al guardar')
      const brandName = brands.find(b => b.id === brandId)?.name ?? ''

      onSuccess({
        id: data.id,
        name: `${brandName} ${data.model}`,
        brandId,
        model: data.model,
      })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  const handleBrandSuccess = async (newBrand: InlineSelectOption) => {
    setBrands([...brands, newBrand])
    setBrandId(newBrand.id)
  }

  return (
    <form onSubmit={handleSubmit} className='space-y-4'>
      <div className='grid grid-cols-2 gap-3'>
        <div className='space-y-1'>
          <Label>
            Marca <span className='text-destructive'>*</span>
          </Label>
          {isBrandLocked ? (
            <div className='h-9 rounded-md border border-input bg-muted flex items-center px-3 text-sm'>
              {brands.find(b => b.id === brandId)?.name || ''}
            </div>
          ) : (
            <InlineCreateSelect
              value={brandId as any}
              onChange={(id: string) => setBrandId(id)}
              options={brands as any}
              placeholder='Buscar o crear marca...'
              createLabel='Crear marca'
              createForm={({ onSuccess, onCancel }: any) => (
                <EquipmentBrandInlineForm
                  familyId={familyId}
                  onSuccess={async (item: any) => {
                    await handleBrandSuccess(item)
                    onSuccess(item)
                  }}
                  onCancel={onCancel}
                />
              )}
            />
          )}
        </div>
        <div className='space-y-1'>
          <Label>
            Modelo <span className='text-destructive'>*</span>
          </Label>
          <Input
            value={model}
            onChange={e => setModel(e.target.value)}
            placeholder='Ej: Latitude 5520'
          />
        </div>
      </div>
      <div className='space-y-1'>
        <Label>SKU (opcional)</Label>
        <Input value={sku} onChange={e => setSku(e.target.value)} placeholder='Ej: SKU-12345' />
      </div>
      {error && <p className='text-sm text-destructive'>{error}</p>}
      <div className='flex justify-end gap-2 pt-1'>
        <Button type='button' variant='outline' onClick={onCancel} disabled={loading}>
          Cancelar
        </Button>
        <Button type='submit' disabled={loading}>
          {loading && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
          {isEdit ? 'Guardar cambios' : 'Crear modelo'}
        </Button>
      </div>
    </form>
  )
}
