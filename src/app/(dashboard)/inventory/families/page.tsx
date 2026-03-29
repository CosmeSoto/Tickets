'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { RoleDashboardLayout } from '@/components/layout/role-dashboard-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Info } from 'lucide-react'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { Plus, Pencil, Layers, Loader2, ToggleLeft, ToggleRight } from 'lucide-react'
import { FamilyBadge } from '@/components/inventory/family-badge'
import { IconPicker } from '@/components/inventory/icon-picker'
import type { AssetSubtype, FormSection, AcquisitionMode, SectionsByMode, ModeSectionConfig } from '@/lib/inventory/family-config-types'
import { DEFAULT_FAMILY_CONFIG, DEFAULT_MODE_CONFIG } from '@/lib/inventory/family-config-types'

type DepreciationMethod = 'LINEAR' | 'DECLINING_BALANCE' | 'UNITS_OF_PRODUCTION'

const DEPRECIATION_METHOD_LABELS: Record<DepreciationMethod, string> = {
  LINEAR: 'Línea Recta',
  DECLINING_BALANCE: 'Saldo Decreciente',
  UNITS_OF_PRODUCTION: 'Unidades de Producción',
}

interface Family {
  id: string
  code: string
  name: string
  icon?: string | null
  color?: string | null
  order: number
  isActive: boolean
}

const SUBTYPE_LABELS: Record<AssetSubtype, string> = {
  EQUIPMENT: 'Equipo Físico',
  MRO: 'Material MRO',
  LICENSE: 'Contrato / Licencia',
}

const SECTION_LABELS: Record<FormSection, string> = {
  FINANCIAL: 'Financiero',
  DEPRECIATION: 'Depreciación',
  CONTRACT: 'Contrato',
  STOCK_MRO: 'Stock MRO',
  WAREHOUSE: 'Bodega',
}

const SECTION_DESCRIPTIONS: Record<FormSection, string> = {
  FINANCIAL: 'Precio de compra, fecha de compra, N° de factura',
  DEPRECIATION: 'Método, vida útil en años, valor residual',
  CONTRACT: 'Número de contrato, fechas de inicio/fin, costo mensual',
  STOCK_MRO: 'Stock inicial, stock mínimo, stock máximo',
  WAREHOUSE: 'Bodega de almacenamiento del activo',
}

const ACQUISITION_MODES: { value: AcquisitionMode; label: string; help: string }[] = [
  { value: 'FIXED_ASSET', label: 'Activo Fijo', help: 'Compra directa — se deprecia' },
  { value: 'RENTAL',      label: 'Arrendamiento', help: 'Pago mensual al proveedor' },
  { value: 'LOAN',        label: 'Activo de Tercero', help: 'Préstamo sin costo' },
]

const ALL_SUBTYPES: AssetSubtype[] = ['EQUIPMENT', 'MRO', 'LICENSE']
const ALL_SECTIONS: FormSection[] = ['FINANCIAL', 'DEPRECIATION', 'CONTRACT', 'STOCK_MRO', 'WAREHOUSE']

