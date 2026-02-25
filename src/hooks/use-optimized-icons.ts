/**
 * Hook para optimizar imports de iconos
 * Reduce el bundle size cargando solo los iconos necesarios
 */

import { useMemo } from 'react'
import type { LucideIcon } from 'lucide-react'

// Iconos más comunes pre-cargados
import {
  User,
  Users,
  Ticket,
  CheckCircle,
  AlertCircle,
  Clock,
  Settings,
  Bell,
  Search,
  Plus,
  Edit,
  Trash,
  Eye,
  EyeOff,
  X,
  Check,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Filter,
  Download,
  Upload,
  RefreshCw,
  LogOut,
  Menu,
  Home,
  FileText,
  Calendar,
  Mail,
  Phone,
  MapPin,
  Star,
  Heart,
  Share,
  Copy,
  Save,
  Send,
  Loader2,
} from 'lucide-react'

// Mapa de iconos comunes
const commonIcons: Record<string, LucideIcon> = {
  user: User,
  users: Users,
  ticket: Ticket,
  checkCircle: CheckCircle,
  alertCircle: AlertCircle,
  clock: Clock,
  settings: Settings,
  bell: Bell,
  search: Search,
  plus: Plus,
  edit: Edit,
  trash: Trash,
  eye: Eye,
  eyeOff: EyeOff,
  x: X,
  check: Check,
  chevronDown: ChevronDown,
  chevronUp: ChevronUp,
  chevronLeft: ChevronLeft,
  chevronRight: ChevronRight,
  moreVertical: MoreVertical,
  filter: Filter,
  download: Download,
  upload: Upload,
  refreshCw: RefreshCw,
  logOut: LogOut,
  menu: Menu,
  home: Home,
  fileText: FileText,
  calendar: Calendar,
  mail: Mail,
  phone: Phone,
  mapPin: MapPin,
  star: Star,
  heart: Heart,
  share: Share,
  copy: Copy,
  save: Save,
  send: Send,
  loader2: Loader2,
}

/**
 * Hook para obtener iconos optimizados
 * @param iconName - Nombre del icono en camelCase
 * @returns El componente de icono o null si no existe
 */
export function useOptimizedIcon(iconName: keyof typeof commonIcons): LucideIcon | null {
  return useMemo(() => {
    return commonIcons[iconName] || null
  }, [iconName])
}

/**
 * Hook para obtener múltiples iconos optimizados
 * @param iconNames - Array de nombres de iconos
 * @returns Objeto con los iconos solicitados
 */
export function useOptimizedIcons<T extends string>(
  iconNames: T[]
): Record<T, LucideIcon | null> {
  return useMemo(() => {
    const icons: Record<string, LucideIcon | null> = {}
    iconNames.forEach(name => {
      icons[name] = commonIcons[name] || null
    })
    return icons as Record<T, LucideIcon | null>
  }, [iconNames])
}

/**
 * Obtener icono por nombre (función helper)
 */
export function getIcon(iconName: keyof typeof commonIcons): LucideIcon | null {
  return commonIcons[iconName] || null
}

/**
 * Verificar si un icono existe
 */
export function hasIcon(iconName: string): boolean {
  return iconName in commonIcons
}

/**
 * Obtener todos los nombres de iconos disponibles
 */
export function getAvailableIcons(): string[] {
  return Object.keys(commonIcons)
}
