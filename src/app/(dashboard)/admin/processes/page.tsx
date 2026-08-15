'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { GitBranch, Plus, RefreshCw } from 'lucide-react'
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { ExportButton } from '@/components/common/export-button'
import { FormDraftBanner } from '@/components/common/form-draft-banner'
import { useExport } from '@/hooks/common/use-export'
import { FormDraftKeys, useFormDraft } from '@/hooks/common/use-form-draft'
import type { ExportColumn } from '@/lib/utils/export'

type ProcessItem = {
  id: string
  code: string
  title: string
  status: string
  criticality: string
  level: number
  parentProcess: { id: string; code: string; title: string; level: number } | null
  updatedAt: string
  family: { id: string; name: string; color: string | null }
  department: { id: string; name: string } | null
  owner: { id: string; name: string }
  versions: { versionNumber: number }[]
  _count: { attachments: number }
}

type FamilyOption = { id: string; name: string }
type DepartmentOption = { id: string; name: string; familyId?: string | null }

const statusLabels: Record<string, string> = {
  DRAFT: 'Borrador',
  PENDING_AREA_REVIEW: 'Revisión de área',
  PENDING_EXTERNAL_DPD: 'Revisión externa',
  PUBLISHED: 'Publicado',
  REJECTED: 'Rechazado',
  OBSOLETE: 'Obsoleto',
}

const criticalityLabels: Record<string, string> = {
  LOW: 'Baja',
  MEDIUM: 'Media',
  HIGH: 'Alta',
  CRITICAL: 'Crítica',
}

const EMPTY_FORM = {
  code: '',
  title: '',
  objective: '',
  scope: '',
  level: 1,
  parentProcessId: '',
  familyId: '',
  departmentId: '',
  ownerId: '',
  criticality: 'MEDIUM',
  reviewEveryMonths: 12,
}

const processExportColumns: ExportColumn[] = [
  { key: 'code', label: 'Código' },
  { key: 'title', label: 'Proceso / procedimiento' },
  { key: 'level', label: 'Nivel', format: value => `N${value}` },
  { key: 'status', label: 'Estado', format: value => statusLabels[value] || String(value) },
  {
    key: 'criticality',
    label: 'Criticidad',
    format: value => criticalityLabels[value] || String(value),
  },
  { label: 'Área', accessor: item => item.family.name },
  { label: 'Departamento', accessor: item => item.department?.name || 'No especificado' },
  { label: 'Responsable', accessor: item => item.owner.name },
  { label: 'Proceso padre', accessor: item => item.parentProcess?.code || '—' },
  {
    key: 'updatedAt',
    label: 'Actualizado',
    format: value => new Date(String(value)).toLocaleDateString('es-EC'),
  },
]

