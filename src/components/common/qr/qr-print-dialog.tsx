'use client'

/**
 * QRPrintDialog
 *
 * Diálogo reutilizable para imprimir un único código QR.
 * Compatible con cualquier impresora instalada en el sistema:
 *   - Impresoras de etiquetas en rollo (GA-2408T, TSC, Zebra, etc.)
 *   - Impresoras de oficina A4 / Letter
 *
 * El usuario selecciona el formato de página antes de imprimir.
 * La preferencia se persiste en localStorage.
 */

import { useEffect, useRef, useState } from 'react'
import { Printer, Download } from 'lucide-react'
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

// ── Tipos ────────────────────────────────────────────────────────────────────

export type PrintFormat = '57x40' | '58x40' | 'A4' | 'Letter'

export interface QRPrintItem {
  /** Imagen QR: data URL base64 o URL de imagen */
  qrSrc: string
  /** Texto principal bajo el QR (código del activo / nombre del checkpoint) */
  label: string
  /** Texto secundario opcional (ej: nombre del equipo, ubicación) */
  sublabel?: string
}

interface QRPrintDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: QRPrintItem | null
}

// ── Constantes ───────────────────────────────────────────────────────────────

const FORMAT_OPTIONS: { value: PrintFormat; label: string; description: string }[] = [
  { value: '57x40', label: '57 × 40 mm', description: 'Rollo estándar (GA-2408T y similares)' },
  { value: '58x40', label: '58 × 40 mm', description: 'Rollo alternativo (otras etiquetadoras)' },
  { value: 'A4', label: 'A4', description: 'Impresora de oficina — centrado en página' },
  { value: 'Letter', label: 'Letter', description: 'Impresora de oficina — tamaño carta' },
]

const STORAGE_KEY = 'qr_print_format'

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildPrintCSS(format: PrintFormat): string {
  if (format === '57x40') {
    return `
      @page { size: 57mm 40mm; margin: 1mm; }
      body { margin: 0; display: flex; align-items: center; justify-content: center; width: 57mm; height: 40mm; }
      .label-wrap { display: flex; flex-direction: column; align-items: center; gap: 1mm; width: 100%; }
      .qr-img { width: 30mm; height: 30mm; }
      .label-text { font-size: 6pt; font-weight: 600; font-family: monospace; text-align: center; max-width: 54mm; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
      .sublabel-text { font-size: 5pt; font-family: sans-serif; color: #555; text-align: center; max-width: 54mm; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
    `
  }
  if (format === '58x40') {
    return `
      @page { size: 58mm 40mm; margin: 1mm; }
      body { margin: 0; display: flex; align-items: center; justify-content: center; width: 58mm; height: 40mm; }
      .label-wrap { display: flex; flex-direction: column; align-items: center; gap: 1mm; width: 100%; }
      .qr-img { width: 31mm; height: 31mm; }
      .label-text { font-size: 6pt; font-weight: 600; font-family: monospace; text-align: center; max-width: 55mm; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
      .sublabel-text { font-size: 5pt; font-family: sans-serif; color: #555; text-align: center; max-width: 55mm; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
    `
  }
  if (format === 'Letter') {
    return `
      @page { size: letter; margin: 10mm; }
      body { margin: 0; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
      .label-wrap { display: flex; flex-direction: column; align-items: center; gap: 3mm; }
      .qr-img { width: 60mm; height: 60mm; }
      .label-text { font-size: 10pt; font-weight: 600; font-family: monospace; text-align: center; }
      .sublabel-text { font-size: 8pt; font-family: sans-serif; color: #555; text-align: center; }
    `
  }
  // A4 default
  return `
    @page { size: A4; margin: 10mm; }
    body { margin: 0; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .label-wrap { display: flex; flex-direction: column; align-items: center; gap: 3mm; }
    .qr-img { width: 60mm; height: 60mm; }
    .label-text { font-size: 10pt; font-weight: 600; font-family: monospace; text-align: center; }
    .sublabel-text { font-size: 8pt; font-family: sans-serif; color: #555; text-align: center; }
  `
}

function openPrintWindow(item: QRPrintItem, format: PrintFormat) {
  const win = window.open('', '_blank', 'width=600,height=400')
  if (!win) return

  const sublabelHtml = item.sublabel ? `<div class="sublabel-text">${item.sublabel}</div>` : ''

  win.document.write(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>QR - ${item.label}</title>
  <style>
    * { box-sizing: border-box; }
    ${buildPrintCSS(format)}
  </style>
</head>
<body>
  <div class="label-wrap">
    <img class="qr-img" src="${item.qrSrc}" alt="QR ${item.label}" />
    <div class="label-text">${item.label}</div>
    ${sublabelHtml}
  </div>
  <script>
    window.onload = function() {
      window.print();
      setTimeout(function() { window.close(); }, 500);
    };
  <\/script>
</body>
</html>`)
  win.document.close()
}

// ── Componente ───────────────────────────────────────────────────────────────

export function QRPrintDialog({ open, onOpenChange, item }: QRPrintDialogProps) {
  const [format, setFormat] = useState<PrintFormat>('57x40')
  const loadedRef = useRef(false)

  // Cargar preferencia guardada una sola vez
  useEffect(() => {
    if (loadedRef.current) return
    loadedRef.current = true
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as PrintFormat | null
      if (saved && FORMAT_OPTIONS.some(f => f.value === saved)) {
        setFormat(saved)
      }
    } catch {
      // localStorage no disponible — usamos default
    }
  }, [])

  const handleFormatChange = (value: PrintFormat) => {
    setFormat(value)
    try {
      localStorage.setItem(STORAGE_KEY, value)
    } catch {
      // silencioso
    }
  }

  const handlePrint = () => {
    if (!item) return
    openPrintWindow(item, format)
    onOpenChange(false)
  }

  if (!item) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-sm'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <Printer className='h-4 w-4' />
            Imprimir código QR
          </DialogTitle>
          <DialogDescription>
            Selecciona el formato según el papel o rollo de tu impresora.
          </DialogDescription>
        </DialogHeader>

        {/* Preview del QR */}
        <div className='flex flex-col items-center gap-2 py-2'>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.qrSrc} alt='QR preview' className='w-32 h-32 border rounded' />
          <p className='text-sm font-mono font-semibold'>{item.label}</p>
          {item.sublabel && <p className='text-xs text-muted-foreground'>{item.sublabel}</p>}
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

        <DialogFooter className='gap-2 sm:gap-0'>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handlePrint} className='gap-2'>
            <Printer className='h-4 w-4' />
            Imprimir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Export helper ─────────────────────────────────────────────────────────────

/**
 * Abre directamente la ventana de impresión sin pasar por el diálogo.
 * Útil cuando el formato ya está definido o se quiere acción directa.
 */
export { openPrintWindow }
