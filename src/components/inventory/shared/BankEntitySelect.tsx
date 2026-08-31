'use client'

/**
 * BankEntitySelect — selector reutilizable para el campo "Banco / Entidad"
 * (antes un <Input> de texto libre duplicado en facturas de equipo y en los
 * datos bancarios de proveedores). Respaldado por el catálogo global
 * /api/inventory/bank-entities, con crear/editar/eliminar inline.
 *
 * El valor externo sigue siendo el NOMBRE del banco (string), igual que
 * antes — no hay FK real, el catálogo solo alimenta las sugerencias. Por eso
 * este componente traduce internamente entre el id del catálogo (para que
 * <InlineCreateSelect> resuelva selección/edición/borrado) y el nombre que
 * de verdad se guarda en el formulario que lo usa.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { InlineCreateSelect, type InlineSelectOption } from '@/components/ui/inline-create-select'
import { extractCatchError } from '@/lib/utils/api-error'

interface BankEntity {
  id: string
  name: string
}

// Caché breve en memoria — el catálogo cambia poco, evita refetch en cada
// apertura del selector dentro de la misma sesión (mismo patrón que
// modulesMemoryCache en use-user-modules.ts).
let cache: BankEntity[] | null = null
let cacheAt = 0
const CACHE_TTL = 30_000

interface BankEntitySelectProps {
  value: string
  onChange: (name: string) => void
  disabled?: boolean
  placeholder?: string
  allowClear?: boolean
}

export function BankEntitySelect({
  value,
  onChange,
  disabled,
  placeholder = 'Seleccionar banco/entidad',
  allowClear = true,
}: BankEntitySelectProps) {
  const { data: session } = useSession()
  const userRole = session?.user?.role
  const isSuperAdmin = (session?.user as any)?.isSuperAdmin === true
  const canManage = userRole === 'ADMIN' || isSuperAdmin

  const [options, setOptions] = useState<InlineSelectOption[]>(cache ?? [])
  const [loading, setLoading] = useState(!cache)
  // Selección interna por id (el catálogo real) — se traduce a/desde el
  // nombre externo, que es lo único que el formulario que nos usa conoce.
  const [selectedId, setSelectedId] = useState('')
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const load = useCallback(async (force = false) => {
    if (!force && cache && Date.now() - cacheAt < CACHE_TTL) {
      setOptions(cache.map(b => ({ id: b.id, name: b.name })))
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/inventory/bank-entities')
      if (res.ok) {
        const data: BankEntity[] = await res.json()
        cache = data
        cacheAt = Date.now()
        setOptions(data.map(b => ({ id: b.id, name: b.name })))
      }
    } catch {
      /* silencioso — el selector queda vacío, no bloquea el formulario */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Mantener selectedId sincronizado con el nombre externo (p. ej. al abrir
  // el formulario de edición de una factura que ya tiene banco guardado).
  useEffect(() => {
    if (!value) {
      setSelectedId('')
      return
    }
    const match = options.find(o => o.name === value)
    setSelectedId(match?.id ?? '')
  }, [value, options])

  return (
    <InlineCreateSelect
      options={options}
      value={selectedId}
      onChange={setSelectedId}
      onSelected={opt => onChangeRef.current(opt.name)}
      placeholder={loading ? 'Cargando…' : placeholder}
      disabled={disabled || loading}
      allowClear={allowClear}
      createLabel='Crear nuevo banco/entidad'
      createTitle='Nuevo banco/entidad'
      editTitle='Editar banco/entidad'
      createForm={
        canManage
          ? ({ item, onSuccess, onCancel }) => (
              <BankEntityInlineForm item={item} onSuccess={onSuccess} onCancel={onCancel} />
            )
          : undefined
      }
      onDelete={
        canManage
          ? async id => {
              const res = await fetch(`/api/inventory/bank-entities/${id}`, { method: 'DELETE' })
              if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                throw new Error(data.error || 'No se pudo eliminar')
              }
              if (id === selectedId) {
                setSelectedId('')
                onChangeRef.current('')
              }
            }
          : undefined
      }
      deleteConfirmMessage='Se quita de la lista de sugerencias. Las facturas o proveedores que ya lo tienen guardado conservan el nombre tal como quedó, sin cambios.'
      onAfterSave={(item, isEdit) => {
        load(true)
        if (!isEdit) {
          setSelectedId(item.id)
          onChangeRef.current(item.name)
        } else if (item.id === selectedId) {
          onChangeRef.current(item.name)
        }
      }}
    />
  )
}

function BankEntityInlineForm({
  item,
  onSuccess,
  onCancel,
}: {
  item?: InlineSelectOption
  onSuccess: (item: InlineSelectOption) => void
  onCancel: () => void
}) {
  const isEdit = !!item
  const [name, setName] = useState(item?.name ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    e?.stopPropagation()
    setError('')
    if (!name.trim()) {
      setError('El nombre es obligatorio')
      return
    }
    setLoading(true)
    try {
      const url = isEdit
        ? `/api/inventory/bank-entities/${item!.id}`
        : '/api/inventory/bank-entities'
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al guardar')
      onSuccess({ id: data.id, name: data.name })
    } catch (err) {
      setError(extractCatchError(err, 'Error desconocido'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form data-inline-create-form onSubmit={handleSubmit} className='space-y-4'>
      <div className='space-y-1'>
        <Label>
          Nombre del banco/entidad <span className='text-destructive'>*</span>
        </Label>
        <Input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder='Ej: Banco Pichincha'
          maxLength={100}
          autoFocus
        />
      </div>
      {error && <p className='text-sm text-destructive'>{error}</p>}
      <div className='flex justify-end gap-2 pt-1'>
        <Button type='button' variant='outline' onClick={onCancel} disabled={loading}>
          Cancelar
        </Button>
        <Button type='submit' disabled={loading}>
          {loading && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
          {isEdit ? 'Guardar cambios' : 'Crear'}
        </Button>
      </div>
    </form>
  )
}
