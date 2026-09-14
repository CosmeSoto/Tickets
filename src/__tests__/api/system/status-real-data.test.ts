/**
 * GET /api/system/status
 *
 * El panel de monitoreo de un ADMIN mostraba cifras inventadas como si
 * fueran reales: CPU con `Math.floor(Math.random()*20+10)`, "último backup"
 * con un timestamp `Math.random()`-eado entre 1-6h atrás (aunque no
 * existiera ningún backup real), cola de email con `Math.random()`, y
 * conexiones/tamaño de BD "estimados a partir de actividad de tickets" en
 * vez de consultarse realmente. Ahora todo sale de fuentes reales:
 * pg_stat_activity/pg_database_size, la tabla `backups`, la tabla
 * `email_queue`, y `os.loadavg()` para CPU (real, aunque no sea un
 * porcentaje exacto).
 */

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/redis', () => ({ redis: { ping: jest.fn(), dbsize: jest.fn() } }))

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    $queryRaw: jest.fn(),
    backups: { findFirst: jest.fn() },
    email_queue: { count: jest.fn(), findFirst: jest.fn() },
  },
}))

jest.mock('next/server', () => ({
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => data,
    }),
  },
}))

import { getServerSession } from 'next-auth'
import prisma from '@/lib/prisma'
import { redis } from '@/lib/redis'
import os from 'os'
import { GET } from '@/app/api/system/status/route'

describe('GET /api/system/status — datos reales, no simulados', () => {
  let randomSpy: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN' },
    })
    // $queryRaw se llama 3 veces: SELECT 1, conexiones+max_connections, tamaño de BD
    ;(prisma.$queryRaw as unknown as jest.Mock)
      .mockResolvedValueOnce([{ '?column?': 1 }])
      .mockResolvedValueOnce([{ active: BigInt(7), max_conn: 100 }])
      .mockResolvedValueOnce([{ size_bytes: BigInt(52428800) }]) // 50MB
    ;(redis.ping as jest.Mock).mockResolvedValue('PONG')
    ;(redis.dbsize as jest.Mock).mockResolvedValue(42)
    ;(prisma.email_queue.count as jest.Mock).mockResolvedValue(3)
    ;(prisma.email_queue.findFirst as jest.Mock).mockResolvedValue({
      sentAt: new Date('2026-01-01T00:00:00Z'),
    })
    // Marcador imposible de producir por azar — si aparece en la respuesta,
    // vino de este mock, no de Math.random().
    ;(prisma.backups.findFirst as jest.Mock).mockResolvedValue({
      createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
      size: 104857600, // 100MB
      backupKind: 'full',
    })
    randomSpy = jest.spyOn(Math, 'random')
  })

  afterEach(() => {
    randomSpy.mockRestore()
  })

  it('regresión: no llama a Math.random() en ningún punto del cálculo', async () => {
    await GET({} as any)

    expect(randomSpy).not.toHaveBeenCalled()
  })

  it('regresión: el backup reportado sale de prisma.backups, no de un timestamp aleatorio', async () => {
    const res = await GET({} as any)
    const body = await res.json()

    expect(prisma.backups.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'completed' } })
    )
    expect(body.backup.lastBackup.size).toBe('100MB')
    expect(body.backup.status).toBe('scheduled') // 3h < 24h
  })

  it('regresión: sin ningún backup real, reporta "no_backups" en vez de inventar uno', async () => {
    ;(prisma.backups.findFirst as jest.Mock).mockResolvedValue(null)

    const res = await GET({} as any)
    const body = await res.json()

    expect(body.backup.status).toBe('no_backups')
    expect(body.backup.lastBackup).toBeNull()
  })

  it('regresión: la cola/envíos de email salen de email_queue real, no de una fórmula sobre tickets', async () => {
    const res = await GET({} as any)
    const body = await res.json()

    expect(body.email.queue).toBe(3)
    expect(body.email.lastSent).toBe('2026-01-01T00:00:00.000Z')
  })

  it('regresión: las conexiones/tamaño de BD salen de pg_stat_activity/pg_database_size reales', async () => {
    const res = await GET({} as any)
    const body = await res.json()

    expect(body.database.connections).toEqual({ active: 7, max: 100, percentage: 7 })
    expect(body.database.size).toBe('50MB')
  })

  it('regresión: el CPU sale de os.loadavg(), no de Math.random()', async () => {
    const loadavgSpy = jest.spyOn(os, 'loadavg').mockReturnValue([1.5, 1.2, 1.0])

    const res = await GET({} as any)
    const body = await res.json()

    expect(loadavgSpy).toHaveBeenCalled()
    expect(body.server.cpu.loadAverage1m).toBe(1.5)
    loadavgSpy.mockRestore()
  })
})
