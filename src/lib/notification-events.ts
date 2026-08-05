/**
 * Pub/Sub de notificaciones en tiempo real.
 *
 * Usa Redis Pub/Sub (getRedisPub / getRedisSub) para cruzar procesos.
 * Presencia SSE en Redis (`notif:sse:{userId}`) para Web Push multi-instancia.
 * Fallback in-memory si Redis no está disponible.
 *
 * Canal Redis: "notifications:{userId}"
 */

import { getRedis, getRedisPub, getRedisSub } from '@/lib/server'

type Subscriber = (data: string) => void

const GLOBAL_KEY = '__notificationEventSubscribers__'
const REDIS_HANDLER_KEY = '__notificationRedisMessageHandler__'
const PRESENCE_PREFIX = 'notif:sse:'
/** TTL de presencia; el heartbeat SSE la renueva cada 25s */
const PRESENCE_TTL_SEC = 90

function getLocalSubscribers(): Map<string, Set<Subscriber>> {
  if (!(globalThis as any)[GLOBAL_KEY]) {
    ;(globalThis as any)[GLOBAL_KEY] = new Map<string, Set<Subscriber>>()
  }
  return (globalThis as any)[GLOBAL_KEY]
}

function attachRedisMessageHandlerOnce() {
  const sub = getRedisSub()
  if (!sub) return
  if ((globalThis as any)[REDIS_HANDLER_KEY]) return
  ;(globalThis as any)[REDIS_HANDLER_KEY] = true

  sub.on('message', (ch: string, payload: string) => {
    if (!ch.startsWith('notifications:')) return
    const userId = ch.slice('notifications:'.length)
    const localSubs = getLocalSubscribers().get(userId)
    if (!localSubs) return
    localSubs.forEach(fn => {
      try {
        fn(payload)
      } catch {
        /* cliente desconectado */
      }
    })
  })
}

async function ensureRedisSubscription(userId: string) {
  const sub = getRedisSub()
  if (!sub) return

  attachRedisMessageHandlerOnce()
  try {
    await sub.subscribe(`notifications:${userId}`)
  } catch {
    /* Redis no disponible — fallback in-memory */
  }
}

async function setPresence(userId: string) {
  const redis = getRedis()
  if (!redis) return
  try {
    await redis.set(`${PRESENCE_PREFIX}${userId}`, '1', 'EX', PRESENCE_TTL_SEC)
  } catch {
    /* degradación silenciosa */
  }
}

async function clearPresence(userId: string) {
  const redis = getRedis()
  if (!redis) return
  try {
    await redis.del(`${PRESENCE_PREFIX}${userId}`)
  } catch {
    /* degradación silenciosa */
  }
}

export const NotificationEvents = {
  subscribe(userId: string, fn: Subscriber): () => void {
    const subscribers = getLocalSubscribers()
    const isFirst = !subscribers.has(userId)
    if (isFirst) {
      subscribers.set(userId, new Set())
      ensureRedisSubscription(userId).catch(() => {})
    }
    subscribers.get(userId)!.add(fn)

    // Presencia cluster-wide (Web Push decide con esto)
    void setPresence(userId)

    return () => {
      const subs = subscribers.get(userId)
      if (subs) {
        subs.delete(fn)
        if (subs.size === 0) {
          subscribers.delete(userId)
          void clearPresence(userId)
        }
      }
    }
  },

  /** Renovar TTL de presencia (llamar desde heartbeat SSE). */
  touchPresence(userId: string) {
    void setPresence(userId)
  },

  emit(userId: string, event: { type: string; [key: string]: unknown }) {
    const payload = `data: ${JSON.stringify(event)}\n\n`

    const localSubs = getLocalSubscribers().get(userId)
    if (localSubs) {
      localSubs.forEach(fn => {
        try {
          fn(payload)
        } catch {
          /* cliente desconectado */
        }
      })
    }

    const pub = getRedisPub()
    if (pub) {
      pub.publish(`notifications:${userId}`, payload).catch(() => {})
    }
  },

  emitToMany(userIds: string[], event: { type: string; [key: string]: unknown }) {
    userIds.forEach(id => this.emit(id, event))
  },

  /** Usuarios con SSE local en este proceso (debug / compat). */
  getConnectedUserIds(): string[] {
    return [...getLocalSubscribers().keys()]
  },

  /**
   * ¿El usuario tiene pestaña abierta en algún proceso del cluster?
   * Local primero; si no, consulta presencia Redis.
   */
  async isUserConnected(userId: string): Promise<boolean> {
    if (getLocalSubscribers().has(userId)) return true
    const redis = getRedis()
    if (!redis) return false
    try {
      const n = await redis.exists(`${PRESENCE_PREFIX}${userId}`)
      return n === 1
    } catch {
      return false
    }
  },
}
