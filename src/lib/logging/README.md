# Sistema de Gestión de Logs

Sistema completo de gestión de logs que incluye rotación, retención, agregación, búsqueda, análisis y alertas basadas en logs.

## 🎯 Características Principales

### ✅ Gestión de Logs Completa
- **Rotación automática** de archivos de log por tamaño y tiempo
- **Retención configurable** con archivado automático
- **Compresión** de logs antiguos para ahorrar espacio
- **Limpieza automática** basada en políticas de retención

### ✅ Agregación y Búsqueda
- **Agregación en tiempo real** de métricas de logs
- **Búsqueda avanzada** con filtros múltiples
- **Análisis de patrones** automático
- **Detección de anomalías** en logs

### ✅ Sistema de Alertas
- **Alertas configurables** basadas en patrones y umbrales
- **Múltiples tipos de acción** (log, webhook, email)
- **Cooldown** para evitar spam de alertas
- **Alertas predefinidas** para casos comunes

### ✅ APIs de Administración
- **API REST completa** para gestión de logs
- **Búsqueda y análisis** vía API
- **Configuración dinámica** sin reiniciar
- **Métricas en tiempo real**

## 📁 Estructura del Sistema

```
src/lib/logging/
├── logger.ts                      # Logger base con contexto
├── application-logger.ts          # Logger específico de aplicación
├── config.ts                      # Configuración del sistema
├── log-manager.ts                 # Gestión de rotación, retención y alertas
├── log-aggregator.ts              # Agregación, búsqueda y análisis
├── log-integration-middleware.ts  # Middleware de integración
├── api-logging-middleware.ts      # Middleware para APIs
└── index.ts                       # Exportaciones principales
```

## 🚀 Uso Básico

### Logging Simple
```typescript
import { logger, ApplicationLogger } from '@/lib/logging';

// Logging básico
logger.info('Mensaje informativo');
logger.error('Error crítico', { userId: '123' }, error);

// Logging de aplicación
ApplicationLogger.apiRequestStart('GET', '/api/users');
ApplicationLogger.databaseOperationComplete('SELECT', 'users', 150, 10);
ApplicationLogger.securityEvent('failed_login', 'medium', { ip: '192.168.1.1' });
```

### Middleware de Integración
```typescript
import { withLogIntegration } from '@/lib/logging';

// Envolver handler de API
export const GET = withLogIntegration(async (request: NextRequest) => {
  // Tu lógica aquí
  return NextResponse.json({ data: 'success' });
});

// Timer de performance
const timer = createTimer('database_query', 'database');
await performDatabaseQuery();
const duration = timer.end({ query: 'SELECT * FROM users' });
```

### Gestión de Logs
```typescript
import { logManager } from '@/lib/logging';

// Configurar rotación
logManager.updateConfiguration({
  rotation: {
    maxFileSize: 100 * 1024 * 1024, // 100MB
    maxFiles: 10,
    rotateDaily: true,
    compressOldLogs: true
  }
});

// Agregar alerta personalizada
logManager.addAlert({
  id: 'custom_alert',
  name: 'Error Rate Alert',
  condition: {
    type: 'threshold',
    pattern: /ERROR/,
    threshold: 10,
    timeWindow: 300000 // 5 minutos
  },
  actions: [
    { type: 'log', config: { level: 'error' } },
    { type: 'webhook', config: { url: 'https://hooks.slack.com/...' } }
  ],
  enabled: true,
  cooldown: 600000 // 10 minutos
});
```

### Búsqueda y Análisis
```typescript
import { logAggregator } from '@/lib/logging';

// Búsqueda avanzada
const searchResult = logAggregator.searchLogs({
  levels: ['ERROR', 'WARN'],
  components: ['api', 'database'],
  startDate: new Date(Date.now() - 3600000), // 1 hora atrás
  endDate: new Date(),
  searchText: 'authentication',
  limit: 100,
  sortBy: 'timestamp',
  sortOrder: 'desc'
});

// Análisis de logs
const analysis = logAggregator.analyzeLogs({
  start: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 horas
  end: new Date()
});

console.log('Total logs:', analysis.totalEntries);
console.log('Error rate:', analysis.errorRate);
console.log('Recommendations:', analysis.recommendations);
```

## 🔧 Configuración

### Variables de Entorno
```bash
# Nivel de logging
LOG_LEVEL=INFO

# Formato de logs (json|pretty)
LOG_FORMAT=json

# Configuración de rotación
LOG_MAX_FILE_SIZE=104857600  # 100MB
LOG_MAX_FILES=10
LOG_RETENTION_DAYS=30

# Ruta de archivo de logs
LOG_ARCHIVE_PATH=./logs/archive
```

### Configuración Programática
```typescript
import { logManager } from '@/lib/logging';

logManager.updateConfiguration({
  rotation: {
    maxFileSize: 200 * 1024 * 1024, // 200MB
    maxFiles: 15,
    rotateDaily: true,
    compressOldLogs: true
  },
  retention: {
    retentionDays: 60,
    archiveOldLogs: true,
    archivePath: '/var/log/archive'
  },
  aggregation: {
    enabled: true,
    batchSize: 1000,
    flushInterval: 60000 // 1 minuto
  }
});
```

## 📊 APIs de Administración

### Métricas de Logs
```bash
# Obtener métricas generales
GET /api/admin/logs

# Métricas con rango de tiempo
GET /api/admin/logs?startDate=2024-01-01T00:00:00Z&endDate=2024-01-02T00:00:00Z
```

