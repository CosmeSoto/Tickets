/**
 * Inventory Global Rules Tab Component
 */

import { Save, Info, Bell, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import type { GlobalRules } from '@/hooks/use-inventory-settings'

interface InventoryGlobalTabProps {
  isSuperAdmin: boolean
  globalRules: GlobalRules
  savingGlobal: boolean
  families: Array<{ id: string; name: string; code: string; color: string | null }>
  onSetGlobal: <K extends keyof GlobalRules>(key: K, value: GlobalRules[K]) => void
  onSave: () => void
}

export function InventoryGlobalTab({
  isSuperAdmin,
  globalRules,
  savingGlobal,
  families,
  onSetGlobal,
  onSave,
}: InventoryGlobalTabProps) {
  const readOnly = !isSuperAdmin

  return (
    <div className='max-w-4xl space-y-6'>
      <div className='flex items-start gap-3 p-4 rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800'>
        <Info className='h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0' />
        <p className='text-sm text-blue-800 dark:text-blue-300'>
          {readOnly ? (
            <>
              Estas reglas aplican a <strong>todo el módulo de inventario</strong>. Solo el{' '}
              <strong>Super Administrador</strong> puede modificarlas.
            </>
          ) : (
            <>
              Estas reglas aplican a <strong>todo el módulo de inventario</strong>. La
              configuración específica por área se gestiona en la pestaña &quot;Por área&quot;.
            </>
          )}
        </p>
      </div>

      {/* Alertas automáticas */}
      <Card>
        <CardHeader>
          <CardTitle className='text-base flex items-center gap-2'>
            <Bell className='h-4 w-4' />
            Alertas automáticas
          </CardTitle>
          <CardDescription>Cuándo notificar sobre vencimientos y stock bajo</CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          {/* Stock bajo */}
          <div className='flex items-center justify-between p-3 border rounded-lg'>
            <div>
              <p className='text-sm font-medium'>Alertas de stock bajo</p>
              <p className='text-xs text-muted-foreground'>
                Notificar cuando un consumible esté por debajo del mínimo
              </p>
            </div>
            <Switch
              checked={globalRules.lowStockAlertEnabled}
              onCheckedChange={v => onSetGlobal('lowStockAlertEnabled', v)}
              disabled={readOnly}
            />
          </div>

          <Separator />

          {/* Licencias y contratos */}
          <div className='space-y-3'>
            <div className='flex items-center justify-between p-3 border rounded-lg'>
              <div>
                <p className='text-sm font-medium'>
                  Alertas de vencimiento de licencias y contratos
                </p>
                <p className='text-xs text-muted-foreground'>
                  Notificar antes de que expiren licencias o contratos
                </p>
              </div>
              <Switch
                checked={globalRules.licenseAlertEnabled}
                onCheckedChange={v => onSetGlobal('licenseAlertEnabled', v)}
                disabled={readOnly}
              />
            </div>
            {globalRules.licenseAlertEnabled && (
              <div className='grid grid-cols-1 sm:grid-cols-3 gap-4 pl-4 border-l-2 border-muted'>
                <div>
                  <Label className='text-xs'>Primera alerta (días antes)</Label>
                  <div className='flex items-center gap-2 mt-1'>
                    <Input
                      type='number'
                      min='1'
                      max='365'
                      value={globalRules.licenseAlertDaysFirst}
                      onChange={e =>
                        onSetGlobal('licenseAlertDaysFirst', parseInt(e.target.value) || 30)
                      }
                      className='w-24 h-8 text-sm font-mono'
                      disabled={readOnly}
                    />
                    <span className='text-xs text-muted-foreground'>días</span>
                  </div>
                </div>
                <div>
                  <Label className='text-xs'>Segunda alerta (días antes)</Label>
                  <div className='flex items-center gap-2 mt-1'>
                    <Input
                      type='number'
                      min='1'
                      max='365'
                      value={globalRules.licenseAlertDaysSecond}
                      onChange={e =>
                        onSetGlobal('licenseAlertDaysSecond', parseInt(e.target.value) || 7)
                      }
                      className='w-24 h-8 text-sm font-mono'
                      disabled={readOnly}
                    />
                    <span className='text-xs text-muted-foreground'>días</span>
                  </div>
                </div>
                <div>
                  <Label className='text-xs'>Alerta de contratos (días antes)</Label>
                  <div className='flex items-center gap-2 mt-1'>
                    <Input
                      type='number'
                      min='1'
                      max='365'
                      value={globalRules.contractAlertDays}
                      onChange={e =>
                        onSetGlobal('contractAlertDays', parseInt(e.target.value) || 30)
                      }
                      className='w-24 h-8 text-sm font-mono'
                      disabled={readOnly}
                    />
                    <span className='text-xs text-muted-foreground'>días</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Garantía */}
          <div className='space-y-3'>
            <div className='flex items-center justify-between p-3 border rounded-lg'>
              <div>
                <p className='text-sm font-medium'>Alertas de vencimiento de garantía</p>
                <p className='text-xs text-muted-foreground'>
                  Notificar antes de que venza la garantía de un equipo
                </p>
              </div>
              <Switch
                checked={globalRules.warrantyAlertEnabled}
                onCheckedChange={v => onSetGlobal('warrantyAlertEnabled', v)}
                disabled={readOnly}
              />
            </div>
            {globalRules.warrantyAlertEnabled && (
              <div className='pl-4 border-l-2 border-muted'>
                <Label className='text-xs'>Días de anticipación</Label>
                <div className='flex items-center gap-2 mt-1'>
                  <Input
                    type='number'
                    min='1'
                    max='365'
                    value={globalRules.warrantyAlertDays}
                    onChange={e => onSetGlobal('warrantyAlertDays', parseInt(e.target.value) || 30)}
                    className='w-24 h-8 text-sm font-mono'
                    disabled={readOnly}
                  />
                  <span className='text-xs text-muted-foreground'>días antes del vencimiento</span>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Actas de entrega */}
      <Card>
        <CardHeader>
          <CardTitle className='text-base flex items-center gap-2'>
            <FileText className='h-4 w-4' />
            Actas de entrega
          </CardTitle>
          <CardDescription>
            Tiempo que tiene el receptor para aceptar un acta antes de que expire
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className='flex items-center gap-4'>
            <Input
              type='number'
              min='1'
              max='30'
              value={globalRules.actExpirationDays}
              onChange={e => onSetGlobal('actExpirationDays', parseInt(e.target.value) || 7)}
              className='w-24 font-mono'
              disabled={readOnly}
            />
            <div>
              <p className='text-sm font-medium'>días para aceptar un acta</p>
              <p className='text-xs text-muted-foreground'>
                Si el receptor no acepta en este plazo, el acta expira y la asignación se cancela.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {isSuperAdmin && (
        <div className='flex justify-end'>
          <Button onClick={onSave} disabled={savingGlobal}>
            <Save className={`h-4 w-4 mr-2 ${savingGlobal ? 'animate-spin' : ''}`} />
            {savingGlobal ? 'Guardando...' : 'Guardar reglas generales'}
          </Button>
        </div>
      )}
    </div>
  )
}
