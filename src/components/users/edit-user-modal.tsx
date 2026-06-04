'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { AlertTriangle, Save, User, XCircle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { UserData } from '@/hooks/use-users'
import { UnassignConfirmDialog } from '@/components/users/unassign-confirm-dialog'
import { UserHeaderCard } from '@/components/users/edit-modal/UserHeaderCard'
import { UserPersonalDataSection } from '@/components/users/edit-modal/UserPersonalDataSection'
import { UserSecuritySection } from '@/components/users/edit-modal/UserSecuritySection'
import { RoleAndDeptSection } from '@/components/users/edit-modal/RoleAndDeptSection'
import { PermissionsAndModulesSection } from '@/components/users/edit-modal/PermissionsAndModulesSection'
import { validateUserForm, useUserAvatarHandler } from './user-utils'
import { useFamilyAssignments } from './edit-modal/useFamilyAssignments'
import type { ModuleBlocker } from '@/lib/services/user-module-guard.service'

interface EditUserModalProps {
  isOpen: boolean
  onClose: () => void
  onUserUpdated: () => void
  user: UserData | null
  departments: Array<{ id: string; name: string; color: string }>
}

interface EditUserData {
  name: string
  email: string
  role: 'ADMIN' | 'TECHNICIAN' | 'CLIENT'
  departmentId: string
  phone: string
  isActive: boolean
  canManageInventory: boolean
  canRequestAssets: boolean
  ticketsEnabled: boolean
  inventoryEnabled: boolean
  patrolsEnabled: boolean
  newsEnabled: boolean
  canManageNews: boolean
  formsEnabled: boolean
  canManageForms: boolean
  isSuperAdmin: boolean
  avatar?: File
}

