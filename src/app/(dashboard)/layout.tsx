'use client'

import { DashboardShellProvider } from '@/contexts/dashboard-shell-context'

export default function DashboardGroupLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShellProvider>{children}</DashboardShellProvider>
}
