'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  Settings, Ticket, Save, RefreshCw, CheckCircle, XCircle,
  Clock, Bell, ChevronRight, Layers,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { FamilyIcon } from '@/components/inventory/family-badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import { RoleDashboardLayout } from '@/components/layout/role-dashboard-layout'

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

const PRIORITIES = ['URGENT', 'HIGH', 'MEDIUM', 'LOW'] as const
const PRIORITY_LABELS: Record<string, string> = {
  URGENT: 'Urgente',
  HIGH: 'Alta',
  MEDIUM: 'Media',
  LOW: 'Baja',
}

function TicketSettingsContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { toast } = useToast()

  const [families, setFamilies] = useState<Family[]>([])
  const [selectedFamilyId, setSelectedFamilyId] = useState<string | null>(
    searchParams.get('familyId')
  )
  const [config, setConfig] = useState<TicketFamilyConfig | null>(null)
  const [loadingFamilies, setLoadingFamilies] = useState(true)
  const [loadingConfig, setLoadingConfig] = useState(false)
  const [saving, setSaving] = useState(false)

  // SLA state (display only — managed via /api/settings/sla)
  const [slaData] = useState<Record<string, { response: number; resolution: number }>>({
    URGENT: { response: 1, resolution: 4 },
    HIGH: { response: 2, resolution: 8 },
    MEDIUM: { response: 4, resolution: 24 },
    LOW: { response: 8, resolution: 48 },
  })

  const loadFamilies = useCallback(async () => {
    setLoadingFamilies(true)
    try {
      const res = await fetch('/api/families?includeInactive=true')
      const data = await res.json()
      if (data.success) {
        setFamilies(data.data)
      }
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
      if (data.success) {
        setConfig(data.data)
      } else {
        setConfig(null)
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
    if (selectedFamilyId) {
      loadConfig(selectedFamilyId)
    }
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
        body: JSON.stringify({
          ticketsEnabled: !family.ticketFamilyConfig?.ticketsEnabled,
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast({ title: 'Éxito', description: data.message })
        loadFamilies()
        if (selectedFamilyId === family.id) {
          loadConfig(family.id)
        }
      } else {
        toast({ title: 'Error', description: data.message, variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' })
    }
  }

  const handleSaveConfig = async () => {
    if (!config || !selectedFamilyId) return
    setSaving(true)
    try {
      const res = await fetch(`/api/families/${selectedFamilyId}/ticket-config`, {
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
      })
      const data = await res.json()
      if (data.success) {
        toast({ title: 'Éxito', description: data.message })
        loadFamilies()
      } else {
        toast({ title: 'Error', description: data.message, variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const selectedFamily = families.find((f) => f.id === selectedFamilyId)

  return (
    <RoleDashboardLayout
      title="Configuración de Tickets"
      subtitle="Gestiona la configuración del módulo de tickets por familia"
      headerActions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadFamilies} disabled={loadingFamilies}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loadingFamilies ? 'animate-spin' : ''}`} />
            Recargar
          </Button>
          {config && (
            <Button onClick={handleSaveConfig} disabled={saving}>
              <Save className={`h-4 w-4 mr-2 ${saving ? 'animate-spin' : ''}`} />
              {saving ? 'Guardando...' : 'Guardar configuración'}
            </Button>
          )}
        </div>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Panel izquierdo: lista de familias */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Layers className="h-4 w-4" />
                Familias
              </CardTitle>
              <CardDescription>Selecciona una familia para configurar</CardDescription>
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
                      className={`flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 transition-colors ${
                        selectedFamilyId === family.id ? 'bg-primary/5 border-l-2 border-primary' : ''
                      }`}
                      onClick={() => handleSelectFamily(family.id)}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                          style={{ backgroundColor: family.color || '#6B7280' }}
                        >
                          <FamilyIcon icon={family.icon} color={family.color} code={family.code} className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{family.name}</p>
                          <p className="text-xs text-muted-foreground font-mono">{family.code}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Switch
                          checked={family.ticketFamilyConfig?.ticketsEnabled ?? false}
                          onCheckedChange={() => handleToggleTickets(family)}
                          onClick={(e) => e.stopPropagation()}
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

          {/* Configuración global */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Configuración Global
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm">Familia por defecto</Label>
                <Select
                  value={families.find((f) => f.ticketFamilyConfig?.isDefault)?.id || ''}
                  onValueChange={async (familyId) => {
                    try {
                      const res = await fetch(`/api/families/${familyId}/ticket-config`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ isDefault: true }),
                      })
                      const data = await res.json()
                      if (data.success) {
                        toast({ title: 'Éxito', description: 'Familia por defecto actualizada' })
                        loadFamilies()
                      }
                    } catch {
                      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' })
                    }
                  }}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Seleccionar familia por defecto" />
                  </SelectTrigger>
                  <SelectContent>
                    {families
                      .filter((f) => f.ticketFamilyConfig?.ticketsEnabled)
                      .map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Se usa cuando no se puede determinar la familia desde la categoría
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Panel derecho: configuración de la familia seleccionada */}
        <div className="lg:col-span-2 space-y-4">
          {!selectedFamilyId ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Ticket className="h-12 w-12 mb-4 opacity-30" />
                <p className="text-lg font-medium">Selecciona una familia</p>
                <p className="text-sm mt-1">Elige una familia del panel izquierdo para ver y editar su configuración</p>
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
              {/* Header de la familia seleccionada */}
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                  style={{ backgroundColor: selectedFamily?.color || '#6B7280' }}
                >
                  <FamilyIcon icon={selectedFamily?.icon} color={selectedFamily?.color} code={selectedFamily?.code} className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold">{selectedFamily?.name}</h3>
                  <p className="text-sm text-muted-foreground font-mono">{selectedFamily?.code}</p>
                </div>
                <Badge variant={config.ticketsEnabled ? 'default' : 'secondary'} className="ml-auto">
                  {config.ticketsEnabled ? 'Tickets habilitados' : 'Tickets deshabilitados'}
                </Badge>
              </div>

              {/* Configuración básica */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Configuración básica</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="code-prefix">Prefijo de código</Label>
                      <Input
                        id="code-prefix"
                        value={config.codePrefix || ''}
                        onChange={(e) =>
                          setConfig({ ...config, codePrefix: e.target.value.toUpperCase().slice(0, 10) })
                        }
                        placeholder={selectedFamily?.code || 'Ej: TI'}
                        maxLength={10}
                        className="mt-1 font-mono"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Formato: {config.codePrefix || selectedFamily?.code}-2026-0001
                      </p>
                    </div>
                    <div>
                      <Label htmlFor="alert-threshold">Umbral de alertas de volumen</Label>
                      <Input
                        id="alert-threshold"
                        type="number"
                        value={config.alertVolumeThreshold ?? ''}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            alertVolumeThreshold: e.target.value ? parseInt(e.target.value) : null,
                          })
                        }
                        placeholder="Sin límite"
                        min={1}
                        className="mt-1"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Alerta cuando los tickets abiertos superen este número
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="text-sm font-medium">Tickets habilitados</p>
                      <p className="text-xs text-muted-foreground">Permite crear tickets en esta familia</p>
                    </div>
                    <Switch
                      checked={config.ticketsEnabled}
                      onCheckedChange={(v) => setConfig({ ...config, ticketsEnabled: v })}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="text-sm font-medium">Asignación automática respeta familias</p>
                      <p className="text-xs text-muted-foreground">
                        Solo asigna técnicos con esta familia en sus asignaciones
                      </p>
                    </div>
                    <Switch
                      checked={config.autoAssignRespectsFamilies}
                      onCheckedChange={(v) => setConfig({ ...config, autoAssignRespectsFamilies: v })}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="text-sm font-medium">Familia por defecto del sistema</p>
                      <p className="text-xs text-muted-foreground">
                        Se usa como fallback cuando no se puede determinar la familia
                      </p>
                    </div>
                    <Switch
                      checked={config.isDefault}
                      onCheckedChange={(v) => setConfig({ ...config, isDefault: v })}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Horario laboral */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Horario laboral
                  </CardTitle>
                  <CardDescription>Define el horario para el cálculo de SLA</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="hours-start">Hora de inicio</Label>
                      <Input
                        id="hours-start"
                        type="time"
                        value={config.businessHoursStart.substring(0, 5)}
                        onChange={(e) =>
                          setConfig({ ...config, businessHoursStart: `${e.target.value}:00` })
                        }
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="hours-end">Hora de fin</Label>
                      <Input
                        id="hours-end"
                        type="time"
                        value={config.businessHoursEnd.substring(0, 5)}
                        onChange={(e) =>
                          setConfig({ ...config, businessHoursEnd: `${e.target.value}:00` })
                        }
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="business-days">Días laborales (separados por coma)</Label>
                    <Input
                      id="business-days"
                      value={config.businessDays}
                      onChange={(e) => setConfig({ ...config, businessDays: e.target.value })}
                      placeholder="MON,TUE,WED,THU,FRI"
                      className="mt-1 font-mono"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Valores: MON, TUE, WED, THU, FRI, SAT, SUN
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* SLA por prioridad (solo lectura, referencia) */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Bell className="h-4 w-4" />
                    SLA por prioridad
                  </CardTitle>
                  <CardDescription>
                    Referencia de tiempos SLA configurados para esta familia.{' '}
                    <button
                      className="text-primary underline text-xs"
                      onClick={() => router.push('/admin/settings?tab=sla')}
                    >
                      Gestionar políticas SLA →
                    </button>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Prioridad</TableHead>
                        <TableHead className="text-center">Respuesta (h)</TableHead>
                        <TableHead className="text-center">Resolución (h)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {PRIORITIES.map((priority) => (
                        <TableRow key={priority}>
                          <TableCell>
                            <Badge
                              variant={
                                priority === 'URGENT'
                                  ? 'destructive'
                                  : priority === 'HIGH'
                                  ? 'default'
                                  : 'secondary'
                              }
                            >
                              {PRIORITY_LABELS[priority]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center font-mono">
                            {slaData[priority]?.response ?? '—'}
                          </TableCell>
                          <TableCell className="text-center font-mono">
                            {slaData[priority]?.resolution ?? '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button onClick={handleSaveConfig} disabled={saving} size="lg">
                  <Save className={`h-4 w-4 mr-2 ${saving ? 'animate-spin' : ''}`} />
                  {saving ? 'Guardando...' : 'Guardar configuración'}
                </Button>
              </div>
            </>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <XCircle className="h-12 w-12 mb-4 opacity-30" />
                <p className="text-lg font-medium">Sin configuración</p>
                <p className="text-sm mt-1">Esta familia no tiene configuración de tickets</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </RoleDashboardLayout>
  )
}

export default function TicketSettingsPage() {
  return (
    <Suspense fallback={
      <RoleDashboardLayout title="Configuración de Tickets">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </RoleDashboardLayout>
    }>
      <TicketSettingsContent />
    </Suspense>
  )
}
