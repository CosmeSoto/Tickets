'use client'

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/library'
import { Camera, CheckCircle2, ClipboardPaste, Plus, ScanLine, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { DateTimePicker } from '@/components/ui/date-time-picker'
import { FileDropZone, type PendingFile } from '@/components/common/file-drop-zone'
import { toLocalDateTimeInputValue } from '@/lib/forms/form-date'
import { parseScheduledDateTime } from '@/lib/forms/form-date'
import { DataTable, type Column } from '@/components/ui/data-table'
import { useExport } from '@/hooks/common/use-export'
import { ExportButton } from '@/components/common/export-button'
import { TableColumnsMenu } from '@/components/common/table-columns-menu'
import { useUploadLimits } from '@/hooks/use-upload-limits'
import type { ExportColumn } from '@/lib/utils/export'
import { InlineCreateSelect, type InlineSelectOption } from '@/components/ui/inline-create-select'
import { CatalogTypeInlineForm } from '@/components/inventory/asset-forms/CatalogTypeInlineForm'

type ScanResponse = {
  result: string
  valid: boolean
  message?: string
  pass?: {
    id: string
    credentialCode: string
    validFrom: string
    validUntil: string
    subject: {
      firstName: string
      lastName: string
      accessType: string
      organization?: string | null
    }
    family: { name: string; code: string }
    photoUrl?: string | null
  }
}

type AccessPass = {
  id: string
  credentialCode: string
  status: string
  validFrom: string
  validUntil: string
  subject: {
    firstName: string
    lastName: string
    organization?: string | null
    accessType: string
    isActive: boolean
  }
  family: { id?: string; name: string; color?: string | null }
}

function effectivePassLabel(pass: AccessPass): {
  label: string
  variant: 'default' | 'secondary' | 'destructive' | 'outline'
} {
  if (pass.status === 'PENDING_PRIVACY')
    return { label: 'PENDIENTE PRIVACIDAD', variant: 'outline' }
  if (pass.status === 'REVOKED') return { label: 'REVOKED', variant: 'destructive' }
  if (pass.status === 'SUSPENDED') return { label: 'SUSPENDED', variant: 'outline' }
  if (!pass.subject.isActive) return { label: 'INACTIVO', variant: 'secondary' }
  const now = Date.now()
  const until = new Date(pass.validUntil).getTime()
  const from = new Date(pass.validFrom).getTime()
  if (from > now || until <= now) return { label: 'EXPIRADO', variant: 'secondary' }
  const hoursLeft = (until - now) / (1000 * 60 * 60)
  if (hoursLeft <= 24) return { label: 'POR VENCER', variant: 'outline' }
  return { label: 'VIGENTE', variant: 'default' }
}

type Family = { id: string; name: string; code: string }

const PRIVACY_NOTICE_VERSION = 'v1'

function buildInitialForm() {
  const now = new Date()
  const until = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  return {
    familyId: '',
    firstName: '',
    lastName: '',
    email: '',
    organizationId: '',
    accessType: 'AUTHORIZED_VISITOR',
    purpose: '',
    validFrom: toLocalDateTimeInputValue(now),
    validUntil: toLocalDateTimeInputValue(until),
    privacyNoticeVersion: PRIVACY_NOTICE_VERSION,
  }
}

export function AccessConsole() {
  const { maxPersonalImageSizeMB } = useUploadLimits()
  const [payload, setPayload] = useState('')
  const [result, setResult] = useState<ScanResponse | null>(null)
  const [scanning, setScanning] = useState(false)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [canManage, setCanManage] = useState(false)
  const [passes, setPasses] = useState<AccessPass[]>([])
  const [families, setFamilies] = useState<Family[]>([])
  const [organizations, setOrganizations] = useState<InlineSelectOption[]>([])
  const [form, setForm] = useState(buildInitialForm)
  const [pendingPhotos, setPendingPhotos] = useState<PendingFile[]>([])
  const [tableFilters, setTableFilters] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [busyPassId, setBusyPassId] = useState<string | null>(null)
  const [columnOrder, setColumnOrder] = useState([
    'subject',
    'family.name',
    'credentialCode',
    'status',
    'validUntil',
  ])
  const [visibleColumns, setVisibleColumns] = useState([
    'subject',
    'family.name',
    'credentialCode',
    'status',
    'validUntil',
  ])
  const videoRef = useRef<HTMLVideoElement>(null)
  const readerRef = useRef<BrowserMultiFormatReader | null>(null)

  const loadPasses = useCallback(
    async (filters: Record<string, string> = tableFilters) => {
      const params = new URLSearchParams()
      if (filters.familyId) params.set('familyId', filters.familyId)
      if (filters.state) params.set('state', filters.state)
      if (filters.search?.trim()) params.set('search', filters.search.trim())
      const query = params.toString()
      const response = await fetch(query ? `/api/access-passes?${query}` : '/api/access-passes')
      if (!response.ok) {
        setCanManage(false)
        return
      }
      const data = await response.json()
      setCanManage(true)
      setPasses(data.passes || [])
    },
    [tableFilters]
  )

  const loadOrganizations = useCallback(async () => {
    const response = await fetch('/api/access-organizations')
    if (!response.ok) return
    const data = await response.json()
    setOrganizations(
      Array.isArray(data)
        ? data.map((organization: { id: string; name: string; description?: string | null }) => ({
            id: organization.id,
            name: organization.name,
            description: organization.description || undefined,
          }))
        : []
    )
  }, [])

  useEffect(() => {
    void loadPasses()
  }, [loadPasses])

  useEffect(() => {
    if (!canManage) return
    void fetch('/api/access-passes/families')
      .then(response => (response.ok ? response.json() : { families: [] }))
      .then(data => setFamilies(data.families || []))
    void loadOrganizations()
  }, [canManage, loadOrganizations])

  const verify = useCallback(
    async (value: string) => {
      if (!value.trim() || scanning) return
      setScanning(true)
      try {
        const response = await fetch('/api/access-passes/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payload: value }),
        })
        const data = await response.json()
        setResult(data)
      } finally {
        setScanning(false)
        setCameraOpen(false)
        readerRef.current?.reset()
      }
    },
    [scanning]
  )

  const startCamera = async () => {
    setResult(null)
    setCameraOpen(true)
    const reader = new BrowserMultiFormatReader()
    readerRef.current = reader
    try {
      const devices = await reader.listVideoInputDevices()
      const preferred =
        devices.find((device: MediaDeviceInfo) => /back|rear|environment/i.test(device.label)) ||
        devices[0]
      if (!preferred || !videoRef.current) throw new Error('No se detectó una cámara.')
      reader.decodeFromVideoDevice(preferred.deviceId, videoRef.current, scan => {
        if (scan) void verify(scan.getText())
      })
    } catch {
      setCameraOpen(false)
      setResult({
        result: 'CAMERA_ERROR',
        valid: false,
        message: 'No fue posible usar la cámara. Pega el código QR.',
      })
    }
  }

  useEffect(() => () => readerRef.current?.reset(), [])

  const createPass = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    try {
      const response = await fetch('/api/access-passes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          organizationId: form.organizationId || null,
          validFrom: parseScheduledDateTime(form.validFrom).toISOString(),
          validUntil: parseScheduledDateTime(form.validUntil).toISOString(),
          sendEmail: true,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        setResult({
          result: 'CREATE_ERROR',
          valid: false,
          message: data.error || 'No se pudo emitir el pase.',
        })
        return
      }
      const photo = pendingPhotos[0]?.file
      if (photo) {
        const upload = new FormData()
        upload.set('photo', photo)
        const photoResponse = await fetch(`/api/access-passes/${data.pass.id}/photo`, {
          method: 'POST',
          body: upload,
        })
        if (!photoResponse.ok) {
          const photoData = await photoResponse.json().catch(() => ({}))
          setResult({
            result: 'PHOTO_ERROR',
            valid: false,
            message: `La credencial fue emitida, pero no se pudo guardar la foto: ${
              photoData.error || 'error desconocido'
            }`,
          })
          pendingPhotos.forEach(p => p.preview && URL.revokeObjectURL(p.preview))
          setPendingPhotos([])
          setForm(buildInitialForm())
          await loadPasses()
          return
        }
      }
      pendingPhotos.forEach(p => p.preview && URL.revokeObjectURL(p.preview))
      setPendingPhotos([])
      setForm(buildInitialForm())
      await loadPasses()
      setResult({
        result: 'CREATED',
        valid: true,
        message:
          'Solicitud emitida. La persona recibirá un enlace para aceptar el aviso de privacidad; el QR se envía únicamente al completar esa aceptación.',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const updatePass = async (
    passId: string,
    body: Record<string, unknown>,
    successMessage: string
  ) => {
    setBusyPassId(passId)
    try {
      const response = await fetch(`/api/access-passes/${passId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await response.json()
      if (!response.ok) {
        setResult({
          result: 'UPDATE_ERROR',
          valid: false,
          message: data.error || 'No se pudo actualizar el pase.',
        })
        return
      }
      setResult({
        result: 'UPDATED',
        valid: true,
        message: successMessage,
      })
      await loadPasses()
    } finally {
      setBusyPassId(null)
    }
  }

  const resendPrivacyInvitation = async (passId: string) => {
    setBusyPassId(passId)
    try {
      const response = await fetch(`/api/access-passes/${passId}/privacy-invitation`, {
        method: 'POST',
      })
      const data = await response.json()
      setResult({
        result: response.ok ? 'INVITATION_RESENT' : 'INVITATION_ERROR',
        valid: response.ok,
        message: data.message || data.error || 'No se pudo reenviar la invitación.',
      })
      if (response.ok) await loadPasses()
    } finally {
      setBusyPassId(null)
    }
  }

  const resendCredentialEmail = async (passId: string) => {
    setBusyPassId(passId)
    try {
      const response = await fetch(`/api/access-passes/${passId}/credential-email`, {
        method: 'POST',
      })
      const data = await response.json()
      setResult({
        result: response.ok ? 'CREDENTIAL_RESENT' : 'CREDENTIAL_RESEND_ERROR',
        valid: response.ok,
        message: data.message || data.error || 'No se pudo reenviar la credencial.',
      })
      if (response.ok) await loadPasses()
    } finally {
      setBusyPassId(null)
    }
  }

  const photoUrl = result?.pass?.photoUrl || null
  const allPassColumns = useMemo<Column<AccessPass>[]>(
    () => [
      {
        key: 'subject',
        label: 'Persona',
        sortable: true,
        render: pass => (
          <div>
            <p className='font-medium'>
              {pass.subject.firstName} {pass.subject.lastName}
            </p>
            <p className='text-xs text-muted-foreground'>
              {pass.subject.organization || 'Sin arrendatario'}
            </p>
          </div>
        ),
      },
      { key: 'family.name', label: 'Área', sortable: true, render: pass => pass.family.name },
      { key: 'credentialCode', label: 'Credencial', sortable: true },
      {
        key: 'status',
        label: 'Estado',
        sortable: true,
        render: pass => {
          const badge = effectivePassLabel(pass)
          return <Badge variant={badge.variant}>{badge.label}</Badge>
        },
      },
      {
        key: 'validUntil',
        label: 'Vigente hasta',
        sortable: true,
        render: pass => new Date(pass.validUntil).toLocaleDateString('es-CO'),
      },
    ],
    []
  )
  const exportColumnByKey = useMemo<Record<string, ExportColumn>>(
    () => ({
      subject: {
        label: 'Persona',
        accessor: pass => `${pass.subject.firstName} ${pass.subject.lastName}`,
      },
      'family.name': { label: 'Área', accessor: pass => pass.family.name },
      credentialCode: { label: 'Credencial', accessor: pass => pass.credentialCode },
      status: { label: 'Estado', accessor: pass => effectivePassLabel(pass).label },
      validUntil: {
        label: 'Vigente hasta',
        accessor: pass => new Date(pass.validUntil).toLocaleString('es-CO'),
      },
    }),
    []
  )
  const passColumns = useMemo(
    () =>
      columnOrder
        .filter(key => visibleColumns.includes(key))
        .map(key => allPassColumns.find(column => column.key === key))
        .filter((column): column is Column<AccessPass> => Boolean(column)),
    [allPassColumns, columnOrder, visibleColumns]
  )
  const exportColumns = useMemo(
    () =>
      columnOrder
        .filter(key => visibleColumns.includes(key))
        .map(key => exportColumnByKey[key])
        .filter((column): column is ExportColumn => Boolean(column)),
    [columnOrder, exportColumnByKey, visibleColumns]
  )
  const { exportCSV, exportExcel, exportPDF, exporting } = useExport({
    filename: 'pases-de-acceso',
    title: 'Pases de acceso',
    subtitle: 'Listado según los filtros seleccionados',
    columns: exportColumns,
    getData: () => passes,
  })

  return (
    <div className='grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]'>
      <section className='space-y-4'>
        <div className='rounded-xl border bg-card p-4'>
          <div className='flex items-start justify-between gap-4'>
            <div>
              <h2 className='font-semibold flex items-center gap-2'>
                <ScanLine className='h-5 w-5 text-primary' /> Verificar acceso
              </h2>
              <p className='text-sm text-muted-foreground mt-1'>
                El resultado se consulta en línea y deja trazabilidad del escaneo.
              </p>
            </div>
            <Button onClick={startCamera} disabled={scanning}>
              <Camera className='mr-2 h-4 w-4' />
              Escanear
            </Button>
          </div>
          {cameraOpen && (
            <video
              ref={videoRef}
              className='mt-4 max-h-80 w-full rounded-lg bg-black object-contain'
              muted
              playsInline
            />
          )}
          <form
            className='mt-4 flex gap-2'
            onSubmit={event => {
              event.preventDefault()
              void verify(payload)
            }}
          >
            <Input
              value={payload}
              onChange={e => setPayload(e.target.value)}
              placeholder='Pega el contenido del QR si no usas cámara'
            />
            <Button type='submit' variant='outline' disabled={scanning}>
              <ClipboardPaste className='h-4 w-4' />
            </Button>
          </form>
        </div>

        {result && (
          <div
            className={`rounded-xl border p-4 ${
              result.valid
                ? 'border-emerald-500/40 bg-emerald-500/5'
                : 'border-destructive/40 bg-destructive/5'
            }`}
          >
            <div className='flex gap-3'>
              {result.valid ? (
                <CheckCircle2 className='h-6 w-6 text-emerald-600 shrink-0' />
              ) : (
                <XCircle className='h-6 w-6 text-destructive shrink-0' />
              )}
              <div>
                <p className='font-semibold'>
                  {result.valid
                    ? result.message || 'Acceso válido'
                    : result.message || 'Acceso no autorizado'}
                </p>
                {result.pass && (
                  <div className='mt-2 flex gap-3 text-sm'>
                    {photoUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={photoUrl}
                        alt=''
                        className='h-16 w-16 rounded-md object-cover border'
                      />
                    )}
                    <div className='space-y-1'>
                      <p className='font-medium'>
                        {result.pass.subject.firstName} {result.pass.subject.lastName}
                      </p>
                      <p className='text-muted-foreground'>
                        {result.pass.subject.organization || 'Sin arrendatario'} ·{' '}
                        {result.pass.family.name}
                      </p>
                      <p className='text-muted-foreground'>
                        Vigente hasta {new Date(result.pass.validUntil).toLocaleString('es-CO')}
                      </p>
                      <Badge variant='outline'>{result.pass.credentialCode}</Badge>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {canManage && (
          <DataTable
            title='Pases emitidos'
            description='Busca, filtra y exporta únicamente los pases dentro de tu alcance.'
            data={passes}
            columns={passColumns}
            filters={[
              {
                key: 'state',
                label: 'Estado',
                type: 'select',
                options: [
                  { value: 'PENDING_PRIVACY', label: 'Pendiente de privacidad' },
                  { value: 'ACTIVE', label: 'Activo' },
                  { value: 'SUSPENDED', label: 'Suspendido' },
                  { value: 'REVOKED', label: 'Revocado' },
                ],
              },
              {
                key: 'familyId',
                label: 'Área',
                type: 'select',
                options: families.map(family => ({ value: family.id, label: family.name })),
              },
            ]}
            onFiltersChange={setTableFilters}
            onRefresh={() => void loadPasses()}
            onExport={
              <ExportButton
                onExportCSV={exportCSV}
                onExportExcel={exportExcel}
                onExportPDF={exportPDF}
                loading={exporting}
              />
            }
            actions={
              <TableColumnsMenu
                columns={allPassColumns.map(column => ({
                  key: String(column.key),
                  label: column.label,
                  required: column.key === 'subject',
                }))}
                order={columnOrder}
                visible={visibleColumns}
                onOrderChange={setColumnOrder}
                onVisibleChange={setVisibleColumns}
                storageKey='table-columns:access-passes'
              />
            }
            rowActions={pass => (
              <div className='flex justify-end gap-1'>
                {pass.status === 'PENDING_PRIVACY' && (
                  <Button
                    size='sm'
                    variant='secondary'
                    disabled={busyPassId === pass.id}
                    onClick={() => void resendPrivacyInvitation(pass.id)}
                  >
                    Reenviar
                  </Button>
                )}
                {pass.status === 'ACTIVE' && (
                  <Button
                    size='sm'
                    variant='outline'
                    disabled={busyPassId === pass.id}
                    onClick={() =>
                      void updatePass(pass.id, { status: 'SUSPENDED' }, 'Pase suspendido.')
                    }
                  >
                    Suspender
                  </Button>
                )}
                {pass.status === 'ACTIVE' && (
                  <Button
                    size='sm'
                    variant='secondary'
                    disabled={busyPassId === pass.id}
                    onClick={() => void resendCredentialEmail(pass.id)}
                  >
                    Reenviar QR
                  </Button>
                )}
                {pass.status === 'SUSPENDED' && (
                  <Button
                    size='sm'
                    variant='outline'
                    disabled={busyPassId === pass.id}
                    onClick={() =>
                      void updatePass(pass.id, { status: 'ACTIVE' }, 'Pase reactivado.')
                    }
                  >
                    Reactivar
                  </Button>
                )}
                {pass.status !== 'REVOKED' && (
                  <Button
                    size='sm'
                    variant='destructive'
                    disabled={busyPassId === pass.id}
                    onClick={() => {
                      const reason = window.prompt(
                        'Motivo de revocación (obligatorio):',
                        'Acceso retirado por el área'
                      )
                      if (reason?.trim() && reason.trim().length >= 3)
                        void updatePass(
                          pass.id,
                          { status: 'REVOKED', revokedReason: reason.trim() },
                          'Pase revocado.'
                        )
                    }}
                  >
                    Revocar
                  </Button>
                )}
              </div>
            )}
            emptyState={{
              title: 'Sin pases',
              description: 'No hay pases que coincidan con los filtros actuales.',
            }}
          />
        )}
      </section>

      {canManage && (
        <aside className='rounded-xl border bg-card p-4 h-fit'>
          <h2 className='font-semibold flex items-center gap-2'>
            <Plus className='h-5 w-5 text-primary' /> Emitir pase
          </h2>
          <form onSubmit={createPass} className='mt-4 space-y-3'>
            <div className='space-y-1.5'>
              <Label>Área</Label>
              <select
                required
                className='h-10 w-full rounded-md border bg-background px-3 text-sm'
                value={form.familyId}
                onChange={e => setForm({ ...form, familyId: e.target.value })}
              >
                <option value=''>Selecciona el área</option>
                {families.map(family => (
                  <option key={family.id} value={family.id}>
                    {family.name} ({family.code})
                  </option>
                ))}
              </select>
            </div>
            <div className='grid grid-cols-2 gap-2'>
              <div className='space-y-1.5'>
                <Label>Nombres</Label>
                <Input
                  required
                  value={form.firstName}
                  onChange={e => setForm({ ...form, firstName: e.target.value })}
                />
              </div>
              <div className='space-y-1.5'>
                <Label>Apellidos</Label>
                <Input
                  required
                  value={form.lastName}
                  onChange={e => setForm({ ...form, lastName: e.target.value })}
                />
              </div>
            </div>
            <div className='space-y-1.5'>
              <Label>Correo de la persona</Label>
              <Input
                type='email'
                required
                placeholder='Necesario para activar la credencial'
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
              />
            </div>

            <FileDropZone
              pendingFiles={pendingPhotos}
              onPendingFilesChange={files => setPendingPhotos(files.slice(0, 1))}
              maxFiles={1}
              maxSizeMB={maxPersonalImageSizeMB}
              accept='image/jpeg,image/png,image/webp'
              acceptLabel='Foto de la persona (JPG, PNG, WebP)'
              allowedTypes={['image/jpeg', 'image/png', 'image/webp']}
            />
            <p className='text-[11px] text-muted-foreground -mt-1'>
              Foto opcional para identificación visual en el escaneo. No es biometría facial.
            </p>

            <div className='space-y-1.5'>
              <Label>Arrendatario / empresa</Label>
              <InlineCreateSelect
                options={organizations}
                value={form.organizationId}
                onChange={organizationId => setForm({ ...form, organizationId })}
                placeholder='Selecciona un arrendatario...'
                allowClear
                createLabel='Crear arrendatario / empresa'
                createTitle='Nuevo arrendatario / empresa'
                editTitle='Editar arrendatario / empresa'
                deleteConfirmMessage='Si ya tiene pases asociados, se desactivará en lugar de eliminarse.'
                createForm={({ item, onSuccess, onCancel }) => (
                  <CatalogTypeInlineForm
                    apiEndpoint='/api/access-organizations'
                    item={item}
                    entityLabel='arrendatario / empresa'
                    namePlaceholder='Ej: Marathon, Fybeca o Farmacias Cruz Azul'
                    codePlaceholder='Ej: MARATHON'
                    onSuccess={async saved => {
                      await loadOrganizations()
                      onSuccess(saved)
                    }}
                    onCancel={onCancel}
                  />
                )}
                onAfterSave={() => void loadOrganizations()}
                onDelete={async id => {
                  const response = await fetch(`/api/access-organizations/${id}`, {
                    method: 'DELETE',
                  })
                  if (!response.ok) {
                    const data = await response.json().catch(() => ({}))
                    throw new Error(data.error || 'No se pudo eliminar el arrendatario.')
                  }
                  await loadOrganizations()
                }}
              />
              <p className='text-xs text-muted-foreground'>
                Catálogo compartido: crea, edita o desactiva arrendatarios sin introducir texto
                libre.
              </p>
            </div>

            <div className='space-y-1.5'>
              <Label>Tipo de acceso</Label>
              <select
                className='h-10 w-full rounded-md border bg-background px-3 text-sm'
                value={form.accessType}
                onChange={e => setForm({ ...form, accessType: e.target.value })}
              >
                <option value='AUTHORIZED_VISITOR'>Visitante autorizado</option>
                <option value='TENANT_EMPLOYEE'>Empleado de arrendatario</option>
                <option value='CONTRACTOR'>Contratista</option>
              </select>
              <p className='text-[11px] text-muted-foreground'>Lista fija del sistema.</p>
            </div>

            <div className='space-y-1.5'>
              <Label>Motivo de acceso</Label>
              <Input
                value={form.purpose}
                onChange={e => setForm({ ...form, purpose: e.target.value })}
              />
            </div>

            <div className='space-y-1.5'>
              <Label>Inicio</Label>
              <DateTimePicker
                value={form.validFrom}
                onChange={v => setForm({ ...form, validFrom: v })}
              />
            </div>
            <div className='space-y-1.5'>
              <Label>Fin</Label>
              <DateTimePicker
                value={form.validUntil}
                onChange={v => setForm({ ...form, validUntil: v })}
                minDate={form.validFrom ? parseScheduledDateTime(form.validFrom) : undefined}
              />
            </div>

            <div className='rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground'>
              La persona recibirá un enlace personal para revisar y aceptar el aviso de privacidad (
              {PRIVACY_NOTICE_VERSION}). Su credencial QR no se activa ni se envía antes de esa
              aceptación.
            </div>

            <Button className='w-full' type='submit' disabled={submitting}>
              {submitting ? 'Enviando solicitud...' : 'Solicitar aceptación'}
            </Button>
          </form>
        </aside>
      )}
    </div>
  )
}
