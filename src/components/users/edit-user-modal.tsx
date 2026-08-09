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
import { ModuleBlockersDialog } from './module-blockers-dialog'
import type { ModuleBlocker } from '@/lib/services/user-module-guard.service'

interface EditUserModalProps {
  isOpen: boolean
  onClose: () => void
  onUserUpdated: () => void
  user: UserData | null
  departments: Array<{
    id: string
    name: string
    color?: string | null
    familyId?: string | null
    family?: {
      id: string
      name: string
      code: string
      color?: string | null
    } | null
  }>
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
  credentialsEnabled: boolean
  canManageCredentials: boolean
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
  const [blockersContext, setBlockersContext] = useState<'module' | 'role'>('module')
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
    credentialsEnabled: false,
    canManageCredentials: false,
    isSuperAdmin: false,
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  const {
    // Estados
    allFamilies,
    ticketFamilies,
    inventoryFamilies,
    patrolFamilies,
    credentialsFamilies,
    technicianFamilyIds,
    clientFamilyIds,
    inventoryFamilyIds,
    patrolFamilyIds,
    credentialsFamilyIds,
    adminFamilyIds,
    contentFamilyIds,
    adminScopeIds,
    loadingFamilies,
    familyError,
    confirmUnassign,
    pendingUnassignFamilyId,

    // Read-only ids
    ticketReadOnlyIds,
    inventoryReadOnlyIds,
    patrolReadOnlyIds,
    credentialsReadOnlyIds,
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
    handleAssignCredentialsFamily,
    handleUnassignCredentialsFamily,
    handleAssignAdminFamily,
    handleUnassignAdminFamily,
    handleAssignContentFamily,
    handleUnassignContentFamily,
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
        credentialsEnabled: (user as any).credentialsEnabled ?? false,
        canManageCredentials: (user as any).canManageCredentials ?? false,
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
          credentialsEnabled: formData.credentialsEnabled,
          canManageCredentials: formData.canManageCredentials,
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
        // Caso especial: módulos bloqueados o cambio de rol bloqueado por trabajo activo
        if (res.status === 422 && result.blockers && Array.isArray(result.blockers)) {
          const ctx = result.context === 'role' ? 'role' : 'module'
          setBlockersContext(ctx)
          setModuleBlockers(result.blockers as ModuleBlocker[])

          // Toast conciso que explica el motivo antes de que el usuario lea el diálogo
          const totalBlockers = (result.blockers as ModuleBlocker[]).reduce(
            (sum: number, b: ModuleBlocker) => sum + b.count,
            0
          )
          const moduleNames = [
            ...new Set((result.blockers as ModuleBlocker[]).map((b: ModuleBlocker) => b.module)),
          ].join(', ')
          toast({
            title:
              ctx === 'role' ? 'No se puede cambiar el rol' : 'No se pueden desactivar los módulos',
            description:
              ctx === 'role'
                ? `${user?.name} tiene ${totalBlockers} elemento${totalBlockers !== 1 ? 's' : ''} pendiente${totalBlockers !== 1 ? 's' : ''} en: ${moduleNames}. Resuélvelos antes de cambiar el rol.`
                : `${user?.name} tiene ${totalBlockers} elemento${totalBlockers !== 1 ? 's' : ''} activo${totalBlockers !== 1 ? 's' : ''} en: ${moduleNames}. Resuélvelos antes de desactivar.`,
            variant: 'destructive',
            duration: 6000,
          })
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
      | 'credentialsEnabled'
      | 'canManageCredentials'
      | 'canManageInventory'
      | 'canRequestAssets',
    value: boolean
  ) => {
    if (field === 'inventoryEnabled') {
      setFormData(p => ({
        ...p,
        inventoryEnabled: value,
        // TECHNICIAN: al activar inventario, activa gestión completa automáticamente
        canManageInventory: p.role === 'TECHNICIAN' ? value : p.canManageInventory,
        // ADMIN normal: al activar inventario, activa ambos permisos automáticamente
        ...(p.role === 'ADMIN' ? { canManageInventory: value, canRequestAssets: value } : {}),
      }))
    } else if (field === 'newsEnabled') {
      setFormData(p => ({
        ...p,
        newsEnabled: value,
        // Desactivar módulo → quita permiso de crear. Activar módulo ≠ crear.
        canManageNews: value ? p.canManageNews : false,
      }))
    } else if (field === 'formsEnabled') {
      setFormData(p => ({
        ...p,
        formsEnabled: value,
        // Desactivar módulo → quita permiso de crear. Activar módulo ≠ crear.
        canManageForms: value ? p.canManageForms : false,
      }))
    } else if (field === 'credentialsEnabled') {
      setFormData(p => ({
        ...p,
        credentialsEnabled: value,
        canManageCredentials: value ? p.canManageCredentials : false,
      }))
    } else {
      setFormData(p => ({ ...p, [field]: value }))
    }
  }

  if (!user) return null

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent
          className='w-[calc(100%-1.5rem)] max-w-3xl lg:max-w-4xl max-h-[92vh] p-4 sm:p-6'
          aria-describedby={undefined}
        >
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2 text-base sm:text-lg'>
              <User className='h-5 w-5 text-primary' />
              Editar Usuario
            </DialogTitle>
          </DialogHeader>

          <form
            onSubmit={e => {
              e.preventDefault()
              void handleSubmit()
            }}
          >
            <div className='space-y-6 overflow-y-auto max-h-[calc(92vh-88px)] pr-1'>
              <UserHeaderCard
                user={user}
                avatarPreview={avatarPreview}
                role={formData.role}
                isSuperAdmin={formData.isSuperAdmin}
                isCurrentUser={isCurrentUser}
                isLocked={isLocked}
                hasNewAvatar={!!formData.avatar}
                onAvatarChange={e =>
                  handleAvatarChange(e, onAvatarFileSelect, onAvatarPreviewUpdate)
                }
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
                departments={departments}
                allFamilies={allFamilies}
                loading={loading}
                loadingFamilies={loadingFamilies}
                ticketFamilies={ticketFamilies}
                inventoryFamilies={inventoryFamilies}
                patrolFamilies={patrolFamilies}
                credentialsFamilies={credentialsFamilies}
                technicianFamilyIds={technicianFamilyIds}
                clientFamilyIds={clientFamilyIds}
                inventoryFamilyIds={inventoryFamilyIds}
                patrolFamilyIds={patrolFamilyIds}
                credentialsFamilyIds={credentialsFamilyIds}
                adminFamilyIds={adminFamilyIds}
                contentFamilyIds={contentFamilyIds}
                ticketReadOnlyIds={ticketReadOnlyIds}
                inventoryReadOnlyIds={inventoryReadOnlyIds}
                patrolReadOnlyIds={patrolReadOnlyIds}
                credentialsReadOnlyIds={credentialsReadOnlyIds}
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
                  handleAssignCredentialsFamily,
                  handleUnassignCredentialsFamily,
                  handleAssignAdminFamily,
                  handleUnassignAdminFamily,
                  handleAssignContentFamily,
                  handleUnassignContentFamily,
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
                <Button type='submit' disabled={loading || !formData.name || !formData.email}>
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
          </form>
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
      <ModuleBlockersDialog
        open={!!moduleBlockers}
        onClose={() => {
          setModuleBlockers(null)
          setBlockersContext('module')
        }}
        userName={user?.name ?? ''}
        userId={user?.id}
        blockers={moduleBlockers ?? []}
        context={blockersContext}
      />
    </>
  )
}
