'use client'

/**
 * BulkLicenseForm — alta masiva de licencias.
 *
 * A diferencia del lote de equipos (BulkEquipmentForm, unidades idénticas),
 * acá cada renglón es una licencia con su propio tipo/plan y su propio
 * colaborador asignado — pensado para el caso real de una orden de compra
 * anual con N licencias de planes distintos (ej. M365 Básico / Business
 * Premium / +Power BI), cada una para una persona. Comparten proveedor,
 * N° de factura/orden de compra y fecha de compra.
 */
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Loader2, KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DateInput } from '@/components/ui/date-input'
import { SimpleSelect } from '@/components/ui/simple-select'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { SupplierSelect } from '@/components/inventory/suppliers/SupplierSelect'
import { sanitizeInvoiceNumberInput } from '@/lib/inventory/invoice-number'
import { inventoryToast as toast } from '@/lib/utils/inventory-toast'

interface LicenseType {
  id: string
  name: string
}

interface AssignableUserOption {
  id: string
  name: string
  email: string
}

interface Row {
  uid: string
  licenseTypeId: string
  name: string
  assignedToUser: string
  cost: string
  key: string
}

let rowSeq = 0
function newRow(licenseTypeId: string, typeName: string, defaultCost: string): Row {
  rowSeq += 1
  return {
    uid: `r${rowSeq}`,
    licenseTypeId,
    name: typeName,
    assignedToUser: '',
    cost: defaultCost,
    key: '',
  }
}

export interface BulkLicenseFormProps {
  familyId: string
  onSuccess?: (result: { count: number }) => void
  onCancel?: () => void
}

