'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  Package,
  Save,
  RefreshCw,
  Layers,
  ChevronRight,
  Info,
  Settings,
  TrendingDown,
  FileText,
  Box,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FamilyIcon } from '@/components/inventory/family-badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/hooks/use-toast'
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { SectionTable } from '@/components/families/section-table'
import type {
  AssetSubtype,
  FormSection,
  AcquisitionMode,
  ModeSectionConfig,
} from '@/lib/inventory/family-config-types'
import { DEFAULT_FAMILY_CONFIG, DEFAULT_MODE_CONFIG } from '@/lib/inventory/family-config-types'

// ── Types ──────────────────────────────────────────────────────────────────

interface Family {
  id: string
  code: string
  name: string
  color?: string | null
  icon?: string | null
  isActive: boolean
}

interface RawConfig {
  familyId: string
  allowedSubtypes?: string[]
  visibleSections?: string[]
  requiredSections?: string[]
  requireFinancialForNew?: boolean
  sectionsByMode?: Record<string, unknown> | null
  defaultDepreciationMethod?: string | null
  defaultUsefulLifeYears?: number | null
  defaultResidualValuePct?: number | null
  codePrefix?: string | null
  autoApproveDecommission?: boolean
  requireDeliveryAct?: boolean
}

interface FormState {
  allowedSubtypes: AssetSubtype[]
  visibleSections: FormSection[]
  requiredSections: FormSection[]
  requireFinancialForNew: boolean
  sectionsByMode: Partial<Record<AcquisitionMode, ModeSectionConfig>>
  defaultDepreciationMethod: string | null
  defaultUsefulLifeYears: string
  defaultResidualValuePct: string
  codePrefix: string
  autoApproveDecommission: boolean
  requireDeliveryAct: boolean
}

// ── Constants ──────────────────────────────────────────────────────────────

const ALL_SUBTYPES: AssetSubtype[] = ['EQUIPMENT', 'MRO', 'LICENSE']
const ALL_SECTIONS: FormSection[] = [
  'FINANCIAL',
  'DEPRECIATION',
  'CONTRACT',
  'STOCK_MRO',
  'WAREHOUSE',
]

const SUBTYPE_LABELS: Record<AssetSubtype, string> = {
  EQUIPMENT: 'Equipo Físico',
  MRO: 'Material MRO',
  LICENSE: 'Contrato / Licencia',
}

const SUBTYPE_DESCRIPTIONS: Record<AssetSubtype, string> = {
  EQUIPMENT: 'Activos fijos y equipamiento físico',
  MRO: 'Mantenimiento, reparación y operaciones',
  LICENSE: 'Software, licencias y contratos digitales',
}

const ACQUISITION_MODES: { value: AcquisitionMode; label: string; help: string }[] = [
  { value: 'FIXED_ASSET', label: 'Activo Fijo', help: 'Compra directa — se deprecia' },
  { value: 'RENTAL', label: 'Arrendamiento', help: 'Pago mensual al proveedor' },
  { value: 'LOAN', label: 'Activo de Tercero', help: 'Préstamo sin costo' },
]

const DEPRECIATION_METHODS = [
  { value: 'STRAIGHT_LINE', label: 'Línea Recta' },
  { value: 'DECLINING_BALANCE', label: 'Saldo Decreciente' },
  { value: 'UNITS_OF_PRODUCTION', label: 'Unidades de Producción' },
]

// ── Helpers ────────────────────────────────────────────────────────────────

