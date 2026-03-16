'use client'

import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function BackToTickets() {
  const { data: session } = useSession()
  const role = session?.user?.role?.toLowerCase() || 'admin'
  const href = role === 'client' ? '/client/tickets' : `/${role}/tickets`

  return (
    <Link href={href}>
      <Button variant="ghost" size="sm" className="mb-4 -ml-2">
        <ArrowLeft className="h-4 w-4 mr-1" />
        Volver a Tickets
      </Button>
    </Link>
  )
}