export function EditUserModal({
  isOpen,
  onClose,
  onUserUpdated,
  user,
  departments,
}: EditUserModalProps) {
  const { data: session } = useSession()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [isLocked, setIsLocked] = useState(false)
  const [moduleBlockers, setModuleBlockers] = useState<ModuleBlocker[] | null>(null)
  const { handleAvatarChange } = useUserAvatarHandler()

  const [formData, setFormData] = useState<EditUserData>({
    name: '',
    email: '',
    role: 'CLIENT',
    departmentId: '',
    phone: '',
    isActive: true,
    canManageInventory: false,
    canRequestAssets: false,
    ticketsEnabled: true,
    inventoryEnabled: false,
    patrolsEnabled: false,
    newsEnabled: false,
    canManageNews: false,
    formsEnabled: false,
    canManageForms: false,
    isSuperAdmin: false,
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  const {
    // Estados
    allFamilies,
    ticketFamilies,
    inventoryFamilies,
    patrolFamilies,
    technicianFamilyIds,
    clientFamilyIds,
    inventoryFamilyIds,
    patrolFamilyIds,
    adminFamilyIds,
    adminScopeIds,
    loadingFamilies,
    familyError,
    confirmUnassign,
    pendingUnassignFamilyId,

    // Read-only ids
    ticketReadOnlyIds,
    inventoryReadOnlyIds,
    patrolReadOnlyIds,
    adminScopeReadOnlyIds,

    // Handlers
    handleAssignTechnicianFamily,
    handleUnassignTechnicianFamily,
    handleConfirmUnassignTechnician,
    handleAssignClientFamily,
    handleUnassignClientFamily,
    handleAssignInventoryFamily,
    handleUnassignInventoryFamily,
    handleAssignPatrolFamily,
    handleUnassignPatrolFamily,
    handleAssignAdminFamily,
    handleUnassignAdminFamily,
    setConfirmUnassign,
    setPendingUnassignFamilyId,
  } = useFamilyAssignments({ user, isOpen })

  const showApiError = (title: string, result: any, fallback?: string) => {
    toast({
      title,
      description: result.error || result.message || fallback,
      variant: 'destructive',
    })
  }

  useEffect(() => {
    if (user && isOpen) {
      setFormData({
        name: user.name,
        email: user.email,
        role: user.role,
        departmentId:
          typeof user.department === 'object' ? user.department?.id || '' : user.department || '',
        phone: user.phone || '',
        isActive: user.isActive,
        canManageInventory: (user as any).canManageInventory ?? false,
        canRequestAssets: (user as any).canRequestAssets ?? false,
        ticketsEnabled: (user as any).ticketsEnabled ?? true,
        inventoryEnabled: (user as any).inventoryEnabled ?? false,
        patrolsEnabled: (user as any).patrolsEnabled ?? false,
        newsEnabled: (user as any).newsEnabled ?? false,
        canManageNews: (user as any).canManageNews ?? false,
        formsEnabled: (user as any).formsEnabled ?? false,
        canManageForms: (user as any).canManageForms ?? false,
        isSuperAdmin: user.isSuperAdmin ?? false,
        avatar: undefined,
      })
      setAvatarPreview(user.avatar || null)
      setErrors({})
      setIsLocked(false)
      fetch(`/api/users/${user.id}/reset-password`, { method: 'GET' })
        .then(r => r.json())
        .then(data => setIsLocked(data.isLocked || false))
        .catch(() => {})
    }
  }, [user, isOpen])

  const handleClose = () => {
    setErrors({})
    setAvatarPreview(null)
    onClose()
  }

  const handleResetPassword = async (newPassword: string) => {
    if (!user || newPassword.length < 6) return
    const res = await fetch(`/api/users/${user.id}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPassword }),
    })
    const result = await res.json()
    if (res.ok && result.success) {
      toast({ title: 'Contraseña actualizada', description: result.message })
    } else {
      showApiError('Error al resetear contraseña', result)
    }
  }

  const handleUnlockAccess = async () => {
    if (!user) return
    const res = await fetch(`/api/users/${user.id}/reset-password`, { method: 'DELETE' })
    const result = await res.json()
    if (res.ok && result.success) {
      toast({ title: 'Acceso desbloqueado', description: result.message })
      setIsLocked(false)
    } else {
      showApiError('Error al desbloquear', result)
    }
  }

  const handleDeleteAvatar = async () => {
    if (!user) return
    try {
      const res = await fetch(`/api/users/${user.id}/avatar`, { method: 'DELETE' })
      const result = await res.json()
      if (res.ok && result.success) {
        setAvatarPreview(null)
        setFormData(p => ({ ...p, avatar: undefined }))
        toast({ title: 'Avatar eliminado' })
        onUserUpdated()
      } else {
        showApiError('Error al eliminar avatar', result)
      }
    } catch {
      toast({ title: 'Error de conexión', variant: 'destructive' })
    }
  }

  const onAvatarFileSelect = (file: File) => {
    setFormData(p => ({ ...p, avatar: file }))
  }

  const onAvatarPreviewUpdate = (preview: string) => {
    setAvatarPreview(preview)
  }

  const handleSubmit = async () => {
    if (!user) return
    const { isValid, errors: validationErrors } = validateUserForm(formData)
    if (!isValid) {
      setErrors(validationErrors)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          email: formData.email.trim().toLowerCase(),
          role: formData.role,
          departmentId: formData.departmentId || null,
          phone: formData.phone.trim() || null,
          isActive: formData.isActive,
          canManageInventory: formData.canManageInventory,
          canRequestAssets: formData.canRequestAssets,
          ticketsEnabled: formData.ticketsEnabled,
          inventoryEnabled: formData.inventoryEnabled,
          patrolsEnabled: formData.patrolsEnabled,
          newsEnabled: formData.newsEnabled,
          canManageNews: formData.canManageNews,
          formsEnabled: formData.formsEnabled,
          canManageForms: formData.canManageForms,
          isSuperAdmin: formData.role === 'ADMIN' ? formData.isSuperAdmin : false,
        }),
      })
      const result = await res.json()
      if (res.ok && result.success) {
        if (formData.avatar) {
          const fd = new FormData()
          fd.append('avatar', formData.avatar)
          await fetch(`/api/users/${user.id}/avatar`, { method: 'POST', body: fd })
        }
        toast({
          title: 'Usuario actualizado',
          description: `${formData.name} actualizado correctamente`,
        })
        void fetch(`/api/user/modules?userId=${user.id}&_t=${Date.now()}`, {
          headers: { 'Cache-Control': 'no-cache' },
        })
        window.dispatchEvent(new CustomEvent('modules-updated'))
        handleClose()
        onUserUpdated()
      } else {
        // Caso especial: módulos bloqueados por trabajo activo
        if (res.status === 422 && result.blockers && Array.isArray(result.blockers)) {
          setModuleBlockers(result.blockers as ModuleBlocker[])
          return
        }
        if (
          res.status === 409 &&
          (result.error || result.message)?.toLowerCase().includes('email')
        ) {
          setErrors(p => ({ ...p, email: 'Este email ya está registrado' }))
        }
        showApiError('Error al actualizar usuario', result)
      }
    } catch {
      toast({ title: 'Error de conexión', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const isCurrentUser = user?.id === session?.user?.id

  const handlePersonalDataChange = (field: keyof EditUserData, value: string) => {
    setFormData(p => ({ ...p, [field]: value }))
  }

  const handleRoleDeptChange = (field: 'role' | 'departmentId', value: string) => {
    setFormData(p => ({ ...p, [field]: value }))
  }

  const handleToggle = (
    field:
      | 'isActive'
      | 'isSuperAdmin'
      | 'ticketsEnabled'
      | 'inventoryEnabled'
      | 'patrolsEnabled'
      | 'newsEnabled'
      | 'canManageNews'
      | 'formsEnabled'
      | 'canManageForms'
      | 'canManageInventory'
      | 'canRequestAssets',
    value: boolean
  ) => {
    if (field === 'inventoryEnabled') {
      setFormData(p => ({
        ...p,
        inventoryEnabled: value,
        canManageInventory: p.role === 'TECHNICIAN' ? value : p.canManageInventory,
      }))
    } else if (field === 'newsEnabled') {
      setFormData(p => ({
        ...p,
        newsEnabled: value,
        // Al desactivar noticias se limpia canManageNews automáticamente
        canManageNews: value ? p.canManageNews : false,
      }))
    } else if (field === 'formsEnabled') {
      setFormData(p => ({
        ...p,
        formsEnabled: value,
        canManageForms: false,
      }))
    } else {
      setFormData(p => ({ ...p, [field]: value }))
    }
  }

  if (!user) return null

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className='max-w-2xl max-h-[90vh]' aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2'>
              <User className='h-5 w-5 text-primary' />
              Editar Usuario
            </DialogTitle>
          </DialogHeader>

          <div className='space-y-6 overflow-y-auto max-h-[calc(90vh-80px)]'>
            <UserHeaderCard
              user={user}
              avatarPreview={avatarPreview}
              role={formData.role}
              isSuperAdmin={formData.isSuperAdmin}
              isCurrentUser={isCurrentUser}
              isLocked={isLocked}
              hasNewAvatar={!!formData.avatar}
              onAvatarChange={e => handleAvatarChange(e, onAvatarFileSelect, onAvatarPreviewUpdate)}
              onDeleteAvatar={handleDeleteAvatar}
              onResetAvatar={() => {
                setFormData(p => ({ ...p, avatar: undefined }))
                setAvatarPreview(user.avatar || null)
              }}
            />

            {isCurrentUser && (
              <div className='flex items-start gap-2 rounded-lg bg-muted/50 border px-3 py-2 text-sm text-muted-foreground'>
                <AlertTriangle className='h-4 w-4 mt-0.5 shrink-0' />
                <span>
                  Estás editando tu propia cuenta. No puedes cambiar tu rol ni desactivarla.
                </span>
              </div>
            )}

            <UserPersonalDataSection
              name={formData.name}
              email={formData.email}
              phone={formData.phone}
              errors={errors}
              onChange={handlePersonalDataChange}
            />

            <Separator />

            <RoleAndDeptSection
              role={formData.role}
              departmentId={formData.departmentId}
              isCurrentUser={isCurrentUser}
              errors={errors}
              departments={departments}
              onChange={handleRoleDeptChange}
            />

            <Separator />

            <PermissionsAndModulesSection
              user={user}
              isCurrentUser={isCurrentUser}
              formData={formData}
              loading={loading}
              loadingFamilies={loadingFamilies}
              ticketFamilies={ticketFamilies}
              inventoryFamilies={inventoryFamilies}
              patrolFamilies={patrolFamilies}
              technicianFamilyIds={technicianFamilyIds}
              clientFamilyIds={clientFamilyIds}
              inventoryFamilyIds={inventoryFamilyIds}
              patrolFamilyIds={patrolFamilyIds}
              adminFamilyIds={adminFamilyIds}
              ticketReadOnlyIds={ticketReadOnlyIds}
              inventoryReadOnlyIds={inventoryReadOnlyIds}
              patrolReadOnlyIds={patrolReadOnlyIds}
              adminScopeReadOnlyIds={adminScopeReadOnlyIds}
              onToggle={handleToggle}
              handlers={{
                handleAssignTechnicianFamily,
                handleUnassignTechnicianFamily,
                handleAssignClientFamily,
                handleUnassignClientFamily,
                handleAssignInventoryFamily,
                handleUnassignInventoryFamily,
                handleAssignPatrolFamily,
                handleUnassignPatrolFamily,
                handleAssignAdminFamily,
                handleUnassignAdminFamily,
              }}
            />

            <Separator />

            <UserSecuritySection
              isLocked={isLocked}
              onResetPassword={handleResetPassword}
              onUnlock={handleUnlockAccess}
            />

            <div className='flex justify-end gap-2 pt-2'>
              <Button type='button' variant='outline' onClick={handleClose} disabled={loading}>
                Cancelar
              </Button>
              <Button
                type='button'
                onClick={handleSubmit}
                disabled={loading || !formData.name || !formData.email}
              >
                {loading ? (
                  <>
                    <Save className='h-4 w-4 mr-2 animate-spin' />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className='h-4 w-4 mr-2' />
                    Guardar cambios
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <UnassignConfirmDialog
        open={!!confirmUnassign}
        familyName={confirmUnassign?.familyName ?? ''}
        activeTicketCount={confirmUnassign?.activeTickets ?? 0}
        onConfirm={handleConfirmUnassignTechnician}
        onCancel={() => {
          setConfirmUnassign(null)
          setPendingUnassignFamilyId(null)
        }}
      />

      {/* ── Diálogo de módulos bloqueados ── */}
      <Dialog open={!!moduleBlockers} onOpenChange={() => setModuleBlockers(null)}>
        <DialogContent className='sm:max-w-lg'>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2 text-destructive'>
              <XCircle className='h-5 w-5 shrink-0' />
              No se pueden desactivar los módulos
            </DialogTitle>
          </DialogHeader>

          <div className='space-y-4 py-1'>
            <p className='text-sm text-muted-foreground'>
              <strong>{user?.name}</strong> tiene trabajo activo en los siguientes módulos. Resuelve
              cada punto antes de intentar desactivarlos.
            </p>

            <div className='space-y-3 max-h-[55vh] overflow-y-auto pr-1'>
              {moduleBlockers?.map((blocker, i) => (
                <div
                  key={i}
                  className='rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-2'
                >
                  {/* Módulo + razón */}
                  <div className='flex items-start gap-2'>
                    <AlertTriangle className='h-4 w-4 text-destructive mt-0.5 shrink-0' />
                    <div>
                      <p className='text-sm font-semibold text-foreground'>{blocker.module}</p>
                      <p className='text-sm text-destructive'>{blocker.reason}</p>
                    </div>
                  </div>

                  {/* Instrucciones paso a paso */}
                  <ul className='space-y-1 pl-6'>
                    {blocker.instructions.map((step, j) => (
                      <li
                        key={j}
                        className='flex items-start gap-1.5 text-xs text-muted-foreground'
                      >
                        <span className='mt-0.5 shrink-0 text-muted-foreground/60'>{j + 1}.</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className='rounded-lg bg-muted/50 border px-3 py-2 text-xs text-muted-foreground'>
              Una vez resueltos todos los puntos, vuelve a guardar los cambios del usuario.
            </div>
          </div>

          <div className='flex justify-end pt-1'>
            <Button onClick={() => setModuleBlockers(null)}>Entendido</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
