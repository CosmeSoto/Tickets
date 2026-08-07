/**
 * Configuración de navegación por rol (sidebar).
 * Separada del layout para mantener role-dashboard-layout enfocado en shell UI.
 */

import {
  LayoutDashboard,
  Ticket,
  Users,
  Settings,
  Shield,
  Globe,
  Package,
  BarChart3,
  FolderTree,
  Wrench,
  BookOpen,
  Monitor,
  HelpCircle,
  Database,
  FileSignature,
  FileText,
  Building2,
  Layers,
  MapPin,
  ClipboardList,
  AlertTriangle,
  Newspaper,
  CalendarDays,
  KeyRound,
} from 'lucide-react'
import type { DashboardNavItem } from '@/components/layout/dashboard-nav-types'

export const navigationByRole: Record<string, DashboardNavItem[]> = {
  ADMIN: [
    { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
    {
      name: 'Tickets',
      href: '/admin/tickets',
      icon: Ticket,
      children: [
        { name: 'Todos los Tickets', href: '/admin/tickets', icon: Ticket },
        { name: 'Reportes', href: '/admin/reports', icon: BarChart3 },
        { name: 'Categorías', href: '/admin/categories', icon: FolderTree },
        { name: 'Base de Conocimientos', href: '/admin/knowledge', icon: BookOpen },
        { name: 'Configuración', href: '/admin/settings/tickets', icon: Settings },
      ],
    },
    {
      name: 'Inventario',
      href: '/inventory',
      icon: Package,
      children: [
        { name: 'Activos', href: '/inventory', icon: Monitor },
        { name: 'Solicitudes de Compras', href: '/inventory/asset-requests', icon: FileText },
        { name: 'Ventas', href: '/inventory/sales', icon: Database },
        { name: 'Mantenimientos', href: '/inventory/maintenance', icon: Wrench },
        { name: 'Contratos', href: '/inventory/contracts', icon: FileSignature },
        { name: 'Actas', href: '/inventory/acts', icon: FileText },
        { name: 'Proveedores', href: '/inventory/suppliers', icon: Building2 },
        { name: 'Reportes', href: '/inventory/reports', icon: BarChart3 },
        { name: 'Configuración', href: '/admin/settings/inventory', icon: Settings },
      ],
    },
    {
      name: 'Rondas',
      href: '/admin/patrols',
      icon: Shield,
      children: [
        { name: 'Agenda', href: '/admin/patrols', icon: CalendarDays },
        { name: 'Checkpoints', href: '/admin/patrols/checkpoints', icon: MapPin },
        { name: 'Rutas', href: '/admin/patrols/routes', icon: ClipboardList },
        { name: 'Programación', href: '/admin/patrols/schedules', icon: ClipboardList },
        { name: 'Incidentes', href: '/admin/patrols/incidents', icon: AlertTriangle },
        { name: 'Reportes', href: '/admin/patrols/reports', icon: BarChart3 },
        { name: 'Configuración', href: '/admin/settings/patrols', icon: Settings },
      ],
    },
    {
      name: 'Noticias',
      href: '/admin/news',
      icon: Newspaper,
    },
    {
      name: 'Documentos',
      href: '/admin/forms',
      icon: FileText,
    },
    {
      name: 'Credenciales',
      href: '/credentials',
      icon: KeyRound,
    },
    { name: 'Familias', href: '/admin/families', icon: Layers },
    { name: 'Usuarios', href: '/admin/users', icon: Users },
    { name: 'Auditoría', href: '/admin/audit', icon: Shield },
    { name: 'Página Pública', href: '/admin/help-config', icon: Globe },
    { name: 'Configuración Sistema', href: '/admin/settings', icon: Settings },
  ],

  // Técnico SIN gestión de inventario: tickets + sus equipos asignados
  TECHNICIAN: [
    { name: 'Dashboard', href: '/technician', icon: LayoutDashboard },
    {
      name: 'Tickets',
      href: '/technician/tickets',
      icon: Ticket,
      children: [
        { name: 'Mis Tickets', href: '/technician/tickets', icon: Ticket },
        { name: 'Estadísticas', href: '/technician/stats', icon: BarChart3 },
        { name: 'Categorías', href: '/technician/categories', icon: FolderTree },
        { name: 'Base de Conocimientos', href: '/technician/knowledge', icon: BookOpen },
      ],
    },
    {
      name: 'Mis Equipos',
      href: '/inventory',
      icon: Package,
      children: [
        { name: 'Mis Activos', href: '/inventory', icon: Monitor },
        { name: 'Mantenimientos', href: '/inventory/maintenance', icon: Wrench },
        { name: 'Actas', href: '/inventory/acts', icon: FileText },
      ],
    },
    {
      name: 'Rondas',
      href: '/admin/patrols',
      icon: Shield,
      children: [
        { name: 'Agenda', href: '/admin/patrols', icon: CalendarDays },
        { name: 'Mis Rondas', href: '/patrol', icon: MapPin },
        { name: 'Mis Incidentes', href: '/patrol/incidents', icon: AlertTriangle },
        { name: 'Reportes', href: '/admin/patrols/reports', icon: BarChart3 },
      ],
    },
    {
      name: 'Noticias',
      href: '/admin/news',
      icon: Newspaper,
    },
    {
      name: 'Documentos',
      href: '/forms',
      icon: FileText,
    },
    {
      name: 'Credenciales',
      href: '/credentials',
      icon: KeyRound,
    },
  ],

  // Técnico CON gestión de inventario: tickets + inventario operativo de sus familias
  TECHNICIAN_MANAGER: [
    { name: 'Dashboard', href: '/technician', icon: LayoutDashboard },
    {
      name: 'Tickets',
      href: '/technician/tickets',
      icon: Ticket,
      children: [
        { name: 'Mis Tickets', href: '/technician/tickets', icon: Ticket },
        { name: 'Estadísticas', href: '/technician/stats', icon: BarChart3 },
        { name: 'Categorías', href: '/technician/categories', icon: FolderTree },
        { name: 'Base de Conocimientos', href: '/technician/knowledge', icon: BookOpen },
      ],
    },
    {
      name: 'Inventario',
      href: '/inventory',
      icon: Package,
      children: [
        { name: 'Activos', href: '/inventory', icon: Monitor },
        { name: 'Mantenimientos', href: '/inventory/maintenance', icon: Wrench },
        { name: 'Contratos', href: '/inventory/contracts', icon: FileSignature },
        { name: 'Actas', href: '/inventory/acts', icon: FileText },
        { name: 'Reportes', href: '/inventory/reports', icon: BarChart3 },
      ],
    },
    {
      name: 'Rondas',
      href: '/admin/patrols',
      icon: Shield,
      children: [
        { name: 'Agenda', href: '/admin/patrols', icon: CalendarDays },
        { name: 'Mis Rondas', href: '/patrol', icon: MapPin },
        { name: 'Mis Incidentes', href: '/patrol/incidents', icon: AlertTriangle },
        { name: 'Reportes', href: '/admin/patrols/reports', icon: BarChart3 },
      ],
    },
    {
      name: 'Noticias',
      href: '/admin/news',
      icon: Newspaper,
    },
    {
      name: 'Documentos',
      href: '/forms',
      icon: FileText,
    },
    {
      name: 'Credenciales',
      href: '/credentials',
      icon: KeyRound,
    },
  ],

  // Cliente: sus tickets + sus equipos asignados + mantenimientos
  CLIENT: [
    { name: 'Dashboard', href: '/client', icon: LayoutDashboard },
    {
      name: 'Mis Tickets',
      href: '/client/tickets',
      icon: Ticket,
      children: [
        { name: 'Ver Tickets', href: '/client/tickets', icon: Ticket },
        { name: 'Base de Conocimientos', href: '/knowledge', icon: BookOpen },
        { name: 'Centro de Ayuda', href: '/client/help', icon: HelpCircle },
      ],
    },
    {
      name: 'Mis Equipos',
      href: '/inventory',
      icon: Package,
      children: [
        { name: 'Mis Activos', href: '/inventory', icon: Monitor },
        { name: 'Mis Suscripciones', href: '/inventory/contracts', icon: FileSignature },
        { name: 'Mantenimientos', href: '/inventory/maintenance', icon: Wrench },
        { name: 'Actas', href: '/inventory/acts', icon: FileText },
      ],
    },
    {
      name: 'Mis Rondas',
      href: '/patrol',
      icon: Shield,
      children: [
        { name: 'Mis Rondas', href: '/patrol', icon: MapPin },
        { name: 'Mis Incidentes', href: '/patrol/incidents', icon: AlertTriangle },
      ],
    },
    // Noticias: solo si canManageNews (ver abajo en filtro). Feed de lectura va en dashboard.
    {
      name: 'Noticias',
      href: '/admin/news',
      icon: Newspaper,
    },
    {
      name: 'Documentos',
      href: '/forms',
      icon: FileText,
    },
    {
      name: 'Credenciales',
      href: '/credentials',
      icon: KeyRound,
    },
  ],

  // Cliente CON gestión de inventario: tickets + inventario operativo de sus familias
  CLIENT_MANAGER: [
    { name: 'Dashboard', href: '/client', icon: LayoutDashboard },
    {
      name: 'Mis Tickets',
      href: '/client/tickets',
      icon: Ticket,
      children: [
        { name: 'Ver Tickets', href: '/client/tickets', icon: Ticket },
        { name: 'Base de Conocimientos', href: '/knowledge', icon: BookOpen },
        { name: 'Centro de Ayuda', href: '/client/help', icon: HelpCircle },
      ],
    },
    {
      name: 'Inventario',
      href: '/inventory',
      icon: Package,
      children: [
        { name: 'Activos', href: '/inventory', icon: Monitor },
        { name: 'Mantenimientos', href: '/inventory/maintenance', icon: Wrench },
        { name: 'Contratos', href: '/inventory/contracts', icon: FileSignature },
        { name: 'Actas', href: '/inventory/acts', icon: FileText },
        { name: 'Reportes', href: '/inventory/reports', icon: BarChart3 },
      ],
    },
    {
      name: 'Mis Rondas',
      href: '/patrol',
      icon: Shield,
      children: [
        { name: 'Mis Rondas', href: '/patrol', icon: MapPin },
        { name: 'Mis Incidentes', href: '/patrol/incidents', icon: AlertTriangle },
      ],
    },
    {
      name: 'Noticias',
      href: '/admin/news',
      icon: Newspaper,
    },
    {
      name: 'Documentos',
      href: '/forms',
      icon: FileText,
    },
    {
      name: 'Credenciales',
      href: '/credentials',
      icon: KeyRound,
    },
  ],
}
