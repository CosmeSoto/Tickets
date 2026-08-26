'use client'

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/library'
import {
  Camera,
  CheckCircle2,
  ClipboardPaste,
  History,
  MoreHorizontal,
  Pencil,
  Plus,
  ScanLine,
  Trash2,
  XCircle,
} from 'lucide-react'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Checkbox } from '@/components/ui/checkbox'
import { formatAccessDateTime } from '@/lib/access/access-dates'
import {
  accessTypeLabel,
  accessTypeRequiresOrganization,
  formatAccessBelongsTo,
  formatAccessPurpose,
} from '@/lib/access/access-labels'

type ScanResponse = {
  result: string
  valid: boolean
  message?: string
  error?: string
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
      purpose?: string | null
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
    email?: string | null
    organization?: string | null
    accessType: string
    purpose?: string | null
    isActive: boolean
  }
  family: { id?: string; name: string; color?: string | null }
}

function effectivePassLabel(pass: AccessPass): {
  label: string
  variant: 'default' | 'secondary' | 'destructive' | 'outline'
} {
  if (pass.status === 'REVOKED') return { label: 'REVOCADO', variant: 'destructive' }
  const now = Date.now()
  const until = new Date(pass.validUntil).getTime()
  const from = new Date(pass.validFrom).getTime()
  // No confundir "todavía no inicia" con "ya terminó": son estados distintos
  // para quien gestiona el acceso (uno se resuelve esperando, el otro reemitiendo).
  if (from > now) return { label: 'PROGRAMADO', variant: 'outline' }
  if (until <= now) return { label: 'EXPIRADO', variant: 'secondary' }
  if (pass.status === 'PENDING_PRIVACY')
    return { label: 'PENDIENTE DE PRIVACIDAD', variant: 'outline' }
  if (pass.status === 'SUSPENDED') return { label: 'SUSPENDIDO', variant: 'outline' }
  if (!pass.subject.isActive) return { label: 'INACTIVO', variant: 'secondary' }
  const hoursLeft = (until - now) / (1000 * 60 * 60)
  if (hoursLeft <= 24) return { label: 'POR VENCER', variant: 'outline' }
  return { label: 'VIGENTE', variant: 'default' }
}

const SCAN_RESULT_LABELS: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  VALID: { label: 'Autorizado', variant: 'default' },
  EXPIRED: { label: 'Vencido', variant: 'secondary' },
  NOT_YET_VALID: { label: 'Aún no vigente', variant: 'outline' },
  REVOKED: { label: 'Revocado', variant: 'destructive' },
  SUSPENDED: { label: 'Suspendido', variant: 'outline' },
  PENDING_PRIVACY: { label: 'Pend. privacidad', variant: 'outline' },
  INACTIVE_SUBJECT: { label: 'Inactivo', variant: 'secondary' },
  NOT_FOUND: { label: 'No encontrado', variant: 'destructive' },
  OUT_OF_SCOPE: { label: 'Fuera de alcance', variant: 'secondary' },
}

function scanResultLabel(result: string): {
  label: string
  variant: 'default' | 'secondary' | 'destructive' | 'outline'
} {
  return SCAN_RESULT_LABELS[result] ?? { label: result, variant: 'outline' }
}

type Family = { id: string; name: string; code: string }

/** Registro individual del historial de escaneos */
type ScanEvent = {
  id: string
  result: string
  scannedAt: string
  failureCode?: string | null
  agent: { id: string; name: string }
  family?: { id: string; name: string; code: string } | null
  pass?: {
    id: string
    credentialCode: string
    subject: {
      firstName: string
      lastName: string
      accessType: string
      organization?: string | null
    }
  } | null
}

