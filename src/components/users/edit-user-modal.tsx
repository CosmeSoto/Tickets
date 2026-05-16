'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { AlertTriangle, Activity, Building, ShieldCheck, Save, User } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { UserData } from '@/hooks/use-users'
import { USER_ROLE_FORM_OPTIONS, type UserRole } from '@/lib/constants/user-constants'
import { DepartmentSelector } from '@/components/ui/department-selector'
import { Switch } from '@/components/ui/switch'
import { extractApiError, extractCatchError } from '@/lib/utils/api-error'
import {
  FamilyAssignmentSection,
  type FamilyOption,
} from '@/components/users/family-assignment-section'
import { UnassignConfirmDialog } from '@/components/users/unassign-confirm-dialog'
import { UserModulesPanel } from '@/components/users/user-modules-panel'
import { ModuleAccessCard } from '@/components/users/module-access-card'
import { UserHeaderCard } from '@/components/users/edit-modal/UserHeaderCard'
import { UserPersonalDataSection } from '@/components/users/edit-modal/UserPersonalDataSection'
import { UserSecuritySection } from '@/components/users/edit-modal/UserSecuritySection'
import { validateUserForm, useUserAvatarHandler } from './user-utils'
import { useSystemModules } from '@/hooks/use-system-modules'

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
  role: UserRole
  departmentId: string
  phone: string
  isActive: boolean
  canManageInventory: boolean
  canRequestAssets: boolean
  ticketsEnabled: boolean
  inventoryEnabled: boolean
  patrolsEnabled: boolean
  isSuperAdmin: boolean
  avatar?: File
}

