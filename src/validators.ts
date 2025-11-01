import { ConfigurationError } from './errors.js';

/**
 * Validates environment variables and returns validated configuration
 */
export function validateConfig() {
  const errors: string[] = [];

  const loginUrl = process.env.SF_LOGIN_URL;
  const clientId = process.env.SF_CLIENT_ID;
  const clientSecret = process.env.SF_CLIENT_SECRET;
  const apiVersion = process.env.SF_API_VERSION || '65.0';

  if (!loginUrl) {
    errors.push('SF_LOGIN_URL is required');
  } else if (!isValidUrl(loginUrl)) {
    errors.push('SF_LOGIN_URL must be a valid HTTPS URL');
  }

  if (!clientId) {
    errors.push('SF_CLIENT_ID is required');
  } else if (clientId.length < 10) {
    errors.push('SF_CLIENT_ID appears to be invalid (too short)');
  }

  if (!clientSecret) {
    errors.push('SF_CLIENT_SECRET is required');
  } else if (clientSecret.length < 10) {
    errors.push('SF_CLIENT_SECRET appears to be invalid (too short)');
  }

  if (!isValidApiVersion(apiVersion)) {
    errors.push('SF_API_VERSION must be a valid version number (e.g., "65.0")');
  }

  if (errors.length > 0) {
    throw new ConfigurationError(
      'Configuration validation failed:\n  - ' + errors.join('\n  - '),
      { errors }
    );
  }

  return {
    loginUrl: loginUrl!,
    clientId: clientId!,
    clientSecret: clientSecret!,
    apiVersion,
    timeout: parseInt(process.env.SF_TIMEOUT || '30000', 10),
  };
}

function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function isValidApiVersion(version: string): boolean {
  return /^\d+\.\d+$/.test(version);
}

/**
 * Validates tool input parameters
 */
export function validateQuery(query: string): void {
  if (!query || typeof query !== 'string') {
    throw new Error('Query must be a non-empty string');
  }
  if (query.trim().length === 0) {
    throw new Error('Query cannot be empty');
  }
}

export function validateSObjectName(sobject: string): void {
  if (!sobject || typeof sobject !== 'string') {
    throw new Error('SObject name must be a non-empty string');
  }
  if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(sobject)) {
    throw new Error('Invalid SObject name format');
  }
}

export function validateRecordId(id: string): void {
  if (!id || typeof id !== 'string') {
    throw new Error('Record ID must be a non-empty string');
  }
  if (id.length !== 15 && id.length !== 18) {
    throw new Error('Record ID must be 15 or 18 characters');
  }
  if (!/^[a-zA-Z0-9]+$/.test(id)) {
    throw new Error('Invalid Record ID format');
  }
}

export function validateRecordData(data: unknown): void {
  if (!data || typeof data !== 'object') {
    throw new Error('Record data must be an object');
  }
  if (Object.keys(data).length === 0) {
    throw new Error('Record data cannot be empty');
  }
}
