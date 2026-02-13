# Patrones Avanzados y Guía de Implementación

## 1. PATRÓN DE SERVICIO REUTILIZABLE

### Estructura Base para Servicios

```typescript
// src/lib/services/baseService.ts
export abstract class BaseService<T> {
  constructor(protected prisma: PrismaClient) {}

  async findById(id: string): Promise<T | null> {
    // Implementación común
  }

  async findMany(filters: any, pagination: any): Promise<{
    items: T[];
    total: number;
    page: number;
    limit: number;
  }> {
    // Implementación común
  }

  async create(data: any): Promise<T> {
    // Implementación común
  }

  async update(id: string, data: any): Promise<T> {
    // Implementación común
  }

  async delete(id: string): Promise<void> {
    // Implementación común
  }
}
```

### Servicio de Tickets Específico

```typescript
// src/lib/services/ticketService.ts
export class TicketService extends BaseService<Ticket> {
  async create(data: CreateTicketData): Promise<Ticket> {
    // Validaciones específicas
    if (!data.title?.trim()) throw new Error('Title required');
    
    // Asignación inteligente
    const assigneeId = await this.findBestTechnician(data.categoryId);
    
    // Crear con transacción
    return this.prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.create({
        data: {
          ...data,
          assigneeId,
          status: 'OPEN'
        },
        include: { client: true, assignee: true }
      });

      // Registrar en auditoría
      await this.auditLog('TICKET_CREATED', ticket.id, null, ticket);
      
      // Enviar notificaciones
      await this.notifyTicketCreated(ticket);
      
      return ticket;
    });
  }

  private async findBestTechnician(categoryId: string): Promise<string | null> {
    // Implementar algoritmo de asignación inteligente
  }

  private async auditLog(action: string, entityId: string, oldVal: any, newVal: any) {
    // Registrar cambios
  }

  private async notifyTicketCreated(ticket: Ticket) {
    // Enviar notificaciones
  }
}
```

---

## 2. PATRÓN DE VALIDACIÓN CON ZOD

### Esquemas Reutilizables

```typescript
// src/lib/schemas/ticket.ts
import { z } from 'zod';

export const createTicketSchema = z.object({
  title: z.string().min(5).max(200),
  description: z.string().min(10).max(5000),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  categoryId: z.string().uuid(),
  clientId: z.string().uuid(),
});

export const updateTicketSchema = createTicketSchema.partial().extend({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']).optional(),
  assigneeId: z.string().uuid().nullable().optional(),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;
```

### Uso en API Routes

```typescript
// src/app/api/tickets/route.ts
import { createTicketSchema } from '@/lib/schemas/ticket';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Validar con Zod
    const validatedData = createTicketSchema.parse(body);
    
    // Usar servicio
    const ticket = await ticketService.create(validatedData);
    
    return Response.json({ success: true, data: ticket });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { success: false, errors: error.errors },
        { status: 400 }
      );
    }
    throw error;
  }
}
```

---

## 3. PATRÓN DE AUDITORÍA

### Middleware de Auditoría

```typescript
// src/lib/middleware/auditMiddleware.ts
export async function auditAction(
  entity: string,
  action: string
) {
  return async (request: Request) => {
    const user = await getSession();
    const body = await request.clone().json().catch(() => ({}));
    
    const auditLog = {
      entity,
      action,
      userId: user?.id,
      userEmail: user?.email,
      ipAddress: request.headers.get('x-forwarded-for'),
      userAgent: request.headers.get('user-agent'),
      timestamp: new Date(),
      data: body
    };

    // Guardar en BD
    await prisma.auditLog.create({ data: auditLog });
    
    return auditLog;
  };
}
```

### Uso en API Routes

```typescript
// src/app/api/tickets/[id]/route.ts
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const audit = await auditAction('Ticket', 'UPDATE')(request);
  
  const body = await request.json();
  const ticket = await ticketService.update(params.id, body);
  
  // Registrar cambios
  await prisma.auditLog.update({
    where: { id: audit.id },
    data: { newValues: ticket }
  });
  
  return Response.json({ success: true, data: ticket });
}
```

---

## 4. PATRÓN DE NOTIFICACIONES

### Servicio Unificado

```typescript
// src/lib/services/notificationService.ts
export class NotificationService {
  async notifyTicketCreated(ticket: Ticket, user: User) {
    const preferences = await this.getUserPreferences(user.id);
    
    const tasks = [];
    
    if (preferences.emailEnabled) {
      tasks.push(this.sendEmail({
        to: user.email,
        template: 'ticket-created',
        data: { ticket }
      }));
    }
    
    if (preferences.teamsEnabled) {
      tasks.push(this.sendTeams({
        webhook: process.env.TEAMS_WEBHOOK,
        message: this.formatTeamsMessage(ticket)
      }));
    }
    
    // Ejecutar en paralelo sin bloquear
    await Promise.allSettled(tasks);
  }

  async notifyStatusChange(
    ticket: Ticket,
    oldStatus: string,
    newStatus: string
  ) {
    // Lógica similar
  }

  private async sendEmail(options: EmailOptions) {
    // Usar Bull Queue para procesamiento asincrónico
    await emailQueue.add('send', options);
  }

  private async sendTeams(options: TeamsOptions) {
    // Enviar webhook a Teams
  }
}
```

