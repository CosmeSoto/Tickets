'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function BackToInventory() {
  return (
    <Link href="/inventory">
      <Button variant="ghost" size="sm" className="mb-4 -ml-2">
        <ArrowLeft className="h-4 w-4 mr-1" />
        Volver a Inventario
      </Button>
    </Link>
  )
}
