# Roadmap de Migración a Next.js - Recomendaciones Específicas

## 1. FASE 1: FUNDAMENTOS (Semana 1-2)

### 1.1 Configuración Base
```typescript
// Actualizar next.config.ts
const nextConfig = {
  typescript: {
    strictNullChecks: true,
    strict: true
  },
  experimental: {
    serverActions: true,
    typedRoutes: true
  }
};

// Instalar dependencias críticas
npm install @prisma/client prisma zod bcryptjs jsonwebtoken
npm install -D @types/jsonwebtoken
```

### 1.2 Estructura de Carpetas
```
src/
├── app/
│   ├── api/
│   │   ├── auth/
│   │   ├── tickets/
│   │   ├── categories/
│   │   └── admin/
│   ├── admin/
│   ├── technician/
│   ├── client/
│   └── layout.tsx
├── lib/
│   ├── services/
│   │   ├── ticketService.ts
│   │   ├── userService.ts
│   │   ├── categoryService.ts
│   │   └── ...
│   ├── middleware/
│   │   ├── auth.ts
│   │   ├── audit.ts
│   │   └── errorHandler.ts
│   ├── schemas/
│   │   ├── ticket.ts
│   │   ├── user.ts
│   │   └── ...
│   ├── utils/
│   │   ├── pagination.ts
│   │   ├── filters.ts
│   │   └── ...
│   ├── prisma.ts
│   └── auth.ts
├── components/
│   ├── layout/
│   ├── ui/
│   └── forms/
└── types/
    └── index.ts
```

### 1.3 Configurar Prisma
```typescript
// prisma/schema.prisma - Copiar del backend
// Ejecutar:
npx prisma generate
npx prisma migrate dev

// src/lib/prisma.ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ['query'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

---

## 2. FASE 2: AUTENTICACIÓN (Semana 2-3)

### 2.1 Implementar JWT
```typescript
// src/lib/auth.ts
import jwt from 'jsonwebtoken';

export interface JWTPayload {
  userId: string;
  email: string;
  role: 'ADMIN' | 'AGENT' | 'USER';
  iat: number;
  exp: number;
}

export function generateToken(payload: Omit<JWTPayload, 'iat' | 'exp'>) {
  return jwt.sign(payload, process.env.JWT_SECRET!, {
    expiresIn: '24h',
    issuer: 'sistema-tickets',
    audience: 'sistema-tickets-users'
  });
}

export function verifyToken(token: string): JWTPayload {
  return jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
}
```

### 2.2 Middleware de Autenticación
```typescript
// src/lib/middleware/auth.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

export async function requireAuth(request: NextRequest) {
  const token = request.headers.get('authorization')?.split(' ')[1];
  
  if (!token) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const payload = verifyToken(token);
    return payload;
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid token' },
      { status: 401 }
    );
  }
}
```

### 2.3 API de Login
```typescript
// src/app/api/auth/login/route.ts
import { prisma } from '@/lib/prisma';
import { generateToken } from '@/lib/auth';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = loginSchema.parse(body);

    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user || !user.passwordHash) {
      return Response.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return Response.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role
    });

    // Actualizar último login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() }
    });

    return Response.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    return Response.json(
      { error: 'Invalid request' },
      { status: 400 }
    );
  }
}
```

---

## 3. FASE 3: SERVICIOS CORE (Semana 3-4)

### 3.1 Servicio de Tickets
```typescript
// src/lib/services/ticketService.ts
import { prisma } from '@/lib/prisma';
import { Ticket, TicketStatus } from '@prisma/client';

