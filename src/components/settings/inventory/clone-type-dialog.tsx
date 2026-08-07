'use client'

/**
 * CloneTypeDialog
 * Copia un tipo de equipo/licencia/consumible a otra familia,
 * incluyendo todos sus atributos personalizados.
 *
 * Solo visible para ADMIN / isSuperAdmin.
 */

import { useState, useEffect } from 'react'
import { Copy, CheckCircle, Loader2, Info } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { inventoryToast as toast } from '@/lib/utils/inventory-toast'
import { useFamilyOptions } from '@/hooks/use-family-options'
import type { TypeKind, AnyType } from '@/hooks/inventory/use-type-management'

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** El tipo que se va a copiar */
  sourceType: AnyType
  typeKind: TypeKind
  /** Familia actual del tipo (para excluirla de las opciones destino) */
  currentFamilyId: string | null
  /** Callback tras copia exitosa — normalmente recargar los tipos de la nueva familia */
  onSuccess: (newTypeName: string, targetFamilyName: string) => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CloneTypeDialog({
  open,
  onOpenChange,
  sourceType,
  typeKind,
  currentFamilyId,
  onSuccess,
}: Props) {
  const { families, loading: loadingFamilies } = useFamilyOptions()

  const [targetFamilyId, setTargetFamilyId] = useState('')
  const [newName, setNewName] = useState('')
  const [copyAttributes, setCopyAttributes] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Atributos del tipo origen (para preview)
  const [attrCount, setAttrCount] = useState<number | null>(null)

  // Familias destino — excluir la familia actual
  const targetFamilies = families.filter(f => f.id !== currentFamilyId)

  // Reset al abrir
  useEffect(() => {
    if (open) {
      setTargetFamilyId('')
      setNewName('')
      setCopyAttributes(true)
      setAttrCount(null)
    }
  }, [open])

  // Cargar cantidad de atributos del tipo origen para preview
  useEffect(() => {
    if (!open || !sourceType.id) return
    const endpoint =
      typeKind === 'equipment'
        ? `/api/inventory/equipment-types/${sourceType.id}/attributes`
        : typeKind === 'license'
          ? `/api/inventory/license-types/${sourceType.id}/attributes`
          : `/api/inventory/consumable-types/${sourceType.id}/attributes`

    fetch(endpoint)
      .then(r => r.json())
      .then(d =>
        setAttrCount(Array.isArray(d) ? d.length : (d.attributes?.length ?? d.length ?? 0))
      )
      .catch(() => setAttrCount(0))
  }, [open, sourceType.id, typeKind])

  const cloneEndpoint = `/api/admin/inventory/${typeKind}-types/clone`

  const handleClone = async () => {
    if (!targetFamilyId) return

    setSubmitting(true)
    try {
      const res = await fetch(cloneEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceTypeId: sourceType.id,
          targetFamilyId,
          newName: newName.trim() || undefined,
          copyAttributes,
        }),
      })

      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? 'Error al copiar el tipo')

      const targetFamilyName = families.find(f => f.id === targetFamilyId)?.name ?? targetFamilyId
      const createdName = json.type?.name ?? (newName || sourceType.name)

      toast({
        title: 'Tipo copiado',
        description: `"${createdName}" creado en el área "${targetFamilyName}"${
          json.attributesCopied > 0 ? ` con ${json.attributesCopied} atributo(s) copiados.` : '.'
        }`,
      })

      onOpenChange(false)
      onSuccess(createdName, targetFamilyName)
    } catch (err: unknown) {
      toast({
        title: 'Error al copiar',
        description: err instanceof Error ? err.message : 'Error desconocido',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const typeKindLabel =
    typeKind === 'equipment' ? 'equipo' : typeKind === 'license' ? 'licencia' : 'suministro'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <Copy className='h-4 w-4 text-blue-600' />
            Copiar tipo a otra área
          </DialogTitle>
          <DialogDescription>
            Copia el tipo de {typeKindLabel}{' '}
            <span className='font-medium text-foreground'>&ldquo;{sourceType.name}&rdquo;</span> a
            otra área, incluyendo todos sus atributos personalizados.
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4 py-2'>
          {/* Preview de atributos */}
          {attrCount !== null && (
            <div className='flex items-start gap-2 text-sm rounded-md bg-muted/40 px-3 py-2.5'>
              <Info className='h-4 w-4 mt-0.5 shrink-0 text-muted-foreground' />
              <div>
                <p className='font-medium text-foreground'>
                  {attrCount > 0
                    ? `${attrCount} atributo${attrCount > 1 ? 's' : ''} personalizados`
                    : 'Sin atributos personalizados'}
                </p>
                <p className='text-xs text-muted-foreground mt-0.5'>
                  {attrCount > 0
                    ? 'Se copiarán al tipo nuevo si la opción está activa.'
                    : 'Solo se copiará la configuración del tipo.'}
                </p>
              </div>
            </div>
          )}

          {/* Área destino */}
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

          {/* Nombre alternativo */}
          <div className='space-y-1.5'>
            <Label htmlFor='clone-name'>
              Nombre en el destino{' '}
              <span className='text-xs text-muted-foreground font-normal'>
                (deja vacío para usar &ldquo;{sourceType.name}&rdquo;)
              </span>
            </Label>
            <Input
              id='clone-name'
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder={sourceType.name}
            />
          </div>

          {/* Copiar atributos toggle */}
          {attrCount !== null && attrCount > 0 && (
            <label className='flex items-center gap-3 cursor-pointer select-none'>
              <button
                type='button'
                role='switch'
                aria-checked={copyAttributes}
                onClick={() => setCopyAttributes(v => !v)}
                className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  copyAttributes ? 'bg-primary' : 'bg-muted'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-lg transition-transform ${
                    copyAttributes ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
              <div>
                <span className='text-sm font-medium'>Copiar atributos personalizados</span>
                <p className='text-xs text-muted-foreground'>
                  {copyAttributes
                    ? `Se copiarán ${attrCount} atributo(s) al nuevo tipo.`
                    : 'El nuevo tipo no tendrá atributos personalizados.'}
                </p>
              </div>
            </label>
          )}

          {/* Resumen */}
          {targetFamilyId && (
            <div className='flex items-start gap-2 text-sm text-green-700 bg-green-50 border border-green-100 rounded-md px-3 py-2.5'>
              <CheckCircle className='h-4 w-4 mt-0.5 shrink-0' />
              <div>
                <p className='font-medium'>
                  Se creará &ldquo;{newName.trim() || sourceType.name}&rdquo; en &ldquo;
                  {families.find(f => f.id === targetFamilyId)?.name ?? '...'}&rdquo;
                </p>
                {copyAttributes && attrCount ? (
                  <p className='text-xs text-green-600 mt-0.5'>
                    + {attrCount} atributo(s) copiados
                  </p>
                ) : null}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className='gap-2'>
          <Button
            type='button'
            variant='outline'
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button
            type='button'
            onClick={handleClone}
            disabled={!targetFamilyId || submitting}
            className='gap-1.5'
          >
            {submitting ? (
              <Loader2 className='h-3.5 w-3.5 animate-spin' />
            ) : (
              <Copy className='h-3.5 w-3.5' />
            )}
            {submitting ? 'Copiando...' : 'Copiar tipo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
