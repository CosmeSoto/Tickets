'use client'

import { DashboardShellProvider } from '@/contexts/dashboard-shell-context'

export default function PatrolLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShellProvider>{children}</DashboardShellProvider>
}