export class TicketService {
  async create(data: {
    title: string;
    description: string;
    categoryId: string;
    clientId: string;
    priority?: string;
  }) {
    // Validar categoría
    const category = await prisma.categoryHierarchy.findUnique({
      where: { id: data.categoryId }
    });

    if (!category) throw new Error('Category not found');

    // Encontrar mejor técnico
    const assigneeId = await this.findBestTechnician(data.categoryId);

    // Crear ticket
    const ticket = await prisma.ticket.create({
      data: {
        title: data.title,
        description: data.description,
        clientId: data.clientId,
        hierarchyCategoryId: data.categoryId,
        priority: data.priority || 'MEDIUM',
        status: 'OPEN',
        assigneeId
      },
      include: {
        client: true,
        assignee: true,
        hierarchyCategory: true
      }
    });

    return ticket;
  }

  async findById(id: string) {
    return prisma.ticket.findUnique({
      where: { id },
      include: {
        client: true,
        assignee: true,
        hierarchyCategory: true,
        comments: {
          include: { author: true },
          orderBy: { createdAt: 'desc' }
        },
        attachments: true
      }
    });
  }

  async findMany(filters: any, page: number, limit: number) {
    const skip = (page - 1) * limit;

    const [tickets, total] = await Promise.all([
      prisma.ticket.findMany({
        where: filters,
        include: {
          client: true,
          assignee: true,
          hierarchyCategory: true
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.ticket.count({ where: filters })
    ]);

    return {
      tickets,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  async update(id: string, data: any, userId: string) {
    const oldTicket = await prisma.ticket.findUnique({
      where: { id }
    });

    if (!oldTicket) throw new Error('Ticket not found');

    return prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.update({
        where: { id },
        data,
        include: {
          client: true,
          assignee: true,
          hierarchyCategory: true
        }
      });

      // Registrar cambios en historial
      const changes = this.detectChanges(oldTicket, ticket);
      if (changes.length > 0) {
        await tx.ticketHistory.createMany({
          data: changes.map(change => ({
            ticketId: id,
            userId,
            ...change
          }))
        });
      }

      return ticket;
    });
  }

  private async findBestTechnician(categoryId: string): Promise<string | null> {
    const assignments = await prisma.technicianCategoryAssignment.findMany({
      where: {
        categoryId,
        isActive: true,
        autoAssign: true
      },
      include: { technician: true },
      orderBy: { priority: 'asc' }
    });

    if (assignments.length === 0) return null;

    // Calcular scores
    const scores = await Promise.all(
      assignments.map(async (a) => {
        const activeTickets = await prisma.ticket.count({
          where: {
            assigneeId: a.technicianId,
            status: { in: ['OPEN', 'IN_PROGRESS'] }
          }
        });

        if (a.maxTickets && activeTickets >= a.maxTickets) {
          return null;
        }

        return {
          technicianId: a.technicianId,
          score: (a.priority - 1) * 10 + activeTickets
        };
      })
    );

    const valid = scores.filter(Boolean).sort((a, b) => a.score - b.score);
    return valid[0]?.technicianId || null;
  }

  private detectChanges(oldTicket: any, newTicket: any) {
    const changes = [];

    if (oldTicket.status !== newTicket.status) {
      changes.push({
        action: 'STATUS_CHANGED',
        field: 'status',
        oldValue: oldTicket.status,
        newValue: newTicket.status
      });
    }

    if (oldTicket.priority !== newTicket.priority) {
      changes.push({
        action: 'PRIORITY_CHANGED',
        field: 'priority',
        oldValue: oldTicket.priority,
        newValue: newTicket.priority
      });
    }

    if (oldTicket.assigneeId !== newTicket.assigneeId) {
      changes.push({
        action: 'ASSIGNEE_CHANGED',
        field: 'assigneeId',
        oldValue: oldTicket.assigneeId,
        newValue: newTicket.assigneeId
      });
    }

    return changes;
  }
}

export const ticketService = new TicketService();
```

### 3.2 API Routes para Tickets
```typescript
// src/app/api/tickets/route.ts
import { ticketService } from '@/lib/services/ticketService';
import { requireAuth } from '@/lib/middleware/auth';
import { createTicketSchema } from '@/lib/schemas/ticket';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  const { searchParams } = new URL(request.url);

  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '10');

  const filters: any = {};

  if (user.role === 'USER') {
    filters.clientId = user.userId;
  } else if (user.role === 'AGENT') {
    filters.assigneeId = user.userId;
  }

  const result = await ticketService.findMany(filters, page, limit);

  return Response.json({ success: true, data: result });
}

export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  const body = await request.json();

