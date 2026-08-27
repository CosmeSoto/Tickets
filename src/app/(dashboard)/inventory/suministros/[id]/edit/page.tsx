'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthReady } from '@/hooks/auth/use-auth-ready'
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ArrowLeft, Loader2, Save } from 'lucide-react'
import { inventoryToast as toast } from '@/lib/utils/inventory-toast'
import { getInventoryAssetPath } from '@/lib/utils/inventory-utils'

interface PageProps {
  params: Promise<{ id: string }>
}

export default function SuministroEditPage({ params }: PageProps) {
  const { id } = use(params)
  const { data: session, status } = useAuthReady()
  const router = useRouter()
  const detailPath = getInventoryAssetPath('MRO', id)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '',
    minStock: 0,
    maxStock: 0,
    costPerUnit: '',
    location: '',
    notes: '',
  })

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  useEffect(() => {
    if (status !== 'authenticated') return
    fetch(`/api/inventory/consumables/${id}`)
      .then(res => {
        if (!res.ok) throw new Error('No se pudo cargar el suministro')
        return res.json()
      })
      .then(data => {
        setForm({
          name: data.name ?? '',
          minStock: data.minStock ?? 0,
          maxStock: data.maxStock ?? 0,
          costPerUnit: data.costPerUnit != null ? String(data.costPerUnit) : '',
          location: data.location ?? '',
          notes: data.notes ?? '',
        })
      })
      .catch(err => toast.error(err.message))
      .finally(() => setLoading(false))
  }, [id, status])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch(`/api/inventory/consumables/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          minStock: Number(form.minStock),
          maxStock: Number(form.maxStock),
          costPerUnit: form.costPerUnit ? Number(form.costPerUnit) : undefined,
          location: form.location || undefined,
          notes: form.notes || undefined,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Error al guardar')
      }
      toast.success('Suministro actualizado correctamente')
      router.push(detailPath)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <ModuleLayout title='Editar suministro' subtitle='Cargando...'>
        <div className='flex items-center justify-center h-64'>
          <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
        </div>
      </ModuleLayout>
    )
  }

  if (!session?.user) return null

  return (
    <ModuleLayout title='Editar suministro' subtitle='Actualizar datos del material / suministro'>
      <div className='max-w-2xl space-y-6'>
        <Button variant='ghost' size='sm' onClick={() => router.push(detailPath)}>
          <ArrowLeft className='h-4 w-4 mr-2' />
          Volver al detalle
        </Button>

        <form onSubmit={handleSubmit} className='space-y-4 rounded-lg border p-6'>
          <div className='space-y-2'>
            <Label htmlFor='name'>Nombre</Label>
            <Input
              id='name'
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              required
            />
          </div>

          <div className='grid grid-cols-2 gap-4'>
            <div className='space-y-2'>
              <Label htmlFor='minStock'>Stock mínimo</Label>
              <Input
                id='minStock'
                type='number'
                min={0}
                value={form.minStock}
                onChange={e => setForm(f => ({ ...f, minStock: Number(e.target.value) }))}
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='maxStock'>Stock máximo</Label>
              <Input
                id='maxStock'
                type='number'
                min={0}
                value={form.maxStock}
                onChange={e => setForm(f => ({ ...f, maxStock: Number(e.target.value) }))}
              />
            </div>
          </div>

          <div className='space-y-2'>
            <Label htmlFor='costPerUnit'>Costo por unidad</Label>
            <Input
              id='costPerUnit'
              type='number'
              min={0}
              step='0.01'
              value={form.costPerUnit}
              onChange={e => setForm(f => ({ ...f, costPerUnit: e.target.value }))}
            />
          </div>

          <div className='space-y-2'>
            <Label htmlFor='location'>Ubicación</Label>
            <Input
              id='location'
              value={form.location}
              onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
            />
          </div>

          <div className='space-y-2'>
            <Label htmlFor='notes'>Notas</Label>
            <Textarea
              id='notes'
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={3}
            />
          </div>

          <div className='flex justify-end gap-2 pt-2'>
            <Button type='button' variant='outline' onClick={() => router.push(detailPath)}>
              Cancelar
            </Button>
            <Button type='submit' disabled={saving}>
              {saving ? (
                <Loader2 className='h-4 w-4 animate-spin mr-2' />
              ) : (
                <Save className='h-4 w-4 mr-2' />
              )}
              Guardar cambios
            </Button>
          </div>
        </form>
      </div>
    </ModuleLayout>
  )
}
