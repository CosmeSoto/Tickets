'use client'

import { useState, useEffect } from 'react'
import { Copy, CheckCircle, Loader2 } from 'lucide-react'
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
import { SearchableSelect } from '@/components/ui/searchable-select'
import { useToast } from '@/hooks/use-toast'
import { useFamilyOptions } from '@/hooks/use-family-options'

type CatalogKind = 'brand' | 'warehouse'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  kind: CatalogKind
  itemId: string
  itemName: string
  currentFamilyId: string | null
  onSuccess?: () => void
}

export function CloneCatalogItemDialog({
  open,
  onOpenChange,
  kind,
  itemId,
  itemName,
  currentFamilyId,
  onSuccess,
}: Props) {
  const { toast } = useToast()
  const { families, loading: loadingFamilies } = useFamilyOptions()
  const [targetFamilyId, setTargetFamilyId] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const targetFamilies = families.filter(f => f.id !== currentFamilyId)
  const endpoint =
    kind === 'brand'
      ? '/api/admin/inventory/brands/clone'
      : '/api/admin/inventory/warehouses/clone'

  useEffect(() => {
    if (open) setTargetFamilyId('')
  }, [open])

  const handleClone = async () => {
    if (!currentFamilyId || !targetFamilyId) return
    setSubmitting(true)
    try {
      const body =
        kind === 'brand'
          ? {
              sourceFamilyId: currentFamilyId,
              targetFamilyIds: [targetFamilyId],
              brandIds: [itemId],
            }
          : {
              sourceFamilyId: currentFamilyId,
              targetFamilyIds: [targetFamilyId],
              warehouseIds: [itemId],
            }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al copiar')

      if (data.created === 0) {
        toast({
          title: 'Ya existe en el destino',
          description: `"${itemName}" ya está registrado en esa área.`,
          variant: 'destructive',
        })
        return
      }

      const targetName = families.find(f => f.id === targetFamilyId)?.name ?? 'área destino'
      toast({
        title: kind === 'brand' ? 'Marca copiada' : 'Bodega copiada',
        description: `"${itemName}" copiado a ${targetName}.`,
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

  const label = kind === 'brand' ? 'marca' : 'bodega'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <Copy className='h-4 w-4 text-blue-600' />
            Copiar {label} a otra área
          </DialogTitle>
          <DialogDescription>
            Copia la {label}{' '}
            <span className='font-medium text-foreground'>&quot;{itemName}&quot;</span> a otra área.
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4 py-2'>
          <div className='space-y-1.5'>
            <Label>
              Área destino <span className='text-destructive'>*</span>
            </Label>
            <SearchableSelect
              options={loadingFamilies ? [] : targetFamilies}
              value={targetFamilyId}
              onChange={setTargetFamilyId}
              placeholder={loadingFamilies ? 'Cargando áreas...' : 'Buscar área...'}
              emptyLabel='Seleccionar área'
              disabled={loadingFamilies}
            />
            {targetFamilies.length === 0 && !loadingFamilies && (
              <p className='text-xs text-muted-foreground'>No hay otras áreas disponibles.</p>
            )}
          </div>

          {targetFamilyId && (
            <div className='flex items-start gap-2 text-sm text-green-700 bg-green-50 border border-green-100 rounded-md px-3 py-2.5'>
              <CheckCircle className='h-4 w-4 mt-0.5 shrink-0' />
              <span>
                Se copiará &quot;{itemName}&quot; a{' '}
                {families.find(f => f.id === targetFamilyId)?.name ?? '...'}
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
            disabled={!targetFamilyId || submitting}
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