---

## 5. PATRÓN DE ASIGNACIÓN INTELIGENTE

### Algoritmo de Balanceo

```typescript
// src/lib/services/assignmentService.ts
export class AssignmentService {
  async findBestTechnician(categoryId: string): Promise<string | null> {
    // Obtener técnicos asignados a la categoría
    const assignments = await prisma.technicianCategoryAssignment.findMany({
      where: {
        categoryId,
        isActive: true,
        autoAssign: true,
        technician: { isActive: true }
      },
      include: { technician: true },
      orderBy: { priority: 'asc' }
    });

    if (assignments.length === 0) return null;

    // Calcular score para cada técnico
    const scores = await Promise.all(
      assignments.map(async (assignment) => {
        const activeTickets = await prisma.ticket.count({
          where: {
            assigneeId: assignment.technicianId,
            status: { in: ['OPEN', 'IN_PROGRESS'] }
          }
        });

        // Verificar límite
        if (assignment.maxTickets && activeTickets >= assignment.maxTickets) {
          return null;
        }

        // Score: (priority - 1) * 10 + activeTickets
        const score = (assignment.priority - 1) * 10 + activeTickets;
        
        return {
          technicianId: assignment.technicianId,
          score,
          priority: assignment.priority,
          activeTickets
        };
      })
    );

    // Filtrar nulos y ordenar
    const validScores = scores.filter(Boolean).sort((a, b) => a.score - b.score);
    
    return validScores[0]?.technicianId || null;
  }
}
```

---

## 6. PATRÓN DE CACHÉ CON REVALIDACIÓN

### Uso de Next.js Caching

```typescript
// src/app/api/categories/hierarchy/route.ts
import { revalidateTag } from 'next/cache';

export async function GET(request: Request) {
  // Usar caché con tag
  const hierarchy = await fetch(
    'http://localhost:3001/api/categories/hierarchy',
    {
      next: { tags: ['categories-hierarchy'], revalidate: 3600 }
    }
  ).then(r => r.json());

  return Response.json(hierarchy);
}

export async function POST(request: Request) {
  const body = await request.json();
  
  // Crear categoría
  const newCategory = await categoryService.create(body);
  
  // Invalidar caché
  revalidateTag('categories-hierarchy');
  
  return Response.json({ success: true, data: newCategory });
}
```

---

## 7. PATRÓN DE REPORTES

### Generador de Reportes

```typescript
// src/lib/services/reportService.ts
export class ReportService {
  async generateReport(filters: ReportFilters) {
    // Obtener datos
    const tickets = await this.getTickets(filters);
    
    // Calcular métricas
    const metrics = this.calculateMetrics(tickets);
    
    return {
      metrics,
      tickets,
      generatedAt: new Date()
    };
  }

  async exportPDF(report: Report): Promise<Buffer> {
    const html = this.generateHTML(report);
    
    // Usar Puppeteer
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.setContent(html);
    
    const pdf = await page.pdf({ format: 'A4' });
    await browser.close();
    
    return pdf;
  }

  async exportExcel(report: Report): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Reporte');
    
    // Agregar datos
    sheet.columns = [
      { header: 'ID', key: 'id' },
      { header: 'Título', key: 'title' },
      // ...
    ];
    
    report.tickets.forEach(ticket => {
      sheet.addRow(ticket);
    });
    
    return workbook.xlsx.writeBuffer();
  }

  private calculateMetrics(tickets: Ticket[]) {
    return {
      total: tickets.length,
      byStatus: this.groupBy(tickets, 'status'),
      byPriority: this.groupBy(tickets, 'priority'),
      averageResolutionTime: this.calcAvgResolutionTime(tickets)
    };
  }
}
```

---

## 8. PATRÓN DE MANEJO DE ERRORES

### Error Handler Centralizado

```typescript
// src/lib/errors/appError.ts
export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number,
    public code: string
  ) {
    super(message);
  }
}

// src/lib/errors/errorHandler.ts
export function handleError(error: unknown) {
  if (error instanceof AppError) {
    return Response.json(
      { success: false, error: error.message, code: error.code },
      { status: error.statusCode }
    );
  }

  if (error instanceof z.ZodError) {
    return Response.json(
      { success: false, error: 'Validation error', details: error.errors },
      { status: 400 }
    );
  }

  console.error('Unexpected error:', error);
  return Response.json(
    { success: false, error: 'Internal server error' },
    { status: 500 }
  );
}
```

### Uso en API Routes

