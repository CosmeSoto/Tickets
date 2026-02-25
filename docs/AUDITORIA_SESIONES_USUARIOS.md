# Auditoría de Sesiones de Usuarios

**Fecha**: 2026-02-20  
**Estado**: ✅ Implementado  
**Prioridad**: 🔴 CRÍTICA (Seguridad y Compliance)

---

## Resumen Ejecutivo

La auditoría de sesiones de usuarios es **CRÍTICA** para:
- 🔒 Seguridad (detectar accesos no autorizados)
- 📋 Compliance (GDPR, SOC 2, ISO 27001)
- 🔍 Investigación de incidentes
- 📊 Análisis de uso

---

## ✅ Lo que se ha Implementado

### 1. Auditoría de Inicio de Sesión

**Ubicación**: `src/lib/auth.ts` - Evento `signIn`

**Qué se registra**:
```typescript
{
  action: 'login' | 'user_registered',
  entityType: 'user',
  entityId: user.id,
  userId: user.id,
  details: {
    provider: 'credentials' | 'google' | 'azure-ad',
    isNewUser: boolean,
    email: user.email,
    name: user.name,
    loginMethod: 'credentials' | 'oauth',
    timestamp: ISO string,
    
    // Contexto enriquecido automático:
    context: {
      requestId: string,
      result: 'SUCCESS',
      source: 'WEB' | 'API' | 'MOBILE',
      deviceType: 'Desktop' | 'Mobile' | 'Tablet',
      browser: string,
      browserVersion: string,
      os: string,
      osVersion: string,
      timestamp: ISO string
    }
  }
}
```

**Cuándo se registra**:
- ✅ Login con email/contraseña
- ✅ Login con Google OAuth
- ✅ Login con Microsoft OAuth
- ✅ Registro de nuevo usuario

### 2. Auditoría de Cierre de Sesión

**Ubicación**: `src/lib/auth.ts` - Evento `signOut`

**Qué se registra**:
```typescript
{
  action: 'logout',
  entityType: 'user',
  entityId: user.id,
  userId: user.id,
  details: {
    timestamp: ISO string,
    sessionDuration: number (segundos),
    
    // Contexto enriquecido automático:
    context: {
      requestId: string,
      result: 'SUCCESS',
      source: 'WEB' | 'API' | 'MOBILE',
      deviceType: 'Desktop' | 'Mobile' | 'Tablet',
      browser: string,
      os: string,
      timestamp: ISO string
    }
  }
}
```

**Cuándo se registra**:
- ✅ Logout manual del usuario
- ✅ Logout automático por expiración de sesión

---

## 📊 Información Capturada

### Datos Básicos
| Campo | Descripción | Ejemplo |
|-------|-------------|---------|
| **Fecha y Hora** | Timestamp exacto | 20/02/2026 14:30:45 |
| **Usuario** | ID, nombre, email | María García (tecnico2@tickets.com) |
| **Acción** | login, logout, user_registered | Login |
| **Proveedor** | credentials, google, azure-ad | Google OAuth |

### Contexto Técnico
| Campo | Descripción | Ejemplo |
|-------|-------------|---------|
| **IP Address** | Dirección IP del usuario | 192.168.1.100 |
| **Dispositivo** | Desktop, Mobile, Tablet | Desktop |
| **Navegador** | Nombre y versión | Google Chrome 120.0 |
| **Sistema Operativo** | Nombre y versión | macOS 14.2 |
| **Origen** | Web, API, Móvil | Web |

### Métricas de Sesión
| Campo | Descripción | Ejemplo |
|-------|-------------|---------|
| **Duración** | Tiempo de sesión activa | 3600 segundos (1 hora) |
| **Request ID** | ID único de la solicitud | req-uuid-... |
| **Resultado** | SUCCESS, ERROR | SUCCESS |

---

## 🔍 Casos de Uso

### 1. Detectar Accesos Sospechosos

**Escenario**: Usuario inicia sesión desde ubicación inusual

**Consulta en Auditoría**:
```sql
SELECT * FROM audit_logs 
WHERE action = 'login' 
  AND userId = 'user-id'
  AND ipAddress NOT IN (lista_ips_conocidas)
ORDER BY createdAt DESC
```

**En la interfaz**:
1. Admin → Auditoría
2. Filtrar por usuario
3. Filtrar por acción "login"
4. Revisar IPs y dispositivos

### 2. Investigar Cuenta Comprometida

**Escenario**: Sospecha de acceso no autorizado

