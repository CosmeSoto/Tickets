'use client'

import type { LucideIcon } from 'lucide-react'
import {
  BarChart3,
  Boxes,
  Clock,
  DollarSign,
  FileText,
  HardDrive,
  Key,
  Layers,
  MapPin,
  Package,
  Repeat,
  ShoppingCart,
  Trash2,
  TrendingUp,
  UserCheck,
  Users,
  Wrench,
} from 'lucide-react'

const ICON_MAP: Record<string, LucideIcon> = {
  Package,
  Users,
  Clock,
  Wrench,
  ShoppingCart,
  Trash2,
  DollarSign,
  Layers,
  MapPin,
  BarChart3,
  HardDrive,
  Key,
  Boxes,
  FileText,
  UserCheck,
  TrendingUp,
  Repeat,
}

export function getReportIcon(name: string): LucideIcon {
  return ICON_MAP[name] ?? Package
}
