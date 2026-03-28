'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  // Tecnología
  Laptop, Monitor, Printer, Phone, Tablet, Keyboard, Mouse, Headphones,
  Camera, Cpu, HardDrive, Wifi, Router, Server, Battery, Cable, Usb,
  Bluetooth, Tv, Gamepad2, Watch, Projector, Speaker, Mic, Radio, Disc,
  // Inventario general
  Package, Box, Boxes, Wrench, Settings, Zap, Shield, Globe, Cloud, Database,
  // Edificios / infraestructura
  Building2, Building, Home, Warehouse, Store, Factory, Hotel, School,
  // Naturaleza / exteriores
  TreePine, Leaf, Flower2, Sun, Wind, Droplets,
  // Seguridad
  Lock, Key, Eye, AlertTriangle, ShieldCheck, Fingerprint,
  // Documentos / admin
  FolderOpen, FileText, ClipboardList, Archive, BookOpen, Briefcase,
  // Herramientas / mantenimiento
  Hammer, Paintbrush, Scissors, Ruler, Gauge,
  // Limpieza / servicios
  Sparkles, Trash2, RefreshCw, Recycle,
  // Comercial
  ShoppingCart, Tag, BarChart2, TrendingUp, DollarSign, CreditCard,
  // Otros
  Star, Heart, Flag, Map, Compass, Truck, Car, Bike, Plane,
  type LucideIcon,
} from 'lucide-react'

const ICON_OPTIONS: { name: string; icon: LucideIcon; label: string }[] = [
  // Tecnología
  { name: 'Laptop', icon: Laptop, label: 'Laptop' },
  { name: 'Monitor', icon: Monitor, label: 'Monitor' },
  { name: 'Printer', icon: Printer, label: 'Impresora' },
  { name: 'Phone', icon: Phone, label: 'Teléfono' },
  { name: 'Tablet', icon: Tablet, label: 'Tablet' },
  { name: 'Keyboard', icon: Keyboard, label: 'Teclado' },
  { name: 'Mouse', icon: Mouse, label: 'Mouse' },
  { name: 'Headphones', icon: Headphones, label: 'Audífonos' },
  { name: 'Camera', icon: Camera, label: 'Cámara' },
  { name: 'Cpu', icon: Cpu, label: 'CPU' },
  { name: 'HardDrive', icon: HardDrive, label: 'Disco' },
  { name: 'Wifi', icon: Wifi, label: 'WiFi' },
  { name: 'Router', icon: Router, label: 'Router' },
  { name: 'Server', icon: Server, label: 'Servidor' },
  { name: 'Battery', icon: Battery, label: 'Batería' },
  { name: 'Cable', icon: Cable, label: 'Cable' },
  { name: 'Usb', icon: Usb, label: 'USB' },
  { name: 'Bluetooth', icon: Bluetooth, label: 'Bluetooth' },
  { name: 'Tv', icon: Tv, label: 'TV' },
  { name: 'Projector', icon: Projector, label: 'Proyector' },
  { name: 'Speaker', icon: Speaker, label: 'Parlante' },
  { name: 'Mic', icon: Mic, label: 'Micrófono' },
  // Infraestructura / edificios
  { name: 'Building2', icon: Building2, label: 'Edificio' },
  { name: 'Building', icon: Building, label: 'Edificio 2' },
  { name: 'Home', icon: Home, label: 'Casa' },
  { name: 'Warehouse', icon: Warehouse, label: 'Bodega' },
  { name: 'Store', icon: Store, label: 'Tienda' },
  { name: 'Factory', icon: Factory, label: 'Fábrica' },
  { name: 'Hotel', icon: Hotel, label: 'Hotel' },
  { name: 'School', icon: School, label: 'Escuela' },
  // Mantenimiento / herramientas
  { name: 'Wrench', icon: Wrench, label: 'Llave' },
  { name: 'Hammer', icon: Hammer, label: 'Martillo' },
  { name: 'Paintbrush', icon: Paintbrush, label: 'Pincel' },
  { name: 'Scissors', icon: Scissors, label: 'Tijeras' },
  { name: 'Ruler', icon: Ruler, label: 'Regla' },
  { name: 'Gauge', icon: Gauge, label: 'Medidor' },
  // Seguridad
  { name: 'Shield', icon: Shield, label: 'Escudo' },
  { name: 'ShieldCheck', icon: ShieldCheck, label: 'Escudo OK' },
  { name: 'Lock', icon: Lock, label: 'Candado' },
  { name: 'Key', icon: Key, label: 'Llave' },
  { name: 'Eye', icon: Eye, label: 'Ojo' },
  { name: 'AlertTriangle', icon: AlertTriangle, label: 'Alerta' },
  { name: 'Fingerprint', icon: Fingerprint, label: 'Huella' },
  // Documentos / admin
  { name: 'FolderOpen', icon: FolderOpen, label: 'Carpeta' },
  { name: 'FileText', icon: FileText, label: 'Documento' },
  { name: 'ClipboardList', icon: ClipboardList, label: 'Lista' },
  { name: 'Archive', icon: Archive, label: 'Archivo' },
  { name: 'BookOpen', icon: BookOpen, label: 'Libro' },
  { name: 'Briefcase', icon: Briefcase, label: 'Maletín' },
  // Limpieza / servicios
  { name: 'Sparkles', icon: Sparkles, label: 'Limpieza' },
  { name: 'Trash2', icon: Trash2, label: 'Basura' },
  { name: 'RefreshCw', icon: RefreshCw, label: 'Reciclar' },
  { name: 'Recycle', icon: Recycle, label: 'Reciclaje' },
  // Naturaleza / exteriores
  { name: 'TreePine', icon: TreePine, label: 'Árbol' },
  { name: 'Leaf', icon: Leaf, label: 'Hoja' },
  { name: 'Flower2', icon: Flower2, label: 'Flor' },
  { name: 'Sun', icon: Sun, label: 'Sol' },
  { name: 'Wind', icon: Wind, label: 'Viento' },
  { name: 'Droplets', icon: Droplets, label: 'Agua' },
  // Comercial
  { name: 'ShoppingCart', icon: ShoppingCart, label: 'Carrito' },
  { name: 'Tag', icon: Tag, label: 'Etiqueta' },
  { name: 'BarChart2', icon: BarChart2, label: 'Gráfico' },
  { name: 'TrendingUp', icon: TrendingUp, label: 'Tendencia' },
  { name: 'DollarSign', icon: DollarSign, label: 'Dinero' },
  { name: 'CreditCard', icon: CreditCard, label: 'Tarjeta' },
  // General
  { name: 'Package', icon: Package, label: 'Paquete' },
  { name: 'Box', icon: Box, label: 'Caja' },
  { name: 'Boxes', icon: Boxes, label: 'Cajas' },
  { name: 'Settings', icon: Settings, label: 'Config' },
  { name: 'Zap', icon: Zap, label: 'Rayo' },
  { name: 'Globe', icon: Globe, label: 'Globo' },
  { name: 'Cloud', icon: Cloud, label: 'Nube' },
  { name: 'Database', icon: Database, label: 'BD' },
  { name: 'Star', icon: Star, label: 'Estrella' },
  { name: 'Flag', icon: Flag, label: 'Bandera' },
  { name: 'Map', icon: Map, label: 'Mapa' },
  { name: 'Truck', icon: Truck, label: 'Camión' },
  { name: 'Car', icon: Car, label: 'Auto' },
  { name: 'Gamepad2', icon: Gamepad2, label: 'Control' },
  { name: 'Watch', icon: Watch, label: 'Reloj' },
  { name: 'Disc', icon: Disc, label: 'Disco' },
  { name: 'Radio', icon: Radio, label: 'Radio' },
]

