/**
 * Inventory Areas Tab Component
 * Per-family inventory configuration
 */

import {
  Package,
  RefreshCw,
  Layers,
  ChevronRight,
  Info,
  TrendingDown,
  FileText,
  Box,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FamilyIcon } from '@/components/inventory/family-badge'
import { SectionTable } from '@/components/families/section-table'
import type {
  AcquisitionMode,
  FormSection,
  AssetSubtype,
} from '@/lib/inventory/family-config-types'
import type { Family, FormState } from '@/hooks/use-inventory-settings'

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

interface InventoryAreasTabProps {
  families: Family[]
  selectedFamilyId: string | null
  selectedFamily: Family | undefined
  form: FormState
  loadingFamilies: boolean
  loadingConfig: boolean
  saving: boolean
  residualError: string | null
  activeModeTab: AcquisitionMode
  useModeConfig: boolean
  onSelectFamily: (id: string) => void
  onToggleInventory: (family: Family) => void
  onSetActiveModeTab: (mode: AcquisitionMode) => void
  onSetUseModeConfig: (v: boolean) => void
  onSetField: <K extends keyof FormState>(key: K, value: FormState[K]) => void
  onToggleSubtype: (subtype: AssetSubtype) => void
  onToggleVisible: (section: FormSection, checked: boolean) => void
  onToggleRequired: (section: FormSection, checked: boolean) => void
  onGetModeConfig: (mode: AcquisitionMode) => { visible: FormSection[]; required: FormSection[] }
  onSetModeVisible: (mode: AcquisitionMode, section: FormSection, checked: boolean) => void
  onSetModeRequired: (mode: AcquisitionMode, section: FormSection, checked: boolean) => void
  onValidateResidual: (val: string) => void
}

