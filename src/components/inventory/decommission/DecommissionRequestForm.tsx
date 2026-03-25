'use client'

import { useState, useRef } from 'react'
import { Loader2, Upload, X, ImageIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'

const CONDITION_OPTIONS = [
  { value: 'NEW', label: 'Nuevo' },
  { value: 'LIKE_NEW', label: 'Como Nuevo' },
  { value: 'GOOD', label: 'Bueno' },
  { value: 'FAIR', label: 'Regular' },
  { value: 'POOR', label: 'Malo' },
]

interface DecommissionRequestFormProps {
  assetType: 'EQUIPMENT' | 'LICENSE'
  assetId: string
  assetName: string
  onSuccess?: () => void
  onCancel?: () => void
}

export function DecommissionRequestForm({ assetType, assetId, assetName, onSuccess, onCancel }: DecommissionRequestFormProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [reason, setReason] = useState('')
  const [condition, setCondition] = useState('')
  const [images, setImages] = useState<File[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)

  const validate = () => {
    const e: Record<string, string> = {}
    if (reason.trim().length < 10) e.reason = 'El motivo debe tener al menos 10 caracteres'
    if (assetType === 'EQUIPMENT' && !condition) e.condition = 'La condición es requerida'
    if (assetType === 'EQUIPMENT' && images.length === 0) e.images = 'Se requiere al menos una imagen como evidencia'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleImageAdd = (files: FileList | null) => {
    if (!files) return
    const valid = Array.from(files).filter(f => f.type.startsWith('image/'))
    setImages(prev => [...prev, ...valid].slice(0, 5)) // máx 5 imágenes
    setErrors(prev => ({ ...prev, images: '' }))
  }

  const removeImage = (idx: number) => setImages(prev => prev.filter((_, i) => i !== idx))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('assetType', assetType)
      if (assetType === 'EQUIPMENT') fd.append('equipmentId', assetId)
      else fd.append('licenseId', assetId)
      fd.append('reason', reason.trim())
      if (condition) fd.append('condition', condition)
      images.forEach(img => fd.append('images', img))

      const res = await fetch('/api/inventory/decommission-acts', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Error al crear solicitud')
      toast({ title: 'Solicitud enviada', description: 'El administrador revisará tu solicitud de baja.' })
      onSuccess?.()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-300">
        Estás solicitando la baja de: <strong>{assetName}</strong>. Esta acción requiere aprobación del administrador.
      </div>

      <div>
        <Label htmlFor="reason">Motivo de baja *</Label>
        <Textarea
          id="reason"
          value={reason}
          onChange={e => { setReason(e.target.value); setErrors(p => ({ ...p, reason: '' })) }}
          placeholder="Describe el motivo técnico de la baja (mínimo 10 caracteres)..."
          rows={4}
          className="mt-1"
        />
        {errors.reason && <p className="mt-1 text-xs text-destructive">{errors.reason}</p>}
        <p className="mt-1 text-xs text-muted-foreground">{reason.length} caracteres</p>
      </div>

      {assetType === 'EQUIPMENT' && (
        <div>
          <Label htmlFor="condition">Condición del equipo *</Label>
          <Select value={condition} onValueChange={v => { setCondition(v); setErrors(p => ({ ...p, condition: '' })) }}>
            <SelectTrigger id="condition" className="mt-1">
              <SelectValue placeholder="Seleccionar condición actual" />
            </SelectTrigger>
            <SelectContent>
              {CONDITION_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
          {errors.condition && <p className="mt-1 text-xs text-destructive">{errors.condition}</p>}
        </div>
      )}

      {assetType === 'EQUIPMENT' && (
        <div>
          <Label>Imágenes de evidencia * (máx. 5)</Label>
          <div
            className="mt-1 flex flex-col items-center justify-center rounded-md border-2 border-dashed border-muted-foreground/30 p-6 cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); handleImageAdd(e.dataTransfer.files) }}
          >
            <Upload className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Arrastra imágenes aquí o haz clic para seleccionar</p>
            <p className="text-xs text-muted-foreground mt-1">JPG, PNG, WebP — máx. 5 imágenes</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={e => handleImageAdd(e.target.files)}
          />
          {errors.images && <p className="mt-1 text-xs text-destructive">{errors.images}</p>}

          {images.length > 0 && (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {images.map((img, i) => (
                <div key={i} className="relative group rounded-md overflow-hidden border bg-muted aspect-square">
                  <img
                    src={URL.createObjectURL(img)}
                    alt={img.name}
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    className="absolute top-1 right-1 rounded-full bg-black/60 p-0.5 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3" />
                  </button>
                  <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-1 py-0.5">
                    <p className="text-white text-xs truncate">{img.name}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>Cancelar</Button>
        )}
        <Button type="submit" variant="destructive" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Enviar solicitud de baja
        </Button>
      </div>
    </form>
  )
}
