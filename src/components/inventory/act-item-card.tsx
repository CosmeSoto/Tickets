'use client'

import { Package } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  PAYMENT_METHOD_TYPE_LABELS,
  getServiceSubtypeLabel,
  type PaymentMethodType,
} from '@/types/contracts'
import { CONTRACT_TYPE_LABELS } from '@/lib/inventory/license-labels'

/**
 * Tarjeta del "activo" de un acta de entrega — única fuente de verdad para diferenciar
 * qué se muestra según `actType`. Antes cada pantalla (vista pública de firma, detalle
 * interno) tenía su propia copia de esta lógica; la del detalle interno ni siquiera
 * distinguía el tipo, así que un acta de suscripción (SUB-2026-...) terminaba mostrando
 * la tarjeta "Equipo entregado" con Código/N° Serie/Marca/Modelo en blanco porque esos
 * campos nunca existen en el snapshot de un contrato.
 *
 * Úsalo en cualquier pantalla que renderice un acta: `<ActItemCard actType={act.actType}
 * snapshot={act.equipmentSnapshot} accessories={act.accessories} />`.
 */

export const EQUIPMENT_TYPE_LABELS: Record<string, string> = {
  LAPTOP: 'Laptop',
  DESKTOP: 'Desktop',
  MONITOR: 'Monitor',
  PRINTER: 'Impresora',
  PHONE: 'Teléfono',
  TABLET: 'Tablet',
  KEYBOARD: 'Teclado',
  MOUSE: 'Mouse',
  HEADSET: 'Audífonos',
  WEBCAM: 'Webcam',
  DOCKING_STATION: 'Docking Station',
  UPS: 'UPS',
  ROUTER: 'Router',
  SWITCH: 'Switch',
  OTHER: 'Otro',
}

export const EQUIPMENT_CONDITION_LABELS: Record<string, string> = {
  NEW: 'Nuevo',
  LIKE_NEW: 'Como Nuevo',
  GOOD: 'Bueno',
  FAIR: 'Regular',
  POOR: 'Malo',
}

interface ActItemCardProps {
  /** Columna `actType` del acta (delivery_acts.actType). `null`/`undefined` = equipo estándar. */
  actType?: string | null
  snapshot: Record<string, any>
  accessories?: string[] | null
}

