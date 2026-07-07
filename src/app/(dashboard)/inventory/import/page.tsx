'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Download,
  Loader2,
  Upload,
  AlertTriangle,
  Plus,
  RefreshCw,
  Info,
  Lightbulb,
  FileText,
} from 'lucide-react'
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FamilySelector } from '@/components/inventory/family-selector'
import { InlineCreateSelect } from '@/components/ui/inline-create-select'
import { EquipmentBrandInlineForm } from '@/components/inventory/asset-forms/EquipmentBrandInlineForm'
import { EquipmentModelInlineForm } from '@/components/inventory/asset-forms/EquipmentModelInlineForm'
import { useFamilyOptions } from '@/hooks/use-family-options'
import { inventoryToast as toast } from '@/lib/utils/inventory-toast'
import { getAcquisitionModeLabel } from '@/lib/utils/inventory-utils'
import { cn } from '@/lib/utils'

const ACQUISITION_MODES = ['FIXED_ASSET', 'RENTAL', 'LOAN'] as const
type ImportMode = 'add' | 'update'

const IMPORT_MODE_OPTIONS: Array<{
  value: ImportMode
  label: string
  description: string
  icon: React.ReactNode
}> = [
  {
    value: 'add',
    label: 'Solo agregar',
    description: 'Crea equipos nuevos. Los que ya existen (misma serie) se omiten.',
    icon: <Plus className='h-4 w-4' />,
  },
  {
    value: 'update',
    label: 'Agregar y actualizar',
    description: 'Crea los nuevos y actualiza metadatos de series existentes (mismo tipo/modelo).',
    icon: <RefreshCw className='h-4 w-4' />,
  },
]

type Step = 'catalog' | 'upload' | 'preview' | 'done'

interface ImportError {
  row: number
  field: string
  fieldLabel?: string
  message: string
  hint?: string
  serialNumber?: string
}

interface PreviewRow {
  rowNumber: number
  serialNumber: string
  action?: 'create' | 'update' | 'skip'
  condition: string
  reason?: string
  existingCode?: string
  customValues?: Record<string, string>
}

interface ImportResponse {
  valid: boolean
  mode?: ImportMode
  total: number
  created: number
  updated: number
  skipped: number
  errors: ImportError[]
  preview?: PreviewRow[]
  codes?: string[]
}

