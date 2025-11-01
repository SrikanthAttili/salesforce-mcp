import jsforce from 'jsforce';
import dotenv from 'dotenv';
import { 
  AuthenticationError, 
  NetworkError,
  ConfigurationError 
} from './errors.js';
import { 
  SalesforceConfig, 
  OAuthTokenResponse, 
  IdentityResponse,
  ConnectionTestResult,
  UserInfo 
} from './types.js';
import { validateConfig } from './validators.js';

dotenv.config();

export class SalesforceAuth {
  private connection: jsforce.Connection | null = null;
  private config: SalesforceConfig;
  private readonly FETCH_TIMEOUT = 30000;

  constructor() {
    try {
      this.config = validateConfig();
    } catch (error) {
      if (error instanceof ConfigurationError) {
        throw error;
      }
      throw new ConfigurationError('Failed to initialize configuration', error);
    }
  }

  /**
   * Authenticate using OAuth 2.0 Client Credentials Flow
   * @throws {AuthenticationError} When authentication fails
   * @throws {NetworkError} When network request fails
   */
  async authenticate(): Promise<jsforce.Connection> {
    if (this.connection) {
      return this.connection;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.FETCH_TIMEOUT);

      const response = await fetch(`${this.config.loginUrl}/services/oauth2/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json() as OAuthTokenResponse | { error: string; error_description: string };

      if (!response.ok) {
        const errorData = data as { error: string; error_description: string };
        throw new AuthenticationError(
          `Authentication failed: ${errorData.error_description || errorData.error}`
        );
      }

      const tokenData = data as OAuthTokenResponse;

      const conn = new jsforce.Connection({
        instanceUrl: tokenData.instance_url,
        accessToken: tokenData.access_token,
        version: this.config.apiVersion,
      });

      this.connection = conn;
      return conn;

    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw error;
      }
      if (error instanceof Error && error.name === 'AbortError') {
        throw new NetworkError('Authentication request timed out');
      }
      throw new NetworkError('Network error during authentication', error);
    }
  }

  /**
   * Get the current connection, authenticating if necessary
   */
  async getConnection(): Promise<jsforce.Connection> {
    if (!this.connection) {
      return await this.authenticate();
    }
    return this.connection;
  }

  /**
   * Test the connection and retrieve user information
   */
  async testConnection(): Promise<ConnectionTestResult> {
    try {
      const conn = await this.getConnection();
      const identity = await conn.identity() as IdentityResponse;
      
      const userInfo: UserInfo = {
        userId: identity.user_id,
        username: identity.username,
        organizationId: identity.organization_id,
        displayName: identity.display_name,
        email: identity.email,
      };

      return {
        success: true,
        userInfo,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Clear the current connection
   */
  logout(): void {
    this.connection = null;
  }
}
