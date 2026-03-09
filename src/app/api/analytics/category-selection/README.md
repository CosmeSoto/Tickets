# Category Selection Analytics API

## Endpoint

`POST /api/analytics/category-selection`

## Description

Registra eventos de interacción del usuario con el selector de categorías para análisis y mejora continua. Este endpoint implementa validación completa, sanitización de datos sensibles y rate limiting para prevenir abuso.

## Authentication

Requiere autenticación mediante NextAuth session.

## Rate Limiting

- **Límite**: 100 eventos por minuto por usuario
- **Headers de respuesta**:
  - `X-RateLimit-Limit`: Número máximo de solicitudes permitidas
  - `X-RateLimit-Remaining`: Solicitudes restantes en la ventana actual
  - `X-RateLimit-Reset`: Timestamp cuando se resetea el límite
  - `Retry-After`: Segundos para reintentar (solo en respuestas 429)

## Request Body

```typescript
{
  eventType: string;        // Requerido - Tipo de evento
  categoryId?: string;      // Opcional - ID de categoría seleccionada
  searchQuery?: string;     // Opcional - Término de búsqueda
  timeToSelect?: number;    // Opcional - Tiempo en milisegundos
  metadata?: object;        // Opcional - Datos adicionales
}
```

### Event Types Válidos

- `search` - Usuario realizó una búsqueda
- `suggestion_click` - Usuario seleccionó una sugerencia
- `manual_select` - Usuario seleccionó manualmente navegando
- `frequent_select` - Usuario seleccionó de categorías frecuentes
- `category_change` - Usuario cambió la categoría después de seleccionar

## Response

### Success (200)

```json
{
  "success": true
}
```

### Validation Errors (400)

```json
{
  "success": false,
  "message": "Descripción del error de validación"
}
```

### Rate Limit Exceeded (429)

```json
{
  "success": false,
  "message": "Demasiadas solicitudes. Por favor, intenta más tarde.",
  "retryAfter": 60
}
```

### Server Error (500)

```json
{
  "success": false,
  "message": "Error al registrar evento de analytics",
  "error": "Detalles del error"
}
```

## Data Sanitization

El endpoint implementa sanitización automática para proteger la privacidad del usuario:

### Search Query Sanitization

- Limita longitud a 255 caracteres
- Elimina patrones sensibles:
  - Números de teléfono (reemplazados con `[REDACTED]`)
  - Direcciones de email (reemplazadas con `[REDACTED]`)
  - Números de tarjetas de crédito (reemplazados con `[REDACTED]`)
  - SSN (reemplazados con `[REDACTED]`)

### Metadata Sanitization

- Omite claves sensibles: `password`, `token`, `secret`, `apiKey`, `creditCard`, `ssn`, `email`, `phone`
- Limita strings a 500 caracteres
- Limita arrays a 10 elementos
- Aplana objetos anidados a un nivel

## Examples

### Registrar búsqueda

```bash
curl -X POST http://localhost:3000/api/analytics/category-selection \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "search",
    "searchQuery": "impresora no funciona"
  }'
```

### Registrar selección manual

```bash
curl -X POST http://localhost:3000/api/analytics/category-selection \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "manual_select",
    "categoryId": "cat-123",
    "timeToSelect": 5000,
    "metadata": {
      "source": "tree_navigation",
      "level": 3
    }
  }'
```

### Registrar clic en sugerencia

```bash
curl -X POST http://localhost:3000/api/analytics/category-selection \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "suggestion_click",
    "categoryId": "cat-456",
    "timeToSelect": 2000,
    "metadata": {
      "suggestionRank": 1,
      "relevanceScore": 0.95
    }
  }'
```

## Database Schema

Los eventos se almacenan en la tabla `category_analytics`:

```prisma
model category_analytics {
  id            String   @id @default(uuid())
  eventType     String   @map("event_type")
  clientId      String   @map("client_id")
  categoryId    String?  @map("category_id")
  searchQuery   String?  @map("search_query")
  timeToSelect  Int?     @map("time_to_select")
  metadata      Json?
  createdAt     DateTime @default(now()) @map("created_at")
  
  @@index([clientId, createdAt(sort: Desc)])
  @@index([eventType, createdAt(sort: Desc)])
  @@index([categoryId, createdAt(sort: Desc)])
}
```

## Security Considerations

1. **Authentication**: Solo usuarios autenticados pueden registrar eventos
2. **Rate Limiting**: Previene abuso con límite de 100 eventos/minuto
3. **Data Sanitization**: Elimina automáticamente datos sensibles
4. **Input Validation**: Valida todos los campos antes de persistir
5. **User Isolation**: Cada evento se asocia automáticamente al usuario autenticado

## Use Cases

Este endpoint soporta los siguientes casos de uso de análisis:

1. **Análisis de búsqueda**: Identificar términos comunes y búsquedas sin resultados
2. **Optimización de sugerencias**: Medir efectividad de las sugerencias automáticas
3. **Análisis de tiempo**: Identificar categorías que toman más tiempo en seleccionar
4. **Patrones de uso**: Entender qué métodos de selección prefieren los usuarios
5. **Mejora continua**: Identificar categorías confusas o mal organizadas

## Related Requirements

Este endpoint implementa los siguientes requisitos del spec:

- **10.1**: Registrar eventos de interacción (búsquedas, selecciones, cambios)
- **10.2**: Registrar tiempo de selección
- **10.3**: Registrar método de selección usado
- **10.4**: Registrar búsquedas sin resultados
- **10.5**: Registrar cambios de categoría
- **10.8**: Proporcionar datos agregados y anónimos
- **10.9**: Respetar privacidad del usuario (no registrar contenido sensible)
