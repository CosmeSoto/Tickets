'use client'

/**
 * TransferFamilyDialog
 * Permite a admins (con acceso a ambas familias) reasignar un activo
 * (equipo, licencia o MRO) a una familia diferente.
 *
 * Flujo:
 *  1. Seleccionar familia destino  →  cargar tipos de esa familia
 *  2. Seleccionar tipo destino     →  GET preview del impacto de atributos
 *  3. Para equipos: seleccionar bodega destino (opcional, hay auto-fallback)
 *  4. Mostrar impacto: atributos preservados / perdidos / nuevos vacíos
 *  5. Confirmar → POST transfer-family
 */

import { useState, useEffect, useCallback } from 'react'
import { ArrowRightLeft, AlertTriangle, CheckCircle, Info, Loader2, Warehouse } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Label } from '@/components/ui/label'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { inventoryToast as toast } from '@/lib/utils/inventory-toast'
import { useFamilyOptions } from '@/hooks/use-family-options'

// ─── Types ────────────────────────────────────────────────────────────────────

type AssetKind = 'EQUIPMENT' | 'LICENSE' | 'MRO'

interface CustomValueEntry {
  fieldName: string
  fieldValue: string
}

interface TransferImpact {
  assetKind: AssetKind
  currentFamilyId: string | null
  currentFamilyName: string | null
  hasActiveAssignment: boolean
  impact: {
    preserved: CustomValueEntry[]
    lost: string[]
    newEmpty: string[]
  }
}

interface TypeOption {
  id: string
  name: string
}

