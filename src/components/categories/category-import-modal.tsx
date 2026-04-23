'use client'

import { useState, useRef } from 'react'
import {
  Upload,
  Download,
  CheckCircle,
  AlertTriangle,
  FileText,
  Loader2,
  RefreshCw,
  Trash2,
  Plus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

type ImportMode = 'add' | 'update' | 'replace'

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
}
interface ImportResult {
  total: number
  created: number
  updated: number
  skipped: number
  errors: ImportError[]
  preview?: PreviewRow[]
}

interface CategoryImportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  familyId?: string
  familyName?: string
}

type Step = 'upload' | 'preview' | 'done'

const MODE_OPTIONS: { value: ImportMode; label: string; desc: string; icon: React.ReactNode }[] = [
  {
    value: 'add',
    label: 'Agregar',
    desc: 'Solo crea las categorías nuevas. Las existentes no se modifican.',
    icon: <Plus className='h-4 w-4' />,
  },
  {
    value: 'update',
    label: 'Agregar y actualizar',
    desc: 'Crea las nuevas y actualiza descripción, color y estado de las existentes.',
    icon: <RefreshCw className='h-4 w-4' />,
  },
  {
    value: 'replace',
    label: 'Reemplazar área',
    desc: 'Elimina todas las categorías del área (sin tickets) y crea las del archivo.',
    icon: <Trash2 className='h-4 w-4' />,
  },
]