  const validatedData = createTicketSchema.parse(body);

  const ticket = await ticketService.create({
    ...validatedData,
    clientId: user.userId
  });

  return Response.json({ success: true, data: ticket });
}
```

---

## 4. FASE 4: NOTIFICACIONES Y AUDITORÍA (Semana 4-5)

### 4.1 Servicio de Notificaciones
```typescript
// src/lib/services/notificationService.ts
import { prisma } from '@/lib/prisma';

export class NotificationService {
  async notifyTicketCreated(ticketId: string) {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { client: true, assignee: true }
    });

    if (!ticket) return;

    // Obtener preferencias del cliente
    const prefs = await prisma.notificationPreference.findUnique({
      where: { userId: ticket.clientId }
    });

    if (prefs?.emailEnabled) {
      // Enviar email
      await this.sendEmail({
        to: ticket.client.email,
        subject: `Ticket creado: ${ticket.title}`,
        template: 'ticket-created',
        data: { ticket }
      });
    }

    if (prefs?.teamsEnabled && ticket.assignee) {
      // Enviar a Teams
      await this.sendTeams({
        title: 'Nuevo Ticket Asignado',
        text: `${ticket.title} ha sido asignado a ${ticket.assignee.name}`
      });
    }
  }

  private async sendEmail(options: any) {
    // Implementar con Nodemailer o servicio externo
    console.log('Sending email:', options);
  }

  private async sendTeams(options: any) {
    // Implementar con webhook de Teams
    console.log('Sending Teams message:', options);
  }
}

export const notificationService = new NotificationService();
```

### 4.2 Middleware de Auditoría
```typescript
// src/lib/middleware/audit.ts
import { prisma } from '@/lib/prisma';
import { NextRequest } from 'next/server';

export async function auditAction(
  request: NextRequest,
  entity: string,
  action: string,
  userId: string
) {
  const body = await request.clone().json().catch(() => ({}));

  await prisma.auditLog.create({
    data: {
      entity,
      action,
      entityId: body.id || 'unknown',
      userId,
      userEmail: 'user@example.com',
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      newValues: body
    }
  });
}
```

---

## 5. FASE 5: REPORTES Y DASHBOARD (Semana 5-6)

### 5.1 Servicio de Reportes
```typescript
// src/lib/services/reportService.ts
import { prisma } from '@/lib/prisma';

export class ReportService {
  async generateReport(filters: any) {
    const tickets = await prisma.ticket.findMany({
      where: filters,
      include: {
        client: true,
        assignee: true,
        hierarchyCategory: true
      }
    });

    const metrics = {
      total: tickets.length,
      byStatus: this.groupBy(tickets, 'status'),
      byPriority: this.groupBy(tickets, 'priority'),
      averageResolutionTime: this.calcAvgResolutionTime(tickets)
    };

    return { metrics, tickets };
  }

  private groupBy(items: any[], key: string) {
    return items.reduce((acc, item) => {
      acc[item[key]] = (acc[item[key]] || 0) + 1;
      return acc;
    }, {});
  }

  private calcAvgResolutionTime(tickets: any[]) {
    const resolved = tickets.filter(t => t.resolvedAt);
    if (resolved.length === 0) return 0;

    const total = resolved.reduce((sum, t) => {
      const hours = (t.resolvedAt - t.createdAt) / (1000 * 60 * 60);
      return sum + hours;
    }, 0);

    return Math.round(total / resolved.length);
  }
}

