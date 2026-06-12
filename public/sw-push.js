/**
 * Service Worker para notificaciones Web Push.
 *
 * Responsabilidades:
 * - Recibir push events del servidor (incluso con el navegador cerrado)
 * - Mostrar notificaciones nativas del SO
 * - Manejar clicks en notificaciones para abrir/enfocar la app
 *
 * NOTA: Este archivo debe estar en /public para que el scope sea "/"
 */

// ── Evento Push: llega una notificación del servidor ─────────────────────────
self.addEventListener('push', event => {
  if (!event.data) return

  let data
  try {
    data = event.data.json()
  } catch {
    // Si no es JSON válido, usar como texto plano
    data = { title: 'Nueva notificación', body: event.data.text() }
  }

  const title = data.title || 'Sistema de Gestión'
  const options = {
    body: data.body || data.message || '',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: data.id || `push-${Date.now()}`, // Evitar duplicados
    renotify: true, // Vibrar/sonar aunque reemplace una con el mismo tag
    vibrate: [100, 50, 100, 50, 200], // Patrón de vibración distintivo
    data: {
      url: data.url || '/',
      notificationId: data.id,
      ticketId: data.ticketId,
      metadata: data.metadata,
    },
    // Acciones rápidas (botones en la notificación)
    actions: data.actions || [
      { action: 'open', title: 'Ver' },
      { action: 'dismiss', title: 'Descartar' },
    ],
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

// ── Click en la notificación ─────────────────────────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close()

  // Si se hizo click en "dismiss", no hacer nada
  if (event.action === 'dismiss') return

  // Determinar la URL de destino
  const urlToOpen = event.notification.data?.url || '/'

  // Intentar enfocar una pestaña existente o abrir una nueva
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      // Buscar una pestaña ya abierta del sistema
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus()
          // Navegar a la URL dentro de la pestaña existente
          client.navigate(urlToOpen)
          return
        }
      }
      // Si no hay pestaña abierta, abrir una nueva
      return clients.openWindow(urlToOpen)
    })
  )
})

// ── Cierre de notificación (swipe dismiss en móvil) ──────────────────────────
self.addEventListener('notificationclose', _event => {
  // Opcional: reportar al servidor que el usuario descartó la notificación
  // para analytics o para no mostrar la misma notificación en la campanita
})

// ── Activación del Service Worker ────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim())
})
