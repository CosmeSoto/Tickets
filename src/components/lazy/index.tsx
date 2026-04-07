/**
 * Lazy Loading Components
 * Componentes pesados cargados bajo demanda para mejorar performance
 */

import dynamic from 'next/dynamic'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

// Loading fallback genérico
const LoadingFallback = () => (
  <Card>
    <CardHeader>
      <Skeleton className="h-6 w-48" />
    </CardHeader>
    <CardContent className="space-y-4">
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-32 w-full" />
    </CardContent>
  </Card>
)

// Reports Components — eliminados (reports usa page.tsx directamente)

// Backup Components
export const BackupDashboard = dynamic(
  () => import('@/components/backups/backup-dashboard').then(mod => mod.BackupDashboard),
  { loading: LoadingFallback, ssr: false }
)

export const BackupConfiguration = dynamic(
  () => import('@/components/backups/backup-configuration').then(mod => mod.BackupConfiguration),
  { loading: LoadingFallback, ssr: false }
)

export const BackupMonitoring = dynamic(
  () => import('@/components/backups/backup-monitoring').then(mod => mod.BackupMonitoring),
  { loading: LoadingFallback, ssr: false }
)

export const BackupRestore = dynamic(
  () => import('@/components/backups/backup-restore').then(mod => mod.BackupRestore),
  { loading: LoadingFallback, ssr: false }
)

// Knowledge Base Components
export const ArticleViewer = dynamic(
  () => import('@/components/knowledge/article-viewer').then(mod => mod.ArticleViewer),
  { loading: LoadingFallback, ssr: false }
)

export const CreateArticleDialog = dynamic(
  () => import('@/components/knowledge/create-article-dialog').then(mod => mod.CreateArticleDialog),
  { loading: () => <Skeleton className="h-96 w-full" />, ssr: false }
)

// User Management Components
export const CreateUserModal = dynamic(
  () => import('@/components/users/create-user-modal').then(mod => mod.CreateUserModal),
  { loading: () => <Skeleton className="h-96 w-96" />, ssr: false }
)

export const EditUserModal = dynamic(
  () => import('@/components/users/edit-user-modal').then(mod => mod.EditUserModal),
  { loading: () => <Skeleton className="h-96 w-96" />, ssr: false }
)

export const AvatarUploadModal = dynamic(
  () => import('@/components/users/avatar-upload-modal').then(mod => mod.AvatarUploadModal),
  { loading: () => <Skeleton className="h-64 w-96" />, ssr: false }
)

// Category & Department Components
export const CategoryFormDialog = dynamic(
  () => import('@/components/categories/category-form-dialog').then(mod => mod.CategoryFormDialog),
  { loading: () => <Skeleton className="h-96 w-96" />, ssr: false }
)

export const DepartmentFormDialog = dynamic(
  () => import('@/components/departments/department-form-dialog').then(mod => mod.DepartmentFormDialog),
  { loading: () => <Skeleton className="h-96 w-96" />, ssr: false }
)

// Ticket Components
export const ResolveTicketDialog = dynamic(
  () => import('@/components/tickets/resolve-ticket-dialog').then(mod => mod.ResolveTicketDialog),
  { loading: () => <Skeleton className="h-64 w-96" />, ssr: false }
)


