# Sistema de Monitoreo y Error Tracking

Sistema completo de seguimiento de errores, monitoreo de rendimiento, health checking y observabilidad de aplicaciones con integración a Teams/Slack y dashboard de administración.

## Componentes

### 1. ErrorTracker (`error-tracker.ts`)
Servicio principal de seguimiento de errores:
- Captura automática de errores JavaScript, API, base de datos y autenticación
- Categorización por tipo y severidad
- Deduplicación inteligente con fingerprints
- Sistema de alertas con cooldown
- Filtrado configurable de errores
- Métricas y estadísticas completas

### 2. ErrorMiddleware (`error-middleware.ts`)
Middleware para captura automática:
- Wrapper para rutas API
- Error boundary para React
- Handlers globales para errores no capturados
- Decorador para métodos de clase
- Extracción de contexto de requests

### 3. PerformanceMonitor (`performance-monitor.ts`)
Sistema de monitoreo de rendimiento:
- Métricas de tiempo de respuesta API
- Monitoreo de consultas de base de datos
- Tracking de cache hit/miss rates
- Monitoreo de recursos del sistema
- Métricas de interacción de usuario
- Agregación y análisis estadístico
- Alertas por umbrales configurables

### 4. PerformanceMiddleware (`performance-middleware.ts`)
Middleware automático de performance:
- Tracking automático de APIs
- Monitoreo de recursos del sistema
- Detección de requests lentos
- Decorador para métodos
- Configuración flexible

### 5. HealthChecker (`health-checker.ts`)
Sistema de health checking:
- Monitoreo de conectividad de base de datos
- Verificación de Redis y servicios externos
- Checks de filesystem y recursos del sistema
- Health checks personalizados
- Alertas automáticas por fallos
- Dashboard de estado del sistema

### 6. Management APIs
APIs para dashboard de administración:
- `/api/admin/errors` - Gestión de errores
- `/api/admin/performance` - Métricas de rendimiento
- `/api/admin/health` - Estado del sistema
- `/api/health` - Health check público
- Configuración en tiempo real
- Estadísticas y reportes

## Características

### ✅ Tipos de Error Soportados
- **JavaScript**: Errores de cliente y servidor
- **API**: Errores de endpoints REST
- **Database**: Errores de consultas y conexión
- **Authentication**: Errores de autenticación/autorización
- **Validation**: Errores de validación de datos
- **Network**: Errores de conectividad
- **System**: Errores del sistema y procesos
- **Business Logic**: Errores de lógica de negocio
- **External Service**: Errores de servicios externos

### ✅ Niveles de Severidad
- **LOW**: Errores menores, no críticos
- **MEDIUM**: Errores que afectan funcionalidad
- **HIGH**: Errores que impactan operaciones importantes
- **CRITICAL**: Errores que requieren atención inmediata

### ✅ Métricas de Performance
- **Response Time**: Tiempo de respuesta de APIs y operaciones
- **Database Query**: Rendimiento de consultas de base de datos
- **Cache Hit Rate**: Eficiencia del sistema de caché
- **Memory Usage**: Uso de memoria del sistema
- **CPU Usage**: Utilización de CPU
- **Throughput**: Requests por segundo
- **Error Rate**: Tasa de errores por endpoint
- **User Interaction**: Tiempos de interacción del usuario
- **External Service**: Rendimiento de servicios externos

### ✅ Health Checking
- **Database**: Conectividad y rendimiento de PostgreSQL
- **Redis**: Conectividad y operaciones básicas
- **Filesystem**: Operaciones de lectura/escritura
- **Memory**: Uso de memoria del sistema
- **Disk**: Acceso y disponibilidad de disco
- **External Services**: Conectividad a servicios externos
- **Custom Checks**: Health checks personalizados
- **System Health**: Estado general del sistema
- **Alertas**: Notificaciones automáticas por fallos

### ✅ Sistema de Alertas
- Integración con Microsoft Teams
- Integración con Slack
- Cooldown inteligente para evitar spam
- Alertas basadas en severidad y frecuencia
- Umbrales configurables por métrica
- Webhooks configurables
- Alertas de health check por fallos críticos

### ✅ Análisis y Estadísticas
- Agregación automática de métricas
- Cálculo de percentiles (P95, P99)
- Estadísticas por componente
- Filtrado por rango de tiempo
- Detección de anomalías
- Reportes de tendencias
- Estado de salud del sistema en tiempo real

## Configuración