**Información disponible**:
- ✅ Todos los inicios de sesión (fecha, hora, IP)
- ✅ Dispositivos usados
- ✅ Navegadores usados
- ✅ Ubicaciones (por IP)
- ✅ Duración de sesiones

**Pasos**:
1. Exportar CSV de auditoría del usuario
2. Revisar patrones inusuales:
   - IPs desconocidas
   - Dispositivos nuevos
   - Horarios inusuales
   - Múltiples sesiones simultáneas

### 3. Compliance y Reportes

**Requerimientos comunes**:
- ✅ Registro de todos los accesos
- ✅ Timestamp preciso
- ✅ Información del dispositivo
- ✅ Duración de sesiones
- ✅ Exportación para auditorías

**Reportes disponibles**:
1. **Reporte de Accesos**: Todos los logins en un período
2. **Reporte de Sesiones**: Duración promedio, dispositivos más usados
3. **Reporte de Seguridad**: Intentos fallidos, IPs sospechosas

### 4. Análisis de Uso

**Métricas disponibles**:
- Horarios de mayor actividad
- Dispositivos más usados
- Navegadores más comunes
- Duración promedio de sesiones
- Usuarios más activos

---

## 📋 Visualización en Auditoría

### Ejemplo de Log de Login

**En pantalla**:
```
🔐 Inició sesión en el sistema desde 192.168.1.100
María García (tecnico2@tickets.com)
20/02/2026 14:30:45 (Hace 5 min)

Contexto Técnico:
🌐 Web
IP: 192.168.1.100
🖥️ Escritorio
🌐 Google Chrome 120.0
🍎 macOS 14.2
```

**En CSV**:
```csv
Fecha,Hora,Día,Qué Pasó,Dónde,Quién,Email,Rol,Detalles de la Acción,Cambios Realizados,Ubicación (IP),Navegador,Sistema,Dispositivo,Origen,Resultado,Duración (ms),Categoría,Nivel de Importancia
20/02/2026,14:30:45,Martes,"María García inició sesión en el sistema desde 192.168.1.100",Sistema de Autenticación,María García,tecnico2@tickets.com,Técnico,"Login con Google OAuth",No se realizaron cambios,192.168.1.100,Google Chrome 120.0,macOS 14.2,🖥️ Escritorio,🌐 Web,✅ Exitoso,234,Autenticación,🔵 Informativo
```

### Ejemplo de Log de Logout

**En pantalla**:
```
🚪 Cerró sesión
María García (tecnico2@tickets.com)
20/02/2026 15:30:45 (Hace 1 min)
Duración de sesión: 1 hora

Contexto Técnico:
🌐 Web
IP: 192.168.1.100
🖥️ Escritorio
```

---

## ⚠️ Intentos Fallidos (Pendiente)

### Estado Actual
❌ **NO implementado** - Los intentos de login fallidos NO se registran actualmente

### Por qué es importante
- 🔒 Detectar ataques de fuerza bruta
- 🔍 Identificar intentos de acceso no autorizado
- 📊 Análisis de seguridad

### Implementación Futura

**Opción 1: Middleware de NextAuth**
```typescript
// En auth.ts
callbacks: {
  async signIn({ user, account, profile, credentials }) {
    try {
      // Validación...
      return true
    } catch (error) {
      // Registrar intento fallido
      await AuditServiceComplete.log({
        action: 'login_failed',
        entityType: 'user',
        userId: 'unknown',
        details: {
          email: credentials?.email,
          reason: error.message,
          provider: account?.provider
        },
        result: 'ERROR',
        errorCode: 'AUTH_FAILED'
      })
      return false
    }
  }
}
```

**Opción 2: API Route Personalizada**
```typescript
// src/app/api/auth/login/route.ts
export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()
    
    // Intentar autenticar
    const result = await signIn('credentials', {
      email,
      password,
      redirect: false
    })
    
    if (!result.ok) {
      // Registrar intento fallido
      await AuditServiceComplete.log({
        action: 'login_failed',
        entityType: 'user',
        userId: 'unknown',
        details: {
          email,
          reason: 'Invalid credentials'
        },
        request: request,
        result: 'ERROR',
        errorCode: 'INVALID_CREDENTIALS'
      })
    }
    
    return NextResponse.json(result)
  } catch (error) {
    // Registrar error
    await AuditServiceComplete.log({
      action: 'login_failed',
      entityType: 'user',
      userId: 'unknown',
      details: {
        error: error.message
      },
      request: request,
      result: 'ERROR',
      errorCode: 'LOGIN_ERROR'
    })
    
    return NextResponse.json({ error: 'Login failed' }, { status: 500 })
  }
}
```

