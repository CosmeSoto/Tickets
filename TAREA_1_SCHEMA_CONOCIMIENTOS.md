# TAREA 1: Schema de Base de Conocimientos

## Objetivo
Crear la estructura de base de datos para el sistema de conocimientos (artículos de soluciones).

## Archivos a Modificar
- `prisma/schema.prisma`

## Cambios a Realizar

### 1. Agregar Modelo knowledge_articles

```prisma
model knowledge_articles {
  id              String   @id @default(cuid())
  title           String
  content         String   // Solución detallada en Markdown
  summary         String?  // Resumen corto (max 200 chars)
  categoryId      String
  tags            String[] // Para búsqueda ["error-conexion", "vpn", "windows"]
  sourceTicketId  String?  @unique // Ticket del que se originó
  authorId        String   // Técnico que creó el artículo
  views           Int      @default(0)
  helpfulVotes    Int      @default(0)
  notHelpfulVotes Int      @default(0)
  isPublished     Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  // Relaciones
  category        categories @relation(fields: [categoryId], references: [id])
  author          users      @relation("knowledge_articles_author", fields: [authorId], references: [id])
  sourceTicket    tickets?   @relation("knowledge_articles_source", fields: [sourceTicketId], references: [id])
  votes           article_votes[]
  
  @@index([categoryId, isPublished])
  @@index([authorId, createdAt(sort: Desc)])
  @@index([views(sort: Desc)])
  @@index([helpfulVotes(sort: Desc)])
  @@index([title, content]) // Para búsqueda full-text
}

model article_votes {
  id        String   @id @default(cuid())
  articleId String
  userId    String
  isHelpful Boolean  // true = útil, false = no útil
  createdAt DateTime @default(now())
  
  article   knowledge_articles @relation(fields: [articleId], references: [id], onDelete: Cascade)
  user      users              @relation(fields: [userId], references: [id])
  
  @@unique([articleId, userId]) // Un usuario solo puede votar una vez por artículo
  @@index([articleId, isHelpful])
}
```

### 2. Actualizar Modelo users

Agregar relación:
```prisma
model users {
  // ... campos existentes ...
  
  // Agregar estas líneas
  knowledge_articles knowledge_articles[] @relation("knowledge_articles_author")
  article_votes      article_votes[]
}
```

### 3. Actualizar Modelo tickets

Agregar relación:
```prisma
model tickets {
  // ... campos existentes ...
  
  // Agregar esta línea
  knowledge_article knowledge_articles? @relation("knowledge_articles_source")
}
```

### 4. Actualizar Modelo categories

Agregar relación:
```prisma
model categories {
  // ... campos existentes ...
  
  // Agregar esta línea
  knowledge_articles knowledge_articles[]
}
```

## Comandos a Ejecutar

```bash
# 1. Crear migración
npx prisma migrate dev --name add_knowledge_base

# 2. Generar cliente Prisma
npx prisma generate

# 3. Verificar schema
npx prisma validate
```

## Datos de Ejemplo para Seed

Crear 5-10 artículos de conocimiento basados en tickets resueltos existentes:
- Problemas de conexión VPN
- Errores de impresora
- Problemas de acceso a sistemas
- Configuración de correo
- Reseteo de contraseñas

## Validación
- ✅ Migración ejecutada sin errores
- ✅ Relaciones correctas entre modelos
- ✅ Índices creados para búsqueda eficiente
- ✅ Datos de ejemplo insertados

## Siguiente Tarea
TAREA 2: API Endpoints para Conocimientos