export const reportService = new ReportService();
```

### 5.2 API de Reportes
```typescript
// src/app/api/reports/route.ts
import { reportService } from '@/lib/services/reportService';
import { requireAuth } from '@/lib/middleware/auth';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  const { searchParams } = new URL(request.url);

  const filters: any = {};

  if (user.role === 'AGENT') {
    filters.assigneeId = user.userId;
  } else if (user.role === 'USER') {
    filters.clientId = user.userId;
  }

  const report = await reportService.generateReport(filters);

  return Response.json({ success: true, data: report });
}
```

---

## 6. FASE 6: COMPONENTES FRONTEND (Semana 6-7)

### 6.1 Componente de Listado de Tickets
```typescript
// src/components/tickets/TicketList.tsx
'use client';

import { useEffect, useState } from 'react';
import { Ticket } from '@prisma/client';

export function TicketList() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetchTickets();
  }, [page]);

  async function fetchTickets() {
    setLoading(true);
    const response = await fetch(`/api/tickets?page=${page}&limit=10`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    const data = await response.json();
    setTickets(data.data.tickets);
    setLoading(false);
  }

  if (loading) return <div>Cargando...</div>;

  return (
    <div>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Título</th>
            <th>Estado</th>
            <th>Prioridad</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {tickets.map(ticket => (
            <tr key={ticket.id}>
              <td>{ticket.id}</td>
              <td>{ticket.title}</td>
              <td>{ticket.status}</td>
              <td>{ticket.priority}</td>
              <td>
                <a href={`/tickets/${ticket.id}`}>Ver</a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

---

## 7. CHECKLIST DE IMPLEMENTACIÓN

### Fase 1: Fundamentos
- [ ] Configurar estructura de carpetas
- [ ] Instalar dependencias
- [ ] Configurar Prisma
- [ ] Crear esquemas Zod

### Fase 2: Autenticación
- [ ] Implementar JWT
- [ ] Crear API de login
- [ ] Crear API de registro
- [ ] Implementar middleware de auth

### Fase 3: Servicios Core
- [ ] Servicio de tickets
- [ ] Servicio de usuarios
- [ ] Servicio de categorías
- [ ] API routes para tickets

### Fase 4: Notificaciones
- [ ] Servicio de notificaciones
- [ ] Middleware de auditoría
- [ ] Integración con email
- [ ] Integración con Teams

### Fase 5: Reportes
- [ ] Servicio de reportes
- [ ] API de reportes
- [ ] Exportación a PDF
- [ ] Exportación a Excel

### Fase 6: Frontend
- [ ] Componentes de listado
- [ ] Componentes de formularios
- [ ] Componentes de dashboard
- [ ] Componentes de reportes

---

## 8. VARIABLES DE ENTORNO

```env
# Base de datos
DATABASE_URL=postgresql://user:pass@localhost:5432/tickets

# JWT
JWT_SECRET=your-secret-key

# OAuth (si aplica)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...

# Teams
TEAMS_WEBHOOK_URL=...

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:3000
```

---

## 9. TESTING

```typescript
// src/__tests__/services/ticketService.test.ts
import { ticketService } from '@/lib/services/ticketService';
import { prisma } from '@/lib/prisma';

describe('TicketService', () => {
  it('should create a ticket', async () => {
    const ticket = await ticketService.create({
      title: 'Test Ticket',
      description: 'Test Description',
      categoryId: 'test-category-id',
      clientId: 'test-client-id'
    });

    expect(ticket).toBeDefined();
    expect(ticket.title).toBe('Test Ticket');
  });

  it('should find ticket by id', async () => {
    const ticket = await ticketService.findById('test-id');
    expect(ticket).toBeDefined();
  });
});
```

---

## 10. CONCLUSIÓN

Este roadmap proporciona una ruta clara para migrar el sistema de tickets a Next.js, manteniendo la arquitectura probada del backend mientras se aprovechan las características modernas de Next.js.

**Tiempo estimado total: 6-7 semanas**
**Equipo recomendado: 2-3 desarrolladores**