// ── Panel de módulos del usuario ─────────────────────────────────────────

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
    isSuperAdmin: false,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  // ── Family assignment state ──────────────────────────────────────────────
  const [allFamilies, setAllFamilies] = useState<FamilyOption[]>([])
  const [loadingFamilies, setLoadingFamilies] = useState(false)
  const [familyError, setFamilyError] = useState<string | null>(null)
  const [technicianFamilyIds, setTechnicianFamilyIds] = useState<string[]>([])
  const [clientFamilyIds, setClientFamilyIds] = useState<string[]>([])
  const [inventoryFamilyIds, setInventoryFamilyIds] = useState<string[]>([])
  const [patrolFamilyIds, setPatrolFamilyIds] = useState<string[]>([])
  const [adminFamilyIds, setAdminFamilyIds] = useState<string[]>([])
  const [adminScopeIds, setAdminScopeIds] = useState<string[]>([]) // viewer's own families
  const [confirmUnassign, setConfirmUnassign] = useState<{
    familyId: string
    familyName: string
    activeTickets: number
  } | null>(null)
  const [pendingUnassignFamilyId, setPendingUnassignFamilyId] = useState<string | null>(null)

  const showApiError = (title: string, result: any, fallback?: string) => {
    toast({ title, description: extractApiError(result, fallback), variant: 'destructive' })
  }
  const showNetworkError = (err: unknown) => {
    toast({
      title: 'Error de conexión',
      description: extractCatchError(err),
      variant: 'destructive',
    })
  }

  // ── Family assignment handlers ───────────────────────────────────────────

  const invalidateModulesCache = () => {
    if (!user) return
    void fetch(`/api/user/modules?userId=${user.id}&_t=${Date.now()}`, {
      headers: { 'Cache-Control': 'no-cache' },
    })
    window.dispatchEvent(new CustomEvent('modules-updated'))
  }

  // Compute read-only family IDs for ADMIN-scoped viewers
  const adminScopeReadOnlyIds = (() => {
    const viewerIsAdmin = session?.user?.role === 'ADMIN' && !session?.user?.isSuperAdmin
    if (!viewerIsAdmin || adminScopeIds.length === 0) return []
    // Families assigned to the user but NOT in viewer's scope
    const allAssigned = [...technicianFamilyIds, ...clientFamilyIds, ...inventoryFamilyIds]
    return allAssigned.filter(id => !adminScopeIds.includes(id))
  })()

  // TECHNICIAN handlers
  const handleAssignTechnicianFamily = async (familyId: string) => {
    if (!user) return
    const res = await fetch(`/api/admin/users/${user.id}/families/technician`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ familyId }),
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.message ?? 'Error al asignar familia')
    }
    setTechnicianFamilyIds(prev => [...prev, familyId])
    invalidateModulesCache()
  }

  const handleUnassignTechnicianFamily = async (
    familyId: string
  ): Promise<{ requiresConfirmation?: boolean; activeTickets?: number } | void> => {
    if (!user) return
    const res = await fetch(`/api/admin/users/${user.id}/families/technician/${familyId}`, {
      method: 'DELETE',
    })
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.message ?? 'Error al desasignar familia')
    }
    if (data.requiresConfirmation) {
      const family = allFamilies.find(f => f.id === familyId)
      setPendingUnassignFamilyId(familyId)
      setConfirmUnassign({
        familyId,
        familyName: family?.name ?? familyId,
        activeTickets: data.activeTickets ?? 0,
      })
      return { requiresConfirmation: true, activeTickets: data.activeTickets }
    }
    setTechnicianFamilyIds(prev => prev.filter(id => id !== familyId))
    invalidateModulesCache()
  }

  const handleConfirmUnassignTechnician = async () => {
    if (!user || !pendingUnassignFamilyId) return
    const familyId = pendingUnassignFamilyId
    setConfirmUnassign(null)
    setPendingUnassignFamilyId(null)
    try {
      const res = await fetch(
        `/api/admin/users/${user.id}/families/technician/${familyId}?force=true`,
        { method: 'DELETE' }
      )
      if (!res.ok) {
        const data = await res.json()
        setFamilyError(data.message ?? 'Error al desasignar familia')
        return
      }
      setTechnicianFamilyIds(prev => prev.filter(id => id !== familyId))
      invalidateModulesCache()
    } catch {
      setFamilyError('Error al desasignar familia')
    }
  }

  // CLIENT handlers
  const handleAssignClientFamily = async (familyId: string) => {
    if (!user) return
    const res = await fetch(`/api/admin/users/${user.id}/families/client`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ familyId }),
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.message ?? 'Error al asignar familia')
    }
    setClientFamilyIds(prev => [...prev, familyId])
    invalidateModulesCache()
  }

  const handleUnassignClientFamily = async (familyId: string) => {
    if (!user) return
    const res = await fetch(`/api/admin/users/${user.id}/families/client/${familyId}`, {
      method: 'DELETE',
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.message ?? 'Error al desasignar familia')
    }
    setClientFamilyIds(prev => prev.filter(id => id !== familyId))
    invalidateModulesCache()
  }

  // INVENTORY handlers (atomic replace via PUT)
  const handleAssignInventoryFamily = async (familyId: string) => {
    if (!user) return
    const newIds = [...inventoryFamilyIds, familyId]
    const res = await fetch(`/api/admin/users/${user.id}/families/inventory`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ familyIds: newIds }),
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.message ?? 'Error al asignar familia')
    }
    setInventoryFamilyIds(newIds)
    invalidateModulesCache()
  }

  const handleUnassignInventoryFamily = async (familyId: string) => {
    if (!user) return
    const newIds = inventoryFamilyIds.filter(id => id !== familyId)
    const res = await fetch(`/api/admin/users/${user.id}/families/inventory`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ familyIds: newIds }),
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.message ?? 'Error al desasignar familia')
    }
    setInventoryFamilyIds(newIds)
    invalidateModulesCache()
  }

  // PATROL handlers
  const handleAssignPatrolFamily = async (familyId: string) => {
    if (!user) return
    const res = await fetch('/api/patrol-family-assignments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, familyId }),
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error ?? 'Error al asignar familia')
    }
    setPatrolFamilyIds(prev => [...prev, familyId])
    invalidateModulesCache()
  }

  const handleUnassignPatrolFamily = async (familyId: string) => {
    if (!user) return
    const res = await fetch(
      `/api/patrol-family-assignments?userId=${user.id}&familyId=${familyId}`,
      { method: 'DELETE' }
    )
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error ?? 'Error al desasignar familia')
    }
    setPatrolFamilyIds(prev => prev.filter(id => id !== familyId))
    invalidateModulesCache()
  }

  // ADMIN handlers
  const handleAssignAdminFamily = async (familyId: string) => {
    if (!user) return
    const res = await fetch(`/api/admin/users/${user.id}/families/admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ familyId }),
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.message ?? 'Error al asignar familia')
    }
    setAdminFamilyIds(prev => [...prev, familyId])
    invalidateModulesCache()
  }

  const handleUnassignAdminFamily = async (familyId: string) => {
    if (!user) return
    const res = await fetch(`/api/admin/users/${user.id}/families/admin/${familyId}`, {
      method: 'DELETE',
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.message ?? 'Error al desasignar familia')
    }
    setAdminFamilyIds(prev => prev.filter(id => id !== familyId))
    invalidateModulesCache()
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

  // ── Fetch families and assignments when modal opens ──────────────────────
  useEffect(() => {
    if (!user || !isOpen) return

    const fetchFamiliesAndAssignments = async () => {
      setLoadingFamilies(true)
      setFamilyError(null)
      try {
        // Super Admin ve todas las familias para asignar; Admin normal ve solo las suyas
        const viewerIsSuperAdmin = (session?.user as any)?.isSuperAdmin === true
        const familyUrl = viewerIsSuperAdmin
          ? '/api/families?active=true&scope=all'
          : '/api/families?active=true'
        const familiesRes = await fetch(familyUrl)
        if (familiesRes.ok) {
          const familiesData = await familiesRes.json()
          const families = familiesData.data ?? familiesData ?? []
          setAllFamilies(families.filter((f: FamilyOption) => f.isActive))
        }

        // Fetch viewer's admin scope if viewer is ADMIN (not super)
        const viewerIsAdmin = session?.user?.role === 'ADMIN' && !session?.user?.isSuperAdmin
        if (viewerIsAdmin && session?.user?.id) {
          const scopeRes = await fetch(`/api/admin/family-assignments?adminId=${session.user.id}`)
          if (scopeRes.ok) {
            const scopeData = await scopeRes.json()
            const scopeAssignments = scopeData.data ?? []
            setAdminScopeIds(scopeAssignments.map((a: any) => a.familyId))
          }
        } else {
          setAdminScopeIds([])
        }

        // Fetch role-specific assignments
        if (user.role === 'TECHNICIAN') {
          const res = await fetch(`/api/technician-family-assignments?technicianId=${user.id}`)
          if (res.ok) {
            const data = await res.json()
            const assignments = data.data ?? data ?? []
            setTechnicianFamilyIds(assignments.map((a: any) => a.familyId))
          }
        }

        if (user.role === 'CLIENT') {
          const res = await fetch(`/api/client-family-assignments?clientId=${user.id}`)
          if (res.ok) {
            const data = await res.json()
            const assignments = data.data ?? data ?? []
            setClientFamilyIds(assignments.map((a: any) => a.familyId))
          }
        }

        if ((user as any).canManageInventory) {
          const res = await fetch(`/api/inventory/managers/${user.id}/families`)
          if (res.ok) {
            const data = await res.json()
            const families = data.families ?? data.data ?? data ?? []
            setInventoryFamilyIds(
              Array.isArray(families) ? families.map((f: any) => f.familyId ?? f.id) : []
            )
          }
        }

        // Cargar familias de rondas si tiene el módulo habilitado
        if ((user as any).patrolsEnabled) {
          const res = await fetch(`/api/patrol-family-assignments?userId=${user.id}`)
          if (res.ok) {
            const data = await res.json()
            const assignments = data.data ?? []
            setPatrolFamilyIds(assignments.map((a: any) => a.familyId))
          }
        }

        if (user.role === 'ADMIN' && !user.isSuperAdmin) {
          const res = await fetch(`/api/admin/family-assignments?adminId=${user.id}`)
          if (res.ok) {
            const data = await res.json()
            const assignments = data.data ?? []
            setAdminFamilyIds(assignments.map((a: any) => a.familyId))
          }
        }
      } catch (err) {
        setFamilyError('Error al cargar familias')
      } finally {
        setLoadingFamilies(false)
      }
    }

    void fetchFamiliesAndAssignments()
  }, [user, isOpen, session?.user?.id, session?.user?.role, session?.user?.isSuperAdmin])

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
    } catch (err) {
      showNetworkError(err)
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
        // Invalidar cache del usuario afectado en el servidor
        // Esto garantiza que cuando el usuario recargue, verá los módulos actualizados
        void fetch(`/api/user/modules?userId=${user.id}&_t=${Date.now()}`, {
          headers: { 'Cache-Control': 'no-cache' },
        })
        window.dispatchEvent(new CustomEvent('modules-updated'))
        handleClose()
        onUserUpdated()
      } else {
        if (res.status === 409 && extractApiError(result).toLowerCase().includes('email')) {
          setErrors(prev => ({ ...prev, email: 'Este email ya está registrado' }))
        }
        showApiError('Error al actualizar usuario', result)
      }
    } catch (err) {
      showNetworkError(err)
    } finally {
      setLoading(false)
    }
  }

  const isCurrentUser = user?.id === session?.user?.id
  const { modules: systemModules } = useSystemModules()

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
            {/* Cabecera: Avatar + info */}
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

            {/* Datos personales */}
            <UserPersonalDataSection
              name={formData.name}
              email={formData.email}
              phone={formData.phone}
              errors={errors}
              onChange={(field, value) => setFormData(p => ({ ...p, [field]: value }))}
            />

            <Separator />

            {/* Rol y departamento */}
            <div className='space-y-3'>
              <h3 className='text-sm font-semibold text-foreground flex items-center gap-1.5'>
                <Building className='h-4 w-4 text-muted-foreground' />
                Rol y departamento
              </h3>
              <div className='grid grid-cols-2 gap-3'>
                <div className='space-y-1'>
                  <Label htmlFor='edit-role'>
                    Rol del usuario <span className='text-destructive'>*</span>
                  </Label>
                  <select
                    id='edit-role'
                    value={formData.role}
                    disabled={isCurrentUser}
                    onChange={e => {
                      const r = e.target.value as UserRole
                      setFormData(p => ({ ...p, role: r }))
                      if (r === 'ADMIN') setErrors(p => ({ ...p, departmentId: '' }))
                    }}
                    className='flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed'
                  >
                    {USER_ROLE_FORM_OPTIONS.map(r => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                  {isCurrentUser && (
                    <p className='text-xs text-amber-600'>No puedes cambiar tu propio rol</p>
                  )}
                </div>
                <div className='space-y-1'>
                  <Label>
                    Departamento{' '}
                    {formData.role !== 'ADMIN' && <span className='text-destructive'>*</span>}
                  </Label>
                  <DepartmentSelector
                    value={formData.departmentId || null}
                    onChange={val => setFormData(p => ({ ...p, departmentId: val ?? '' }))}
                    departments={departments as any}
                    placeholder='Buscar departamento...'
                    error={errors.departmentId}
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Estado y permisos */}
            <div className='space-y-3'>
              <h3 className='text-sm font-semibold text-foreground'>Estado y permisos</h3>
              <div className='space-y-2'>
                {/* Cuenta activa */}
                <div className='flex items-center justify-between rounded-lg border px-3 py-2.5'>
                  <div>
                    <p className='text-sm font-medium'>Usuario activo</p>
                    <p className='text-xs text-muted-foreground'>
                      El usuario puede iniciar sesión y usar el sistema
                    </p>
                  </div>
                  <Switch
                    checked={formData.isActive}
                    onCheckedChange={v => setFormData(p => ({ ...p, isActive: v }))}
                    disabled={isCurrentUser}
                  />
                </div>

                {/* Super Admin — solo para ADMIN */}
                {formData.role === 'ADMIN' && !isCurrentUser && (
                  <div className='flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2.5'>
                    <div>
                      <p className='text-sm font-medium'>Administrador Principal (Super Admin)</p>
                      <p className='text-xs text-muted-foreground'>
                        Acceso total a todas las familias y configuraciones del sistema.
                      </p>
                    </div>
                    <Switch
                      checked={formData.isSuperAdmin}
                      onCheckedChange={v => setFormData(p => ({ ...p, isSuperAdmin: v }))}
                    />
                  </div>
                )}

                {/* Info de acceso para ADMIN normal (no super admin) */}
                {formData.role === 'ADMIN' && !formData.isSuperAdmin && (
                  <div className='rounded-lg border bg-muted/30 px-3 py-2.5 space-y-1'>
                    <p className='text-xs font-medium text-muted-foreground flex items-center gap-1.5'>
                      <Activity className='h-3.5 w-3.5' />
                      Acceso como Administrador de Familia
                    </p>
                    <p className='text-xs text-muted-foreground'>
                      Los módulos habilitados abajo determinan qué secciones verá este admin.
                      Además, solo verá datos de las familias que tenga asignadas.
                    </p>
                  </div>
                )}
              </div>

              {/* ── Módulos con familias integradas ── */}
              {!formData.isSuperAdmin && systemModules.length > 0 && (
                <div className='space-y-2 pt-1'>
                  <p className='text-xs font-semibold text-muted-foreground uppercase tracking-wide'>
                    Acceso a módulos
                  </p>

                  <div className='space-y-2'>
                    {/* Tickets */}
                    <ModuleAccessCard
                      moduleKey='tickets'
                      moduleName='Tickets de Soporte'
                      role={formData.role}
                      enabled={formData.ticketsEnabled}
                      onToggle={v => setFormData(p => ({ ...p, ticketsEnabled: v }))}
                      families={allFamilies}
                      assignedFamilyIds={
                        formData.role === 'TECHNICIAN'
                          ? technicianFamilyIds
                          : formData.role === 'ADMIN'
                            ? adminFamilyIds
                            : clientFamilyIds
                      }
                      nativeFamilyId={
                        user && typeof user.department === 'object'
                          ? ((user.department as any)?.familyId ?? null)
                          : null
                      }
                      readOnlyFamilyIds={adminScopeReadOnlyIds}
                      onAssignFamily={
                        formData.role === 'TECHNICIAN'
                          ? handleAssignTechnicianFamily
                          : formData.role === 'ADMIN'
                            ? handleAssignAdminFamily
                            : handleAssignClientFamily
                      }
                      onUnassignFamily={
                        formData.role === 'TECHNICIAN'
                          ? (handleUnassignTechnicianFamily as (id: string) => Promise<any>)
                          : formData.role === 'ADMIN'
                            ? handleUnassignAdminFamily
                            : handleUnassignClientFamily
                      }
                      loading={loadingFamilies}
                      disabled={loading}
                    />

                    {/* Inventario */}
                    <ModuleAccessCard
                      moduleKey='inventory'
                      moduleName='Inventario'
                      role={formData.role}
                      enabled={formData.inventoryEnabled || formData.canManageInventory}
                      onToggle={v =>
                        setFormData(p => ({
                          ...p,
                          inventoryEnabled: v,
                          canManageInventory:
                            formData.role === 'TECHNICIAN' ? v : p.canManageInventory,
                        }))
                      }
                      families={allFamilies}
                      assignedFamilyIds={inventoryFamilyIds}
                      nativeFamilyId={
                        user && typeof user.department === 'object'
                          ? ((user.department as any)?.familyId ?? null)
                          : null
                      }
                      readOnlyFamilyIds={adminScopeReadOnlyIds}
                      onAssignFamily={handleAssignInventoryFamily}
                      onUnassignFamily={handleUnassignInventoryFamily}
                      options={{
                        canManageInventory: formData.canManageInventory,
                        onToggleManager: v => setFormData(p => ({ ...p, canManageInventory: v })),
                        canRequestAssets: formData.canRequestAssets,
                        onToggleRequestAssets: v =>
                          setFormData(p => ({ ...p, canRequestAssets: v })),
                      }}
                      loading={loadingFamilies}
                      disabled={loading}
                    />

                    {/* Rondas — para todos los roles, siempre usa patrol_family_assignments */}
                    <ModuleAccessCard
                      moduleKey='patrols'
                      moduleName='Rondas y Patrullajes'
                      role={formData.role}
                      enabled={formData.patrolsEnabled}
                      onToggle={v => setFormData(p => ({ ...p, patrolsEnabled: v }))}
                      families={allFamilies}
                      assignedFamilyIds={patrolFamilyIds}
                      nativeFamilyId={
                        user && typeof user.department === 'object'
                          ? ((user.department as any)?.familyId ?? null)
                          : null
                      }
                      readOnlyFamilyIds={adminScopeReadOnlyIds}
                      onAssignFamily={handleAssignPatrolFamily}
                      onUnassignFamily={handleUnassignPatrolFamily}
                      loading={loadingFamilies}
                      disabled={loading}
                    />
                  </div>
                </div>
              )}

              {/* Panel de estado actual — separado de los controles, colapsado por defecto */}
              {user && !formData.isSuperAdmin && (
                <UserModulesPanel
                  userId={user.id}
                  role={formData.role}
                  canManageInventory={formData.canManageInventory}
                  ticketsEnabled={formData.ticketsEnabled}
                  inventoryEnabled={formData.inventoryEnabled}
                  patrolsEnabled={formData.patrolsEnabled}
                />
              )}
              {/* Para Super Admin: acceso total, no necesita panel */}
              {user && formData.isSuperAdmin && (
                <UserModulesPanel
                  userId={user.id}
                  role={formData.role}
                  canManageInventory={true}
                  ticketsEnabled={true}
                  inventoryEnabled={true}
                  patrolsEnabled={true}
                />
              )}
            </div>

            {/* Las familias se asignan dentro de cada ModuleAccessCard */}

            <Separator />

            {/* Seguridad */}
            <UserSecuritySection
              isLocked={isLocked}
              onResetPassword={handleResetPassword}
              onUnlock={handleUnlockAccess}
            />

            {/* Footer */}
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

      {/* Confirm unassign dialog for technician families with active tickets */}
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
    </>
  )
}
