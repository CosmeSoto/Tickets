'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import { Save, Bell, FileText, RefreshCw } from 'lucide-react'

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
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<InventorySettings>(DEFAULTS)

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return }
    if (status === 'authenticated' && session?.user?.role !== 'ADMIN') { router.push('/unauthorized'); return }
    if (status === 'authenticated') loadSettings()
  }, [session, status, router])

  const loadSettings = async () => {
    setLoading(true)
    try {
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
    setSaving(true)
    try {
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

  const set = (key: keyof InventorySettings, value: any) =>
    setSettings(prev => ({ ...prev, [key]: value }))

  return (
    <ModuleLayout
      title="Configuración de Inventario"
      subtitle="Alertas automáticas y reglas del módulo de inventario"
      loading={loading}
      headerActions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadSettings} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''} sm:mr-2`} />
            <span className="hidden sm:inline">Recargar</span>
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            <Save className={`h-4 w-4 ${saving ? 'animate-spin' : ''} sm:mr-2`} />
            <span className="hidden sm:inline">{saving ? 'Guardando...' : 'Guardar cambios'}</span>
          </Button>
        </div>
      }
    >
      <div className="max-w-3xl space-y-6">

        {/* Alertas */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Alertas automáticas
            </CardTitle>
            <CardDescription>
              Configura cuándo el sistema debe notificarte sobre stock bajo y vencimientos.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">

            {/* Stock bajo */}
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="text-sm font-medium">Alertas de stock bajo</p>
                <p className="text-xs text-muted-foreground">Notificar cuando un consumible esté por debajo del mínimo</p>
              </div>
              <Switch checked={settings.low_stock_alert_enabled} onCheckedChange={v => set('low_stock_alert_enabled', v)} />
            </div>

            <Separator />

            {/* Licencias y contratos */}
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="text-sm font-medium">Alertas de vencimiento de licencias y contratos</p>
                  <p className="text-xs text-muted-foreground">Notificar antes de que expiren licencias o contratos</p>
                </div>
                <Switch checked={settings.license_alert_enabled} onCheckedChange={v => set('license_alert_enabled', v)} />
              </div>
              {settings.license_alert_enabled && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pl-4 border-l-2 border-muted">
                  <div>
                    <Label className="text-xs">Primera alerta (días antes)</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Input type="number" min="1" max="365" value={settings.license_alert_days_first}
                        onChange={e => set('license_alert_days_first', parseInt(e.target.value) || 30)}
                        className="w-24 h-8 text-sm font-mono" />
                      <span className="text-xs text-muted-foreground">días</span>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Segunda alerta (días antes)</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Input type="number" min="1" max="365" value={settings.license_alert_days_second}
                        onChange={e => set('license_alert_days_second', parseInt(e.target.value) || 7)}
                        className="w-24 h-8 text-sm font-mono" />
                      <span className="text-xs text-muted-foreground">días</span>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Alerta de contratos (días antes)</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Input type="number" min="1" max="365" value={settings.contract_alert_days}
                        onChange={e => set('contract_alert_days', parseInt(e.target.value) || 30)}
                        className="w-24 h-8 text-sm font-mono" />
                      <span className="text-xs text-muted-foreground">días</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* MRO */}
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="text-sm font-medium">Alertas de caducidad de materiales MRO</p>
                  <p className="text-xs text-muted-foreground">Notificar antes de que caduquen materiales de mantenimiento</p>
                </div>
                <Switch checked={settings.mro_expiry_alert_enabled} onCheckedChange={v => set('mro_expiry_alert_enabled', v)} />
              </div>
              {settings.mro_expiry_alert_enabled && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pl-4 border-l-2 border-muted">
                  <div>
                    <Label className="text-xs">Primera alerta (días antes)</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Input type="number" min="1" max="365" value={settings.mro_expiry_alert_days}
                        onChange={e => set('mro_expiry_alert_days', parseInt(e.target.value) || 30)}
                        className="w-24 h-8 text-sm font-mono" />
                      <span className="text-xs text-muted-foreground">días</span>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Alerta urgente (días antes)</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Input type="number" min="1" max="365" value={settings.mro_expiry_alert_days_urgent}
                        onChange={e => set('mro_expiry_alert_days_urgent', parseInt(e.target.value) || 7)}
                        className="w-24 h-8 text-sm font-mono" />
                      <span className="text-xs text-muted-foreground">días</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Garantía */}
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="text-sm font-medium">Alertas de vencimiento de garantía</p>
                  <p className="text-xs text-muted-foreground">Notificar antes de que venza la garantía de un equipo</p>
                </div>
                <Switch checked={settings.warranty_alert_enabled} onCheckedChange={v => set('warranty_alert_enabled', v)} />
              </div>
              {settings.warranty_alert_enabled && (
                <div className="pl-4 border-l-2 border-muted">
                  <Label className="text-xs">Días de anticipación</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input type="number" min="1" max="365" value={settings.warranty_alert_days}
                      onChange={e => set('warranty_alert_days', parseInt(e.target.value) || 30)}
                      className="w-24 h-8 text-sm font-mono" />
                    <span className="text-xs text-muted-foreground">días antes del vencimiento</span>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Actas de entrega */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Actas de entrega
            </CardTitle>
            <CardDescription>
              Tiempo que tiene el receptor para aceptar un acta antes de que expire.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Input type="number" min="1" max="30" value={settings.act_expiration_days}
                onChange={e => set('act_expiration_days', parseInt(e.target.value) || 7)}
                className="w-24 font-mono" />
              <div>
                <p className="text-sm font-medium">días para aceptar un acta</p>
                <p className="text-xs text-muted-foreground">Si el receptor no acepta en este plazo, el acta expira y la asignación se cancela.</p>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>
    </ModuleLayout>
  )
}