export default function AdminProcessesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const [processes, setProcesses] = useState<ProcessItem[]>([])
  const [families, setFamilies] = useState<FamilyOption[]>([])
  const [departments, setDepartments] = useState<DepartmentOption[]>([])
  const [defaultReviewMonths, setDefaultReviewMonths] = useState(12)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [tableFilters, setTableFilters] = useState<Record<string, string>>({})

  const loadProcesses = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/processes')
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error || 'No fue posible cargar los procesos.')
      }
      const data = await response.json()
      setProcesses(data.processes || [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Error al cargar los procesos.')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadLookups = useCallback(async () => {
    try {
      const [familiesRes, departmentsRes, settingsRes] = await Promise.all([
        fetch('/api/families?includeInactive=false&module=processes&scope=all'),
        fetch('/api/departments'),
        fetch('/api/admin/processes/settings'),
      ])
      if (familiesRes.ok) {
        const data = await familiesRes.json()
        setFamilies((data.data || []).map((f: any) => ({ id: f.id, name: f.name })))
      }
      if (departmentsRes.ok) {
        const data = await departmentsRes.json()
        setDepartments(
          (data.departments || data.data || []).map((d: any) => ({
            id: d.id,
            name: d.name,
            familyId: d.familyId ?? d.family?.id ?? null,
          }))
        )
      }
      if (settingsRes.ok) {
        const data = await settingsRes.json()
        const months = Number(data.settings?.defaultReviewMonths) || 12
        setDefaultReviewMonths(months)
      }
    } catch {
      // Lookups opcionales: el formulario puede reintentar.
    }
  }, [])

  const openCreateDialog = () => {
    setForm({
      ...EMPTY_FORM,
      ownerId: session?.user?.id || '',
      reviewEveryMonths: defaultReviewMonths,
    })
    setCreateOpen(true)
  }

  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      router.push('/login')
      return
    }
    void loadProcesses()
    void loadLookups()
  }, [loadLookups, loadProcesses, router, session, status])

  const filteredDepartments = useMemo(
    () => (form.familyId ? departments.filter(d => d.familyId === form.familyId) : []),
    [departments, form.familyId]
  )

  const filteredProcesses = useMemo(() => {
    const search = tableFilters.search?.trim().toLocaleLowerCase() || ''
    return processes.filter(process => {
      const matchesSearch =
        !search ||
        [
          process.code,
          process.title,
          process.family.name,
          process.department?.name,
          process.owner.name,
        ]
          .filter(Boolean)
          .some(value => value!.toLocaleLowerCase().includes(search))
      return (
        matchesSearch &&
        (!tableFilters.status || process.status === tableFilters.status) &&
        (!tableFilters.criticality || process.criticality === tableFilters.criticality) &&
        (!tableFilters.familyId || process.family.id === tableFilters.familyId) &&
        (!tableFilters.level || String(process.level) === tableFilters.level)
      )
    })
  }, [processes, tableFilters])

  const draftSnapshot = useMemo(() => {
    const hasUserInput = Boolean(
      form.code || form.title || form.objective || form.scope || form.familyId || form.departmentId
    )
    return {
      ...form,
      level: hasUserInput ? form.level : null,
      reviewEveryMonths: hasUserInput ? form.reviewEveryMonths : null,
    }
  }, [form])

  const { clearDraft, wasRestored, dismissRestoredBanner } = useFormDraft({
    key: FormDraftKeys.processNew(),
    values: draftSnapshot,
    enabled: createOpen,
    onRestore: draft => {
      setForm({
        ...EMPTY_FORM,
        ...draft,
        level: draft.level ?? EMPTY_FORM.level,
        reviewEveryMonths: draft.reviewEveryMonths ?? defaultReviewMonths,
        ownerId: draft.ownerId || session?.user?.id || '',
      })
    },
  })

  const { exportCSV, exportExcel, exportPDF, exporting } = useExport({
    filename: 'procesos-y-procedimientos',
    title: 'Gestión de Procesos y Procedimientos',
    subtitle: `Exportado el ${new Date().toLocaleDateString('es-EC')} · ${filteredProcesses.length} registros`,
    columns: processExportColumns,
    getData: () => filteredProcesses,
  })

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!form.code.trim() || !form.title.trim() || !form.familyId) {
      toast({
        title: 'Datos incompletos',
        description: 'Código, título y área son obligatorios.',
        variant: 'destructive',
      })
      return
    }
    try {
      setSaving(true)
      const response = await fetch('/api/processes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          departmentId: form.departmentId || null,
          parentProcessId: form.parentProcessId || null,
          ownerId: form.ownerId || session?.user?.id,
          objective: form.objective || null,
          scope: form.scope || null,
          reviewEveryMonths: Number(form.reviewEveryMonths) || 12,
          diagrams: [],
        }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || 'No se pudo crear el proceso.')
      toast({ title: 'Proceso creado' })
      clearDraft()
      setCreateOpen(false)
      setForm({
        ...EMPTY_FORM,
        ownerId: session?.user?.id || '',
        reviewEveryMonths: defaultReviewMonths,
      })
      await loadProcesses()
    } catch (createError) {
      toast({
        title: 'Error',
        description: createError instanceof Error ? createError.message : 'Error al crear',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const columns: Column<ProcessItem>[] = [
    {
      key: 'code',
      label: 'Código',
      sortable: true,
      render: item => <span className='font-mono text-xs text-muted-foreground'>{item.code}</span>,
    },
    {
      key: 'title',
      label: 'Proceso',
      sortable: true,
      render: item => (
        <div className='min-w-0'>
          <p className='font-medium truncate'>{item.title}</p>
          <p className='text-xs text-muted-foreground'>
            {item.family.name}
            {item.department ? ` · ${item.department.name}` : ''}
            {item.parentProcess ? ` · depende de ${item.parentProcess.code}` : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'level',
      label: 'Nivel',
      sortable: true,
      render: item => <span className='text-sm'>N{item.level}</span>,
    },
    {
      key: 'status',
      label: 'Estado',
      sortable: true,
      render: item => (
        <Badge variant={item.status === 'PUBLISHED' ? 'default' : 'secondary'}>
          {statusLabels[item.status] || item.status}
        </Badge>
      ),
    },
    {
      key: 'owner',
      label: 'Responsable',
      render: item => <span className='text-sm'>{item.owner.name}</span>,
    },
    {
      key: 'versions',
      label: 'Versión',
      render: item => <span className='text-sm'>v{item.versions[0]?.versionNumber ?? 1}</span>,
    },
  ]

  return (
    <ModuleLayout
      title='Gestión de procesos'
      subtitle='Crea, versiona y gobierna procedimientos internos por área.'
      loading={loading && processes.length === 0}
      error={error}
      onRetry={loadProcesses}
      headerActions={
        <div className='flex gap-2'>
          <Button size='sm' variant='outline' onClick={loadProcesses} disabled={loading}>
            <RefreshCw className='mr-2 h-4 w-4' />
            Actualizar
          </Button>
          <Button size='sm' onClick={openCreateDialog}>
            <Plus className='mr-2 h-4 w-4' />
            Nuevo proceso
          </Button>
        </div>
      }
    >
      <DataTable
        title={`${filteredProcesses.length} proceso${filteredProcesses.length === 1 ? '' : 's'}`}
        description='Incluye borradores, revisiones y publicados de tu alcance. Los filtros aplican también a la exportación.'
        data={filteredProcesses}
        columns={columns}
        loading={loading}
        onRefresh={loadProcesses}
        filters={[
          {
            key: 'status',
            label: 'Estado',
            type: 'select',
            options: Object.entries(statusLabels).map(([value, label]) => ({ value, label })),
          },
          {
            key: 'criticality',
            label: 'Criticidad',
            type: 'select',
            options: [
              ...Object.entries(criticalityLabels).map(([value, label]) => ({ value, label })),
            ],
          },
          {
            key: 'familyId',
            label: 'Área',
            type: 'select',
            options: families.map(family => ({ value: family.id, label: family.name })),
          },
          {
            key: 'level',
            label: 'Nivel',
            type: 'select',
            options: [
              { value: '0', label: 'N0 · Macroproceso' },
              { value: '1', label: 'N1 · Proceso' },
              { value: '2', label: 'N2 · Subproceso' },
            ],
          },
        ]}
        onFiltersChange={setTableFilters}
        onExport={
          <ExportButton
            onExportCSV={exportCSV}
            onExportExcel={exportExcel}
            onExportPDF={exportPDF}
            loading={exporting}
          />
        }
        onRowClick={item => router.push(`/processes/${item.id}`)}
        emptyState={{
          icon: <GitBranch className='mx-auto mb-3 h-10 w-10 text-muted-foreground' />,
          title: 'Aún no hay procesos',
          description: 'Crea el primer procedimiento del catálogo interno.',
          action: (
            <Button size='sm' onClick={openCreateDialog}>
              <Plus className='mr-2 h-4 w-4' />
              Crear proceso
            </Button>
          ),
        }}
      />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className='max-h-[calc(100dvh-1.5rem)] w-[calc(100vw-1.5rem)] max-w-3xl overflow-y-auto p-4 sm:p-6'>
          <DialogHeader>
            <DialogTitle>Nuevo proceso</DialogTitle>
            <DialogDescription>
              Registra la identificación y propósito del proceso. La ficha FR-MC-01, diagramas,
              adjuntos y evidencias se completan después desde su detalle.
            </DialogDescription>
          </DialogHeader>
          <form className='space-y-4' onSubmit={handleCreate}>
            <FormDraftBanner
              visible={wasRestored}
              onDismiss={dismissRestoredBanner}
              onDiscard={() => {
                clearDraft()
                setForm({
                  ...EMPTY_FORM,
                  ownerId: session?.user?.id || '',
                  reviewEveryMonths: defaultReviewMonths,
                })
              }}
            />
            <div className='grid gap-3 sm:grid-cols-2'>
              <div className='space-y-2'>
                <Label htmlFor='code'>Código</Label>
                <Input
                  id='code'
                  value={form.code}
                  onChange={e => setForm(prev => ({ ...prev, code: e.target.value }))}
                  placeholder='PRO-OPS-001'
                  required
                />
              </div>
              <div className='space-y-2'>
                <Label>Criticidad</Label>
                <Select
                  value={form.criticality}
                  onValueChange={value => setForm(prev => ({ ...prev, criticality: value }))}
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
            </div>
            <div className='space-y-2'>
              <Label htmlFor='title'>Título</Label>
              <Input
                id='title'
                value={form.title}
                onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder='Ej. Gestión de seguridad física'
                required
              />
              <p className='text-xs text-muted-foreground'>
                Usa un nombre claro de la actividad que gobierna, no el nombre de una persona.
              </p>
            </div>
            <div className='grid gap-3 sm:grid-cols-2'>
              <div className='space-y-2'>
                <Label>Nivel</Label>
                <Select
                  value={String(form.level)}
                  onValueChange={value =>
                    setForm(prev => ({ ...prev, level: Number(value), parentProcessId: '' }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='0'>N0 · Macroproceso</SelectItem>
                    <SelectItem value='1'>N1 · Proceso</SelectItem>
                    <SelectItem value='2'>N2 · Subproceso</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className='space-y-2'>
                <Label>Proceso padre (opcional)</Label>
                <Select
                  value={form.parentProcessId || 'none'}
                  onValueChange={value =>
                    setForm(prev => ({ ...prev, parentProcessId: value === 'none' ? '' : value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder='Sin proceso padre' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='none'>Sin proceso padre</SelectItem>
                    {processes
                      .filter(
                        item => item.family.id === form.familyId && item.level === form.level - 1
                      )
                      .map(item => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.code} · {item.title}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className='space-y-2'>
              <Label>Área</Label>
              <Select
                value={form.familyId}
                onValueChange={value =>
                  setForm(prev => ({ ...prev, familyId: value, departmentId: '' }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder='Selecciona un área' />
                </SelectTrigger>
                <SelectContent>
                  {families.map(family => (
                    <SelectItem key={family.id} value={family.id}>
                      {family.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className='text-xs text-muted-foreground'>
                El área define el alcance y carga únicamente sus departamentos operativos.
              </p>
            </div>
            <div className='space-y-2'>
              <Label>Departamento (opcional)</Label>
              <Select
                value={form.departmentId || 'none'}
                disabled={!form.familyId}
                onValueChange={value =>
                  setForm(prev => ({
                    ...prev,
                    departmentId: value === 'none' ? '' : value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={form.familyId ? 'Sin departamento' : 'Selecciona primero un área'}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='none'>Sin departamento</SelectItem>
                  {filteredDepartments.map(department => (
                    <SelectItem key={department.id} value={department.id}>
                      {department.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.familyId && filteredDepartments.length === 0 && (
                <p className='text-xs text-muted-foreground'>
                  No hay departamentos activos asociados a esta área.
                </p>
              )}
            </div>
            <div className='space-y-2'>
              <Label htmlFor='objective'>Objetivo</Label>
              <Textarea
                id='objective'
                value={form.objective}
                onChange={e => setForm(prev => ({ ...prev, objective: e.target.value }))}
                placeholder='Ej. Garantizar una operación segura y trazable mediante controles preventivos y respuesta oportuna.'
                rows={3}
              />
              <p className='text-xs text-muted-foreground'>
                Explica el resultado que debe lograr el proceso y para quién genera valor.
              </p>
            </div>
            <div className='space-y-2'>
              <Label htmlFor='scope'>Alcance</Label>
              <Textarea
                id='scope'
                value={form.scope}
                onChange={e => setForm(prev => ({ ...prev, scope: e.target.value }))}
                placeholder='Ej. Desde la identificación de la necesidad hasta el cierre y registro de la atención.'
                rows={2}
              />
              <p className='text-xs text-muted-foreground'>
                Define dónde inicia y termina, e incluye áreas, sedes o casos que aplique.
              </p>
            </div>
            <div className='space-y-2'>
              <Label htmlFor='reviewEveryMonths'>Revisión periódica (meses)</Label>
              <Input
                id='reviewEveryMonths'
                type='number'
                min={1}
                max={60}
                value={form.reviewEveryMonths}
                onChange={e =>
                  setForm(prev => ({
                    ...prev,
                    reviewEveryMonths: Number(e.target.value) || 12,
                  }))
                }
              />
            </div>
            <p className='text-xs text-muted-foreground'>
              El responsable inicial serás tú. Puedes ajustar diagramas, estados y evidencias desde
              el detalle del proceso.
            </p>
            <DialogFooter>
              <Button type='button' variant='outline' onClick={() => setCreateOpen(false)}>
                Cancelar
              </Button>
              <Button type='submit' disabled={saving}>
                {saving ? 'Guardando...' : 'Crear'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </ModuleLayout>
  )
}
