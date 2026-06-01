/**
 * Tipos compartidos del módulo de Formularios/Documentos
 */

export interface FormCategory {
  id: string
  name: string
  description?: string | null
}

export interface FormFamily {
  id: string
  name: string
}

export interface FormItem {
  id: string
  title: string
  slug: string
  description?: string | null
  summary?: string | null
  version?: string | null
  categoryId?: string | null
  category?: FormCategory | null
  familyId?: string | null
  family?: FormFamily | null
  fileUrl?: string | null
  fileSize?: number | null
  fileType?: string | null
  isActive: boolean
  isFeatured: boolean
  downloadCount: number
  createdById: string
  updatedById?: string | null
  createdAt: string
  updatedAt: string
  createdBy: { id: string; name: string; email?: string }
  updatedBy?: { id: string; name: string; email?: string } | null
  form_roles: Array<{ id: string; role: string }>
  form_users: Array<{
    id: string
    userId: string
    user: { id: string; name: string; email: string }
  }>
  form_departments: Array<{
    id: string
    departmentId: string
    departments: { id: string; name: string }
  }>
  form_families: Array<{ id: string; familyId: string; families: { id: string; name: string } }>
  _count: { form_downloads: number }
}

/** Versión reducida para el feed de usuario (sin relaciones de visibilidad) */
export interface FormFeedItem {
  id: string
  title: string
  description?: string | null
  summary?: string | null
  version?: string | null
  category?: FormCategory | null
  family?: FormFamily | null
  fileUrl?: string | null
  fileType?: string | null
  fileSize?: number | null
  isFeatured: boolean
  downloadCount: number
  createdAt: string
  createdBy: { id: string; name: string }
  _count: { form_downloads: number }
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function getFileEmoji(fileType: string | null | undefined): string {
  if (!fileType) return '📄'
  if (fileType.includes('pdf')) return '📕'
  if (fileType.includes('word') || fileType.includes('document')) return '📘'
  if (fileType.includes('excel') || fileType.includes('spreadsheet')) return '📗'
  if (fileType.includes('powerpoint') || fileType.includes('presentation')) return '📙'
  if (fileType.includes('image')) return '🖼️'
  if (fileType.includes('zip') || fileType.includes('compressed')) return '🗜️'
  return '📄'
}

export function canPreviewInBrowser(
  fileType: string | null | undefined,
  fileUrl: string | null | undefined
): boolean {
  if (!fileUrl) return false
  // Por MIME type
  if (fileType) {
    if (fileType.includes('pdf') || fileType.includes('image')) return true
  }
  // Por extensión de la URL (para URLs externas sin fileType)
  const urlLower = fileUrl.toLowerCase().split('?')[0]
  return (
    urlLower.endsWith('.pdf') ||
    urlLower.endsWith('.jpg') ||
    urlLower.endsWith('.jpeg') ||
    urlLower.endsWith('.png') ||
    urlLower.endsWith('.gif') ||
    urlLower.endsWith('.webp') ||
    urlLower.endsWith('.svg') ||
    urlLower.includes('drive.google.com') ||
    urlLower.includes('onedrive.live.com') ||
    urlLower.includes('1drv.ms') ||
    urlLower.includes('sharepoint.com') ||
    urlLower.includes('dropbox.com')
  )
}
