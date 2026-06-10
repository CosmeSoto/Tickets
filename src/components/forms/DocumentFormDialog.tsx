'use client'

/**
 * DocumentFormDialog — Formulario unificado de crear/editar documentos
 * Usado en: /app/forms/page.tsx (usuarios) y /app/admin/forms/page.tsx (admin)
 *
 * Diferencias controladas por props:
 * - showAdvancedCollapsed: true = Resumen/Versión en acordeón colapsable (página usuario)
 *                          false = Resumen/Versión siempre visibles (página admin)
 */

import { useState, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { InlineCreateSelect } from '@/components/ui/inline-create-select'
import { FormCategoryInlineForm } from '@/components/forms/FormCategoryInlineForm'
import { FileDropZone } from '@/components/common/file-drop-zone'
import type { PendingFile } from '@/components/common/file-drop-zone'
import { MediaUrlInput } from '@/components/common/media-url-input'
import { VisibilitySelector } from '@/components/common/visibility-selector'

export interface DocumentFormData {
  title: string
  description: string
  summary: string
  version: string
  categoryId: string
  fileUrl: string
  fileSize: number | null
  fileType: string
  isActive: boolean
  isFeatured: boolean
  roles: string[]
  userIds: string[]
  departmentIds: string[]
  familyIds: string[]
}

export const EMPTY_DOCUMENT_FORM: DocumentFormData = {
  title: '',
  description: '',
  summary: '',
  version: '',
  categoryId: '',
  fileUrl: '',
  fileSize: null,
  fileType: '',
  isActive: true,
  isFeatured: false,
  roles: [],
  userIds: [],
  departmentIds: [],
  familyIds: [],
}

interface CategoryOption {
  id: string
  name: string
  description?: string | null
}
interface UserOption {
  id: string
  name: string
  email: string
}
interface DepartmentOption {
  id: string
  name: string
  familyId?: string | null
}
interface FamilyOption {
  id: string
  name: string
  departments: DepartmentOption[]
}

interface DocumentFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  formData: DocumentFormData
  setFormData: (updater: (prev: DocumentFormData) => DocumentFormData) => void
  pendingFiles: PendingFile[]
  setPendingFiles: (files: PendingFile[]) => void
  editingForm: {
    fileUrl?: string | null
    fileSize?: number | null
    fileType?: string | null
  } | null
  categories: CategoryOption[]
  users: UserOption[]
  families: FamilyOption[]
  saving: boolean
  onSubmit: (e: React.FormEvent) => void
  onDeleteCategory: (id: string) => Promise<void>
  onLoadCategories: () => void
  /** true = Resumen/Versión en acordeón colapsable; false = siempre visibles */
  collapseAdvanced?: boolean
  usersHint?: string
}

