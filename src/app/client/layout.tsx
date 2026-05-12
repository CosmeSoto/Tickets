'use client'

import { DashboardShellProvider } from '@/contexts/dashboard-shell-context'

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShellProvider>{children}</DashboardShellProvider>
}