### Variables de Entorno

```bash
# Performance Monitoring
ERROR_TRACKING_ENABLED=true
PERFORMANCE_MONITORING_ENABLED=true
PERFORMANCE_SAMPLE_RATE=1.0
PERFORMANCE_ALERTING_ENABLED=true
PERFORMANCE_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK
PERFORMANCE_EMAIL_RECIPIENTS=admin@tu-dominio.com,dev@tu-dominio.com

# Health Checking
HEALTH_CHECK_ENABLED=true
HEALTH_CHECK_INTERVAL=30
HEALTH_CHECK_TIMEOUT=5000
HEALTH_CHECK_DATABASE=true
HEALTH_CHECK_REDIS=true
HEALTH_CHECK_EXTERNAL_SERVICES=true
HEALTH_CHECK_FILESYSTEM=true
HEALTH_CHECK_MEMORY=true
HEALTH_CHECK_DISK=true

# Slack Integration
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK

# Microsoft Teams Integration
TEAMS_WEBHOOK_URL=https://outlook.office.com/webhook/YOUR_WEBHOOK_URL

# Error Filtering
ERROR_SAMPLE_RATE=1.0
ERROR_ENABLE_STACK_TRACE=true
ERROR_ENABLE_USER_CONTEXT=true
ERROR_ENABLE_PERFORMANCE_TRACKING=true
```

### Inicialización

```typescript
import { initializeMonitoring } from '@/lib/monitoring'

// Inicializar sistema completo
initializeMonitoring({
  errorTracking: {
    enabled: true,
    environment: 'production',
    alerting: {
      enabled: true,
      teamsWebhook: process.env.TEAMS_WEBHOOK_URL
    }
  },
  performanceMonitoring: {
    enabled: true,
    sampleRate: 1.0,
    enableRealTimeMonitoring: true
  },
  healthChecking: {
    enabled: true,
    checkInterval: 30,
    checks: {
      database: true,
      redis: true,
      externalServices: true,
      filesystem: true,
      memory: true,
      disk: true
    }
  }
})
```

## Uso

### Seguimiento Automático

```typescript
import { withErrorTracking } from '@/lib/monitoring'

// Wrapper para rutas API
export const GET = withErrorTracking(
  async (request: NextRequest) => {
    // Tu lógica aquí
    return NextResponse.json({ success: true })
  },
  {
    route: '/api/tickets',
    method: 'GET',
    component: 'tickets-api'
  }
)
```

### Seguimiento Manual

```typescript
import { ErrorTracker, ErrorType, ErrorSeverity } from '@/lib/monitoring'

// Seguimiento básico
await ErrorTracker.trackError(
  new Error('Something went wrong'),
  { component: 'user-service', userId: 'user123' },
  ErrorType.BUSINESS_LOGIC,
  ErrorSeverity.MEDIUM
)

// Seguimiento de errores API
await ErrorTracker.trackAPIError(
  error,
  { method: 'POST', url: '/api/users', headers: request.headers },
  { status: 500, statusText: 'Internal Server Error' },
  'user123'
)

// Seguimiento de errores de base de datos
await ErrorTracker.trackDatabaseError(
  error,
  'SELECT',
  'SELECT * FROM users WHERE id = ?',
  ['123']
)
```

### Decorador para Clases

```typescript
import { trackErrors } from '@/lib/monitoring'

class UserService {
  @trackErrors
  async createUser(userData: any) {
    // Si hay error, se captura automáticamente
    return await this.database.create(userData)
  }
}
```

### Error Boundary para React

```typescript
import { ErrorMiddleware } from '@/lib/monitoring'

const ErrorBoundary = ErrorMiddleware.createErrorBoundary()

// Usar en componentes React
function MyComponent() {
  return (
    <ErrorBoundary>
      <YourComponent />
    </ErrorBoundary>
  )
}
```

## Dashboard de Administración

### Obtener Estadísticas

```bash
# Estadísticas generales
GET /api/admin/errors?type=stats

# Errores recientes
GET /api/admin/errors?type=recent&limit=10

# Errores más frecuentes
GET /api/admin/errors?type=top&limit=10
```

### Gestión de Errores

```bash
# Resolver error
POST /api/admin/errors
{
  "action": "resolve",
  "errorId": "fingerprint_hash",
  "resolvedBy": "admin@example.com"
}

# Limpiar errores antiguos
POST /api/admin/errors
{
  "action": "clear-old",
  "days": 30
}
```