export function CategoryImportModal({
  open,
  onOpenChange,
  onSuccess,
  familyId,
  familyName,
}: CategoryImportModalProps) {
  const { toast } = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<Step>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<ImportMode>('add')
  const [preview, setPreview] = useState<ImportResult | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)

  const reset = () => {
    setStep('upload')
    setFile(null)
    setPreview(null)
    setResult(null)
    setLoading(false)
    setMode('add')
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

  const buildFormData = (dryRun: boolean) => {
    const fd = new FormData()
    fd.append('file', file!)
    fd.append('dryRun', String(dryRun))
    fd.append('mode', mode)
    if (familyId) fd.append('familyId', familyId)
    return fd
  }

  const handlePreview = async () => {
    if (!file) return
    setLoading(true)
    try {
      const res = await fetch('/api/categories/import', {
        method: 'POST',
        body: buildFormData(true),
      })
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
      const res = await fetch('/api/categories/import', {
        method: 'POST',
        body: buildFormData(false),
      })
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

  const validRows = preview?.preview?.length ?? 0
  const errorRows = preview?.errors.length ?? 0

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className='max-w-2xl' aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <Upload className='h-5 w-5' />
            Importar categorías{familyName ? ` — ${familyName}` : ''}
          </DialogTitle>
          <DialogDescription>
            Sube un CSV para crear o actualizar categorías de forma masiva.
          </DialogDescription>
        </DialogHeader>

        {/* ── Paso 1: Subir ── */}
        {step === 'upload' && (
          <div className='space-y-4'>
            {/* Plantilla */}
            <div className='flex items-center justify-between p-3 bg-muted/50 rounded-lg border'>
              <div className='flex items-center gap-2'>
                <FileText className='h-4 w-4 text-muted-foreground' />
                <div>
                  <p className='text-sm font-medium'>Plantilla CSV</p>
                  <p className='text-xs text-muted-foreground'>Descarga el formato con ejemplos</p>
                </div>
              </div>
              <Button
                variant='outline'
                size='sm'
                onClick={() => window.open('/api/categories/import/template', '_blank')}
              >
                <Download className='h-3.5 w-3.5 mr-1.5' />
                Descargar
              </Button>
            </div>

            {/* Modo de importación */}
            <div className='space-y-2'>
              <Label className='text-sm font-medium'>Modo de importación</Label>
              <div className='grid grid-cols-1 sm:grid-cols-3 gap-2'>
                {MODE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type='button'
                    onClick={() => setMode(opt.value)}
                    className={cn(
                      'flex flex-col items-start gap-1 p-3 rounded-lg border text-left transition-colors',
                      mode === opt.value
                        ? opt.value === 'replace'
                          ? 'border-destructive bg-destructive/5'
                          : 'border-primary bg-primary/5'
                        : 'border-border hover:bg-muted/50'
                    )}
                  >
                    <div
                      className={cn(
                        'flex items-center gap-1.5 font-medium text-sm',
                        mode === opt.value && opt.value === 'replace' && 'text-destructive',
                        mode === opt.value && opt.value !== 'replace' && 'text-primary'
                      )}
                    >
                      {opt.icon}
                      {opt.label}
                    </div>
                    <p className='text-xs text-muted-foreground leading-tight'>{opt.desc}</p>
                  </button>
                ))}
              </div>
              {mode === 'replace' && (
                <p className='text-xs text-destructive flex items-center gap-1.5 p-2 bg-destructive/5 rounded border border-destructive/20'>
                  <AlertTriangle className='h-3.5 w-3.5 flex-shrink-0' />
                  Las categorías con tickets asociados NO se eliminarán.
                  {familyName ? ` Solo afecta al área "${familyName}".` : ''}
                </p>
              )}
            </div>

            {/* Zona de drop */}
            <div
              className={cn(
                'border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer',
                isDragOver
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/25 hover:border-muted-foreground/50',
                file && 'border-primary/50 bg-primary/5'
              )}
              onDrop={e => {
                e.preventDefault()
                setIsDragOver(false)
                const f = e.dataTransfer.files[0]
                if (f) handleFile(f)
              }}
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
                  <CheckCircle className='h-7 w-7 text-primary' />
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
                <div className='flex flex-col items-center gap-1.5'>
                  <Upload className='h-7 w-7 text-muted-foreground' />
                  <p className='text-sm font-medium'>Arrastra tu CSV aquí o haz clic</p>
                  <p className='text-xs text-muted-foreground'>Máximo 500 categorías · 2 MB</p>
                </div>
              )}
            </div>

            {/* Columnas */}
            <p className='text-xs text-muted-foreground p-2 bg-muted/30 rounded'>
              <span className='font-medium text-foreground'>Columnas: </span>
              <span className='font-mono'>nombre</span>* ·{' '}
              <span className='font-mono'>descripcion</span> ·{' '}
              <span className='font-mono'>nivel</span> · <span className='font-mono'>padre</span> ·{' '}
              <span className='font-mono'>departamento</span> ·{' '}
              <span className='font-mono'>area</span> · <span className='font-mono'>color</span> ·{' '}
              <span className='font-mono'>activa</span>
            </p>
          </div>
        )}

        {/* ── Paso 2: Preview ── */}
        {step === 'preview' && preview && (
          <div className='space-y-4'>
            <div className='grid grid-cols-3 gap-3'>
              <div className='text-center p-3 bg-muted/50 rounded-lg border'>
                <p className='text-2xl font-bold'>{preview.total}</p>
                <p className='text-xs text-muted-foreground'>Total filas</p>
              </div>
              <div className='text-center p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800'>
                <p className='text-2xl font-bold text-green-700 dark:text-green-400'>{validRows}</p>
                <p className='text-xs text-green-600 dark:text-green-500'>
                  {mode === 'update' ? 'Crear/actualizar' : 'Se crearán'}
                </p>
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

            {preview.errors.length > 0 && (
              <div className='space-y-1 max-h-28 overflow-y-auto'>
                <p className='text-xs font-medium text-destructive flex items-center gap-1'>
                  <AlertTriangle className='h-3.5 w-3.5' /> Filas con errores (se omitirán):
                </p>
                {preview.errors.map((e, i) => (
                  <div
                    key={i}
                    className='flex items-start gap-2 text-xs p-2 bg-destructive/5 rounded border border-destructive/10'
                  >
                    <span className='text-muted-foreground flex-shrink-0'>Fila {e.row}:</span>
                    <span className='font-medium flex-shrink-0 truncate'>{e.nombre}</span>
                    <span className='text-destructive'>{e.error}</span>
                  </div>
                ))}
              </div>
            )}

            {preview.preview && preview.preview.length > 0 && (
              <div className='space-y-1'>
                <p className='text-xs font-medium text-muted-foreground'>
                  Vista previa (primeras 5):
                </p>
                <div className='border rounded-lg divide-y max-h-36 overflow-y-auto'>
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

            {mode === 'replace' && (
              <p className='text-xs text-destructive flex items-center gap-1.5 p-2 bg-destructive/5 rounded border border-destructive/20'>
                <AlertTriangle className='h-3.5 w-3.5 flex-shrink-0' />
                Se eliminarán las categorías existentes del área antes de importar.
              </p>
            )}
          </div>
        )}

        {/* ── Paso 3: Resultado ── */}
        {step === 'done' && result && (
          <div className='space-y-3 text-center py-4'>
            <CheckCircle className='h-12 w-12 text-primary mx-auto' />
            <p className='text-lg font-semibold'>Importación completada</p>
            <div className='flex items-center justify-center gap-4 text-sm'>
              {result.created > 0 && (
                <span className='text-green-600 dark:text-green-400 font-medium'>
                  +{result.created} creadas
                </span>
              )}
              {result.updated > 0 && (
                <span className='text-primary font-medium'>↻ {result.updated} actualizadas</span>
              )}
              {result.skipped > 0 && (
                <span className='text-muted-foreground'>{result.skipped} omitidas</span>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          {step === 'upload' && (
            <>
              <Button variant='outline' onClick={handleClose}>
                Cancelar
              </Button>
              <Button onClick={handlePreview} disabled={!file || loading}>
                {loading && <Loader2 className='h-4 w-4 mr-2 animate-spin' />}
                {loading ? 'Validando...' : 'Validar archivo'}
              </Button>
            </>
          )}
          {step === 'preview' && (
            <>
              <Button variant='outline' onClick={() => setStep('upload')}>
                Volver
              </Button>
              <Button
                onClick={handleImport}
                disabled={loading || validRows === 0}
                variant={mode === 'replace' ? 'destructive' : 'default'}
              >
                {loading && <Loader2 className='h-4 w-4 mr-2 animate-spin' />}
                {loading
                  ? 'Importando...'
                  : `${mode === 'replace' ? 'Reemplazar' : 'Importar'} ${validRows} categoría${validRows !== 1 ? 's' : ''}`}
              </Button>
            </>
          )}
          {step === 'done' && <Button onClick={handleClose}>Cerrar</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Modal de eliminación masiva ────────────────────────────────────────────

interface BulkDeleteModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  familyId?: string
  familyName?: string
  isSuperAdmin: boolean
}

export function CategoryBulkDeleteModal({
  open,
  onOpenChange,
  onSuccess,
  familyId,
  familyName,
  isSuperAdmin,
}: BulkDeleteModalProps) {
  const { toast } = useToast()
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)

  const isSystem = !familyId
  const confirmWord = 'ELIMINAR'
  const isValid = confirm === confirmWord

  const handleDelete = async () => {
    if (!isValid) return
    setLoading(true)
    try {
      const res = await fetch('/api/categories/bulk-delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ familyId: familyId || undefined, confirm: confirmWord }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: 'Error', description: data.error, variant: 'destructive' })
        return
      }
      toast({
        title: 'Categorías eliminadas',
        description: `${data.deleted} eliminadas${data.skipped > 0 ? `, ${data.skipped} omitidas (tienen tickets)` : ''}`,
      })
      onSuccess()
      onOpenChange(false)
      setConfirm('')
    } catch {
      toast({ title: 'Error de conexión', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={v => {
        if (!v) setConfirm('')
        onOpenChange(v)
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className='flex items-center gap-2 text-destructive'>
            <Trash2 className='h-5 w-5' />
            {isSystem ? 'Eliminar todas las categorías' : `Eliminar categorías de "${familyName}"`}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className='space-y-3'>
              <p>
                {isSystem
                  ? 'Se eliminarán TODAS las categorías del sistema.'
                  : `Se eliminarán todas las categorías del área "${familyName}".`}{' '}
                Las categorías con tickets asociados <strong>no se eliminarán</strong>.
              </p>
              <p className='text-sm font-medium'>Esta acción no se puede deshacer.</p>
              <div className='space-y-1.5'>
                <Label className='text-sm'>
                  Escribe <span className='font-mono font-bold'>{confirmWord}</span> para confirmar:
                </Label>
                <Input
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder={confirmWord}
                  className={cn(isValid && 'border-destructive')}
                  autoComplete='off'
                />
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setConfirm('')}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={!isValid || loading}
            className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
          >
            {loading ? <Loader2 className='h-4 w-4 mr-2 animate-spin' /> : null}
            {loading ? 'Eliminando...' : 'Eliminar categorías'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
