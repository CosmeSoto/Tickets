'use client'

import { useState, useEffect } from 'react'
import { AlertTriangle, RefreshCw, Save, Ticket, Users, Globe, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/hooks/use-toast'
import { useFamilies } from '@/contexts/families-context'

// ---- Types ----

export interface TicketFamilyConfig {
  id?: string
  familyId?: string
  ticketsEnabled: boolean
  codePrefix?: string | null
  isDefault: boolean
  autoAssignRespectsFamilies: boolean
  alertVolumeThreshold?: number | null
  businessHoursStart: string
  businessHoursEnd: string
  businessDays: string
  allowedFromFamilies?: string[]
}

interface TabTicketsProps {
  familyId: string
  ticketConfig: TicketFamilyConfig | null
  onConfigUpdated: (config: TicketFamilyConfig) => void
}

// ---- Constants ----

const DEFAULT_CONFIG: Omit<TicketFamilyConfig, 'id' | 'familyId'> = {
  ticketsEnabled: true,
  codePrefix: null,
  isDefault: false,
  autoAssignRespectsFamilies: false,
  alertVolumeThreshold: null,
  businessHoursStart: '09:00',
  businessHoursEnd: '18:00',
  businessDays: 'MON,TUE,WED,THU,FRI',
  allowedFromFamilies: [],
}

const DAYS = [
  { key: 'MON', label: 'Lun' },
  { key: 'TUE', label: 'Mar' },
  { key: 'WED', label: 'Mié' },
  { key: 'THU', label: 'Jue' },
  { key: 'FRI', label: 'Vie' },
  { key: 'SAT', label: 'Sáb' },
  { key: 'SUN', label: 'Dom' },
]

// Normaliza días: acepta "1,2,3,4,5" o "MON,TUE,..." → siempre devuelve Set<string> de claves MON/TUE/...
function parseDays(raw: string): Set<string> {
  const parts = raw.split(',').map(s => s.trim()).filter(Boolean)
  const numToKey: Record<string, string> = { '1': 'MON', '2': 'TUE', '3': 'WED', '4': 'THU', '5': 'FRI', '6': 'SAT', '7': 'SUN' }
  return new Set(parts.map(p => numToKey[p] ?? p))
}

function serializeDays(days: Set<string>): string {
  return DAYS.filter(d => days.has(d.key)).map(d => d.key).join(',')
}

// ---- Component ----

export function TabTickets({ familyId, ticketConfig, onConfigUpdated }: TabTicketsProps) {
  const { toast } = useToast()
  const [allFamilies, setAllFamilies] = useState<Array<{ id: string; name: string; color?: string | null; code: string }>>([])

  const [form, setForm] = useState({
    ticketsEnabled: ticketConfig?.ticketsEnabled ?? DEFAULT_CONFIG.ticketsEnabled,
    codePrefix: ticketConfig?.codePrefix ?? DEFAULT_CONFIG.codePrefix,
    isDefault: ticketConfig?.isDefault ?? DEFAULT_CONFIG.isDefault,
    autoAssignRespectsFamilies: ticketConfig?.autoAssignRespectsFamilies ?? DEFAULT_CONFIG.autoAssignRespectsFamilies,
    alertVolumeThreshold: ticketConfig?.alertVolumeThreshold ?? DEFAULT_CONFIG.alertVolumeThreshold,
    businessHoursStart: ticketConfig?.businessHoursStart ?? DEFAULT_CONFIG.businessHoursStart,
    businessHoursEnd: ticketConfig?.businessHoursEnd ?? DEFAULT_CONFIG.businessHoursEnd,
    selectedDays: parseDays(ticketConfig?.businessDays ?? DEFAULT_CONFIG.businessDays!),
    allowedFromFamilies: new Set<string>(ticketConfig?.allowedFromFamilies ?? []),
  })

  const [saving, setSaving] = useState(false)
  const [showDisableWarning, setShowDisableWarning] = useState(false)

  // Familias desde el contexto global (cache Redis, sin peticion extra)
  const { families } = useFamilies()
  const isDisabled = !form.ticketsEnabled

  // Cargar todas las familias para el selector de allowedFromFamilies
  useEffect(() => {
    fetch('/api/families?includeInactive=false')
      .then(r => r.json())
      .then(d => {
        if (d.success) setAllFamilies(d.data.filter((f: any) => f.id !== familyId))
      })
      .catch(() => {})
  }, [familyId])

  const toggleDay = (key: string) => {
    setForm(f => {
      const days = new Set(f.selectedDays)
      days.has(key) ? days.delete(key) : days.add(key)
      return { ...f, selectedDays: days }
    })
  }

  const toggleAllowedFamily = (id: string) => {
    setForm(f => {
      const set = new Set(f.allowedFromFamilies)
      set.has(id) ? set.delete(id) : set.add(id)
      return { ...f, allowedFromFamilies: set }
    })
  }

  const handleTicketsEnabledChange = (value: boolean) => {
    setForm(f => ({ ...f, ticketsEnabled: value }))
    setShowDisableWarning(!value)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/families/${familyId}/tickets`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketsEnabled: form.ticketsEnabled,
          codePrefix: form.codePrefix?.trim() || null,
          isDefault: form.isDefault,
          autoAssignRespectsFamilies: form.autoAssignRespectsFamilies,
          alertVolumeThreshold: form.alertVolumeThreshold !== null ? Number(form.alertVolumeThreshold) : null,
          businessHoursStart: form.businessHoursStart,
          businessHoursEnd: form.businessHoursEnd,
          businessDays: serializeDays(form.selectedDays),
          allowedFromFamilies: Array.from(form.allowedFromFamilies),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: 'Error', description: data.error || 'Error al guardar', variant: 'destructive' })
        return
      }
      toast({ title: res.status === 201 ? 'Configuración creada' : 'Configuración actualizada', description: 'Los cambios se guardaron correctamente' })
      onConfigUpdated(data as TicketFamilyConfig)
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const isOpenToAll = form.allowedFromFamilies.size === 0

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Ticket className="h-4 w-4" />
                Configuración de Tickets
              </CardTitle>
              <CardDescription>Gestiona el comportamiento de tickets para esta familia</CardDescription>
            </div>
            <Badge variant={ticketConfig ? 'outline' : 'secondary'} className="text-xs">
              {ticketConfig ? 'Configurado' : 'Sin configuración'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* Habilitar tickets */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <Label htmlFor="tickets-enabled" className="text-sm font-medium cursor-pointer">Tickets habilitados</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Permite crear y gestionar tickets para esta familia</p>
            </div>
            <Switch id="tickets-enabled" checked={form.ticketsEnabled} onCheckedChange={handleTicketsEnabledChange} disabled={saving} />
          </div>

          {showDisableWarning && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Tickets deshabilitados</AlertTitle>
              <AlertDescription>Los tickets existentes no se verán afectados, pero no se podrán crear nuevos.</AlertDescription>
            </Alert>
          )}

          <div className={`space-y-6 ${isDisabled ? 'opacity-50 pointer-events-none' : ''}`}>

            {/* Código y umbral */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="code-prefix">Prefijo de código</Label>
                <Input
                  id="code-prefix"
                  value={form.codePrefix ?? ''}
                  onChange={e => setForm(f => ({ ...f, codePrefix: e.target.value || null }))}
                  placeholder="Ej: TI, MNT, SEG"
                  disabled={saving || isDisabled}
                />
                <p className="text-xs text-muted-foreground">
                  Vista previa: <span className="font-mono font-medium">{form.codePrefix?.toUpperCase() || 'XX'}-{new Date().getFullYear()}-0001</span>
                </p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="alert-threshold">Umbral de alerta de volumen</Label>
                <Input
                  id="alert-threshold"
                  type="number"
                  min={0}
                  value={form.alertVolumeThreshold ?? ''}
                  onChange={e => setForm(f => ({ ...f, alertVolumeThreshold: e.target.value ? parseInt(e.target.value) : null }))}
                  placeholder="Ej: 50"
                  disabled={saving || isDisabled}
                />
                <p className="text-xs text-muted-foreground">Tickets activos que activan una alerta</p>
              </div>
            </div>

            {/* Horario laboral */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Horario laboral</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="hours-start" className="text-xs text-muted-foreground">Inicio</Label>
                  <Input id="hours-start" type="time" value={form.businessHoursStart} onChange={e => setForm(f => ({ ...f, businessHoursStart: e.target.value }))} disabled={saving || isDisabled} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="hours-end" className="text-xs text-muted-foreground">Fin</Label>
                  <Input id="hours-end" type="time" value={form.businessHoursEnd} onChange={e => setForm(f => ({ ...f, businessHoursEnd: e.target.value }))} disabled={saving || isDisabled} />
                </div>
              </div>

              {/* Días laborales — checkboxes visuales */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Días laborales</Label>
                <div className="flex gap-2 flex-wrap">
                  {DAYS.map(day => (
                    <button
                      key={day.key}
                      type="button"
                      onClick={() => !isDisabled && !saving && toggleDay(day.key)}
                      className={`w-10 h-10 rounded-lg text-xs font-medium border transition-colors ${
                        form.selectedDays.has(day.key)
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background text-muted-foreground border-border hover:border-primary/50'
                      } ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Acceso de familias — allowedFromFamilies */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium">Acceso de otras familias</Label>
                <Badge variant={isOpenToAll ? 'default' : 'secondary'} className="text-xs flex items-center gap-1">
                  {isOpenToAll ? <><Globe className="h-3 w-3" />Abierto a todos</> : <><Lock className="h-3 w-3" />Restringido</>}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Define qué familias pueden crear tickets aquí. Si no seleccionas ninguna, <strong>cualquier cliente</strong> del sistema puede hacerlo.
              </p>

              {allFamilies.length > 0 && (
                <div className="rounded-lg border divide-y">
                  {allFamilies.map(f => (
                    <label key={f.id} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors">
                      <Checkbox
                        checked={form.allowedFromFamilies.has(f.id)}
                        onCheckedChange={() => toggleAllowedFamily(f.id)}
                        disabled={saving || isDisabled}
                      />
                      {f.color && <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: f.color }} />}
                      <span className="text-sm flex-1">{f.name}</span>
                      <span className="text-xs text-muted-foreground font-mono">{f.code}</span>
                    </label>
                  ))}
                </div>
              )}

              {!isOpenToAll && (
                <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <Lock className="h-3 w-3" />
                  Solo clientes de las familias seleccionadas podrán crear tickets aquí.
                </p>
              )}
            </div>

            {/* Toggles */}
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label htmlFor="is-default" className="text-sm font-medium cursor-pointer">Familia por defecto</Label>
                  <p className="text-xs text-muted-foreground">Los tickets sin familia asignada usarán esta</p>
                </div>
                <Switch id="is-default" checked={form.isDefault} onCheckedChange={v => setForm(f => ({ ...f, isDefault: v }))} disabled={saving || isDisabled} />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label htmlFor="auto-assign-families" className="text-sm font-medium cursor-pointer">Auto-asignación respeta familias</Label>
                  <p className="text-xs text-muted-foreground">Solo asigna técnicos de esta familia automáticamente</p>
                </div>
                <Switch id="auto-assign-families" checked={form.autoAssignRespectsFamilies} onCheckedChange={v => setForm(f => ({ ...f, autoAssignRespectsFamilies: v }))} disabled={saving || isDisabled} />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Guardando...</> : <><Save className="h-4 w-4 mr-2" />Guardar cambios</>}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}


