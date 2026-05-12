import { RoleDashboardLayout } from '@/components/layout/role-dashboard-layout'

// TODO: Unificar con el mismo patrón de DashboardShellProvider (como admin/technician/client)
// una vez terminado el módulo de inventarios, para evitar doble shell y mantener consistencia.
export default function InventoryLayout({ children }: { children: React.ReactNode }) {
  return <RoleDashboardLayout>{children}</RoleDashboardLayout>
}