/** Tooltip de ayuda reutilizable */
function HelpTip({ text }: { text: string }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Info className='h-3.5 w-3.5 text-muted-foreground cursor-help shrink-0' />
        </TooltipTrigger>
        <TooltipContent side='right' className='max-w-[220px] text-xs'>
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/** Tabla reutilizable de secciones visible/obligatoria */
function SectionTable({
  sections,
  visible,
  required,
  onToggleVisible,
  onToggleRequired,
}: {
  sections: FormSection[]
  visible: FormSection[]
  required: FormSection[]
  onToggleVisible: (s: FormSection, v: boolean) => void
  onToggleRequired: (s: FormSection, v: boolean) => void
}) {
  return (
    <table className='w-full text-sm'>
      <thead>
        <tr className='border-b'>
          <th className='text-left py-2 font-medium text-muted-foreground'>Sección</th>
          <th className='text-left py-2 font-medium text-muted-foreground hidden sm:table-cell'>Campos incluidos</th>
          <th className='text-center py-2 font-medium text-muted-foreground w-20'>
            <span className='flex items-center justify-center gap-1'>
              Visible
              <HelpTip text='El usuario verá esta sección en el formulario, pero no es obligatorio completarla.' />
            </span>
          </th>
          <th className='text-center py-2 font-medium text-muted-foreground w-24'>
            <span className='flex items-center justify-center gap-1'>
              Obligatoria
              <HelpTip text='El usuario debe completar esta sección para poder guardar el activo. Activar esto también activa Visible.' />
            </span>
          </th>
        </tr>
      </thead>
      <tbody>
        {sections.map(section => (
          <tr key={section} className='border-b last:border-0 hover:bg-muted/30'>
            <td className='py-2.5 font-medium'>{SECTION_LABELS[section]}</td>
            <td className='py-2.5 text-xs text-muted-foreground hidden sm:table-cell'>{SECTION_DESCRIPTIONS[section]}</td>
            <td className='py-2.5 text-center'>
              <Checkbox
                checked={visible.includes(section)}
                onCheckedChange={checked => onToggleVisible(section, !!checked)}
              />
            </td>
            <td className='py-2.5 text-center'>
              <Checkbox
                checked={required.includes(section)}
                onCheckedChange={checked => onToggleRequired(section, !!checked)}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

interface FamilyFormState {
  name: string
  icon: string
  color: string
  order: number
  allowedSubtypes: AssetSubtype[]
  visibleSections: FormSection[]
  requiredSections: FormSection[]
  requireFinancialForNew: boolean
  sectionsByMode: SectionsByMode
  // Depreciación por defecto
  defaultDepreciationMethod: DepreciationMethod | null
  defaultUsefulLifeYears: number | null
  defaultResidualValuePct: number | null
  // Comportamientos
  codePrefix: string
  autoApproveDecommission: boolean
  requireDeliveryAct: boolean
}

const DEFAULT_FORM: FamilyFormState = {
  name: '',
  icon: '',
  color: '#6B7280',
  order: 999,
  allowedSubtypes: DEFAULT_FAMILY_CONFIG.allowedSubtypes,
  visibleSections: DEFAULT_FAMILY_CONFIG.visibleSections,
  requiredSections: DEFAULT_FAMILY_CONFIG.requiredSections,
  requireFinancialForNew: true,
  sectionsByMode: {},
  defaultDepreciationMethod: null,
  defaultUsefulLifeYears: null,
  defaultResidualValuePct: null,
  codePrefix: '',
  autoApproveDecommission: false,
  requireDeliveryAct: true,
}

export default function FamiliesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()

  const [families, setFamilies] = useState<Family[]>([])
  const [loading, setLoading] = useState(true)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingFamily, setEditingFamily] = useState<Family | null>(null)
  const [form, setForm] = useState<FamilyFormState>(DEFAULT_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [loadingConfig, setLoadingConfig] = useState(false)
  const [togglingFamily, setTogglingFamily] = useState<Family | null>(null)
  const [toggling, setToggling] = useState(false)
  // Tab activo en la config de secciones por modalidad
  const [activeModeTab, setActiveModeTab] = useState<AcquisitionMode>('FIXED_ASSET')

  useEffect(() => {
    if (status === 'loading') return
    if (!session) { router.push('/login'); return }
    if (session.user.role !== 'ADMIN') { router.push('/unauthorized'); return }
    fetchFamilies()
  }, [session, status, router])

  const fetchFamilies = async () => {
    try {
      const res = await fetch(`/api/inventory/families?includeInactive=true&_t=${Date.now()}`, { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        setFamilies(Array.isArray(data) ? data : (data.families ?? []))
      }
    } catch {
      toast({ title: 'Error', description: 'No se pudieron cargar las familias', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const openCreate = () => {
    setEditingFamily(null)
    setForm(DEFAULT_FORM)
    setSheetOpen(true)
  }

  const openEdit = useCallback(async (family: Family) => {
    setEditingFamily(family)
    setForm({
      name: family.name,
      icon: family.icon ?? '',
      color: family.color ?? '#6B7280',
      order: family.order,
      allowedSubtypes: DEFAULT_FAMILY_CONFIG.allowedSubtypes,
      visibleSections: DEFAULT_FAMILY_CONFIG.visibleSections,
      requiredSections: DEFAULT_FAMILY_CONFIG.requiredSections,
      sectionsByMode: {},
      defaultDepreciationMethod: null,
      defaultUsefulLifeYears: null,
      defaultResidualValuePct: null,
      codePrefix: '',
      autoApproveDecommission: false,
      requireDeliveryAct: true,
    })
    setSheetOpen(true)
    setLoadingConfig(true)
    try {
      const res = await fetch(`/api/inventory/family-config/${family.id}`)
      if (res.ok) {
        const cfg = await res.json()
        setForm(prev => ({
          ...prev,
          allowedSubtypes: cfg.allowedSubtypes ?? DEFAULT_FAMILY_CONFIG.allowedSubtypes,
          visibleSections: cfg.visibleSections ?? DEFAULT_FAMILY_CONFIG.visibleSections,
          requiredSections: cfg.requiredSections ?? DEFAULT_FAMILY_CONFIG.requiredSections,
          requireFinancialForNew: cfg.requireFinancialForNew ?? true,
          sectionsByMode: cfg.sectionsByMode ?? {},
          defaultDepreciationMethod: cfg.defaultDepreciationMethod ?? null,
          defaultUsefulLifeYears: cfg.defaultUsefulLifeYears ?? null,
          defaultResidualValuePct: cfg.defaultResidualValuePct ?? null,
          codePrefix: cfg.codePrefix ?? '',
          autoApproveDecommission: cfg.autoApproveDecommission ?? false,
          requireDeliveryAct: cfg.requireDeliveryAct ?? true,
        }))
      }
    } catch { /* usa defaults */ } finally {
      setLoadingConfig(false)
    }
  }, [])

  const setField = <K extends keyof FamilyFormState>(key: K, value: FamilyFormState[K]) =>
    setForm(prev => ({ ...prev, [key]: value }))

  const toggleSubtype = (subtype: AssetSubtype) =>
    setField('allowedSubtypes', form.allowedSubtypes.includes(subtype)
      ? form.allowedSubtypes.filter(s => s !== subtype)
      : [...form.allowedSubtypes, subtype])

  const toggleVisible = (section: FormSection, checked: boolean) => {
    if (checked) {
      setField('visibleSections', [...form.visibleSections, section])
    } else {
      setForm(prev => ({
        ...prev,
        visibleSections: prev.visibleSections.filter(s => s !== section),
        requiredSections: prev.requiredSections.filter(s => s !== section),
      }))
    }
  }

  const toggleRequired = (section: FormSection, checked: boolean) => {
    if (checked) {
      setForm(prev => ({
        ...prev,
        requiredSections: [...prev.requiredSections, section],
        visibleSections: prev.visibleSections.includes(section)
          ? prev.visibleSections
          : [...prev.visibleSections, section],
      }))
    } else {
      setField('requiredSections', form.requiredSections.filter(s => s !== section))
    }
  }

  // Helpers para sectionsByMode
  const getModeConfig = (mode: AcquisitionMode): ModeSectionConfig =>
    form.sectionsByMode[mode] ?? { ...DEFAULT_MODE_CONFIG }

  const setModeVisible = (mode: AcquisitionMode, section: FormSection, checked: boolean) => {
    const current = getModeConfig(mode)
    const visible = checked
      ? [...current.visible, section]
      : current.visible.filter(s => s !== section)
    const required = checked ? current.required : current.required.filter(s => s !== section)
    setForm(prev => ({
      ...prev,
      sectionsByMode: { ...prev.sectionsByMode, [mode]: { visible, required } },
    }))
  }

  const setModeRequired = (mode: AcquisitionMode, section: FormSection, checked: boolean) => {
    const current = getModeConfig(mode)
    const required = checked
      ? [...current.required, section]
      : current.required.filter(s => s !== section)
    const visible = checked && !current.visible.includes(section)
      ? [...current.visible, section]
      : current.visible
    setForm(prev => ({
      ...prev,
      sectionsByMode: { ...prev.sectionsByMode, [mode]: { visible, required } },
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.allowedSubtypes.length === 0) {
      toast({ title: 'Error', description: 'Debes permitir al menos un subtipo', variant: 'destructive' })
      return
    }
    setSubmitting(true)
    try {
      // 1. Guardar datos básicos de la familia
      const url = editingFamily ? `/api/inventory/families/${editingFamily.id}` : '/api/inventory/families'
      const method = editingFamily ? 'PUT' : 'POST'
      const familyRes = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, icon: form.icon, color: form.color, order: form.order }),
      })
      if (!familyRes.ok) {
        const err = await familyRes.json().catch(() => ({}))
        throw new Error(err.error ?? 'Error al guardar la familia')
      }
      const savedFamily = await familyRes.json()
      const familyId = savedFamily.family?.id ?? savedFamily.id ?? editingFamily?.id

      // 2. Guardar configuración del formulario
      await fetch(`/api/inventory/family-config/${familyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          allowedSubtypes: form.allowedSubtypes,
          visibleSections: form.visibleSections,
          requiredSections: form.requiredSections,
          requireFinancialForNew: form.requireFinancialForNew,
          // Solo enviar sectionsByMode si EQUIPMENT está permitido y hay config por modalidad
          sectionsByMode: form.allowedSubtypes.includes('EQUIPMENT') && Object.keys(form.sectionsByMode).length > 0
            ? form.sectionsByMode
            : null,
          // Depreciación por defecto
          defaultDepreciationMethod: form.defaultDepreciationMethod,
          defaultUsefulLifeYears: form.defaultUsefulLifeYears,
          defaultResidualValuePct: form.defaultResidualValuePct,
          // Comportamientos
          codePrefix: form.codePrefix || null,
          autoApproveDecommission: form.autoApproveDecommission,
          requireDeliveryAct: form.requireDeliveryAct,
        }),
      })

      toast({
        title: editingFamily ? 'Familia actualizada' : 'Familia creada',
        description: `"${form.name}" guardada con su configuración.`,
      })
      setSheetOpen(false)
      await fetchFamilies()
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Error de conexión',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const confirmToggle = async () => {
    if (!togglingFamily) return
    setToggling(true)
    try {
      const res = await fetch(`/api/inventory/families/${togglingFamily.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !togglingFamily.isActive }),
      })
      if (res.ok) {
        toast({ title: togglingFamily.isActive ? 'Familia desactivada' : 'Familia activada' })
        await fetchFamilies()
      } else {
        const err = await res.json()
        toast({ title: 'Error', description: err.error || 'Error al cambiar estado', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' })
    } finally {
      setToggling(false)
      setTogglingFamily(null)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <RoleDashboardLayout title='Familias de Inventario' subtitle=''>
        <div className='flex items-center justify-center h-64'>
          <Loader2 className='h-8 w-8 animate-spin text-primary' />
        </div>
      </RoleDashboardLayout>
    )
  }

  return (
    <RoleDashboardLayout
      title='Familias de Inventario'
      subtitle='Gestiona las familias de activos disponibles en el sistema'
      headerActions={
        <Button onClick={openCreate}>
          <Plus className='h-4 w-4 mr-2' />
          Nueva Familia
        </Button>
      }
    >
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Layers className='h-5 w-5 text-primary' />
            Familias de Inventario
          </CardTitle>
          <CardDescription>
            Cada familia define qué tipos de activo acepta y qué secciones del formulario son visibles u obligatorias.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Familia</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Color</TableHead>
                <TableHead>Orden</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className='text-right'>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {families.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className='text-center text-muted-foreground py-8'>
                    No hay familias registradas. Crea la primera.
                  </TableCell>
                </TableRow>
              ) : (
                families.map((family) => (
                  <TableRow
                    key={family.id}
                    className='cursor-pointer hover:bg-muted/50'
                    onClick={() => openEdit(family)}
                  >
                    <TableCell><FamilyBadge family={family} size='sm' /></TableCell>
                    <TableCell className='font-mono text-sm'>{family.code}</TableCell>
                    <TableCell>
                      <div className='flex items-center gap-2'>
                        <div className='w-5 h-5 rounded-full border' style={{ backgroundColor: family.color ?? '#6B7280' }} />
                        <span className='text-xs font-mono text-muted-foreground'>{family.color ?? '-'}</span>
                      </div>
                    </TableCell>
                    <TableCell>{family.order}</TableCell>
                    <TableCell>
                      <Badge variant={family.isActive ? 'default' : 'secondary'}>
                        {family.isActive ? 'Activa' : 'Inactiva'}
                      </Badge>
                    </TableCell>
                    <TableCell className='text-right'>
                      <div className='flex justify-end gap-1'>
                        <Button variant='ghost' size='sm' title='Editar' onClick={(e) => { e.stopPropagation(); openEdit(family) }}>
                          <Pencil className='h-4 w-4' />
                        </Button>
                        <Button variant='ghost' size='sm' title={family.isActive ? 'Desactivar' : 'Activar'} onClick={(e) => { e.stopPropagation(); setTogglingFamily(family) }}>
                          {family.isActive
                            ? <ToggleRight className='h-4 w-4 text-green-600' />
                            : <ToggleLeft className='h-4 w-4 text-muted-foreground' />}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog unificado: datos + configuración */}
      <Dialog open={sheetOpen} onOpenChange={setSheetOpen}>
        <DialogContent className='max-w-4xl w-full max-h-[90vh] flex flex-col p-0 gap-0'>
          {/* Header fijo */}
          <DialogHeader className='px-6 pt-6 pb-4 border-b shrink-0'>
            <DialogTitle>{editingFamily ? 'Editar Familia' : 'Nueva Familia'}</DialogTitle>
            <DialogDescription>
              {editingFamily
                ? 'Modifica los datos y la configuración del formulario de esta familia.'
                : 'Define los datos básicos y configura qué tipos de activo y secciones estarán disponibles.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className='flex flex-col flex-1 min-h-0'>
            {/* Cuerpo en dos columnas */}
            <div className='flex flex-1 min-h-0 divide-x'>

              {/* ── Columna izquierda: Datos básicos (fija, no scrollea) ── */}
              <div className='w-72 shrink-0 flex flex-col px-6 py-5 space-y-4 overflow-y-auto'>
                <p className='text-xs font-semibold text-muted-foreground uppercase tracking-wide'>Datos básicos</p>

                <div className='space-y-1.5'>
                  <Label htmlFor='name'>Nombre <span className='text-destructive'>*</span></Label>
                  <Input
                    id='name'
                    value={form.name}
                    onChange={e => setField('name', e.target.value)}
                    placeholder='Ej: Activos Fijos'
                    required
                  />
                </div>

                <IconPicker value={form.icon} onChange={v => setField('icon', v)} />

                <div className='space-y-1.5'>
                  <Label>Color</Label>
                  <div className='flex items-center gap-2'>
                    <input
                      type='color'
                      value={form.color}
                      onChange={e => setField('color', e.target.value)}
                      className='h-9 w-14 cursor-pointer rounded border border-input bg-background p-1'
                    />
                    <Input
                      value={form.color}
                      onChange={e => setField('color', e.target.value)}
                      placeholder='#6B7280'
                      className='font-mono'
                    />
                  </div>
                </div>

                <div className='space-y-1.5'>
                  <Label htmlFor='order'>Orden</Label>
                  <Input
                    id='order'
                    type='number'
                    value={form.order}
                    onChange={e => setField('order', parseInt(e.target.value) || 999)}
                  />
                  <p className='text-xs text-muted-foreground'>Menor número = aparece primero</p>
                </div>

                {/* Preview de la familia */}
                {form.name && (
                  <div className='pt-2'>
                    <p className='text-xs text-muted-foreground mb-2'>Vista previa</p>
                    <FamilyBadge
                      family={{ id: '', code: '', name: form.name, icon: form.icon, color: form.color, order: form.order, isActive: true }}
                      size='sm'
                    />
                  </div>
                )}
              </div>

              {/* ── Columna derecha: Configuración del formulario (scrolleable) ── */}
              <div className='flex-1 overflow-y-auto px-6 py-5 space-y-5'>
                <p className='text-xs font-semibold text-muted-foreground uppercase tracking-wide'>Configuración del formulario</p>

                {loadingConfig ? (
                  <div className='flex items-center gap-2 text-sm text-muted-foreground'>
                    <Loader2 className='h-4 w-4 animate-spin' />
                    Cargando configuración...
                  </div>
                ) : (
                  <>
                    {/* Subtipos */}
                    <div className='space-y-2'>
                      <div className='flex items-center gap-1.5'>
                        <p className='text-xs font-semibold text-muted-foreground uppercase tracking-wide'>¿Qué tipos de activo acepta?</p>
                        <HelpTip text='Define qué categorías de activo se pueden registrar bajo esta familia. Si solo hay uno, el formulario lo selecciona automáticamente.' />
                      </div>
                      <div className='flex flex-wrap gap-x-6 gap-y-2 rounded-md border border-border bg-muted/20 px-3 py-2.5'>
                        {ALL_SUBTYPES.map(subtype => (
                          <div key={subtype} className='flex items-center gap-2'>
                            <Checkbox
                              id={`sub-${subtype}`}
                              checked={form.allowedSubtypes.includes(subtype)}
                              onCheckedChange={() => toggleSubtype(subtype)}
                            />
                            <Label htmlFor={`sub-${subtype}`} className='cursor-pointer font-normal'>
                              {SUBTYPE_LABELS[subtype]}
                            </Label>
                          </div>
                        ))}
                      </div>
                      {form.allowedSubtypes.length === 0 && (
                        <p className='text-xs text-destructive'>Selecciona al menos un subtipo</p>
                      )}
                    </div>

                    <Separator />

                    {/* Secciones */}
                    <div className='space-y-2'>
                      <div className='flex items-center gap-1.5'>
                        <p className='text-xs font-semibold text-muted-foreground uppercase tracking-wide'>¿Qué secciones aparecen en el formulario?</p>
                        <HelpTip text='Controla qué bloques de campos ve el usuario al registrar un activo de esta familia. "Visible" = aparece pero es opcional. "Obligatoria" = debe completarse para guardar.' />
                      </div>

                      {form.allowedSubtypes.includes('EQUIPMENT') ? (
                        <div className='space-y-3'>
                          <p className='text-xs text-muted-foreground'>
                            Para equipos físicos puedes configurar las secciones por modalidad de adquisición. Selecciona la pestaña y ajusta cada una.
                          </p>
                          <div className='flex gap-1 rounded-lg bg-muted p-1'>
                            {ACQUISITION_MODES.map(m => (
                              <button
                                key={m.value}
                                type='button'
                                onClick={() => setActiveModeTab(m.value)}
                                className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                                  activeModeTab === m.value
                                    ? 'bg-background text-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                                }`}
                              >
                                {m.label}
                              </button>
                            ))}
                          </div>
                          <p className='text-xs text-muted-foreground italic bg-muted/40 rounded px-2 py-1'>
                            {ACQUISITION_MODES.find(m => m.value === activeModeTab)?.help}
                          </p>
                          <SectionTable
                            sections={ALL_SECTIONS}
                            visible={getModeConfig(activeModeTab).visible}
                            required={getModeConfig(activeModeTab).required}
                            onToggleVisible={(s, v) => setModeVisible(activeModeTab, s, v)}
                            onToggleRequired={(s, v) => setModeRequired(activeModeTab, s, v)}
                          />
                        </div>
                      ) : (
                        <SectionTable
                          sections={ALL_SECTIONS}
                          visible={form.visibleSections}
                          required={form.requiredSections}
                          onToggleVisible={(s, v) => toggleVisible(s, v)}
                          onToggleRequired={(s, v) => toggleRequired(s, v)}
                        />
                      )}
                    </div>

                    <Separator />

                    {/* Comportamiento financiero */}
                    <div className='space-y-3'>
                      <div className='flex items-center gap-1.5'>
                        <p className='text-xs font-semibold text-muted-foreground uppercase tracking-wide'>Reglas de registro</p>
                        <HelpTip text='Comportamientos especiales que se aplican al registrar activos de esta familia.' />
                      </div>

                      <div className='rounded-md border border-border p-3 space-y-1'>
                        <div className='flex items-start gap-2'>
                          <Checkbox
                            id='requireFinancialForNew'
                            checked={form.requireFinancialForNew}
                            onCheckedChange={checked => setField('requireFinancialForNew', !!checked)}
                            className='mt-0.5'
                          />
                          <div>
                            <Label htmlFor='requireFinancialForNew' className='cursor-pointer font-medium text-sm'>
                              Exigir precio de compra en activos nuevos
                            </Label>
                            <p className='text-xs text-muted-foreground mt-0.5'>
                              Si está activo, al registrar un activo con condición "Nuevo" el precio de compra será obligatorio.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Depreciación por defecto */}
                    <div className='space-y-3'>
                      <div className='flex items-center gap-1.5'>
                        <p className='text-xs font-semibold text-muted-foreground uppercase tracking-wide'>Depreciación por defecto</p>
                        <HelpTip text='Valores que se pre-rellenan automáticamente en el formulario de activos al seleccionar esta familia. El usuario puede cambiarlos.' />
                      </div>
                      <p className='text-xs text-muted-foreground -mt-1'>
                        Estos valores se sugieren al registrar un equipo de esta familia. El usuario puede ajustarlos.
                      </p>

                      <div className='space-y-1.5'>
                        <Label htmlFor='defaultDepreciationMethod'>Método por defecto</Label>
                        <Select
                          value={form.defaultDepreciationMethod ?? 'NONE'}
                          onValueChange={v => setField('defaultDepreciationMethod', (v === 'NONE' ? null : v) as DepreciationMethod | null)}
                        >
                          <SelectTrigger id='defaultDepreciationMethod'>
                            <SelectValue placeholder='Sin método por defecto' />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value='NONE'>Sin método por defecto</SelectItem>
                            {(Object.keys(DEPRECIATION_METHOD_LABELS) as DepreciationMethod[]).map(m => (
                              <SelectItem key={m} value={m}>{DEPRECIATION_METHOD_LABELS[m]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className='grid grid-cols-2 gap-3'>
                        <div className='space-y-1.5'>
                          <div className='flex items-center gap-1'>
                            <Label htmlFor='defaultUsefulLifeYears' className='text-sm'>Vida útil sugerida (años)</Label>
                            <HelpTip text='Ej: laptops 3-5 años, servidores 5-7 años, mobiliario 10 años.' />
                          </div>
                          <Input
                            id='defaultUsefulLifeYears'
                            type='number'
                            min={1}
                            max={100}
                            value={form.defaultUsefulLifeYears ?? ''}
                            onChange={e => setField('defaultUsefulLifeYears', e.target.value ? Number(e.target.value) : null)}
                            placeholder='Ej: 5'
                          />
                        </div>
                        <div className='space-y-1.5'>
                          <div className='flex items-center gap-1'>
                            <Label htmlFor='defaultResidualValuePct' className='text-sm'>Valor residual sugerido (%)</Label>
                            <HelpTip text='Porcentaje del precio de compra que se sugiere como valor residual. Ej: 10 → un equipo de $1,000 tendrá valor residual sugerido de $100.' />
                          </div>
                          <Input
                            id='defaultResidualValuePct'
                            type='number'
                            min={0}
                            max={100}
                            value={form.defaultResidualValuePct ?? ''}
                            onChange={e => setField('defaultResidualValuePct', e.target.value ? Number(e.target.value) : null)}
                            placeholder='Ej: 10'
                          />
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Comportamientos de flujo */}
                    <div className='space-y-3'>
                      <div className='flex items-center gap-1.5'>
                        <p className='text-xs font-semibold text-muted-foreground uppercase tracking-wide'>Comportamientos de flujo</p>
                        <HelpTip text='Controlan cómo se procesan las asignaciones y bajas de activos de esta familia.' />
                      </div>

                      <div className='space-y-1.5'>
                        <div className='flex items-center gap-1'>
                          <Label htmlFor='codePrefix' className='text-sm'>Prefijo de código</Label>
                          <HelpTip text='Si se define, los códigos de activos de esta familia usarán este prefijo en lugar del código de la familia. Máx. 10 caracteres alfanuméricos.' />
                        </div>
                        <Input
                          id='codePrefix'
                          value={form.codePrefix}
                          onChange={e => setField('codePrefix', e.target.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10))}
                          placeholder='Ej: TEC (dejar vacío para usar el código de familia)'
                          maxLength={10}
                        />
                      </div>

                      <div className='rounded-md border border-border p-3 space-y-1.5'>
                        <div className='flex items-center justify-between gap-3'>
                          <div className='flex items-center gap-1.5 min-w-0'>
                            <Label htmlFor='autoApproveDecommission' className='cursor-pointer font-medium text-sm leading-snug'>
                              Baja automática sin aprobación
                            </Label>
                            <HelpTip text='Cuando está activo, al solicitar la baja de un activo de esta familia se genera el acta de baja de inmediato, sin esperar revisión del administrador.' />
                          </div>
                          <Switch
                            id='autoApproveDecommission'
                            checked={form.autoApproveDecommission}
                            onCheckedChange={checked => setField('autoApproveDecommission', checked)}
                          />
                        </div>
                        <p className='text-xs text-muted-foreground'>
                          {form.autoApproveDecommission
                            ? '✓ Las bajas se aprueban automáticamente y generan acta de inmediato.'
                            : 'Las bajas quedan pendientes hasta que un administrador las apruebe.'}
                        </p>
                      </div>

                      <div className='rounded-md border border-border p-3 space-y-1.5'>
                        <div className='flex items-center justify-between gap-3'>
                          <div className='flex items-center gap-1.5 min-w-0'>
                            <Label htmlFor='requireDeliveryAct' className='cursor-pointer font-medium text-sm leading-snug'>
                              Requiere acta de entrega
                            </Label>
                            <HelpTip text='Cuando está activo, al asignar un activo de esta familia se genera un acta de entrega que el receptor debe firmar digitalmente.' />
                          </div>
                          <Switch
                            id='requireDeliveryAct'
                            checked={form.requireDeliveryAct}
                            onCheckedChange={checked => setField('requireDeliveryAct', checked)}
                          />
                        </div>
                        <p className='text-xs text-muted-foreground'>
                          {form.requireDeliveryAct
                            ? '✓ La asignación genera un acta de entrega con firma digital del receptor.'
                            : 'La asignación se activa directamente, sin acta de entrega.'}
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Footer fijo con acciones */}
            <div className='flex gap-3 justify-end px-6 py-4 border-t shrink-0'>
              <Button type='button' variant='outline' onClick={() => setSheetOpen(false)} disabled={submitting}>
                Cancelar
              </Button>
              <Button type='submit' disabled={submitting || loadingConfig || form.allowedSubtypes.length === 0}>
                {submitting && <Loader2 className='h-4 w-4 mr-2 animate-spin' />}
                {editingFamily ? 'Guardar cambios' : 'Crear familia'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmar toggle activo/inactivo */}
      <AlertDialog open={!!togglingFamily} onOpenChange={open => !open && setTogglingFamily(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {togglingFamily?.isActive ? '¿Desactivar familia?' : '¿Activar familia?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {togglingFamily?.isActive
                ? <>La familia <span className='font-semibold text-foreground'>"{togglingFamily?.name}"</span> dejará de aparecer en selectores y filtros.</>
                : <>La familia <span className='font-semibold text-foreground'>"{togglingFamily?.name}"</span> volverá a estar disponible en el sistema.</>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={toggling}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmToggle} disabled={toggling}>
              {toggling && <Loader2 className='h-4 w-4 mr-2 animate-spin' />}
              {togglingFamily?.isActive ? 'Desactivar' : 'Activar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </RoleDashboardLayout>
  )
}
