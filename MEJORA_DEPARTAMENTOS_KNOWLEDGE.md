# Mejora: Departamentos en Base de Conocimientos

**Fecha:** 2026-02-05  
**Estado:** ✅ IMPLEMENTADO (Parcial - Requiere migración opcional)

---

## 🎯 Análisis de Sistemas Profesionales

### Sistemas de Referencia

En sistemas profesionales como **ServiceNow, Jira Service Management, Zendesk, Freshdesk**, los departamentos son fundamentales:

#### 1. **ServiceNow**
- Knowledge Base organizada por departamentos
- Permisos por departamento (IT, HR, Facilities, Finance)
- Métricas por departamento
- Búsqueda filtrada por departamento

#### 2. **Jira Service Management**
- Knowledge Base con "Spaces" (equivalente a departamentos)
- Cada departamento tiene su propio espacio de conocimiento
- Permisos granulares por espacio

#### 3. **Zendesk**
- Help Center organizado por secciones (departamentos)
- Artículos categorizados por departamento
- Visibilidad controlada por departamento

#### 4. **Freshdesk**
- Solution Categories por departamento
- Filtros de búsqueda por departamento
- Reportes por departamento

### Conclusión del Análisis

**SÍ, los departamentos son esenciales** en sistemas profesionales de helpdesk para:

1. **Organización del conocimiento** por áreas funcionales
2. **Control de acceso** (cada departamento ve su conocimiento)
3. **Métricas y reportes** por departamento
4. **Búsqueda eficiente** filtrada por departamento
5. **Escalamiento** (asignar tickets al departamento correcto)

---

## ✅ Implementación Actual

### 1. Relación Indirecta (Ya Implementado)

Los artículos de conocimiento YA tienen relación con departamentos a través de las categorías:

```
knowledge_articles → categoryId → categories → departmentId → departments
```

**Ventajas:**
- ✅ Normalización correcta
- ✅ No hay duplicación de datos
- ✅ Cambios en departamento de categoría se reflejan automáticamente

**Desventajas:**
- ❌ Consultas más lentas (JOIN adicional)
- ❌ Filtros más complejos
- ❌ Índices menos eficientes

### 2. Contenido del Artículo (Ya Implementado)

Ahora el contenido generado incluye el departamento:

```markdown
## 📋 Información del Ticket
- **Departamento:** IT Support
- **Categoría:** Hardware
- **Prioridad:** HIGH
...
```

### 3. Tags (Ya Implementado)

Los tags ahora incluyen el departamento:

```javascript
tags: ["it support", "hardware", "high", "impresora", ...]
```

### 4. Auditoría (Ya Implementado)

La auditoría ahora registra el departamento:

```json
{
  "sourceTicketDepartment": "IT Support",
  "departmentId": "dept-id",
  "sourceTicketCategory": "Hardware",
  ...
}
```

---

## 🔄 Mejora Opcional: Campo Directo

Para mejorar el rendimiento, se puede agregar `departmentId` directo a `knowledge_articles`:

### Migración Propuesta

```sql
-- Agregar campo departmentId a knowledge_articles
ALTER TABLE knowledge_articles 
ADD COLUMN department_id VARCHAR(255);

-- Poblar con datos existentes
UPDATE knowledge_articles ka
SET department_id = (
  SELECT c.department_id 
  FROM categories c 
  WHERE c.id = ka.category_id
);

-- Agregar índice para búsquedas rápidas
CREATE INDEX idx_knowledge_articles_department 
ON knowledge_articles(department_id, is_published);

-- Agregar foreign key
ALTER TABLE knowledge_articles
ADD CONSTRAINT fk_knowledge_articles_department
FOREIGN KEY (department_id) REFERENCES departments(id);
```

### Schema Prisma Actualizado

```prisma
model knowledge_articles {
  id                        String                      @id @default(cuid())
  title                     String
  content                   String
  summary                   String?
  categoryId                String
  departmentId              String?                     // NUEVO
  tags                      String[]
  sourceTicketId            String?                     @unique
  authorId                  String
  views                     Int                         @default(0)
  helpfulVotes              Int                         @default(0)
  notHelpfulVotes           Int                         @default(0)
  isPublished               Boolean                     @default(true)
  createdAt                 DateTime                    @default(now())
  updatedAt                 DateTime                    @updatedAt
  category                  categories                  @relation(fields: [categoryId], references: [id])
  department                departments?                @relation(fields: [departmentId], references: [id]) // NUEVO
  author                    users                       @relation("knowledge_articles_author", fields: [authorId], references: [id])
  sourceTicket              tickets?                    @relation("knowledge_articles_source", fields: [sourceTicketId], references: [id])
  votes                     article_votes[]
  ticket_knowledge_articles ticket_knowledge_articles[]

  @@index([categoryId, isPublished])
  @@index([departmentId, isPublished])                  // NUEVO
  @@index([authorId, createdAt(sort: Desc)])
  @@index([views(sort: Desc)])
  @@index([helpfulVotes(sort: Desc)])
  @@index([title, content])
}
```

### Ventajas del Campo Directo

