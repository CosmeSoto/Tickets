// Mock Prisma and NotificationService
jest.mock('@/lib/prisma', () => {
  const mockPrisma = {
    tickets: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    users: {
      findUnique: jest.fn(),
    },
    categories: {
      findUnique: jest.fn(),
    },
    ticket_history: {
      create: jest.fn(),
      createMany: jest.fn(),
      findMany: jest.fn(),
    },
    technician_family_assignments: {
      findFirst: jest.fn(),
    },
    audit_logs: {
      create: jest.fn(),
    },
  }
  return {
    __esModule: true,
    default: mockPrisma,
    prisma: mockPrisma,
  }
})

jest.mock('@/lib/services/notification-service', () => ({
  NotificationService: {
    createNotification: jest.fn(),
    notifyTicketCreated: jest.fn(),
  },
}))

jest.mock('@/lib/services/ticket-code.service', () => ({
  TicketCodeService: {
    generateCode: jest.fn().mockResolvedValue('TI-2026-0001'),
    validateManualCode: jest.fn().mockResolvedValue({ valid: true }),
    updateCounterIfNeeded: jest.fn().mockResolvedValue(undefined),
  },
}))

jest.mock('@/lib/services/ticket-family-config.service', () => ({
  TicketFamilyConfigService: {
    getDefaultFamily: jest.fn().mockResolvedValue(null),
    getEnabledFamilies: jest.fn().mockResolvedValue([]),
    getByFamilyId: jest.fn().mockResolvedValue(null),
    update: jest.fn().mockResolvedValue(null),
  },
}))

// Mock logging middleware to avoid Next.js dependencies
jest.mock('@/lib/logging', () => ({
  ApplicationLogger: {
    timer: jest.fn(() => ({
      end: jest.fn()
    })),
    businessOperation: jest.fn(),
    systemHealth: jest.fn(),
    cacheOperation: jest.fn(),
    databaseOperationError: jest.fn(),
    databaseOperation: jest.fn(),
    databaseOperationStart: jest.fn(),
    databaseOperationEnd: jest.fn(),
    databaseOperationComplete: jest.fn()
  },
  ApiLoggingMiddleware: {
    logRequest: jest.fn(),
    logResponse: jest.fn()
  }
}))

import { TicketService } from '@/lib/services/ticket-service'
import prisma from '@/lib/prisma'
import { TicketStatus, TicketPriority } from '@prisma/client'

const mockPrisma = prisma as any

describe('TicketService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getTickets', () => {
    const mockTickets = [
      {
        id: '1',
        title: 'Test Ticket',
        description: 'Test Description',
        status: TicketStatus.OPEN,
        priority: TicketPriority.MEDIUM,
        categoryId: '1',
        clientId: '1',
        assigneeId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]

    it('should get tickets without filters', async () => {
      mockPrisma.tickets.findMany.mockResolvedValue(mockTickets)
      mockPrisma.tickets.count.mockResolvedValue(1)

      const result = await TicketService.getTickets({}, { page: 1, limit: 10 })

      expect(mockPrisma.tickets.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
          include: expect.any(Object),
          orderBy: { createdAt: 'desc' },
          skip: 0,
          take: 10,
        })
      )
      expect(result.tickets).toEqual(mockTickets)
      expect(result.total).toBe(1)
    })

    it('should filter tickets by status', async () => {
      mockPrisma.tickets.findMany.mockResolvedValue(mockTickets)
      mockPrisma.tickets.count.mockResolvedValue(1)

      await TicketService.getTickets({ status: TicketStatus.OPEN }, { page: 1, limit: 10 })

      expect(mockPrisma.tickets.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: TicketStatus.OPEN },
        })
      )
    })

    it('should filter tickets by search term', async () => {
      mockPrisma.tickets.findMany.mockResolvedValue(mockTickets)
      mockPrisma.tickets.count.mockResolvedValue(1)

      await TicketService.getTickets({ search: 'test' }, { page: 1, limit: 10 })

      expect(mockPrisma.tickets.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { title: { contains: 'test', mode: 'insensitive' } },
              { description: { contains: 'test', mode: 'insensitive' } },
            ],
          },
        })
      )
    })
  })

  describe('getTicketById', () => {
    const mockTicket = {
      id: '1',
      title: 'Test Ticket',
      description: 'Test Description',
      status: TicketStatus.OPEN,
      priority: TicketPriority.MEDIUM,
      categoryId: '1',
      clientId: '1',
      assigneeId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    it('should get ticket by id', async () => {
      mockPrisma.tickets.findUnique.mockResolvedValue(mockTicket)

      const result = await TicketService.getTicketById('1')

      expect(mockPrisma.tickets.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: '1' },
          include: expect.any(Object),
        })
      )
      expect(result).toEqual(mockTicket)
    })

    it('should return null for non-existent ticket', async () => {
      mockPrisma.tickets.findUnique.mockResolvedValue(null)

      const result = await TicketService.getTicketById('999')

      expect(result).toBeNull()
    })
  })

  describe('createTicket', () => {
    const createData = {
      title: 'New Ticket',
      description: 'New Description',
      priority: TicketPriority.HIGH,
      categoryId: '1',
      clientId: '1',
    }

    it('should create a new ticket with valid data', async () => {
      const mockCreatedTicket = {
        id: '2',
        ...createData,
        status: TicketStatus.OPEN,
        assigneeId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      // Mock category exists (con departments para resolver familyId)
      mockPrisma.categories.findUnique.mockResolvedValue({
        id: '1',
        name: 'Test Category',
        departments: { familyId: null },
      })

      mockPrisma.tickets.create.mockResolvedValue(mockCreatedTicket)
      mockPrisma.ticket_history.create.mockResolvedValue({})

      const result = await TicketService.createTicket(createData)

      expect(mockPrisma.tickets.create).toHaveBeenCalled()
      expect(result).toEqual(mockCreatedTicket)
    })
  })
})