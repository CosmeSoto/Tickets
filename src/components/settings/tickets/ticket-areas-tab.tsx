/**
 * Ticket Areas Tab Component
 * Per-family ticket configuration
 */

import {
  Ticket,
  RefreshCw,
  Layers,
  ChevronRight,
  Clock,
  Timer,
  ExternalLink,
  XCircle,
  Info,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { FamilyIcon } from '@/components/inventory/family-badge'
import { TimePicker } from '@/components/ui/time-picker'
import type { Family, TicketFamilyConfig, SlaRow } from '@/hooks/use-ticket-settings'
import { DAY_OPTIONS, PRIORITY_LABELS, PRIORITY_COLORS } from '@/hooks/use-ticket-settings'
import { exampleTicketCode } from '@/lib/tickets/ticket-code-format'

interface TicketAreasTabProps {
  families: Family[]
  selectedFamilyId: string | null
  selectedFamily: Family | undefined
  config: TicketFamilyConfig | null
  slaRows: SlaRow[]
  activeDays: string[]
  loadingFamilies: boolean
  loadingConfig: boolean
  isSuperAdmin: boolean
  onSelectFamily: (id: string) => void
  onToggleTickets: (family: Family) => void
  onSetConfig: (config: TicketFamilyConfig) => void
  onToggleDay: (day: string) => void
}

export function TicketAreasTab({
  families,
  selectedFamilyId,
  selectedFamily,
  config,
  slaRows,
  activeDays,
  loadingFamilies,
  loadingConfig,
  isSuperAdmin,
  onSelectFamily,
  onToggleTickets,
  onSetConfig,
  onToggleDay,
}: TicketAreasTabProps) {
  const router = useRouter()

  return (
    <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
      {/* Family list */}
      <div className='lg:col-span-1'>
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-base flex items-center gap-2'>
              <Layers className='h-4 w-4' />
              Áreas de soporte
            </CardTitle>
            <CardDescription>
              Selecciona un área para ver y editar su configuración individual
            </CardDescription>
          </CardHeader>
          <CardContent className='p-0'>
            {loadingFamilies ? (
              <div className='flex items-center justify-center py-8'>
                <RefreshCw className='h-5 w-5 animate-spin text-muted-foreground' />
              </div>
            ) : (
              <div className='divide-y'>
                {families.map(family => (
                  <div
                    key={family.id}
                    className={`flex items-center justify-between p-3 hover:bg-muted/50 transition-colors cursor-pointer ${
                      selectedFamilyId === family.id ? 'bg-primary/5 border-l-2 border-primary' : ''
                    }`}
                    onClick={() => onSelectFamily(family.id)}
                    role='button'
                    tabIndex={0}
                    onKeyDown={e => e.key === 'Enter' && onSelectFamily(family.id)}
                  >
                    <div className='flex items-center gap-2 min-w-0 flex-1'>
                      <div
                        className='w-7 h-7 rounded-full flex items-center justify-center text-white flex-shrink-0'
                        style={{ backgroundColor: family.color || '#6B7280' }}
                      >
                        <FamilyIcon
                          icon={family.icon}
                          color={family.color}
                          code={family.code}
                          className='w-4 h-4'
                        />
                      </div>
                      <div className='min-w-0'>
                        <p className='text-sm font-medium leading-tight'>{family.name}</p>
                        <p className='text-xs text-muted-foreground font-mono'>{family.code}</p>
                      </div>
                    </div>
                    <div
                      className='flex items-center gap-1 flex-shrink-0 ml-2'
                      onClick={e => e.stopPropagation()}
                    >
                      <Switch
                        checked={family.ticketFamilyConfig?.ticketsEnabled ?? false}
                        onCheckedChange={() => onToggleTickets(family)}
                        className='scale-75'
                        disabled={!isSuperAdmin}
                      />
                      <ChevronRight className='h-4 w-4 text-muted-foreground' />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Config panel */}
      <div className='lg:col-span-2 space-y-4'>
        {!selectedFamilyId ? (
          <Card>
            <CardContent className='flex flex-col items-center justify-center py-16 text-muted-foreground'>
              <Ticket className='h-12 w-12 mb-4 opacity-30' />
              <p className='text-base font-medium'>Selecciona un área</p>
              <p className='text-sm mt-1 text-center'>
                Elige un área de la lista para ver y editar su configuración
              </p>
            </CardContent>
          </Card>
        ) : loadingConfig ? (
          <Card>
            <CardContent className='flex items-center justify-center py-16'>
              <RefreshCw className='h-6 w-6 animate-spin text-muted-foreground' />
            </CardContent>
          </Card>
        ) : config ? (
          <>
            {/* Family header */}
            <div className='flex items-center gap-3 p-4 rounded-lg border bg-card'>
              <div
                className='w-10 h-10 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0'
                style={{ backgroundColor: selectedFamily?.color || '#6B7280' }}
              >
                <FamilyIcon
                  icon={selectedFamily?.icon}
                  color={selectedFamily?.color}
                  code={selectedFamily?.code}
                  className='w-5 h-5'
                />
              </div>
              <div className='min-w-0'>
                <h3 className='font-semibold truncate'>{selectedFamily?.name}</h3>
                <p className='text-xs text-muted-foreground font-mono'>{selectedFamily?.code}</p>
              </div>
              <Badge
                variant={config.ticketsEnabled ? 'default' : 'secondary'}
                className='ml-auto flex-shrink-0'
              >
                {config.ticketsEnabled ? 'Habilitada' : 'Deshabilitada'}
              </Badge>
            </div>

            {/* Area config */}
            <Card>
              <CardHeader>
                <CardTitle className='text-base'>Configuración del área</CardTitle>
                <CardDescription>Ajustes específicos para esta área de soporte</CardDescription>
              </CardHeader>
              <CardContent className='space-y-5'>
                <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                  <div>
                    <Label htmlFor='code-prefix'>Prefijo de código de ticket</Label>
                    <Input
                      id='code-prefix'
                      value={config.codePrefix || ''}
                      onChange={e =>
                        onSetConfig({
                          ...config,
                          codePrefix: e.target.value.toUpperCase().slice(0, 10),
                        })
                      }
                      placeholder={selectedFamily?.code || 'Ej: TI'}
                      maxLength={10}
                      className='mt-1 font-mono'
                    />
                    <p className='text-xs text-muted-foreground mt-1'>
                      Ejemplo:{' '}
                      <span className='font-mono'>
                        {exampleTicketCode(config.codePrefix || selectedFamily?.code || 'TI')}
                      </span>
                    </p>
                  </div>
                  <div>
                    <Label htmlFor='alert-threshold'>Alerta de volumen</Label>
                    <Input
                      id='alert-threshold'
                      type='number'
                      value={config.alertVolumeThreshold ?? ''}
                      onChange={e =>
                        onSetConfig({
                          ...config,
                          alertVolumeThreshold: e.target.value ? parseInt(e.target.value) : null,
                        })
                      }
                      placeholder='Sin límite'
                      min={1}
                      className='mt-1'
                    />
                    <p className='text-xs text-muted-foreground mt-1'>
                      Notifica cuando los tickets abiertos superen este número
                    </p>
                  </div>
                </div>
                <div className='space-y-2'>
                  {(
                    [
                      {
                        id: 'tickets-enabled',
                        label: 'Tickets habilitados',
                        desc: 'Permite crear tickets nuevos en esta área. Los tickets existentes no se afectan.',
                        key: 'ticketsEnabled' as const,
                        superAdminOnly: true,
                      },
                      {
                        id: 'auto-assign',
                        label: 'Asignación respeta el área',
                        desc: 'La asignación automática solo elige técnicos que pertenecen a esta área',
                        key: 'autoAssignRespectsFamilies' as const,
                        superAdminOnly: false,
                      },
                    ] as const
                  ).map(item => (
                    <div
                      key={item.id}
                      className='flex items-center justify-between p-3 border rounded-lg'
                    >
                      <div>
                        <p className='text-sm font-medium'>{item.label}</p>
                        <p className='text-xs text-muted-foreground'>{item.desc}</p>
                      </div>
                      <Switch
                        checked={config[item.key] as boolean}
                        onCheckedChange={v => onSetConfig({ ...config, [item.key]: v })}
                        disabled={item.superAdminOnly && !isSuperAdmin}
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Business hours */}
            <Card>
              <CardHeader>
                <CardTitle className='text-base flex items-center gap-2'>
                  <Clock className='h-4 w-4' />
                  Horario laboral
                </CardTitle>
                <CardDescription>
                  Define cuándo está activo el equipo de esta área. Se usa para calcular SLA cuando
                  la política aplica horario laboral.
                </CardDescription>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div className='grid grid-cols-2 gap-4'>
                  <div>
                    <Label htmlFor='hours-start'>Entrada</Label>
                    <TimePicker
                      id='hours-start'
                      value={config.businessHoursStart.substring(0, 5)}
                      onChange={v => onSetConfig({ ...config, businessHoursStart: `${v}:00` })}
                      className='mt-1 w-full'
                    />
                  </div>
                  <div>
                    <Label htmlFor='hours-end'>Salida</Label>
                    <TimePicker
                      id='hours-end'
                      value={config.businessHoursEnd.substring(0, 5)}
                      onChange={v => onSetConfig({ ...config, businessHoursEnd: `${v}:00` })}
                      className='mt-1 w-full'
                    />
                  </div>
                </div>
                <div>
                  <Label className='mb-2 block'>Días laborales</Label>
                  <div className='flex gap-2 flex-wrap'>
                    {DAY_OPTIONS.map(day => {
                      const active = activeDays.includes(day.key)
                      return (
                        <button
                          key={day.key}
                          type='button'
                          onClick={() => onToggleDay(day.key)}
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
                  <p className='text-xs text-muted-foreground mt-2'>
                    {activeDays.length === 0
                      ? 'Sin días seleccionados'
                      : `${activeDays.length} día${activeDays.length !== 1 ? 's' : ''} seleccionado${activeDays.length !== 1 ? 's' : ''}`}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* SLA reference */}
            <Card>
              <CardHeader>
                <div className='flex items-start justify-between gap-2'>
                  <div>
                    <CardTitle className='text-base flex items-center gap-2'>
                      <Timer className='h-4 w-4' />
                      Tiempos SLA de referencia
                    </CardTitle>
                    <CardDescription className='mt-1'>
                      Tiempos globales del sistema. El horario de arriba determina cuándo se cuentan
                      esas horas.
                    </CardDescription>
                  </div>
                  {isSuperAdmin && (
                    <Button
                      variant='outline'
                      size='sm'
                      className='flex-shrink-0'
                      onClick={() => router.push('/admin/settings?tab=sla')}
                    >
                      <ExternalLink className='h-3.5 w-3.5 mr-1.5' />
                      Editar SLA
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className='grid grid-cols-2 sm:grid-cols-4 gap-3'>
                  {slaRows.map(row => (
                    <div
                      key={row.priority}
                      className={`rounded-lg border p-3 text-center ${PRIORITY_COLORS[row.priority]}`}
                    >
                      <p className='text-xs font-semibold uppercase tracking-wide mb-1'>
                        {PRIORITY_LABELS[row.priority]}
                      </p>
                      <p className='text-lg font-bold'>{row.response}h</p>
                      <p className='text-xs opacity-70'>respuesta</p>
                      <p className='text-sm font-semibold mt-1'>{row.resolution}h</p>
                      <p className='text-xs opacity-70'>resolución</p>
                    </div>
                  ))}
                </div>
                {!isSuperAdmin && (
                  <p className='text-xs text-muted-foreground mt-3 flex items-center gap-1'>
                    <Info className='h-3 w-3' />
                    Solo el Super Admin puede modificar los tiempos SLA
                  </p>
                )}
              </CardContent>
            </Card>
          </>
        ) : (
          <Card>
            <CardContent className='flex flex-col items-center justify-center py-16 text-muted-foreground'>
              <XCircle className='h-12 w-12 mb-4 opacity-30' />
              <p className='text-base font-medium'>Sin configuración</p>
              <p className='text-sm mt-1'>Esta área no tiene configuración de tickets aún</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
