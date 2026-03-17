# Instalación y Configuración

## Requisitos Previos

- Node.js 18+ (recomendado 20+)
- Docker y Docker Compose
- npm o yarn

## 1. Clonar el Repositorio

```bash
git clone https://github.com/CosmeSoto/Tickets.git
cd Tickets
```

## 2. Levantar Servicios con Docker

PostgreSQL, Redis y pgAdmin corren en contenedores Docker:

```bash
docker-compose up -d
```

Servicios disponibles:
| Servicio   | Puerto | Descripción                    |
|------------|--------|--------------------------------|
| PostgreSQL | 5432   | Base de datos principal         |
| Redis      | 6380   | Cache y colas                   |
| pgAdmin    | 8080   | Administrador visual de la BD   |

Credenciales pgAdmin:
- Email: `admin@tickets.local`
- Password: `admin123`

## 3. Configurar Variables de Entorno

```bash
cp .env.example .env
```

Variables mínimas requeridas:

```env
# Base de datos (coincide con docker-compose.yml)
DATABASE_URL="postgresql://tickets_user:tickets_password_2024@localhost:5432/tickets_db"

# NextAuth
NEXTAUTH_SECRET="genera-un-secret-aleatorio-aqui"
NEXTAUTH_URL="http://localhost:3000"

# Cron
CRON_SECRET="cambia-esto-en-produccion"

# Encriptación para credenciales OAuth
ENCRYPTION_KEY="genera-con-openssl-rand-base64-32"
```

Para generar secrets seguros:
```bash
openssl rand -base64 32   # Para NEXTAUTH_SECRET
openssl rand -base64 32   # Para ENCRYPTION_KEY
```

## 4. Instalar Dependencias

```bash
npm install
```

## 5. Configurar Base de Datos

```bash
# Generar cliente Prisma
npx prisma generate

# Sincronizar schema con la BD
npx prisma db push

# Cargar datos iniciales (admin, departamentos, catálogos, SLA, etc.)
npm run db:seed
```

## 6. Iniciar en Desarrollo

```bash
npm run dev
```

Acceder a http://localhost:3000

## Credenciales por Defecto

| Rol   | Email              | Contraseña |
|-------|--------------------|------------|
| Admin | admin@tickets.com  | admin123   |

## Resetear Base de Datos

Si necesitas empezar de cero:

```bash
npm run db:reset
```

Esto ejecuta `prisma db push --force-reset` + seed.

## Trabajar en Múltiples Computadoras

El proyecto usa Git para sincronización:

```bash
# Al llegar a otra computadora
git pull origin main
npm install                  # Si hubo cambios en package.json
npx prisma generate          # Si hubo cambios en schema.prisma
npx prisma db push           # Si hubo cambios en schema.prisma

# Al terminar de trabajar
git add -A
git commit -m "descripción"
git push origin main
```
