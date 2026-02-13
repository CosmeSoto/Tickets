export const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  trace: jest.fn(),
  performance: jest.fn(),
  child: jest.fn().mockReturnThis(),
  time: jest.fn().mockReturnValue({
    end: jest.fn(),
  }),
}

export const logger = mockLogger