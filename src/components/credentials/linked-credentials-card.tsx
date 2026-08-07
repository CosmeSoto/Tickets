'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { KeyRound, Eye, Loader2, Plus, Copy, User } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RevealCredentialDialog } from '@/components/credentials/reveal-credential-dialog'
import { CreateCredentialDialog } from '@/components/credentials/create-credential-dialog'
import { useToast } from '@/hooks/use-toast'

type CredentialEntry = {
  id: string
  title: string
  username?: string | null
  entryType: string
}

type Vault = {
  id: string
  name: string
  kind: string
  familyId?: string | null
  family?: { id?: string; name: string; order?: number } | null
}

type LinkedEntity = 'equipment' | 'license'

interface LinkedCredentialsCardProps {
  entity: LinkedEntity
  entityId: string
  /** Área del activo en inventario — fija la bóveda al crear */
  familyId?: string | null
  familyName?: string | null
  canManage?: boolean
}

export function LinkedCredentialsCard({
  entity,
  entityId,
  familyId,
  familyName,
  canManage = false,
}: LinkedCredentialsCardProps) {
  const { toast } = useToast()
  const [entries, setEntries] = useState<CredentialEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [revealEntry, setRevealEntry] = useState<CredentialEntry | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [vaults, setVaults] = useState<Vault[]>([])
  const [copyingId, setCopyingId] = useState<string | null>(null)

  const apiPath =
    entity === 'equipment'
      ? `/api/credentials/by-equipment/${entityId}`
      : `/api/credentials/by-license/${entityId}`

  const emptyLabel =
    entity === 'equipment'
      ? 'Sin credenciales vinculadas a este equipo.'
      : 'Sin credenciales vinculadas. Usa «Agregar» para portal, admin o accesos del software (la clave de producto va en el inventario de la licencia).'

  const loadEntries = async () => {
    setLoading(true)
    try {
      const res = await fetch(apiPath)
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
    void loadEntries()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when entity target changes
  }, [entity, entityId])

  useEffect(() => {
    if (!canManage || !createOpen) return
    fetch('/api/credentials/vaults')
      .then(r => (r.ok ? r.json() : { vaults: [] }))
      .then(data => setVaults(data.vaults ?? []))
  }, [canManage, createOpen])

  const defaultVaultId = familyId
    ? vaults.find(v => v.kind === 'AREA' && (v.familyId === familyId || v.family?.id === familyId))
        ?.id
    : undefined

  const copyUsername = async (username: string) => {
    try {
      await navigator.clipboard.writeText(username)
      toast({ title: 'Usuario copiado', description: 'En el portapapeles.' })
    } catch {
      toast({
        title: 'No se pudo copiar',
        description: 'Permiso de portapapeles denegado o no disponible.',
        variant: 'destructive',
      })
    }
  }

  const copyPassword = async (entry: CredentialEntry) => {
    setCopyingId(entry.id)
    try {
      const res = await fetch(`/api/credentials/entries/${entry.id}/copy`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'No se pudo copiar')
      await navigator.clipboard.writeText(data.secret)
      toast({
        title: 'Contraseña copiada',
        description: 'En portapapeles (sin mostrar). Acción registrada en auditoría.',
      })
    } catch (err: unknown) {
      toast({
        title: 'No se pudo copiar',
        description: err instanceof Error ? err.message : 'Error inesperado',
        variant: 'destructive',
      })
    } finally {
      setCopyingId(null)
    }
  }

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
            <p className='text-sm text-muted-foreground'>{emptyLabel}</p>
          ) : (
            entries.map(entry => (
              <div
                key={entry.id}
                className='flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm'
              >
                <div className='min-w-0 flex-1'>
                  <p className='font-medium truncate'>{entry.title}</p>
                  {entry.username ? (
                    <p className='text-xs text-muted-foreground truncate'>{entry.username}</p>
                  ) : (
                    <p className='text-xs text-muted-foreground'>Sin usuario</p>
                  )}
                </div>
                <div className='flex items-center gap-0.5 shrink-0'>
                  {entry.username ? (
                    <Button
                      type='button'
                      variant='ghost'
                      size='icon'
                      className='h-8 w-8'
                      title='Copiar usuario'
                      onClick={() => void copyUsername(entry.username!)}
                    >
                      <User className='h-3.5 w-3.5' />
                    </Button>
                  ) : null}
                  <Button
                    type='button'
                    variant='ghost'
                    size='icon'
                    className='h-8 w-8'
                    title='Copiar contraseña (auditado)'
                    disabled={copyingId === entry.id}
                    onClick={() => void copyPassword(entry)}
                  >
                    {copyingId === entry.id ? (
                      <Loader2 className='h-3.5 w-3.5 animate-spin' />
                    ) : (
                      <Copy className='h-3.5 w-3.5' />
                    )}
                  </Button>
                  <Button
                    type='button'
                    variant='ghost'
                    size='icon'
                    className='h-8 w-8'
                    title='Revelar en pantalla'
                    onClick={() => setRevealEntry(entry)}
                  >
                    <Eye className='h-3.5 w-3.5' />
                  </Button>
                </div>
              </div>
            ))
          )}
          {entries.length > 0 ? (
            <p className='text-[11px] text-muted-foreground pt-1'>
              Copiar clave usa la bóveda (sin mostrar) y queda en auditoría. Requiere módulo
              Credenciales activo y acceso al área.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {canManage && (
        <CreateCredentialDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          vaults={vaults}
          defaultVaultId={defaultVaultId}
          lockFamilyId={familyId ?? undefined}
          lockFamilyName={familyName ?? undefined}
          equipmentId={entity === 'equipment' ? entityId : undefined}
          licenseId={entity === 'license' ? entityId : undefined}
          onCreated={() => {
            void loadEntries()
          }}
        />
      )}

      <RevealCredentialDialog entry={revealEntry} onClose={() => setRevealEntry(null)} />
    </>
  )
}