function buildForm(cfg: RawConfig | null): FormState {
  const sectionsByMode: Partial<Record<AcquisitionMode, ModeSectionConfig>> = {}
  if (cfg?.sectionsByMode && typeof cfg.sectionsByMode === 'object') {
    for (const mode of ['FIXED_ASSET', 'RENTAL', 'LOAN'] as AcquisitionMode[]) {
      const raw = (cfg.sectionsByMode as Record<string, unknown>)[mode]
      if (raw && typeof raw === 'object') {
        const r = raw as Record<string, unknown>
        sectionsByMode[mode] = {
          visible: Array.isArray(r.visible) ? (r.visible as FormSection[]) : [],
          required: Array.isArray(r.required) ? (r.required as FormSection[]) : [],
        }
      }
    }
  }
  return {
    allowedSubtypes:
      (cfg?.allowedSubtypes as AssetSubtype[]) ?? DEFAULT_FAMILY_CONFIG.allowedSubtypes,
    visibleSections:
      (cfg?.visibleSections as FormSection[]) ?? DEFAULT_FAMILY_CONFIG.visibleSections,
    requiredSections:
      (cfg?.requiredSections as FormSection[]) ?? DEFAULT_FAMILY_CONFIG.requiredSections,
    requireFinancialForNew: cfg?.requireFinancialForNew ?? true,
    sectionsByMode,
    defaultDepreciationMethod: cfg?.defaultDepreciationMethod ?? null,
    defaultUsefulLifeYears:
      cfg?.defaultUsefulLifeYears != null ? String(cfg.defaultUsefulLifeYears) : '',
    defaultResidualValuePct:
      cfg?.defaultResidualValuePct != null ? String(cfg.defaultResidualValuePct) : '',
    codePrefix: cfg?.codePrefix ?? '',
    autoApproveDecommission: cfg?.autoApproveDecommission ?? false,
    requireDeliveryAct: cfg?.requireDeliveryAct ?? true,
  }
}

// ── Main component ─────────────────────────────────────────────────────────

function InventorySettingsContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { toast } = useToast()

  const [families, setFamilies] = useState<Family[]>([])
  const [selectedFamilyId, setSelectedFamilyId] = useState<string | null>(
    searchParams.get('familyId')
  )
  const [form, setForm] = useState<FormState>(buildForm(null))
  const [loadingFamilies, setLoadingFamilies] = useState(true)
  const [loadingConfig, setLoadingConfig] = useState(false)
  const [saving, setSaving] = useState(false)
  const [residualError, setResidualError] = useState<string | null>(null)
  const [activeModeTab, setActiveModeTab] = useState<AcquisitionMode>('FIXED_ASSET')
  const [useModeConfig, setUseModeConfig] = useState(false)

  const loadFamilies = useCallback(async () => {
    setLoadingFamilies(true)
    try {
      const res = await fetch('/api/families?includeInactive=true')
      const data = await res.json()
      if (data.success) setFamilies(data.data)
    } catch {
      toast({ title: 'Error', description: 'Error al cargar familias', variant: 'destructive' })
    } finally {
      setLoadingFamilies(false)
    }
  }, [toast])

  const loadConfig = useCallback(
    async (familyId: string) => {
      setLoadingConfig(true)
      try {
        const res = await fetch(`/api/inventory/family-config/${familyId}`)
        const data = await res.json()
        if (data.success) {
          setForm(buildForm(data.data))
          setUseModeConfig(
            !!data.data.sectionsByMode && Object.keys(data.data.sectionsByMode).length > 0
          )
        }
      } catch {
        toast({
          title: 'Error',
          description: 'Error al cargar configuración',
          variant: 'destructive',
        })
      } finally {
        setLoadingConfig(false)
      }
    },
    [toast]
  )

  useEffect(() => {
    loadFamilies()
  }, [loadFamilies])
  useEffect(() => {
    if (selectedFamilyId) loadConfig(selectedFamilyId)
  }, [selectedFamilyId, loadConfig])

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm(prev => ({ ...prev, [key]: value }))

  const toggleSubtype = (subtype: AssetSubtype) =>
    setField(
      'allowedSubtypes',
      form.allowedSubtypes.includes(subtype)
        ? form.allowedSubtypes.filter(s => s !== subtype)
        : [...form.allowedSubtypes, subtype]
    )

  const toggleVisible = (section: FormSection, checked: boolean) => {
    if (checked) {
      setField('visibleSections', [...form.visibleSections, section])
    } else {
      setForm(prev => ({
        ...prev,
        visibleSections: prev.visibleSections.filter(s => s !== section),
        requiredSections: prev.requiredSections.filter(s => s !== section),
      }))
    }
  }

  const toggleRequired = (section: FormSection, checked: boolean) => {
    if (checked) {
      setForm(prev => ({
        ...prev,
        requiredSections: [...prev.requiredSections, section],
        visibleSections: prev.visibleSections.includes(section)
          ? prev.visibleSections
          : [...prev.visibleSections, section],
      }))
    } else {
      setField(
        'requiredSections',
        form.requiredSections.filter(s => s !== section)
      )
    }
  }

  const getModeConfig = (mode: AcquisitionMode): ModeSectionConfig =>
    form.sectionsByMode[mode] ?? { ...DEFAULT_MODE_CONFIG }

  const setModeVisible = (mode: AcquisitionMode, section: FormSection, checked: boolean) => {
    const current = getModeConfig(mode)
    const visible = checked
      ? [...current.visible, section]
      : current.visible.filter(s => s !== section)
    const required = checked ? current.required : current.required.filter(s => s !== section)
    setForm(prev => ({
      ...prev,
      sectionsByMode: { ...prev.sectionsByMode, [mode]: { visible, required } },
    }))
  }

  const setModeRequired = (mode: AcquisitionMode, section: FormSection, checked: boolean) => {
    const current = getModeConfig(mode)
    const required = checked
      ? [...current.required, section]
      : current.required.filter(s => s !== section)
    const visible = checked
      ? current.visible.includes(section)
        ? current.visible
        : [...current.visible, section]
      : current.visible
    setForm(prev => ({
      ...prev,
      sectionsByMode: { ...prev.sectionsByMode, [mode]: { visible, required } },
    }))
  }

  const validateResidual = (val: string) => {
    if (val === '') {
      setResidualError(null)
      return
    }
    const n = parseFloat(val)
    if (isNaN(n) || n < 0 || n > 100) setResidualError('Debe ser un valor entre 0 y 100')
    else setResidualError(null)
  }

  const handleSave = async () => {
    if (!selectedFamilyId) return
    if (residualError) return
    setSaving(true)
    try {
      const payload = {
        allowedSubtypes: form.allowedSubtypes,
        visibleSections: form.visibleSections,
        requiredSections: form.requiredSections,
        requireFinancialForNew: form.requireFinancialForNew,
        sectionsByMode: useModeConfig ? form.sectionsByMode : null,
        defaultDepreciationMethod: form.defaultDepreciationMethod || null,
        defaultUsefulLifeYears: form.defaultUsefulLifeYears
          ? parseFloat(form.defaultUsefulLifeYears)
          : null,
        defaultResidualValuePct: form.defaultResidualValuePct
          ? parseFloat(form.defaultResidualValuePct)
          : null,
        codePrefix: form.codePrefix || null,
        autoApproveDecommission: form.autoApproveDecommission,
        requireDeliveryAct: form.requireDeliveryAct,
      }
      const res = await fetch(`/api/inventory/family-config/${selectedFamilyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (data.success) {
        toast({ title: 'Guardado', description: 'Configuración actualizada correctamente' })
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Error al guardar',
          variant: 'destructive',
        })
      }
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleSelectFamily = (familyId: string) => {
    setSelectedFamilyId(familyId)
    router.replace(`/admin/settings/inventory?familyId=${familyId}`, { scroll: false })
  }

  const selectedFamily = families.find(f => f.id === selectedFamilyId)

  return (
    <ModuleLayout
      title='Configuración de Inventario'
      subtitle='Configura el comportamiento del módulo de inventario por área'
      headerActions={
        <div className='flex items-center gap-2'>
          <Button variant='outline' size='sm' onClick={loadFamilies} disabled={loadingFamilies}>
            <RefreshCw className={`h-4 w-4 ${loadingFamilies ? 'animate-spin' : ''} sm:mr-2`} />
            <span className='hidden sm:inline'>Recargar</span>
          </Button>
          <Button onClick={handleSave} disabled={saving || !selectedFamilyId || !!residualError}>
            <Save className={`h-4 w-4 ${saving ? 'animate-spin' : ''} sm:mr-2`} />
            <span className='hidden sm:inline'>{saving ? 'Guardando...' : 'Guardar cambios'}</span>
          </Button>
        </div>
      }
    >
      <Tabs defaultValue='areas' className='space-y-6'>
        <TabsList className='w-full sm:w-auto'>
          <TabsTrigger value='areas' className='flex-1 sm:flex-none flex items-center gap-2'>
            <Layers className='h-4 w-4' />
            Por área
          </TabsTrigger>
          <TabsTrigger value='global' className='flex-1 sm:flex-none flex items-center gap-2'>
            <Settings className='h-4 w-4' />
            Reglas generales
          </TabsTrigger>
        </TabsList>

        {/* ── TAB: POR ÁREA ── */}
        <TabsContent value='areas'>
          <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
            {/* Family list */}
            <div className='lg:col-span-1'>
              <Card>
                <CardHeader className='pb-2'>
                  <CardTitle className='text-base flex items-center gap-2'>
                    <Layers className='h-4 w-4' />
                    Áreas
                  </CardTitle>
                  <CardDescription>
                    Selecciona un área para configurar su inventario
                  </CardDescription>
                </CardHeader>
                <CardContent className='p-0'>
                  {loadingFamilies ? (
                    <div className='flex items-center justify-center py-8'>
                      <RefreshCw className='h-5 w-5 animate-spin text-muted-foreground' />
                    </div>
                  ) : (
                    <div className='divide-y'>
                      {families.map(family => (
                        <div
                          key={family.id}
                          className={`flex items-center justify-between p-3 hover:bg-muted/50 transition-colors cursor-pointer ${
                            selectedFamilyId === family.id
                              ? 'bg-primary/5 border-l-2 border-primary'
                              : ''
                          }`}
                          onClick={() => handleSelectFamily(family.id)}
                          role='button'
                          tabIndex={0}
                          onKeyDown={e => e.key === 'Enter' && handleSelectFamily(family.id)}
                        >
                          <div className='flex items-center gap-2 min-w-0 flex-1'>
                            <div
                              className='w-7 h-7 rounded-full flex items-center justify-center text-white flex-shrink-0'
                              style={{ backgroundColor: family.color || '#6B7280' }}
                            >
                              <FamilyIcon
                                icon={family.icon}
                                color={family.color}
                                code={family.code}
                                className='w-4 h-4'
                              />
                            </div>
                            <div className='min-w-0'>
                              <p className='text-sm font-medium leading-tight'>{family.name}</p>
                              <p className='text-xs text-muted-foreground font-mono'>
                                {family.code}
                              </p>
                            </div>
                          </div>
                          <ChevronRight className='h-4 w-4 text-muted-foreground flex-shrink-0' />
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Config panel */}
            <div className='lg:col-span-2 space-y-4'>
              {!selectedFamilyId ? (
                <Card>
                  <CardContent className='flex flex-col items-center justify-center py-16 text-muted-foreground'>
                    <Package className='h-12 w-12 mb-4 opacity-30' />
                    <p className='text-base font-medium'>Selecciona un área</p>
                    <p className='text-sm mt-1 text-center'>
                      Elige un área de la lista para configurar su inventario
                    </p>
                  </CardContent>
                </Card>
              ) : loadingConfig ? (
                <Card>
                  <CardContent className='flex items-center justify-center py-16'>
                    <RefreshCw className='h-6 w-6 animate-spin text-muted-foreground' />
                  </CardContent>
                </Card>
              ) : (
                <>
                  {/* Header */}
                  <div className='flex items-center gap-3 p-4 rounded-lg border bg-card'>
                    <div
                      className='w-10 h-10 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0'
                      style={{ backgroundColor: selectedFamily?.color || '#6B7280' }}
                    >
                      <FamilyIcon
                        icon={selectedFamily?.icon}
                        color={selectedFamily?.color}
                        code={selectedFamily?.code}
                        className='w-5 h-5'
                      />
                    </div>
                    <div className='min-w-0'>
                      <h3 className='font-semibold truncate'>{selectedFamily?.name}</h3>
                      <p className='text-xs text-muted-foreground font-mono'>
                        {selectedFamily?.code}
                      </p>
                    </div>
                    <Badge variant='default' className='ml-auto flex-shrink-0'>
                      Inventario activo
                    </Badge>
                  </div>

                  {/* Tipos de activos */}
                  <Card>
                    <CardHeader>
                      <CardTitle className='text-base flex items-center gap-2'>
                        <Box className='h-4 w-4' />
                        Tipos de activos permitidos
                      </CardTitle>
                      <CardDescription>
                        Define qué tipos de activos puede gestionar esta área
                      </CardDescription>
                    </CardHeader>
                    <CardContent className='space-y-2'>
                      {ALL_SUBTYPES.map(subtype => (
                        <div
                          key={subtype}
                          className='flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/30 transition-colors'
                        >
                          <Checkbox
                            id={`subtype-${subtype}`}
                            checked={form.allowedSubtypes.includes(subtype)}
                            onCheckedChange={() => toggleSubtype(subtype)}
                            disabled={saving}
                            className='mt-0.5'
                          />
                          <div className='flex-1'>
                            <label
                              htmlFor={`subtype-${subtype}`}
                              className='text-sm font-medium cursor-pointer'
                            >
                              {SUBTYPE_LABELS[subtype]}
                            </label>
                            <p className='text-xs text-muted-foreground mt-0.5'>
                              {SUBTYPE_DESCRIPTIONS[subtype]}
                            </p>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  {/* Secciones del formulario */}
                  <Card>
                    <CardHeader>
                      <div className='flex items-start justify-between gap-4'>
                        <div>
                          <CardTitle className='text-base flex items-center gap-2'>
                            <FileText className='h-4 w-4' />
                            Secciones del formulario
                          </CardTitle>
                          <CardDescription>
                            Controla qué secciones se muestran y cuáles son obligatorias al crear
                            activos
                          </CardDescription>
                        </div>
                        <div className='flex items-center gap-2 flex-shrink-0'>
                          <Switch
                            id='use-mode-config'
                            checked={useModeConfig}
                            onCheckedChange={setUseModeConfig}
                            disabled={saving}
                          />
                          <Label
                            htmlFor='use-mode-config'
                            className='text-xs cursor-pointer whitespace-nowrap'
                          >
                            Por modalidad
                          </Label>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {useModeConfig ? (
                        <div className='space-y-3'>
                          <p className='text-xs text-muted-foreground flex items-center gap-1.5'>
                            <Info className='h-3.5 w-3.5' />
                            Configura secciones distintas según la modalidad de adquisición del
                            equipo
                          </p>
                          <div className='flex gap-2 flex-wrap'>
                            {ACQUISITION_MODES.map(m => (
                              <button
                                key={m.value}
                                type='button'
                                onClick={() => setActiveModeTab(m.value)}
                                className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                                  activeModeTab === m.value
                                    ? 'bg-primary text-primary-foreground border-primary'
                                    : 'bg-background border-border hover:bg-muted'
                                }`}
                              >
                                {m.label}
                                <span className='ml-1.5 text-xs opacity-70'>({m.help})</span>
                              </button>
                            ))}
                          </div>
                          <SectionTable
                            sections={ALL_SECTIONS}
                            visible={getModeConfig(activeModeTab).visible}
                            required={getModeConfig(activeModeTab).required}
                            onToggleVisible={(s, v) => setModeVisible(activeModeTab, s, v)}
                            onToggleRequired={(s, v) => setModeRequired(activeModeTab, s, v)}
                            disabled={saving}
                          />
                        </div>
                      ) : (
                        <SectionTable
                          sections={ALL_SECTIONS}
                          visible={form.visibleSections}
                          required={form.requiredSections}
                          onToggleVisible={toggleVisible}
                          onToggleRequired={toggleRequired}
                          disabled={saving}
                        />
                      )}
                    </CardContent>
                  </Card>

                  {/* Reglas de registro */}
                  <Card>
                    <CardHeader>
                      <CardTitle className='text-base'>Reglas de registro</CardTitle>
                      <CardDescription>Comportamiento al crear y gestionar activos</CardDescription>
                    </CardHeader>
                    <CardContent className='space-y-2'>
                      {[
                        {
                          id: 'require-financial',
                          label: 'Requerir datos financieros para nuevos activos',
                          desc: 'Obliga a completar la sección financiera al crear un activo',
                          key: 'requireFinancialForNew' as const,
                        },
                        {
                          id: 'require-delivery-act',
                          label: 'Requerir acta de entrega',
                          desc: 'Se genera un acta de entrega al asignar activos de esta familia',
                          key: 'requireDeliveryAct' as const,
                        },
                        {
                          id: 'auto-approve-decommission',
                          label: 'Auto-aprobar baja de activos',
                          desc: 'Las solicitudes de baja se aprueban automáticamente sin revisión',
                          key: 'autoApproveDecommission' as const,
                        },
                      ].map(item => (
                        <div
                          key={item.id}
                          className='flex items-center justify-between p-3 border rounded-lg'
                        >
                          <div>
                            <p className='text-sm font-medium'>{item.label}</p>
                            <p className='text-xs text-muted-foreground'>{item.desc}</p>
                          </div>
                          <Switch
                            id={item.id}
                            checked={form[item.key] as boolean}
                            onCheckedChange={v => setField(item.key, v)}
                            disabled={saving}
                          />
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  {/* Depreciación por defecto */}
                  <Card>
                    <CardHeader>
                      <CardTitle className='text-base flex items-center gap-2'>
                        <TrendingDown className='h-4 w-4' />
                        Depreciación por defecto
                      </CardTitle>
                      <CardDescription>
                        Valores pre-cargados al crear activos fijos en esta área
                      </CardDescription>
                    </CardHeader>
                    <CardContent className='space-y-4'>
                      <div className='grid grid-cols-1 sm:grid-cols-3 gap-4'>
                        <div className='space-y-1'>
                          <Label htmlFor='depreciation-method'>Método</Label>
                          <Select
                            value={form.defaultDepreciationMethod ?? '__none__'}
                            onValueChange={v =>
                              setField('defaultDepreciationMethod', v === '__none__' ? null : v)
                            }
                            disabled={saving}
                          >
                            <SelectTrigger id='depreciation-method'>
                              <SelectValue placeholder='Sin método por defecto' />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value='__none__'>Sin método por defecto</SelectItem>
                              {DEPRECIATION_METHODS.map(m => (
                                <SelectItem key={m.value} value={m.value}>
                                  {m.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className='space-y-1'>
                          <Label htmlFor='useful-life'>Vida útil (años)</Label>
                          <Input
                            id='useful-life'
                            type='number'
                            min={0}
                            step={0.5}
                            value={form.defaultUsefulLifeYears}
                            onChange={e => setField('defaultUsefulLifeYears', e.target.value)}
                            placeholder='Ej: 5'
                            disabled={saving}
                          />
                        </div>
                        <div className='space-y-1'>
                          <Label htmlFor='residual-pct'>Valor residual (%)</Label>
                          <Input
                            id='residual-pct'
                            type='number'
                            min={0}
                            max={100}
                            step={0.01}
                            value={form.defaultResidualValuePct}
                            onChange={e => {
                              setField('defaultResidualValuePct', e.target.value)
                              validateResidual(e.target.value)
                            }}
                            placeholder='Ej: 10'
                            disabled={saving}
                            className={residualError ? 'border-destructive' : ''}
                          />
                          {residualError && (
                            <p className='text-xs text-destructive'>{residualError}</p>
                          )}
                        </div>
                      </div>

                      <Separator />

                      <div className='space-y-1 max-w-xs'>
                        <Label htmlFor='code-prefix'>Prefijo de código de activo</Label>
                        <Input
                          id='code-prefix'
                          value={form.codePrefix}
                          onChange={e =>
                            setField('codePrefix', e.target.value.toUpperCase().slice(0, 10))
                          }
                          placeholder={`Ej: ${selectedFamily?.code || 'IT'}`}
                          maxLength={10}
                          disabled={saving}
                          className='font-mono'
                        />
                        <p className='text-xs text-muted-foreground'>
                          Ejemplo:{' '}
                          <span className='font-mono'>
                            {form.codePrefix || selectedFamily?.code || 'IT'}-2026-0001
                          </span>
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ── TAB: REGLAS GENERALES ── */}
        <TabsContent value='global'>
          <div className='max-w-2xl space-y-6'>
            <div className='flex items-start gap-3 p-4 rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800'>
              <Info className='h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0' />
              <p className='text-sm text-blue-800 dark:text-blue-300'>
                Estas reglas aplican a <strong>todo el módulo de inventario</strong>. Cada área
                puede personalizar su configuración en la pestaña &quot;Por área&quot;.
              </p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className='text-base'>Resumen de configuración por área</CardTitle>
                <CardDescription>
                  Estado actual de la configuración de inventario en cada área
                </CardDescription>
              </CardHeader>
              <CardContent className='p-0'>
                {loadingFamilies ? (
                  <div className='flex items-center justify-center py-8'>
                    <RefreshCw className='h-5 w-5 animate-spin text-muted-foreground' />
                  </div>
                ) : (
                  <div className='divide-y'>
                    {families.map(family => (
                      <div
                        key={family.id}
                        className='flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors cursor-pointer'
                        onClick={() => {
                          handleSelectFamily(family.id)
                          // Switch to areas tab by triggering a click on the tab
                          const areasTab = document.querySelector(
                            '[data-value="areas"]'
                          ) as HTMLElement
                          areasTab?.click()
                        }}
                        role='button'
                        tabIndex={0}
                        onKeyDown={e => e.key === 'Enter' && handleSelectFamily(family.id)}
                      >
                        <div className='flex items-center gap-3'>
                          <div
                            className='w-7 h-7 rounded-full flex items-center justify-center text-white flex-shrink-0'
                            style={{ backgroundColor: family.color || '#6B7280' }}
                          >
                            <FamilyIcon
                              icon={family.icon}
                              color={family.color}
                              code={family.code}
                              className='w-4 h-4'
                            />
                          </div>
                          <div>
                            <p className='text-sm font-medium'>{family.name}</p>
                            <p className='text-xs text-muted-foreground font-mono'>{family.code}</p>
                          </div>
                        </div>
                        <div className='flex items-center gap-2'>
                          <Badge
                            variant={family.isActive ? 'default' : 'secondary'}
                            className='text-xs'
                          >
                            {family.isActive ? 'Activa' : 'Inactiva'}
                          </Badge>
                          <ChevronRight className='h-4 w-4 text-muted-foreground' />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </ModuleLayout>
  )
}

export default function InventorySettingsPage() {
  return (
    <Suspense
      fallback={
        <ModuleLayout title='Configuración de Inventario' loading={true}>
          <div />
        </ModuleLayout>
      }
    >
      <InventorySettingsContent />
    </Suspense>
  )
}
