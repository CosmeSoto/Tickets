'use client'

import { DashboardShellProvider } from '@/contexts/dashboard-shell-context'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShellProvider>{children}</DashboardShellProvider>
}
