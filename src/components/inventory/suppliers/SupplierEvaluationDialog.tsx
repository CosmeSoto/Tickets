'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { inventoryToast as toast } from '@/lib/utils/inventory-toast'
import {
  QUALIFICATION_CRITERIA,
  QUALIFICATION_SCORE_LABELS,
  QUALIFICATION_MAX_TOTAL,
  CLASSIFICATION_LABELS,
  computeTotal,
  classifyTotal,
  type SupplierClassification,
} from '@/lib/inventory/supplier-qualification-shared'
import type { SupplierEvaluation } from '@/types/inventory/supplier-evaluation'

const SCORE_OPTIONS = [5, 4, 3, 2, 1, 0]

function classificationBadgeClass(c: SupplierClassification) {
  if (c === 'A')
    return 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400'
  if (c === 'B')
    return 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-400'
  return 'bg-red-100 text-red-800 border-red-300 dark:bg-red-950/40 dark:text-red-400'
}

interface SupplierEvaluationDialogProps {
  supplierId: string
  /** Si se pasa, edita esa evaluación; si no, crea una nueva. */
  evaluation?: SupplierEvaluation | null
  onSuccess: (evaluation: SupplierEvaluation) => void
  onCancel: () => void
}

export function SupplierEvaluationDialog({
  supplierId,
  evaluation,
  onSuccess,
  onCancel,
}: SupplierEvaluationDialogProps) {
  const isEdit = !!evaluation
  const [year, setYear] = useState(String(evaluation?.year ?? new Date().getFullYear()))
  const [detail, setDetail] = useState(evaluation?.detail ?? '')
  const [notes, setNotes] = useState(evaluation?.notes ?? '')
  const [scores, setScores] = useState<Record<string, number>>({
    quality: evaluation?.quality ?? 0,
    creditTime: evaluation?.creditTime ?? 0,
    deliveryTime: evaluation?.deliveryTime ?? 0,
    price: evaluation?.price ?? 0,
    references: evaluation?.references ?? 0,
    equipmentScore: evaluation?.equipmentScore ?? 0,
  })
  const [saving, setSaving] = useState(false)
  const [thresholds, setThresholds] = useState({ minA: 25, minB: 19 })

  useEffect(() => {
    let cancelled = false
    fetch('/api/settings/inventory')
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (cancelled || !data?.settings) return
        setThresholds({
          minA: Number(data.settings.supplier_qualification_min_a) || 25,
          minB: Number(data.settings.supplier_qualification_min_b) || 19,
        })
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const total = useMemo(
    () =>
      computeTotal({
        quality: scores.quality,
        creditTime: scores.creditTime,
        deliveryTime: scores.deliveryTime,
        price: scores.price,
        references: scores.references,
        equipmentScore: scores.equipmentScore,
      }),
    [scores]
  )
  const classification = useMemo(() => classifyTotal(total, thresholds), [total, thresholds])

  const handleSubmit = async () => {
    const yearNum = parseInt(year, 10)
    if (!yearNum || yearNum < 2000 || yearNum > 2100) {
      toast({ title: 'Año inválido', variant: 'destructive' })
      return
    }

    setSaving(true)
    try {
      const url = isEdit
        ? `/api/inventory/suppliers/evaluations/${evaluation!.id}`
        : `/api/inventory/suppliers/${supplierId}/evaluations`
      const res = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year: yearNum,
          detail: detail || null,
          notes: notes || null,
          ...scores,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({
          title: isEdit ? 'No se pudo actualizar' : 'No se pudo registrar',
          description: data.error,
          variant: 'destructive',
        })
        return
      }
      toast({
        title: isEdit ? 'Calificación actualizada' : 'Calificación registrada',
        description: `${data.year} · Clasificación ${data.classification}`,
      })
      onSuccess(data)
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className='space-y-4'>
      <div className='grid grid-cols-2 gap-3'>
        <div className='space-y-1'>
          <Label>
            Año <span className='text-destructive'>*</span>
          </Label>
          <Input
            type='number'
            value={year}
            onChange={e => setYear(e.target.value)}
            min={2000}
            max={2100}
          />
        </div>
        <div className='space-y-1'>
          <Label>Detalle / línea de servicio</Label>
          <Input
            placeholder='Ej. Imprenta y gigantografía'
            value={detail}
            onChange={e => setDetail(e.target.value)}
            maxLength={200}
          />
        </div>
      </div>

      <div className='grid grid-cols-2 gap-3'>
        {QUALIFICATION_CRITERIA.map(criterion => (
          <div key={criterion.key} className='space-y-1'>
            <Label>{criterion.label}</Label>
            <Select
              value={String(scores[criterion.key])}
              onValueChange={v => setScores(prev => ({ ...prev, [criterion.key]: Number(v) }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCORE_OPTIONS.map(n => (
                  <SelectItem key={n} value={String(n)}>
                    {n} — {QUALIFICATION_SCORE_LABELS[n]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>

      <div className='flex items-center justify-between rounded-md border p-3'>
        <div>
          <p className='text-sm font-medium'>
            Total: {total} / {QUALIFICATION_MAX_TOTAL}
          </p>
          <p className='text-xs text-muted-foreground'>Se calcula automáticamente</p>
        </div>
        <Badge variant='outline' className={classificationBadgeClass(classification)}>
          {CLASSIFICATION_LABELS[classification]}
        </Badge>
      </div>

      <div className='space-y-1'>
        <Label>Notas</Label>
        <Textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          maxLength={2000}
          rows={3}
        />
      </div>

      <div className='flex justify-end gap-2 pt-2'>
        <Button type='button' variant='outline' onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
        <Button type='button' onClick={handleSubmit} disabled={saving}>
          {saving && <Loader2 className='h-4 w-4 mr-2 animate-spin' />}
          {isEdit ? 'Guardar cambios' : 'Registrar calificación'}
        </Button>
      </div>
    </div>
  )
}
