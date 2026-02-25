/**
 * Lazy Loading Components
 * Componentes pesados cargados bajo demanda para mejorar performance
 */

import dynamic from 'next/dynamic'
import { ComponentType } from 'react'
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

// Reports Components
export const ReportsPage = dynamic(
  () => import('@/components/reports/reports-page'),
  { loading: LoadingFallback, ssr: false }
)

export const ReportKPIMetrics = dynamic(
  () => import('@/components/reports/report-kpi-metrics').then(mod => mod.ReportKPIMetrics),
  { loading: () => <Skeleton className="h-48 w-full" />, ssr: false }
)

export const DetailedTicketsTable = dynamic(
  () => import('@/components/reports/detailed-tickets-table').then(mod => mod.DetailedTicketsTable),
  { loading: () => <Skeleton className="h-96 w-full" />, ssr: false }
)

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
export const RateTicketDialog = dynamic(
  () => import('@/components/tickets/rate-ticket-dialog').then(mod => mod.RateTicketDialog),
  { loading: () => <Skeleton className="h-64 w-96" />, ssr: false }
)

export const ResolveTicketDialog = dynamic(
  () => import('@/components/tickets/resolve-ticket-dialog').then(mod => mod.ResolveTicketDialog),
  { loading: () => <Skeleton className="h-64 w-96" />, ssr: false }
)

// Chart Components (para reportes)
// TODO: Crear componentes de gráficos cuando se necesiten
// export const LazyBarChart = dynamic(
//   () => import('@/components/reports/charts/bar-chart').then(mod => mod.BarChart),
//   { loading: () => <Skeleton className="h-64 w-full" />, ssr: false }
// ) as ComponentType<any>

// export const LazyLineChart = dynamic(
//   () => import('@/components/reports/charts/line-chart').then(mod => mod.LineChart),
//   { loading: () => <Skeleton className="h-64 w-full" />, ssr: false }
// ) as ComponentType<any>

// export const LazyPieChart = dynamic(
//   () => import('@/components/reports/charts/pie-chart').then(mod => mod.PieChart),
//   { loading: () => <Skeleton className="h-64 w-full" />, ssr: false }
// ) as ComponentType<any>
