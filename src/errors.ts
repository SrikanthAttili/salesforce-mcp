/**
 * Custom error classes for Salesforce MCP Server
 */

export enum SalesforceErrorCode {
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  NETWORK_ERROR = 'NETWORK_ERROR',
  API_ERROR = 'API_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
}

export class SalesforceError extends Error {
  constructor(
    message: string,
    public code: SalesforceErrorCode,
    public statusCode?: number,
    public details?: unknown
  ) {
    super(message);
    this.name = 'SalesforceError';
    Object.setPrototypeOf(this, SalesforceError.prototype);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
    };
  }
}

export class AuthenticationError extends SalesforceError {
  constructor(message: string, details?: unknown) {
    super(message, SalesforceErrorCode.AUTHENTICATION_FAILED, 401, details);
    this.name = 'AuthenticationError';
  }
}

export class ValidationError extends SalesforceError {
  constructor(message: string, details?: unknown) {
    super(message, SalesforceErrorCode.VALIDATION_ERROR, 400, details);
    this.name = 'ValidationError';
  }
}

export class ConfigurationError extends SalesforceError {
  constructor(message: string, details?: unknown) {
    super(message, SalesforceErrorCode.CONFIGURATION_ERROR, undefined, details);
    this.name = 'ConfigurationError';
  }
}

export class NetworkError extends SalesforceError {
  constructor(message: string, details?: unknown) {
    super(message, SalesforceErrorCode.NETWORK_ERROR, undefined, details);
    this.name = 'NetworkError';
  }
}