### Búsqueda de Logs
```bash
# Búsqueda básica
GET /api/admin/logs/search?levels=ERROR,WARN&limit=100

# Búsqueda avanzada
POST /api/admin/logs/search
{
  "levels": ["ERROR", "WARN"],
  "components": ["api", "database"],
  "searchText": "authentication failed",
  "startDate": "2024-01-01T00:00:00Z",
  "endDate": "2024-01-02T00:00:00Z",
  "limit": 100,
  "sortBy": "timestamp",
  "sortOrder": "desc"
}
```

### Análisis de Logs
```bash
# Análisis general
GET /api/admin/logs/analyze

# Análisis con rango específico
GET /api/admin/logs/analyze?startDate=2024-01-01T00:00:00Z&endDate=2024-01-02T00:00:00Z
```

### Gestión de Alertas
```bash
# Agregar alerta
POST /api/admin/logs
{
  "action": "add_alert",
  "alert": {
    "id": "high_error_rate",
    "name": "High Error Rate",
    "condition": {
      "type": "threshold",
      "pattern": "ERROR",
      "threshold": 10,
      "timeWindow": 300000
    },
    "actions": [
      { "type": "log", "config": { "level": "error" } }
    ],
    "enabled": true,
    "cooldown": 600000
  }
}

# Eliminar alerta
POST /api/admin/logs
{
  "action": "remove_alert",
  "alertId": "high_error_rate"
}

# Activar/desactivar alerta
POST /api/admin/logs
{
  "action": "toggle_alert",
  "alertId": "high_error_rate",
  "enabled": false
}
```

### Operaciones de Mantenimiento
```bash
# Rotar logs manualmente
POST /api/admin/logs
{
  "action": "rotate_logs",
  "logPath": "/var/log/app.log"
}

# Limpiar logs antiguos
POST /api/admin/logs
{
  "action": "cleanup_logs",
  "logDir": "/var/log"
}

# Actualizar configuración
POST /api/admin/logs
{
  "action": "update_config",
  "config": {
    "rotation": {
      "maxFileSize": 200000000,
      "maxFiles": 15
    }
  }
}
```

## 🎨 Patrones de Logs Predefinidos

El sistema incluye patrones predefinidos para detectar:

- **Intentos de inyección SQL**
- **Fallos de autenticación**
- **Errores de conexión a base de datos**
- **Advertencias de memoria**
- **Consultas lentas**
- **Límites de rate limiting**
- **Errores de subida de archivos**
- **Fallos de token CSRF**

### Agregar Patrones Personalizados
```typescript
logAggregator.addPattern({
  id: 'custom_error_pattern',
  name: 'Custom Error Pattern',
  pattern: /CUSTOM_ERROR_\d+/,
  description: 'Detects custom application errors',
  severity: 'high',
  enabled: true
});
```

## 📈 Métricas y Análisis

### Métricas Disponibles
- **Total de logs** por período
- **Distribución por nivel** (ERROR, WARN, INFO, etc.)
- **Distribución por componente**
- **Tasa de errores**
- **Tiempo promedio de respuesta**
- **Top errores más frecuentes**
- **Eventos de seguridad**

### Recomendaciones Automáticas
El sistema genera recomendaciones basadas en:
- Tasa de errores alta
- Tiempos de respuesta lentos
- Múltiples fallos de autenticación
- Actividad sospechosa
- Patrones de seguridad críticos

## 🔒 Seguridad

### Protección de Datos Sensibles
- **Sanitización automática** de datos sensibles
- **Exclusión de headers** de autenticación
- **Truncado de logs grandes** para evitar ataques
- **Validación de entrada** en todas las APIs

### Control de Acceso
- **Autenticación requerida** para APIs de administración
- **Rol de administrador** necesario para gestión
- **Logging de accesos** a funciones administrativas

## 🧪 Testing

### Ejecutar Pruebas
```bash
# Todas las pruebas de logging
npm test -- --testPathPattern=logging

# Pruebas específicas
npm test log-manager.test.ts
npm test log-aggregator.test.ts
npm test api/admin/logs.test.ts
```

### Cobertura de Pruebas
- ✅ **LogManager**: Gestión de alertas, configuración, métricas
- ✅ **LogAggregator**: Búsqueda, análisis, patrones
- ✅ **APIs**: Autenticación, autorización, validación
- ✅ **Middleware**: Integración, captura automática

## 🚀 Próximas Mejoras

### Funcionalidades Planificadas
- [ ] **Dashboard visual** para métricas de logs
- [ ] **Exportación** de logs en múltiples formatos
- [ ] **Integración con Elasticsearch** para búsqueda avanzada
- [ ] **Machine Learning** para detección de anomalías
- [ ] **Alertas por email/SMS** reales
- [ ] **Compresión avanzada** con algoritmos optimizados

### Optimizaciones
- [ ] **Streaming** de logs para volúmenes altos
- [ ] **Particionado** de datos por fecha
- [ ] **Índices optimizados** para búsquedas rápidas
- [ ] **Cache distribuido** para métricas

## 📚 Documentación Adicional

- [Configuración Avanzada](./docs/advanced-configuration.md)
- [Guía de Troubleshooting](./docs/troubleshooting.md)
- [API Reference](./docs/api-reference.md)
- [Ejemplos de Uso](./docs/examples.md)

---

**Nota**: Este sistema está diseñado para ser escalable y mantenible. Para entornos de producción de alto volumen, considera implementar las optimizaciones sugeridas y usar sistemas especializados como ELK Stack o Grafana Loki.