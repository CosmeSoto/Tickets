'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  Settings, Package, Save, RefreshCw, XCircle,
  Layers, ChevronRight, Box, FileText, Warehouse,
  TrendingDown, FileCheck, Info, ExternalLink,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FamilyIcon } from '@/components/inventory/family-badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { Checkbox } from '@/components/ui/checkbox'

interface Family {
  id: string
  code: string
  name: string
  color?: string | null
  icon?: string | null
  isActive: boolean
}

interface InventoryFamilyConfig {
  id?: string
  familyId: string
  allowedSubtypes: string[]
  visibleSections: string[]
  requiredSections: string[]
  requireFinancialForNew: boolean
  sectionsByMode?: Record<string, { visible: string[]; required: string[] }> | null
  defaultDepreciationMethod?: string | null
  defaultUsefulLifeYears?: number | null
  defaultResidualValuePct?: number | null
  codePrefix?: string | null
  autoApproveDecommission: boolean
  requireDeliveryAct: boolean
  inventoryEnabled?: boolean
}

const ASSET_SUBTYPES = [
  { value: 'EQUIPMENT', label: 'Equipos', icon: Box, description: 'Activos fijos y equipamiento' },
  { value: 'MRO', label: 'MRO', icon: Package, description: 'Mantenimiento, reparación y operaciones' },
  { value: 'LICENSE', label: 'Licencias', icon: FileText, description: 'Software y licencias digitales' },
]

const FORM_SECTIONS = [
  { value: 'FINANCIAL', label: 'Financiero', description: 'Costo, valor, proveedor' },
  { value: 'DEPRECIATION', label: 'Depreciación', description: 'Método, vida útil, valor residual' },
  { value: 'CONTRACT', label: 'Contrato', description: 'Vinculación con contratos' },
  { value: 'STOCK_MRO', label: 'Stock MRO', description: 'Inventario y existencias' },
  { value: 'WAREHOUSE', label: 'Almacén', description: 'Ubicación física' },
]

const DEPRECIATION_METHODS = [
  { value: 'STRAIGHT_LINE', label: 'Línea Recta' },
  { value: 'DECLINING_BALANCE', label: 'Saldo Decreciente' },
  { value: 'UNITS_OF_PRODUCTION', label: 'Unidades de Producción' },
]

function InventorySettingsContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { toast } = useToast()
  const { data: session } = useSession()
  // isSuperAdmin available for future role-based restrictions
  void session

  const [families, setFamilies] = useState<Family[]>([])
  const [selectedFamilyId, setSelectedFamilyId] = useState<string | null>(
    searchParams.get('familyId')
  )
  const [config, setConfig] = useState<InventoryFamilyConfig | null>(null)
  const [loadingFamilies, setLoadingFamilies] = useState(true)
  const [loadingConfig, setLoadingConfig] = useState(false)
  const [saving, setSaving] = useState(false)

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

  const loadConfig = useCallback(async (familyId: string) => {
    setLoadingConfig(true)
    try {
      const res = await fetch(`/api/inventory/family-config/${familyId}`)
      const data = await res.json()
      if (data.success) {
        setConfig(data.data)
        // Mostrar sección avanzada si hay configuración por modo
        if (data.data.sectionsByMode) {
          setShowAdvanced(true)
        }
      }
    } catch {
      toast({ title: 'Error', description: 'Error al cargar configuración', variant: 'destructive' })
    } finally {
      setLoadingConfig(false)
    }
  }, [toast])

  useEffect(() => {
    loadFamilies()
  }, [loadFamilies])

  useEffect(() => {
    if (selectedFamilyId) loadConfig(selectedFamilyId)
  }, [selectedFamilyId, loadConfig])

  const handleSelectFamily = (familyId: string) => {
    setSelectedFamilyId(familyId)
    router.replace(`/admin/settings/inventory?familyId=${familyId}`, { scroll: false })
  }

  const handleSave = async () => {
    if (!config || !selectedFamilyId) return

    setSaving(true)
    try {
      const res = await fetch(`/api/inventory/family-config/${selectedFamilyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      const data = await res.json()
      if (data.success) {
        toast({ title: 'Guardado', description: 'Configuración actualizada correctamente' })
        loadConfig(selectedFamilyId)
      } else {
        toast({ title: 'Error', description: data.error || 'Error al guardar', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const toggleSubtype = (subtype: string) => {
    if (!config) return
    const current = config.allowedSubtypes || []
    const next = current.includes(subtype)
      ? current.filter((s) => s !== subtype)
      : [...current, subtype]
    setConfig({ ...config, allowedSubtypes: next })
  }

  const toggleSection = (section: string, type: 'visible' | 'required') => {
    if (!config) return
    const key = type === 'visible' ? 'visibleSections' : 'requiredSections'
    const current = config[key] || []
    const next = current.includes(section)
      ? current.filter((s) => s !== section)
      : [...current, section]
    setConfig({ ...config, [key]: next })
  }

  const selectedFamily = families.find((f) => f.id === selectedFamilyId)

  return (
    <ModuleLayout
      title="Configuración de Inventario"
      subtitle="Configura el comportamiento del módulo de inventario por área"
      headerActions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadFamilies} disabled={loadingFamilies}>
            <RefreshCw className={`h-4 w-4 ${loadingFamilies ? 'animate-spin' : ''} sm:mr-2`} />
            <span className="hidden sm:inline">Recargar</span>
          </Button>
          <Button onClick={handleSave} disabled={saving || !config}>
            <Save className={`h-4 w-4 ${saving ? 'animate-spin' : ''} sm:mr-2`} />
            <span className="hidden sm:inline">{saving ? 'Guardando...' : 'Guardar cambios'}</span>
          </Button>
        </div>
      }
    >
      <Tabs defaultValue="areas" className="space-y-6">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="areas" className="flex-1 sm:flex-none flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Por área
          </TabsTrigger>
          <TabsTrigger value="global" className="flex-1 sm:flex-none flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Reglas generales
          </TabsTrigger>
        </TabsList>

        {/* TAB: POR ÁREA */}
        <TabsContent value="areas">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Layers className="h-4 w-4" />
                    Áreas
                  </CardTitle>
                  <CardDescription>
                    Selecciona un área para configurar su inventario
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  {loadingFamilies ? (
                    <div className="flex items-center justify-center py-8">
                      <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <div className="divide-y">
                      {families.map((family) => (
                        <div
                          key={family.id}
                          className={`flex items-center justify-between p-3 hover:bg-muted/50 transition-colors cursor-pointer ${
                            selectedFamilyId === family.id ? 'bg-primary/5 border-l-2 border-primary' : ''
                          }`}
                          onClick={() => handleSelectFamily(family.id)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => e.key === 'Enter' && handleSelectFamily(family.id)}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <div
                              className="w-7 h-7 rounded-full flex items-center justify-center text-white flex-shrink-0"
                              style={{ backgroundColor: family.color || '#6B7280' }}
                            >
                              <FamilyIcon icon={family.icon} color={family.color} code={family.code} className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium leading-tight">{family.name}</p>
                              <p className="text-xs text-muted-foreground font-mono">{family.code}</p>
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-2 space-y-4">
              {!selectedFamilyId ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <Package className="h-12 w-12 mb-4 opacity-30" />
                    <p className="text-base font-medium">Selecciona un área</p>
                    <p className="text-sm mt-1 text-center">Elige un área de la lista para configurar su inventario</p>
                  </CardContent>
                </Card>
              ) : loadingConfig ? (
                <Card>
                  <CardContent className="flex items-center justify-center py-16">
                    <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                  </CardContent>
                </Card>
              ) : config ? (
                <>
                  <div className="flex items-center gap-3 p-4 rounded-lg border bg-card">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
                      style={{ backgroundColor: selectedFamily?.color || '#6B7280' }}
                    >
                      <FamilyIcon icon={selectedFamily?.icon} color={selectedFamily?.color} code={selectedFamily?.code} className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold truncate">{selectedFamily?.name}</h3>
                      <p className="text-xs text-muted-foreground font-mono">{selectedFamily?.code}</p>
                    </div>
                    <Badge variant="default" className="ml-auto flex-shrink-0">
                      Inventario habilitado
                    </Badge>
                  </div>

                  {/* Tipos de activos permitidos */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Box className="h-4 w-4" />
                        Tipos de activos permitidos
                      </CardTitle>
                      <CardDescription>
                        Define qué tipos de activos puede gestionar esta área
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {ASSET_SUBTYPES.map((subtype) => {
                        const Icon = subtype.icon
                        const isChecked = config.allowedSubtypes?.includes(subtype.value) ?? false
                        return (
                          <div
                            key={subtype.value}
                            className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                          >
                            <Checkbox
                              id={`subtype-${subtype.value}`}
                              checked={isChecked}
                              onCheckedChange={() => toggleSubtype(subtype.value)}
                              className="mt-1"
                            />
                            <div className="flex-1 min-w-0">
                              <label
                                htmlFor={`subtype-${subtype.value}`}
                                className="flex items-center gap-2 font-medium text-sm cursor-pointer"
                              >
                                <Icon className="h-4 w-4 flex-shrink-0" />
                                {subtype.label}
                              </label>
                              <p className="text-xs text-muted-foreground mt-0.5">{subtype.description}</p>
                            </div>
                          </div>
                        )
                      })}
                    </CardContent>
                  </Card>

                  {/* Secciones del formulario */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Secciones del formulario
                      </CardTitle>
                      <CardDescription>
                        Controla qué campos se muestran y cuáles son obligatorios
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {FORM_SECTIONS.map((section) => {
                        const isVisible = config.visibleSections?.includes(section.value) ?? false
                        const isRequired = config.requiredSections?.includes(section.value) ?? false
                        return (
                          <div
                            key={section.value}
                            className="flex items-start gap-3 p-3 border rounded-lg"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm">{section.label}</p>
                              <p className="text-xs text-muted-foreground">{section.description}</p>
                            </div>
                            <div className="flex items-center gap-4 flex-shrink-0">
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  id={`visible-${section.value}`}
                                  checked={isVisible}
                                  onCheckedChange={() => toggleSection(section.value, 'visible')}
                                />
                                <Label htmlFor={`visible-${section.value}`} className="text-xs cursor-pointer">
                                  Visible
                                </Label>
                              </div>
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  id={`required-${section.value}`}
                                  checked={isRequired}
                                  onCheckedChange={() => toggleSection(section.value, 'required')}
                                  disabled={!isVisible}
                                />
                                <Label
                                  htmlFor={`required-${section.value}`}
                                  className={`text-xs cursor-pointer ${!isVisible ? 'opacity-50' : ''}`}
                                >
                                  Obligatorio
                                </Label>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </CardContent>
                  </Card>

                  {/* Configuración general */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Configuración general</CardTitle>
                      <CardDescription>Ajustes adicionales para esta área</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="code-prefix">Prefijo de código</Label>
                          <Input
                            id="code-prefix"
                            value={config.codePrefix || ''}
                            onChange={(e) => setConfig({ ...config, codePrefix: e.target.value.toUpperCase().slice(0, 10) })}
                            placeholder={selectedFamily?.code || 'Ej: EQ'}
                            maxLength={10}
                            className="mt-1 font-mono"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Ejemplo: <span className="font-mono">{config.codePrefix || selectedFamily?.code || 'EQ'}-2026-0001</span>
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <p className="text-sm font-medium">Requerir datos financieros para nuevos activos</p>
                            <p className="text-xs text-muted-foreground">Obliga a ingresar costo y proveedor al crear activos</p>
                          </div>
                          <Switch
                            checked={config.requireFinancialForNew}
                            onCheckedChange={(v) => setConfig({ ...config, requireFinancialForNew: v })}
                          />
                        </div>
                        <div className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <p className="text-sm font-medium">Requerir acta de entrega</p>
                            <p className="text-xs text-muted-foreground">Obliga a generar acta al asignar equipos a usuarios</p>
                          </div>
                          <Switch
                            checked={config.requireDeliveryAct}
                            onCheckedChange={(v) => setConfig({ ...config, requireDeliveryAct: v })}
                          />
                        </div>
                        <div className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <p className="text-sm font-medium">Auto-aprobar bajas</p>
                            <p className="text-xs text-muted-foreground">Las solicitudes de baja se aprueban automáticamente sin revisión</p>
                          </div>
                          <Switch
                            checked={config.autoApproveDecommission}
                            onCheckedChange={(v) => setConfig({ ...config, autoApproveDecommission: v })}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Valores por defecto de depreciación */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <TrendingDown className="h-4 w-4" />
                        Valores por defecto de depreciación
                      </CardTitle>
                      <CardDescription>
                        Estos valores se pre-cargan al crear nuevos activos fijos
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <Label htmlFor="depreciation-method">Método</Label>
                          <Select
                            value={config.defaultDepreciationMethod || 'none'}
                            onValueChange={(v) =>
                              setConfig({ ...config, defaultDepreciationMethod: v === 'none' ? null : v })
                            }
                          >
                            <SelectTrigger id="depreciation-method" className="mt-1">
                              <SelectValue placeholder="Sin método por defecto" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Sin método por defecto</SelectItem>
                              {DEPRECIATION_METHODS.map((method) => (
                                <SelectItem key={method.value} value={method.value}>
                                  {method.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="useful-life">Vida útil (años)</Label>
                          <Input
                            id="useful-life"
                            type="number"
                            min="0"
                            step="0.5"
                            value={config.defaultUsefulLifeYears ?? ''}
                            onChange={(e) =>
                              setConfig({
                                ...config,
                                defaultUsefulLifeYears: e.target.value ? parseFloat(e.target.value) : null,
                              })
                            }
                            placeholder="Ej: 5"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="residual-value">Valor residual (%)</Label>
                          <Input
                            id="residual-value"
                            type="number"
                            min="0"
                            max="100"
                            step="1"
                            value={config.defaultResidualValuePct ?? ''}
                            onChange={(e) =>
                              setConfig({
                                ...config,
                                defaultResidualValuePct: e.target.value ? parseFloat(e.target.value) : null,
                              })
                            }
                            placeholder="Ej: 10"
                            className="mt-1"
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <XCircle className="h-12 w-12 mb-4 opacity-30" />
                    <p className="text-base font-medium">Sin configuración</p>
                    <p className="text-sm mt-1">Esta área no tiene configuración de inventario</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* TAB: REGLAS GENERALES */}
        <TabsContent value="global">
          <div className="max-w-2xl space-y-6">
            <div className="flex items-start gap-3 p-4 rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800">
              <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-blue-800 dark:text-blue-300">
                Las reglas globales de inventario se configuran a nivel de sistema. Cada área puede personalizar su configuración en la pestaña &quot;Por área&quot;.
              </p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Warehouse className="h-4 w-4" />
                  Configuración global
                </CardTitle>
                <CardDescription>
                  Ajustes que aplican a todo el módulo de inventario
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  La configuración global de inventario se gestiona a través de las variables de entorno y configuración del sistema.
                  Para ajustes específicos por área, utiliza la pestaña &quot;Por área&quot;.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileCheck className="h-4 w-4" />
                  Módulos relacionados
                </CardTitle>
                <CardDescription>
                  Accede a otros módulos de configuración
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="text-sm font-medium">Proveedores</p>
                    <p className="text-xs text-muted-foreground">Gestiona los proveedores de inventario</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => router.push('/admin/inventory/suppliers')}>
                    <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                    Ir
                  </Button>
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="text-sm font-medium">Almacenes</p>
                    <p className="text-xs text-muted-foreground">Configura ubicaciones físicas</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => router.push('/admin/inventory/warehouses')}>
                    <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                    Ir
                  </Button>
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="text-sm font-medium">Contratos</p>
                    <p className="text-xs text-muted-foreground">Gestiona contratos de inventario</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => router.push('/admin/inventory/contracts')}>
                    <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                    Ir
                  </Button>
                </div>
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
    <Suspense fallback={
      <ModuleLayout title="Configuración de Inventario" loading={true}>
        <div />
      </ModuleLayout>
    }>
      <InventorySettingsContent />
    </Suspense>
  )
}
