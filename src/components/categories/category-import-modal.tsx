'use client'

import { useState, useRef } from 'react'
import {
  Upload,
  Download,
  CheckCircle,
  XCircle,
  AlertTriangle,
  FileText,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

interface ImportError {
  row: number
  nombre: string
  error: string
}
interface PreviewRow {
  nombre: string
  descripcion?: string
  nivel?: number
  padre?: string
  area?: string
  color?: string
  activa: boolean
  _error?: string
}
interface ImportResult {
  total: number
  created: number
  skipped: number
  errors: ImportError[]
  preview?: PreviewRow[]
}

interface CategoryImportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  familyId?: string
}

type Step = 'upload' | 'preview' | 'done'

export function CategoryImportModal({
  open,
  onOpenChange,
  onSuccess,
  familyId,
}: CategoryImportModalProps) {
  const { toast } = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<Step>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<ImportResult | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)

  const reset = () => {
    setStep('upload')
    setFile(null)
    setPreview(null)
    setResult(null)
    setLoading(false)
  }

  const handleClose = () => {
    if (step === 'done') onSuccess()
    onOpenChange(false)
    setTimeout(reset, 300)
  }

  const handleFile = (f: File) => {
    if (!f.name.endsWith('.csv') && !f.name.endsWith('.txt')) {
      toast({
        title: 'Formato inválido',
        description: 'Solo se aceptan archivos CSV',
        variant: 'destructive',
      })
      return
    }
    setFile(f)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  const handlePreview = async () => {
    if (!file) return
    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('dryRun', 'true')
      if (familyId) fd.append('familyId', familyId)

      const res = await fetch('/api/categories/import', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: 'Error', description: data.error, variant: 'destructive' })
        return
      }
      setPreview(data)
      setStep('preview')
    } catch {
      toast({ title: 'Error de conexión', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const handleImport = async () => {
    if (!file) return
    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('dryRun', 'false')
      if (familyId) fd.append('familyId', familyId)

      const res = await fetch('/api/categories/import', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: 'Error al importar', description: data.error, variant: 'destructive' })
        return
      }
      setResult(data)
      setStep('done')
    } catch {
      toast({ title: 'Error de conexión', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const downloadTemplate = () => {
    window.open('/api/categories/import/template', '_blank')
  }

  const validRows = preview ? (preview.preview?.length ?? 0) : 0
  const errorRows = preview?.errors.length ?? 0

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className='max-w-2xl' aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <Upload className='h-5 w-5' />
            Importar categorías
          </DialogTitle>
          <DialogDescription>
            Sube un archivo CSV para crear múltiples categorías de forma masiva.
          </DialogDescription>
        </DialogHeader>

        {/* ── Paso 1: Subir archivo ── */}
        {step === 'upload' && (
          <div className='space-y-4'>
            {/* Plantilla */}
            <div className='flex items-center justify-between p-3 bg-muted/50 rounded-lg border'>
              <div className='flex items-center gap-2'>
                <FileText className='h-4 w-4 text-muted-foreground' />
                <div>
                  <p className='text-sm font-medium'>Plantilla CSV</p>
                  <p className='text-xs text-muted-foreground'>
                    Descarga el formato correcto con ejemplos
                  </p>
                </div>
              </div>
              <Button variant='outline' size='sm' onClick={downloadTemplate}>
                <Download className='h-3.5 w-3.5 mr-1.5' />
                Descargar
              </Button>
            </div>

            {/* Zona de drop */}
            <div
              className={cn(
                'border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer',
                isDragOver
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/25 hover:border-muted-foreground/50',
                file && 'border-primary/50 bg-primary/5'
              )}
              onDrop={handleDrop}
              onDragOver={e => {
                e.preventDefault()
                setIsDragOver(true)
              }}
              onDragLeave={() => setIsDragOver(false)}
              onClick={() => fileRef.current?.click()}
            >
              <input
                ref={fileRef}
                type='file'
                accept='.csv,.txt'
                className='hidden'
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (f) handleFile(f)
                }}
              />
              {file ? (
                <div className='flex flex-col items-center gap-2'>
                  <CheckCircle className='h-8 w-8 text-primary' />
                  <p className='font-medium text-sm'>{file.name}</p>
                  <p className='text-xs text-muted-foreground'>
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                  <Button
                    variant='ghost'
                    size='sm'
                    onClick={e => {
                      e.stopPropagation()
                      setFile(null)
                    }}
                  >
                    Cambiar archivo
                  </Button>
                </div>
              ) : (
                <div className='flex flex-col items-center gap-2'>
                  <Upload className='h-8 w-8 text-muted-foreground' />
                  <p className='text-sm font-medium'>Arrastra tu CSV aquí</p>
                  <p className='text-xs text-muted-foreground'>o haz clic para seleccionar</p>
                  <p className='text-xs text-muted-foreground'>Máximo 500 categorías · 2 MB</p>
                </div>
              )}
            </div>

            {/* Instrucciones */}
            <div className='text-xs text-muted-foreground space-y-1 p-3 bg-muted/30 rounded-lg'>
              <p className='font-medium text-foreground'>Columnas del CSV:</p>
              <p>
                <span className='font-mono bg-muted px-1 rounded'>nombre</span> (obligatorio) ·{' '}
                <span className='font-mono bg-muted px-1 rounded'>descripcion</span> ·{' '}
                <span className='font-mono bg-muted px-1 rounded'>nivel</span> (1-4) ·{' '}
                <span className='font-mono bg-muted px-1 rounded'>padre</span> (nombre exacto)
              </p>
              <p>
                <span className='font-mono bg-muted px-1 rounded'>departamento</span> ·{' '}
                <span className='font-mono bg-muted px-1 rounded'>area</span> (código o nombre) ·{' '}
                <span className='font-mono bg-muted px-1 rounded'>color</span> (#hex) ·{' '}
                <span className='font-mono bg-muted px-1 rounded'>activa</span> (true/false)
              </p>
            </div>
          </div>
        )}

        {/* ── Paso 2: Preview ── */}
        {step === 'preview' && preview && (
          <div className='space-y-4'>
            {/* Resumen */}
            <div className='grid grid-cols-3 gap-3'>
              <div className='text-center p-3 bg-muted/50 rounded-lg border'>
                <p className='text-2xl font-bold'>{preview.total}</p>
                <p className='text-xs text-muted-foreground'>Total filas</p>
              </div>
              <div className='text-center p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800'>
                <p className='text-2xl font-bold text-green-700 dark:text-green-400'>{validRows}</p>
                <p className='text-xs text-green-600 dark:text-green-500'>Se crearán</p>
              </div>
              <div
                className={cn(
                  'text-center p-3 rounded-lg border',
                  errorRows > 0 ? 'bg-destructive/5 border-destructive/20' : 'bg-muted/50'
                )}
              >
                <p className={cn('text-2xl font-bold', errorRows > 0 && 'text-destructive')}>
                  {errorRows}
                </p>
                <p className='text-xs text-muted-foreground'>Con errores</p>
              </div>
            </div>

            {/* Errores */}
            {preview.errors.length > 0 && (
              <div className='space-y-1.5 max-h-32 overflow-y-auto'>
                <p className='text-xs font-medium text-destructive flex items-center gap-1'>
                  <AlertTriangle className='h-3.5 w-3.5' />
                  Filas con errores (se omitirán):
                </p>
                {preview.errors.map((e, i) => (
                  <div
                    key={i}
                    className='flex items-start gap-2 text-xs p-2 bg-destructive/5 rounded border border-destructive/10'
                  >
                    <span className='text-muted-foreground flex-shrink-0'>Fila {e.row}:</span>
                    <span className='font-medium flex-shrink-0'>{e.nombre}</span>
                    <span className='text-destructive'>{e.error}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Preview de filas válidas */}
            {preview.preview && preview.preview.length > 0 && (
              <div className='space-y-1'>
                <p className='text-xs font-medium text-muted-foreground'>
                  Vista previa (primeras 5):
                </p>
                <div className='border rounded-lg divide-y max-h-40 overflow-y-auto'>
                  {preview.preview.slice(0, 5).map((row, i) => (
                    <div key={i} className='flex items-center gap-3 px-3 py-2'>
                      <div
                        className='w-2.5 h-2.5 rounded-full flex-shrink-0'
                        style={{ backgroundColor: row.color || '#6B7280' }}
                      />
                      <div className='flex-1 min-w-0'>
                        <p className='text-sm font-medium truncate'>{row.nombre}</p>
                        {row.padre && (
                          <p className='text-xs text-muted-foreground'>↳ {row.padre}</p>
                        )}
                      </div>
                      <div className='flex items-center gap-1.5 flex-shrink-0'>
                        <Badge variant='outline' className='text-xs h-5 px-1.5'>
                          N{row.nivel}
                        </Badge>
                        {row.area && (
                          <Badge variant='secondary' className='text-xs h-5 px-1.5'>
                            {row.area}
                          </Badge>
                        )}
                        {!row.activa && (
                          <Badge variant='secondary' className='text-xs h-5 px-1.5'>
                            Inactiva
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                  {preview.preview.length > 5 && (
                    <div className='px-3 py-2 text-xs text-muted-foreground text-center'>
                      +{preview.preview.length - 5} más...
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Paso 3: Resultado ── */}
        {step === 'done' && result && (
          <div className='space-y-4 text-center py-4'>
            <CheckCircle className='h-12 w-12 text-primary mx-auto' />
            <div>
              <p className='text-lg font-semibold'>Importación completada</p>
              <p className='text-sm text-muted-foreground mt-1'>
                {result.created} categoría{result.created !== 1 ? 's' : ''} creada
                {result.created !== 1 ? 's' : ''} correctamente
              </p>
            </div>
            {result.skipped > 0 && (
              <p className='text-sm text-muted-foreground'>
                {result.skipped} fila{result.skipped !== 1 ? 's' : ''} omitida
                {result.skipped !== 1 ? 's' : ''} por errores
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          {step === 'upload' && (
            <>
              <Button variant='outline' onClick={handleClose}>
                Cancelar
              </Button>
              <Button onClick={handlePreview} disabled={!file || loading}>
                {loading ? <Loader2 className='h-4 w-4 mr-2 animate-spin' /> : null}
                {loading ? 'Validando...' : 'Validar archivo'}
              </Button>
            </>
          )}
          {step === 'preview' && (
            <>
              <Button variant='outline' onClick={() => setStep('upload')}>
                Volver
              </Button>
              <Button onClick={handleImport} disabled={loading || validRows === 0}>
                {loading ? <Loader2 className='h-4 w-4 mr-2 animate-spin' /> : null}
                {loading
                  ? 'Importando...'
                  : `Importar ${validRows} categoría${validRows !== 1 ? 's' : ''}`}
              </Button>
            </>
          )}
          {step === 'done' && <Button onClick={handleClose}>Cerrar</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
