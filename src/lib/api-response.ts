/**
 * API Response Utilities
 * Standardized API response format for consistent responses
 */

import { NextResponse } from 'next/server'

export interface ApiResponseData<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
  code?: string
  timestamp: string
  requestId?: string
}

export class ApiResponse {
  /**
   * Create a successful response
   */
  static success<T>(data: T, status: number = 200, message?: string): NextResponse {
    const response: ApiResponseData<T> = {
      success: true,
      data,
      message,
      timestamp: new Date().toISOString(),
      requestId: this.generateRequestId()
    }

    return NextResponse.json(response, { status })
  }

  /**
   * Create an error response
   */
  static error(
    message: string, 
    status: number = 500, 
    details?: any, 
    code?: string
  ): NextResponse {
    const response: ApiResponseData = {
      success: false,
      error: message,
      code,
      timestamp: new Date().toISOString(),
      requestId: this.generateRequestId(),
      ...(details && { data: details })
    }

    return NextResponse.json(response, { status })
  }

  /**
   * Create a validation error response
   */
  static validationError(errors: any[], message: string = 'Validation failed'): NextResponse {
    return this.error(message, 400, { validationErrors: errors }, 'VALIDATION_ERROR')
  }

  /**
   * Create an unauthorized response
   */
  static unauthorized(message: string = 'Unauthorized'): NextResponse {
    return this.error(message, 401, null, 'UNAUTHORIZED')
  }

  /**
   * Create a forbidden response
   */
  static forbidden(message: string = 'Forbidden'): NextResponse {
    return this.error(message, 403, null, 'FORBIDDEN')
  }

  /**
   * Create a not found response
   */
  static notFound(message: string = 'Resource not found'): NextResponse {
    return this.error(message, 404, null, 'NOT_FOUND')
  }

  /**
   * Create a conflict response
   */
  static conflict(message: string = 'Resource conflict'): NextResponse {
    return this.error(message, 409, null, 'CONFLICT')
  }

  /**
   * Create a rate limit response
   */
  static rateLimit(message: string = 'Rate limit exceeded'): NextResponse {
    return this.error(message, 429, null, 'RATE_LIMIT_EXCEEDED')
  }

  /**
   * Create a paginated response
   */
  static paginated<T>(
    data: T[], 
    pagination: {
      page: number
      limit: number
      total: number
      pages: number
    },
    message?: string
  ): NextResponse {
    const response: ApiResponseData<{
      items: T[]
      pagination: typeof pagination
    }> = {
      success: true,
      data: {
        items: data,
        pagination
      },
      message,
      timestamp: new Date().toISOString(),
      requestId: this.generateRequestId()
    }

    return NextResponse.json(response)
  }

  /**
   * Generate a unique request ID
   */
  private static generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}

/**
 * API Response Builder for more complex responses
 */
export class ApiResponseBuilder {
  private response: Partial<ApiResponseData> = {
    success: true,
    timestamp: new Date().toISOString(),
    requestId: ApiResponse['generateRequestId']()
  }

  /**
   * Set response data
   */
  data<T>(data: T): this {
    this.response.data = data
    return this
  }

  /**
   * Set response message
   */
  message(message: string): this {
    this.response.message = message
    return this
  }

  /**
   * Set error state
   */
  error(error: string, code?: string): this {
    this.response.success = false
    this.response.error = error
    this.response.code = code
    return this
  }

  /**
   * Set request ID
   */
  requestId(id: string): this {
    this.response.requestId = id
    return this
  }

  /**
   * Build the response
   */
  build(status: number = 200): NextResponse {
    return NextResponse.json(this.response, { status })
  }
}

export default ApiResponse