---

## 📊 Reportes Recomendados

### 1. Reporte de Accesos Diarios

**Consulta**:
```sql
SELECT 
  DATE(createdAt) as fecha,
  COUNT(*) as total_logins,
  COUNT(DISTINCT userId) as usuarios_unicos
FROM audit_logs
WHERE action = 'login'
  AND createdAt >= DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY DATE(createdAt)
ORDER BY fecha DESC
```

### 2. Reporte de Dispositivos

**Consulta**:
```sql
SELECT 
  details->>'$.context.deviceType' as dispositivo,
  details->>'$.context.browser' as navegador,
  COUNT(*) as total
FROM audit_logs
WHERE action = 'login'
  AND createdAt >= DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY dispositivo, navegador
ORDER BY total DESC
```

### 3. Reporte de Horarios

**Consulta**:
```sql
SELECT 
  HOUR(createdAt) as hora,
  COUNT(*) as total_logins
FROM audit_logs
WHERE action = 'login'
  AND createdAt >= DATE_SUB(NOW(), INTERVAL 7 DAY)
GROUP BY HOUR(createdAt)
ORDER BY hora
```

---

## 🔐 Mejores Prácticas

### 1. Retención de Datos
- ✅ Mantener logs de sesión por al menos 90 días
- ✅ Archivar logs antiguos (>1 año)
- ✅ Backup regular de logs de auditoría

### 2. Monitoreo
- ⚠️ Alertas por múltiples intentos fallidos
- ⚠️ Alertas por accesos desde IPs desconocidas
- ⚠️ Alertas por accesos fuera de horario

### 3. Privacidad
- ✅ No almacenar contraseñas
- ✅ Ofuscar IPs en reportes públicos
- ✅ Acceso restringido a logs de auditoría

### 4. Compliance
- ✅ Timestamp preciso (ISO 8601)
- ✅ Información completa del dispositivo
- ✅ Exportación en formato estándar (CSV/JSON)
- ✅ Trazabilidad completa

---

## 🎯 Verificación

### Cómo Probar

1. **Iniciar Sesión**:
   ```
   - Ve a /login
   - Inicia sesión con cualquier usuario
   - Ve a Admin → Auditoría
   - Busca el log de "login"
   ```

2. **Cerrar Sesión**:
   ```
   - Click en tu perfil → Cerrar Sesión
   - Ve a Admin → Auditoría (después de volver a iniciar sesión)
   - Busca el log de "logout"
   ```

3. **Exportar Datos**:
   ```
   - Admin → Auditoría
   - Filtrar por acción "login"
   - Exportar CSV
   - Verificar información completa
   ```

### Qué Esperar

**Login exitoso**:
- ✅ Acción: "Inició sesión en el sistema"
- ✅ Usuario: Nombre y email
- ✅ IP: Dirección IP real
- ✅ Dispositivo: Detectado automáticamente
- ✅ Navegador: Detectado automáticamente
- ✅ Resultado: ✅ Exitoso

**Logout**:
- ✅ Acción: "Cerró sesión"
- ✅ Usuario: Nombre y email
- ✅ Duración: Tiempo de sesión (si disponible)
- ✅ Resultado: ✅ Exitoso

---

## 📝 Próximos Pasos

### Corto Plazo (Esta Semana)
1. ✅ Probar login/logout y verificar auditoría
2. ⚠️ Implementar registro de intentos fallidos
3. ⚠️ Agregar alertas por múltiples intentos

### Mediano Plazo (Próximo Mes)
1. Dashboard de sesiones activas
2. Reportes automáticos de accesos
3. Detección de patrones sospechosos

### Largo Plazo (Próximos 3 Meses)
1. Geolocalización por IP
2. Análisis de comportamiento
3. Sistema de alertas avanzado

---

## ✅ Conclusión

**Estado Actual**: ✅ Auditoría de sesiones implementada

**Cobertura**:
- ✅ Login (credentials, Google, Microsoft)
- ✅ Logout
- ✅ Registro de nuevos usuarios
- ✅ Contexto completo (IP, dispositivo, navegador)
- ✅ Exportación profesional

**Pendiente**:
- ⚠️ Intentos de login fallidos
- ⚠️ Alertas automáticas
- ⚠️ Dashboard de sesiones

**Nivel de Seguridad**: ⭐⭐⭐⭐ (4/5)

Con la implementación de intentos fallidos: ⭐⭐⭐⭐⭐ (5/5)