export function InventoryAreasTab({
  families,
  selectedFamilyId,
  selectedFamily,
  form,
  loadingFamilies,
  loadingConfig,
  saving,
  residualError,
  activeModeTab,
  useModeConfig,
  onSelectFamily,
  onToggleInventory,
  onSetActiveModeTab,
  onSetUseModeConfig,
  onSetField,
  onToggleSubtype,
  onToggleVisible,
  onToggleRequired,
  onGetModeConfig,
  onSetModeVisible,
  onSetModeRequired,
  onValidateResidual,
}: InventoryAreasTabProps) {
  return (
    <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
      {/* Family list */}
      <div className='lg:col-span-1'>
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-base flex items-center gap-2'>
              <Layers className='h-4 w-4' />
              Áreas
            </CardTitle>
            <CardDescription>Selecciona un área para configurar su inventario</CardDescription>
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
                      selectedFamilyId === family.id ? 'bg-primary/5 border-l-2 border-primary' : ''
                    }`}
                    onClick={() => onSelectFamily(family.id)}
                    role='button'
                    tabIndex={0}
                    onKeyDown={e => e.key === 'Enter' && onSelectFamily(family.id)}
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
                        <p className='text-xs text-muted-foreground font-mono'>{family.code}</p>
                      </div>
                    </div>
                    <div
                      className='flex items-center gap-1 flex-shrink-0 ml-2'
                      onClick={e => e.stopPropagation()}
                    >
                      <Switch
                        checked={family.inventoryEnabled ?? true}
                        onCheckedChange={() => onToggleInventory(family)}
                        className='scale-75'
                      />
                      <ChevronRight className='h-4 w-4 text-muted-foreground' />
                    </div>
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
            {/* Family header */}
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
              <div className='min-w-0 flex-1'>
                <h3 className='font-semibold truncate'>{selectedFamily?.name}</h3>
                <p className='text-xs text-muted-foreground font-mono'>{selectedFamily?.code}</p>
              </div>
              <Badge variant={form.inventoryEnabled ? 'default' : 'secondary'}>
                {form.inventoryEnabled ? 'Habilitado' : 'Deshabilitado'}
              </Badge>
            </div>

            {/* Asset types */}
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
                      onCheckedChange={() => onToggleSubtype(subtype)}
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

            {/* Form sections */}
            <Card>
              <CardHeader>
                <div className='flex items-start justify-between gap-4'>
                  <div>
                    <CardTitle className='text-base flex items-center gap-2'>
                      <FileText className='h-4 w-4' />
                      Secciones del formulario
                    </CardTitle>
                    <CardDescription>
                      Controla qué secciones se muestran y cuáles son obligatorias al crear activos
                    </CardDescription>
                  </div>
                  <div className='flex items-center gap-2 flex-shrink-0'>
                    <Switch
                      id='use-mode-config'
                      checked={useModeConfig}
                      onCheckedChange={onSetUseModeConfig}
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
                      Configura secciones distintas según la modalidad de adquisición del equipo
                    </p>
                    <div className='flex gap-2 flex-wrap'>
                      {ACQUISITION_MODES.map(m => (
                        <button
                          key={m.value}
                          type='button'
                          onClick={() => onSetActiveModeTab(m.value)}
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
                      visible={onGetModeConfig(activeModeTab).visible}
                      required={onGetModeConfig(activeModeTab).required}
                      onToggleVisible={(s, v) => onSetModeVisible(activeModeTab, s, v)}
                      onToggleRequired={(s, v) => onSetModeRequired(activeModeTab, s, v)}
                      disabled={saving}
                    />
                  </div>
                ) : (
                  <SectionTable
                    sections={ALL_SECTIONS}
                    visible={form.visibleSections}
                    required={form.requiredSections}
                    onToggleVisible={onToggleVisible}
                    onToggleRequired={onToggleRequired}
                    disabled={saving}
                  />
                )}
              </CardContent>
            </Card>

            {/* Registration rules */}
            <Card>
              <CardHeader>
                <CardTitle className='text-base'>Reglas de registro</CardTitle>
                <CardDescription>Comportamiento al crear y gestionar activos</CardDescription>
              </CardHeader>
              <CardContent className='space-y-2'>
                {(
                  [
                    {
                      id: 'require-financial',
                      label: 'Requerir datos financieros para nuevos activos',
                      desc: 'Obliga a completar la sección financiera al crear un activo',
                      key: 'requireFinancialForNew' as const,
                    },
                    {
                      id: 'require-delivery-act',
                      label: 'Requerir acta de entrega',
                      desc: 'Genera un acta de entrega al asignar un activo a un usuario',
                      key: 'requireDeliveryAct' as const,
                    },
                    {
                      id: 'auto-approve-decommission',
                      label: 'Auto-aprobar baja de activos',
                      desc: 'Las solicitudes de baja se aprueban automáticamente sin revisión',
                      key: 'autoApproveDecommission' as const,
                    },
                  ] as const
                ).map(item => (
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
                      onCheckedChange={v => onSetField(item.key, v)}
                      disabled={saving}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Default depreciation */}
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
                        onSetField('defaultDepreciationMethod', v === '__none__' ? null : v)
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
                      onChange={e => onSetField('defaultUsefulLifeYears', e.target.value)}
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
                        onSetField('defaultResidualValuePct', e.target.value)
                        onValidateResidual(e.target.value)
                      }}
                      placeholder='Ej: 10'
                      disabled={saving}
                      className={residualError ? 'border-destructive' : ''}
                    />
                    {residualError && <p className='text-xs text-destructive'>{residualError}</p>}
                  </div>
                </div>

                <Separator />

                <div className='space-y-1 max-w-xs'>
                  <Label htmlFor='code-prefix'>Prefijo de código de activo</Label>
                  <Input
                    id='code-prefix'
                    value={form.codePrefix}
                    onChange={e =>
                      onSetField('codePrefix', e.target.value.toUpperCase().slice(0, 10))
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
  )
}