```typescript
// src/app/api/tickets/route.ts
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const ticket = await ticketService.create(body);
    return Response.json({ success: true, data: ticket });
  } catch (error) {
    return handleError(error);
  }
}
```

---

## 9. PATRÓN DE PAGINACIÓN

### Utilidad Reutilizable

```typescript
// src/lib/utils/pagination.ts
export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
}

export function getPaginationParams(
  searchParams: URLSearchParams
): PaginationParams {
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '10')));
  
  return { page, limit };
}

export function createPaginatedResponse<T>(
  items: T[],
  total: number,
  page: number,
  limit: number
): PaginatedResponse<T> {
  const totalPages = Math.ceil(total / limit);
  
  return {
    items,
    total,
    page,
    limit,
    totalPages,
    hasMore: page < totalPages
  };
}
```

### Uso en API Routes

```typescript
// src/app/api/tickets/route.ts
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const { page, limit } = getPaginationParams(searchParams);
  
  const [tickets, total] = await Promise.all([
    prisma.ticket.findMany({
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' }
    }),
    prisma.ticket.count()
  ]);
  
  const response = createPaginatedResponse(tickets, total, page, limit);
  return Response.json({ success: true, data: response });
}
```

---

## 10. PATRÓN DE AUTENTICACIÓN

### Middleware de Autenticación

```typescript
// src/lib/middleware/auth.ts
export async function requireAuth(request: Request) {
  const token = request.headers.get('authorization')?.split(' ')[1];
  
  if (!token) {
    throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId }
    });
    
    if (!user || !user.isActive) {
      throw new AppError('User not found', 401, 'UNAUTHORIZED');
    }
    
    return user;
  } catch (error) {
    throw new AppError('Invalid token', 401, 'INVALID_TOKEN');
  }
}

export async function requireRole(user: User, ...roles: UserRole[]) {
  if (!roles.includes(user.role)) {
    throw new AppError('Forbidden', 403, 'FORBIDDEN');
  }
}
```

### Uso en API Routes

```typescript
// src/app/api/admin/users/route.ts
export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    await requireRole(user, 'ADMIN');
    
    const users = await prisma.user.findMany();
    return Response.json({ success: true, data: users });
  } catch (error) {
    return handleError(error);
  }
}
```

---

## 11. PATRÓN DE TRANSACCIONES

### Operaciones Atómicas

```typescript
// src/lib/services/ticketService.ts
async updateTicketWithHistory(
  ticketId: string,
  updates: UpdateTicketData,
  userId: string
) {
  return prisma.$transaction(async (tx) => {
    // Obtener ticket actual
    const oldTicket = await tx.ticket.findUnique({
      where: { id: ticketId }
    });

    if (!oldTicket) throw new Error('Ticket not found');

    // Actualizar ticket
    const newTicket = await tx.ticket.update({
      where: { id: ticketId },
      data: updates
    });

    // Crear registros de historial
    const changes = this.detectChanges(oldTicket, newTicket);
    
    if (changes.length > 0) {
      await tx.ticketHistory.createMany({
        data: changes.map(change => ({
          ticketId,
          userId,
          ...change
        }))
      });
    }

    // Registrar auditoría
    await tx.auditLog.create({
      data: {
        entity: 'Ticket',
        action: 'UPDATE',
        entityId: ticketId,
        userId,
        oldValues: oldTicket,
        newValues: newTicket
      }
    });

    return newTicket;
  });
}
```

---

## 12. PATRÓN DE BÚSQUEDA Y FILTRADO

### Filtros Dinámicos

```typescript
// src/lib/utils/filters.ts
export function buildTicketFilters(searchParams: URLSearchParams) {
  const filters: any = {};

  if (searchParams.has('status')) {
    filters.status = searchParams.get('status');
  }

  if (searchParams.has('priority')) {
    filters.priority = searchParams.get('priority');
  }

  if (searchParams.has('categoryId')) {
    filters.hierarchyCategoryId = searchParams.get('categoryId');
  }

  if (searchParams.has('assigneeId')) {
    filters.assigneeId = searchParams.get('assigneeId');
  }

  if (searchParams.has('search')) {
    const search = searchParams.get('search');
    filters.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } }
    ];
  }

  return filters;
}
```

### Uso en API Routes

```typescript
// src/app/api/tickets/route.ts
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const filters = buildTicketFilters(searchParams);
  const { page, limit } = getPaginationParams(searchParams);

  const [tickets, total] = await Promise.all([
    prisma.ticket.findMany({
      where: filters,
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.ticket.count({ where: filters })
  ]);

  return Response.json({
    success: true,
    data: createPaginatedResponse(tickets, total, page, limit)
  });
}
```

---

## 13. CONCLUSIÓN

Estos patrones proporcionan una base sólida para construir un sistema de tickets profesional en Next.js, reutilizando la lógica probada del backend existente mientras se aprovechan las características modernas de Next.js.
