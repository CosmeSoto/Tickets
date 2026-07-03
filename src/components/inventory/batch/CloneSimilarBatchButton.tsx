'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Copy } from 'lucide-react'

interface CloneSimilarBatchButtonProps {
  batchId: string
  batchCode: string
  /** Mostrar solo cuando la utilización sugiere recompra */
  highlight?: boolean
}

export function CloneSimilarBatchButton({
  batchId,
  batchCode,
  highlight = false,
}: CloneSimilarBatchButtonProps) {
  return (
    <Button
      variant={highlight ? 'default' : 'outline'}
      size='sm'
      asChild
      className='gap-1.5 shrink-0'
    >
      <Link href={`/inventory/equipment/bulk/new?cloneFrom=${batchId}`}>
        <Copy className='h-3.5 w-3.5' />
        Crear lote similar
      </Link>
    </Button>
  )
}