export function BulkLicenseForm({ familyId, onSuccess, onCancel }: BulkLicenseFormProps) {
  const router = useRouter()
  const [licenseTypes, setLicenseTypes] = useState<LicenseType[]>([])
  const [users, setUsers] = useState<AssignableUserOption[]>([])
  const [loadingCatalog, setLoadingCatalog] = useState(true)

  // Compartido por todo el lote
  const [supplierId, setSupplierId] = useState<string | null>(null)
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [purchaseOrderNumber, setPurchaseOrderNumber] = useState('')
  const [purchaseDate, setPurchaseDate] = useState('')
  const [defaultCost, setDefaultCost] = useState('')
  const [addCount, setAddCount] = useState('10')

  const [rows, setRows] = useState<Row[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch(`/api/inventory/license-types?familyId=${familyId}`).then(r => r.json()),
      fetch(`/api/inventory/assignable-users?familyId=${familyId}`).then(r => r.json()),
    ])
      .then(([typesRes, usersRes]) => {
        const types: LicenseType[] = typesRes.types ?? typesRes ?? []
        setLicenseTypes(types)
        setUsers(usersRes.users ?? [])
        if (types.length > 0) {
          setRows([newRow(types[0].id, types[0].name, '')])
        }
      })
      .catch(() => toast.error('No se pudieron cargar los tipos de licencia'))
      .finally(() => setLoadingCatalog(false))
  }, [familyId])

  const userOptions = useMemo(
    () => users.map(u => ({ value: u.id, label: `${u.name} — ${u.email}` })),
    [users]
  )

  const defaultType = licenseTypes[0]

  const addRows = (count: number) => {
    if (!defaultType || count < 1) return
    const additions = Array.from({ length: count }, () =>
      newRow(defaultType.id, defaultType.name, defaultCost)
    )
    setRows(prev => [...prev, ...additions])
  }

  const removeRow = (uid: string) => setRows(prev => prev.filter(r => r.uid !== uid))

  const updateRow = (uid: string, patch: Partial<Row>) =>
    setRows(prev => prev.map(r => (r.uid === uid ? { ...r, ...patch } : r)))

  const handleTypeChange = (row: Row, typeId: string) => {
    const type = licenseTypes.find(t => t.id === typeId)
    // Si el nombre todavía era el sugerido del tipo anterior, lo actualiza también —
    // si el usuario ya lo personalizó, lo respeta.
    const wasAutoName = licenseTypes.some(t => t.name === row.name)
    updateRow(row.uid, {
      licenseTypeId: typeId,
      name: wasAutoName && type ? type.name : row.name,
    })
  }

  const totalCost = rows.reduce((sum, r) => sum + (parseFloat(r.cost) || 0), 0)

  const handleSubmit = async () => {
    setError(null)
    if (rows.length === 0) {
      setError('Agrega al menos una licencia')
      return
    }
    const missingType = rows.find(r => !r.licenseTypeId)
    if (missingType) {
      setError('Todas las filas necesitan un tipo de licencia')
      return
    }
    const missingName = rows.find(r => !r.name.trim())
    if (missingName) {
      setError('Todas las filas necesitan un nombre')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/inventory/licenses/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          familyId,
          supplierId: supplierId || undefined,
          invoiceNumber: invoiceNumber || undefined,
          purchaseOrderNumber: purchaseOrderNumber || undefined,
          purchaseDate: purchaseDate || undefined,
          rows: rows.map(r => ({
            licenseTypeId: r.licenseTypeId,
            name: r.name.trim(),
            assignedToUser: r.assignedToUser || undefined,
            cost: r.cost ? parseFloat(r.cost) : undefined,
            key: r.key || undefined,
          })),
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? 'No se pudieron crear las licencias')

      toast.success(`Se crearon ${json.count ?? rows.length} licencia(s)`)
      if (onSuccess) onSuccess(json)
      else router.push('/inventory')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido'
      setError(message)
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loadingCatalog) {
    return (
      <div className='flex items-center justify-center py-16'>
        <Loader2 className='h-6 w-6 animate-spin text-muted-foreground' />
      </div>
    )
  }

  if (licenseTypes.length === 0) {
    return (
      <div className='text-center py-10 text-muted-foreground'>
        <KeyRound className='h-10 w-10 mx-auto mb-3 opacity-30' />
        <p className='text-sm'>Esta área todavía no tiene tipos de licencia configurados.</p>
        <p className='text-xs mt-1'>
          Crea al menos un tipo (ej. &quot;M365 Básico&quot;) antes de dar de alta un lote.
        </p>
      </div>
    )
  }

  return (
    <div className='space-y-6'>
      {/* Datos compartidos del lote */}
      <div className='rounded-lg border p-4 space-y-4'>
        <p className='text-sm font-medium'>Datos comunes del lote</p>
        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
          <div className='space-y-1'>
            <Label>Proveedor</Label>
            <SupplierSelect value={supplierId} onChange={setSupplierId} familyId={familyId} />
          </div>
          <div className='space-y-1'>
            <Label>Fecha de compra</Label>
            <DateInput
              value={purchaseDate}
              onChange={e => setPurchaseDate(e.target.value)}
              clearable
            />
          </div>
          <div className='space-y-1'>
            <Label>N° Factura</Label>
            <Input
              value={invoiceNumber}
              onChange={e => setInvoiceNumber(sanitizeInvoiceNumberInput(e.target.value))}
              placeholder='001-001-000000123'
            />
          </div>
          <div className='space-y-1'>
            <Label>
              N° Orden de Compra{' '}
              <span className='text-xs font-normal text-muted-foreground'>(opcional)</span>
            </Label>
            <Input
              value={purchaseOrderNumber}
              onChange={e => setPurchaseOrderNumber(sanitizeInvoiceNumberInput(e.target.value))}
              placeholder='001-001-000000123'
            />
          </div>
          <div className='space-y-1'>
            <Label>Costo por defecto (por unidad)</Label>
            <Input
              type='number'
              min='0'
              step='0.01'
              value={defaultCost}
              onChange={e => setDefaultCost(e.target.value)}
              placeholder='0.00'
            />
            <p className='text-xs text-muted-foreground'>
              Precarga el costo de las filas nuevas — cada fila lo puede ajustar (los planes no
              cuestan lo mismo).
            </p>
          </div>
        </div>
      </div>

      {/* Agregar filas */}
      <div className='flex flex-wrap items-end gap-2'>
        <div className='space-y-1'>
          <Label className='text-xs'>Agregar filas</Label>
          <div className='flex gap-2'>
            <Input
              type='number'
              min='1'
              max='100'
              value={addCount}
              onChange={e => setAddCount(e.target.value)}
              className='w-24'
            />
            <Button
              type='button'
              variant='outline'
              onClick={() => addRows(parseInt(addCount, 10) || 0)}
            >
              <Plus className='h-4 w-4 mr-1' /> Generar filas
            </Button>
          </div>
        </div>
        <p className='text-xs text-muted-foreground pb-2'>
          {rows.length} licencia{rows.length !== 1 ? 's' : ''} en el lote
          {totalCost > 0 && ` · $${totalCost.toFixed(2)} total`}
        </p>
      </div>

      {/* Filas */}
      <div className='space-y-2'>
        {rows.map((row, i) => (
          <div key={row.uid} className='rounded-lg border p-3 space-y-3'>
            <div className='flex items-center justify-between'>
              <span className='text-xs font-medium text-muted-foreground'>Licencia {i + 1}</span>
              <Button
                type='button'
                variant='ghost'
                size='sm'
                onClick={() => removeRow(row.uid)}
                className='h-7 w-7 p-0 text-destructive hover:text-destructive'
              >
                <Trash2 className='h-3.5 w-3.5' />
              </Button>
            </div>
            <div className='grid grid-cols-1 gap-3 sm:grid-cols-4'>
              <div className='space-y-1'>
                <Label className='text-xs'>Tipo / plan</Label>
                <SimpleSelect
                  value={row.licenseTypeId}
                  onChange={e => handleTypeChange(row, e.target.value)}
                  options={licenseTypes.map(t => ({ value: t.id, label: t.name }))}
                  className='h-8 text-sm'
                />
              </div>
              <div className='space-y-1'>
                <Label className='text-xs'>Nombre</Label>
                <Input
                  className='h-8 text-sm'
                  value={row.name}
                  onChange={e => updateRow(row.uid, { name: e.target.value })}
                />
              </div>
              <div className='space-y-1 sm:col-span-1'>
                <Label className='text-xs'>Asignar a</Label>
                <SearchableSelect
                  options={userOptions}
                  value={row.assignedToUser}
                  onChange={v => updateRow(row.uid, { assignedToUser: v })}
                  placeholder='Sin asignar'
                  emptyLabel='Sin colaboradores'
                />
              </div>
              <div className='space-y-1'>
                <Label className='text-xs'>Costo</Label>
                <Input
                  className='h-8 text-sm'
                  type='number'
                  min='0'
                  step='0.01'
                  value={row.cost}
                  onChange={e => updateRow(row.uid, { cost: e.target.value })}
                  placeholder='0.00'
                />
              </div>
            </div>
          </div>
        ))}
        {rows.length === 0 && (
          <p className='text-sm text-muted-foreground text-center py-6'>
            Sin filas todavía. Usa &quot;Generar filas&quot; para empezar.
          </p>
        )}
      </div>

      {error && <p className='text-sm text-destructive'>{error}</p>}

      <div className='flex justify-end gap-2'>
        <Button type='button' variant='outline' onClick={onCancel} disabled={submitting}>
          Cancelar
        </Button>
        <Button type='button' onClick={handleSubmit} disabled={submitting || rows.length === 0}>
          {submitting && <Loader2 className='h-4 w-4 mr-1.5 animate-spin' />}
          Crear {rows.length} licencia{rows.length !== 1 ? 's' : ''}
        </Button>
      </div>
    </div>
  )
}