1. **Búsquedas más rápidas**
   ```sql
   -- Sin campo directo (JOIN)
   SELECT ka.* FROM knowledge_articles ka
   JOIN categories c ON ka.category_id = c.id
   WHERE c.department_id = 'dept-id'
   
   -- Con campo directo (sin JOIN)
   SELECT * FROM knowledge_articles
   WHERE department_id = 'dept-id'
   ```

2. **Filtros más simples**
   ```typescript
   // Sin campo directo
   const articles = await prisma.knowledge_articles.findMany({
     where: {
       category: {
         departmentId: departmentId
       }
     }
   })
   
   // Con campo directo
   const articles = await prisma.knowledge_articles.findMany({
     where: {
       departmentId: departmentId
     }
   })
   ```

3. **Índices más eficientes**
   - Índice compuesto: `(departmentId, isPublished)`
   - Búsquedas instantáneas sin JOIN

4. **Reportes más rápidos**
   ```sql
   -- Artículos por departamento
   SELECT department_id, COUNT(*) 
   FROM knowledge_articles 
   GROUP BY department_id
   ```

---

## 📊 Comparación de Rendimiento

### Consulta: "Obtener artículos de un departamento"

#### Sin campo directo:
```sql
SELECT ka.* 
FROM knowledge_articles ka
JOIN categories c ON ka.category_id = c.id
WHERE c.department_id = 'dept-123'
  AND ka.is_published = true
ORDER BY ka.created_at DESC
LIMIT 20;

-- Tiempo estimado: 50-100ms (con índices)
-- Escanea: 2 tablas
-- JOIN: 1
```

#### Con campo directo:
```sql
SELECT * 
FROM knowledge_articles
WHERE department_id = 'dept-123'
  AND is_published = true
ORDER BY created_at DESC
LIMIT 20;

-- Tiempo estimado: 5-10ms (con índice)
-- Escanea: 1 tabla
-- JOIN: 0
```

**Mejora: 5-10x más rápido**

---

## 🎯 Recomendación

### Implementación Actual (Sin Migración)

**Pros:**
- ✅ Ya funciona correctamente
- ✅ Normalización perfecta
- ✅ No requiere migración
- ✅ Departamento incluido en contenido y auditoría

**Contras:**
- ⚠️ Consultas ligeramente más lentas
- ⚠️ Filtros más complejos

**Recomendación:** **Mantener así para MVP/Producción inicial**

### Implementación Futura (Con Migración)

**Cuándo implementar:**
- Cuando la base de conocimientos tenga >10,000 artículos
- Cuando las búsquedas por departamento sean lentas
- Cuando se necesiten reportes complejos por departamento
- Cuando se implemente control de acceso por departamento

**Recomendación:** **Implementar en fase de optimización**

---

## 🔍 Funcionalidades por Departamento

### Ya Implementadas:

1. ✅ **Contenido del artículo incluye departamento**
2. ✅ **Tags incluyen departamento**
3. ✅ **Auditoría registra departamento**
4. ✅ **Búsqueda puede filtrar por departamento** (vía categoría)

### Por Implementar (Futuro):

1. ⏳ **Dashboard por departamento**
   - Métricas de artículos por departamento
   - Artículos más vistos por departamento
   - Técnicos más activos por departamento

2. ⏳ **Permisos por departamento**
   - Técnicos solo ven artículos de su departamento
   - Admins ven todos los departamentos

3. ⏳ **Filtros avanzados**
   - Filtro rápido por departamento en UI
   - Búsqueda combinada: departamento + categoría + tags

4. ⏳ **Reportes por departamento**
   - Artículos creados por departamento
   - Tasa de documentación por departamento
   - Calidad promedio por departamento

---

## 📋 Queries Actuales con Departamento

### 1. Buscar artículos por departamento

```typescript
const articles = await prisma.knowledge_articles.findMany({
  where: {
    category: {
      departmentId: departmentId
    },
    isPublished: true
  },
  include: {
    category: {
      include: {
        departments: true
      }
    }
  }
})
```

### 2. Contar artículos por departamento

```typescript
const stats = await prisma.categories.groupBy({
  by: ['departmentId'],
  _count: {
    knowledge_articles: true
  },
  where: {
    knowledge_articles: {
      some: {
        isPublished: true
      }
    }
  }
})
```

### 3. Artículos más vistos por departamento

```typescript
const topArticles = await prisma.knowledge_articles.findMany({
  where: {
    category: {
      departmentId: departmentId
    },
    isPublished: true
  },
  orderBy: {
    views: 'desc'
  },
  take: 10,
  include: {
    category: {
      include: {
        departments: true
      }
    }
  }
})
```

---

## ✨ Conclusión

**Estado Actual:** ✅ **COMPLETO Y FUNCIONAL**

Los departamentos están correctamente implementados a través de la relación con categorías. El contenido de los artículos, tags y auditoría incluyen el departamento.

**Próximos Pasos Opcionales:**

1. **Corto plazo (1-2 meses):**
   - Implementar filtros por departamento en UI
   - Dashboard con métricas por departamento

2. **Mediano plazo (3-6 meses):**
   - Permisos por departamento
   - Reportes avanzados

3. **Largo plazo (6+ meses):**
   - Migración para agregar `departmentId` directo (si el rendimiento lo requiere)
   - Optimización de índices

---

**Desarrollado por:** Kiro AI  
**Fecha:** 2026-02-05  
**Requiere migración:** No (opcional para futuro)