export function ActItemCard({ actType, snapshot: snap, accessories }: ActItemCardProps) {
  const type = actType ?? 'EQUIPMENT_ASSIGNMENT'

  // ── Suscripción / contrato (licencias, servicios recurrentes) ──────────────
  if (type === 'SUBSCRIPTION_ASSIGNMENT' || type === 'CONTRACT_RENEWAL') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2 text-base'>
            <Package className='h-5 w-5' />
            Servicio / Suscripción
          </CardTitle>
        </CardHeader>
        <CardContent className='grid gap-4 sm:grid-cols-2'>
          <Field label='Contrato' value={snap.name} />
          <Field label='Proveedor' value={(snap.supplier as { name?: string })?.name} />
          <Field
            label='Tipo de servicio'
            value={getServiceSubtypeLabel(
              typeof snap.serviceSubtype === 'string' ? snap.serviceSubtype : null
            )}
          />
          <Field
            label='Método de pago'
            value={
              snap.paymentMethodType
                ? PAYMENT_METHOD_TYPE_LABELS[snap.paymentMethodType as PaymentMethodType]
                : undefined
            }
          />
          <Field
            label='Costo mensual'
            value={
              snap.monthlyCost != null
                ? `${snap.monthlyCost} ${String(snap.currency ?? '')}`.trim()
                : undefined
            }
          />
          <Field label='Custodio' value={(snap.custodian as { name?: string })?.name} />
          <div className='sm:col-span-2'>
            <Field label='Email de facturación' value={snap.billingAccountEmail} />
          </div>
        </CardContent>
      </Card>
    )
  }

  // ── Licencia de software ────────────────────────────────────────────────────
  if (type === 'LICENSE_ASSIGNMENT') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2 text-base'>
            <Package className='h-5 w-5' />
            Licencia entregada
          </CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='grid gap-4 sm:grid-cols-2 md:grid-cols-3'>
            <Field label='Licencia' value={snap.name} />
            <Field label='Tipo' value={snap.typeName} />
            <Field
              label='Proveedor'
              value={(snap.supplier as { name?: string })?.name ?? snap.vendor}
            />
            <Field
              label='Tipo de contrato'
              value={
                snap.contractType
                  ? (CONTRACT_TYPE_LABELS[snap.contractType as string] ?? snap.contractType)
                  : undefined
              }
            />
            <Field label='Costo' value={snap.cost} />
            <Field label='Vencimiento' value={formatSnapshotDate(snap.expirationDate)} />
          </div>

          {Array.isArray(snap.customValues) && snap.customValues.length > 0 && (
            <>
              <Separator />
              <div>
                <p className='text-xs text-muted-foreground uppercase tracking-wide mb-3'>
                  Atributos de la licencia
                </p>
                <div className='grid gap-3 sm:grid-cols-2 md:grid-cols-3'>
                  {(
                    snap.customValues as Array<{
                      fieldName: string
                      fieldValue: string
                      fieldLabel?: string
                    }>
                  ).map(cv => (
                    <div key={cv.fieldName}>
                      <p className='text-xs text-muted-foreground uppercase tracking-wide mb-1'>
                        {cv.fieldLabel ?? cv.fieldName}
                      </p>
                      <p className='font-medium text-sm'>{cv.fieldValue || '—'}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    )
  }

  // ── Suministro / material de bodega (MRO) ──────────────────────────────────
  if (type === 'MRO_DELIVERY') {
    const qty = snap.quantity != null ? `${snap.quantity} ${snap.unit ?? ''}`.trim() : undefined
    return (
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2 text-base'>
            <Package className='h-5 w-5' />
            Suministro entregado
          </CardTitle>
        </CardHeader>
        <CardContent className='grid gap-4 sm:grid-cols-2 md:grid-cols-3'>
          <Field label='Suministro' value={snap.name ?? snap.code} />
          <Field label='Categoría' value={snap.brand} />
          <Field label='Cantidad entregada' value={qty} />
        </CardContent>
      </Card>
    )
  }

  // ── Equipo (asignación estándar, servicio/mantenimiento, o transferencia) ──
  const title =
    type === 'SERVICE_COMPLETION'
      ? 'Equipo intervenido'
      : type === 'ASSET_TRANSFER'
        ? 'Activo transferido'
        : 'Equipo entregado'

  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2 text-base'>
          <Package className='h-5 w-5' />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='grid gap-4 sm:grid-cols-2 md:grid-cols-3'>
          <Field label='Código' value={snap.code} />
          <Field label='Número de serie' value={snap.serialNumber} />
          <Field
            label='Tipo'
            value={snap.typeName || (snap.type && EQUIPMENT_TYPE_LABELS[snap.type]) || snap.type}
          />
          <Field label='Marca' value={snap.brand} />
          <Field label='Modelo' value={snap.model} />
          <Field
            label='Condición'
            value={EQUIPMENT_CONDITION_LABELS[snap.condition] ?? snap.condition}
          />
        </div>

        {type === 'SERVICE_COMPLETION' && snap.serviceDescription && (
          <>
            <Separator />
            <div>
              <p className='text-sm font-medium mb-1'>Descripción del servicio realizado</p>
              <p className='text-sm whitespace-pre-wrap'>{snap.serviceDescription}</p>
            </div>
          </>
        )}

        {type === 'ASSET_TRANSFER' && (
          <>
            <Separator />
            <div className='grid gap-4 sm:grid-cols-2'>
              <Field label='Bodega origen' value={snap.originWarehouse} />
              <Field
                label='Bodega destino'
                value={snap.destinationWarehouse ?? snap.warehouseDestId}
              />
            </div>
          </>
        )}

        {snap.specifications && Object.keys(snap.specifications).length > 0 && (
          <>
            <Separator />
            <div>
              <p className='text-sm font-medium mb-2'>Especificaciones técnicas</p>
              <div className='grid gap-2 md:grid-cols-2'>
                {Object.entries(snap.specifications as Record<string, unknown>).map(
                  ([key, value]) => (
                    <div key={key} className='text-sm'>
                      <span className='text-muted-foreground'>{key}:</span>{' '}
                      <span className='font-medium'>{String(value)}</span>
                    </div>
                  )
                )}
              </div>
            </div>
          </>
        )}

        {snap.equipmentImagePath && (
          <>
            <Separator />
            <div>
              <p className='text-xs text-muted-foreground uppercase tracking-wide mb-2'>
                Imagen del equipo
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={snap.equipmentImagePath}
                alt={`${snap.brand ?? ''} ${snap.model ?? ''}`.trim() || 'Equipo'}
                className='rounded-md border border-border object-contain max-h-48 max-w-xs'
              />
            </div>
          </>
        )}

        {Array.isArray(snap.customValues) && snap.customValues.length > 0 && (
          <>
            <Separator />
            <div>
              <p className='text-xs text-muted-foreground uppercase tracking-wide mb-3'>
                Atributos del equipo
              </p>
              <div className='grid gap-3 sm:grid-cols-2 md:grid-cols-3'>
                {(
                  snap.customValues as Array<{
                    fieldName: string
                    fieldValue: string
                    fieldLabel?: string
                    /** @deprecated nombre anterior de fieldLabel — actas generadas antes de este fix */
                    label?: string
                  }>
                ).map(cv => (
                  <div key={cv.fieldName}>
                    <p className='text-xs text-muted-foreground uppercase tracking-wide mb-1'>
                      {cv.fieldLabel ?? cv.label ?? cv.fieldName}
                    </p>
                    <p className='font-medium text-sm'>{cv.fieldValue || '—'}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>

      {accessories && accessories.length > 0 && (
        <CardContent className='pt-0'>
          <Separator className='mb-4' />
          <p className='text-xs text-muted-foreground uppercase tracking-wide mb-2'>
            Accesorios incluidos
          </p>
          <ul className='space-y-1'>
            {accessories.map((acc, i) => (
              <li key={i} className='flex items-center gap-2 text-sm'>
                <div className='h-1.5 w-1.5 rounded-full bg-primary' />
                {acc}
              </li>
            ))}
          </ul>
        </CardContent>
      )}
    </Card>
  )
}

function formatSnapshotDate(value: unknown): string | undefined {
  if (!value) return undefined
  const date = new Date(value as string)
  return Number.isNaN(date.getTime()) ? undefined : date.toLocaleDateString('es-ES')
}

function Field({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <p className='text-xs text-muted-foreground uppercase tracking-wide mb-1'>{label}</p>
      <p className='font-medium'>{value != null && value !== '' ? String(value) : '—'}</p>
    </div>
  )
}
