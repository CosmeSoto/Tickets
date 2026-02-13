/**
 * Admin Logs API Tests
 */

// Setup test environment for Next.js API routes
import { TextEncoder, TextDecoder } from 'util';

// Mock globals
Object.assign(global, {
  TextEncoder,
  TextDecoder,
  Request: class MockRequest {
    constructor(url: string, options: any = {}) {
      this.url = url;
      this.method = options.method || 'GET';
      this.headers = new Map(Object.entries(options.headers || {}));
      this.body = options.body;
    }
    url: string;
    method: string;
    headers: Map<string, string>;
    body: any;
  },
  Response: class MockResponse {
    constructor(body: any, options: any = {}) {
      this.body = body;
      this.status = options.status || 200;
      this.headers = new Map(Object.entries(options.headers || {}));
    }
    body: any;
    status: number;
    headers: Map<string, string>;
  },
});

import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/admin/logs/route';
import { getServerSession } from 'next-auth';

// Mock dependencies
jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/auth', () => ({
  authOptions: {
    providers: [],
    callbacks: {},
  },
}));

jest.mock('@/lib/logging/log-manager', () => ({
  logManager: {
    getLogMetrics: jest.fn(),
    getAlerts: jest.fn(),
    getConfiguration: jest.fn(),
    updateConfiguration: jest.fn(),
    addAlert: jest.fn(),
    removeAlert: jest.fn(),
    toggleAlert: jest.fn(),
    rotateLogs: jest.fn(),
    cleanupOldLogs: jest.fn(),
  },
}));

jest.mock('@/lib/logging', () => ({
  ApplicationLogger: {
    apiRequestStart: jest.fn(),
    apiRequestComplete: jest.fn(),
    apiRequestError: jest.fn(),
    businessOperation: jest.fn(),
  },
}));

const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>;

