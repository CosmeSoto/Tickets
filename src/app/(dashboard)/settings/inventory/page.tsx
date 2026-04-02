'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { RoleDashboardLayout } from '@/components/layout/role-dashboard-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import {
  Save, Loader2, Bell, FileText,
} from 'lucide-react'

interface InventorySettings {
  act_expiration_days: number
  low_stock_alert_enabled: boolean
  license_alert_enabled: boolean
  license_alert_days_first: number
  license_alert_days_second: number
  mro_expiry_alert_enabled: boolean
  mro_expiry_alert_days: number
  mro_expiry_alert_days_urgent: number
  warranty_alert_enabled: boolean
  warranty_alert_days: number
  contract_alert_days: number
}

// ── Página principal ──────────────────────────────────────────────────────
export default function InventorySettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<InventorySettings>({
    act_expiration_days: 7,
    low_stock_alert_enabled: true,
    license_alert_enabled: true,
    license_alert_days_first: 30,
    license_alert_days_second: 7,
    mro_expiry_alert_enabled: true,
    mro_expiry_alert_days: 30,
    mro_expiry_alert_days_urgent: 7,
    warranty_alert_enabled: true,
    warranty_alert_days: 30,
    contract_alert_days: 30,
  })

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return }
    if (status === 'authenticated' && session?.user?.role !== 'ADMIN') { router.push('/unauthorized'); return }
    if (status === 'authenticated') { loadSettings() }
  }, [session, status, router])

  const loadSettings = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/settings/inventory')
      if (res.ok) {
        const data = await res.json()
        setSettings(prev => ({ ...prev, ...data.settings }))
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      const res = await fetch('/api/settings/inventory', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      if (res.ok) {
        toast({ title: 'Configuración guardada', description: 'Los cambios se han aplicado correctamente.' })
      } else {
        throw new Error()
      }
    } catch {
      toast({ title: 'Error', description: 'No se pudo guardar la configuración', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <RoleDashboardLayout title="Configuración de Inventario" subtitle="Ajustes del módulo de inventario">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </RoleDashboardLayout>
    )
  }

  return (
    <RoleDashboardLayout title="Configuración de Inventario" subtitle="Ajustes del módulo de inventario">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* ── 1. Alertas (agrupadas) ── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Alertas Automáticas
            </CardTitle>
            <CardDescription>
              Configura cuándo el sistema debe notificarte sobre stock bajo y vencimientos.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">

            {/* Stock bajo */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Alertas de stock bajo</p>
                <p className="text-xs text-muted-foreground">Notificar cuando un consumible esté por debajo del mínimo</p>
              </div>
              <Switch
                checked={settings.low_stock_alert_enabled}
                onCheckedChange={checked => setSettings({ ...settings, low_stock_alert_enabled: checked })}
              />
            </div>

            <Separator />

            {/* Licencias y contratos */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Alertas de vencimiento de licencias y contratos</p>
                  <p className="text-xs text-muted-foreground">Notificar antes de que expiren licencias o contratos</p>
                </div>
                <Switch
                  checked={settings.license_alert_enabled}
                  onCheckedChange={checked => setSettings({ ...settings, license_alert_enabled: checked })}
                />
              </div>

              {settings.license_alert_enabled && (
                <div className="grid grid-cols-2 gap-4 pl-1 pt-1 border-l-2 border-muted ml-1">
                  <div className="space-y-1.5">
                    <Label htmlFor="alert-first" className="text-xs">Primera alerta (días antes)</Label>
                    <Input
                      id="alert-first"
                      type="number"
                      min="1"
                      max="365"
                      value={settings.license_alert_days_first}
                      onChange={e => setSettings({ ...settings, license_alert_days_first: parseInt(e.target.value) || 30 })}
                      className="w-28 h-8 text-sm"
                    />
                    <p className="text-xs text-muted-foreground">Ej: 30 días antes</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="alert-second" className="text-xs">Segunda alerta (días antes)</Label>
                    <Input
                      id="alert-second"
                      type="number"
                      min="1"
                      max="365"
                      value={settings.license_alert_days_second}
                      onChange={e => setSettings({ ...settings, license_alert_days_second: parseInt(e.target.value) || 7 })}
                      className="w-28 h-8 text-sm"
                    />
                    <p className="text-xs text-muted-foreground">Ej: 7 días antes (urgente)</p>
                  </div>
                  <div className="space-y-1.5 col-span-2">
                    <Label htmlFor="contract-alert-days" className="text-xs">Días de anticipación para alertas de contratos</Label>
                    <Input
                      id="contract-alert-days"
                      type="number"
                      min="1"
                      max="365"
                      value={settings.contract_alert_days}
                      onChange={e => setSettings({ ...settings, contract_alert_days: parseInt(e.target.value) || 30 })}
                      className="w-28 h-8 text-sm"
                    />
                    <p className="text-xs text-muted-foreground">Días antes del vencimiento para enviar alerta de contrato</p>
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Alertas de Caducidad MRO */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Alertas de Caducidad MRO</p>
                  <p className="text-xs text-muted-foreground">Habilitar alertas de caducidad de materiales MRO</p>
                </div>
                <Switch
                  checked={settings.mro_expiry_alert_enabled}
                  onCheckedChange={checked => setSettings({ ...settings, mro_expiry_alert_enabled: checked })}
                />
              </div>

              {settings.mro_expiry_alert_enabled && (
                <div className="grid grid-cols-2 gap-4 pl-1 pt-1 border-l-2 border-muted ml-1">
                  <div className="space-y-1.5">
                    <Label htmlFor="mro-alert-days" className="text-xs">Días para primera alerta</Label>
                    <Input
                      id="mro-alert-days"
                      type="number"
                      min="1"
                      max="365"
                      value={settings.mro_expiry_alert_days}
                      onChange={e => setSettings({ ...settings, mro_expiry_alert_days: parseInt(e.target.value) || 30 })}
                      className="w-28 h-8 text-sm"
                    />
                    <p className="text-xs text-muted-foreground">Ej: 30 días antes de caducar</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="mro-alert-days-urgent" className="text-xs">Días para alerta urgente</Label>
                    <Input
                      id="mro-alert-days-urgent"
                      type="number"
                      min="1"
                      max="365"
                      value={settings.mro_expiry_alert_days_urgent}
                      onChange={e => setSettings({ ...settings, mro_expiry_alert_days_urgent: parseInt(e.target.value) || 7 })}
                      className="w-28 h-8 text-sm"
                    />
                    <p className="text-xs text-muted-foreground">Ej: 7 días antes (urgente)</p>
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Alertas de Garantía de Equipos */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Alertas de Garantía de Equipos</p>
                  <p className="text-xs text-muted-foreground">Habilitar alertas de vencimiento de garantía</p>
                </div>
                <Switch
                  checked={settings.warranty_alert_enabled}
                  onCheckedChange={checked => setSettings({ ...settings, warranty_alert_enabled: checked })}
                />
              </div>

              {settings.warranty_alert_enabled && (
                <div className="pl-1 pt-1 border-l-2 border-muted ml-1">
                  <div className="space-y-1.5">
                    <Label htmlFor="warranty-alert-days" className="text-xs">Días de anticipación para alerta</Label>
                    <Input
                      id="warranty-alert-days"
                      type="number"
                      min="1"
                      max="365"
                      value={settings.warranty_alert_days}
                      onChange={e => setSettings({ ...settings, warranty_alert_days: parseInt(e.target.value) || 30 })}
                      className="w-28 h-8 text-sm"
                    />
                    <p className="text-xs text-muted-foreground">Días antes del vencimiento de garantía para notificar</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ── 2. Actas de entrega ── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Actas de Entrega
            </CardTitle>
            <CardDescription>
              Tiempo que tiene el receptor para aceptar un acta antes de que expire.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="space-y-1">
                <Label htmlFor="act-expiration" className="text-sm">Días para aceptar un acta</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="act-expiration"
                    type="number"
                    min="1"
                    max="30"
                    value={settings.act_expiration_days}
                    onChange={e => setSettings({ ...settings, act_expiration_days: parseInt(e.target.value) || 7 })}
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">días</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Si el receptor no acepta en este plazo, el acta expira y la asignación se cancela.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Guardar */}
        <div className="flex justify-end pb-4">
          <Button onClick={handleSave} disabled={saving}>
            {saving
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</>
              : <><Save className="mr-2 h-4 w-4" />Guardar cambios</>}
          </Button>
        </div>

      </div>
    </RoleDashboardLayout>
  )
}
