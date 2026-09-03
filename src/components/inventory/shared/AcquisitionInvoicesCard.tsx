'use client'

/**
 * AcquisitionInvoicesCard — libro de facturas/pagos de adquisición.
 *
 * Generaliza lo que antes era EquipmentInvoicesCard (equipo-only) para que
 * Equipos y Licencias compartan el mismo componente en vez de reimplementar
 * el mismo formulario dos veces — el único punto de variación real entre
 * ambos es qué endpoint de API golpear, dado por `assetType`.
 *
 * Los dos modales (crear/editar factura, y pagar/abonar) viven en
 * AcquisitionInvoiceFormDialog / AcquisitionPaymentDialog — compartidos con
 * la página global de Pagos, para que no existan dos versiones del mismo
 * modal divergiendo con el tiempo.
 */

import { Fragment, useState, useEffect, useCallback, useMemo } from 'react'
import {
  Receipt,
  Plus,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  CheckCircle2,
  Pencil,
  Trash2,
  Loader2,
  Layers,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { inventoryToast as toast } from '@/lib/utils/inventory-toast'
import { AcquisitionInvoiceFormDialog } from './AcquisitionInvoiceFormDialog'
import { AcquisitionPaymentDialog } from './AcquisitionPaymentDialog'
import {
  ACQUISITION_INVOICE_API,
  ACQUISITION_STATUS_CONFIG,
  fmtAcquisitionCurrency,
  fmtAcquisitionDate,
  type AcquisitionAssetType,
  type AcquisitionInvoice,
} from './acquisition-invoices'

export type { AcquisitionAssetType } from './acquisition-invoices'

// ── Componente principal ──────────────────────────────────────────────────────

interface AcquisitionInvoicesCardProps {
  assetType: AcquisitionAssetType
  assetId: string
  canManage?: boolean
  /** Proveedor ya cargado en el activo — se usa para pre-llenar "Registrar
   * factura" en vez de pedirlo de cero cada vez (el campo sigue editable,
   * por si una factura puntual es de otro proveedor). */
  defaultSupplierId?: string | null
  defaultSupplierName?: string | null
}

export function AcquisitionInvoicesCard({
  assetType,
  assetId,
  canManage = false,
  defaultSupplierId = null,
  defaultSupplierName = null,
}: AcquisitionInvoicesCardProps) {
  const endpoints = ACQUISITION_INVOICE_API[assetType]

  const [expanded, setExpanded] = useState(false)
  const [invoices, setInvoices] = useState<AcquisitionInvoice[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)

  // Dialogs
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<AcquisitionInvoice | null>(null)
  const [converting, setConverting] = useState<AcquisitionInvoice | null>(null)
  const [payingInvoice, setPayingInvoice] = useState<AcquisitionInvoice | null>(null)
  const [deleting, setDeleting] = useState<AcquisitionInvoice | null>(null)
  const [saving, setSaving] = useState(false)
  // Planes de cuotas expandidos — por groupId. Colapsados por defecto: un
  // plan de 12 o 24 cuotas no debería inundar la tabla con una fila por
  // cuota, así que se agrupan bajo una sola fila resumen (ver `rows` abajo).
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  function toggleGroup(groupId: string) {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }

  // ── Carga de datos ──────────────────────────────────────────────────────────

  const loadInvoices = useCallback(async (): Promise<AcquisitionInvoice[]> => {
    setLoading(true)
    try {
      const res = await fetch(endpoints.list(assetId))
      const data = await res.json()
      const list: AcquisitionInvoice[] = data.invoices ?? []
      setInvoices(list)
      return list
    } catch {
      toast.error('Error al cargar facturas')
      return []
    } finally {
      setLoading(false)
      setLoaded(true)
    }
  }, [assetId, endpoints])

  useEffect(() => {
    if (expanded && !loaded) loadInvoices()
  }, [expanded, loaded, loadInvoices])

  // Si el modal de pago/abono sigue abierto cuando `loadInvoices()` trae
  // datos nuevos (tras deshacer un abono — al registrar uno, el modal ya se
  // cerró solo), lo sincroniza con el saldo recalculado.
  useEffect(() => {
    setPayingInvoice(prev => (prev ? (invoices.find(i => i.id === prev.id) ?? null) : prev))
  }, [invoices])

  function openCreate() {
    setEditing(null)
    setConverting(null)
    setShowForm(true)
  }

  function openEdit(inv: AcquisitionInvoice) {
    setEditing(inv)
    setConverting(null)
    setShowForm(true)
  }

  function openConvert(inv: AcquisitionInvoice) {
    setEditing(null)
    setConverting(inv)
  }

  function closeInvoiceForm() {
    setShowForm(false)
    setConverting(null)
  }

  // ── Eliminar ────────────────────────────────────────────────────────────────

  async function handleDelete() {
    if (!deleting) return
    setSaving(true)
    try {
      const res = await fetch(endpoints.item(deleting.id), { method: 'DELETE' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'No se pudo eliminar')
      toast.success('Factura eliminada')
      setDeleting(null)
      await loadInvoices()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al eliminar')
    } finally {
      setSaving(false)
    }
  }

  // ── Estadísticas rápidas ────────────────────────────────────────────────────

  const totals = invoices.reduce(
    (acc, inv) => {
      if (inv.status !== 'CANCELLED') {
        acc.total += inv.amount
        acc.paid += inv.paidAmount
        acc.pending += inv.amount - inv.paidAmount
      }
      return acc
    },
    { total: 0, paid: 0, pending: 0 }
  )

  const currency = invoices[0]?.currency ?? 'USD'
  const hasInvoices = invoices.length > 0

  // ── Agrupar cuotas de un mismo plan bajo una sola fila ──────────────────────
  // Sin esto, un plan de 12 o 24 cuotas listaría cada una como fila suelta —
  // ilegible apenas hay más de un par de facturas. Cada cuota "hermana"
  // comparte `scheduleGroupId`; una factura de pago único no tiene uno y se
  // lista tal cual.
  type Row =
    | { kind: 'single'; inv: AcquisitionInvoice }
    | { kind: 'group'; groupId: string; items: AcquisitionInvoice[] }

  const rows = useMemo<Row[]>(() => {
    const seen = new Set<string>()
    const out: Row[] = []
    for (const inv of invoices) {
      const gid = inv.scheduleGroupId
      if (!gid) {
        out.push({ kind: 'single', inv })
        continue
      }
      if (seen.has(gid)) continue
      seen.add(gid)
      const items = invoices
        .filter(i => i.scheduleGroupId === gid)
        .sort((a, b) => (a.installmentNumber ?? 0) - (b.installmentNumber ?? 0))
      out.push({ kind: 'group', groupId: gid, items })
    }
    return out
  }, [invoices])

  // ── Fila de una factura/cuota individual — reutilizada tal cual para
  // facturas de pago único y, indentada, para cada cuota dentro de un plan
  // expandido. `compact` oculta lo que ya se ve en la fila resumen del plan
  // (N° de factura y OC, iguales para todas sus cuotas).
  function renderInvoiceRow(inv: AcquisitionInvoice, compact = false) {
    const cfg = ACQUISITION_STATUS_CONFIG[inv.status]
    const Icon = cfg.icon
    const canPay =
      inv.status === 'PENDING' || inv.status === 'OVERDUE' || inv.status === 'PARTIALLY_PAID'
    // Un solo botón por fila para pagar/ver abonos — antes "Pagar" y
    // "Abonos" convivían y abrían el mismo diálogo, lo que confundía más de
    // lo que ayudaba.
    const payLabel = inv.paidAmount > 0 ? 'Abonar' : 'Pagar'
    return (
      <tr
        key={inv.id}
        className={`border-t hover:bg-muted/30 transition-colors ${compact ? 'bg-muted/10' : ''}`}
      >
        <td className={`px-3 py-2 ${compact ? 'pl-8' : ''}`}>
          {compact ? (
            <p className='text-xs font-medium'>
              Cuota {inv.installmentNumber}/{inv.installmentCount}
            </p>
          ) : (
            <>
              <p className='font-mono text-xs font-medium'>{inv.invoiceNumber ?? '—'}</p>
              {!!inv.installmentCount && (
                <p className='text-xs text-muted-foreground'>
                  Cuota {inv.installmentNumber}/{inv.installmentCount}
                </p>
              )}
              {inv.purchaseOrderNumber && (
                <p className='text-xs text-muted-foreground'>OC: {inv.purchaseOrderNumber}</p>
              )}
            </>
          )}
        </td>
        <td className='px-3 py-2 text-xs'>{inv.supplier?.name ?? inv.supplierName ?? '—'}</td>
        <td className='px-3 py-2 whitespace-nowrap font-medium'>
          {fmtAcquisitionCurrency(inv.amount, inv.currency)}
          {inv.paidAmount > 0 && inv.status !== 'PAID' && (
            <span className='block text-xs font-normal text-muted-foreground'>
              Abonado: {fmtAcquisitionCurrency(inv.paidAmount, inv.currency)}
            </span>
          )}
        </td>
        <td className='px-3 py-2 whitespace-nowrap text-xs'>
          {inv.status === 'PAID' ? (
            <span className='text-muted-foreground'>
              Pagado: {fmtAcquisitionDate(inv.paidDate)}
            </span>
          ) : (
            fmtAcquisitionDate(inv.dueDate)
          )}
        </td>
        <td className='px-3 py-2'>
          <Badge variant={cfg.variant} className={`gap-1 text-xs ${cfg.className ?? ''}`}>
            <Icon className='h-3 w-3' />
            {cfg.label}
          </Badge>
        </td>
        {canManage && (
          <td className='px-3 py-2'>
            <div className='flex items-center gap-1 justify-end'>
              {(canPay || inv.paidAmount > 0) && (
                <Button
                  type='button'
                  size='sm'
                  variant='outline'
                  className='h-7 text-xs'
                  onClick={() => setPayingInvoice(inv)}
                  title={canPay ? 'Registrar un pago o abono' : 'Ver abonos registrados'}
                >
                  {canPay ? (
                    <CheckCircle2 className='h-3 w-3 mr-1' />
                  ) : (
                    <Receipt className='h-3 w-3 mr-1' />
                  )}
                  {canPay ? payLabel : 'Abonos'}
                </Button>
              )}
              {inv.paidAmount <= 0.01 && !inv.installmentCount && (
                <button
                  type='button'
                  onClick={() => openConvert(inv)}
                  className='p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors'
                  title='Convertir a plan de cuotas'
                >
                  <Layers className='h-3.5 w-3.5' />
                </button>
              )}
              <button
                type='button'
                onClick={() => openEdit(inv)}
                className='p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors'
                title='Editar'
              >
                <Pencil className='h-3.5 w-3.5' />
              </button>
              <button
                type='button'
                onClick={() => inv.paidAmount <= 0.01 && setDeleting(inv)}
                disabled={inv.paidAmount > 0.01}
                className={`p-1 rounded transition-colors ${
                  inv.paidAmount > 0.01
                    ? 'text-muted-foreground/40 cursor-not-allowed'
                    : 'hover:bg-destructive/10 text-muted-foreground hover:text-destructive'
                }`}
                title={
                  inv.paidAmount > 0.01
                    ? 'Tiene abonos registrados — deshazlos primero para poder eliminarla'
                    : 'Eliminar'
                }
              >
                <Trash2 className='h-3.5 w-3.5' />
              </button>
            </div>
          </td>
        )}
      </tr>
    )
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Acordeón ─────────────────────────────────────────────────────── */}
      <div className='rounded-md border border-border overflow-hidden'>
        <button
          type='button'
          className='flex w-full items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors'
          onClick={() => setExpanded(p => !p)}
        >
          <span className='flex items-center gap-2'>
            <Receipt className='h-4 w-4 text-muted-foreground' />
            Facturas / Pagos de adquisición
            {hasInvoices && (
              <Badge variant='secondary' className='text-xs'>
                {invoices.filter(i => i.status !== 'CANCELLED').length}
              </Badge>
            )}
            {invoices.some(i => i.status === 'OVERDUE') && (
              <Badge variant='destructive' className='text-xs'>
                Vencido
              </Badge>
            )}
          </span>
          <div className='flex items-center gap-2'>
            {hasInvoices && (
              <span className='text-xs text-muted-foreground hidden sm:block'>
                {fmtAcquisitionCurrency(totals.paid, currency)} pagado
                {totals.pending > 0 &&
                  ` · ${fmtAcquisitionCurrency(totals.pending, currency)} pendiente`}
              </span>
            )}
            {expanded ? <ChevronUp className='h-4 w-4' /> : <ChevronDown className='h-4 w-4' />}
          </div>
        </button>

        {expanded && (
          <div className='border-t border-border px-4 py-4 space-y-4'>
            {/* Cabecera con acción */}
            <div className='flex items-center justify-between'>
              <p className='text-xs text-muted-foreground'>
                {hasInvoices
                  ? `${invoices.length} factura(s) registrada(s) — Total: ${fmtAcquisitionCurrency(totals.total, currency)}`
                  : 'Sin facturas registradas aún.'}
              </p>
              {canManage && (
                <Button type='button' size='sm' variant='outline' onClick={openCreate}>
                  <Plus className='h-3.5 w-3.5 mr-1.5' />
                  Registrar factura
                </Button>
              )}
            </div>

            {/* Lista */}
            {loading ? (
              <div className='flex items-center justify-center py-6 text-muted-foreground gap-2'>
                <Loader2 className='h-4 w-4 animate-spin' />
                <span className='text-sm'>Cargando facturas…</span>
              </div>
            ) : hasInvoices ? (
              <div className='rounded-md border overflow-hidden'>
                <table className='w-full text-sm'>
                  <thead className='bg-muted/50 text-left text-xs text-muted-foreground'>
                    <tr>
                      <th className='px-3 py-2 font-medium'>Factura / OC</th>
                      <th className='px-3 py-2 font-medium'>Proveedor</th>
                      <th className='px-3 py-2 font-medium'>Monto</th>
                      <th className='px-3 py-2 font-medium'>Vencimiento</th>
                      <th className='px-3 py-2 font-medium'>Estado</th>
                      {canManage && <th className='px-3 py-2 font-medium' />}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(row => {
                      if (row.kind === 'single') return renderInvoiceRow(row.inv)

                      // ── Fila resumen de un plan de cuotas ──────────────
                      const { groupId, items } = row
                      const first = items[0]
                      const groupTotal = items.reduce((s, i) => s + i.amount, 0)
                      const groupPaid = items.reduce((s, i) => s + i.paidAmount, 0)
                      const paidCount = items.filter(i => i.status === 'PAID').length
                      const hasOverdue = items.some(i => i.status === 'OVERDUE')
                      const allPaid = paidCount === items.length
                      const nextPending = items
                        .filter(i => i.status !== 'PAID')
                        .sort(
                          (a, b) =>
                            new Date(a.dueDate ?? 0).getTime() - new Date(b.dueDate ?? 0).getTime()
                        )[0]
                      const groupStatus: keyof typeof ACQUISITION_STATUS_CONFIG = hasOverdue
                        ? 'OVERDUE'
                        : allPaid
                          ? 'PAID'
                          : groupPaid > 0
                            ? 'PARTIALLY_PAID'
                            : 'PENDING'
                      const cfg = ACQUISITION_STATUS_CONFIG[groupStatus]
                      const Icon = cfg.icon
                      const isOpen = expandedGroups.has(groupId)

                      return (
                        <Fragment key={groupId}>
                          <tr
                            className='border-t hover:bg-muted/30 transition-colors cursor-pointer'
                            onClick={() => toggleGroup(groupId)}
                          >
                            <td className='px-3 py-2'>
                              <div className='flex items-center gap-1.5'>
                                {isOpen ? (
                                  <ChevronDown className='h-3.5 w-3.5 text-muted-foreground shrink-0' />
                                ) : (
                                  <ChevronRight className='h-3.5 w-3.5 text-muted-foreground shrink-0' />
                                )}
                                <div>
                                  <p className='font-mono text-xs font-medium'>
                                    {first.invoiceNumber ?? '—'}
                                  </p>
                                  <p className='text-xs text-muted-foreground'>
                                    Plan de {items.length} cuotas
                                  </p>
                                  {first.purchaseOrderNumber && (
                                    <p className='text-xs text-muted-foreground'>
                                      OC: {first.purchaseOrderNumber}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className='px-3 py-2 text-xs'>
                              {first.supplier?.name ?? first.supplierName ?? '—'}
                            </td>
                            <td className='px-3 py-2 whitespace-nowrap font-medium'>
                              {fmtAcquisitionCurrency(groupTotal, first.currency)}
                              {groupPaid > 0 && !allPaid && (
                                <span className='block text-xs font-normal text-muted-foreground'>
                                  Abonado: {fmtAcquisitionCurrency(groupPaid, first.currency)}
                                </span>
                              )}
                            </td>
                            <td className='px-3 py-2 whitespace-nowrap text-xs'>
                              {allPaid ? (
                                <span className='text-muted-foreground'>
                                  Pagado: {fmtAcquisitionDate(items[items.length - 1]?.paidDate)}
                                </span>
                              ) : (
                                fmtAcquisitionDate(nextPending?.dueDate)
                              )}
                            </td>
                            <td className='px-3 py-2'>
                              <Badge
                                variant={cfg.variant}
                                className={`gap-1 text-xs ${cfg.className ?? ''}`}
                              >
                                <Icon className='h-3 w-3' />
                                {cfg.label}
                              </Badge>
                              <p className='text-xs text-muted-foreground mt-0.5'>
                                {paidCount}/{items.length} cuotas pagadas
                              </p>
                            </td>
                            {canManage && <td className='px-3 py-2' />}
                          </tr>
                          {isOpen && items.map(inv => renderInvoiceRow(inv, true))}
                        </Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              canManage && (
                <button
                  type='button'
                  onClick={openCreate}
                  className='w-full rounded-md border border-dashed border-border py-6 text-sm text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors'
                >
                  <Plus className='h-4 w-4 mx-auto mb-1' />
                  Registrar primera factura
                </button>
              )
            )}
          </div>
        )}
      </div>

      {/* ── El único modal de crear/editar/convertir factura ──────────────── */}
      <AcquisitionInvoiceFormDialog
        open={showForm || !!converting}
        onOpenChange={open => !open && closeInvoiceForm()}
        onSaved={async () => {
          await loadInvoices()
        }}
        assetType={assetType}
        assetId={assetId}
        defaultSupplierId={defaultSupplierId}
        defaultSupplierName={defaultSupplierName}
        editing={editing}
        convertingInvoice={converting}
      />

      {/* ── El único modal de pagar/abonar ────────────────────────────────── */}
      <AcquisitionPaymentDialog
        assetType={assetType}
        invoice={payingInvoice}
        onOpenChange={open => !open && setPayingInvoice(null)}
        onChanged={async () => {
          await loadInvoices()
        }}
      />

      {/* ── AlertDialog: confirmar eliminar ──────────────────────────────── */}
      <AlertDialog open={!!deleting} onOpenChange={open => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta factura?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting?.invoiceNumber
                ? `Se eliminará la factura ${deleting.invoiceNumber} por ${fmtAcquisitionCurrency(deleting.amount, deleting.currency)}.`
                : `Se eliminará el registro de ${fmtAcquisitionCurrency(deleting?.amount ?? 0, deleting?.currency ?? 'USD')}.`}{' '}
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={saving}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            >
              {saving ? 'Eliminando…' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
