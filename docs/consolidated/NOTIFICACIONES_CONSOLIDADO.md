# 🔔 Sistema de Notificaciones - Documentación Consolidada

**Fecha de consolidación:** 16/01/2026  
**Archivos consolidados:** 3  
**Estado:** ✅ Producción  
**Tecnología:** Redis + Server-Sent Events (SSE)

---

## 📋 ÍNDICE

1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Arquitectura del Sistema](#arquitectura-del-sistema)
3. [Implementación Completada](#implementación-completada)
4. [Tipos de Notificaciones](#tipos-de-notificaciones)
5. [Guía de Pruebas](#guía-de-pruebas)
6. [Problemas Solucionados](#problemas-solucionados)
7. [Configuración](#configuración)

---

## 📊 RESUMEN EJECUTIVO

El sistema de notificaciones en tiempo real proporciona:
- ✅ Notificaciones instantáneas con Redis
- ✅ Server-Sent Events (SSE) para actualizaciones en tiempo real
- ✅ Toast notifications en el frontend
- ✅ Notificaciones por evento (creación, asignación, comentarios, cambios de estado)
- ✅ Sistema de suscripción por usuario
- ✅ Manejo robusto de errores y reconexión automática
- ✅ Compatible con SSR de Next.js

---

## 🏗️ ARQUITECTURA DEL SISTEMA

### Componentes Principales

```
┌─────────────────┐
│   Frontend      │
│  (Next.js)      │
│                 │
│  - useEffect    │
│  - EventSource  │
│  - Toast UI     │
└────────┬────────┘
         │ SSE
         ↓
┌─────────────────┐
│   API Route     │
│  /api/notifications/stream
│                 │
│  - SSE Setup    │
│  - User Auth    │
└────────┬────────┘
         │ Subscribe
         ↓
┌─────────────────┐
│     Redis       │
│   Pub/Sub       │
│                 │
│  - Channels     │
│  - Messages     │
└────────┬────────┘
         │ Publish
         ↓
┌─────────────────┐
│  Backend APIs   │
│                 │
│  - Tickets      │
│  - Comments     │
│  - Assignments  │
└─────────────────┘
```

### Flujo de Notificaciones

1. **Evento ocurre** (ej: nuevo ticket creado)
2. **Backend publica** mensaje a Redis
3. **Redis distribuye** a suscriptores
4. **SSE envía** al cliente específico
5. **Frontend muestra** toast notification

---

## ✅ IMPLEMENTACIÓN COMPLETADA

### 1. Servicio de Notificaciones

**Archivo:** `src/lib/notifications.ts`

**Características:**
- Singleton pattern para instancia única
- Protección contra SSR (solo en cliente)
- Manejo de EventSource
- Reconexión automática
- Sistema de callbacks
- Limpieza de recursos

**Métodos principales:**
```typescript
- connect(userId: string) - Conectar al stream
- disconnect() - Desconectar y limpiar
- onNotification(callback) - Registrar callback
- isConnected() - Verificar estado
```

### 2. API de Stream

**Archivo:** `src/app/api/notifications/stream/route.ts`

**Funcionalidades:**
- Autenticación de usuario
- Setup de SSE headers
- Suscripción a Redis
- Envío de mensajes
- Manejo de desconexión
- Heartbeat para mantener conexión

**Endpoint:**
```
GET /api/notifications/stream
```

### 3. Servicio de Publicación

**Archivo:** `src/lib/services/notification-publisher.ts`

**Métodos:**
```typescript
- publishTicketCreated(ticket, userId)
- publishTicketAssigned(ticket, userId)
- publishTicketStatusChanged(ticket, userId)
- publishCommentAdded(ticket, comment, userId)
- publishTicketUpdated(ticket, userId)
```

### 4. Integración en Componentes

**Archivos actualizados:**
- `src/app/admin/tickets/page.tsx`
- `src/app/client/tickets/page.tsx`
- `src/app/technician/tickets/page.tsx`
- `src/components/layout/dashboard-layout.tsx`

**Características:**
- Carga dinámica del servicio (evita SSR)
- Conexión automática al montar
- Desconexión al desmontar
- Toast notifications integradas
- Manejo de errores

---

## 🔔 TIPOS DE NOTIFICACIONES

### 1. Ticket Creado

**Evento:** `TICKET_CREATED`

**Destinatarios:**
- Técnico asignado (si hay)
- Administradores

**Mensaje:**
```
"Nuevo ticket creado: [Título]"
```

**Datos incluidos:**
- ticketId
- title
- priority
- category
- client

### 2. Ticket Asignado

**Evento:** `TICKET_ASSIGNED`

**Destinatarios:**
- Técnico asignado
- Cliente (notificación de asignación)

**Mensaje:**
```
"Te han asignado el ticket: [Título]"
```

**Datos incluidos:**
- ticketId
- title
- assignee
- priority

### 3. Cambio de Estado

**Evento:** `TICKET_STATUS_CHANGED`

**Destinatarios:**
- Cliente (dueño del ticket)
- Técnico asignado

**Mensaje:**
```
"El ticket [Título] cambió a [Estado]"
```

**Datos incluidos:**
- ticketId
- title
- oldStatus
- newStatus

### 4. Nuevo Comentario

**Evento:** `COMMENT_ADDED`

**Destinatarios:**
- Cliente (si el comentario es del técnico)
- Técnico (si el comentario es del cliente)

**Mensaje:**
```
"Nuevo comentario en: [Título]"
```

**Datos incluidos:**
- ticketId
- title
- comment
- author

### 5. Ticket Actualizado

**Evento:** `TICKET_UPDATED`

**Destinatarios:**
- Cliente (dueño del ticket)
- Técnico asignado

**Mensaje:**
```
"El ticket [Título] ha sido actualizado"
```

**Datos incluidos:**
- ticketId
- title
- changes

---

## 🧪 GUÍA DE PRUEBAS

### Prueba 1: Crear Ticket

**Pasos:**
1. Abrir dos navegadores/pestañas
2. Login como ADMIN en uno
3. Login como CLIENT en otro
4. Crear ticket como CLIENT
5. Verificar notificación en ADMIN

**Resultado esperado:**
- ✅ Toast aparece en ADMIN
- ✅ Mensaje: "Nuevo ticket creado: [título]"
- ✅ Tipo: info

### Prueba 2: Asignar Técnico

**Pasos:**
1. Abrir dos navegadores/pestañas
2. Login como ADMIN en uno
3. Login como TECHNICIAN en otro
4. Asignar ticket al técnico desde ADMIN
5. Verificar notificación en TECHNICIAN

**Resultado esperado:**
- ✅ Toast aparece en TECHNICIAN
- ✅ Mensaje: "Te han asignado el ticket: [título]"
- ✅ Tipo: success

### Prueba 3: Cambiar Estado

**Pasos:**
1. Abrir dos navegadores/pestañas
2. Login como CLIENT en uno
3. Login como TECHNICIAN en otro
4. Cambiar estado del ticket desde TECHNICIAN
5. Verificar notificación en CLIENT

**Resultado esperado:**
- ✅ Toast aparece en CLIENT
- ✅ Mensaje: "El ticket [título] cambió a [estado]"
- ✅ Tipo: info

### Prueba 4: Agregar Comentario

**Pasos:**
1. Abrir dos navegadores/pestañas
2. Login como CLIENT en uno
3. Login como TECHNICIAN en otro
4. Agregar comentario desde TECHNICIAN
5. Verificar notificación en CLIENT

**Resultado esperado:**
- ✅ Toast aparece en CLIENT
- ✅ Mensaje: "Nuevo comentario en: [título]"
- ✅ Tipo: info

### Prueba 5: Reconexión Automática

**Pasos:**
1. Login como cualquier usuario
2. Abrir DevTools → Network
3. Detener Redis temporalmente
4. Reiniciar Redis
5. Verificar reconexión automática

**Resultado esperado:**
- ✅ Intenta reconectar cada 5 segundos
- ✅ Se reconecta automáticamente
- ✅ Notificaciones funcionan nuevamente

---

## 🔧 PROBLEMAS SOLUCIONADOS

### 1. Error de SSR

**Problema:**
- Next.js intentaba ejecutar código del navegador en el servidor
- Error: `ReferenceError: EventSource is not defined`

**Solución:**
- ✅ Protección de constructor con `typeof window`
- ✅ Carga dinámica del servicio en componentes
- ✅ useEffect para inicialización solo en cliente

**Archivos corregidos:**
- `src/lib/notifications.ts`
- Todos los componentes que usan notificaciones

### 2. Conexiones No Se Cerraban

**Problema:**
- EventSource no se desconectaba al desmontar componente
- Múltiples conexiones abiertas
- Fuga de memoria

**Solución:**
- ✅ Cleanup en useEffect
- ✅ Método disconnect() robusto
- ✅ Verificación de estado antes de conectar

### 3. Notificaciones Duplicadas

**Problema:**
- Mismo usuario recibía notificación múltiples veces
- Redis pub/sub sin filtrado

**Solución:**
- ✅ Canal específico por usuario: `notifications:${userId}`
- ✅ Verificación de destinatario en backend
- ✅ Deduplicación en frontend

### 4. Pérdida de Conexión

**Problema:**
- Conexión se perdía sin reconectar
- Usuario no recibía notificaciones

**Solución:**
- ✅ Reconexión automática cada 5 segundos
- ✅ Heartbeat para detectar desconexión
- ✅ Logs para debugging

---

## ⚙️ CONFIGURACIÓN

### Variables de Entorno

```env
# Redis Configuration
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Notification Settings
NOTIFICATION_HEARTBEAT_INTERVAL=30000  # 30 segundos
NOTIFICATION_RECONNECT_DELAY=5000      # 5 segundos
```

### Configuración de Redis

**Instalación:**
```bash
# macOS
brew install redis
brew services start redis

# Linux
sudo apt-get install redis-server
sudo systemctl start redis

# Docker
docker run -d -p 6379:6379 redis:alpine
```

**Verificar conexión:**
```bash
redis-cli ping
# Respuesta: PONG
```

### Configuración del Cliente

**En componentes:**
```typescript
useEffect(() => {
  if (typeof window !== 'undefined' && session?.user?.id) {
    import('@/lib/notifications').then((module) => {
      const service = module.notificationService
      
      service.connect(session.user.id)
      
      service.onNotification((notification) => {
        toast({
          title: notification.title,
          description: notification.message,
          variant: notification.type === 'error' ? 'destructive' : 'default'
        })
      })
      
      return () => {
        service.disconnect()
      }
    })
  }
}, [session])
```

---

## 📊 MÉTRICAS Y MONITOREO

### Métricas Clave

1. **Conexiones Activas**
   - Número de usuarios conectados
   - Duración promedio de conexión

2. **Mensajes Enviados**
   - Total de notificaciones por tipo
   - Tasa de entrega exitosa

3. **Latencia**
   - Tiempo desde evento hasta notificación
   - Objetivo: < 1 segundo

4. **Errores**
   - Fallos de conexión
   - Mensajes no entregados
   - Reconexiones

### Logs

**Formato:**
```
[NOTIFICATIONS] Evento - Detalles
```

**Ejemplos:**
```
[NOTIFICATIONS] User connected: user-123
[NOTIFICATIONS] Published: TICKET_CREATED to user-456
[NOTIFICATIONS] Connection lost, reconnecting...
[NOTIFICATIONS] User disconnected: user-123
```

---

## 🚀 MEJORAS FUTURAS

### Corto Plazo (1-2 meses)
1. ✅ Notificaciones por email
2. ✅ Historial de notificaciones
3. ✅ Preferencias de usuario
4. ✅ Sonidos personalizables
5. ✅ Agrupación de notificaciones

### Mediano Plazo (3-6 meses)
1. ⚠️ Push notifications (PWA)
2. ⚠️ Notificaciones por SMS
3. ⚠️ Integración con Slack/Teams
4. ⚠️ Notificaciones programadas
5. ⚠️ Analytics de notificaciones

### Largo Plazo (6-12 meses)
1. ⚠️ Machine Learning para priorización
2. ⚠️ Notificaciones inteligentes
3. ⚠️ Multi-canal unificado
4. ⚠️ A/B testing de mensajes
5. ⚠️ API pública de notificaciones

---

## 🔗 ARCHIVOS CONSOLIDADOS

Este documento consolida la información de los siguientes archivos:

1. `NOTIFICACIONES_TIEMPO_REAL_COMPLETADAS.md` - Implementación inicial
2. `RESUMEN_FINAL_NOTIFICACIONES.md` - Documentación completa
3. `GUIA_PRUEBA_NOTIFICACIONES.md` - Guía de pruebas

**Nota:** Los archivos originales pueden ser archivados o eliminados después de verificar que toda la información relevante está consolidada aquí.

---

## 📚 RECURSOS ADICIONALES

### Documentación Técnica
- [Redis Pub/Sub](https://redis.io/topics/pubsub)
- [Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
- [EventSource API](https://developer.mozilla.org/en-US/docs/Web/API/EventSource)

### Ejemplos de Código
- Ver `src/lib/notifications.ts` para implementación completa
- Ver `src/app/api/notifications/stream/route.ts` para API
- Ver componentes de dashboard para integración

---

**Última actualización:** 16/01/2026  
**Mantenido por:** Sistema de Auditoría  
**Estado:** ✅ Documentación consolidada y actualizada