### Configuración

```bash
# Actualizar configuración
PUT /api/admin/errors/config
{
  "enabled": true,
  "sampleRate": 0.8,
  "enableStackTrace": true
}
```

## Métricas y Monitoreo

El sistema proporciona métricas detalladas:

### Estadísticas Disponibles
- Total de errores por período
- Errores por tipo (JavaScript, API, DB, etc.)
- Errores por severidad (Low, Medium, High, Critical)
- Errores recientes (últimas 24 horas)
- Top errores por frecuencia
- Errores resueltos vs pendientes

### Alertas Automáticas
- **Critical**: Alerta inmediata
- **High**: Alerta después de 5 ocurrencias
- **Medium**: Alerta después de 10 ocurrencias
- **Low**: Sin alertas automáticas

### Cooldown de Alertas
- **Critical**: 5 minutos
- **High**: 15 minutos
- **Medium**: 1 hora
- **Low**: 4 horas

## Integración con Sistema Existente

El sistema se integra perfectamente con:
- ✅ Sistema de logging estructurado (ApplicationLogger)
- ✅ Middleware de Next.js
- ✅ API routes y handlers
- ✅ Servicios de base de datos
- ✅ Sistema de autenticación
- ✅ Tests automatizados

## Estado de Implementación

- ✅ ErrorTracker completo con todas las funcionalidades
- ✅ ErrorMiddleware con captura automática
- ✅ API de administración para dashboard
- ✅ Integración con Teams y Slack
- ✅ Sistema de filtrado y deduplicación
- ✅ Métricas y estadísticas completas
- ✅ Tests comprehensivos (18 pruebas pasando)
- ✅ Documentación completa
- ✅ Variables de entorno configuradas

**Tarea 7.3 - Set Up Error Tracking: ✅ COMPLETADA**

## Próximos Pasos

Con el error tracking completado, el siguiente paso sería:
- **Tarea 7.4**: Add Performance Monitoring
- **Tarea 7.5**: Create Health Check System
- **Tarea 7.6**: Configure Log Management
## Performance Monitoring

### Uso Básico

```typescript
import { PerformanceMonitor, MetricType, MetricUnit } from '@/lib/monitoring'

// Inicializar sistema completo
initializeMonitoring({
  performanceMonitoring: {
    enabled: true,
    sampleRate: 1.0,
    enableRealTimeMonitoring: true,
    thresholds: {
      [MetricType.RESPONSE_TIME]: { warning: 1000, critical: 3000 },
      [MetricType.DATABASE_QUERY]: { warning: 500, critical: 2000 }
    }
  }
})

// Tracking manual de métricas
PerformanceMonitor.recordMetric({
  name: 'custom_operation',
  type: MetricType.RESPONSE_TIME,
  value: 150,
  unit: MetricUnit.MILLISECONDS,
  context: { component: 'user-service', userId: 'user123' }
})

// Uso de timers
const timerId = PerformanceMonitor.startTimer('database_query', {
  component: 'database',
  operation: 'SELECT'
})

// ... realizar operación ...

const duration = PerformanceMonitor.endTimer(timerId, MetricType.DATABASE_QUERY)
```

### Tracking Automático

```typescript
import { withPerformanceTracking, trackPerformance } from '@/lib/monitoring'

// Wrapper para rutas API
export const GET = withPerformanceTracking(
  async (request: NextRequest) => {
    // Tu lógica aquí
    return NextResponse.json({ success: true })
  },
  {
    route: '/api/users',
    method: 'GET',
    component: 'users-api'
  }
)

// Decorador para clases
class UserService {
  @trackPerformance
  async createUser(userData: any) {
    // Automáticamente tracked
    return await this.database.create(userData)
  }
}
```

### Métricas Específicas

```typescript
// API Performance
PerformanceMonitor.trackAPIPerformance(
  '/api/tickets',
  'POST',
  250, // duration in ms
  201, // status code
  { userId: 'user123' }
)

// Database Performance
PerformanceMonitor.trackDatabasePerformance(
  'INSERT',
  150, // duration in ms
  'INSERT INTO tickets (title, description) VALUES (?, ?)',
  { userId: 'user123' }
)

// Cache Performance
PerformanceMonitor.trackCachePerformance(
  'hit', // 'hit' | 'miss' | 'set' | 'delete'
  'user:123',
  25, // optional duration
  { component: 'user-cache' }
)

// User Interaction
PerformanceMonitor.trackUserInteraction(
  'button_click',
  75, // duration in ms
  { userId: 'user123', page: '/dashboard' }
)

// System Resources
PerformanceMonitor.trackSystemResources() // Automatic memory/CPU tracking
```

