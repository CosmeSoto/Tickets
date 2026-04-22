'use client'

/**
 * TabGeneral — Pestaña General de la página de detalle de familia
 * Muestra y edita datos básicos (code, name, description, icon, color, isActive, order)
 * y gestiona los departamentos vinculados.
 * Requisitos: 2.1, 2.2, 2.3, 2.4, 2.5
 */

import { useState } from 'react'
import {
  Building, Edit, Trash2, ToggleLeft, ToggleRight,
  Plus, RefreshCw, Save,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
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
import { DepartmentFormDialog } from '@/components/departments/department-form-dialog'
import { useToast } from '@/hooks/use-toast'
import type { DepartmentData, DepartmentFormData } from '@/hooks/use-departments'
import { IconPicker } from '@/components/inventory/icon-picker'

interface FamilyBase {
  id: string
  code: string
  name: string
  description?: string | null
  color?: string | null
  icon?: string | null
  isActive: boolean
  order: number
}

interface TabGeneralProps {
  family: FamilyBase
  departments: DepartmentData[]
  onFamilyUpdated: (updated: FamilyBase) => void
  onDepartmentsChanged: () => void
}

const DEFAULT_DEPT_FORM: DepartmentFormData = {
  name: '',
  description: '',
  color: '#3B82F6',
  order: 0,
  isActive: true,
}

const FAMILY_COLORS = [
  { value: '#6B7280', label: 'Gris' },
  { value: '#3B82F6', label: 'Azul' },
  { value: '#10B981', label: 'Verde' },
  { value: '#F59E0B', label: 'Naranja' },
  { value: '#EF4444', label: 'Rojo' },
  { value: '#8B5CF6', label: 'Púrpura' },
  { value: '#EC4899', label: 'Rosa' },
  { value: '#14B8A6', label: 'Turquesa' },
  { value: '#6366F1', label: 'Índigo' },
  { value: '#06B6D4', label: 'Cian' },
]

export function TabGeneral({ family, departments, onFamilyUpdated, onDepartmentsChanged }: TabGeneralProps) {
  const { toast } = useToast()

  // --- Basic form state ---
  const [form, setForm] = useState({
    code: family.code,
    name: family.name,
    description: family.description ?? '',
    icon: family.icon ?? '',
    color: family.color ?? '#6B7280',
    isActive: family.isActive,
    order: family.order,
  })
  const [saving, setSaving] = useState(false)
  const [codeError, setCodeError] = useState<string | null>(null)

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: 'Error', description: 'El nombre es requerido', variant: 'destructive' })
      return
    }
    setSaving(true)
    setCodeError(null)
    try {
      const res = await fetch(`/api/admin/families/${family.id}/general`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: form.code.trim(),
          name: form.name.trim(),
          description: form.description.trim() || null,
          icon: form.icon.trim() || null,
          color: form.color,
          isActive: form.isActive,
          order: Number(form.order),
        }),
      })
      const data = await res.json()
      if (res.status === 409) {
        setCodeError('El código ya está en uso por otra familia')
        return
      }
      if (!res.ok) {
        toast({ title: 'Error', description: data.error || 'Error al guardar', variant: 'destructive' })
        return
      }
      toast({ title: 'Guardado', description: 'Datos básicos actualizados correctamente' })
      onFamilyUpdated(data)
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  // --- Department state ---
  const [showDeptDialog, setShowDeptDialog] = useState(false)
  const [editingDept, setEditingDept] = useState<DepartmentData | null>(null)
  const [deptForm, setDeptForm] = useState<DepartmentFormData>(DEFAULT_DEPT_FORM)
  const [submittingDept, setSubmittingDept] = useState(false)
  const [deletingDept, setDeletingDept] = useState<DepartmentData | null>(null)
  const [showDeleteDeptDialog, setShowDeleteDeptDialog] = useState(false)
  const [deletingDeptLoading, setDeletingDeptLoading] = useState(false)
  const [togglingDept, setTogglingDept] = useState<string | null>(null)

  const openCreateDept = () => {
    setEditingDept(null)
    setDeptForm(DEFAULT_DEPT_FORM)
    setShowDeptDialog(true)
  }

  const openEditDept = (dept: DepartmentData) => {
    setEditingDept(dept)
    setDeptForm({
      name: dept.name,
      description: dept.description || '',
      color: dept.color || '#3B82F6',
      order: dept.order ?? 0,
      isActive: dept.isActive,
    })
    setShowDeptDialog(true)
  }

  const handleSubmitDept = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!deptForm.name.trim()) {
      toast({ title: 'Error', description: 'El nombre es requerido', variant: 'destructive' })
      return
    }
    setSubmittingDept(true)
    try {
      const url = editingDept ? `/api/departments/${editingDept.id}` : '/api/departments'
      const method = editingDept ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...deptForm, familyId: family.id }),
      })
      const data = await res.json()
      if (data.success) {
        toast({ title: 'Éxito', description: data.message })
        setShowDeptDialog(false)
        onDepartmentsChanged()
      } else {
        toast({ title: 'Error', description: data.error || data.message, variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' })
    } finally {
      setSubmittingDept(false)
    }
  }

  const handleToggleDept = async (dept: DepartmentData) => {
    setTogglingDept(dept.id)
    try {
      const res = await fetch(`/api/departments/${dept.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !dept.isActive }),
      })
      const data = await res.json()
      if (data.success) {
        toast({ title: 'Éxito', description: data.message })
        onDepartmentsChanged()
      } else {
        toast({ title: 'Error', description: data.error || data.message, variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' })
    } finally {
      setTogglingDept(null)
    }
  }

  const handleDeleteDept = async () => {
    if (!deletingDept) return
    setDeletingDeptLoading(true)
    try {
      const res = await fetch(`/api/departments/${deletingDept.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        toast({ title: 'Éxito', description: data.message })
        setShowDeleteDeptDialog(false)
        onDepartmentsChanged()
      } else {
        toast({ title: 'No se puede eliminar', description: data.error || data.message, variant: 'destructive' })
        setShowDeleteDeptDialog(false)
      }
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' })
    } finally {
      setDeletingDeptLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Basic data form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos básicos</CardTitle>
          <CardDescription>Edita la información principal de la familia</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Code */}
            <div className="space-y-1">
              <Label htmlFor="family-code">Código *</Label>
              <Input
                id="family-code"
                value={form.code}
                onChange={(e) => { setForm(f => ({ ...f, code: e.target.value })); setCodeError(null) }}
                placeholder="Ej: IT"
                disabled={saving}
              />
              {codeError && (
                <p className="text-xs text-destructive">{codeError}</p>
              )}
            </div>

            {/* Name */}
            <div className="space-y-1">
              <Label htmlFor="family-name">Nombre *</Label>
              <Input
                id="family-name"
                value={form.name}
                onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Ej: Tecnología"
                disabled={saving}
              />
            </div>

            {/* Icon */}
            <div className="space-y-1 sm:col-span-2">
              <IconPicker
                value={form.icon}
                onChange={(v) => setForm(f => ({ ...f, icon: v }))}
              />
            </div>

            {/* Order */}
            <div className="space-y-1">
              <Label htmlFor="family-order">Orden</Label>
              <Input
                id="family-order"
                type="number"
                value={form.order}
                onChange={(e) => setForm(f => ({ ...f, order: parseInt(e.target.value) || 0 }))}
                min={0}
                disabled={saving}
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1">
            <Label htmlFor="family-description">Descripción</Label>
            <Textarea
              id="family-description"
              value={form.description}
              onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Descripción de la familia"
              rows={2}
              disabled={saving}
            />
          </div>

          {/* Color */}
          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {FAMILY_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, color: c.value }))}
                  className={`w-8 h-8 rounded-full transition-all hover:scale-110 ${
                    form.color === c.value ? 'ring-2 ring-offset-2 ring-primary' : ''
                  }`}
                  style={{ backgroundColor: c.value }}
                  title={c.label}
                  disabled={saving}
                />
              ))}
            </div>
          </div>

          {/* isActive */}
          <div className="flex items-center gap-3">
            <Switch
              id="family-active"
              checked={form.isActive}
              onCheckedChange={(v) => setForm(f => ({ ...f, isActive: v }))}
              disabled={saving}
            />
            <Label htmlFor="family-active" className="cursor-pointer">
              Familia activa
            </Label>
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Guardando...</>
              ) : (
                <><Save className="h-4 w-4 mr-2" />Guardar cambios</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Departments */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Building className="h-4 w-4" />
                Departamentos ({departments.length})
              </CardTitle>
              <CardDescription>Departamentos que pertenecen a esta familia</CardDescription>
            </div>
            <Button size="sm" onClick={openCreateDept}>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo departamento
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {departments.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Building className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No hay departamentos en esta familia</p>
              <Button size="sm" variant="outline" className="mt-3" onClick={openCreateDept}>
                <Plus className="h-4 w-4 mr-2" />
                Crear primer departamento
              </Button>
            </div>
          ) : (
            <div className="divide-y">
              {departments.map((dept) => (
                <div
                  key={dept.id}
                  className="flex items-center justify-between px-6 py-3 hover:bg-muted/40 cursor-pointer transition-colors"
                  onClick={() => openEditDept(dept)}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: dept.color || '#3B82F6' }}
                    />
                    <div>
                      <p className="text-sm font-medium">{dept.name}</p>
                      {dept.description && (
                        <p className="text-xs text-muted-foreground">{dept.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                    {dept._count && (
                      <span className="text-xs text-muted-foreground mr-2">
                        {dept._count.users ?? 0} usuarios
                      </span>
                    )}
                    <Badge variant={dept.isActive ? 'default' : 'secondary'} className="text-xs">
                      {dept.isActive ? 'Activo' : 'Inactivo'}
                    </Badge>
                    <Button
                      variant="ghost" size="sm" className="h-7 w-7 p-0"
                      onClick={() => openEditDept(dept)}
                      title="Editar"
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost" size="sm" className="h-7 w-7 p-0"
                      onClick={() => handleToggleDept(dept)}
                      disabled={togglingDept === dept.id}
                      title={dept.isActive ? 'Desactivar' : 'Activar'}
                    >
                      {dept.isActive
                        ? <ToggleRight className="h-3.5 w-3.5 text-green-600" />
                        : <ToggleLeft className="h-3.5 w-3.5 text-muted-foreground" />}
                    </Button>
                    <Button
                      variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                      onClick={() => { setDeletingDept(dept); setShowDeleteDeptDialog(true) }}
                      title="Eliminar"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Department dialogs */}
      <DepartmentFormDialog
        open={showDeptDialog}
        onOpenChange={setShowDeptDialog}
        editingDepartment={editingDept}
        formData={deptForm}
        setFormData={setDeptForm}
        onSubmit={handleSubmitDept}
        submitting={submittingDept}
        departments={departments}
      />

      <AlertDialog open={showDeleteDeptDialog} onOpenChange={setShowDeleteDeptDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar departamento?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingDept && (
                <>
                  Estás a punto de eliminar{' '}
                  <span className="font-semibold text-foreground">"{deletingDept.name}"</span>.
                  {(deletingDept._count?.users ?? 0) > 0 && (
                    <p className="mt-2 text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded p-2">
                      Este departamento tiene {deletingDept._count?.users} usuario(s) asignado(s). No se podrá eliminar.
                    </p>
                  )}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteDept}
              className="bg-red-600 hover:bg-red-700"
              disabled={deletingDeptLoading}
            >
              {deletingDeptLoading ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