interface WarehouseOption {
  id: string
  name: string
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  assetId: string
  assetKind: AssetKind
  assetLabel: string
  currentFamilyId: string | null
  currentFamilyName: string | null
  /** Callback tras transferencia exitosa — normalmente recargar la ficha */
  onSuccess: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TransferFamilyDialog({
  open,
  onOpenChange,
  assetId,
  assetKind,
  assetLabel,
  currentFamilyId,
  currentFamilyName,
  onSuccess,
}: Props) {
  const { families, loading: loadingFamilies } = useFamilyOptions()

  // Pasos del wizard
  const [targetFamilyId, setTargetFamilyId] = useState('')
  const [targetTypeId, setTargetTypeId] = useState('')
  const [targetWarehouseId, setTargetWarehouseId] = useState('')

  // Datos cargados dinámicamente
  const [types, setTypes] = useState<TypeOption[]>([])
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([])
  const [loadingTypes, setLoadingTypes] = useState(false)
  const [loadingWarehouses, setLoadingWarehouses] = useState(false)

  // Preview de impacto
  const [impact, setImpact] = useState<TransferImpact | null>(null)
  const [loadingImpact, setLoadingImpact] = useState(false)

  // Transferencia
  const [submitting, setSubmitting] = useState(false)

  // Familias destino: excluir la familia actual
  const targetFamilies = families.filter(f => f.id !== currentFamilyId)

  // ── Reset al cerrar ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) {
      setTargetFamilyId('')
      setTargetTypeId('')
      setTargetWarehouseId('')
      setTypes([])
      setWarehouses([])
      setImpact(null)
    }
  }, [open])

  // ── Cargar tipos de la familia destino ───────────────────────────────────────
  useEffect(() => {
    if (!targetFamilyId) {
      setTypes([])
      setTargetTypeId('')
      setImpact(null)
      return
    }

    const endpoint =
      assetKind === 'EQUIPMENT'
        ? `/api/inventory/equipment-types?familyId=${targetFamilyId}&isActive=true`
        : assetKind === 'LICENSE'
          ? `/api/inventory/license-types?familyId=${targetFamilyId}&isActive=true`
          : `/api/inventory/consumable-types?familyId=${targetFamilyId}&isActive=true`

    setLoadingTypes(true)
    setTargetTypeId('')
    setImpact(null)

    fetch(endpoint)
      .then(r => r.json())
      .then(d => {
        // Las distintas APIs devuelven en campos diferentes
        const list: TypeOption[] =
          d.types ?? d.equipmentTypes ?? d.consumableTypes ?? d.items ?? d ?? []
        setTypes(Array.isArray(list) ? list : [])
      })
      .catch(() => setTypes([]))
      .finally(() => setLoadingTypes(false))
  }, [targetFamilyId, assetKind])

  // ── Cargar bodegas de la familia destino (solo equipos) ──────────────────────
  useEffect(() => {
    if (assetKind !== 'EQUIPMENT' || !targetFamilyId) {
      setWarehouses([])
      setTargetWarehouseId('')
      return
    }

    setLoadingWarehouses(true)
    fetch(`/api/inventory/warehouses?familyId=${targetFamilyId}&isActive=true`)
      .then(r => r.json())
      .then(d => {
        const list: WarehouseOption[] = d.warehouses ?? d.items ?? d ?? []
        setWarehouses(Array.isArray(list) ? list : [])
      })
      .catch(() => setWarehouses([]))
      .finally(() => setLoadingWarehouses(false))
  }, [targetFamilyId, assetKind])

  // ── Preview de impacto ───────────────────────────────────────────────────────
  const fetchImpact = useCallback(async () => {
    if (!targetTypeId) {
      setImpact(null)
      return
    }
    setLoadingImpact(true)
    try {
      const res = await fetch(
        `/api/inventory/assets/${assetId}/transfer-family?targetTypeId=${targetTypeId}`
      )
      if (res.ok) {
        setImpact(await res.json())
      }
    } catch {
      // impacto no crítico para continuar
    } finally {
      setLoadingImpact(false)
    }
  }, [assetId, targetTypeId])

  useEffect(() => {
    fetchImpact()
  }, [fetchImpact])

  // ── Ejecutar transferencia ───────────────────────────────────────────────────
  const handleTransfer = async () => {
    if (!targetFamilyId || !targetTypeId) return

    setSubmitting(true)
    try {
      const res = await fetch(`/api/inventory/assets/${assetId}/transfer-family`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetFamilyId,
          targetTypeId,
          targetWarehouseId: targetWarehouseId || undefined,
          // Enviar atributos preservados del preview
          preservedValues: impact?.impact.preserved ?? [],
          // Con force=true porque el usuario ya vio el impacto en el dialog
          force: true,
        }),
      })

      const json = await res.json().catch(() => ({}))

      if (res.status === 409 && json.code === 'ACTIVE_ASSIGNMENT') {
        toast({
          title: 'Asignación activa',
          description: 'Termina la asignación del equipo antes de transferirlo.',
          variant: 'destructive',
        })
        return
      }

      if (!res.ok) {
        throw new Error(json.error ?? 'No se pudo completar la transferencia')
      }

      const toFamily = targetFamilies.find(f => f.id === targetFamilyId)?.name ?? targetFamilyId

      toast({
        title: 'Activo transferido',
        description: `"${assetLabel}" fue movido al área "${toFamily}".${
          json.attributesLost?.length
            ? ` Se perdieron ${json.attributesLost.length} atributo(s) no compatibles.`
            : ''
        }`,
      })

      onOpenChange(false)
      onSuccess()
    } catch (err: unknown) {
      toast({
        title: 'Error al transferir',
        description: err instanceof Error ? err.message : 'Error desconocido',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  const canConfirm = !!targetFamilyId && !!targetTypeId && !loadingImpact && !submitting
  const hasLost = (impact?.impact.lost.length ?? 0) > 0
  const hasNewEmpty = (impact?.impact.newEmpty.length ?? 0) > 0

  // Etiquetas de tipo según subtipo
  const typeLabel =
    assetKind === 'EQUIPMENT'
      ? 'Tipo de equipo'
      : assetKind === 'LICENSE'
        ? 'Tipo de licencia'
        : 'Tipo de consumible'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <ArrowRightLeft className='h-4 w-4 text-blue-600' />
            Transferir a otra área
          </DialogTitle>
          <DialogDescription>
            Mueve <span className='font-medium text-foreground'>&ldquo;{assetLabel}&rdquo;</span>{' '}
            desde <span className='font-medium text-foreground'>{currentFamilyName ?? '—'}</span> a
            otra área. Los atributos compatibles se conservarán.
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-5 py-2'>
          {/* Bloque de origen — informativo */}
          <div className='flex items-center gap-2 text-sm text-muted-foreground bg-muted/40 rounded-md px-3 py-2'>
            <span className='font-medium text-foreground'>
              {currentFamilyName ?? 'Área actual'}
            </span>
            <ArrowRightLeft className='h-3.5 w-3.5 shrink-0' />
            <span className='text-muted-foreground italic'>
              {targetFamilyId
                ? (families.find(f => f.id === targetFamilyId)?.name ?? '...')
                : 'Selecciona área destino'}
            </span>
          </div>

          {/* Selector de familia destino */}
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
          </div>

          {/* Selector de tipo destino */}
          {targetFamilyId && (
            <div className='space-y-1.5'>
              <Label>
                {typeLabel} <span className='text-destructive'>*</span>
              </Label>
              {loadingTypes ? (
                <div className='flex items-center gap-2 text-sm text-muted-foreground py-2'>
                  <Loader2 className='h-3.5 w-3.5 animate-spin' />
                  Cargando tipos...
                </div>
              ) : types.length === 0 ? (
                <p className='text-sm text-muted-foreground py-1'>
                  Esta área no tiene tipos configurados.
                </p>
              ) : (
                <SearchableSelect
                  options={types}
                  value={targetTypeId}
                  onChange={setTargetTypeId}
                  placeholder='Buscar tipo...'
                  emptyLabel='Seleccionar tipo'
                />
              )}
            </div>
          )}

          {/* Selector de bodega destino (solo equipos) */}
          {assetKind === 'EQUIPMENT' && targetFamilyId && (
            <div className='space-y-1.5'>
              <Label className='flex items-center gap-1.5'>
                <Warehouse className='h-3.5 w-3.5 text-muted-foreground' />
                Bodega destino{' '}
                <span className='text-xs text-muted-foreground font-normal'>
                  (opcional — se asigna la primera disponible si se omite)
                </span>
              </Label>
              {loadingWarehouses ? (
                <div className='flex items-center gap-2 text-sm text-muted-foreground py-2'>
                  <Loader2 className='h-3.5 w-3.5 animate-spin' />
                  Cargando bodegas...
                </div>
              ) : warehouses.length === 0 ? (
                <p className='text-sm text-muted-foreground py-1'>
                  No hay bodegas activas en esta área.
                </p>
              ) : (
                <SearchableSelect
                  options={warehouses}
                  value={targetWarehouseId}
                  onChange={setTargetWarehouseId}
                  placeholder='Buscar bodega...'
                  emptyLabel='Sin bodega específica'
                />
              )}
            </div>
          )}

          {/* Preview de impacto en atributos */}
          {targetTypeId && (
            <div className='space-y-2'>
              <p className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
                Impacto en atributos personalizados
              </p>

              {loadingImpact ? (
                <div className='flex items-center gap-2 text-sm text-muted-foreground'>
                  <Loader2 className='h-3.5 w-3.5 animate-spin' />
                  Calculando...
                </div>
              ) : impact ? (
                <div className='space-y-2'>
                  {/* Preservados */}
                  {impact.impact.preserved.length > 0 && (
                    <div className='flex items-start gap-2 text-sm text-green-700 bg-green-50 border border-green-100 rounded-md px-3 py-2'>
                      <CheckCircle className='h-4 w-4 mt-0.5 shrink-0' />
                      <div>
                        <p className='font-medium'>
                          {impact.impact.preserved.length} atributo(s) se conservan
                        </p>
                        <p className='text-xs text-green-600 mt-0.5'>
                          {impact.impact.preserved.map(v => v.fieldName).join(', ')}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Perdidos */}
                  {hasLost && (
                    <Alert variant='destructive' className='py-2 px-3'>
                      <AlertTriangle className='h-4 w-4' />
                      <AlertDescription className='text-xs'>
                        <span className='font-semibold'>
                          {impact.impact.lost.length} atributo(s) se perderán
                        </span>{' '}
                        (no existen en el tipo destino):{' '}
                        <span className='font-mono'>{impact.impact.lost.join(', ')}</span>
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Nuevos vacíos */}
                  {hasNewEmpty && (
                    <div className='flex items-start gap-2 text-sm text-blue-700 bg-blue-50 border border-blue-100 rounded-md px-3 py-2'>
                      <Info className='h-4 w-4 mt-0.5 shrink-0' />
                      <div>
                        <p className='font-medium'>
                          {impact.impact.newEmpty.length} atributo(s) nuevos sin valor
                        </p>
                        <p className='text-xs text-blue-600 mt-0.5'>
                          Podrás completarlos editando el activo después de la transferencia:{' '}
                          <span className='font-mono'>{impact.impact.newEmpty.join(', ')}</span>
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Sin atributos en ninguno de los dos lados */}
                  {impact.impact.preserved.length === 0 && !hasLost && !hasNewEmpty && (
                    <div className='flex items-center gap-2 text-sm text-muted-foreground bg-muted/40 rounded-md px-3 py-2'>
                      <CheckCircle className='h-3.5 w-3.5' />
                      Sin atributos personalizados en ninguno de los tipos
                    </div>
                  )}

                  {/* Advertencia asignación activa */}
                  {impact.hasActiveAssignment && (
                    <Alert variant='destructive' className='py-2 px-3'>
                      <AlertTriangle className='h-4 w-4' />
                      <AlertDescription className='text-xs'>
                        Este equipo tiene una{' '}
                        <span className='font-semibold'>asignación activa</span>. Debes terminarla
                        antes de transferirlo.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              ) : null}
            </div>
          )}

          {/* Badges de resumen */}
          {targetFamilyId && targetTypeId && (
            <div className='flex flex-wrap gap-1.5 pt-1'>
              <Badge variant='outline' className='text-xs font-normal'>
                Área: {families.find(f => f.id === targetFamilyId)?.name ?? targetFamilyId}
              </Badge>
              <Badge variant='outline' className='text-xs font-normal'>
                Tipo: {types.find(t => t.id === targetTypeId)?.name ?? targetTypeId}
              </Badge>
              {assetKind === 'EQUIPMENT' && targetWarehouseId && (
                <Badge variant='outline' className='text-xs font-normal'>
                  Bodega:{' '}
                  {warehouses.find(w => w.id === targetWarehouseId)?.name ?? targetWarehouseId}
                </Badge>
              )}
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
            onClick={handleTransfer}
            disabled={!canConfirm || (impact?.hasActiveAssignment ?? false)}
            className='gap-1.5'
          >
            {submitting ? (
              <Loader2 className='h-3.5 w-3.5 animate-spin' />
            ) : (
              <ArrowRightLeft className='h-3.5 w-3.5' />
            )}
            {submitting ? 'Transfiriendo...' : 'Confirmar transferencia'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
