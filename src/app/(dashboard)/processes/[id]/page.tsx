'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { useSession } from 'next-auth/react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Download, FileText, GitBranch, History, Trash2 } from 'lucide-react'
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { ProcessDiagramCanvas } from '@/components/processes/process-diagram-canvas'
import {
  processDiagramDefinitionSchema,
  type ProcessDiagramDefinition,
} from '@/lib/processes/diagram-definition'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  ProcessDiagramEditor,
  diagramsFromProcess,
  type EditableProcessDiagram,
} from '@/components/processes/process-diagram-editor'
import {
  emptyProcessProfile,
  ProcessProfileEditor,
  ProcessProfileView,
  profileFromContent,
  profileToContent,
  type ProcessProfile,
} from '@/components/processes/process-profile-editor'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type Diagram = {
  id: string
  name: string
  type: 'SWIMLANE' | 'SEQUENCE'
  definition: unknown
}

type ProcessDetail = {
  id: string
  code: string
  title: string
  objective: string | null
  scope: string | null
  status: string
  criticality: string
  level?: number
  reviewEveryMonths?: number
  publishedAt: string | null
  nextReviewAt: string | null
  family: { id: string; name: string }
  department: { name: string } | null
  owner: { id: string; name: string; email: string }
  parentProcess?: { id: string; code: string; title: string; level: number } | null
  childProcesses?: Array<{ id: string; code: string; title: string; level: number }>
  versions: Array<{
    id: string
    versionNumber: number
    changeSummary: string | null
    createdAt: string
    content?: unknown
    diagrams: Diagram[]
    externalReviews?: Array<{
      id: string
      provider: string
      status: string
      notes: string | null
      createdAt: string
    }>
  }>
  attachments: Array<{
    id: string
    originalName: string
    mimeType: string
    size: number
    url?: string
  }>
  approvalEvents: Array<{
    id: string
    fromStatus: string | null
    toStatus: string
    notes: string | null
    createdAt: string
    actor: { name: string }
  }>
}

const statusLabels: Record<string, string> = {
  DRAFT: 'Borrador',
  PENDING_AREA_REVIEW: 'Revisión de área',
  PENDING_EXTERNAL_DPD: 'Revisión externa',
  PUBLISHED: 'Publicado',
  REJECTED: 'Rechazado',
  OBSOLETE: 'Obsoleto',
}

const nextActions: Record<string, Array<{ status: string; label: string }>> = {
  DRAFT: [{ status: 'PENDING_AREA_REVIEW', label: 'Enviar a revisión de área' }],
  PENDING_AREA_REVIEW: [
    { status: 'PENDING_EXTERNAL_DPD', label: 'Enviar a DPD externo' },
    { status: 'PUBLISHED', label: 'Publicar' },
    { status: 'REJECTED', label: 'Rechazar' },
  ],
  PENDING_EXTERNAL_DPD: [
    { status: 'PUBLISHED', label: 'Publicar (con evidencia DPD)' },
    { status: 'REJECTED', label: 'Rechazar' },
  ],
  PUBLISHED: [
    { status: 'DRAFT', label: 'Volver a borrador' },
    { status: 'OBSOLETE', label: 'Marcar obsoleto' },
  ],
  REJECTED: [{ status: 'DRAFT', label: 'Reabrir como borrador' }],
  OBSOLETE: [],
}

