/**
 * Formulario de creación de solicitud de activo
 * Validación Zod en cliente, búsqueda debounced de activos del catálogo
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { CheckCircle, RefreshCw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useDebounce } from '@/hooks/common/use-debounce'
import { useToast } from '@/hooks/use-toast'
import { createAssetRequestSchema } from '@/lib/validations/inventory/asset-request'
import { ASSET_TYPE_LABELS } from '@/lib/utils/asset-request-utils'
import { AssetType } from '@prisma/client'
import { z } from 'zod'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Family {
  id: string
  code: string
  name: string
  color?: string | null
}

interface Asset {
  id: string
  name: string
  code: string
  subtype: string
}

interface AssetRequestCreateFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (id: string, code: string) => void
  defaultFamilyId?: string
}

type FormData = z.infer<typeof createAssetRequestSchema>

// ── Component ──────────────────────────────────────────────────────────────────

export function AssetRequestCreateForm({
  open,
  onOpenChange,
  onSuccess,
  defaultFamilyId,
}: AssetRequestCreateFormProps) {
  const { toast } = useToast()

  // ── State ──────────────────────────────────────────────────────────────────

  const [submitting, setSubmitting] = useState(false)
  const [loadingFamilies, setLoadingFamilies] = useState(false)
  const [loadingAssets, setLoadingAssets] = useState(false)

  const [families, setFamilies] = useState<Family[]>([])
  const [assets, setAssets] = useState<Asset[]>([])

  const [formData, setFormData] = useState<FormData>({
    assetType: 'EQUIPMENT',
    description: '',
    familyId: defaultFamilyId || '',
    justification: '',
    assetId: undefined,
    quantity: 1,
    neededBy: undefined,
  })

  const [assetSearch, setAssetSearch] = useState('')
  const debouncedAssetSearch = useDebounce(assetSearch, 300)

  const [errors, setErrors] = useState<Record<string, string>>({})

  // Estado para stock disponible
  const [availableStock, setAvailableStock] = useState<number | null>(null)
  const [loadingStock, setLoadingStock] = useState(false)

  // ── Load families ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!open) return

    const loadFamilies = async () => {
      setLoadingFamilies(true)
      try {
        const res = await fetch('/api/families?active=true')
        if (res.ok) {
          const data = await res.json()
          const familyList = data.data || data || []
          setFamilies(familyList.filter((f: Family) => f))
        }
      } catch (err) {
        toast({
          title: 'Error',
          description: 'No se pudieron cargar las familias',
          variant: 'destructive',
        })
      } finally {
        setLoadingFamilies(false)
      }
    }

    loadFamilies()
  }, [open, toast])

  // ── Load assets (debounced search) ─────────────────────────────────────────

  useEffect(() => {
    if (!debouncedAssetSearch || debouncedAssetSearch.length < 2) {
      setAssets([])
      return
    }

    const loadAssets = async () => {
      setLoadingAssets(true)
      try {
        const params = new URLSearchParams({
          search: debouncedAssetSearch,
          limit: '20',
        })

        if (formData.familyId) {
          params.append('familyId', formData.familyId)
        }

        const res = await fetch(`/api/inventory/assets?${params.toString()}`)
        if (res.ok) {
          const data = await res.json()
          setAssets(data.data || data.assets || [])
        }
      } catch (err) {
        // Silently fail asset search
      } finally {
        setLoadingAssets(false)
      }
    }

    loadAssets()
  }, [debouncedAssetSearch, formData.familyId])

  // ── Load available stock when assetId and quantity change ─────────────────

  useEffect(() => {
    // Solo cargar stock si es EQUIPMENT y hay assetId seleccionado
    if (formData.assetType !== 'EQUIPMENT' || !formData.assetId) {
      setAvailableStock(null)
      return
    }

    const loadStock = async () => {
      setLoadingStock(true)
      try {
        const res = await fetch(
          `/api/inventory/equipment/stock/available?typeId=${formData.assetId}`
        )
        if (res.ok) {
          const data = await res.json()
          setAvailableStock(data.available || 0)
        }
      } catch (err) {
        // Silently fail stock check
        setAvailableStock(null)
      } finally {
        setLoadingStock(false)
      }
    }

    loadStock()
  }, [formData.assetId, formData.assetType])

  // ── Validation ─────────────────────────────────────────────────────────────

  const validateForm = useCallback((): boolean => {
    try {
      createAssetRequestSchema.parse(formData)

      // Validación adicional de stock disponible
      if (
        formData.assetType === 'EQUIPMENT' &&
        formData.assetId &&
        availableStock !== null &&
        formData.quantity > availableStock
      ) {
        setErrors({
          quantity: `Solo hay ${availableStock} unidades disponibles. No puedes solicitar ${formData.quantity} unidades.`,
        })
        return false
      }

      setErrors({})
      return true
    } catch (err) {
      if (err instanceof z.ZodError) {
        const newErrors: Record<string, string> = {}
        err.errors.forEach(error => {
          const path = error.path.join('.')
          newErrors[path] = error.message
        })
        setErrors(newErrors)
      }
      return false
    }
  }, [formData, availableStock])

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      toast({
        title: 'Datos inválidos',
        description: 'Por favor corrige los errores en el formulario',
        variant: 'destructive',
      })
      return
    }

    setSubmitting(true)

    try {
      const res = await fetch('/api/inventory/asset-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || 'Error al crear solicitud')
      }

      const result = await res.json()

      toast({
        title: 'Solicitud creada',
        description: `Solicitud ${result.code} creada exitosamente`,
      })

      onSuccess(result.id, result.code)
      handleClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido'
      toast({
        title: 'Error al crear solicitud',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleClose = () => {
    setFormData({
      assetType: 'EQUIPMENT',
      description: '',
      familyId: defaultFamilyId || '',
      justification: '',
      assetId: undefined,
      quantity: 1,
      neededBy: undefined,
    })
    setAssetSearch('')
    setAssets([])
    setErrors({})
    onOpenChange(false)
  }

  const setField = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setFormData(prev => ({ ...prev, [key]: value }))
    // Clear error for this field
    if (errors[key]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[key]
        return newErrors
      })
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className='max-w-2xl max-h-[90vh] overflow-y-auto'
        aria-describedby={undefined}
      >
        <DialogHeader>
          <DialogTitle>Nueva Solicitud de Activo</DialogTitle>
          <DialogDescription>
            Completa el formulario para solicitar un activo. Los campos marcados con * son
            obligatorios.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className='space-y-4 py-4'>
            {/* Tipo de activo */}
            <div className='space-y-2'>
              <Label htmlFor='assetType'>Tipo de Activo *</Label>
              <Select
                value={formData.assetType}
                onValueChange={v => setField('assetType', v as AssetType)}
                disabled={submitting}
              >
                <SelectTrigger id='assetType'>
                  <SelectValue placeholder='Selecciona un tipo' />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ASSET_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.assetType && <p className='text-xs text-destructive'>{errors.assetType}</p>}
            </div>

            {/* Familia */}
            <div className='space-y-2'>
              <Label htmlFor='familyId'>Familia *</Label>
              <Select
                value={formData.familyId}
                onValueChange={v => setField('familyId', v)}
                disabled={submitting || loadingFamilies}
              >
                <SelectTrigger id='familyId'>
                  <SelectValue placeholder='Selecciona una familia' />
                </SelectTrigger>
                <SelectContent>
                  {families.map(family => (
                    <SelectItem key={family.id} value={family.id}>
                      <div className='flex items-center gap-2'>
                        {family.color && (
                          <span
                            className='w-3 h-3 rounded-full'
                            style={{ backgroundColor: family.color }}
                          />
                        )}
                        <span>
                          {family.code} - {family.name}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.familyId && <p className='text-xs text-destructive'>{errors.familyId}</p>}
            </div>

            {/* Descripción */}
            <div className='space-y-2'>
              <Label htmlFor='description'>Descripción *</Label>
              <Textarea
                id='description'
                value={formData.description}
                onChange={e => setField('description', e.target.value)}
                placeholder='Describe el activo que necesitas (mínimo 10 caracteres)'
                rows={3}
                disabled={submitting}
              />
              <p className='text-xs text-muted-foreground'>
                {formData.description.length} / 10 caracteres mínimo
              </p>
              {errors.description && (
                <p className='text-xs text-destructive'>{errors.description}</p>
              )}
            </div>

            {/* Justificación */}
            <div className='space-y-2'>
              <Label htmlFor='justification'>Justificación *</Label>
              <Textarea
                id='justification'
                value={formData.justification}
                onChange={e => setField('justification', e.target.value)}
                placeholder='Explica por qué necesitas este activo (mínimo 10 caracteres)'
                rows={3}
                disabled={submitting}
              />
              <p className='text-xs text-muted-foreground'>
                {formData.justification.length} / 10 caracteres mínimo
              </p>
              {errors.justification && (
                <p className='text-xs text-destructive'>{errors.justification}</p>
              )}
            </div>

            {/* Activo del catálogo (opcional) */}
            <div className='space-y-2'>
              <Label htmlFor='assetSearch'>Activo del Catálogo (opcional)</Label>
              <div className='space-y-2'>
                <Input
                  id='assetSearch'
                  value={assetSearch}
                  onChange={e => setAssetSearch(e.target.value)}
                  placeholder='Buscar activo por nombre o código...'
                  disabled={submitting || !formData.familyId}
                />
                {loadingAssets && (
                  <p className='text-xs text-muted-foreground'>Buscando activos...</p>
                )}
                {assets.length > 0 && (
                  <div className='border rounded-md max-h-40 overflow-y-auto'>
                    {assets.map(asset => (
                      <button
                        key={asset.id}
                        type='button'
                        onClick={() => {
                          setField('assetId', asset.id)
                          setAssetSearch(`${asset.code} - ${asset.name}`)
                          setAssets([])
                        }}
                        className='w-full text-left px-3 py-2 hover:bg-muted transition-colors text-sm'
                        disabled={submitting}
                      >
                        <div className='font-medium'>{asset.code}</div>
                        <div className='text-xs text-muted-foreground'>{asset.name}</div>
                      </button>
                    ))}
                  </div>
                )}
                {formData.assetId && (
                  <Button
                    type='button'
                    variant='ghost'
                    size='sm'
                    onClick={() => {
                      setField('assetId', undefined)
                      setAssetSearch('')
                    }}
                    disabled={submitting}
                  >
                    <X className='h-4 w-4 mr-1' />
                    Limpiar selección
                  </Button>
                )}
              </div>
              <p className='text-xs text-muted-foreground'>
                Si el activo ya existe en el catálogo, puedes seleccionarlo aquí
              </p>
            </div>

            {/* Cantidad */}
            <div className='space-y-2'>
              <Label htmlFor='quantity'>Cantidad</Label>
              <Input
                id='quantity'
                type='number'
                min={1}
                max={100}
                value={formData.quantity || 1}
                onChange={e => setField('quantity', parseInt(e.target.value) || 1)}
                disabled={submitting}
              />
              <p className='text-xs text-muted-foreground'>
                Si necesitas más de una unidad del mismo tipo, especifica la cantidad aquí (máximo
                100)
              </p>

              {/* Indicador de stock disponible */}
              {formData.assetType === 'EQUIPMENT' && formData.assetId && (
                <div className='mt-2'>
                  {loadingStock ? (
                    <p className='text-xs text-muted-foreground'>Consultando disponibilidad...</p>
                  ) : availableStock !== null ? (
                    <div
                      className={`text-xs font-medium ${
                        availableStock >= (formData.quantity || 1)
                          ? 'text-green-600'
                          : 'text-red-600'
                      }`}
                    >
                      {availableStock > 0
                        ? `✓ ${availableStock} unidades disponibles`
                        : '✗ No hay unidades disponibles'}
                    </div>
                  ) : null}
                </div>
              )}

              {errors.quantity && <p className='text-xs text-destructive'>{errors.quantity}</p>}
            </div>

            {/* Fecha estimada */}
            <div className='space-y-2'>
              <Label htmlFor='neededBy'>Fecha Estimada de Necesidad (opcional)</Label>
              <Input
                id='neededBy'
                type='date'
                value={formData.neededBy || ''}
                onChange={e => setField('neededBy', e.target.value || undefined)}
                disabled={submitting}
                min={new Date().toISOString().split('T')[0]}
              />
              <p className='text-xs text-muted-foreground'>
                Indica cuándo necesitas el activo (si aplica)
              </p>
              {errors.neededBy && <p className='text-xs text-destructive'>{errors.neededBy}</p>}
            </div>
          </div>

          <DialogFooter>
            <Button type='button' variant='outline' onClick={handleClose} disabled={submitting}>
              Cancelar
            </Button>
            <Button type='submit' disabled={submitting}>
              {submitting ? (
                <>
                  <RefreshCw className='h-4 w-4 mr-2 animate-spin' />
                  Creando...
                </>
              ) : (
                <>
                  <CheckCircle className='h-4 w-4 mr-2' />
                  Crear Solicitud
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