interface IconPickerProps {
  value: string
  onChange: (value: string) => void
}

export function IconPicker({ value, onChange }: IconPickerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const filtered = search
    ? ICON_OPTIONS.filter(
        i =>
          i.name.toLowerCase().includes(search.toLowerCase()) ||
          i.label.toLowerCase().includes(search.toLowerCase())
      )
    : ICON_OPTIONS

  const selectedIcon = ICON_OPTIONS.find(i => i.name === value)
  const SelectedIconComponent = selectedIcon?.icon

  return (
    <div className="space-y-2">
      <Label>Ícono</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full justify-start gap-2">
            {SelectedIconComponent ? (
              <>
                <SelectedIconComponent className="h-4 w-4" />
                <span>{selectedIcon?.label ?? value}</span>
              </>
            ) : (
              <span className="text-muted-foreground">Seleccionar ícono...</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-3" align="start">
          <Input
            placeholder="Buscar ícono..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mb-3"
          />
          <div className="grid grid-cols-6 gap-1 max-h-[240px] overflow-y-auto">
            {filtered.map(({ name, icon: Icon, label }) => (
              <button
                key={name}
                type="button"
                className={`flex flex-col items-center justify-center p-2 rounded-md hover:bg-accent transition-colors ${
                  value === name ? 'bg-primary/10 ring-1 ring-primary' : ''
                }`}
                onClick={() => {
                  onChange(name)
                  setOpen(false)
                  setSearch('')
                }}
                title={label}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[10px] mt-1 truncate w-full text-center">{label}</span>
              </button>
            ))}
          </div>
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No se encontraron íconos
            </p>
          )}
        </PopoverContent>
      </Popover>
    </div>
  )
}
