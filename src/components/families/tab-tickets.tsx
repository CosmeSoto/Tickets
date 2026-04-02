'use client'

/**
 * TabTickets — Pestaña Tickets de la página de detalle de familia
 * Muestra y edita la configuración de ticket_family_config.
 * Requisitos: 3.1, 3.2, 3.3, 3.4, 3.5
 */

import { useState } from 'react'
import { AlertTriangle, RefreshCw, Save, Ticket } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useToast } from '@/hooks/use-toast'

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
}

interface TabTicketsProps {
  familyId: string
  ticketConfig: TicketFamilyConfig | null
  onConfigUpdated: (config: TicketFamilyConfig) => void
}

// ---- Default values ----

const DEFAULT_CONFIG: Omit<TicketFamilyConfig, 'id' | 'familyId'> = {
  ticketsEnabled: true,
  codePrefix: null,
  isDefault: false,
  autoAssignRespectsFamilies: false,
  alertVolumeThreshold: null,
  businessHoursStart: '09:00',
  businessHoursEnd: '18:00',
  businessDays: '1,2,3,4,5',
}

// ---- Component ----

export function TabTickets({ familyId, ticketConfig, onConfigUpdated }: TabTicketsProps) {
  const { toast } = useToast()

  const [form, setForm] = useState<Omit<TicketFamilyConfig, 'id' | 'familyId'>>({
    ticketsEnabled: ticketConfig?.ticketsEnabled ?? DEFAULT_CONFIG.ticketsEnabled,
    codePrefix: ticketConfig?.codePrefix ?? DEFAULT_CONFIG.codePrefix,
    isDefault: ticketConfig?.isDefault ?? DEFAULT_CONFIG.isDefault,
    autoAssignRespectsFamilies:
      ticketConfig?.autoAssignRespectsFamilies ?? DEFAULT_CONFIG.autoAssignRespectsFamilies,
    alertVolumeThreshold:
      ticketConfig?.alertVolumeThreshold ?? DEFAULT_CONFIG.alertVolumeThreshold,
    businessHoursStart: ticketConfig?.businessHoursStart ?? DEFAULT_CONFIG.businessHoursStart,
    businessHoursEnd: ticketConfig?.businessHoursEnd ?? DEFAULT_CONFIG.businessHoursEnd,
    businessDays: ticketConfig?.businessDays ?? DEFAULT_CONFIG.businessDays,
  })

  const [saving, setSaving] = useState(false)
  // Track if user just toggled ticketsEnabled to false (to show warning)
  const [showDisableWarning, setShowDisableWarning] = useState(false)

  const isDisabled = !form.ticketsEnabled

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
          alertVolumeThreshold:
            form.alertVolumeThreshold !== null && form.alertVolumeThreshold !== undefined
              ? Number(form.alertVolumeThreshold)
              : null,
          businessHoursStart: form.businessHoursStart,
          businessHoursEnd: form.businessHoursEnd,
          businessDays: form.businessDays,
        }),
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
      onConfigUpdated(data as TicketFamilyConfig)
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

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
              <CardDescription>
                Gestiona el comportamiento de tickets para esta familia
              </CardDescription>
            </div>
            {ticketConfig ? (
              <Badge variant="outline" className="text-xs">Configuración existente</Badge>
            ) : (
              <Badge variant="secondary" className="text-xs">Sin configuración</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* ticketsEnabled toggle */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="tickets-enabled" className="text-sm font-medium cursor-pointer">
                Tickets habilitados
              </Label>
              <p className="text-xs text-muted-foreground">
                Permite crear y gestionar tickets para esta familia
              </p>
            </div>
            <Switch
              id="tickets-enabled"
              checked={form.ticketsEnabled}
              onCheckedChange={handleTicketsEnabledChange}
              disabled={saving}
            />
          </div>

          {/* Warning when ticketsEnabled is false — Req 3.4 */}
          {showDisableWarning && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Tickets deshabilitados</AlertTitle>
              <AlertDescription>
                Al deshabilitar los tickets, esta familia no podrá recibir ni gestionar nuevos
                tickets. Los tickets existentes no se verán afectados.
              </AlertDescription>
            </Alert>
          )}

          {/* Read-only indicator when disabled — Req 3.5 */}
          {isDisabled && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Modo solo lectura</AlertTitle>
              <AlertDescription>
                Los campos de configuración están deshabilitados porque los tickets están
                inactivos para esta familia.
              </AlertDescription>
            </Alert>
          )}

          {/* Configuration fields — disabled when ticketsEnabled is false */}
          <div className={`space-y-4 ${isDisabled ? 'opacity-50 pointer-events-none' : ''}`}>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* codePrefix */}
              <div className="space-y-1">
                <Label htmlFor="code-prefix">Prefijo de código</Label>
                <Input
                  id="code-prefix"
                  value={form.codePrefix ?? ''}
                  onChange={(e) => setForm(f => ({ ...f, codePrefix: e.target.value || null }))}
                  placeholder="Ej: IT, HR, FIN"
                  disabled={saving || isDisabled}
                  readOnly={isDisabled}
                />
                <p className="text-xs text-muted-foreground">
                  Prefijo para los códigos de ticket de esta familia
                </p>
              </div>

              {/* alertVolumeThreshold */}
              <div className="space-y-1">
                <Label htmlFor="alert-threshold">Umbral de alerta de volumen</Label>
                <Input
                  id="alert-threshold"
                  type="number"
                  min={0}
                  value={form.alertVolumeThreshold ?? ''}
                  onChange={(e) =>
                    setForm(f => ({
                      ...f,
                      alertVolumeThreshold: e.target.value ? parseInt(e.target.value) : null,
                    }))
                  }
                  placeholder="Ej: 50"
                  disabled={saving || isDisabled}
                  readOnly={isDisabled}
                />
                <p className="text-xs text-muted-foreground">
                  Número de tickets que activa una alerta de volumen
                </p>
              </div>

              {/* businessHoursStart */}
              <div className="space-y-1">
                <Label htmlFor="hours-start">Inicio de horario laboral</Label>
                <Input
                  id="hours-start"
                  type="time"
                  value={form.businessHoursStart}
                  onChange={(e) => setForm(f => ({ ...f, businessHoursStart: e.target.value }))}
                  disabled={saving || isDisabled}
                  readOnly={isDisabled}
                />
              </div>

              {/* businessHoursEnd */}
              <div className="space-y-1">
                <Label htmlFor="hours-end">Fin de horario laboral</Label>
                <Input
                  id="hours-end"
                  type="time"
                  value={form.businessHoursEnd}
                  onChange={(e) => setForm(f => ({ ...f, businessHoursEnd: e.target.value }))}
                  disabled={saving || isDisabled}
                  readOnly={isDisabled}
                />
              </div>
            </div>

            {/* businessDays */}
            <div className="space-y-1">
              <Label htmlFor="business-days">Días laborales</Label>
              <Input
                id="business-days"
                value={form.businessDays}
                onChange={(e) => setForm(f => ({ ...f, businessDays: e.target.value }))}
                placeholder="Ej: 1,2,3,4,5 (lunes a viernes)"
                disabled={saving || isDisabled}
                readOnly={isDisabled}
              />
              <p className="text-xs text-muted-foreground">
                Días de la semana separados por coma (1=lunes, 7=domingo)
              </p>
            </div>

            {/* Boolean toggles */}
            <div className="space-y-3">
              {/* isDefault */}
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label htmlFor="is-default" className="text-sm font-medium cursor-pointer">
                    Familia por defecto
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Los tickets sin familia asignada usarán esta familia
                  </p>
                </div>
                <Switch
                  id="is-default"
                  checked={form.isDefault}
                  onCheckedChange={(v) => setForm(f => ({ ...f, isDefault: v }))}
                  disabled={saving || isDisabled}
                />
              </div>

              {/* autoAssignRespectsFamilies */}
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label
                    htmlFor="auto-assign-families"
                    className="text-sm font-medium cursor-pointer"
                  >
                    Auto-asignación respeta familias
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    La auto-asignación solo considerará técnicos de esta familia
                  </p>
                </div>
                <Switch
                  id="auto-assign-families"
                  checked={form.autoAssignRespectsFamilies}
                  onCheckedChange={(v) =>
                    setForm(f => ({ ...f, autoAssignRespectsFamilies: v }))
                  }
                  disabled={saving || isDisabled}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={handleSave} disabled={saving}>
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
