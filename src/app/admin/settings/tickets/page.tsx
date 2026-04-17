'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  Settings, Ticket, Save, RefreshCw, XCircle,
  Clock, Bell, ChevronRight, Layers, ExternalLink,
  Users, Timer, Info,
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

interface Family {
  id: string
  code: string
  name: string
  color?: string | null
  icon?: string | null
  isActive: boolean
  ticketFamilyConfig?: {
    ticketsEnabled: boolean
    isDefault: boolean
  } | null
}

interface TicketFamilyConfig {
  id: string
  familyId: string
  ticketsEnabled: boolean
  codePrefix?: string | null
  isDefault: boolean
  autoAssignRespectsFamilies: boolean
  alertVolumeThreshold?: number | null
  businessHoursStart: string
  businessHoursEnd: string
  businessDays: string
}

interface SlaRow {
  priority: string
  response: number
  resolution: number
}

const DEFAULTS: SlaRow[] = [
  { priority: 'URGENT', response: 1, resolution: 4 },
  { priority: 'HIGH', response: 2, resolution: 8 },
  { priority: 'MEDIUM', response: 4, resolution: 24 },
  { priority: 'LOW', response: 8, resolution: 48 },
]

const PRIORITIES = ['URGENT', 'HIGH', 'MEDIUM', 'LOW'] as const
const PRIORITY_LABELS: Record<string, string> = {
  URGENT: 'Urgente',
  HIGH: 'Alta',
  MEDIUM: 'Media',
  LOW: 'Baja',
}

// Day toggles
const DAY_OPTIONS = [
  { key: 'MON', label: 'L' },
  { key: 'TUE', label: 'M' },
  { key: 'WED', label: 'X' },
  { key: 'THU', label: 'J' },
  { key: 'FRI', label: 'V' },
  { key: 'SAT', label: 'S' },
  { key: 'SUN', label: 'D' },
]

const PRIORITY_COLORS: Record<string, string> = {
  URGENT: 'bg-red-100 text-red-700 border-red-200',
  HIGH: 'bg-orange-100 text-orange-700 border-orange-200',
  MEDIUM: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  LOW: 'bg-slate-100 text-slate-600 border-slate-200',
}

function TicketSettingsContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { toast } = useToast()
  const { data: session } = useSession()
  const isSuperAdmin = (session?.user as any)?.isSuperAdmin === true

  const [families, setFamilies] = useState<Family[]>([])
  const [selectedFamilyId, setSelectedFamilyId] = useState<string | null>(
    searchParams.get('familyId')
  )
  const [config, setConfig] = useState<TicketFamilyConfig | null>(null)
  const [loadingFamilies, setLoadingFamilies] = useState(true)
  const [loadingConfig, setLoadingConfig] = useState(false)
  const [saving, setSaving] = useState(false)
  const [slaRows, setSlaRows] = useState<SlaRow[]>(DEFAULTS)
  const [globalSettings, setGlobalSettings] = useState({
    maxTicketsPerUser: 10,
    autoCloseDays: 3,
    autoAssignmentEnabled: true,
    defaultFamilyId: '',
  })
  const [globalDirty, setGlobalDirty] = useState(false)

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
      const res = await fetch(`/api/families/${familyId}/ticket-config`)
      const data = await res.json()
      setConfig(data.success ? data.data : null)
    } catch {
      toast({ title: 'Error', description: 'Error al cargar configuración', variant: 'destructive' })
    } finally {
      setLoadingConfig(false)
    }
  }, [toast])

  const loadSLAPolicies = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/sla-policies?isActive=true')
      const data = await res.json()
      if (data.success) {
        const global = data.data.filter((p: any) => !p.categoryId)
        if (global.length > 0) {
          setSlaRows(PRIORITIES.map((priority) => {
            const p = global.find((g: any) => g.priority === priority)
            const def = DEFAULTS.find((d) => d.priority === priority)!
            return { priority, response: p?.responseTimeHours ?? def.response, resolution: p?.resolutionTimeHours ?? def.resolution }
          }))
        }
      }
    } catch { /* keep defaults */ }
  }, [])

  const loadGlobalSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/settings')
      if (res.ok) {
        const data = await res.json()
        setGlobalSettings((prev) => ({
          ...prev,
          maxTicketsPerUser: data.maxTicketsPerUser ?? 10,
          autoCloseDays: data.autoCloseDays ?? 3,
          autoAssignmentEnabled: data.autoAssignmentEnabled ?? true,
        }))
      }
    } catch { /* keep defaults */ }
  }, [])

  useEffect(() => {
    loadFamilies()
    loadSLAPolicies()
    loadGlobalSettings()
  }, [loadFamilies, loadSLAPolicies, loadGlobalSettings])

  useEffect(() => {
    const def = families.find((f) => f.ticketFamilyConfig?.isDefault)
    if (def) setGlobalSettings((prev) => ({ ...prev, defaultFamilyId: def.id }))
  }, [families])

  useEffect(() => {
    if (selectedFamilyId) loadConfig(selectedFamilyId)
  }, [selectedFamilyId, loadConfig])

  const handleSelectFamily = (familyId: string) => {
    setSelectedFamilyId(familyId)
    router.replace(`/admin/settings/tickets?familyId=${familyId}`, { scroll: false })
  }

  const handleToggleTickets = async (family: Family) => {
    try {
      const res = await fetch(`/api/families/${family.id}/ticket-config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketsEnabled: !family.ticketFamilyConfig?.ticketsEnabled }),
      })
      const data = await res.json()
      if (data.success) {
        toast({ title: 'Éxito', description: data.message })
        loadFamilies()
        if (selectedFamilyId === family.id) loadConfig(family.id)
      } else {
        toast({ title: 'Error', description: data.message, variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' })
    }
  }

  const toggleDay = (day: string) => {
    if (!config) return
    const days = config.businessDays ? config.businessDays.split(',').filter(Boolean) : []
    const next = days.includes(day) ? days.filter((d) => d !== day) : [...days, day]
    const ordered = DAY_OPTIONS.map((d) => d.key).filter((k) => next.includes(k))
    setConfig({ ...config, businessDays: ordered.join(',') })
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const promises: Promise<any>[] = []
      if (config && selectedFamilyId) {
        promises.push(
          fetch(`/api/families/${selectedFamilyId}/ticket-config`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ticketsEnabled: config.ticketsEnabled,
              codePrefix: config.codePrefix,
              isDefault: config.isDefault,
              autoAssignRespectsFamilies: config.autoAssignRespectsFamilies,
              alertVolumeThreshold: config.alertVolumeThreshold,
              businessHoursStart: config.businessHoursStart,
              businessHoursEnd: config.businessHoursEnd,
              businessDays: config.businessDays,
            }),
          }).then((r) => r.json())
        )
      }
      if (globalDirty) {
        promises.push(
          fetch('/api/admin/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              maxTicketsPerUser: globalSettings.maxTicketsPerUser,
              autoCloseDays: globalSettings.autoCloseDays,
              autoAssignmentEnabled: globalSettings.autoAssignmentEnabled,
            }),
          }).then((r) => r.json())
        )
        if (globalSettings.defaultFamilyId) {
          promises.push(
            fetch(`/api/families/${globalSettings.defaultFamilyId}/ticket-config`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ isDefault: true }),
            }).then((r) => r.json())
          )
        }
      }
      if (promises.length === 0) {
        toast({ title: 'Sin cambios', description: 'No hay cambios pendientes' })
        setSaving(false)
        return
      }
      await Promise.all(promises)
      toast({ title: 'Guardado', description: 'Configuración actualizada correctamente' })
      setGlobalDirty(false)
      loadFamilies()
      window.dispatchEvent(new CustomEvent('settings-updated'))
    } catch {
      toast({ title: 'Error', description: 'Error al guardar', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const selectedFamily = families.find((f) => f.id === selectedFamilyId)
  const activeDays = config?.businessDays ? config.businessDays.split(',') : []

  return (
    <ModuleLayout
      title="Configuración de Tickets"
      subtitle="Configura el comportamiento del módulo de tickets"
      headerActions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { loadFamilies(); loadGlobalSettings() }} disabled={loadingFamilies}>
            <RefreshCw className={`h-4 w-4 ${loadingFamilies ? 'animate-spin' : ''} sm:mr-2`} />
            <span className="hidden sm:inline">Recargar</span>
          </Button>
          <Button onClick={handleSave} disabled={saving}>
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
          <TabsTrigger value="global" className="flex-1 sm:flex-none flex items-center gap-2" onClick={() => setGlobalDirty(true)}>
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
                    Áreas de soporte
                  </CardTitle>
                  <CardDescription>
                    Selecciona un área para ver y editar su configuración individual
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
                          <div className="flex items-center gap-1 flex-shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
                            <Switch
                              checked={family.ticketFamilyConfig?.ticketsEnabled ?? false}
                              onCheckedChange={() => handleToggleTickets(family)}
                              className="scale-75"
                            />
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
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
                    <Ticket className="h-12 w-12 mb-4 opacity-30" />
                    <p className="text-base font-medium">Selecciona un área</p>
                    <p className="text-sm mt-1 text-center">Elige un área de la lista para ver y editar su configuración</p>
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
                    <Badge variant={config.ticketsEnabled ? 'default' : 'secondary'} className="ml-auto flex-shrink-0">
                      {config.ticketsEnabled ? 'Habilitada' : 'Deshabilitada'}
                    </Badge>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Configuración del área</CardTitle>
                      <CardDescription>Ajustes específicos para esta área de soporte</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="code-prefix">Prefijo de código de ticket</Label>
                          <Input
                            id="code-prefix"
                            value={config.codePrefix || ''}
                            onChange={(e) => setConfig({ ...config, codePrefix: e.target.value.toUpperCase().slice(0, 10) })}
                            placeholder={selectedFamily?.code || 'Ej: TI'}
                            maxLength={10}
                            className="mt-1 font-mono"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Ejemplo: <span className="font-mono">{config.codePrefix || selectedFamily?.code || 'TI'}-2026-0001</span>
                          </p>
                        </div>
                        <div>
                          <Label htmlFor="alert-threshold">Alerta de volumen</Label>
                          <Input
                            id="alert-threshold"
                            type="number"
                            value={config.alertVolumeThreshold ?? ''}
                            onChange={(e) => setConfig({ ...config, alertVolumeThreshold: e.target.value ? parseInt(e.target.value) : null })}
                            placeholder="Sin límite"
                            min={1}
                            className="mt-1"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Notifica cuando los tickets abiertos superen este número
                          </p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <p className="text-sm font-medium">Tickets habilitados</p>
                            <p className="text-xs text-muted-foreground">Esta área puede recibir tickets</p>
                          </div>
                          <Switch checked={config.ticketsEnabled} onCheckedChange={(v) => setConfig({ ...config, ticketsEnabled: v })} />
                        </div>
                        <div className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <p className="text-sm font-medium">Asignación respeta el área</p>
                            <p className="text-xs text-muted-foreground">Solo asigna técnicos de esta área automáticamente</p>
                          </div>
                          <Switch checked={config.autoAssignRespectsFamilies} onCheckedChange={(v) => setConfig({ ...config, autoAssignRespectsFamilies: v })} />
                        </div>
                        <div className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <p className="text-sm font-medium">Área por defecto del sistema</p>
                            <p className="text-xs text-muted-foreground">Recibe tickets cuando no se puede determinar el área</p>
                          </div>
                          <Switch checked={config.isDefault} onCheckedChange={(v) => setConfig({ ...config, isDefault: v })} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Horario laboral
                      </CardTitle>
                      <CardDescription>
                        Define cuándo está activo el equipo de esta área. Se usa para calcular los tiempos de SLA.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="hours-start">Entrada</Label>
                          <Input
                            id="hours-start"
                            type="time"
                            value={config.businessHoursStart.substring(0, 5)}
                            onChange={(e) => setConfig({ ...config, businessHoursStart: `${e.target.value}:00` })}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="hours-end">Salida</Label>
                          <Input
                            id="hours-end"
                            type="time"
                            value={config.businessHoursEnd.substring(0, 5)}
                            onChange={(e) => setConfig({ ...config, businessHoursEnd: `${e.target.value}:00` })}
                            className="mt-1"
                          />
                        </div>
                      </div>
                      <div>
                        <Label className="mb-2 block">Días laborales</Label>
                        <div className="flex gap-2 flex-wrap">
                          {DAY_OPTIONS.map((day) => {
                            const active = activeDays.includes(day.key)
                            return (
                              <button
                                key={day.key}
                                type="button"
                                onClick={() => toggleDay(day.key)}
                                className={`w-9 h-9 rounded-full text-sm font-semibold border-2 transition-colors ${
                                  active
                                    ? 'bg-primary text-primary-foreground border-primary'
                                    : 'bg-background text-muted-foreground border-border hover:border-primary/50'
                                }`}
                              >
                                {day.label}
                              </button>
                            )
                          })}
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          {activeDays.length === 0 ? 'Sin días seleccionados' : `${activeDays.length} día${activeDays.length !== 1 ? 's' : ''} seleccionado${activeDays.length !== 1 ? 's' : ''}`}
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <CardTitle className="text-base flex items-center gap-2">
                            <Timer className="h-4 w-4" />
                            Tiempos SLA de referencia
                          </CardTitle>
                          <CardDescription className="mt-1">
                            Tiempos globales del sistema. El horario de arriba determina cuándo se cuentan esas horas.
                          </CardDescription>
                        </div>
                        {isSuperAdmin && (
                          <Button variant="outline" size="sm" className="flex-shrink-0" onClick={() => router.push('/admin/settings?tab=sla')}>
                            <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                            Editar SLA
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {slaRows.map((row) => (
                          <div key={row.priority} className={`rounded-lg border p-3 text-center ${PRIORITY_COLORS[row.priority]}`}>
                            <p className="text-xs font-semibold uppercase tracking-wide mb-1">{PRIORITY_LABELS[row.priority]}</p>
                            <p className="text-lg font-bold">{row.response}h</p>
                            <p className="text-xs opacity-70">respuesta</p>
                            <p className="text-sm font-semibold mt-1">{row.resolution}h</p>
                            <p className="text-xs opacity-70">resolución</p>
                          </div>
                        ))}
                      </div>
                      {!isSuperAdmin && (
                        <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
                          <Info className="h-3 w-3" />
                          Solo el Super Admin puede modificar los tiempos SLA
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </>
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <XCircle className="h-12 w-12 mb-4 opacity-30" />
                    <p className="text-base font-medium">Sin configuración</p>
                    <p className="text-sm mt-1">Esta área no tiene configuración de tickets aún</p>
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
                Estas reglas aplican a <strong>todo el sistema</strong>, independientemente del área. Los cambios aquí afectan a todos los usuarios.
              </p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Layers className="h-4 w-4" />
                  Área por defecto
                </CardTitle>
                <CardDescription>
                  Cuando un ticket no puede asociarse a ningún área específica, se asigna aquí automáticamente
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Select
                  value={globalSettings.defaultFamilyId}
                  onValueChange={(v) => { setGlobalSettings((prev) => ({ ...prev, defaultFamilyId: v })); setGlobalDirty(true) }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar área por defecto" />
                  </SelectTrigger>
                  <SelectContent>
                    {families.filter((f) => f.ticketFamilyConfig?.ticketsEnabled).map((f) => (
                      <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Límite de tickets por usuario
                </CardTitle>
                <CardDescription>
                  Un usuario no podrá crear más tickets si ya tiene este número abiertos al mismo tiempo
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={globalSettings.maxTicketsPerUser}
                    onChange={(e) => { setGlobalSettings((prev) => ({ ...prev, maxTicketsPerUser: parseInt(e.target.value) || 10 })); setGlobalDirty(true) }}
                    className="w-24 font-mono"
                  />
                  <p className="text-sm text-muted-foreground">tickets abiertos máximo por usuario</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Cierre automático de tickets resueltos
                </CardTitle>
                <CardDescription>
                  Cuando un técnico resuelve un ticket, el cliente tiene este plazo para calificarlo. Si no lo hace, el ticket se cierra automáticamente.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <Input
                    type="number"
                    min={1}
                    max={30}
                    value={globalSettings.autoCloseDays}
                    onChange={(e) => { setGlobalSettings((prev) => ({ ...prev, autoCloseDays: parseInt(e.target.value) || 3 })); setGlobalDirty(true) }}
                    className="w-24 font-mono"
                  />
                  <p className="text-sm text-muted-foreground">días para calificar antes del cierre automático</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Bell className="h-4 w-4" />
                  Asignación automática de técnicos
                </CardTitle>
                <CardDescription>
                  Cuando se crea un ticket, el sistema puede asignarlo automáticamente al técnico con menor carga de trabajo en esa categoría
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="text-sm font-medium">Activar asignación automática</p>
                    <p className="text-xs text-muted-foreground">Los tickets nuevos se asignan sin intervención manual</p>
                  </div>
                  <Switch
                    checked={globalSettings.autoAssignmentEnabled}
                    onCheckedChange={(v) => { setGlobalSettings((prev) => ({ ...prev, autoAssignmentEnabled: v })); setGlobalDirty(true) }}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </ModuleLayout>
  )
}

export default function TicketSettingsPage() {
  return (
    <Suspense fallback={
      <ModuleLayout title="Configuración de Tickets" loading={true}>
        <div />
      </ModuleLayout>
    }>
      <TicketSettingsContent />
    </Suspense>
  )
}
