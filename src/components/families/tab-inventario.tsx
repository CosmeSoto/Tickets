'use client'

/**
 * TabInventario — Pestaña Inventario de la página de detalle de familia
 * Muestra y edita la configuración de inventory_family_config.
 * Requisitos: 4.1, 4.2, 4.3, 4.4, 4.5
 */

import { useState } from 'react'
import { Package, RefreshCw, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { SectionTable, HelpTip } from '@/components/families/section-table'
import type {
  AssetSubtype,
  FormSection,
  AcquisitionMode,
  ModeSectionConfig,
} from '@/lib/inventory/family-config-types'
import { DEFAULT_FAMILY_CONFIG, DEFAULT_MODE_CONFIG } from '@/lib/inventory/family-config-types'

// ---- Types ----

type DepreciationMethod = 'LINEAR' | 'DECLINING_BALANCE' | 'UNITS_OF_PRODUCTION'

const DEPRECIATION_METHOD_LABELS: Record<DepreciationMethod, string> = {
  LINEAR: 'Línea Recta',
  DECLINING_BALANCE: 'Saldo Decreciente',
  UNITS_OF_PRODUCTION: 'Unidades de Producción',
}

const SUBTYPE_LABELS: Record<AssetSubtype, string> = {
  EQUIPMENT: 'Equipo Físico',
  MRO: 'Material MRO',
  LICENSE: 'Contrato / Licencia',
}

const ACQUISITION_MODES: { value: AcquisitionMode; label: string; help: string }[] = [
  { value: 'FIXED_ASSET', label: 'Activo Fijo', help: 'Compra directa — se deprecia' },
  { value: 'RENTAL', label: 'Arrendamiento', help: 'Pago mensual al proveedor' },
  { value: 'LOAN', label: 'Activo de Tercero', help: 'Préstamo sin costo' },
]

const ALL_SUBTYPES: AssetSubtype[] = ['EQUIPMENT', 'MRO', 'LICENSE']
const ALL_SECTIONS: FormSection[] = [
  'FINANCIAL',
  'DEPRECIATION',
  'CONTRACT',
  'STOCK_MRO',
  'WAREHOUSE',
]

export interface InventoryFamilyConfig {
  id?: string
  familyId?: string
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

interface TabInventarioProps {
  familyId: string
  inventoryConfig: InventoryFamilyConfig | null
  onConfigUpdated: (config: InventoryFamilyConfig) => void
}

// ---- Form state ----

interface FormState {
  allowedSubtypes: AssetSubtype[]
  visibleSections: FormSection[]
  requiredSections: FormSection[]
  requireFinancialForNew: boolean
  sectionsByMode: Partial<Record<AcquisitionMode, ModeSectionConfig>>
  defaultDepreciationMethod: DepreciationMethod | null
  defaultUsefulLifeYears: string
  defaultResidualValuePct: string
  codePrefix: string
  autoApproveDecommission: boolean
  requireDeliveryAct: boolean
}

function buildInitialForm(cfg: InventoryFamilyConfig | null): FormState {
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
    allowedSubtypes: (cfg?.allowedSubtypes as AssetSubtype[]) ?? DEFAULT_FAMILY_CONFIG.allowedSubtypes,
    visibleSections: (cfg?.visibleSections as FormSection[]) ?? DEFAULT_FAMILY_CONFIG.visibleSections,
    requiredSections: (cfg?.requiredSections as FormSection[]) ?? DEFAULT_FAMILY_CONFIG.requiredSections,
    requireFinancialForNew: cfg?.requireFinancialForNew ?? true,
    sectionsByMode,
    defaultDepreciationMethod: (cfg?.defaultDepreciationMethod as DepreciationMethod) ?? null,
    defaultUsefulLifeYears:
      cfg?.defaultUsefulLifeYears != null ? String(cfg.defaultUsefulLifeYears) : '',
    defaultResidualValuePct:
      cfg?.defaultResidualValuePct != null ? String(cfg.defaultResidualValuePct) : '',
    codePrefix: cfg?.codePrefix ?? '',
    autoApproveDecommission: cfg?.autoApproveDecommission ?? false,
    requireDeliveryAct: cfg?.requireDeliveryAct ?? true,
  }
}

// ---- Component ----

export function TabInventario({ familyId, inventoryConfig, onConfigUpdated }: TabInventarioProps) {
  const { toast } = useToast()
  const [form, setForm] = useState<FormState>(() => buildInitialForm(inventoryConfig))
  const [saving, setSaving] = useState(false)
  const [residualError, setResidualError] = useState<string | null>(null)
  const [activeModeTab, setActiveModeTab] = useState<AcquisitionMode>('FIXED_ASSET')

  // ---- Helpers ----

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const toggleSubtype = (subtype: AssetSubtype) =>
    setField(
      'allowedSubtypes',
      form.allowedSubtypes.includes(subtype)
        ? form.allowedSubtypes.filter((s) => s !== subtype)
        : [...form.allowedSubtypes, subtype]
    )

  const toggleVisible = (section: FormSection, checked: boolean) => {
    if (checked) {
      setField('visibleSections', [...form.visibleSections, section])
    } else {
      setForm((prev) => ({
        ...prev,
        visibleSections: prev.visibleSections.filter((s) => s !== section),
        requiredSections: prev.requiredSections.filter((s) => s !== section),
      }))
    }
  }

  const toggleRequired = (section: FormSection, checked: boolean) => {
    if (checked) {
      setForm((prev) => ({
        ...prev,
        requiredSections: [...prev.requiredSections, section],
        visibleSections: prev.visibleSections.includes(section)
          ? prev.visibleSections
          : [...prev.visibleSections, section],
      }))
    } else {
      setField('requiredSections', form.requiredSections.filter((s) => s !== section))
    }
  }

  const getModeConfig = (mode: AcquisitionMode): ModeSectionConfig =>
    form.sectionsByMode[mode] ?? { ...DEFAULT_MODE_CONFIG }

  const setModeVisible = (mode: AcquisitionMode, section: FormSection, checked: boolean) => {
    const current = getModeConfig(mode)
    const visible = checked
      ? [...current.visible, section]
      : current.visible.filter((s) => s !== section)
    const required = checked ? current.required : current.required.filter((s) => s !== section)
    setForm((prev) => ({
      ...prev,
      sectionsByMode: { ...prev.sectionsByMode, [mode]: { visible, required } },
    }))
  }

  const setModeRequired = (mode: AcquisitionMode, section: FormSection, checked: boolean) => {
    const current = getModeConfig(mode)
    const required = checked
      ? [...current.required, section]
      : current.required.filter((s) => s !== section)
    const visible =
      checked && !current.visible.includes(section)
        ? [...current.visible, section]
        : current.visible
    setForm((prev) => ({
      ...prev,
      sectionsByMode: { ...prev.sectionsByMode, [mode]: { visible, required } },
    }))
  }

  // ---- Validation ----

  const validateResidual = (value: string): boolean => {
    if (value === '') return true
    const num = parseFloat(value)
    if (isNaN(num) || num < 0 || num > 100) {
      setResidualError('El porcentaje de valor residual debe estar entre 0 y 100')
      return false
    }
    setResidualError(null)
    return true
  }

  // ---- Save ----

  const handleSave = async () => {
    if (!validateResidual(form.defaultResidualValuePct)) return
    if (form.allowedSubtypes.length === 0) {
      toast({
        title: 'Error',
        description: 'Debes permitir al menos un subtipo',
        variant: 'destructive',
      })
      return
    }

    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        allowedSubtypes: form.allowedSubtypes,
        visibleSections: form.visibleSections,
        requiredSections: form.requiredSections,
        requireFinancialForNew: form.requireFinancialForNew,
        sectionsByMode:
          form.allowedSubtypes.includes('EQUIPMENT') &&
          Object.keys(form.sectionsByMode).length > 0
            ? form.sectionsByMode
            : null,
        defaultDepreciationMethod: form.defaultDepreciationMethod,
        defaultUsefulLifeYears:
          form.defaultUsefulLifeYears !== '' ? parseFloat(form.defaultUsefulLifeYears) : null,
        defaultResidualValuePct:
          form.defaultResidualValuePct !== '' ? parseFloat(form.defaultResidualValuePct) : null,
        codePrefix: form.codePrefix.trim() || null,
        autoApproveDecommission: form.autoApproveDecommission,
        requireDeliveryAct: form.requireDeliveryAct,
      }

      const res = await fetch(`/api/admin/families/${familyId}/inventory`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) {
        toast({
          title: 'Error',
          description: data.error || 'Error al guardar la configuración',
          variant: 'destructive',
        })
        return
      }

      toast({
        title: res.status === 201 ? 'Configuración creada' : 'Configuración actualizada',
        description: 'Los cambios se guardaron correctamente',
      })
      onConfigUpdated(data as InventoryFamilyConfig)
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  // ---- Render ----

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Package className="h-4 w-4" />
                Configuración de Inventario
              </CardTitle>
              <CardDescription>
                Gestiona subtipos, secciones y comportamientos de inventario para esta familia
              </CardDescription>
            </div>
            {inventoryConfig ? (
              <Badge variant="outline" className="text-xs">
                Configuración existente
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-xs">
                Sin configuración
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* ── Subtipos permitidos ── */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Subtipos permitidos
              </Label>
              <HelpTip text="Define qué categorías de activo se pueden registrar bajo esta familia." />
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 rounded-md border bg-muted/20 px-3 py-2.5">
              {ALL_SUBTYPES.map((subtype) => (
                <div key={subtype} className="flex items-center gap-2">
                  <Checkbox
                    id={`sub-${subtype}`}
                    checked={form.allowedSubtypes.includes(subtype)}
                    onCheckedChange={() => toggleSubtype(subtype)}
                    disabled={saving}
                  />
                  <Label htmlFor={`sub-${subtype}`} className="cursor-pointer font-normal">
                    {SUBTYPE_LABELS[subtype]}
                  </Label>
                </div>
              ))}
            </div>
            {form.allowedSubtypes.length === 0 && (
              <p className="text-xs text-destructive">Selecciona al menos un subtipo</p>
            )}
          </div>

          <Separator />

          {/* ── Secciones del formulario ── Req 4.4 */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Secciones del formulario
              </Label>
              <HelpTip text="Controla qué bloques de campos ve el usuario al registrar un activo." />
            </div>

            {form.allowedSubtypes.includes('EQUIPMENT') ? (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Para equipos físicos puedes configurar las secciones por modalidad de adquisición.
                </p>
                {/* Mode tabs — Req 4.4 */}
                <div className="flex gap-1 rounded-lg bg-muted p-1">
                  {ACQUISITION_MODES.map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setActiveModeTab(m.value)}
                      className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                        activeModeTab === m.value
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground italic bg-muted/40 rounded px-2 py-1">
                  {ACQUISITION_MODES.find((m) => m.value === activeModeTab)?.help}
                </p>
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
          </div>

          <Separator />

          {/* ── Reglas de registro ── */}
          <div className="space-y-3">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Reglas de registro
            </Label>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="require-financial" className="text-sm font-medium cursor-pointer">
                  Requerir datos financieros para nuevos activos
                </Label>
                <p className="text-xs text-muted-foreground">
                  Obliga a completar la sección financiera al crear un activo
                </p>
              </div>
              <Switch
                id="require-financial"
                checked={form.requireFinancialForNew}
                onCheckedChange={(v) => setField('requireFinancialForNew', v)}
                disabled={saving}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label
                  htmlFor="auto-approve-decommission"
                  className="text-sm font-medium cursor-pointer"
                >
                  Auto-aprobar baja de activos
                </Label>
                <p className="text-xs text-muted-foreground">
                  Las solicitudes de baja se aprueban automáticamente
                </p>
              </div>
              <Switch
                id="auto-approve-decommission"
                checked={form.autoApproveDecommission}
                onCheckedChange={(v) => setField('autoApproveDecommission', v)}
                disabled={saving}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="require-delivery-act" className="text-sm font-medium cursor-pointer">
                  Requerir acta de entrega
                </Label>
                <p className="text-xs text-muted-foreground">
                  Se genera un acta de entrega al asignar activos de esta familia
                </p>
              </div>
              <Switch
                id="require-delivery-act"
                checked={form.requireDeliveryAct}
                onCheckedChange={(v) => setField('requireDeliveryAct', v)}
                disabled={saving}
              />
            </div>
          </div>

          <Separator />

          {/* ── Depreciación por defecto ── */}
          <div className="space-y-3">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Depreciación por defecto
            </Label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* defaultDepreciationMethod */}
              <div className="space-y-1">
                <Label htmlFor="depreciation-method">Método de depreciación</Label>
                <Select
                  value={form.defaultDepreciationMethod ?? '__none__'}
                  onValueChange={(v) =>
                    setField(
                      'defaultDepreciationMethod',
                      v === '__none__' ? null : (v as DepreciationMethod)
                    )
                  }
                  disabled={saving}
                >
                  <SelectTrigger id="depreciation-method">
                    <SelectValue placeholder="Sin método por defecto" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin método por defecto</SelectItem>
                    {(Object.keys(DEPRECIATION_METHOD_LABELS) as DepreciationMethod[]).map((m) => (
                      <SelectItem key={m} value={m}>
                        {DEPRECIATION_METHOD_LABELS[m]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* defaultUsefulLifeYears */}
              <div className="space-y-1">
                <Label htmlFor="useful-life">Vida útil por defecto (años)</Label>
                <Input
                  id="useful-life"
                  type="number"
                  min={0}
                  step={0.5}
                  value={form.defaultUsefulLifeYears}
                  onChange={(e) => setField('defaultUsefulLifeYears', e.target.value)}
                  placeholder="Ej: 5"
                  disabled={saving}
                />
              </div>

              {/* defaultResidualValuePct — Req 4.5 */}
              <div className="space-y-1">
                <Label htmlFor="residual-pct">Valor residual por defecto (%)</Label>
                <Input
                  id="residual-pct"
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  value={form.defaultResidualValuePct}
                  onChange={(e) => {
                    setField('defaultResidualValuePct', e.target.value)
                    validateResidual(e.target.value)
                  }}
                  placeholder="Ej: 10"
                  disabled={saving}
                  className={residualError ? 'border-destructive' : ''}
                />
                {residualError && (
                  <p className="text-xs text-destructive">{residualError}</p>
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* ── Código y comportamientos ── */}
          <div className="space-y-3">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Código de activo
            </Label>
            <div className="max-w-xs space-y-1">
              <Label htmlFor="code-prefix">Prefijo de código</Label>
              <Input
                id="code-prefix"
                value={form.codePrefix}
                onChange={(e) => setField('codePrefix', e.target.value)}
                placeholder="Ej: IT, HR, FIN"
                maxLength={10}
                disabled={saving}
              />
              <p className="text-xs text-muted-foreground">
                Prefijo para los códigos de activo de esta familia (máx. 10 caracteres)
              </p>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={handleSave} disabled={saving || !!residualError}>
              {saving ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Guardar cambios
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
