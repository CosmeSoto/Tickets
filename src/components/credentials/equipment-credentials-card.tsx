'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { KeyRound, Eye, Loader2, Plus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RevealCredentialDialog } from '@/components/credentials/reveal-credential-dialog'
import { CreateCredentialDialog } from '@/components/credentials/create-credential-dialog'

type CredentialEntry = {
  id: string
  title: string
  username?: string | null
  entryType: string
}

interface EquipmentCredentialsCardProps {
  equipmentId: string
  canManage?: boolean
}

export function EquipmentCredentialsCard({
  equipmentId,
  canManage = false,
}: EquipmentCredentialsCardProps) {
  const [entries, setEntries] = useState<CredentialEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [revealEntry, setRevealEntry] = useState<CredentialEntry | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [vaults, setVaults] = useState<Array<{ id: string; name: string; kind: string }>>([])

  const loadEntries = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/credentials/by-equipment/${equipmentId}`)
      if (res.status === 403) {
        setEntries([])
        return
      }
      if (res.ok) {
        const data = await res.json()
        setEntries(data.entries ?? [])
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadEntries()
  }, [equipmentId])

  useEffect(() => {
    if (!canManage || !createOpen) return
    fetch('/api/credentials/vaults')
      .then(r => (r.ok ? r.json() : { vaults: [] }))
      .then(data => setVaults(data.vaults ?? []))
  }, [canManage, createOpen])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className='text-base flex items-center gap-2'>
            <KeyRound className='h-4 w-4' />
            Credenciales
          </CardTitle>
        </CardHeader>
        <CardContent className='flex justify-center py-6'>
          <Loader2 className='h-5 w-5 animate-spin text-muted-foreground' />
        </CardContent>
      </Card>
    )
  }

  if (entries.length === 0 && !canManage) {
    return null
  }

  return (
    <>
      <Card>
        <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
          <CardTitle className='text-base flex items-center gap-2'>
            <KeyRound className='h-4 w-4' />
            Credenciales
          </CardTitle>
          <div className='flex gap-2'>
            <Button variant='ghost' size='sm' asChild>
              <Link href='/credentials'>Ver módulo</Link>
            </Button>
            {canManage && (
              <Button variant='outline' size='sm' onClick={() => setCreateOpen(true)}>
                <Plus className='h-3.5 w-3.5 mr-1' />
                Agregar
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className='space-y-2'>
          {entries.length === 0 ? (
            <p className='text-sm text-muted-foreground'>
              Sin credenciales vinculadas a este equipo.
            </p>
          ) : (
            entries.map(entry => (
              <div
                key={entry.id}
                className='flex items-center justify-between rounded-md border px-3 py-2 text-sm'
              >
                <div>
                  <p className='font-medium'>{entry.title}</p>
                  {entry.username && (
                    <p className='text-xs text-muted-foreground'>{entry.username}</p>
                  )}
                </div>
                <Button variant='ghost' size='sm' onClick={() => setRevealEntry(entry)}>
                  <Eye className='h-4 w-4' />
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {canManage && (
        <CreateCredentialDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          vaults={vaults}
          equipmentId={equipmentId}
          onCreated={loadEntries}
        />
      )}

      <RevealCredentialDialog entry={revealEntry} onClose={() => setRevealEntry(null)} />
    </>
  )
}
