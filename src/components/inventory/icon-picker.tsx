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
  Laptop,
  Monitor,
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
  Usb,
  Bluetooth,
  Tv,
  Gamepad2,
  Watch,
  Projector,
  Speaker,
  Mic,
  Radio,
  Disc,
  Package,
  Box,
  Boxes,
  Wrench,
  Settings,
  Zap,
  Shield,
  Globe,
  Cloud,
  Database,
  type LucideIcon,
} from 'lucide-react'

const ICON_OPTIONS: { name: string; icon: LucideIcon }[] = [
  { name: 'Laptop', icon: Laptop },
  { name: 'Monitor', icon: Monitor },
  { name: 'Printer', icon: Printer },
  { name: 'Phone', icon: Phone },
  { name: 'Tablet', icon: Tablet },
  { name: 'Keyboard', icon: Keyboard },
  { name: 'Mouse', icon: Mouse },
  { name: 'Headphones', icon: Headphones },
  { name: 'Camera', icon: Camera },
  { name: 'Cpu', icon: Cpu },
  { name: 'HardDrive', icon: HardDrive },
  { name: 'Wifi', icon: Wifi },
  { name: 'Router', icon: Router },
  { name: 'Server', icon: Server },
  { name: 'Battery', icon: Battery },
  { name: 'Cable', icon: Cable },
  { name: 'Usb', icon: Usb },
  { name: 'Bluetooth', icon: Bluetooth },
  { name: 'Tv', icon: Tv },
  { name: 'Gamepad2', icon: Gamepad2 },
  { name: 'Watch', icon: Watch },
  { name: 'Projector', icon: Projector },
  { name: 'Speaker', icon: Speaker },
  { name: 'Mic', icon: Mic },
  { name: 'Radio', icon: Radio },
  { name: 'Disc', icon: Disc },
  { name: 'Package', icon: Package },
  { name: 'Box', icon: Box },
  { name: 'Boxes', icon: Boxes },
  { name: 'Wrench', icon: Wrench },
  { name: 'Settings', icon: Settings },
  { name: 'Zap', icon: Zap },
  { name: 'Shield', icon: Shield },
  { name: 'Globe', icon: Globe },
  { name: 'Cloud', icon: Cloud },
  { name: 'Database', icon: Database },
]

interface IconPickerProps {
  value: string
  onChange: (value: string) => void
}

export function IconPicker({ value, onChange }: IconPickerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const filtered = search
    ? ICON_OPTIONS.filter(i => i.name.toLowerCase().includes(search.toLowerCase()))
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
                {value}
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
            {filtered.map(({ name, icon: Icon }) => (
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
                title={name}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[10px] mt-1 truncate w-full text-center">{name}</span>
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
