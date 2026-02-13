export class ConfigurationService {
  constructor() {}

  get(key: string, defaultValue?: any) {
    return defaultValue
  }

  getDatabase() {
    return {
      url: 'mock://database',
      maxConnections: 10,
    }
  }

  getRedis() {
    return {
      url: 'mock://redis',
      maxRetries: 3,
    }
  }

  getApp() {
    return {
      name: 'test-app',
      version: '1.0.0',
      environment: 'test',
    }
  }
}