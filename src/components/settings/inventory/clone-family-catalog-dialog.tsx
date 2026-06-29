'use client'

import { useState, useEffect } from 'react'
import { Copy, Loader2, CheckCircle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/hooks/use-toast'
import { useFamilyOptions } from '@/hooks/use-family-options'

type CatalogKind = 'brands' | 'warehouses'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  kind: CatalogKind
  currentFamilyId: string | null
  onSuccess?: () => void
}

export function CloneFamilyCatalogDialog({
  open,
  onOpenChange,
  kind,
  currentFamilyId,
  onSuccess,
}: Props) {
  const { toast } = useToast()
  const { families, loading: loadingFamilies } = useFamilyOptions()
  const [targetFamilyIds, setTargetFamilyIds] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)

  const targetFamilies = families.filter(f => f.id !== currentFamilyId)
  const sourceFamily = families.find(f => f.id === currentFamilyId)
  const endpoint =
    kind === 'brands'
      ? '/api/admin/inventory/brands/clone'
      : '/api/admin/inventory/warehouses/clone'

  useEffect(() => {
    if (open) setTargetFamilyIds([])
  }, [open])

  const toggleTarget = (familyId: string, checked: boolean) => {
    setTargetFamilyIds(prev =>
      checked ? [...prev, familyId] : prev.filter(id => id !== familyId)
    )
  }

  const handleClone = async () => {
    if (!currentFamilyId || targetFamilyIds.length === 0) return
    setSubmitting(true)
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceFamilyId: currentFamilyId, targetFamilyIds }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al copiar')

      toast({
        title: kind === 'brands' ? 'Marcas copiadas' : 'Bodegas copiadas',
        description: `${data.created} creados, ${data.skipped} omitidos (ya existían)`,
      })
      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'No se pudo copiar',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const title = kind === 'brands' ? 'Copiar marcas a otras áreas' : 'Copiar bodegas a otras áreas'
  const description =
    kind === 'brands'
      ? 'Replica el catálogo de marcas de esta área hacia las áreas seleccionadas.'
      : 'Replica las bodegas activas de esta área hacia las áreas seleccionadas.'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <Copy className='h-4 w-4' />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className='space-y-4 py-2'>
          <div className='rounded-md border bg-muted/40 px-3 py-2 text-sm'>
            <span className='text-muted-foreground'>Origen: </span>
            <span className='font-medium'>{sourceFamily?.name ?? 'Área actual'}</span>
          </div>

          <div className='space-y-2'>
            <Label>Áreas destino</Label>
            {loadingFamilies ? (
              <p className='text-sm text-muted-foreground'>Cargando áreas...</p>
            ) : targetFamilies.length === 0 ? (
              <p className='text-sm text-muted-foreground'>No hay otras áreas disponibles</p>
            ) : (
              <div className='max-h-48 overflow-y-auto space-y-2 border rounded-md p-3'>
                {targetFamilies.map(f => (
                  <label key={f.id} className='flex items-center gap-2 text-sm cursor-pointer'>
                    <Checkbox
                      checked={targetFamilyIds.includes(f.id)}
                      onCheckedChange={checked => toggleTarget(f.id, checked === true)}
                    />
                    <span>{f.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {targetFamilyIds.length > 0 && (
            <div className='flex items-start gap-2 text-sm text-green-700 bg-green-50 border border-green-100 rounded-md px-3 py-2'>
              <CheckCircle className='h-4 w-4 mt-0.5 shrink-0' />
              <span>
                Se copiará a {targetFamilyIds.length} área
                {targetFamilyIds.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>

        <DialogFooter className='gap-2'>
          <Button type='button' variant='outline' onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            type='button'
            onClick={handleClone}
            disabled={!currentFamilyId || targetFamilyIds.length === 0 || submitting}
            className='gap-1.5'
          >
            {submitting ? <Loader2 className='h-3.5 w-3.5 animate-spin' /> : <Copy className='h-3.5 w-3.5' />}
            {submitting ? 'Copiando...' : 'Copiar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