## Dashboard de Performance

### Obtener Métricas

```bash
# Estadísticas generales
GET /api/admin/performance?type=stats&timeRange=24h

# Métricas detalladas
GET /api/admin/performance?type=metrics&timeRange=1h&component=api

# Alertas activas
GET /api/admin/performance?type=alerts

# Métricas agregadas
GET /api/admin/performance?type=aggregated
```

### Gestión de Performance

```bash
# Limpiar métricas antiguas
POST /api/admin/performance
{
  "action": "clear-old-metrics",
  "days": 30
}

# Registrar métrica personalizada
POST /api/admin/performance
{
  "action": "track-custom-metric",
  "name": "custom_operation",
  "type": "response_time",
  "value": 150,
  "unit": "ms",
  "context": { "component": "custom" }
}

# Obtener recursos del sistema
POST /api/admin/performance
{
  "action": "get-system-resources"
}
```

### Configuración de Performance

```bash
# Actualizar configuración
PUT /api/admin/performance/config
{
  "enabled": true,
  "sampleRate": 0.8,
  "enableRealTimeMonitoring": true,
  "thresholds": {
    "response_time": { "warning": 1000, "critical": 3000 },
    "database_query": { "warning": 500, "critical": 2000 }
  },
  "alerting": {
    "enabled": true,
    "webhookUrl": "https://hooks.slack.com/services/YOUR/WEBHOOK"
  }
}
```

## Umbrales y Alertas

### Umbrales por Defecto
- **Response Time**: Warning 1000ms, Critical 3000ms
- **Database Query**: Warning 500ms, Critical 2000ms
- **Cache Hit Rate**: Warning 80%, Critical 60%
- **Memory Usage**: Warning 80%, Critical 95%
- **Error Rate**: Warning 5%, Critical 10%

### Tipos de Alerta
- **Warning**: Rendimiento degradado
- **Critical**: Rendimiento crítico, requiere atención inmediata

### Cooldown de Alertas
- **Critical**: 5 minutos
- **Warning**: 15 minutos

## Estado de Implementación

- ✅ PerformanceMonitor completo con todas las métricas
- ✅ PerformanceMiddleware con tracking automático
- ✅ API de administración para dashboard
- ✅ Sistema de umbrales y alertas
- ✅ Agregación y análisis estadístico
- ✅ Integración con error tracking
- ✅ Tests comprehensivos (18 pruebas pasando)
- ✅ Documentación completa
- ✅ Variables de entorno configuradas

**Tarea 7.4 - Add Performance Monitoring: ✅ COMPLETADA**

## Health Checking

### Uso Básico

```typescript
import { HealthChecker, HealthStatus } from '@/lib/monitoring'

// Inicializar health checking
HealthChecker.initialize({
  enabled: true,
  checkInterval: 30, // segundos
  timeout: 5000, // ms
  checks: {
    database: true,
    redis: true,
    externalServices: true,
    filesystem: true,
    memory: true,
    disk: true
  }
})

// Realizar health checks manualmente
const systemHealth = await HealthChecker.performHealthChecks()
console.log('System Status:', systemHealth.overall)
console.log('Components:', systemHealth.components)

// Obtener estado actual
const currentHealth = HealthChecker.getSystemHealth()
```

### Health Checks Personalizados

```typescript
// Registrar health check personalizado
HealthChecker.registerCheck(
  'custom_service',
  'external',
  async () => {
    try {
      const response = await fetch('https://api.example.com/health')
      return {
        name: 'custom_service',
        component: 'external',
        status: response.ok ? HealthStatus.HEALTHY : HealthStatus.UNHEALTHY,
        responseTime: 150,
        timestamp: new Date(),
        message: `Service responded with ${response.status}`,
        metadata: { statusCode: response.status }
      }
    } catch (error) {
      return {
        name: 'custom_service',
        component: 'external',
        status: HealthStatus.UNHEALTHY,
        responseTime: 0,
        timestamp: new Date(),
        message: `Service check failed: ${error.message}`
      }
    }
  }
)
```

### Estados de Health Check

```typescript
enum HealthStatus {
  HEALTHY = 'healthy',     // Todo funcionando correctamente
  DEGRADED = 'degraded',   // Funcionando pero con problemas menores
  UNHEALTHY = 'unhealthy', // No funcionando, requiere atención
  UNKNOWN = 'unknown'      // Estado desconocido
}
```

