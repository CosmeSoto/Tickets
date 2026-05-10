'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowUpDown } from 'lucide-react'

interface ModelSortClientProps {
  initialSort?: string
}

export function ModelSortClient({ initialSort }: ModelSortClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleSortChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value === 'quantity') {
      params.delete('sort')
    } else {
      params.set('sort', value)
    }
    router.push(`/inventory/models?${params.toString()}`)
  }

  return (
    <div className='flex items-center gap-2'>
      <ArrowUpDown className='w-4 h-4 text-muted-foreground' />
      <Select value={initialSort || 'quantity'} onValueChange={handleSortChange}>
        <SelectTrigger className='w-48'>
          <SelectValue placeholder='Ordenar por' />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value='quantity'>Por cantidad</SelectItem>
          <SelectItem value='utilization'>Por utilización</SelectItem>
          <SelectItem value='alphabetical'>Alfabético</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
