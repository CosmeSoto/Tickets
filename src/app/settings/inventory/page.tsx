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
import { Loader2, Save, Package, Bell, FileText, Clock, Shield } from 'lucide-react'

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

const DEFAULTS: InventorySettings = {
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
}

export default function InventorySettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const [settings, setSettings] = useState<InventorySettings>(DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (status === 'loading') return
    if (!session) { router.push('/login'); return }
    if (session.user.role !== 'ADMIN') { router.push('/unauthorized'); return }
    fetchSettings()
  }, [session, status, router])

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings/inventory')
      if (res.ok) {
        const data = await res.json()
        setSettings({ ...DEFAULTS, ...data.settings })
      }
    } catch {
      toast({ title: 'Error', description: 'No se pudo cargar la configuración', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/settings/inventory', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      if (res.ok) {
        toast({ title: 'Configuración guardada', description: 'Los cambios se aplicarán inmediatamente.' })
      } else {
        const err = await res.json()
        toast({ title: 'Error', description: err.error || 'Error al guardar', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const set = (key: keyof InventorySettings, value: boolean | number) =>
    setSettings(p => ({ ...p, [key]: value }))

  if (loading) {
    return (
      <RoleDashboardLayout title="Configuración de Inventario" subtitle="Ajustes del módulo de inventario">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </RoleDashboardLayout>
    )
  }

  return (
    <RoleDashboardLayout
      title="Configuración de Inventario"
      subtitle="Ajusta los parámetros del módulo de inventario"
      headerActions={
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Guardar cambios
        </Button>
      }
    >
      <div className="max-w-3xl space-y-6">

        {/* Actas de entrega */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-primary" />
              Actas de Entrega
            </CardTitle>
            <CardDescription>Configuración de vencimiento de actas pendientes de firma</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Días para expiración de actas</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Días que tiene el receptor para firmar un acta antes de que expire
                </p>
              </div>
              <Input
                type="number" min={1} max={30}
                value={settings.act_expiration_days}
                onChange={e => set('act_expiration_days', parseInt(e.target.value) || 7)}
                className="w-24 text-right"
              />
            </div>
          </CardContent>
        </Card>

        {/* Alertas de stock */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Package className="h-4 w-4 text-primary" />
              Alertas de Stock MRO
            </CardTitle>
            <CardDescription>Notificaciones cuando el stock de materiales baja del mínimo o está por caducar</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Alertas de stock bajo</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Notificar cuando el stock cae por debajo del mínimo</p>
              </div>
              <Switch
                checked={settings.low_stock_alert_enabled}
                onCheckedChange={v => set('low_stock_alert_enabled', v)}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <Label>Alertas de caducidad MRO</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Notificar cuando materiales están próximos a caducar</p>
              </div>
              <Switch
                checked={settings.mro_expiry_alert_enabled}
                onCheckedChange={v => set('mro_expiry_alert_enabled', v)}
              />
            </div>
            {settings.mro_expiry_alert_enabled && (
              <div className="grid grid-cols-2 gap-4 pl-4 border-l-2 border-border">
                <div className="space-y-1">
                  <Label className="text-xs">Primera alerta (días antes)</Label>
                  <Input type="number" min={1} max={365} value={settings.mro_expiry_alert_days}
                    onChange={e => set('mro_expiry_alert_days', parseInt(e.target.value) || 30)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Alerta urgente (días antes)</Label>
                  <Input type="number" min={1} max={365} value={settings.mro_expiry_alert_days_urgent}
                    onChange={e => set('mro_expiry_alert_days_urgent', parseInt(e.target.value) || 7)} />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Alertas de licencias y contratos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="h-4 w-4 text-primary" />
              Alertas de Licencias y Contratos
            </CardTitle>
            <CardDescription>Notificaciones de vencimiento de licencias de software y contratos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Alertas de vencimiento de licencias</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Notificar cuando licencias están próximas a vencer</p>
              </div>
              <Switch
                checked={settings.license_alert_enabled}
                onCheckedChange={v => set('license_alert_enabled', v)}
              />
            </div>
            {settings.license_alert_enabled && (
              <div className="grid grid-cols-2 gap-4 pl-4 border-l-2 border-border">
                <div className="space-y-1">
                  <Label className="text-xs">Primera alerta (días antes)</Label>
                  <Input type="number" min={1} max={90} value={settings.license_alert_days_first}
                    onChange={e => set('license_alert_days_first', parseInt(e.target.value) || 30)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Segunda alerta (días antes)</Label>
                  <Input type="number" min={1} max={90} value={settings.license_alert_days_second}
                    onChange={e => set('license_alert_days_second', parseInt(e.target.value) || 7)} />
                </div>
              </div>
            )}
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <Label>Días de alerta para contratos</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Días antes del vencimiento de un contrato para alertar</p>
              </div>
              <Input type="number" min={1} max={365} value={settings.contract_alert_days}
                onChange={e => set('contract_alert_days', parseInt(e.target.value) || 30)}
                className="w-24 text-right" />
            </div>
          </CardContent>
        </Card>

        {/* Alertas de garantías */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-4 w-4 text-primary" />
              Alertas de Garantías
            </CardTitle>
            <CardDescription>Notificaciones cuando las garantías de equipos están por vencer</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Alertas de vencimiento de garantía</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Notificar cuando la garantía de un equipo está próxima a vencer</p>
              </div>
              <Switch
                checked={settings.warranty_alert_enabled}
                onCheckedChange={v => set('warranty_alert_enabled', v)}
              />
            </div>
            {settings.warranty_alert_enabled && (
              <div className="pl-4 border-l-2 border-border">
                <div className="space-y-1">
                  <Label className="text-xs">Días antes para alertar</Label>
                  <Input type="number" min={1} max={365} value={settings.warranty_alert_days}
                    onChange={e => set('warranty_alert_days', parseInt(e.target.value) || 30)}
                    className="w-32" />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Botón guardar al final también */}
        <div className="flex justify-end pb-6">
          <Button onClick={handleSave} disabled={saving} size="lg">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Guardar configuración
          </Button>
        </div>
      </div>
    </RoleDashboardLayout>
  )
}
