import { type UserRole } from '@/lib/constants/user-constants'
import { useToast } from '@/hooks/use-toast'

export interface BaseUserFormData {
  name: string
  email: string
  phone: string
  role: UserRole
  departmentId: string
  avatar?: File
}

export function validateUserForm(
  formData: Partial<BaseUserFormData> & { password?: string },
  isCreate: boolean = false,
  passwordMinLength: number = 8
): { isValid: boolean; errors: Record<string, string> } {
  const newErrors: Record<string, string> = {}

  if (!formData.name?.trim()) {
    newErrors.name = 'El nombre es requerido'
  } else if (formData.name.trim().length < 2) {
    newErrors.name = 'Mínimo 2 caracteres'
  }

  if (!formData.email?.trim()) {
    newErrors.email = 'El email es requerido'
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
    newErrors.email = 'Email inválido'
  }

  if (isCreate && !formData.password?.trim()) {
    newErrors.password = 'La contraseña es requerida'
  } else if (isCreate && formData.password && formData.password.length < passwordMinLength) {
    newErrors.password = `Mínimo ${passwordMinLength} caracteres`
  }

  if (formData.phone && !/^[\d\s\-\+\(\)]+$/.test(formData.phone)) {
    newErrors.phone = 'Formato inválido'
  }

  if (formData.role !== 'ADMIN' && !formData.departmentId) {
    newErrors.departmentId = 'Requerido para este rol'
  }

  return { isValid: Object.keys(newErrors).length === 0, errors: newErrors }
}

export function useUserAvatarHandler() {
  const { toast } = useToast()

  const handleAvatarChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    onFileSelect: (file: File) => void,
    onPreviewUpdate: (preview: string) => void
  ) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Archivo inválido',
        description: 'Selecciona una imagen válida',
        variant: 'destructive',
      })
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'Archivo muy grande',
        description: 'La imagen debe ser menor a 5MB',
        variant: 'destructive',
      })
      return
    }

    onFileSelect(file)
    const reader = new FileReader()
    reader.onload = e => onPreviewUpdate(e.target?.result as string)
    reader.readAsDataURL(file)
  }

  return { handleAvatarChange }
}

export function getUserInitials(name: string): string {
  return (
    name
      .split(' ')
      .slice(0, 2)
      .map(n => n[0])
      .join('')
      .toUpperCase() || 'U'
  )
}
