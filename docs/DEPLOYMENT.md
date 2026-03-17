# Despliegue con Docker

## Arquitectura

```
┌─────────────────────────────────────────────┐
│                  Docker                      │
│  ┌──────────┐ ┌───────┐ ┌────────────────┐  │
│  │PostgreSQL│ │ Redis │ │    pgAdmin      │  │
│  │  :5432   │ │ :6380 │ │     :8080       │  │
│  └──────────┘ └───────┘ └────────────────┘  │
└─────────────────────────────────────────────┘
         │            │
┌─────────────────────────────────────────────┐
│           Next.js App (local)                │
│              :3000                            │
└─────────────────────────────────────────────┘
```

## Desarrollo (docker-compose.yml)

```bash
# Levantar servicios
docker-compose up -d

# Ver estado
docker-compose ps

# Ver logs
docker-compose logs -f postgres
docker-compose logs -f redis

# Detener
docker-compose down

# Detener y eliminar datos (reset completo)
docker-compose down -v
```

## Volúmenes

Los datos persisten en volúmenes Docker:
- `postgres_data` — Datos de PostgreSQL
- `redis_data` — Datos de Redis
- `pgadmin_data` — Configuración de pgAdmin

Para eliminar todo y empezar limpio:
```bash
docker-compose down -v
docker-compose up -d
npx prisma db push
npm run db:seed
```

## Producción (docker-compose.prod.yml)

Para despliegue en producción, usar el archivo de producción:

```bash
docker-compose -f docker-compose.prod.yml up -d
```

Asegurarse de:
1. Cambiar todas las contraseñas en `.env`
2. Configurar `NEXTAUTH_URL` con el dominio real
3. Generar secrets seguros para `NEXTAUTH_SECRET` y `ENCRYPTION_KEY`
4. Configurar HTTPS (nginx/reverse proxy)

## Backup de Base de Datos

```bash
# Crear backup
docker exec tickets-postgres pg_dump -U tickets_user tickets_db > backup_$(date +%Y%m%d).sql

# Restaurar backup
docker exec -i tickets-postgres psql -U tickets_user tickets_db < backup.sql
```
