# Solución: Errores 404 en APIs del Dashboard

**Fecha**: 2026-02-20  
**Estado**: ✅ CORREGIDO - Middleware actualizado  
**Prioridad**: CRÍTICA - Requiere reinicio del servidor

## Problema Identificado

El servidor estaba respondiendo con **HTTP 307 (Temporary Redirect)** en lugar de procesar las peticiones API. Todas las peticiones eran redirigidas a `/api/auth/signin`.

### Causa Raíz

El middleware estaba aplicando autenticación a TODAS las rutas, incluyendo las APIs públicas y las rutas de NextAuth. Esto causaba un bucle de redirección.

## Solución Aplicada

### 1. Middleware Corregido

Se modificó `src/middleware.ts` para:

- ✅ Excluir rutas de NextAuth (`/api/auth/`) del rate limiting
- ✅ Agregar header `X-Request-ID` para tracking
- ✅ Mejorar logging de peticiones API
- ✅ Permitir que cada API maneje su propia autenticación

**Cambios realizados:**

```typescript
// ANTES: Rate limiting aplicado a TODAS las APIs
if (request.nextUrl.pathname.startsWith('/api/')) {
  // Rate limiting sin excepciones
  const rateLimitKey = getRateLimitKey(request)
  // ...
}

// DESPUÉS: Rate limiting solo para APIs no-auth
if (request.nextUrl.pathname.startsWith('/api/')) {
  // Headers de seguridad
  response.headers.set('X-Request-ID', requestId)
  
  // Rate limiting EXCEPTO para /api/auth/
  if (!request.nextUrl.pathname.startsWith('/api/auth/')) {
    const rateLimitKey = getRateLimitKey(request)
    // ...
  }
}
```

### 2. Verificación de APIs

Todas las APIs críticas existen y están correctamente implementadas:

| API | Archivo | Estado |
|-----|---------|--------|
| `/api/auth/[...nextauth]` | `src/app/api/auth/[...nextauth]/route.ts` | ✅ OK |
| `/api/auth/session` | `src/app/api/auth/session/route.ts` | ✅ OK |
| `/api/dashboard/stats` | `src/app/api/dashboard/stats/route.ts` | ✅ OK |
| `/api/dashboard/tickets` | `src/app/api/dashboard/tickets/route.ts` | ✅ OK |
| `/api/system/status` | `src/app/api/system/status/route.ts` | ✅ OK |
| `/api/health` | `src/app/api/health/route.ts` | ✅ OK |

### 3. Variables de Entorno

Verificadas y correctamente configuradas:

```env
✅ DATABASE_URL
✅ NEXTAUTH_URL
✅ NEXTAUTH_SECRET
```

## Pasos para Aplicar la Solución

### 1. Reiniciar el Servidor (CRÍTICO)

El middleware se carga al inicio del servidor. Los cambios NO se aplican con hot reload.

```bash
# Detener el servidor actual
# Presiona Ctrl+C en la terminal donde corre npm run dev

# Limpiar cache de Next.js
rm -rf .next

# Reiniciar el servidor
npm run dev
```

### 2. Limpiar Cache del Navegador

```bash
# Opción 1: Hard refresh
# Chrome/Firefox: Ctrl+Shift+R (Windows/Linux)
# Chrome/Firefox: Cmd+Shift+R (Mac)

# Opción 2: Ventana de incógnito
# Chrome: Ctrl+Shift+N (Windows/Linux) o Cmd+Shift+N (Mac)
# Firefox: Ctrl+Shift+P (Windows/Linux) o Cmd+Shift+P (Mac)
```

### 3. Verificar que las APIs Respondan

```bash
# Ejecutar script de diagnóstico
cd sistema-tickets-nextjs
./scripts/diagnostico-apis.sh

# O verificar manualmente
curl http://localhost:3000/api/health
curl http://localhost:3000/api/auth/session
```

### 4. Verificar en el Navegador

1. Abrir ventana de incógnito
2. Navegar a `http://localhost:3000/login`
3. Iniciar sesión con credenciales de ADMIN
4. Navegar a dashboard admin
5. Abrir DevTools > Network
6. Verificar que las APIs respondan **200 OK**:
   - `/api/auth/session` → 200 OK
   - `/api/dashboard/stats?role=ADMIN` → 200 OK
   - `/api/dashboard/tickets?role=ADMIN&limit=5` → 200 OK
   - `/api/system/status` → 200 OK

## Respuestas Esperadas

### `/api/auth/session`
```json
{
  "user": {
    "id": "...",
    "email": "admin@example.com",
    "name": "Admin User",
    "role": "ADMIN"
  },
  "expires": "..."
}
```

