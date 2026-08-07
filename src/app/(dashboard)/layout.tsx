'use client'

/**
 * Shell compartido para rutas autenticadas del dashboard.
 * Vive en `app/(dashboard)` — al navegar entre admin/inventory/forms/etc.
 * el sidebar NO se remonta.
 *
 * Flujos públicos (actas por token, verify QR) viven en `app/(public)`.
 */

import { DashboardShellProvider } from '@/contexts/dashboard-shell-context'

export default function DashboardGroupLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShellProvider>{children}</DashboardShellProvider>
}
