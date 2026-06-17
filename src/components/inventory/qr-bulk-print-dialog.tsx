'use client'

/**
 * QRBulkPrintDialog
 *
 * Diálogo para impresión masiva de QRs de equipos seleccionados en el listado.
 * Fetcha los QRs de cada equipo y delega la impresión a printBulkQR.
 */

import { useState, useEffect, useRef } from 'react'
import { Printer, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { printBulkQR } from '@/components/common/qr/qr-bulk-print'
import type { PrintFormat } from '@/components/common/qr/qr-print-dialog'
import type { UnifiedAsset } from '@/types/inventory/unified-asset'

interface QRBulkPrintDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedIds: Set<string>
  assets: UnifiedAsset[]
}

const FORMAT_OPTIONS: { value: PrintFormat; label: string; description: string }[] = [
  { value: '57x40', label: '57 × 40 mm', description: 'Rollo estándar (GA-2408T y similares)' },
  { value: '58x40', label: '58 × 40 mm', description: 'Rollo alternativo (otras etiquetadoras)' },
  { value: 'A4', label: 'A4', description: 'Impresora de oficina — 4 por página' },
  { value: 'Letter', label: 'Letter', description: 'Impresora de oficina — 4 por página' },
]

const STORAGE_KEY = 'qr_print_format'

export function QRBulkPrintDialog({
  open,
  onOpenChange,
  selectedIds,
  assets,
}: QRBulkPrintDialogProps) {
  const [format, setFormat] = useState<PrintFormat>('57x40')
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const loadedRef = useRef(false)

  // Cargar preferencia guardada una sola vez
  useEffect(() => {
    if (loadedRef.current) return
    loadedRef.current = true
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as PrintFormat | null
      if (saved && FORMAT_OPTIONS.some(f => f.value === saved)) setFormat(saved)
    } catch {
      /* silencioso */
    }
  }, [])

  const handleFormatChange = (value: PrintFormat) => {
    setFormat(value)
    try {
      localStorage.setItem(STORAGE_KEY, value)
    } catch {
      /* silencioso */
    }
  }

  const selectedEquipment = assets.filter(a => a.subtype === 'EQUIPMENT' && selectedIds.has(a.id))

  const handlePrint = async () => {
    if (!selectedEquipment.length) return
    setLoading(true)
    setProgress(0)

    try {
      const items = []
      for (let i = 0; i < selectedEquipment.length; i++) {
        const asset = selectedEquipment[i]
        try {
          const res = await fetch(`/api/inventory/equipment/${asset.id}/qr`)
          if (res.ok) {
            const data = await res.json()
            if (data.qrCode) {
              items.push({
                qrSrc: data.qrCode,
                label: asset.code ?? asset.id.slice(0, 8),
                sublabel: asset.name,
              })
            }
          }
        } catch {
          // Si falla uno, continuar con los demás
        }
        setProgress(i + 1)
      }

      if (items.length > 0) {
        printBulkQR(items, format)
        onOpenChange(false)
      }
    } finally {
      setLoading(false)
      setProgress(0)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-sm'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <Printer className='h-4 w-4' />
            Imprimir {selectedEquipment.length} QR{selectedEquipment.length > 1 ? 's' : ''}
          </DialogTitle>
          <DialogDescription>
            Selecciona el formato según el papel o rollo de tu impresora.
          </DialogDescription>
        </DialogHeader>

        {/* Lista de equipos seleccionados */}
        <div className='max-h-32 overflow-y-auto rounded-md border border-border bg-muted/30 px-3 py-2 space-y-1'>
          {selectedEquipment.map(a => (
            <p key={a.id} className='text-xs text-muted-foreground truncate'>
              <span className='font-mono font-medium text-foreground'>
                {a.code ?? a.id.slice(0, 8)}
              </span>
              {' — '}
              {a.name}
            </p>
          ))}
        </div>

        {/* Selector de formato */}
        <div className='space-y-2'>
          <Label className='text-sm'>Formato de impresión</Label>
          <div className='grid grid-cols-2 gap-2'>
            {FORMAT_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type='button'
                onClick={() => handleFormatChange(opt.value)}
                className={`text-left p-2.5 rounded-lg border text-sm transition-colors ${
                  format === opt.value
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border hover:border-muted-foreground/50'
                }`}
              >
                <div className='font-medium'>{opt.label}</div>
                <div className='text-xs text-muted-foreground mt-0.5'>{opt.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Progreso */}
        {loading && (
          <p className='text-xs text-muted-foreground text-center'>
            Generando QR {progress} de {selectedEquipment.length}…
          </p>
        )}

        <DialogFooter className='gap-2 sm:gap-0'>
          <Button variant='outline' onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handlePrint} disabled={loading} className='gap-2'>
            {loading ? (
              <Loader2 className='h-4 w-4 animate-spin' />
            ) : (
              <Printer className='h-4 w-4' />
            )}
            {loading ? 'Preparando…' : 'Imprimir'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
