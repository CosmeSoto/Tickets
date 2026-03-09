# Category Metadata API

## Endpoint

`GET /api/categories/metadata/:categoryId`

## Descripción

Retorna metadata contextual de una categoría para ayudar al usuario a tomar decisiones informadas durante la selección de categorías. Este endpoint es parte del sistema de mejora de selección de categorías.

## Autenticación

Requiere autenticación mediante sesión de NextAuth.

## Parámetros

### Path Parameters

- `categoryId` (string, requerido): ID de la categoría

## Respuesta Exitosa

**Status Code:** 200 OK

```json
{
  "success": true,
  "data": {
    "categoryId": "cat-123",
    "departmentName": "IT Support",
    "departmentColor": "#3B82F6",
    "averageResponseTimeHours": 3.5,
    "assignedTechniciansCount": 5,
    "recentTicketsCount": 15,
    "popularityScore": 75
  }
}
```

### Campos de Respuesta

- `categoryId` (string): ID de la categoría
- `departmentName` (string): Nombre del departamento asignado a la categoría
- `departmentColor` (string): Color hexadecimal del departamento
- `averageResponseTimeHours` (number | null): Tiempo promedio de primera respuesta en horas (basado en últimos 100 tickets resueltos)
- `assignedTechniciansCount` (number): Número de técnicos activos asignados a esta categoría
- `recentTicketsCount` (number): Número de tickets creados en los últimos 30 días
- `popularityScore` (number): Score de popularidad de 0-100 basado en el total de tickets históricos

## Errores

### 401 Unauthorized

```json
{
  "success": false,
  "message": "No autorizado"
}
```

### 400 Bad Request

```json
{
  "success": false,
  "message": "El parámetro categoryId es requerido"
}
```

o

```json
{
  "success": false,
  "message": "Categoría no activa"
}
```

### 404 Not Found

```json
{
  "success": false,
  "message": "Categoría no encontrada"
}
```

### 500 Internal Server Error

```json
{
  "success": false,
  "message": "Error al obtener metadata de la categoría",
  "error": "Detalles del error"
}
```

## Cálculos

### Tiempo de Respuesta Promedio

- Se calcula basándose en los últimos 100 tickets resueltos
- Mide el tiempo entre `createdAt` y `firstResponseAt`
- Se redondea a 1 decimal
- Retorna `null` si no hay tickets resueltos con tiempo de respuesta

### Score de Popularidad

- Usa escala logarítmica para distribución uniforme
- Basado en el total histórico de tickets de la categoría
- Fórmula: `min(100, round((log(totalTickets + 1) / log(1000 + 1)) * 100))`
- Rango: 0-100

### Tickets Recientes

- Cuenta tickets creados en los últimos 30 días
- Incluye tickets en cualquier estado

## Ejemplo de Uso

```typescript
const response = await fetch('/api/categories/metadata/cat-123', {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
  },
});

const { success, data } = await response.json();

if (success) {
  console.log(`Departamento: ${data.departmentName}`);
  console.log(`Técnicos asignados: ${data.assignedTechniciansCount}`);
  console.log(`Tiempo de respuesta promedio: ${data.averageResponseTimeHours}h`);
}
```

## Requisitos Relacionados

Este endpoint implementa los siguientes requisitos del spec:

- **6.4**: Mostrar tiempo de respuesta promedio conocido
- **6.5**: Mostrar departamento y tipo de técnicos asignados
- **6.11**: Mostrar estadísticas de la categoría

## Notas de Implementación

- Las consultas a la base de datos se ejecutan en paralelo para mejor rendimiento
- El endpoint valida que la categoría esté activa antes de retornar metadata
- Los cálculos están optimizados para minimizar el impacto en la base de datos
- El tiempo de respuesta promedio se limita a los últimos 100 tickets para mantener relevancia
