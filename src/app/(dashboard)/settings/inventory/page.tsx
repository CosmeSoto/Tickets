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
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/hooks/use-toast'
import { Save, Loader2, Users, X } from 'lucide-react'
import { BackToInventory } from '@/components/inventory/back-to-inventory'

interface InventorySettings {
  technician_can_manage_equipment: boolean
  inventory_technician_ids: string[]
  act_expiration_days: number
  low_stock_alert_enabled: boolean
  license_alert_enabled: boolean
  license_alert_days_first: number
  license_alert_days_second: number
}

interface Technician {
  id: string
  name: string
  email: string
}

export default function InventorySettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [settings, setSettings] = useState<InventorySettings>({
    technician_can_manage_equipment: true,
    inventory_technician_ids: [],
    act_expiration_days: 7,
    low_stock_alert_enabled: true,
    license_alert_enabled: true,
    license_alert_days_first: 30,
    license_alert_days_second: 7,
  })

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
      return
    }
    if (session?.user?.role !== 'ADMIN') {
      router.push('/unauthorized')
      return
    }
    loadSettings()
    loadTechnicians()
  }, [session, status, router])

  const loadSettings = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/settings/inventory')
      if (response.ok) {
        const data = await response.json()
        // Merge con defaults para campos nuevos
        setSettings(prev => ({ ...prev, ...data.settings }))
      }
    } catch (error) {
      console.error('Error cargando configuración:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadTechnicians = async () => {
    try {
      const response = await fetch('/api/users?role=TECHNICIAN&limit=100')
      if (response.ok) {
        const data = await response.json()
        setTechnicians(data.data || [])
      }
    } catch (error) {
      console.error('Error cargando técnicos:', error)
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      const response = await fetch('/api/settings/inventory', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      if (response.ok) {
        toast({ title: 'Configuración guardada', description: 'Los cambios se han aplicado correctamente' })
      } else {
        throw new Error('Error al guardar')
      }
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo guardar la configuración', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const toggleTechnician = (techId: string) => {
    setSettings(prev => {
      const ids = prev.inventory_technician_ids || []
      if (ids.includes(techId)) {
        return { ...prev, inventory_technician_ids: ids.filter(id => id !== techId) }
      } else {
        return { ...prev, inventory_technician_ids: [...ids, techId] }
      }
    })
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
        <BackToInventory />

        {/* Permisos y Accesos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Permisos y Accesos
            </CardTitle>
            <CardDescription>Configura quién puede gestionar el inventario</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="technician-manage">Técnicos pueden gestionar equipos</Label>
                <p className="text-sm text-muted-foreground">
                  Permite a los técnicos seleccionados crear, editar y eliminar equipos
                </p>
              </div>
              <Switch
                id="technician-manage"
                checked={settings.technician_can_manage_equipment}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, technician_can_manage_equipment: checked })
                }
              />
            </div>

            {settings.technician_can_manage_equipment && (
              <div className="space-y-3 pl-1 border-l-2 border-primary/20 ml-1">
                <Label className="text-sm">Técnicos con acceso a inventario</Label>
                <p className="text-xs text-muted-foreground">
                  Si no seleccionas ninguno, todos los técnicos tendrán acceso
                </p>

                {/* Técnicos seleccionados */}
                {(settings.inventory_technician_ids?.length || 0) > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {settings.inventory_technician_ids.map(id => {
                      const tech = technicians.find(t => t.id === id)
                      return tech ? (
                        <Badge key={id} variant="secondary" className="gap-1 pr-1">
                          {tech.name}
                          <button
                            type="button"
                            onClick={() => toggleTechnician(id)}
                            className="ml-1 hover:bg-muted rounded-full p-0.5"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ) : null
                    })}
                  </div>
                )}

                {/* Lista de técnicos */}
                <div className="max-h-[200px] overflow-y-auto space-y-2 rounded-md border p-3">
                  {technicians.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No hay técnicos registrados</p>
                  ) : (
                    technicians.map(tech => (
                      <div key={tech.id} className="flex items-center gap-3">
                        <Checkbox
                          id={`tech-${tech.id}`}
                          checked={(settings.inventory_technician_ids || []).includes(tech.id)}
                          onCheckedChange={() => toggleTechnician(tech.id)}
                        />
                        <label htmlFor={`tech-${tech.id}`} className="text-sm cursor-pointer flex-1">
                          <span className="font-medium">{tech.name}</span>
                          <span className="text-muted-foreground ml-2">{tech.email}</span>
                        </label>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actas de Entrega */}
        <Card>
          <CardHeader>
            <CardTitle>Actas de Entrega</CardTitle>
            <CardDescription>Configuración de actas de entrega y devolución</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="act-expiration">Días para expiración de actas</Label>
              <Input
                id="act-expiration"
                type="number"
                min="1"
                max="30"
                value={settings.act_expiration_days}
                onChange={(e) => setSettings({ ...settings, act_expiration_days: parseInt(e.target.value) || 7 })}
                className="w-32"
              />
              <p className="text-sm text-muted-foreground">
                Días que el receptor tiene para aceptar un acta (1-30)
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Alertas de Consumibles */}
        <Card>
          <CardHeader>
            <CardTitle>Alertas de Consumibles</CardTitle>
            <CardDescription>Configuración de alertas de stock bajo</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="low-stock-alert">Alertas de stock bajo habilitadas</Label>
                <p className="text-sm text-muted-foreground">
                  Notificar cuando el stock esté por debajo del mínimo
                </p>
              </div>
              <Switch
                id="low-stock-alert"
                checked={settings.low_stock_alert_enabled}
                onCheckedChange={(checked) => setSettings({ ...settings, low_stock_alert_enabled: checked })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Alertas de Licencias */}
        <Card>
          <CardHeader>
            <CardTitle>Alertas de Licencias</CardTitle>
            <CardDescription>Configura cuándo recibir alertas de vencimiento</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="license-alert">Alertas de vencimiento habilitadas</Label>
                <p className="text-sm text-muted-foreground">
                  Enviar notificaciones antes del vencimiento de licencias
                </p>
              </div>
              <Switch
                id="license-alert"
                checked={settings.license_alert_enabled}
                onCheckedChange={(checked) => setSettings({ ...settings, license_alert_enabled: checked })}
              />
            </div>

            {settings.license_alert_enabled && (
              <div className="grid grid-cols-2 gap-4 pl-1 border-l-2 border-primary/20 ml-1">
                <div className="space-y-2">
                  <Label htmlFor="alert-first">Primera alerta (días antes)</Label>
                  <Input
                    id="alert-first"
                    type="number"
                    min="1"
                    max="90"
                    value={settings.license_alert_days_first}
                    onChange={(e) => setSettings({ ...settings, license_alert_days_first: parseInt(e.target.value) || 30 })}
                    className="w-32"
                  />
                  <p className="text-xs text-muted-foreground">Ej: 30 = alerta 30 días antes</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="alert-second">Segunda alerta (días antes)</Label>
                  <Input
                    id="alert-second"
                    type="number"
                    min="1"
                    max="90"
                    value={settings.license_alert_days_second}
                    onChange={(e) => setSettings({ ...settings, license_alert_days_second: parseInt(e.target.value) || 7 })}
                    className="w-32"
                  />
                  <p className="text-xs text-muted-foreground">Ej: 7 = alerta 7 días antes</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</>
            ) : (
              <><Save className="mr-2 h-4 w-4" />Guardar Cambios</>
            )}
          </Button>
        </div>
      </div>
    </RoleDashboardLayout>
  )
}
