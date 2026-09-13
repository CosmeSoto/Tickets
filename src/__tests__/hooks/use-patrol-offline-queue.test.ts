/**
 * usePatrolOfflineQueue
 *
 * Regresión: antes de esta corrección, un ítem rechazado (REJECTED) por el
 * servidor de sincronización NUNCA se quitaba de la cola local — solo los
 * ACCEPTED se removían. Eso significa que, en cada reconexión (evento 'online'
 * del navegador, o el service worker avisando 'PATROL_SYNC_READY'), el mismo
 * check-in rechazado se reenviaba una y otra vez, generando en el servidor un
 * registro de auditoría duplicado y, para el caso de rechazo por ventana de
 * tiempo, una notificación repetida a cada supervisor de la familia — para
 * siempre, sin que el agente tuviera forma de limpiar la cola.
 *
 * También cubre el nuevo código PATROL_NOT_ACTIVE (409): cuando la ronda ya
 * no está en progreso (cancelada / auto-cerrada por el cron / ya finalizada),
 * reintentar el lote completo nunca puede tener éxito — hay que vaciar la cola
 * en vez de dejarla reintentando indefinidamente.
 */

import { renderHook, act, waitFor } from '@testing-library/react'
import { usePatrolOfflineQueue } from '@/hooks/use-patrol-offline-queue'

const PATROL_ID = 'patrol-1'
const STORAGE_KEY = 'patrol_offline_queue'

function seedQueue(items: Array<Record<string, unknown>>) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

function readQueue(): Array<Record<string, unknown>> {
  return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]')
}

describe('usePatrolOfflineQueue', () => {
  beforeEach(() => {
    window.localStorage.clear()
    global.fetch = jest.fn()
  })

  it('quita del localStorage tanto los ACCEPTED como los REJECTED tras sincronizar', async () => {
    seedQueue([
      {
        localQueueId: 'q1',
        patrolId: PATROL_ID,
        checkpointId: 'cp-1',
        qrToken: 'tok1',
        deviceTimestamp: '2026-01-01T10:00:00.000Z',
        queuedAt: '2026-01-01T10:00:01.000Z',
      },
      {
        localQueueId: 'q2',
        patrolId: PATROL_ID,
        checkpointId: 'cp-2',
        qrToken: 'tok2',
        deviceTimestamp: '2026-01-01T10:05:00.000Z',
        queuedAt: '2026-01-01T10:05:01.000Z',
      },
    ])
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          { localQueueId: 'q1', status: 'ACCEPTED', checkInId: 'ci-1' },
          { localQueueId: 'q2', status: 'REJECTED', error: 'QR_TOKEN_INVALID' },
        ],
      }),
    })

    const { result } = renderHook(() => usePatrolOfflineQueue(PATROL_ID))
    expect(result.current.queuedCount).toBe(2)

    await act(async () => {
      await result.current.syncNow()
    })

    // Ambos deben desaparecer de la cola — el rechazado es determinístico
    // (mismo token + mismo timestamp), reintentarlo no puede tener éxito.
    expect(readQueue()).toEqual([])
    await waitFor(() => expect(result.current.queuedCount).toBe(0))
  })

  it('vacía la cola de la ronda cuando el servidor rechaza el lote por PATROL_NOT_ACTIVE (409)', async () => {
    seedQueue([
      {
        localQueueId: 'q1',
        patrolId: PATROL_ID,
        checkpointId: 'cp-1',
        qrToken: 'tok1',
        deviceTimestamp: '2026-01-01T10:00:00.000Z',
        queuedAt: '2026-01-01T10:00:01.000Z',
      },
    ])
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ error: 'La ronda ya no está en progreso', code: 'PATROL_NOT_ACTIVE' }),
    })

    const { result } = renderHook(() => usePatrolOfflineQueue(PATROL_ID))

    let syncResults: Array<{ localQueueId: string; status: string; error?: string }> = []
    await act(async () => {
      syncResults = await result.current.syncNow()
    })

    expect(readQueue()).toEqual([])
    expect(syncResults).toEqual([
      { localQueueId: 'q1', status: 'REJECTED', error: 'PATROL_NOT_ACTIVE' },
    ])
    await waitFor(() => expect(result.current.queuedCount).toBe(0))
  })

  it('no toca la cola ante un fallo genérico del servidor (reintentable más tarde)', async () => {
    seedQueue([
      {
        localQueueId: 'q1',
        patrolId: PATROL_ID,
        checkpointId: 'cp-1',
        qrToken: 'tok1',
        deviceTimestamp: '2026-01-01T10:00:00.000Z',
        queuedAt: '2026-01-01T10:00:01.000Z',
      },
    ])
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Error interno' }),
    })

    const { result } = renderHook(() => usePatrolOfflineQueue(PATROL_ID))

    await act(async () => {
      await result.current.syncNow()
    })

    expect(readQueue()).toHaveLength(1)
    expect(result.current.queuedCount).toBe(1)
  })

  it('invoca onSyncComplete con el resultado real de la sincronización', async () => {
    seedQueue([
      {
        localQueueId: 'q1',
        patrolId: PATROL_ID,
        checkpointId: 'cp-1',
        qrToken: 'tok1',
        deviceTimestamp: '2026-01-01T10:00:00.000Z',
        queuedAt: '2026-01-01T10:00:01.000Z',
      },
    ])
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [{ localQueueId: 'q1', status: 'REJECTED', error: 'QR_TOKEN_INVALID' }],
      }),
    })

    const onSyncComplete = jest.fn()
    const { result } = renderHook(() => usePatrolOfflineQueue(PATROL_ID, onSyncComplete))

    await act(async () => {
      await result.current.syncNow()
    })

    expect(onSyncComplete).toHaveBeenCalledTimes(1)
    expect(onSyncComplete).toHaveBeenCalledWith([
      { localQueueId: 'q1', status: 'REJECTED', error: 'QR_TOKEN_INVALID' },
    ])
  })
})