export default function InventoryImportPage() {
  const router = useRouter()
  const { families, loading: loadingFamilies } = useFamilyOptions()

  const [step, setStep] = useState<Step>('catalog')
  const [familyId, setFamilyId] = useState('')
  const [typeId, setTypeId] = useState('')
  const [brandId, setBrandId] = useState('')
  const [modelId, setModelId] = useState('')
  const [acquisitionMode, setAcquisitionMode] = useState('FIXED_ASSET')
  const [importMode, setImportMode] = useState<ImportMode>('add')

  const [equipmentTypes, setEquipmentTypes] = useState<Array<{ id: string; name: string }>>([])
  const [brands, setBrands] = useState<Array<{ id: string; name: string }>>([])
  const [models, setModels] = useState<Array<{ id: string; name: string }>>([])

  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ImportResponse | null>(null)
  const [maxFileSizeMB, setMaxFileSizeMB] = useState(10)
  const [warehouses, setWarehouses] = useState<Array<{ name: string; code?: string | null }>>([])

  const catalogReady = !!(familyId && typeId && brandId && modelId && acquisitionMode)

  const selectedFamily = families.find(f => f.id === familyId)
  const selectedType = equipmentTypes.find(t => t.id === typeId)
  const selectedBrand = brands.find(b => b.id === brandId)
  const selectedModel = models.find(m => m.id === modelId)

  useEffect(() => {
    fetch('/api/config/upload-limits')
      .then(r => (r.ok ? r.json() : { maxFileSizeMB: 10 }))
      .then(d => setMaxFileSizeMB(d.maxFileSizeMB ?? 10))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!familyId) {
      setWarehouses([])
      return
    }
    fetch(`/api/inventory/warehouses?familyId=${familyId}`)
      .then(r => r.json())
      .then(data => {
        const list = data.warehouses ?? data.data ?? []
        setWarehouses(
          list.map((w: { name: string; code?: string }) => ({ name: w.name, code: w.code }))
        )
      })
      .catch(() => setWarehouses([]))
  }, [familyId])

  useEffect(() => {
    if (!familyId) {
      setEquipmentTypes([])
      setTypeId('')
      return
    }
    fetch(`/api/inventory/equipment-types?familyId=${familyId}`)
      .then(r => r.json())
      .then(data => setEquipmentTypes(data.types ?? data.data ?? []))
      .catch(() => setEquipmentTypes([]))
  }, [familyId])

  useEffect(() => {
    if (!familyId) {
      setBrands([])
      setBrandId('')
      return
    }
    const params = new URLSearchParams({ familyId })
    fetch(`/api/inventory/brands?${params}`)
      .then(r => r.json())
      .then(data =>
        setBrands(
          (data.brands ?? []).map((b: { id: string; name: string }) => ({ id: b.id, name: b.name }))
        )
      )
      .catch(() => setBrands([]))
  }, [familyId])

  useEffect(() => {
    if (!typeId || !brandId) {
      setModels([])
      setModelId('')
      return
    }
    fetch(`/api/inventory/models?typeId=${typeId}&brandId=${brandId}&limit=100`)
      .then(r => r.json())
      .then(data => {
        const list = data.models ?? data.data ?? []
        setModels(
          list.map((m: { id: string; model: string; brand?: { name: string } }) => ({
            id: m.id,
            name: `${m.brand?.name ?? ''} ${m.model}`.trim(),
          }))
        )
      })
      .catch(() => setModels([]))
  }, [typeId, brandId])

  const templateUrl = useMemo(() => {
    if (!catalogReady) return ''
    const params = new URLSearchParams({
      familyId,
      typeId,
      brandId,
      modelId,
      acquisitionMode,
      format: 'xlsx',
    })
    return `/api/inventory/equipment/import/template?${params.toString()}`
  }, [catalogReady, familyId, typeId, brandId, modelId, acquisitionMode])

  const buildFormData = useCallback(
    (dryRun: boolean) => {
      const fd = new FormData()
      fd.append('file', file!)
      fd.append('dryRun', String(dryRun))
      fd.append('familyId', familyId)
      fd.append('typeId', typeId)
      fd.append('brandId', brandId)
      fd.append('modelId', modelId)
      fd.append('acquisitionMode', acquisitionMode)
      fd.append('mode', importMode)
      return fd
    },
    [file, familyId, typeId, brandId, modelId, acquisitionMode, importMode]
  )

  const handleFileSelect = (f: File | null) => {
    if (!f) {
      setFile(null)
      return
    }
    const valid = f.name.endsWith('.csv') || f.name.endsWith('.txt') || f.name.endsWith('.xlsx')
    if (!valid) {
      toast.error('Formato inválido. Use CSV o Excel (.xlsx)')
      return
    }
    if (f.size > maxFileSizeMB * 1024 * 1024) {
      toast.error(`El archivo supera el límite de ${maxFileSizeMB} MB`)
      return
    }
    setFile(f)
    setResult(null)
  }

  const handlePreview = async () => {
    if (!file || !catalogReady) return
    setLoading(true)
    try {
      const res = await fetch('/api/inventory/equipment/import', {
        method: 'POST',
        body: buildFormData(true),
      })
      const data: ImportResponse = await res.json()
      if (!res.ok && !data.errors?.length && !data.preview?.length) {
        toast.error((data as { error?: string }).error ?? 'Error al validar')
        return
      }
      setResult(data)
      setStep('preview')
      if (data.errors?.length) {
        toast.error(
          `${data.errors.length} error${data.errors.length !== 1 ? 'es' : ''} encontrado${data.errors.length !== 1 ? 's' : ''}. Revise la tabla de soluciones.`
        )
      } else if (data.skipped > 0 && data.valid) {
        toast.success(
          `Validación OK. ${data.skipped} equipo${data.skipped !== 1 ? 's' : ''} se omitirán (ya existen).`
        )
      }
    } catch {
      toast.error('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  const handleImport = async () => {
    if (!file || !result?.valid) return
    setLoading(true)
    try {
      const res = await fetch('/api/inventory/equipment/import', {
        method: 'POST',
        body: buildFormData(false),
      })
      const data: ImportResponse = await res.json()
      if (!res.ok || !data.valid) {
        toast.error(
          data.errors?.[0]?.message ?? (data as { error?: string }).error ?? 'Error al importar'
        )
        setResult(data)
        return
      }
      setResult(data)
      setStep('done')
      const parts = [
        data.created > 0 ? `${data.created} creados` : null,
        data.updated > 0 ? `${data.updated} actualizados` : null,
        data.skipped > 0 ? `${data.skipped} omitidos` : null,
      ].filter(Boolean)
      toast.success(parts.join(' · ') || 'Importación completada')
    } catch {
      toast.error('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  const createCount = result?.preview?.filter(r => r.action === 'create').length ?? 0
  const updateCount = result?.preview?.filter(r => r.action === 'update').length ?? 0
  const actionableRows = createCount + updateCount
  const skippedRows =
    result?.skipped ?? result?.preview?.filter(r => r.action === 'skip').length ?? 0
  const errorCount = result?.errors?.length ?? 0
  const totalRows = result?.total ?? 0

  const actionLabel = (action?: PreviewRow['action']) => {
    if (action === 'create') return 'Nuevo'
    if (action === 'update') return 'Actualizar'
    if (action === 'skip') return 'Omitir'
    return '—'
  }

  const CatalogSummary = () => {
    if (!catalogReady) return null
    return (
      <div className='rounded-lg border bg-muted/30 p-3 text-sm space-y-2'>
        <p className='font-medium flex items-center gap-2'>
          <FileText className='h-4 w-4 text-muted-foreground' />
          Catálogo seleccionado
        </p>
        <div className='grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-muted-foreground'>
          <span>
            <span className='text-foreground font-medium'>Familia:</span> {selectedFamily?.name}
          </span>
          <span>
            <span className='text-foreground font-medium'>Tipo:</span> {selectedType?.name}
          </span>
          <span>
            <span className='text-foreground font-medium'>Marca:</span> {selectedBrand?.name}
          </span>
          <span>
            <span className='text-foreground font-medium'>Modelo:</span> {selectedModel?.name}
          </span>
          <span>
            <span className='text-foreground font-medium'>Adquisición:</span>{' '}
            {getAcquisitionModeLabel(acquisitionMode)}
          </span>
          <span>
            <span className='text-foreground font-medium'>Modo:</span>{' '}
            {importMode === 'add' ? 'Solo agregar' : 'Agregar y actualizar'}
          </span>
        </div>
      </div>
    )
  }

  return (
    <ModuleLayout
      title='Importar equipos'
      subtitle='Carga masiva desde plantilla CSV o Excel (máx. 100 equipos)'
    >
      <div className='max-w-4xl mx-auto space-y-4'>
        <button
          type='button'
          onClick={() => router.push('/inventory')}
          className='flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground'
        >
          <ArrowLeft className='h-4 w-4' />
          Inventario
        </button>

        <div className='flex gap-2 text-sm'>
          {(['catalog', 'upload', 'preview'] as const).map((s, i) => (
            <span
              key={s}
              className={cn(
                'px-3 py-1 rounded-full border',
                step === s || (step === 'done' && s === 'preview')
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'text-muted-foreground'
              )}
            >
              {i + 1}. {s === 'catalog' ? 'Catálogo' : s === 'upload' ? 'Archivo' : 'Confirmar'}
            </span>
          ))}
        </div>

        {step === 'catalog' && (
          <Card>
            <CardHeader>
              <CardTitle>1. Selecciona el catálogo</CardTitle>
              <CardDescription>
                Familia, tipo, marca y modelo se aplican a todos los equipos del archivo. No van en
                el Excel.
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              {loadingFamilies ? (
                <p className='text-sm text-muted-foreground flex items-center gap-2'>
                  <Loader2 className='h-4 w-4 animate-spin' />
                  Cargando familias...
                </p>
              ) : null}
              <div>
                <Label>Familia *</Label>
                <FamilySelector
                  families={families}
                  selectedId={familyId}
                  onSelect={id => {
                    setFamilyId(id)
                    setTypeId('')
                    setBrandId('')
                    setModelId('')
                  }}
                />
              </div>

              <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                <div>
                  <Label>Tipo de equipo *</Label>
                  <Select
                    value={typeId}
                    onValueChange={v => {
                      setTypeId(v)
                      setModelId('')
                    }}
                    disabled={!familyId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder='Selecciona tipo' />
                    </SelectTrigger>
                    <SelectContent>
                      {equipmentTypes.map(t => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Modo de adquisición *</Label>
                  <Select value={acquisitionMode} onValueChange={setAcquisitionMode}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ACQUISITION_MODES.map(mode => (
                        <SelectItem key={mode} value={mode}>
                          {getAcquisitionModeLabel(mode)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                <div>
                  <Label>Marca *</Label>
                  <InlineCreateSelect
                    value={brandId}
                    onChange={setBrandId}
                    options={brands}
                    placeholder='Buscar o crear marca...'
                    disabled={!familyId}
                    createLabel='Crear marca'
                    createTitle='Nueva marca'
                    createForm={({ onSuccess, onCancel }) => (
                      <EquipmentBrandInlineForm
                        familyId={familyId}
                        onSuccess={item => {
                          setBrands(prev => [...prev, item])
                          setBrandId(item.id)
                          onSuccess(item)
                        }}
                        onCancel={onCancel}
                      />
                    )}
                  />
                </div>
                <div>
                  <Label>Modelo *</Label>
                  <InlineCreateSelect
                    value={modelId}
                    onChange={setModelId}
                    options={models}
                    placeholder='Buscar o crear modelo...'
                    disabled={!typeId || !brandId}
                    createLabel='Crear modelo'
                    createTitle='Nuevo modelo'
                    createForm={({ onSuccess, onCancel }) => (
                      <EquipmentModelInlineForm
                        typeId={typeId}
                        familyId={familyId}
                        initialBrandId={brandId}
                        onSuccess={item => {
                          setModels(prev => [...prev, { id: item.id, name: item.name }])
                          setModelId(item.id)
                          onSuccess(item)
                        }}
                        onCancel={onCancel}
                      />
                    )}
                  />
                </div>
              </div>

              <Alert>
                <Info className='h-4 w-4' />
                <AlertTitle>Antes de continuar</AlertTitle>
                <AlertDescription>
                  Descargará una plantilla con columnas fijas y atributos del tipo seleccionado.
                  Cada fila del archivo representa un equipo con su N° de serie único.
                </AlertDescription>
              </Alert>

              <div className='flex justify-end'>
                <Button type='button' disabled={!catalogReady} onClick={() => setStep('upload')}>
                  Continuar
                  <ArrowRight className='ml-2 h-4 w-4' />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 'upload' && (
          <Card>
            <CardHeader>
              <CardTitle>2. Plantilla y archivo</CardTitle>
              <CardDescription>
                Descarga la plantilla con los atributos de tu tipo y sube el archivo completado.
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <CatalogSummary />

              <div className='space-y-2'>
                <Label>Modo de importación</Label>
                <div className='grid gap-2 sm:grid-cols-2'>
                  {IMPORT_MODE_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type='button'
                      onClick={() => setImportMode(opt.value)}
                      className={cn(
                        'rounded-lg border p-3 text-left transition-colors',
                        importMode === opt.value
                          ? 'border-primary bg-primary/5'
                          : 'hover:bg-muted/40'
                      )}
                    >
                      <div className='flex items-center gap-2 font-medium text-sm'>
                        {opt.icon}
                        {opt.label}
                      </div>
                      <p className='text-xs text-muted-foreground mt-1'>{opt.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className='flex items-center justify-between p-3 bg-muted/50 rounded-lg border'>
                <div className='flex items-center gap-2'>
                  <FileText className='h-4 w-4 text-muted-foreground' />
                  <div>
                    <p className='text-sm font-medium'>Plantilla Excel</p>
                    <p className='text-xs text-muted-foreground'>
                      Incluye ejemplos y hoja &quot;Instrucciones&quot;
                    </p>
                  </div>
                </div>
                <Button type='button' variant='outline' size='sm' asChild>
                  <a href={templateUrl} download>
                    <Download className='mr-2 h-4 w-4' />
                    Descargar
                  </a>
                </Button>
              </div>

              <details className='rounded-lg border bg-muted/20 p-3 text-sm'>
                <summary className='cursor-pointer font-medium flex items-center gap-2'>
                  <Lightbulb className='h-4 w-4 text-amber-600' />
                  Guía rápida y columnas del archivo
                </summary>
                <div className='mt-3 space-y-2 text-muted-foreground'>
                  <p>
                    <span className='text-foreground font-medium'>Obligatorio:</span> N° de Serie
                    (único por equipo).
                  </p>
                  <p>
                    <span className='text-foreground font-medium'>Opcionales:</span> Condición,
                    Bodega, Ubicación, Fecha/Precio compra, Factura, Accesorios, Notas + atributos
                    del tipo.
                  </p>
                  <p>
                    <span className='text-foreground font-medium'>Condición:</span> NEW, USED o
                    DAMAGED.
                  </p>
                  {warehouses.length > 0 ? (
                    <p>
                      <span className='text-foreground font-medium'>Bodegas válidas:</span>{' '}
                      {warehouses.map(w => (w.code ? `${w.name} (${w.code})` : w.name)).join(' · ')}
                    </p>
                  ) : (
                    <p className='text-amber-700 dark:text-amber-400'>
                      No hay bodegas activas en esta familia. Cree una en Inventario → Bodegas o
                      deje la columna vacía.
                    </p>
                  )}
                </div>
              </details>

              <label
                className={cn(
                  'flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 cursor-pointer hover:bg-muted/40',
                  file && 'border-primary/50 bg-primary/5'
                )}
              >
                <Upload className='h-8 w-8 text-muted-foreground' />
                <span className='text-sm font-medium'>
                  {file ? file.name : 'Arrastra CSV o Excel, o haz clic para seleccionar'}
                </span>
                <span className='text-xs text-muted-foreground'>
                  CSV o Excel (.xlsx) · Máx. 100 equipos · {maxFileSizeMB} MB
                </span>
                <input
                  type='file'
                  accept='.csv,.txt,.xlsx'
                  className='hidden'
                  onChange={e => handleFileSelect(e.target.files?.[0] ?? null)}
                />
              </label>

              <div className='flex justify-between'>
                <Button type='button' variant='outline' onClick={() => setStep('catalog')}>
                  Atrás
                </Button>
                <Button type='button' disabled={!file || loading} onClick={handlePreview}>
                  {loading && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
                  Validar archivo
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {(step === 'preview' || step === 'done') && result && (
          <Card>
            <CardHeader>
              <CardTitle>{step === 'done' ? 'Importación completada' : '3. Revisión'}</CardTitle>
              <CardDescription>
                {step === 'done'
                  ? [
                      result.created > 0 ? `${result.created} creados` : null,
                      result.updated > 0 ? `${result.updated} actualizados` : null,
                      result.skipped > 0 ? `${result.skipped} omitidos` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')
                  : `${actionableRows} a procesar · ${skippedRows} omitidos · ${errorCount} errores`}
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <CatalogSummary />

              {step === 'preview' && (
                <div className='grid grid-cols-2 sm:grid-cols-5 gap-2'>
                  <div className='text-center p-3 rounded-lg border bg-muted/40'>
                    <p className='text-xl font-bold'>{totalRows}</p>
                    <p className='text-xs text-muted-foreground'>Total filas</p>
                  </div>
                  <div className='text-center p-3 rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800'>
                    <p className='text-xl font-bold text-green-700 dark:text-green-400'>
                      {createCount}
                    </p>
                    <p className='text-xs text-green-600'>Nuevos</p>
                  </div>
                  <div className='text-center p-3 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800'>
                    <p className='text-xl font-bold text-amber-700 dark:text-amber-400'>
                      {updateCount}
                    </p>
                    <p className='text-xs text-amber-600'>Actualizar</p>
                  </div>
                  <div className='text-center p-3 rounded-lg border bg-muted/40'>
                    <p className='text-xl font-bold'>{skippedRows}</p>
                    <p className='text-xs text-muted-foreground'>Omitidos</p>
                  </div>
                  <div
                    className={cn(
                      'text-center p-3 rounded-lg border',
                      errorCount > 0 ? 'border-destructive/30 bg-destructive/5' : 'bg-muted/40'
                    )}
                  >
                    <p className={cn('text-xl font-bold', errorCount > 0 && 'text-destructive')}>
                      {errorCount}
                    </p>
                    <p className='text-xs text-muted-foreground'>Errores</p>
                  </div>
                </div>
              )}

              {step === 'preview' && errorCount > 0 && (
                <Alert variant='destructive'>
                  <AlertTriangle className='h-4 w-4' />
                  <AlertTitle>Corrija los errores antes de importar</AlertTitle>
                  <AlertDescription>
                    Edite el archivo Excel en las filas indicadas, guarde y pulse &quot;Validar
                    archivo&quot; de nuevo. Las filas con error no se importarán.
                  </AlertDescription>
                </Alert>
              )}

              {step === 'preview' &&
                errorCount === 0 &&
                skippedRows > 0 &&
                importMode === 'add' && (
                  <Alert>
                    <Info className='h-4 w-4' />
                    <AlertTitle>
                      {skippedRows} equipo{skippedRows !== 1 ? 's' : ''} se omitirán
                    </AlertTitle>
                    <AlertDescription>
                      Ya existen en el inventario con la misma serie. Esto es normal en modo
                      &quot;Solo agregar&quot;.
                    </AlertDescription>
                  </Alert>
                )}

              {step === 'preview' && errorCount === 0 && actionableRows > 0 && (
                <Alert className='border-green-200 bg-green-50 dark:bg-green-950/20'>
                  <CheckCircle2 className='h-4 w-4 text-green-700' />
                  <AlertTitle className='text-green-800 dark:text-green-300'>
                    Listo para importar
                  </AlertTitle>
                  <AlertDescription>
                    {createCount > 0 &&
                      `${createCount} equipo${createCount !== 1 ? 's' : ''} nuevo${createCount !== 1 ? 's' : ''}`}
                    {createCount > 0 && updateCount > 0 && ' · '}
                    {updateCount > 0 &&
                      `${updateCount} actualización${updateCount !== 1 ? 'es' : ''}`}
                    . Confirme cuando haya revisado la vista previa.
                  </AlertDescription>
                </Alert>
              )}

              {errorCount > 0 && (
                <div className='rounded-lg border border-destructive/30 overflow-hidden'>
                  <div className='bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive flex items-center gap-2'>
                    <AlertTriangle className='h-4 w-4' />
                    Errores y soluciones ({errorCount})
                  </div>
                  <div className='max-h-64 overflow-y-auto divide-y'>
                    {result.errors.map((err, i) => (
                      <div key={i} className='p-3 text-sm space-y-1'>
                        <div className='flex flex-wrap items-center gap-2'>
                          <Badge variant='outline' className='text-xs'>
                            Fila {err.row}
                          </Badge>
                          {err.serialNumber && (
                            <Badge variant='secondary' className='text-xs font-mono'>
                              {err.serialNumber}
                            </Badge>
                          )}
                          <span className='font-medium text-destructive'>
                            {err.fieldLabel ?? err.field}
                          </span>
                        </div>
                        <p className='text-destructive'>{err.message}</p>
                        {err.hint && (
                          <p className='text-muted-foreground flex gap-2'>
                            <Lightbulb className='h-4 w-4 shrink-0 text-amber-600 mt-0.5' />
                            <span>
                              <span className='font-medium text-foreground'>Solución:</span>{' '}
                              {err.hint}
                            </span>
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {result.preview && result.preview.length > 0 && (
                <div className='space-y-2'>
                  <p className='text-sm font-medium text-muted-foreground'>Vista previa por fila</p>
                  <div className='overflow-x-auto rounded-md border'>
                    <table className='w-full text-sm'>
                      <thead className='bg-muted/50'>
                        <tr>
                          <th className='px-3 py-2 text-left'>Fila</th>
                          <th className='px-3 py-2 text-left'>Acción</th>
                          <th className='px-3 py-2 text-left'>Serie</th>
                          <th className='px-3 py-2 text-left'>Condición</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.preview.slice(0, 20).map(row => (
                          <tr key={row.rowNumber} className='border-t'>
                            <td className='px-3 py-2'>{row.rowNumber}</td>
                            <td className='px-3 py-2'>
                              <span
                                className={cn(
                                  'text-xs font-medium',
                                  row.action === 'skip' && 'text-muted-foreground',
                                  row.action === 'update' && 'text-amber-700 dark:text-amber-400',
                                  row.action === 'create' && 'text-green-700 dark:text-green-400'
                                )}
                              >
                                {actionLabel(row.action)}
                              </span>
                            </td>
                            <td className='px-3 py-2'>{row.serialNumber}</td>
                            <td className='px-3 py-2'>{row.condition || row.reason || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {result.preview.length > 20 && (
                      <p className='text-xs text-muted-foreground p-2'>
                        Mostrando 20 de {result.preview.length} filas
                      </p>
                    )}
                  </div>
                </div>
              )}

              {step === 'done' && (
                <Alert className='border-green-200 bg-green-50 dark:bg-green-950/20'>
                  <CheckCircle2 className='h-4 w-4 text-green-700' />
                  <AlertTitle className='text-green-800 dark:text-green-300'>
                    Importación exitosa
                  </AlertTitle>
                  <AlertDescription>
                    Los equipos ya están disponibles en el inventario. Puede buscarlos por código o
                    número de serie.
                  </AlertDescription>
                </Alert>
              )}

              {step === 'done' && result.codes && result.codes.length > 0 && (
                <div className='flex items-center gap-2 text-sm text-green-700 dark:text-green-400'>
                  <CheckCircle2 className='h-4 w-4' />
                  Primer código: {result.codes[0]}
                  {result.codes.length > 1 && ` · Último: ${result.codes[result.codes.length - 1]}`}
                </div>
              )}

              <div className='flex justify-between'>
                {step === 'preview' ? (
                  <>
                    <Button type='button' variant='outline' onClick={() => setStep('upload')}>
                      Atrás
                    </Button>
                    <Button
                      type='button'
                      disabled={!result.valid || loading || errorCount > 0 || actionableRows === 0}
                      onClick={handleImport}
                    >
                      {loading && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
                      Importar {actionableRows} equipo{actionableRows !== 1 ? 's' : ''}
                    </Button>
                  </>
                ) : (
                  <Button type='button' onClick={() => router.push('/inventory')}>
                    Volver al inventario
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </ModuleLayout>
  )
}
