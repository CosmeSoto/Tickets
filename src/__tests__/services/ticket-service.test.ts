// Mock Prisma and NotificationService
jest.mock('@/lib/prisma', () => ({
  prisma: {
    ticket: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    category: {
      findUnique: jest.fn(),
    },
    ticketHistory: {
      create: jest.fn(),
    },
  },
}))

jest.mock('@/lib/services/notification-service', () => ({
  NotificationService: {
    createNotification: jest.fn(),
    notifyTicketCreated: jest.fn(),
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

const mockPrismaClient = prisma as jest.Mocked<typeof prisma>

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
      mockPrismaClient.ticket.findMany.mockResolvedValue(mockTickets)
      mockPrismaClient.ticket.count.mockResolvedValue(1)

      const result = await TicketService.getTickets({}, { page: 1, limit: 10 })

      expect(mockPrismaClient.ticket.findMany).toHaveBeenCalledWith(
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
      mockPrismaClient.ticket.findMany.mockResolvedValue(mockTickets)
      mockPrismaClient.ticket.count.mockResolvedValue(1)

      await TicketService.getTickets({ status: TicketStatus.OPEN }, { page: 1, limit: 10 })

      expect(mockPrismaClient.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: TicketStatus.OPEN },
        })
      )
    })

    it('should filter tickets by search term', async () => {
      mockPrismaClient.ticket.findMany.mockResolvedValue(mockTickets)
      mockPrismaClient.ticket.count.mockResolvedValue(1)

      await TicketService.getTickets({ search: 'test' }, { page: 1, limit: 10 })

      expect(mockPrismaClient.ticket.findMany).toHaveBeenCalledWith(
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
      mockPrismaClient.ticket.findUnique.mockResolvedValue(mockTicket)

      const result = await TicketService.getTicketById('1')

      expect(mockPrismaClient.ticket.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: '1' },
          include: expect.any(Object),
        })
      )
      expect(result).toEqual(mockTicket)
    })

    it('should return null for non-existent ticket', async () => {
      mockPrismaClient.ticket.findUnique.mockResolvedValue(null)

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

      // Mock category exists
      mockPrismaClient.category.findUnique.mockResolvedValue({
        id: '1',
        name: 'Test Category',
      })

      // Mock user exists
      mockPrismaClient.user.findUnique.mockResolvedValue({
        id: '1',
        name: 'Test User',
        email: 'test@example.com',
      })

      mockPrismaClient.ticket.create.mockResolvedValue(mockCreatedTicket)

      const result = await TicketService.createTicket(createData)

      expect(mockPrismaClient.ticket.create).toHaveBeenCalled()
      expect(result).toEqual(mockCreatedTicket)
    })
  })
})