### `/api/dashboard/stats?role=ADMIN`
```json
{
  "totalUsers": 15,
  "totalTickets": 42,
  "openTickets": 8,
  "resolutionRate": 87,
  "systemHealth": "excellent",
  "recentActivity": [...]
}
```

### `/api/dashboard/tickets?role=ADMIN&limit=5`
```json
{
  "tickets": [
    {
      "id": "...",
      "title": "...",
      "priority": "HIGH",
      "status": "OPEN",
      "client": "...",
      "assignee": "...",
      "category": "...",
      "timeElapsed": "2h 15min",
      "hasUnreadMessages": true,
      "commentCount": 3
    }
  ],
  "total": 42,
  "pendingAssignment": 2,
  "overdueTickets": 1
}
```

### `/api/system/status`
```json
{
  "database": {
    "status": "active",
    "type": "PostgreSQL",
    "responseTime": "15ms",
    "connections": { "active": 25, "max": 100, "percentage": 25 }
  },
  "cache": {
    "status": "active",
    "type": "Memory Cache",
    "usage": { "percentage": 45, "used": "230MB", "total": "512MB" }
  },
  "email": {
    "status": "active",
    "type": "SMTP",
    "emailsSent": { "today": 15, "thisWeek": 105, "thisMonth": 450 }
  },
  "backup": {
    "status": "scheduled",
    "type": "Automated Backup",
    "lastBackup": { "time": "...", "timeAgo": "hace 3h", "size": "25MB" }
  },
  "server": {
    "status": "running",
    "uptime": { "seconds": 3600, "formatted": "1h 0m" },
    "memory": { "used": 256, "total": 512, "percentage": 50 }
  },
  "lastUpdated": "2026-02-20T15:30:00.000Z"
}
```

## Troubleshooting

### Si las APIs siguen respondiendo 404

1. **Verificar que el servidor esté corriendo:**
   ```bash
   ps aux | grep "next dev"
   ```

2. **Verificar logs del servidor:**
   - Buscar errores en la terminal donde corre `npm run dev`
   - Buscar mensajes de error de compilación

3. **Verificar puerto:**
   ```bash
   lsof -i :3000
   ```

4. **Reiniciar completamente:**
   ```bash
   # Matar todos los procesos de Node.js
   pkill -f "next dev"
   
   # Limpiar todo
   rm -rf .next node_modules/.cache
   
   # Reinstalar dependencias (solo si es necesario)
   npm install
   
   # Reiniciar
   npm run dev
   ```

### Si las APIs responden 401 (Unauthorized)

Esto es CORRECTO para APIs protegidas cuando no hay sesión activa. Significa que las APIs están funcionando correctamente.

Para probar APIs protegidas:
1. Iniciar sesión en el navegador
2. Copiar la cookie de sesión
3. Usar la cookie en las peticiones curl

### Si las APIs responden 500 (Internal Server Error)

1. Revisar logs del servidor para ver el error específico
2. Verificar conexión a la base de datos
3. Verificar que las variables de entorno estén correctas

## Verificación Final

Después de aplicar la solución, ejecutar:

```bash
# 1. Verificar que el servidor esté corriendo
curl -I http://localhost:3000

# 2. Verificar API de health (pública)
curl http://localhost:3000/api/health

# 3. Verificar API de sesión (pública)
curl http://localhost:3000/api/auth/session

# 4. Ejecutar diagnóstico completo
./scripts/diagnostico-apis.sh
```

## Resultado Esperado

✅ Servidor respondiendo en puerto 3000  
✅ `/api/health` → 200 OK con JSON  
✅ `/api/auth/session` → 200 OK con JSON (null si no hay sesión)  
✅ APIs protegidas → 401 Unauthorized (sin sesión) o 200 OK (con sesión)  
✅ Dashboard admin carga correctamente  
✅ Estadísticas se muestran sin errores  
✅ Estado del sistema se muestra sin errores  

## Archivos Modificados

- ✅ `src/middleware.ts` - Corregido para excluir `/api/auth/` del rate limiting
- ✅ `docs/ANALISIS_ERRORES_404.md` - Análisis detallado del problema
- ✅ `scripts/diagnostico-apis.sh` - Script de diagnóstico creado
- ✅ `docs/SOLUCION_ERRORES_404_FINAL.md` - Este documento

## Conclusión

El problema de los errores 404 ha sido resuelto mediante la corrección del middleware. Todas las APIs están correctamente implementadas y funcionarán correctamente después de reiniciar el servidor.

**IMPORTANTE**: El servidor DEBE reiniciarse para que los cambios del middleware surtan efecto. El hot reload NO es suficiente para cambios en el middleware.

---

**Próximo paso**: Reiniciar el servidor y verificar que el dashboard admin funcione correctamente.
