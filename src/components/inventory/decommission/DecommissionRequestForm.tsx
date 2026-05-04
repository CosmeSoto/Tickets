'use client'

import { useState, useRef } from 'react'
import { Loader2, Upload, X, AlertTriangle, Package, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'

const CONDITION_OPTIONS = [
  { value: 'NEW', label: 'Nuevo' },
  { value: 'LIKE_NEW', label: 'Como Nuevo' },
  { value: 'GOOD', label: 'Bueno' },
  { value: 'FAIR', label: 'Regular' },
  { value: 'POOR', label: 'Malo' },
]

// Motivos predefinidos según tipo de adquisición
const FIXED_ASSET_REASONS = [
  'Obsolescencia tecnológica — el equipo ya no cumple los requisitos mínimos de operación',
  'Daño irreparable — el costo de reparación supera el valor residual del activo',
  'Robo o pérdida confirmada — con denuncia policial adjunta',
  'Fin de vida útil — el equipo ha cumplido su vida útil estimada',
  'Venta o transferencia — el activo fue vendido o transferido a terceros',
]

const RENTAL_REASONS = [
  'Fin de contrato de arrendamiento — devolución al proveedor al vencimiento',
  'Rescisión anticipada del contrato — devolución por acuerdo con el proveedor',
  'Sustitución por equipo más moderno — devolución y reemplazo',
  'Reducción de flota — devolución por ajuste de necesidades operativas',
]

const LOAN_REASONS = [
  'Fin del período de préstamo — devolución al propietario',
  'Solicitud de devolución por el propietario',
  'Sustitución por activo propio — devolución del bien prestado',
]

export type AcquisitionMode = 'FIXED_ASSET' | 'RENTAL' | 'LOAN'

interface DecommissionRequestFormProps {
  assetType: 'EQUIPMENT' | 'LICENSE'
  assetId: string
  assetName: string
  /** Modo de adquisición del equipo — determina el flujo del formulario */
  acquisitionMode?: AcquisitionMode
  onSuccess?: () => void
  onCancel?: () => void
}

export function DecommissionRequestForm({
  assetType,
  assetId,
  assetName,
  acquisitionMode = 'FIXED_ASSET',
  onSuccess,
  onCancel,
}: DecommissionRequestFormProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [reason, setReason] = useState('')
  const [condition, setCondition] = useState('')
  const [images, setImages] = useState<File[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Campos específicos para devolución (RENTAL / LOAN)
  const [returnDate, setReturnDate] = useState(() => new Date().toISOString().split('T')[0])
  const [returnConfirmed, setReturnConfirmed] = useState(false)
  const [returnNotes, setReturnNotes] = useState('')

  const fileInputRef = useRef<HTMLInputElement>(null)

  const isReturn = acquisitionMode === 'RENTAL' || acquisitionMode === 'LOAN'
  const isRental = acquisitionMode === 'RENTAL'
  const isLoan = acquisitionMode === 'LOAN'

  const predefinedReasons = isRental ? RENTAL_REASONS : isLoan ? LOAN_REASONS : FIXED_ASSET_REASONS

  const validate = () => {
    const e: Record<string, string> = {}
    if (reason.trim().length < 10) e.reason = 'El motivo debe tener al menos 10 caracteres'
    if (assetType === 'EQUIPMENT' && !condition) e.condition = 'La condición es requerida'
    if (!isReturn && assetType === 'EQUIPMENT' && images.length === 0) {
      e.images = 'Se requiere al menos una imagen como evidencia'
    }
    if (isReturn && !returnDate) e.returnDate = 'La fecha de devolución es requerida'
    if (isReturn && !returnConfirmed) {
      e.returnConfirmed = isRental
        ? 'Debes confirmar que el equipo fue devuelto al proveedor'
        : 'Debes confirmar que el equipo fue devuelto al propietario'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleImageAdd = (files: FileList | null) => {
    if (!files) return
    const valid = Array.from(files).filter(f => f.type.startsWith('image/'))
    setImages(prev => [...prev, ...valid].slice(0, 5))
    setErrors(prev => ({ ...prev, images: '' }))
  }

  const removeImage = (idx: number) => setImages(prev => prev.filter((_, i) => i !== idx))

  const handleSelectReason = (r: string) => {
    setReason(r)
    setErrors(prev => ({ ...prev, reason: '' }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('assetType', assetType)
      if (assetType === 'EQUIPMENT') fd.append('equipmentId', assetId)
      else fd.append('licenseId', assetId)

      // Para devoluciones, enriquecer el motivo con los datos de devolución
      const fullReason = isReturn
        ? `[DEVOLUCIÓN ${isRental ? 'ARRENDAMIENTO' : 'PRÉSTAMO'}] ${reason.trim()}${returnNotes ? ` — Notas: ${returnNotes.trim()}` : ''} — Fecha de devolución: ${returnDate}`
        : reason.trim()

      fd.append('reason', fullReason)
      if (condition) fd.append('condition', condition)
      images.forEach(img => fd.append('images', img))

      const res = await fetch('/api/inventory/decommission-acts', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Error al crear solicitud')

      toast({
        title: isReturn ? 'Devolución registrada' : 'Solicitud enviada',
        description: isReturn
          ? 'La devolución ha sido registrada. El administrador confirmará el cierre.'
          : 'El administrador revisará tu solicitud de baja.',
      })
      onSuccess?.()
    } catch (err: unknown) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Error desconocido',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className='space-y-5'>
      {/* Banner contextual según tipo de adquisición */}
      {isReturn ? (
        <div className='rounded-md bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-800 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300 flex gap-2'>
          <RotateCcw className='h-4 w-4 mt-0.5 shrink-0' />
          <div>
            <p className='font-medium'>
              {isRental ? 'Devolución de equipo arrendado' : 'Devolución de activo de tercero'}
            </p>
            <p className='mt-0.5 text-xs opacity-80'>
              {isRental
                ? `Este equipo es propiedad del proveedor. Al confirmar la devolución, se iniciará el proceso de baja del arrendamiento para "${assetName}".`
                : `Este equipo es propiedad de un tercero. Al confirmar la devolución, se registrará el cierre del préstamo para "${assetName}".`}
            </p>
          </div>
        </div>
      ) : (
        <div className='rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-300 flex gap-2'>
          <AlertTriangle className='h-4 w-4 mt-0.5 shrink-0' />
          <div>
            <p className='font-medium'>Solicitud de baja de activo propio</p>
            <p className='mt-0.5 text-xs opacity-80'>
              Estás solicitando la baja de <strong>{assetName}</strong>. Esta acción requiere
              aprobación del administrador y es irreversible.
            </p>
          </div>
        </div>
      )}

      {/* Motivo — con sugerencias predefinidas */}
      <div className='space-y-2'>
        <Label htmlFor='reason'>
          {isReturn ? 'Motivo de la devolución' : 'Motivo de baja'}{' '}
          <span className='text-destructive'>*</span>
        </Label>
        {predefinedReasons.length > 0 && (
          <div className='flex flex-wrap gap-1.5'>
            {predefinedReasons.map(r => (
              <button
                key={r}
                type='button'
                onClick={() => handleSelectReason(r)}
                className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                  reason === r
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-muted border-border hover:border-primary/50 hover:bg-muted/80'
                }`}
              >
                {r.split(' — ')[0]}
              </button>
            ))}
          </div>
        )}
        <Textarea
          id='reason'
          value={reason}
          onChange={e => {
            setReason(e.target.value)
            setErrors(p => ({ ...p, reason: '' }))
          }}
          placeholder={
            isReturn
              ? 'Describe el motivo de la devolución...'
              : 'Describe el motivo técnico de la baja (mínimo 10 caracteres)...'
          }
          rows={3}
        />
        {errors.reason && <p className='text-xs text-destructive'>{errors.reason}</p>}
        <p className='text-xs text-muted-foreground'>{reason.length} caracteres</p>
      </div>

      {/* Condición del equipo */}
      {assetType === 'EQUIPMENT' && (
        <div className='space-y-1'>
          <Label htmlFor='condition'>
            Condición actual del equipo <span className='text-destructive'>*</span>
          </Label>
          <Select
            value={condition}
            onValueChange={v => {
              setCondition(v)
              setErrors(p => ({ ...p, condition: '' }))
            }}
          >
            <SelectTrigger id='condition'>
              <SelectValue placeholder='Seleccionar condición' />
            </SelectTrigger>
            <SelectContent>
              {CONDITION_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.condition && <p className='text-xs text-destructive'>{errors.condition}</p>}
        </div>
      )}

      {/* ── Campos específicos para DEVOLUCIÓN (RENTAL / LOAN) ── */}
      {isReturn && (
        <div className='rounded-lg border border-blue-200 bg-blue-50/50 dark:bg-blue-950/10 dark:border-blue-800 p-4 space-y-3'>
          <p className='text-sm font-medium text-blue-800 dark:text-blue-300 flex items-center gap-1.5'>
            <Package className='h-4 w-4' />
            Datos de la devolución
          </p>

          <div className='space-y-1'>
            <Label htmlFor='returnDate'>
              Fecha de devolución <span className='text-destructive'>*</span>
            </Label>
            <Input
              id='returnDate'
              type='date'
              value={returnDate}
              onChange={e => {
                setReturnDate(e.target.value)
                setErrors(p => ({ ...p, returnDate: '' }))
              }}
            />
            {errors.returnDate && <p className='text-xs text-destructive'>{errors.returnDate}</p>}
          </div>

          <div className='space-y-1'>
            <Label htmlFor='returnNotes'>Notas adicionales de la devolución</Label>
            <Textarea
              id='returnNotes'
              value={returnNotes}
              onChange={e => setReturnNotes(e.target.value)}
              rows={2}
              placeholder={
                isRental
                  ? 'Ej: Entregado en oficina del proveedor, recibido por Juan Pérez...'
                  : 'Ej: Devuelto en perfectas condiciones, firmado acta de recepción...'
              }
            />
          </div>

          {/* Confirmación explícita */}
          <label
            className={`flex items-start gap-2.5 cursor-pointer rounded-md border p-3 transition-colors ${
              returnConfirmed
                ? 'border-blue-400 bg-blue-100 dark:bg-blue-900/30'
                : 'border-border bg-background hover:border-blue-300'
            }`}
          >
            <input
              type='checkbox'
              checked={returnConfirmed}
              onChange={e => {
                setReturnConfirmed(e.target.checked)
                setErrors(p => ({ ...p, returnConfirmed: '' }))
              }}
              className='mt-0.5 h-4 w-4 accent-blue-600'
            />
            <span className='text-sm'>
              {isRental
                ? 'Confirmo que el equipo fue físicamente devuelto al proveedor arrendador y se cuenta con evidencia de recepción.'
                : 'Confirmo que el equipo fue físicamente devuelto al propietario y se cuenta con evidencia de recepción.'}
            </span>
          </label>
          {errors.returnConfirmed && (
            <p className='text-xs text-destructive'>{errors.returnConfirmed}</p>
          )}
        </div>
      )}

      {/* ── Imágenes de evidencia ── */}
      <div className='space-y-2'>
        <Label>
          Imágenes de evidencia{' '}
          {!isReturn && assetType === 'EQUIPMENT' && <span className='text-destructive'>*</span>}
          {isReturn && (
            <span className='text-xs font-normal text-muted-foreground'>(opcional)</span>
          )}
          <span className='text-xs font-normal text-muted-foreground ml-1'>máx. 5</span>
        </Label>
        <div
          className='flex flex-col items-center justify-center rounded-md border-2 border-dashed border-muted-foreground/30 p-5 cursor-pointer hover:border-primary/50 transition-colors'
          onClick={() => fileInputRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => {
            e.preventDefault()
            handleImageAdd(e.dataTransfer.files)
          }}
        >
          <Upload className='h-7 w-7 text-muted-foreground mb-1.5' />
          <p className='text-sm text-muted-foreground'>
            Arrastra imágenes aquí o haz clic para seleccionar
          </p>
          <p className='text-xs text-muted-foreground mt-0.5'>JPG, PNG, WebP</p>
        </div>
        <input
          ref={fileInputRef}
          type='file'
          accept='image/*'
          multiple
          className='hidden'
          onChange={e => handleImageAdd(e.target.files)}
        />
        {errors.images && <p className='text-xs text-destructive'>{errors.images}</p>}

        {images.length > 0 && (
          <div className='grid grid-cols-3 gap-2 mt-2'>
            {images.map((img, i) => (
              <div
                key={i}
                className='relative group rounded-md overflow-hidden border bg-muted aspect-square'
              >
                <img
                  src={URL.createObjectURL(img)}
                  alt={img.name}
                  className='w-full h-full object-cover'
                />
                <button
                  type='button'
                  onClick={() => removeImage(i)}
                  className='absolute top-1 right-1 rounded-full bg-black/60 p-0.5 text-white opacity-0 group-hover:opacity-100 transition-opacity'
                >
                  <X className='h-3 w-3' />
                </button>
                <div className='absolute bottom-0 left-0 right-0 bg-black/50 px-1 py-0.5'>
                  <p className='text-white text-xs truncate'>{img.name}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className='flex justify-end gap-2 pt-1'>
        {onCancel && (
          <Button type='button' variant='outline' onClick={onCancel} disabled={loading}>
            Cancelar
          </Button>
        )}
        <Button type='submit' variant={isReturn ? 'default' : 'destructive'} disabled={loading}>
          {loading && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
          {isReturn
            ? isRental
              ? 'Registrar devolución al proveedor'
              : 'Registrar devolución al propietario'
            : 'Enviar solicitud de baja'}
        </Button>
      </div>
    </form>
  )
}
