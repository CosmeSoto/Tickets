'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { UserPlus, Save, Info } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { USER_ROLE_FORM_OPTIONS, type UserRole } from '@/lib/constants/user-constants'
import { validateUserForm, useUserAvatarHandler } from './user-utils'
import { CreateUserHeader } from './create-modal/CreateUserHeader'
import { CreateUserPersonalSection } from './create-modal/CreateUserPersonalSection'
import { CreateUserRoleSection } from './create-modal/CreateUserRoleSection'

interface CreateUserModalProps {
  isOpen: boolean
  onClose: () => void
  onUserCreated: () => void
  departments: Array<{ id: string; name: string; color: string }>
  suggestedRole?: UserRole
}

interface NewUserData {
  name: string
  email: string
  password: string
  role: UserRole
  departmentId: string
  phone: string
  isSuperAdmin: boolean
  ticketsEnabled: boolean
  avatar?: File
}

const EMPTY_FORM: NewUserData = {
  name: '',
  email: '',
  password: '',
  role: 'CLIENT',
  departmentId: '',
  phone: '',
  isSuperAdmin: false,
  ticketsEnabled: true,
  avatar: undefined,
}

export function CreateUserModal({
  isOpen,
  onClose,
  onUserCreated,
  departments,
  suggestedRole,
}: CreateUserModalProps) {
  const { data: session } = useSession()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const { handleAvatarChange } = useUserAvatarHandler()

  const isSuperAdminSession = (session?.user as any)?.isSuperAdmin === true
  const defaultRole: UserRole = suggestedRole ?? 'CLIENT'

  const [formData, setFormData] = useState<NewUserData>({
    ...EMPTY_FORM,
    role: defaultRole,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (isOpen) {
      setFormData(prev => ({ ...EMPTY_FORM, role: suggestedRole ?? 'CLIENT' }))
      setErrors({})
      setAvatarPreview(null)
      setShowPassword(false)
    }
  }, [isOpen, suggestedRole])

  const handleClose = () => {
    setFormData({ ...EMPTY_FORM, role: defaultRole })
    setErrors({})
    setAvatarPreview(null)
    onClose()
  }

  const onAvatarFileSelect = (file: File) => {
    setFormData(p => ({ ...p, avatar: file }))
  }

  const onAvatarPreviewUpdate = (preview: string) => {
    setAvatarPreview(preview)
  }

  const onRemoveAvatar = () => {
    setFormData(p => ({ ...p, avatar: undefined }))
    setAvatarPreview(null)
  }

  const onAvatarClick = () => {
    document.getElementById('create-avatar-input')?.click()
  }

  const handleSubmit = async () => {
    const { isValid, errors: validationErrors } = validateUserForm(formData, true)
    if (!isValid) {
      const errorList = Object.values(validationErrors).filter(Boolean)
      if (errorList.length > 0) {
        toast({
          title: 'Completa los campos requeridos',
          description: errorList[0],
          variant: 'destructive',
        })
      }
      setErrors(validationErrors)
      return
    }
    setLoading(true)
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          email: formData.email.trim().toLowerCase(),
          password: formData.password,
          role: formData.role,
          departmentId: formData.departmentId || null,
          phone: formData.phone.trim() || null,
          isActive: true,
          isSuperAdmin: formData.role === 'ADMIN' ? formData.isSuperAdmin : false,
          ticketsEnabled: formData.ticketsEnabled,
          inventoryEnabled: false,
          patrolsEnabled: false,
          canManageInventory: false,
        }),
      })
      const result = await response.json()
      if (response.ok && result.success) {
        if (formData.avatar && result.data?.id) {
          const fd = new FormData()
          fd.append('avatar', formData.avatar)
          await fetch(`/api/users/${result.data.id}/avatar`, { method: 'POST', body: fd })
        }
        const roleLabel = USER_ROLE_FORM_OPTIONS.find(r => r.value === formData.role)?.label
        toast({
          title: 'Usuario creado',
          description: `${formData.name} registrado como ${roleLabel}`,
        })
        handleClose()
        onUserCreated()
      } else {
        let description = result.error || result.message || 'No se pudo crear el usuario'
        if (result.details && Array.isArray(result.details) && result.details.length > 0) {
          const firstDetail = result.details[0]
          const field = firstDetail.path?.[0] ? `${firstDetail.path[0]}: ` : ''
          description = `${field}${firstDetail.message}`
        }
        if (response.status === 409 && result.error?.toLowerCase().includes('email')) {
          setErrors(prev => ({ ...prev, email: 'Este email ya está registrado' }))
        }
        toast({
          title: response.status === 409 ? 'Email ya registrado' : 'Error al crear usuario',
          description,
          variant: 'destructive',
        })
      }
    } catch (err) {
      toast({
        title: 'Error de conexión',
        description: err instanceof Error ? err.message : 'No se pudo conectar con el servidor',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const selectedDepartment = departments.find(d => d.id === formData.departmentId)

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className='max-w-2xl max-h-[90vh]' aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <UserPlus className='h-5 w-5 text-primary' />
            Crear Nuevo Usuario
          </DialogTitle>
          <DialogDescription>
            Completa la información para registrar una nueva cuenta en el sistema
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-6 overflow-y-auto max-h-[calc(90vh-120px)]'>
          <CreateUserHeader
            name={formData.name}
            email={formData.email}
            role={formData.role}
            isSuperAdmin={formData.isSuperAdmin}
            avatarPreview={avatarPreview}
            selectedDepartment={selectedDepartment}
            onAvatarClick={onAvatarClick}
            onRemoveAvatar={onRemoveAvatar}
            hasAvatar={!!formData.avatar}
          />

          <input
            id='create-avatar-input'
            type='file'
            accept='image/*'
            onChange={e => handleAvatarChange(e, onAvatarFileSelect, onAvatarPreviewUpdate)}
            className='hidden'
          />

          {suggestedRole && (
            <div className='flex items-center gap-2 rounded-lg bg-muted/50 border px-3 py-2 text-sm text-muted-foreground'>
              <Info className='h-4 w-4 shrink-0' />
              <span>
                Rol sugerido basado en el filtro activo. Puedes cambiarlo si lo necesitas.
              </span>
            </div>
          )}

          <CreateUserPersonalSection
            name={formData.name}
            email={formData.email}
            password={formData.password}
            phone={formData.phone}
            showPassword={showPassword}
            errors={errors}
            onNameChange={value => setFormData(p => ({ ...p, name: value }))}
            onEmailChange={value => setFormData(p => ({ ...p, email: value }))}
            onPasswordChange={value => setFormData(p => ({ ...p, password: value }))}
            onPhoneChange={value => setFormData(p => ({ ...p, phone: value }))}
            onTogglePassword={() => setShowPassword(p => !p)}
          />

          <Separator />

          <CreateUserRoleSection
            role={formData.role}
            departmentId={formData.departmentId}
            isSuperAdmin={formData.isSuperAdmin}
            isSuperAdminSession={isSuperAdminSession}
            departments={departments}
            errors={errors}
            onRoleChange={r => {
              setFormData(p => ({ ...p, role: r, isSuperAdmin: false }))
              if (r === 'ADMIN') setErrors(p => ({ ...p, departmentId: '' }))
            }}
            onDepartmentChange={val => setFormData(p => ({ ...p, departmentId: val }))}
            onSuperAdminChange={v => setFormData(p => ({ ...p, isSuperAdmin: v }))}
          />

          <div className='flex justify-end gap-2 pt-2'>
            <Button type='button' variant='outline' onClick={handleClose} disabled={loading}>
              Cancelar
            </Button>
            <Button
              type='button'
              onClick={handleSubmit}
              disabled={loading || !formData.name || !formData.email || !formData.password}
            >
              {loading ? (
                <>
                  <Save className='h-4 w-4 mr-2 animate-spin' />
                  Creando...
                </>
              ) : (
                <>
                  <UserPlus className='h-4 w-4 mr-2' />
                  Crear Usuario
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