type ScanEventsPagination = {
  total: number
  page: number
  limit: number
  totalPages: number
}

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
  const [canDelete, setCanDelete] = useState(false)
  const [passes, setPasses] = useState<AccessPass[]>([])
  const [selectedPassIds, setSelectedPassIds] = useState<string[]>([])
  const [deletePassIds, setDeletePassIds] = useState<string[] | null>(null)
  const [editingPass, setEditingPass] = useState<AccessPass | null>(null)
  const [editValidFrom, setEditValidFrom] = useState('')
  const [editValidUntil, setEditValidUntil] = useState('')
  const [families, setFamilies] = useState<Family[]>([])
  const [organizations, setOrganizations] = useState<InlineSelectOption[]>([])
  const [form, setForm] = useState(buildInitialForm)
  const [pendingPhotos, setPendingPhotos] = useState<PendingFile[]>([])
  const [tableFilters, setTableFilters] = useState<Record<string, string>>({})
  const [tablePage, setTablePage] = useState(1)
  const [tableLimit, setTableLimit] = useState(10)
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('cards')
  const [submitting, setSubmitting] = useState(false)
  const [busyPassId, setBusyPassId] = useState<string | null>(null)

  // ── Historial de escaneos ──────────────────────────────────────────────────
  const [scanEvents, setScanEvents] = useState<ScanEvent[]>([])
  const [scanEventsPagination, setScanEventsPagination] = useState<ScanEventsPagination>({
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 1,
  })
  const [scanEventsPage, setScanEventsPage] = useState(1)
  const [scanEventsLimit, setScanEventsLimit] = useState(20)
  const [scanEventsFilters, setScanEventsFilters] = useState<Record<string, string>>({})
  const [scanEventsLoading, setScanEventsLoading] = useState(false)
  // ──────────────────────────────────────────────────────────────────────────

  const [columnOrder, setColumnOrder] = useState([
    'subject',
    'family.name',
    'subject.accessType',
    'subject.organization',
    'subject.purpose',
    'status',
    'validUntil',
    'credentialCode',
    'subject.email',
  ])
  const [visibleColumns, setVisibleColumns] = useState([
    'subject',
    'family.name',
    'subject.accessType',
    'subject.organization',
    'subject.purpose',
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
        setCanDelete(false)
        return
      }
      const data = await response.json()
      setCanManage(true)
      setCanDelete(data.canDelete === true)
      const nextPasses: AccessPass[] = data.passes || []
      setPasses(nextPasses)
      setSelectedPassIds(ids => ids.filter(id => nextPasses.some(pass => pass.id === id)))
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
    const maxPage = Math.max(1, Math.ceil(passes.length / tableLimit))
    if (tablePage > maxPage) setTablePage(maxPage)
  }, [passes.length, tableLimit, tablePage])

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const syncView = () => setViewMode(mq.matches ? 'cards' : 'table')
    syncView()
    mq.addEventListener('change', syncView)
    return () => mq.removeEventListener('change', syncView)
  }, [])

  useEffect(() => {
    if (!canManage) return
    void fetch('/api/access-passes/families')
      .then(response => (response.ok ? response.json() : { families: [] }))
      .then(data => setFamilies(data.families || []))
    void loadOrganizations()
  }, [canManage, loadOrganizations])

  const loadScanEvents = useCallback(
    async (
      opts: {
        page?: number
        limit?: number
        filters?: Record<string, string>
      } = {}
    ) => {
      const page = opts.page ?? scanEventsPage
      const limit = opts.limit ?? scanEventsLimit
      const filters = opts.filters ?? scanEventsFilters
      setScanEventsLoading(true)
      try {
        const params = new URLSearchParams()
        params.set('page', String(page))
        params.set('limit', String(limit))
        if (filters.familyId) params.set('familyId', filters.familyId)
        if (filters.result) params.set('result', filters.result)
        if (filters.accessType) params.set('accessType', filters.accessType)
        if (filters.organizationId) params.set('organizationId', filters.organizationId)
        if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
        if (filters.dateTo) params.set('dateTo', filters.dateTo)
        if (filters.search?.trim()) params.set('search', filters.search.trim())
        const response = await fetch(`/api/access-passes/scan-events?${params.toString()}`)
        if (!response.ok) return
        const data = await response.json()
        setScanEvents(data.events ?? [])
        setScanEventsPagination(data.pagination)
      } finally {
        setScanEventsLoading(false)
      }
    },
    [scanEventsPage, scanEventsLimit, scanEventsFilters]
  )

  // Cargar historial cuando el usuario tiene acceso de escaneo o gestión
  useEffect(() => {
    void loadScanEvents()
  }, [loadScanEvents])

  const handleScanEventsFiltersChange = useCallback((filters: Record<string, string>) => {
    setScanEventsFilters(filters)
    setScanEventsPage(1)
  }, [])

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
        // Actualizar historial con la página 1 para mostrar el escaneo recién hecho
        void loadScanEvents({ page: 1 })
        setScanEventsPage(1)
      } finally {
        setScanning(false)
        setCameraOpen(false)
        readerRef.current?.reset()
      }
    },
    [scanning, loadScanEvents]
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
    if (accessTypeRequiresOrganization(form.accessType) && !form.organizationId) {
      setResult({
        result: 'CREATE_ERROR',
        valid: false,
        message: `Selecciona el arrendatario/empresa: es obligatorio para "${accessTypeLabel(form.accessType)}".`,
      })
      return
    }
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

  const confirmDeletePasses = async () => {
    if (!deletePassIds?.length || !canDelete) return
    const ids = deletePassIds
    setBusyPassId(ids.length === 1 ? ids[0] : 'bulk')
    try {
      const response =
        ids.length === 1
          ? await fetch(`/api/access-passes/${ids[0]}`, { method: 'DELETE' })
          : await fetch('/api/access-passes', {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ids }),
            })
      const data = await response.json().catch(() => ({}))
      setResult({
        result: response.ok ? 'DELETED' : 'DELETE_ERROR',
        valid: response.ok,
        message:
          data.message ||
          data.error ||
          (response.ok ? 'Pase eliminado.' : 'No se pudo eliminar el pase.'),
      })
      if (response.ok) {
        setSelectedPassIds([])
        setDeletePassIds(null)
        await loadPasses()
      }
    } finally {
      setBusyPassId(null)
    }
  }

  const openEditPass = (pass: AccessPass) => {
    setEditingPass(pass)
    setEditValidFrom(toLocalDateTimeInputValue(pass.validFrom))
    setEditValidUntil(toLocalDateTimeInputValue(pass.validUntil))
  }

  const saveEditPass = async () => {
    if (!editingPass) return
    const validFrom = parseScheduledDateTime(editValidFrom)
    const validUntil = parseScheduledDateTime(editValidUntil)
    if (Number.isNaN(validFrom.getTime()) || Number.isNaN(validUntil.getTime())) {
      setResult({
        result: 'UPDATE_ERROR',
        valid: false,
        message: 'Indica fechas de vigencia válidas.',
      })
      return
    }
    if (validUntil <= validFrom) {
      setResult({
        result: 'UPDATE_ERROR',
        valid: false,
        message: 'La vigencia final debe ser posterior al inicio.',
      })
      return
    }
    await updatePass(
      editingPass.id,
      {
        validFrom: validFrom.toISOString(),
        validUntil: validUntil.toISOString(),
      },
      'Vigencia del pase actualizada.'
    )
    setEditingPass(null)
  }

  const handleTableFiltersChange = useCallback((filters: Record<string, string>) => {
    setTableFilters(filters)
    setTablePage(1)
  }, [])

  const togglePassSelection = useCallback((passId: string, checked: boolean) => {
    setSelectedPassIds(ids =>
      checked ? [...new Set([...ids, passId])] : ids.filter(id => id !== passId)
    )
  }, [])

  const renderPassActions = useCallback(
    (pass: AccessPass) => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size='sm'
            variant='outline'
            disabled={busyPassId === pass.id}
            onClick={e => e.stopPropagation()}
          >
            <MoreHorizontal className='h-4 w-4' />
            <span className='sr-only'>Acciones</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end' className='w-52'>
          {pass.status !== 'REVOKED' && (
            <DropdownMenuItem
              onClick={e => {
                e.stopPropagation()
                openEditPass(pass)
              }}
            >
              <Pencil className='mr-2 h-4 w-4' />
              Editar vigencia
            </DropdownMenuItem>
          )}
          {pass.status === 'PENDING_PRIVACY' && (
            <DropdownMenuItem
              onClick={e => {
                e.stopPropagation()
                void resendPrivacyInvitation(pass.id)
              }}
            >
              Reenviar invitación
            </DropdownMenuItem>
          )}
          {pass.status === 'ACTIVE' && (
            <>
              <DropdownMenuItem
                onClick={e => {
                  e.stopPropagation()
                  void updatePass(pass.id, { status: 'SUSPENDED' }, 'Pase suspendido.')
                }}
              >
                Suspender
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={e => {
                  e.stopPropagation()
                  void resendCredentialEmail(pass.id)
                }}
              >
                Reenviar QR
              </DropdownMenuItem>
            </>
          )}
          {pass.status === 'SUSPENDED' && (
            <DropdownMenuItem
              onClick={e => {
                e.stopPropagation()
                void updatePass(pass.id, { status: 'ACTIVE' }, 'Pase reactivado.')
              }}
            >
              Reactivar
            </DropdownMenuItem>
          )}
          {pass.status !== 'REVOKED' && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className='text-destructive focus:text-destructive'
                onClick={e => {
                  e.stopPropagation()
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
              </DropdownMenuItem>
            </>
          )}
          {canDelete && (
            <DropdownMenuItem
              className='text-destructive focus:text-destructive'
              onClick={e => {
                e.stopPropagation()
                setDeletePassIds([pass.id])
              }}
            >
              <Trash2 className='mr-2 h-4 w-4' />
              Eliminar
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    ),
    [busyPassId, canDelete, resendCredentialEmail, resendPrivacyInvitation, updatePass]
  )

  const renderPassCard = useCallback(
    (pass: AccessPass) => {
      const badge = effectivePassLabel(pass)
      return (
        <div className='rounded-lg border bg-card p-4 space-y-3'>
          <div className='flex items-start gap-3'>
            {canDelete && (
              <Checkbox
                checked={selectedPassIds.includes(pass.id)}
                onCheckedChange={checked => togglePassSelection(pass.id, checked === true)}
                aria-label='Seleccionar pase'
              />
            )}
            <div className='min-w-0 flex-1 space-y-2'>
              <div className='flex items-start justify-between gap-2'>
                <div className='min-w-0'>
                  <p className='font-medium truncate'>
                    {pass.subject.firstName} {pass.subject.lastName}
                  </p>
                  <p className='text-xs text-muted-foreground truncate'>
                    {formatAccessBelongsTo(pass.family.name, pass.subject.organization)}
                  </p>
                </div>
                <Badge variant={badge.variant} className='shrink-0'>
                  {badge.label}
                </Badge>
              </div>
              <div className='text-sm space-y-1 break-words'>
                <p>
                  <span className='text-muted-foreground'>Motivo: </span>
                  {formatAccessPurpose(pass.subject.purpose)}
                </p>
                <p>
                  <span className='text-muted-foreground'>Tipo: </span>
                  {accessTypeLabel(pass.subject.accessType)}
                </p>
                <p>
                  <span className='text-muted-foreground'>Credencial: </span>
                  {pass.credentialCode}
                </p>
                <p>
                  <span className='text-muted-foreground'>Vigente hasta: </span>
                  {formatAccessDateTime(pass.validUntil)}
                </p>
              </div>
            </div>
          </div>
          <div className='flex justify-end'>{renderPassActions(pass)}</div>
        </div>
      )
    },
    [canDelete, renderPassActions, selectedPassIds, togglePassSelection]
  )

  const photoUrl = result?.pass?.photoUrl || null
  const allPassColumns = useMemo<Column<AccessPass>[]>(
    () => [
      {
        key: 'subject',
        label: 'Persona',
        sortable: true,
        render: pass => (
          <p className='font-medium'>
            {pass.subject.firstName} {pass.subject.lastName}
          </p>
        ),
      },
      { key: 'family.name', label: 'Área', sortable: true, render: pass => pass.family.name },
      {
        key: 'subject.email',
        label: 'Correo',
        sortable: true,
        render: pass => pass.subject.email?.trim() || '—',
      },
      {
        key: 'subject.organization',
        label: 'Arrendatario',
        sortable: true,
        render: pass => pass.subject.organization?.trim() || '—',
      },
      {
        key: 'subject.purpose',
        label: 'Motivo',
        sortable: true,
        render: pass => (
          <p className='max-w-[220px] truncate' title={formatAccessPurpose(pass.subject.purpose)}>
            {formatAccessPurpose(pass.subject.purpose)}
          </p>
        ),
      },
      {
        key: 'subject.accessType',
        label: 'Tipo de acceso',
        sortable: true,
        render: pass => accessTypeLabel(pass.subject.accessType),
      },
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
        render: pass => formatAccessDateTime(pass.validUntil),
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
      'subject.email': { label: 'Correo', accessor: pass => pass.subject.email?.trim() || '—' },
      'subject.accessType': {
        label: 'Tipo de acceso',
        accessor: pass => accessTypeLabel(pass.subject.accessType),
      },
      'subject.organization': {
        label: 'Arrendatario',
        accessor: pass => pass.subject.organization?.trim() || '—',
      },
      'subject.purpose': {
        label: 'Motivo',
        accessor: pass => formatAccessPurpose(pass.subject.purpose),
      },
      credentialCode: { label: 'Credencial', accessor: pass => pass.credentialCode },
      status: { label: 'Estado', accessor: pass => effectivePassLabel(pass).label },
      validUntil: {
        label: 'Vigente hasta',
        accessor: pass => formatAccessDateTime(pass.validUntil),
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

  // ── Columnas del historial de escaneos ────────────────────────────────────
  const [scanColumnOrder, setScanColumnOrder] = useState([
    'scannedAt',
    'pass',
    'family',
    'result',
    'agent',
    'credentialCode',
    'pass.subject.accessType',
    'pass.subject.organization',
  ])
  const [scanVisibleColumns, setScanVisibleColumns] = useState([
    'scannedAt',
    'pass',
    'family',
    'result',
    'agent',
    'credentialCode',
    'pass.subject.accessType',
    'pass.subject.organization',
  ])
  const allScanColumns = useMemo<Column<ScanEvent>[]>(
    () => [
      {
        key: 'scannedAt',
        label: 'Fecha / hora',
        sortable: true,
        render: event => (
          <span className='whitespace-nowrap text-sm'>{formatAccessDateTime(event.scannedAt)}</span>
        ),
      },
      {
        key: 'pass',
        label: 'Persona',
        sortable: false,
        render: event =>
          event.pass ? (
            <p className='font-medium text-sm'>
              {event.pass.subject.firstName} {event.pass.subject.lastName}
            </p>
          ) : (
            <span className='text-muted-foreground text-sm'>—</span>
          ),
      },
      {
        key: 'family',
        label: 'Área',
        sortable: false,
        render: event =>
          event.family ? (
            <span className='text-sm'>{event.family.name}</span>
          ) : (
            <span className='text-muted-foreground text-sm'>—</span>
          ),
      },
      {
        key: 'result',
        label: 'Resultado',
        sortable: true,
        render: event => {
          const badge = scanResultLabel(event.result)
          return <Badge variant={badge.variant}>{badge.label}</Badge>
        },
      },
      {
        key: 'agent',
        label: 'Verificado por',
        sortable: false,
        render: event => <span className='text-sm text-muted-foreground'>{event.agent.name}</span>,
      },
      {
        key: 'credentialCode',
        label: 'Credencial',
        sortable: false,
        render: event =>
          event.pass ? (
            <span className='font-mono text-xs'>{event.pass.credentialCode}</span>
          ) : (
            <span className='text-muted-foreground text-sm'>—</span>
          ),
      },
      {
        key: 'pass.subject.accessType',
        label: 'Tipo de acceso',
        sortable: true,
        render: event =>
          event.pass ? (
            <span className='text-sm'>{accessTypeLabel(event.pass.subject.accessType)}</span>
          ) : (
            <span className='text-muted-foreground text-sm'>—</span>
          ),
      },
      {
        key: 'pass.subject.organization',
        label: 'Arrendatario / Empresa',
        sortable: true,
        render: event => (
          <span className='text-sm'>{event.pass?.subject.organization?.trim() || '—'}</span>
        ),
      },
    ],
    []
  )
  const scanEventColumns = useMemo(
    () =>
      scanColumnOrder
        .filter(key => scanVisibleColumns.includes(key))
        .map(key => allScanColumns.find(column => column.key === key))
        .filter((column): column is Column<ScanEvent> => Boolean(column)),
    [allScanColumns, scanColumnOrder, scanVisibleColumns]
  )

  const scanExportColumnByKey = useMemo<Record<string, ExportColumn>>(
    () => ({
      scannedAt: {
        label: 'Fecha / hora',
        accessor: (e: ScanEvent) => formatAccessDateTime(e.scannedAt),
      },
      pass: {
        label: 'Persona',
        accessor: (e: ScanEvent) =>
          e.pass ? `${e.pass.subject.firstName} ${e.pass.subject.lastName}` : '—',
      },
      family: { label: 'Área', accessor: (e: ScanEvent) => e.family?.name ?? '—' },
      result: {
        label: 'Resultado',
        accessor: (e: ScanEvent) => scanResultLabel(e.result).label,
      },
      agent: { label: 'Verificado por', accessor: (e: ScanEvent) => e.agent.name },
      credentialCode: {
        label: 'Credencial',
        accessor: (e: ScanEvent) => e.pass?.credentialCode ?? '—',
      },
      'pass.subject.accessType': {
        label: 'Tipo de acceso',
        accessor: (e: ScanEvent) => (e.pass ? accessTypeLabel(e.pass.subject.accessType) : '—'),
      },
      'pass.subject.organization': {
        label: 'Arrendatario / Empresa',
        accessor: (e: ScanEvent) => e.pass?.subject.organization?.trim() || '—',
      },
    }),
    []
  )
  const scanExportColumns = useMemo(
    () =>
      scanColumnOrder
        .filter(key => scanVisibleColumns.includes(key))
        .map(key => scanExportColumnByKey[key])
        .filter((column): column is ExportColumn => Boolean(column)),
    [scanColumnOrder, scanExportColumnByKey, scanVisibleColumns]
  )
  const {
    exportCSV: exportEventsCsv,
    exportExcel: exportEventsExcel,
    exportPDF: exportEventsPdf,
    exporting: exportingEvents,
  } = useExport({
    filename: 'historial-escaneos',
    title: 'Historial de escaneos',
    subtitle: 'Registro de verificaciones de acceso',
    columns: scanExportColumns,
    getData: () => scanEvents,
  })
  // ──────────────────────────────────────────────────────────────────────────

  return (
    <div className='grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]'>
      <section className='min-w-0 space-y-4'>
        <div className='rounded-xl border bg-card p-4'>
          <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
            <div className='min-w-0'>
              <h2 className='font-semibold flex items-center gap-2'>
                <ScanLine className='h-5 w-5 text-primary shrink-0' /> Verificar acceso
              </h2>
              <p className='text-sm text-muted-foreground mt-1'>
                El resultado se consulta en línea y deja trazabilidad del escaneo. Puedes escanear
                el QR o escribir el código de credencial (ACC-…).
              </p>
            </div>
            <Button className='w-full sm:w-auto shrink-0' onClick={startCamera} disabled={scanning}>
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
            className='mt-4 flex flex-col gap-2 sm:flex-row'
            onSubmit={event => {
              event.preventDefault()
              void verify(payload)
            }}
          >
            <Input
              className='min-w-0'
              value={payload}
              onChange={e => setPayload(e.target.value)}
              placeholder='QR, ACCESS:… o ACC-2026-XXXXXXXX'
            />
            <Button
              type='submit'
              variant='outline'
              disabled={scanning}
              className='shrink-0 sm:w-auto w-full'
            >
              <ClipboardPaste className='h-4 w-4 sm:mr-0 mr-2' />
              <span className='sm:hidden'>Verificar</span>
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
                    ? result.message || 'Acceso autorizado'
                    : result.message || result.error || 'Acceso no autorizado'}
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
                        {accessTypeLabel(result.pass.subject.accessType)}
                        {result.pass.subject.purpose?.trim()
                          ? ` · ${result.pass.subject.purpose.trim()}`
                          : ''}
                      </p>
                      <p className='text-muted-foreground'>
                        {formatAccessBelongsTo(
                          result.pass.family.name,
                          result.pass.subject.organization
                        )}
                      </p>
                      <p className='text-muted-foreground'>
                        Vigente hasta {formatAccessDateTime(result.pass.validUntil)}
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
            onFiltersChange={handleTableFiltersChange}
            onRefresh={() => void loadPasses()}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            cardRenderer={renderPassCard}
            pagination={{
              page: tablePage,
              limit: tableLimit,
              onPageChange: setTablePage,
              onLimitChange: limit => {
                setTableLimit(limit)
                setTablePage(1)
              },
            }}
            selectable={canDelete && viewMode === 'table'}
            selectedIds={selectedPassIds}
            onSelectedIdsChange={setSelectedPassIds}
            onExport={
              <ExportButton
                onExportCSV={exportCSV}
                onExportExcel={exportExcel}
                onExportPDF={exportPDF}
                loading={exporting}
              />
            }
            actions={
              <>
                {canDelete && selectedPassIds.length > 0 && (
                  <Button
                    size='sm'
                    variant='destructive'
                    disabled={busyPassId !== null}
                    onClick={() => setDeletePassIds(selectedPassIds)}
                  >
                    <Trash2 className='mr-2 h-4 w-4' />
                    Eliminar ({selectedPassIds.length})
                  </Button>
                )}
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
                  storageKey='table-columns:access-passes-v2'
                />
              </>
            }
            rowActions={renderPassActions}
            emptyState={{
              title: 'Sin pases',
              description: 'No hay pases que coincidan con los filtros actuales.',
            }}
          />
        )}

        {/* ── Historial de escaneos ── */}
        <DataTable
          title='Registro de accesos'
          description='Historial completo de verificaciones ordenado por más reciente.'
          data={scanEvents}
          columns={scanEventColumns}
          loading={scanEventsLoading}
          searchPlaceholder='Buscar por código, nombre, apellido o arrendatario...'
          filters={[
            {
              key: 'result',
              label: 'Resultado',
              type: 'select',
              options: [
                { value: 'VALID', label: 'Autorizado' },
                { value: 'EXPIRED', label: 'Vencido' },
                { value: 'NOT_YET_VALID', label: 'Aún no vigente' },
                { value: 'REVOKED', label: 'Revocado' },
                { value: 'SUSPENDED', label: 'Suspendido' },
                { value: 'PENDING_PRIVACY', label: 'Pend. privacidad' },
                { value: 'INACTIVE_SUBJECT', label: 'Inactivo' },
                { value: 'NOT_FOUND', label: 'No encontrado' },
                { value: 'OUT_OF_SCOPE', label: 'Fuera de alcance' },
              ],
            },
            ...(families.length > 0
              ? [
                  {
                    key: 'familyId',
                    label: 'Área',
                    type: 'select' as const,
                    options: families.map(f => ({ value: f.id, label: f.name })),
                  },
                ]
              : []),
            {
              key: 'accessType',
              label: 'Tipo de acceso',
              type: 'select' as const,
              options: [
                { value: 'TENANT_EMPLOYEE', label: accessTypeLabel('TENANT_EMPLOYEE') },
                { value: 'CONTRACTOR', label: accessTypeLabel('CONTRACTOR') },
                { value: 'AUTHORIZED_VISITOR', label: accessTypeLabel('AUTHORIZED_VISITOR') },
              ],
            },
            ...(organizations.length > 0
              ? [
                  {
                    key: 'organizationId',
                    label: 'Arrendatario / Empresa',
                    type: 'select' as const,
                    options: organizations.map(o => ({ value: o.id, label: o.name })),
                  },
                ]
              : []),
            { key: 'dateFrom', label: 'Desde', type: 'date' as const },
            { key: 'dateTo', label: 'Hasta', type: 'date' as const },
          ]}
          onFiltersChange={handleScanEventsFiltersChange}
          onRefresh={() => void loadScanEvents()}
          pagination={{
            page: scanEventsPage,
            limit: scanEventsLimit,
            total: scanEventsPagination.total,
            onPageChange: page => {
              setScanEventsPage(page)
              void loadScanEvents({ page })
            },
            onLimitChange: limit => {
              setScanEventsLimit(limit)
              setScanEventsPage(1)
              void loadScanEvents({ page: 1, limit })
            },
          }}
          onExport={
            <ExportButton
              onExportCSV={exportEventsCsv}
              onExportExcel={exportEventsExcel}
              onExportPDF={exportEventsPdf}
              loading={exportingEvents}
            />
          }
          actions={
            <TableColumnsMenu
              columns={allScanColumns.map(column => ({
                key: String(column.key),
                label: column.label,
                required: column.key === 'scannedAt',
              }))}
              order={scanColumnOrder}
              visible={scanVisibleColumns}
              onOrderChange={setScanColumnOrder}
              onVisibleChange={setScanVisibleColumns}
              storageKey='table-columns:access-scan-events-v1'
            />
          }
          emptyState={{
            icon: <History className='h-8 w-8 text-muted-foreground/40' />,
            title: 'Sin registros',
            description: 'No hay escaneos que coincidan con los filtros seleccionados.',
          }}
        />
      </section>

      {canManage && (
        <aside className='min-w-0 rounded-xl border bg-card p-4 h-fit xl:sticky xl:top-4'>
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
              <Label>
                Arrendatario / empresa
                {accessTypeRequiresOrganization(form.accessType) && (
                  <span className='text-destructive'> *</span>
                )}
              </Label>
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
                {accessTypeRequiresOrganization(form.accessType)
                  ? `Obligatorio para "${accessTypeLabel(form.accessType)}".`
                  : 'Opcional para visitante autorizado; útil si visita en representación de una empresa.'}{' '}
                Catálogo compartido: crea, edita o desactiva arrendatarios sin introducir texto
                libre.
              </p>
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

      <Dialog open={Boolean(editingPass)} onOpenChange={open => !open && setEditingPass(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar vigencia del pase</DialogTitle>
            <DialogDescription>
              {editingPass && (
                <>
                  {editingPass.subject.firstName} {editingPass.subject.lastName} ·{' '}
                  {editingPass.credentialCode}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-3 py-2'>
            <div className='space-y-1.5'>
              <Label>Inicio</Label>
              <DateTimePicker value={editValidFrom} onChange={setEditValidFrom} />
            </div>
            <div className='space-y-1.5'>
              <Label>Fin</Label>
              <DateTimePicker
                value={editValidUntil}
                onChange={setEditValidUntil}
                minDate={editValidFrom ? parseScheduledDateTime(editValidFrom) : undefined}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setEditingPass(null)}>
              Cancelar
            </Button>
            <Button disabled={busyPassId !== null} onClick={() => void saveEditPass()}>
              {busyPassId !== null ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deletePassIds?.length)}
        onOpenChange={open => {
          if (!open && busyPassId === null) setDeletePassIds(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deletePassIds?.length === 1
                ? '¿Eliminar este pase de forma permanente?'
                : `¿Eliminar ${deletePassIds?.length || 0} pases de forma permanente?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se borra el pase, el QR deja de servir y, si la
              persona no tiene otros pases, también se elimina su registro. Los eventos de escaneo
              se conservan sin el código.
              {deletePassIds && deletePassIds.length > 0 && (
                <span className='mt-2 block font-medium text-foreground'>
                  {passes
                    .filter(pass => deletePassIds.includes(pass.id))
                    .map(
                      pass =>
                        `${pass.subject.firstName} ${pass.subject.lastName} (${pass.credentialCode})`
                    )
                    .join(', ')}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busyPassId !== null}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
              disabled={busyPassId !== null}
              onClick={event => {
                event.preventDefault()
                void confirmDeletePasses()
              }}
            >
              {busyPassId !== null ? 'Eliminando...' : 'Eliminar definitivamente'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
