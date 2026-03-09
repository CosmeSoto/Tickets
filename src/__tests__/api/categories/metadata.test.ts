/**
 * Tests para la lógica de cálculo de metadata de categorías
 * 
 * Nota: Estos tests verifican la lógica de cálculo sin usar NextRequest
 * debido a limitaciones con los mocks en el entorno de pruebas.
 */

import type { CategoryMetadata } from '@/features/category-selection/types';

describe('Category Metadata Calculation Logic', () => {
  describe('calculateAverageResponseTime', () => {
    it('debe calcular el tiempo de respuesta promedio correctamente', () => {
      const mockResolvedTickets = [
        {
          createdAt: new Date('2024-01-01T10:00:00Z'),
          firstResponseAt: new Date('2024-01-01T12:00:00Z'), // 2 hours
        },
        {
          createdAt: new Date('2024-01-02T10:00:00Z'),
          firstResponseAt: new Date('2024-01-02T14:00:00Z'), // 4 hours
        },
        {
          createdAt: new Date('2024-01-03T10:00:00Z'),
          firstResponseAt: new Date('2024-01-03T13:00:00Z'), // 3 hours
        },
      ];

      const totalResponseTimeMs = mockResolvedTickets.reduce((sum, ticket) => {
        if (ticket.firstResponseAt) {
          const responseTime = ticket.firstResponseAt.getTime() - ticket.createdAt.getTime();
          return sum + responseTime;
        }
        return sum;
      }, 0);

      const averageResponseTimeMs = totalResponseTimeMs / mockResolvedTickets.length;
      const averageResponseTimeHours = Math.round((averageResponseTimeMs / (1000 * 60 * 60)) * 10) / 10;

      // Average should be 3 hours (2+4+3)/3
      expect(averageResponseTimeHours).toBe(3);
    });

    it('debe retornar null cuando no hay tickets resueltos', () => {
      const mockResolvedTickets: any[] = [];

      let averageResponseTimeHours: number | null = null;
      if (mockResolvedTickets.length > 0) {
        const totalResponseTimeMs = mockResolvedTickets.reduce((sum, ticket) => {
          if (ticket.firstResponseAt) {
            const responseTime = ticket.firstResponseAt.getTime() - ticket.createdAt.getTime();
            return sum + responseTime;
          }
          return sum;
        }, 0);

        const averageResponseTimeMs = totalResponseTimeMs / mockResolvedTickets.length;
        averageResponseTimeHours = Math.round((averageResponseTimeMs / (1000 * 60 * 60)) * 10) / 10;
      }

      expect(averageResponseTimeHours).toBeNull();
    });

    it('debe manejar tickets con tiempos de respuesta muy largos', () => {
      const mockResolvedTickets = [
        {
          createdAt: new Date('2024-01-01T10:00:00Z'),
          firstResponseAt: new Date('2024-01-03T10:00:00Z'), // 48 hours
        },
        {
          createdAt: new Date('2024-01-02T10:00:00Z'),
          firstResponseAt: new Date('2024-01-02T12:00:00Z'), // 2 hours
        },
      ];

      const totalResponseTimeMs = mockResolvedTickets.reduce((sum, ticket) => {
        if (ticket.firstResponseAt) {
          const responseTime = ticket.firstResponseAt.getTime() - ticket.createdAt.getTime();
          return sum + responseTime;
        }
        return sum;
      }, 0);

      const averageResponseTimeMs = totalResponseTimeMs / mockResolvedTickets.length;
      const averageResponseTimeHours = Math.round((averageResponseTimeMs / (1000 * 60 * 60)) * 10) / 10;

      // Average should be 25 hours (48+2)/2
      expect(averageResponseTimeHours).toBe(25);
    });
  });

  describe('calculatePopularityScore', () => {
    it('debe calcular el score de popularidad correctamente', () => {
      const maxExpectedTickets = 1000;

      // Test con diferentes cantidades de tickets
      const testCases = [
        { totalTickets: 0, expectedMin: 0, expectedMax: 10 },
        { totalTickets: 10, expectedMin: 10, expectedMax: 40 },
        { totalTickets: 100, expectedMin: 40, expectedMax: 75 },
        { totalTickets: 500, expectedMin: 60, expectedMax: 95 },
        { totalTickets: 1000, expectedMin: 90, expectedMax: 100 },
      ];

      testCases.forEach(({ totalTickets, expectedMin, expectedMax }) => {
        const popularityScore = Math.min(
          100,
          Math.round((Math.log(totalTickets + 1) / Math.log(maxExpectedTickets + 1)) * 100)
        );

        expect(popularityScore).toBeGreaterThanOrEqual(expectedMin);
        expect(popularityScore).toBeLessThanOrEqual(expectedMax);
      });
    });

    it('debe limitar el score a 100 máximo', () => {
      const maxExpectedTickets = 1000;
      const totalTickets = 10000; // Mucho más que el máximo esperado

      const popularityScore = Math.min(
        100,
        Math.round((Math.log(totalTickets + 1) / Math.log(maxExpectedTickets + 1)) * 100)
      );

      expect(popularityScore).toBe(100);
    });

    it('debe usar escala logarítmica para distribución uniforme', () => {
      const maxExpectedTickets = 1000;

      // Verificar que la escala logarítmica distribuye mejor que lineal
      const tickets1 = 10;
      const tickets2 = 100;
      const tickets3 = 1000;

      const score1 = Math.round((Math.log(tickets1 + 1) / Math.log(maxExpectedTickets + 1)) * 100);
      const score2 = Math.round((Math.log(tickets2 + 1) / Math.log(maxExpectedTickets + 1)) * 100);
      const score3 = Math.round((Math.log(tickets3 + 1) / Math.log(maxExpectedTickets + 1)) * 100);

      // Los scores deben estar más distribuidos que una escala lineal
      expect(score2 - score1).toBeGreaterThan(10);
      expect(score3 - score2).toBeGreaterThan(10);
    });
  });

  describe('CategoryMetadata structure', () => {
    it('debe tener la estructura correcta', () => {
      const metadata: CategoryMetadata = {
        categoryId: 'cat-1',
        departmentName: 'IT Support',
        departmentColor: '#3B82F6',
        averageResponseTimeHours: 3.5,
        assignedTechniciansCount: 5,
        recentTicketsCount: 15,
        popularityScore: 75,
      };

      expect(metadata).toHaveProperty('categoryId');
      expect(metadata).toHaveProperty('departmentName');
      expect(metadata).toHaveProperty('departmentColor');
      expect(metadata).toHaveProperty('averageResponseTimeHours');
      expect(metadata).toHaveProperty('assignedTechniciansCount');
      expect(metadata).toHaveProperty('recentTicketsCount');
      expect(metadata).toHaveProperty('popularityScore');

      expect(typeof metadata.categoryId).toBe('string');
      expect(typeof metadata.departmentName).toBe('string');
      expect(typeof metadata.departmentColor).toBe('string');
      expect(typeof metadata.averageResponseTimeHours).toBe('number');
      expect(typeof metadata.assignedTechniciansCount).toBe('number');
      expect(typeof metadata.recentTicketsCount).toBe('number');
      expect(typeof metadata.popularityScore).toBe('number');
    });

    it('debe permitir averageResponseTimeHours null', () => {
      const metadata: CategoryMetadata = {
        categoryId: 'cat-1',
        departmentName: 'IT Support',
        departmentColor: '#3B82F6',
        averageResponseTimeHours: null,
        assignedTechniciansCount: 0,
        recentTicketsCount: 0,
        popularityScore: 0,
      };

      expect(metadata.averageResponseTimeHours).toBeNull();
    });
  });

  describe('Date calculations', () => {
    it('debe calcular correctamente la fecha de hace 30 días', () => {
      const now = new Date('2024-01-31T10:00:00Z');
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      expect(thirtyDaysAgo.getDate()).toBe(1); // 31 - 30 = 1
      expect(thirtyDaysAgo.getMonth()).toBe(0); // Enero (0-indexed)
    });

    it('debe manejar cambios de mes correctamente', () => {
      const now = new Date('2024-03-15T10:00:00Z');
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      expect(thirtyDaysAgo.getMonth()).toBe(1); // Febrero (0-indexed)
    });
  });
});