export function DocumentFormDialog({
  open,
  onOpenChange,
  formData,
  setFormData,
  pendingFiles,
  setPendingFiles,
  editingForm,
  categories,
  users,
  families,
  saving,
  onSubmit,
  onDeleteCategory,
  onLoadCategories,
  collapseAdvanced = false,
  usersHint,
}: DocumentFormDialogProps) {
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Si el formulario ya tiene summary o version (modo edición), abrir el acordeón automáticamente
  useEffect(() => {
    if (open && collapseAdvanced && (formData.summary || formData.version)) {
      setShowAdvanced(true)
    }
    if (!open) {
      setShowAdvanced(false)
    }
  }, [open, collapseAdvanced, formData.summary, formData.version])

  const handleClose = () => {
    setShowAdvanced(false)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className='sm:max-w-3xl max-h-[90vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>{editingForm ? 'Editar documento' : 'Nuevo documento'}</DialogTitle>
          <DialogDescription>
            Complete la información para {editingForm ? 'actualizar' : 'crear'} el documento o
            formulario que los colaboradores utilizarán para gestionar solicitudes y procesos
            internos.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} onClick={e => e.stopPropagation()} className='space-y-4'>
          <div className='space-y-4'>
            {/* Título */}
            <div className='space-y-2'>
              <Label>
                Título <span className='text-destructive'>*</span>
              </Label>
              <Input
                placeholder='Ej: Solicitud de permiso laboral'
                required
                value={formData.title}
                onChange={e => setFormData(p => ({ ...p, title: e.target.value }))}
              />
            </div>

            {/* Descripción */}
            <div className='space-y-2'>
              <Label>Descripción</Label>
              <Textarea
                value={formData.description}
                onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
                rows={2}
              />
            </div>

            {/* Resumen y Versión — colapsables o siempre visibles */}
            {collapseAdvanced ? (
              <>
                <button
                  type='button'
                  onClick={() => setShowAdvanced(v => !v)}
                  className='flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors'
                >
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
                  />
                  Opciones avanzadas
                  {(formData.summary || formData.version) && (
                    <span className='ml-1 rounded bg-primary/10 text-primary px-1.5 py-0.5 text-[10px] font-medium'>
                      con datos
                    </span>
                  )}
                </button>
                {showAdvanced && (
                  <div className='grid grid-cols-2 gap-4 rounded-lg border bg-muted/30 p-3'>
                    <div className='space-y-2'>
                      <Label className='text-xs'>Resumen</Label>
                      <Input
                        value={formData.summary}
                        onChange={e => setFormData(p => ({ ...p, summary: e.target.value }))}
                        placeholder='Breve descripción adicional...'
                        className='h-8 text-sm'
                      />
                    </div>
                    <div className='space-y-2'>
                      <Label className='text-xs'>Versión</Label>
                      <Input
                        value={formData.version}
                        onChange={e => setFormData(p => ({ ...p, version: e.target.value }))}
                        placeholder='v1.0'
                        className='h-8 text-sm'
                      />
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className='grid grid-cols-2 gap-4'>
                <div className='space-y-2'>
                  <Label>Resumen (opcional)</Label>
                  <Input
                    value={formData.summary}
                    onChange={e => setFormData(p => ({ ...p, summary: e.target.value }))}
                  />
                </div>
                <div className='space-y-2'>
                  <Label>Versión (opcional)</Label>
                  <Input
                    value={formData.version}
                    onChange={e => setFormData(p => ({ ...p, version: e.target.value }))}
                    placeholder='v1.0'
                  />
                </div>
              </div>
            )}

            {/* Categoría */}
            <div className='space-y-2'>
              <Label>
                Categoría <span className='text-destructive'>*</span>
              </Label>
              <InlineCreateSelect
                options={categories.map(c => ({
                  id: c.id,
                  name: c.name,
                  description: c.description ?? undefined,
                }))}
                value={formData.categoryId}
                onChange={v => setFormData(p => ({ ...p, categoryId: v }))}
                placeholder='Seleccionar categoría'
                createLabel='Crear categoría'
                createTitle='Crear categoría'
                editTitle='Editar categoría'
                allowClear
                createForm={FormCategoryInlineForm}
                onDelete={onDeleteCategory}
                deleteConfirmMessage='¿Eliminar esta categoría? Los documentos asociados quedarán sin categoría.'
                onAfterSave={onLoadCategories}
              />
            </div>

            {/* Archivo */}
            <div className='space-y-2'>
              <Label>Archivo</Label>
              <div className='space-y-3'>
                {editingForm?.fileUrl && pendingFiles.length === 0 && (
                  <div className='flex items-center gap-3 p-3 rounded-lg border bg-muted/30'>
                    <span className='text-xl'>📄</span>
                    <div className='flex-1 min-w-0'>
                      <p className='text-sm font-medium truncate'>
                        {editingForm.fileType || 'Archivo adjunto'}
                      </p>
                      {editingForm.fileSize && (
                        <p className='text-xs text-muted-foreground'>
                          {editingForm.fileSize < 1024 * 1024
                            ? `${(editingForm.fileSize / 1024).toFixed(1)} KB`
                            : `${(editingForm.fileSize / (1024 * 1024)).toFixed(1)} MB`}
                        </p>
                      )}
                    </div>
                    <div className='flex gap-2 flex-shrink-0'>
                      <Button
                        type='button'
                        variant='outline'
                        size='sm'
                        onClick={() => window.open(editingForm.fileUrl!, '_blank')}
                      >
                        Ver
                      </Button>
                      <Button
                        type='button'
                        variant='ghost'
                        size='sm'
                        className='text-destructive hover:text-destructive'
                        onClick={() =>
                          setFormData(p => ({ ...p, fileUrl: '', fileSize: null, fileType: '' }))
                        }
                      >
                        Quitar
                      </Button>
                    </div>
                  </div>
                )}
                <FileDropZone
                  pendingFiles={pendingFiles}
                  onPendingFilesChange={files => {
                    setPendingFiles(files)
                    if (files.length > 0) {
                      const f = files[0].file
                      setFormData(p => ({ ...p, fileUrl: '', fileSize: f.size, fileType: f.type }))
                    } else {
                      setFormData(p => ({
                        ...p,
                        fileUrl: editingForm?.fileUrl || '',
                        fileSize: editingForm?.fileSize ?? null,
                        fileType: editingForm?.fileType || '',
                      }))
                    }
                  }}
                  maxFiles={1}
                  acceptLabel='PDF, Word, Excel, imágenes'
                  accept='.pdf,.doc,.docx,.xls,.xlsx,image/*'
                  allowedTypes={[
                    'application/pdf',
                    'application/msword',
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    'application/vnd.ms-excel',
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'image/jpeg',
                    'image/jpg',
                    'image/png',
                    'image/gif',
                    'image/webp',
                  ]}
                />
                {pendingFiles.length === 0 && !editingForm?.fileUrl && (
                  <MediaUrlInput
                    label=''
                    value={formData.fileUrl}
                    onChange={v => setFormData(p => ({ ...p, fileUrl: v }))}
                    placeholder='O pega una URL externa (Google Drive, OneDrive, Dropbox, PDF...)'
                    optional={false}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Switches */}
          <div className='flex items-center gap-6 pt-2'>
            <div className='flex items-center gap-2'>
              <Switch
                checked={formData.isActive}
                onCheckedChange={v => setFormData(p => ({ ...p, isActive: v }))}
              />
              <Label>Activo</Label>
            </div>
            <div className='flex items-center gap-2'>
              <Switch
                checked={formData.isFeatured}
                onCheckedChange={v => setFormData(p => ({ ...p, isFeatured: v }))}
              />
              <Label>Destacado</Label>
            </div>
          </div>

          <Separator />

          {/* Visibilidad */}
          <VisibilitySelector
            families={families}
            users={users}
            selectedRoles={formData.roles}
            selectedFamilyIds={formData.familyIds}
            selectedDepartmentIds={formData.departmentIds}
            selectedUserIds={formData.userIds}
            onRolesChange={roles => setFormData(p => ({ ...p, roles }))}
            onFamilyIdsChange={familyIds => setFormData(p => ({ ...p, familyIds }))}
            onDepartmentIdsChange={departmentIds => setFormData(p => ({ ...p, departmentIds }))}
            onUserIdsChange={userIds => setFormData(p => ({ ...p, userIds }))}
            usersHint={usersHint}
          />

          <DialogFooter>
            <Button type='button' variant='outline' onClick={handleClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type='submit' disabled={saving}>
              {saving ? 'Guardando...' : editingForm ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
