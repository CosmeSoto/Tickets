/**
 * Inventory Global Rules Tab Component
 */

import { Save, Info, Bell, FileText, Star } from 'lucide-react'
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
  onSetGlobal: <K extends keyof GlobalRules>(key: K, value: GlobalRules[K]) => void
  onSave: () => void
}

export function InventoryGlobalTab({
  isSuperAdmin,
  globalRules,
  savingGlobal,
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
              Estas reglas aplican a <strong>todo el módulo de inventario</strong>. La configuración
              específica por área se gestiona en la pestaña &quot;Por área&quot;.
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
                Notificar cuando un suministro esté por debajo del mínimo
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

          <Separator />

          {/* Mantenimientos programados (dashboard) */}
          <div className='space-y-3'>
            <div className='p-3 border rounded-lg space-y-3'>
              <div>
                <p className='text-sm font-medium'>Ventana de mantenimientos programados</p>
                <p className='text-xs text-muted-foreground'>
                  Cuántos días hacia adelante muestra el dashboard de inventario
                </p>
              </div>
              <div className='flex items-center gap-2'>
                <Input
                  type='number'
                  min='1'
                  max='365'
                  value={globalRules.maintenanceAlertDays}
                  onChange={e =>
                    onSetGlobal('maintenanceAlertDays', parseInt(e.target.value) || 30)
                  }
                  className='w-24 h-8 text-sm font-mono'
                  disabled={readOnly}
                />
                <span className='text-xs text-muted-foreground'>días</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Caducidad MRO / suministros */}
          <div className='space-y-3'>
            <div className='flex items-center justify-between p-3 border rounded-lg'>
              <div>
                <p className='text-sm font-medium'>Alertas de caducidad de suministros (MRO)</p>
                <p className='text-xs text-muted-foreground'>
                  Notificar antes de que caduquen materiales con fecha de vencimiento
                </p>
              </div>
              <Switch
                checked={globalRules.mroExpiryAlertEnabled}
                onCheckedChange={v => onSetGlobal('mroExpiryAlertEnabled', v)}
                disabled={readOnly}
              />
            </div>
            {globalRules.mroExpiryAlertEnabled && (
              <div className='grid grid-cols-1 sm:grid-cols-2 gap-4 pl-4 border-l-2 border-muted'>
                <div>
                  <Label className='text-xs'>Primera alerta (días antes)</Label>
                  <div className='flex items-center gap-2 mt-1'>
                    <Input
                      type='number'
                      min='1'
                      max='365'
                      value={globalRules.mroExpiryAlertDays}
                      onChange={e =>
                        onSetGlobal('mroExpiryAlertDays', parseInt(e.target.value) || 30)
                      }
                      className='w-24 h-8 text-sm font-mono'
                      disabled={readOnly}
                    />
                    <span className='text-xs text-muted-foreground'>días</span>
                  </div>
                </div>
                <div>
                  <Label className='text-xs'>Alerta urgente (días antes)</Label>
                  <div className='flex items-center gap-2 mt-1'>
                    <Input
                      type='number'
                      min='1'
                      max='365'
                      value={globalRules.mroExpiryAlertDaysUrgent}
                      onChange={e =>
                        onSetGlobal('mroExpiryAlertDaysUrgent', parseInt(e.target.value) || 7)
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

          {/* Lotes de equipos */}
          <div className='space-y-3'>
            <div className='flex items-center justify-between p-3 border rounded-lg'>
              <div>
                <p className='text-sm font-medium'>Alertas de utilización de lotes</p>
                <p className='text-xs text-muted-foreground'>
                  Notificar cuando un lote tenga stock bajo o alta utilización. Los valores por
                  defecto; cada área puede personalizarlos en &quot;Por área&quot;.
                </p>
              </div>
              <Switch
                checked={globalRules.batchUtilizationAlertEnabled}
                onCheckedChange={v => onSetGlobal('batchUtilizationAlertEnabled', v)}
                disabled={readOnly}
              />
            </div>
            {globalRules.batchUtilizationAlertEnabled && (
              <div className='space-y-3 pl-4 border-l-2 border-muted'>
                <div className='flex items-center justify-between p-3 border rounded-lg'>
                  <div>
                    <p className='text-sm font-medium'>Email en alertas críticas de lotes</p>
                    <p className='text-xs text-muted-foreground'>Sin stock o utilización ≥ 95 %</p>
                  </div>
                  <Switch
                    checked={globalRules.batchUtilizationEmailCritical}
                    onCheckedChange={v => onSetGlobal('batchUtilizationEmailCritical', v)}
                    disabled={readOnly}
                  />
                </div>
                <div className='flex items-center justify-between p-3 border rounded-lg'>
                  <div>
                    <p className='text-sm font-medium'>Email en alertas de advertencia de lotes</p>
                    <p className='text-xs text-muted-foreground'>Stock bajo o utilización ≥ 80 %</p>
                  </div>
                  <Switch
                    checked={globalRules.batchUtilizationEmailWarning}
                    onCheckedChange={v => onSetGlobal('batchUtilizationEmailWarning', v)}
                    disabled={readOnly}
                  />
                </div>
                <div>
                  <Label className='text-xs'>Umbral de stock bajo (% del lote)</Label>
                  <div className='flex items-center gap-2 mt-1'>
                    <Input
                      type='number'
                      min='5'
                      max='50'
                      value={globalRules.batchLowStockThresholdPct}
                      onChange={e =>
                        onSetGlobal('batchLowStockThresholdPct', parseInt(e.target.value) || 15)
                      }
                      className='w-24 h-8 text-sm font-mono'
                      disabled={readOnly}
                    />
                    <span className='text-xs text-muted-foreground'>
                      % disponibles antes de alertar
                    </span>
                  </div>
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

      {/* Calificación de proveedores */}
      <Card>
        <CardHeader>
          <CardTitle className='text-base flex items-center gap-2'>
            <Star className='h-4 w-4' />
            Calificación de proveedores
          </CardTitle>
          <CardDescription>
            Puntaje total (sobre 30, suma de los 6 criterios) a partir del cual una evaluación queda
            como Clasificación A o B. Por debajo del mínimo de B, queda en Clasificación C.
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-3'>
          <div className='flex items-center gap-4'>
            <Input
              type='number'
              min='0'
              max='30'
              value={globalRules.supplierQualificationMinA}
              onChange={e =>
                onSetGlobal('supplierQualificationMinA', parseInt(e.target.value) || 25)
              }
              className='w-24 font-mono'
              disabled={readOnly}
            />
            <p className='text-sm'>
              puntos mínimos para{' '}
              <span className='font-medium text-emerald-600'>Clasificación A</span>
            </p>
          </div>
          <div className='flex items-center gap-4'>
            <Input
              type='number'
              min='0'
              max='30'
              value={globalRules.supplierQualificationMinB}
              onChange={e =>
                onSetGlobal('supplierQualificationMinB', parseInt(e.target.value) || 19)
              }
              className='w-24 font-mono'
              disabled={readOnly}
            />
            <p className='text-sm'>
              puntos mínimos para{' '}
              <span className='font-medium text-amber-600'>Clasificación B</span>
            </p>
          </div>
          {globalRules.supplierQualificationMinB >= globalRules.supplierQualificationMinA && (
            <p className='text-xs text-destructive'>
              El mínimo de Clasificación B debe ser menor que el de Clasificación A.
            </p>
          )}
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