export default function ProcessDetailPage() {
  const { data: session } = useSession()
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [process, setProcess] = useState<ProcessDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [transitioning, setTransitioning] = useState(false)
  const [reviewNotes, setReviewNotes] = useState('')
  const [reviewEvidenceRef, setReviewEvidenceRef] = useState('')
  const [reviewAttachmentId, setReviewAttachmentId] = useState<string>('')
  const [reviewEvidenceFile, setReviewEvidenceFile] = useState<File | null>(null)
  const [savingReview, setSavingReview] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  const [savingVersion, setSavingVersion] = useState(false)
  const [owners, setOwners] = useState<Array<{ id: string; name: string; email: string }>>([])
  const [versionForm, setVersionForm] = useState({
    title: '',
    objective: '',
    scope: '',
    criticality: 'MEDIUM',
    reviewEveryMonths: 12,
    ownerId: '',
    changeSummary: '',
  })
  const [editableDiagrams, setEditableDiagrams] = useState<EditableProcessDiagram[]>([])
  const [processProfile, setProcessProfile] = useState<ProcessProfile>(emptyProcessProfile)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const canManage =
    (session?.user as any)?.canManageProcesses === true ||
    (session?.user as any)?.isSuperAdmin === true

  const loadProcess = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch(`/api/processes/${params.id}`)
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error || 'No fue posible cargar el proceso.')
      }
      const data = await response.json()
      setProcess(data.process)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Error al cargar el proceso.')
    } finally {
      setLoading(false)
    }
  }, [params.id])

  useEffect(() => {
    if (params.id) void loadProcess()
  }, [loadProcess, params.id])

  useEffect(() => {
    if (!process?.family.id || !canManage) return
    void fetch(`/api/processes/owners?familyId=${encodeURIComponent(process.family.id)}`)
      .then(response => (response.ok ? response.json() : { owners: [] }))
      .then(data => setOwners(data.owners || []))
      .catch(() => setOwners([]))
  }, [canManage, process?.family.id])

  const diagrams = useMemo(() => {
    if (!process) return [] as Array<Diagram & { parsed: ProcessDiagramDefinition }>
    return process.versions.flatMap(version =>
      version.diagrams.flatMap(diagram => {
        const parsed = processDiagramDefinitionSchema.safeParse(diagram.definition)
        return parsed.success ? [{ ...diagram, parsed: parsed.data }] : []
      })
    )
  }, [process])

  const publishedProfile = useMemo(
    () => profileFromContent(process?.versions[0]?.content),
    [process?.versions]
  )

  const handleAttachmentUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      setUploading(true)
      const data = new FormData()
      data.append('file', file)
      const response = await fetch(`/api/processes/${params.id}/attachments`, {
        method: 'POST',
        body: data,
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || 'No fue posible subir el archivo.')
      await loadProcess()
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Error al subir el archivo.')
    } finally {
      setUploading(false)
      event.target.value = ''
    }
  }

  const handleDeleteAttachment = async (attachmentId: string) => {
    try {
      const response = await fetch(`/api/processes/${params.id}/attachments/${attachmentId}`, {
        method: 'DELETE',
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || 'No fue posible eliminar el adjunto.')
      await loadProcess()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Error al eliminar el adjunto.')
    }
  }

  const handleTransition = async (status: string) => {
    try {
      setTransitioning(true)
      setError(null)
      const response = await fetch(`/api/processes/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || 'No fue posible cambiar el estado.')
      await loadProcess()
    } catch (transitionError) {
      setError(
        transitionError instanceof Error ? transitionError.message : 'Error al cambiar el estado.'
      )
    } finally {
      setTransitioning(false)
    }
  }

  const handleRecordExternalReview = async (status: 'SENT' | 'REVIEWED' | 'OBSERVED') => {
    try {
      setSavingReview(true)
      setError(null)
      let response: Response
      if (reviewEvidenceFile) {
        const data = new FormData()
        data.append('status', status)
        data.append('provider', 'Privacy Driver')
        if (reviewNotes) data.append('notes', reviewNotes)
        if (reviewEvidenceRef) data.append('evidenceReference', reviewEvidenceRef)
        if (reviewAttachmentId) data.append('evidenceAttachmentId', reviewAttachmentId)
        data.append('file', reviewEvidenceFile)
        response = await fetch(`/api/processes/${params.id}/external-reviews`, {
          method: 'POST',
          body: data,
        })
      } else {
        response = await fetch(`/api/processes/${params.id}/external-reviews`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status,
            notes: reviewNotes || null,
            provider: 'Privacy Driver',
            evidenceReference: reviewEvidenceRef || null,
            evidenceAttachmentId: reviewAttachmentId || null,
          }),
        })
      }
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || 'No fue posible registrar la revisión.')
      setReviewNotes('')
      setReviewEvidenceRef('')
      setReviewAttachmentId('')
      setReviewEvidenceFile(null)
      await loadProcess()
    } catch (reviewError) {
      setError(
        reviewError instanceof Error ? reviewError.message : 'Error al registrar la revisión.'
      )
    } finally {
      setSavingReview(false)
    }
  }

  const openVersionEditor = () => {
    if (!process) return
    const currentVersion = process.versions[0]
    setVersionForm({
      title: process.title,
      objective: process.objective || '',
      scope: process.scope || '',
      criticality: process.criticality || 'MEDIUM',
      reviewEveryMonths: process.reviewEveryMonths || 12,
      ownerId: process.owner.id,
      changeSummary: '',
    })
    setEditableDiagrams(diagramsFromProcess(currentVersion?.diagrams || []))
    setProcessProfile(profileFromContent(currentVersion?.content))
    setEditorOpen(true)
  }

  const handleSaveVersion = async (event: React.FormEvent) => {
    event.preventDefault()
    try {
      setSavingVersion(true)
      setError(null)

      const response = await fetch(`/api/processes/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: versionForm.title,
          objective: versionForm.objective || null,
          scope: versionForm.scope || null,
          criticality: versionForm.criticality,
          reviewEveryMonths: Number(versionForm.reviewEveryMonths) || 12,
          ownerId: versionForm.ownerId,
          content: profileToContent(processProfile),
          diagrams: editableDiagrams,
          changeSummary: versionForm.changeSummary || 'Actualización del procedimiento',
        }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || 'No fue posible guardar la versión.')
      setEditorOpen(false)
      await loadProcess()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Error al guardar la versión.')
    } finally {
      setSavingVersion(false)
    }
  }

  return (
    <ModuleLayout
      title={process?.title || 'Proceso'}
      subtitle={process ? `${process.code} · ${process.family.name}` : 'Cargando procedimiento'}
      loading={loading}
      error={error}
      onRetry={loadProcess}
      headerActions={
        <Button variant='outline' size='sm' onClick={() => router.push('/processes')}>
          <ArrowLeft className='mr-2 h-4 w-4' />
          Volver
        </Button>
      }
    >
      {!process ? null : (
        <div className='space-y-5'>
          <Card>
            <CardHeader className='pb-3'>
              <div className='flex flex-wrap items-center justify-between gap-2'>
                <CardTitle className='font-mono text-sm'>{process.code}</CardTitle>
                <Badge variant={process.status === 'PUBLISHED' ? 'default' : 'secondary'}>
                  {statusLabels[process.status] || process.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className='grid gap-4 text-sm md:grid-cols-2'>
              <div>
                <p className='font-medium'>Objetivo</p>
                <p className='mt-1 text-muted-foreground'>{process.objective || 'Sin definir'}</p>
              </div>
              <div>
                <p className='font-medium'>Alcance</p>
                <p className='mt-1 text-muted-foreground'>{process.scope || 'Sin definir'}</p>
              </div>
              <p>
                <span className='font-medium'>Nivel: </span>N{process.level ?? 1}
                {process.parentProcess ? (
                  <>
                    {' · depende de '}
                    <button
                      type='button'
                      className='text-primary hover:underline'
                      onClick={() => router.push(`/processes/${process.parentProcess!.id}`)}
                    >
                      {process.parentProcess.code}
                    </button>
                  </>
                ) : null}
              </p>
              <p>
                <span className='font-medium'>Criticidad: </span>
                {process.criticality}
              </p>
              <p>
                <span className='font-medium'>Responsable: </span>
                {process.owner.name}
              </p>
              <p>
                <span className='font-medium'>Departamento: </span>
                {process.department?.name || 'No especificado'}
              </p>
              {process.nextReviewAt && (
                <p>
                  <span className='font-medium'>Próxima revisión: </span>
                  {new Date(process.nextReviewAt).toLocaleDateString('es-EC')}
                </p>
              )}
              {process.childProcesses && process.childProcesses.length > 0 && (
                <div className='md:col-span-2'>
                  <p className='font-medium'>Subprocesos</p>
                  <ul className='mt-1 space-y-1 text-muted-foreground'>
                    {process.childProcesses.map(child => (
                      <li key={child.id}>
                        <button
                          type='button'
                          className='text-left text-primary hover:underline'
                          onClick={() => router.push(`/processes/${child.id}`)}
                        >
                          {child.code} · {child.title}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {canManage && (
                <div className='md:col-span-2 flex flex-wrap gap-2'>
                  <Button size='sm' variant='outline' onClick={openVersionEditor}>
                    Editar y crear versión
                  </Button>
                  {(nextActions[process.status] || []).map(action => (
                    <Button
                      key={action.status}
                      size='sm'
                      variant={action.status === 'PUBLISHED' ? 'default' : 'outline'}
                      disabled={transitioning}
                      onClick={() => void handleTransition(action.status)}
                    >
                      {action.label}
                    </Button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <section className='space-y-3'>
            <div className='flex items-center gap-2'>
              <FileText className='h-4 w-4 text-primary' />
              <h2 className='font-semibold'>Ficha FR-MC-01</h2>
            </div>
            <ProcessProfileView value={publishedProfile} />
          </section>

          <section className='space-y-3'>
            <div className='flex items-center gap-2'>
              <GitBranch className='h-4 w-4 text-primary' />
              <h2 className='font-semibold'>Diagramas del proceso</h2>
            </div>
            {diagrams.length ? (
              diagrams.map(diagram => (
                <ProcessDiagramCanvas
                  key={diagram.id}
                  title={`${diagram.name} · ${diagram.type === 'SWIMLANE' ? 'Flujo por carriles' : 'Secuencia'}`}
                  definition={diagram.parsed}
                  type={diagram.type}
                />
              ))
            ) : (
              <Card>
                <CardContent className='flex items-center gap-3 py-6 text-sm text-muted-foreground'>
                  <GitBranch className='h-5 w-5' />
                  Este procedimiento aún no tiene un diagrama estructurado.
                </CardContent>
              </Card>
            )}
          </section>

          <div className='grid gap-5 lg:grid-cols-2'>
            <Card>
              <CardHeader className='pb-3'>
                <CardTitle className='flex items-center gap-2 text-base'>
                  <History className='h-4 w-4' />
                  Historial
                </CardTitle>
              </CardHeader>
              <CardContent className='space-y-3'>
                {process.approvalEvents.map(event => (
                  <div key={event.id} className='border-l-2 border-primary/30 pl-3 text-sm'>
                    <p className='font-medium'>{statusLabels[event.toStatus] || event.toStatus}</p>
                    <p className='text-xs text-muted-foreground'>
                      {event.actor.name} · {new Date(event.createdAt).toLocaleString('es-EC')}
                    </p>
                    {event.notes && <p className='mt-1 text-muted-foreground'>{event.notes}</p>}
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className='pb-3'>
                <CardTitle className='flex items-center gap-2 text-base'>
                  <FileText className='h-4 w-4' />
                  Adjuntos
                </CardTitle>
              </CardHeader>
              <CardContent className='space-y-2 text-sm'>
                {canManage && (
                  <>
                    <input
                      ref={fileInputRef}
                      className='hidden'
                      type='file'
                      onChange={handleAttachmentUpload}
                    />
                    <Button
                      size='sm'
                      variant='outline'
                      disabled={uploading}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {uploading ? 'Subiendo...' : 'Adjuntar evidencia'}
                    </Button>
                  </>
                )}
                {process.attachments.length ? (
                  process.attachments.map(attachment => (
                    <div
                      key={attachment.id}
                      className='flex items-center justify-between gap-2 rounded-md border px-2 py-1.5'
                    >
                      <a
                        className='truncate text-primary hover:underline'
                        href={
                          attachment.url ||
                          `/api/processes/${process.id}/attachments/${attachment.id}/file?download=true`
                        }
                      >
                        <Download className='mr-1 inline h-3.5 w-3.5' />
                        {attachment.originalName}
                      </a>
                      {canManage && (
                        <Button
                          size='icon'
                          variant='ghost'
                          className='h-7 w-7'
                          onClick={() => void handleDeleteAttachment(attachment.id)}
                        >
                          <Trash2 className='h-3.5 w-3.5' />
                        </Button>
                      )}
                    </div>
                  ))
                ) : (
                  <p className='text-muted-foreground'>Sin evidencia adjunta.</p>
                )}
              </CardContent>
            </Card>
          </div>

          {canManage && (
            <Card>
              <CardHeader className='pb-3'>
                <CardTitle className='text-base'>Evidencia de revisión externa (DPD)</CardTitle>
              </CardHeader>
              <CardContent className='space-y-3'>
                <Textarea
                  value={reviewNotes}
                  onChange={event => setReviewNotes(event.target.value)}
                  placeholder='Notas del resultado de Privacy Driver'
                  rows={3}
                />
                <Input
                  value={reviewEvidenceRef}
                  onChange={event => setReviewEvidenceRef(event.target.value)}
                  placeholder='Referencia externa (ticket Privacy Driver, URL, código…)'
                />
                <div className='grid gap-2 sm:grid-cols-2'>
                  <div className='space-y-1'>
                    <Label>Adjunto existente</Label>
                    <Select
                      value={reviewAttachmentId || 'none'}
                      onValueChange={value => setReviewAttachmentId(value === 'none' ? '' : value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder='Sin adjunto' />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='none'>Sin adjunto</SelectItem>
                        {process.attachments.map(attachment => (
                          <SelectItem key={attachment.id} value={attachment.id}>
                            {attachment.originalName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className='space-y-1'>
                    <Label>Subir evidencia</Label>
                    <Input
                      type='file'
                      onChange={event => setReviewEvidenceFile(event.target.files?.[0] || null)}
                    />
                  </div>
                </div>
                <p className='text-xs text-muted-foreground'>
                  REVIEWED/OBSERVED exige archivo, adjunto del proceso o referencia externa.
                </p>
                <div className='flex flex-wrap gap-2'>
                  <Button
                    size='sm'
                    variant='outline'
                    disabled={savingReview}
                    onClick={() => void handleRecordExternalReview('SENT')}
                  >
                    Marcar enviado
                  </Button>
                  <Button
                    size='sm'
                    disabled={savingReview}
                    onClick={() => void handleRecordExternalReview('REVIEWED')}
                  >
                    Registrar REVIEWED
                  </Button>
                  <Button
                    size='sm'
                    variant='secondary'
                    disabled={savingReview}
                    onClick={() => void handleRecordExternalReview('OBSERVED')}
                  >
                    Registrar observaciones
                  </Button>
                </div>
                <div className='space-y-2 text-sm'>
                  {(process.versions[0]?.externalReviews || []).length ? (
                    process.versions[0].externalReviews!.map(review => (
                      <p key={review.id} className='text-muted-foreground'>
                        {review.provider} · {review.status}
                        {review.notes ? ` · ${review.notes}` : ''}
                      </p>
                    ))
                  ) : (
                    <p className='text-muted-foreground'>
                      Sin evidencias DPD en la versión actual. Requeridas para publicar desde
                      revisión externa.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className='max-h-[90vh] overflow-y-auto sm:max-w-4xl'>
          <DialogHeader>
            <DialogTitle>Editar procedimiento y crear versión</DialogTitle>
            <DialogDescription>
              Actualiza metadatos y diagramas. Si el procedimiento estaba publicado o en revisión,
              al crear una versión vuelve a borrador y requiere reaprobación antes de publicarse
              otra vez.
            </DialogDescription>
          </DialogHeader>
          <form className='space-y-4' onSubmit={handleSaveVersion}>
            <div className='grid gap-3 sm:grid-cols-2'>
              <div className='space-y-2'>
                <Label htmlFor='process-title'>Título</Label>
                <Input
                  id='process-title'
                  required
                  value={versionForm.title}
                  onChange={event =>
                    setVersionForm(current => ({ ...current, title: event.target.value }))
                  }
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='process-change-summary'>Resumen del cambio</Label>
                <Input
                  id='process-change-summary'
                  value={versionForm.changeSummary}
                  onChange={event =>
                    setVersionForm(current => ({ ...current, changeSummary: event.target.value }))
                  }
                  placeholder='Ej. Actualización de responsables'
                />
              </div>
            </div>
            <div className='grid gap-3 sm:grid-cols-2'>
              <div className='space-y-2'>
                <Label>Criticidad</Label>
                <Select
                  value={versionForm.criticality}
                  onValueChange={value =>
                    setVersionForm(current => ({ ...current, criticality: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='LOW'>Baja</SelectItem>
                    <SelectItem value='MEDIUM'>Media</SelectItem>
                    <SelectItem value='HIGH'>Alta</SelectItem>
                    <SelectItem value='CRITICAL'>Crítica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className='space-y-2'>
                <Label htmlFor='process-review-months'>Revisión cada (meses)</Label>
                <Input
                  id='process-review-months'
                  type='number'
                  min={1}
                  max={60}
                  value={versionForm.reviewEveryMonths}
                  onChange={event =>
                    setVersionForm(current => ({
                      ...current,
                      reviewEveryMonths: Number(event.target.value) || 12,
                    }))
                  }
                />
              </div>
            </div>
            <div className='space-y-2'>
              <Label>Responsable</Label>
              <Select
                value={versionForm.ownerId}
                onValueChange={value => setVersionForm(current => ({ ...current, ownerId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder='Selecciona un responsable' />
                </SelectTrigger>
                <SelectContent>
                  {owners.map(owner => (
                    <SelectItem key={owner.id} value={owner.id}>
                      {owner.name} · {owner.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!owners.length && (
                <p className='text-xs text-muted-foreground'>
                  No hay otros responsables disponibles para esta área.
                </p>
              )}
            </div>
            <div className='space-y-2'>
              <Label htmlFor='process-objective'>Objetivo</Label>
              <Textarea
                id='process-objective'
                value={versionForm.objective}
                onChange={event =>
                  setVersionForm(current => ({ ...current, objective: event.target.value }))
                }
                rows={3}
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='process-scope'>Alcance</Label>
              <Textarea
                id='process-scope'
                value={versionForm.scope}
                onChange={event =>
                  setVersionForm(current => ({ ...current, scope: event.target.value }))
                }
                rows={3}
              />
            </div>
            <ProcessProfileEditor value={processProfile} onChange={setProcessProfile} />
            <ProcessDiagramEditor value={editableDiagrams} onChange={setEditableDiagrams} />
            <DialogFooter>
              <Button type='button' variant='outline' onClick={() => setEditorOpen(false)}>
                Cancelar
              </Button>
              <Button type='submit' disabled={savingVersion}>
                {savingVersion ? 'Guardando...' : 'Crear versión'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </ModuleLayout>
  )
}