### Componentes Monitoreados

#### Database Health Check
- Conectividad a PostgreSQL
- Rendimiento de consultas
- Estado del pool de conexiones
- Información de conexiones activas

#### Redis Health Check
- Conectividad al servidor Redis
- Operaciones básicas (SET/GET/DEL)
- Uso de memoria
- Latencia de operaciones

#### Filesystem Health Check
- Operaciones de lectura/escritura
- Acceso a directorios temporales
- Permisos de archivos
- Disponibilidad de espacio

#### Memory Health Check
- Uso de memoria heap
- Porcentaje de utilización
- Memoria externa y RSS
- Alertas por uso excesivo

#### Disk Health Check
- Acceso a filesystem
- Disponibilidad de disco
- Permisos de escritura
- Estado de directorios críticos

#### External Services Health Check
- Conectividad a servicios externos
- Latencia de respuesta
- Disponibilidad de APIs
- Timeouts configurables

## Dashboard de Health Check

### Obtener Estado del Sistema

```bash
# Estado general del sistema
GET /api/health

# Estado detallado (admin)
GET /api/admin/health?type=detailed

# Estado de componente específico
GET /api/admin/health?component=database

# Historial de health checks
GET /api/admin/health?type=history&limit=50
```

### Gestión de Health Checks

```bash
# Ejecutar health checks manualmente
POST /api/admin/health
{
  "action": "run-checks"
}

# Registrar health check personalizado
POST /api/admin/health
{
  "action": "register-check",
  "name": "custom_service",
  "component": "external",
  "checkFunction": "async () => { /* check logic */ }"
}

# Obtener configuración actual
GET /api/admin/health/config

# Actualizar configuración
PUT /api/admin/health/config
{
  "enabled": true,
  "checkInterval": 60,
  "timeout": 10000,
  "checks": {
    "database": true,
    "redis": true,
    "externalServices": false
  }
}
```

### Respuesta de Health Check

```json
{
  "overall": "healthy",
  "components": {
    "database_connectivity": {
      "name": "connectivity",
      "component": "database",
      "status": "healthy",
      "responseTime": 45,
      "timestamp": "2024-01-05T10:30:00Z",
      "message": "Database connection successful",
      "metadata": {
        "totalConnections": 5,
        "activeConnections": 2
      }
    },
    "redis_connectivity": {
      "name": "connectivity",
      "component": "redis",
      "status": "healthy",
      "responseTime": 12,
      "timestamp": "2024-01-05T10:30:00Z",
      "message": "Redis connection successful",
      "metadata": {
        "usedMemory": 1024000,
        "testResult": true
      }
    }
  },
  "summary": {
    "healthy": 6,
    "degraded": 0,
    "unhealthy": 0,
    "unknown": 0,
    "total": 6
  },
  "lastCheck": "2024-01-05T10:30:00Z",
  "uptime": 3600000
}
```

## Alertas de Health Check

### Configuración de Alertas

```typescript
// Alertas automáticas por fallos críticos
HealthChecker.initialize({
  alertOnFailure: true,
  enablePerformanceTracking: true
})
```

### Tipos de Alerta
- **UNHEALTHY**: Componente no funcional, alerta crítica inmediata
- **DEGRADED**: Componente con problemas, alerta de warning
- **HEALTHY**: Sin alertas

### Integración con Error Tracking
Los health checks fallidos se registran automáticamente como errores:
- Fallos críticos → ErrorType.SYSTEM, ErrorSeverity.HIGH
- Degradación → Log de warning en ApplicationLogger

## Estado de Implementación

- ✅ HealthChecker completo con todos los componentes
- ✅ Health checks para database, Redis, filesystem, memory, disk
- ✅ Health checks para servicios externos
- ✅ Sistema de health checks personalizados
- ✅ API pública de health check (/api/health)
- ✅ API de administración (/api/admin/health)
- ✅ Integración con error tracking y performance monitoring
- ✅ Alertas automáticas por fallos
- ✅ Tests comprehensivos (21 pruebas pasando)
- ✅ Documentación completa
- ✅ Variables de entorno configuradas

**Tarea 7.5 - Create Health Check System: ✅ COMPLETADA**

## Próximos Pasos

Con el health checking completado, el siguiente paso sería:
- **Tarea 7.6**: Configure Log Management