describe('/api/admin/logs', () => {
  const mockLogManager = require('@/lib/logging/log-manager').logManager;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mock responses
    mockLogManager.getLogMetrics.mockReturnValue({
      totalLogs: 1000,
      logsByLevel: { ERROR: 50, WARN: 100, INFO: 850 },
      logsByComponent: { api: 500, database: 300, auth: 200 },
      errorRate: 0.05,
      averageResponseTime: 150,
      topErrors: [],
      timeRange: { start: new Date(), end: new Date() },
    });

    mockLogManager.getAlerts.mockReturnValue([
      {
        id: 'test_alert',
        name: 'Test Alert',
        condition: { type: 'threshold', threshold: 10, timeWindow: 300000 },
        actions: [{ type: 'log', config: {} }],
        enabled: true,
        cooldown: 600000,
      },
    ]);

    mockLogManager.getConfiguration.mockReturnValue({
      rotation: { maxFileSize: 100000000, maxFiles: 10 },
      retention: { retentionDays: 30 },
      aggregation: { enabled: true },
    });
  });

  describe('GET /api/admin/logs', () => {
    it('should return 401 when not authenticated', async () => {
      mockGetServerSession.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/admin/logs');
      const response = await GET(request);

      expect(response.status).toBe(401);
    });

    it('should return 403 when user is not admin', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user1', role: 'USER' },
      } as any);

      const request = new NextRequest('http://localhost:3000/api/admin/logs');
      const response = await GET(request);

      expect(response.status).toBe(403);
    });

    it('should return log metrics for admin user', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'admin1', role: 'ADMIN' },
      } as any);

      const request = new NextRequest('http://localhost:3000/api/admin/logs');
      const response = await GET(request);

      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.metrics).toBeDefined();
      expect(data.data.alerts).toBeDefined();
      expect(data.data.configuration).toBeDefined();
      expect(data.data.status).toBe('healthy');
    });

    it('should handle query parameters for time range', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'admin1', role: 'ADMIN' },
      } as any);

      const startDate = new Date(Date.now() - 3600000).toISOString();
      const endDate = new Date().toISOString();
      const url = `http://localhost:3000/api/admin/logs?startDate=${startDate}&endDate=${endDate}`;
      const request = new NextRequest(url);
      
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(mockLogManager.getLogMetrics).toHaveBeenCalledWith({
        start: new Date(startDate),
        end: new Date(endDate),
      });
    });

    it('should return 400 for invalid query parameters', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'admin1', role: 'ADMIN' },
      } as any);

      const url = 'http://localhost:3000/api/admin/logs?startDate=invalid-date';
      const request = new NextRequest(url);
      
      const response = await GET(request);

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/admin/logs', () => {
    it('should return 401 when not authenticated', async () => {
      mockGetServerSession.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/admin/logs', {
        method: 'POST',
        body: JSON.stringify({ action: 'update_config' }),
      });
      const response = await POST(request);

      expect(response.status).toBe(401);
    });

    it('should return 403 when user is not admin', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user1', role: 'USER' },
      } as any);

      const request = new NextRequest('http://localhost:3000/api/admin/logs', {
        method: 'POST',
        body: JSON.stringify({ action: 'update_config' }),
      });
      const response = await POST(request);

      expect(response.status).toBe(403);
    });

    it('should update configuration', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'admin1', role: 'ADMIN' },
      } as any);

      const config = {
        rotation: { maxFileSize: 200000000, maxFiles: 15 },
        retention: { retentionDays: 60 },
      };

      const request = new NextRequest('http://localhost:3000/api/admin/logs', {
        method: 'POST',
        body: JSON.stringify({ action: 'update_config', config }),
      });
      
      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(mockLogManager.updateConfiguration).toHaveBeenCalledWith(config);
    });

    it('should add alert', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'admin1', role: 'ADMIN' },
      } as any);

      const alert = {
        id: 'new_alert',
        name: 'New Alert',
        condition: {
          type: 'threshold',
          pattern: 'ERROR',
          threshold: 5,
          timeWindow: 300000,
        },
        actions: [{ type: 'log', config: { level: 'error' } }],
        enabled: true,
        cooldown: 600000,
      };

      const request = new NextRequest('http://localhost:3000/api/admin/logs', {
        method: 'POST',
        body: JSON.stringify({ action: 'add_alert', alert }),
      });
      
      const response = await POST(request);

      expect(response.status).toBe(201);
      expect(mockLogManager.addAlert).toHaveBeenCalled();
    });

    it('should remove alert', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'admin1', role: 'ADMIN' },
      } as any);

      mockLogManager.removeAlert.mockReturnValue(true);

      const request = new NextRequest('http://localhost:3000/api/admin/logs', {
        method: 'POST',
        body: JSON.stringify({ action: 'remove_alert', alertId: 'test_alert' }),
      });
      
      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(mockLogManager.removeAlert).toHaveBeenCalledWith('test_alert');
    });

    it('should return 404 when removing non-existent alert', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'admin1', role: 'ADMIN' },
      } as any);

      mockLogManager.removeAlert.mockReturnValue(false);

      const request = new NextRequest('http://localhost:3000/api/admin/logs', {
        method: 'POST',
        body: JSON.stringify({ action: 'remove_alert', alertId: 'non_existent' }),
      });
      
      const response = await POST(request);

      expect(response.status).toBe(404);
    });

    it('should toggle alert', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'admin1', role: 'ADMIN' },
      } as any);

      mockLogManager.toggleAlert.mockReturnValue(true);

      const request = new NextRequest('http://localhost:3000/api/admin/logs', {
        method: 'POST',
        body: JSON.stringify({ 
          action: 'toggle_alert', 
          alertId: 'test_alert', 
          enabled: false 
        }),
      });
      
      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(mockLogManager.toggleAlert).toHaveBeenCalledWith('test_alert', false);
    });

    it('should rotate logs', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'admin1', role: 'ADMIN' },
      } as any);

      mockLogManager.rotateLogs.mockResolvedValue(undefined);

      const request = new NextRequest('http://localhost:3000/api/admin/logs', {
        method: 'POST',
        body: JSON.stringify({ 
          action: 'rotate_logs', 
          logPath: '/var/log/app.log' 
        }),
      });
      
      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(mockLogManager.rotateLogs).toHaveBeenCalledWith('/var/log/app.log');
    });

    it('should cleanup logs', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'admin1', role: 'ADMIN' },
      } as any);

      mockLogManager.cleanupOldLogs.mockResolvedValue(undefined);

      const request = new NextRequest('http://localhost:3000/api/admin/logs', {
        method: 'POST',
        body: JSON.stringify({ 
          action: 'cleanup_logs', 
          logDir: '/var/log' 
        }),
      });
      
      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(mockLogManager.cleanupOldLogs).toHaveBeenCalledWith('/var/log');
    });

    it('should return 400 for invalid action', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'admin1', role: 'ADMIN' },
      } as any);

      const request = new NextRequest('http://localhost:3000/api/admin/logs', {
        method: 'POST',
        body: JSON.stringify({ action: 'invalid_action' }),
      });
      
      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('should return 400 for invalid alert configuration', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'admin1', role: 'ADMIN' },
      } as any);

      const invalidAlert = {
        id: 'invalid_alert',
        // Missing required fields
      };

      const request = new NextRequest('http://localhost:3000/api/admin/logs', {
        method: 'POST',
        body: JSON.stringify({ action: 'add_alert', alert: invalidAlert }),
      });
      
      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('should return 400 for invalid configuration', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'admin1', role: 'ADMIN' },
      } as any);

      const invalidConfig = {
        rotation: { maxFileSize: -1 }, // Invalid value
      };

      const request = new NextRequest('http://localhost:3000/api/admin/logs', {
        method: 'POST',
        body: JSON.stringify({ action: 'update_config', config: invalidConfig }),
      });
      
      const response = await POST(request);

      expect(response.status).toBe(400);
    });
  });

  describe('Error Handling', () => {
    it('should handle internal errors gracefully', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'admin1', role: 'ADMIN' },
      } as any);

      mockLogManager.getLogMetrics.mockImplementation(() => {
        throw new Error('Internal error');
      });

      const request = new NextRequest('http://localhost:3000/api/admin/logs');
      const response = await GET(request);

      expect(response.status).toBe(500);
    });

    it('should handle log rotation errors', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'admin1', role: 'ADMIN' },
      } as any);

      mockLogManager.rotateLogs.mockRejectedValue(new Error('Rotation failed'));

      const request = new NextRequest('http://localhost:3000/api/admin/logs', {
        method: 'POST',
        body: JSON.stringify({ 
          action: 'rotate_logs', 
          logPath: '/invalid/path' 
        }),
      });
      
      const response = await POST(request);

      expect(response.status).toBe(500);
    });

    it('should handle cleanup errors', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'admin1', role: 'ADMIN' },
      } as any);

      mockLogManager.cleanupOldLogs.mockRejectedValue(new Error('Cleanup failed'));

      const request = new NextRequest('http://localhost:3000/api/admin/logs', {
        method: 'POST',
        body: JSON.stringify({ 
          action: 'cleanup_logs', 
          logDir: '/invalid/path' 
        }),
      });
      
      const response = await POST(request);

      expect(response.status).toBe(500);
    });
  });
});