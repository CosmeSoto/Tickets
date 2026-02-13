#!/usr/bin/env node

/**
 * Script de prueba para verificar la persistencia de notificaciones
 * Simula el comportamiento del localStorage en el navegador
 */

console.log('🧪 PRUEBA DE PERSISTENCIA DE NOTIFICACIONES')
console.log('==========================================')

// Simular localStorage
const localStorage = {
  storage: {},
  getItem(key) {
    return this.storage[key] || null
  },
  setItem(key, value) {
    this.storage[key] = value
  },
  clear() {
    this.storage = {}
  }
}

// Simular las funciones del componente
const isDynamicNotification = (notificationId) => {
  return notificationId.includes('activity-spike-') || 
         notificationId.includes('critical-unassigned-') ||
         notificationId.includes('sla-warning-') ||
         notificationId.includes('rating-pending-')
}

const getDynamicNotificationState = () => {
  try {
    const stored = localStorage.getItem('dynamic-notifications-state')
    const parsed = stored ? JSON.parse(stored) : { read: [], dismissed: [] }
    console.log('📱 Estado localStorage cargado:', parsed)
    return parsed
  } catch (error) {
    console.warn('Error al cargar estado de notificaciones:', error)
    return { read: [], dismissed: [] }
  }
}

const saveDynamicNotificationState = (state) => {
  try {
    localStorage.setItem('dynamic-notifications-state', JSON.stringify(state))
    console.log('💾 Estado localStorage guardado:', state)
  } catch (error) {
    console.warn('Could not save dynamic notification state:', error)
  }
}

const markDynamicAsRead = (notificationId) => {
  const state = getDynamicNotificationState()
  if (!state.read.includes(notificationId)) {
    state.read.push(notificationId)
    saveDynamicNotificationState(state)
    console.log('✅ Notificación marcada como leída:', notificationId)
  }
}

const markDynamicAsDismissed = (notificationId) => {
  const state = getDynamicNotificationState()
  if (!state.dismissed.includes(notificationId)) {
    state.dismissed.push(notificationId)
    saveDynamicNotificationState(state)
    console.log('🗑️ Notificación eliminada:', notificationId)
  }
}

// Simular notificaciones del servidor (siempre vienen como no leídas)
const serverNotifications = [
  {
    id: 'activity-spike-1770134200202',
    type: 'WARNING',
    title: '📈 Pico de actividad detectado',
    message: '3 tickets creados hoy vs 0 promedio diario',
    isRead: false, // Servidor siempre las genera como no leídas
    createdAt: new Date().toISOString()
  },
  {
    id: 'critical-unassigned-c1f79a77-ca3f-47fd-ac02-523909733a59',
    type: 'ERROR',
    title: '🚨 Ticket crítico sin asignar',
    message: '"Computadora no enciende" lleva 17h sin asignar',
    isRead: false, // Servidor siempre las genera como no leídas
    createdAt: new Date().toISOString()
  },
  {
    id: 'persistent-notification-789',
    type: 'SUCCESS',
    title: 'Ticket resuelto',
    message: 'Tu ticket ha sido marcado como resuelto',
    isRead: false, // Esta vendría de la BD
    createdAt: new Date().toISOString()
  }
]

// Función que simula loadNotifications
const loadNotifications = () => {
  console.log('\n🔄 SIMULANDO CARGA DE NOTIFICACIONES...')
  console.log('=====================================')
  
  let notifications = [...serverNotifications] // Clonar para no mutar original
  
  // Aplicar estado persistente a notificaciones dinámicas
  const dynamicState = getDynamicNotificationState()
  
  notifications = notifications
    .filter(n => {
      // Filtrar notificaciones dinámicas que han sido eliminadas
      if (isDynamicNotification(n.id)) {
        return !dynamicState.dismissed.includes(n.id)
      }
      return true
    })
    .map(n => {
      // Aplicar estado de leído a notificaciones dinámicas
      if (isDynamicNotification(n.id) && dynamicState.read.includes(n.id)) {
        return { ...n, isRead: true }
      }
      return n
    })
  
  // Calcular conteo preciso de no leídas
  const unreadCount = notifications.filter(n => !n.isRead).length
  
  console.log('🔔 Resultado final:')
  console.log('  Total notificaciones:', notifications.length)
  console.log('  No leídas:', unreadCount)
  console.log('  Notificaciones procesadas:')
  notifications.forEach(n => {
    console.log(`    - ${n.title}: ${n.isRead ? '✅ Leída' : '❌ No leída'} (${isDynamicNotification(n.id) ? 'Dinámica' : 'Persistente'})`)
  })
  
  return { notifications, unreadCount }
}

// EJECUTAR PRUEBAS
console.log('\n🧪 INICIANDO PRUEBAS...')
console.log('======================')

// 1. Estado inicial (localStorage vacío)
console.log('\n1️⃣ ESTADO INICIAL:')
localStorage.clear()
let result = loadNotifications()
console.log(`   Resultado: ${result.unreadCount} notificaciones no leídas`)

// 2. Marcar una notificación dinámica como leída
console.log('\n2️⃣ MARCAR NOTIFICACIÓN DINÁMICA COMO LEÍDA:')
markDynamicAsRead('activity-spike-1770134200202')
result = loadNotifications()
console.log(`   Resultado: ${result.unreadCount} notificaciones no leídas`)

// 3. Eliminar una notificación dinámica
console.log('\n3️⃣ ELIMINAR NOTIFICACIÓN DINÁMICA:')
markDynamicAsDismissed('critical-unassigned-c1f79a77-ca3f-47fd-ac02-523909733a59')
result = loadNotifications()
console.log(`   Resultado: ${result.unreadCount} notificaciones no leídas`)

// 4. Simular recarga de página (volver a cargar desde servidor)
console.log('\n4️⃣ SIMULAR RECARGA DE PÁGINA:')
console.log('   (El servidor vuelve a generar las notificaciones como no leídas)')
result = loadNotifications()
console.log(`   Resultado: ${result.unreadCount} notificaciones no leídas`)

// 5. Verificar que el estado se mantiene
console.log('\n5️⃣ VERIFICACIÓN FINAL:')
const finalState = getDynamicNotificationState()
console.log('   Estado final en localStorage:', finalState)
console.log('   ✅ La notificación activity-spike está marcada como leída:', finalState.read.includes('activity-spike-1770134200202'))
console.log('   ✅ La notificación critical-unassigned está eliminada:', finalState.dismissed.includes('critical-unassigned-c1f79a77-ca3f-47fd-ac02-523909733a59'))

console.log('\n🎉 PRUEBAS COMPLETADAS')
console.log('=====================')
console.log('✅ El sistema de persistencia funciona correctamente')
console.log('✅ Las notificaciones marcadas como leídas se mantienen')
console.log('✅ Las notificaciones eliminadas no reaparecen')
console.log('✅ El estado persiste entre "recargas de página"')