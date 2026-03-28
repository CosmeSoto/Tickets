import {
  Building2,
  Wrench,
  Sparkles,
  Shield,
  Monitor,
  TreePine,
  FolderOpen,
  Store,
  Building,
  Home,
  Warehouse,
  Factory,
  Hotel,
  School,
  Hammer,
  Paintbrush,
  ShieldCheck,
  Lock,
  Key,
  Eye,
  AlertTriangle,
  Fingerprint,
  FileText,
  ClipboardList,
  Archive,
  BookOpen,
  Briefcase,
  Trash2,
  RefreshCw,
  Recycle,
  Leaf,
  Flower2,
  Sun,
  Wind,
  Droplets,
  ShoppingCart,
  Tag,
  BarChart2,
  TrendingUp,
  DollarSign,
  CreditCard,
  Package,
  Box,
  Boxes,
  Settings,
  Zap,
  Globe,
  Cloud,
  Database,
  Laptop,
  Printer,
  Phone,
  Tablet,
  Keyboard,
  Mouse,
  Headphones,
  Camera,
  Cpu,
  HardDrive,
  Wifi,
  Router,
  Server,
  Battery,
  Cable,
  type LucideIcon,
} from 'lucide-react'

// Soporta tanto PascalCase (del IconPicker) como kebab-case (datos legacy del seed)
const ICON_MAP: Record<string, LucideIcon> = {
  // PascalCase (formato del IconPicker)
  'Building2': Building2, 'Building': Building, 'Home': Home, 'Warehouse': Warehouse,
  'Store': Store, 'Factory': Factory, 'Hotel': Hotel, 'School': School,
  'Wrench': Wrench, 'Hammer': Hammer, 'Paintbrush': Paintbrush,
  'Shield': Shield, 'ShieldCheck': ShieldCheck, 'Lock': Lock, 'Key': Key,
  'Eye': Eye, 'AlertTriangle': AlertTriangle, 'Fingerprint': Fingerprint,
  'FolderOpen': FolderOpen, 'FileText': FileText, 'ClipboardList': ClipboardList,
  'Archive': Archive, 'BookOpen': BookOpen, 'Briefcase': Briefcase,
  'Sparkles': Sparkles, 'Trash2': Trash2, 'RefreshCw': RefreshCw, 'Recycle': Recycle,
  'TreePine': TreePine, 'Leaf': Leaf, 'Flower2': Flower2, 'Sun': Sun, 'Wind': Wind, 'Droplets': Droplets,
  'ShoppingCart': ShoppingCart, 'Tag': Tag, 'BarChart2': BarChart2,
  'TrendingUp': TrendingUp, 'DollarSign': DollarSign, 'CreditCard': CreditCard,
  'Package': Package, 'Box': Box, 'Boxes': Boxes, 'Settings': Settings,
  'Zap': Zap, 'Globe': Globe, 'Cloud': Cloud, 'Database': Database,
  'Monitor': Monitor, 'Laptop': Laptop, 'Printer': Printer, 'Phone': Phone,
  'Tablet': Tablet, 'Keyboard': Keyboard, 'Mouse': Mouse, 'Headphones': Headphones,
  'Camera': Camera, 'Cpu': Cpu, 'HardDrive': HardDrive, 'Wifi': Wifi,
  'Router': Router, 'Server': Server, 'Battery': Battery, 'Cable': Cable,
  // kebab-case (formato legacy del seed)
  'building-2': Building2, 'building': Building, 'home': Home, 'warehouse': Warehouse,
  'store': Store, 'factory': Factory, 'hotel': Hotel, 'school': School,
  'wrench': Wrench, 'hammer': Hammer, 'paintbrush': Paintbrush,
  'shield': Shield, 'shield-check': ShieldCheck, 'lock': Lock, 'key': Key,
  'eye': Eye, 'alert-triangle': AlertTriangle, 'fingerprint': Fingerprint,
  'folder-open': FolderOpen, 'file-text': FileText, 'clipboard-list': ClipboardList,
  'archive': Archive, 'book-open': BookOpen, 'briefcase': Briefcase,
  'sparkles': Sparkles, 'trash-2': Trash2, 'refresh-cw': RefreshCw, 'recycle': Recycle,
  'tree-pine': TreePine, 'leaf': Leaf, 'flower-2': Flower2, 'sun': Sun, 'wind': Wind, 'droplets': Droplets,
  'shopping-cart': ShoppingCart, 'tag': Tag, 'bar-chart-2': BarChart2,
  'trending-up': TrendingUp, 'dollar-sign': DollarSign, 'credit-card': CreditCard,
  'package': Package, 'box': Box, 'boxes': Boxes, 'settings': Settings,
  'zap': Zap, 'globe': Globe, 'cloud': Cloud, 'database': Database,
  'monitor': Monitor, 'laptop': Laptop, 'printer': Printer, 'phone': Phone,
  'tablet': Tablet, 'keyboard': Keyboard, 'mouse': Mouse, 'headphones': Headphones,
  'camera': Camera, 'cpu': Cpu, 'hard-drive': HardDrive, 'wifi': Wifi,
  'router': Router, 'server': Server, 'battery': Battery, 'cable': Cable,
}

interface FamilyBadgeProps {
  family: { name: string; icon?: string | null; color?: string | null }
  size?: 'sm' | 'md'
}

export function FamilyBadge({ family, size = 'md' }: FamilyBadgeProps) {
  const color = family.color ?? '#6B7280'
  const IconComponent = family.icon ? (ICON_MAP[family.icon] ?? null) : null

  const iconSize = size === 'sm' ? 12 : 16
  const textClass = size === 'sm' ? 'text-xs' : 'text-sm'
  const paddingClass = size === 'sm' ? 'px-2 py-0.5' : 'px-2.5 py-1'

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${textClass} ${paddingClass}`}
      style={{ backgroundColor: color + '20', color }}
    >
      {IconComponent && (
        <IconComponent style={{ width: iconSize, height: iconSize }} />
      )}
      {family.name}
    </span>
  )
}
