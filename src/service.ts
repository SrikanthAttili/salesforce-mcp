import jsforce from 'jsforce';
import { ValidationError } from './errors.js';
import {
  validateQuery,
  validateSObjectName,
  validateRecordId,
  validateRecordData,
} from './validators.js';
import { QueryResult, SaveResult, DescribeSObjectResult, DescribeGlobalResult } from './types.js';
import { PreflightValidator } from './preflight-validator.js';
import { MetadataDatabase } from './database.js';

/**
 * Service layer for Salesforce operations
 * Handles business logic and validation
 */
export class SalesforceService {
  private preflightValidator?: PreflightValidator;

  constructor(
    private conn: jsforce.Connection,
    database?: MetadataDatabase
  ) {
    // Initialize preflight validator if database is provided
    if (database) {
      this.preflightValidator = new PreflightValidator(database);
    }
  }

  /**
   * Get the jsforce connection for advanced operations
   */
  getConnection(): jsforce.Connection {
    return this.conn;
  }

  /**
   * Execute a SOQL query
   */
  async query<T extends jsforce.Record = any>(query: string): Promise<QueryResult<T>> {
    try {
      validateQuery(query);
      const result = await this.conn.query<T>(query);
      return result as QueryResult<T>;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new Error(`Query execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Retrieve a single record by ID
   */
  async getRecord(sobject: string, id: string): Promise<any> {
    try {
      validateSObjectName(sobject);
      validateRecordId(id);
      return await this.conn.sobject(sobject).retrieve(id);
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new Error(`Failed to retrieve record: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a new record
   */
  async createRecord(sobject: string, data: Record<string, any>): Promise<SaveResult> {
    try {
      validateSObjectName(sobject);
      validateRecordData(data);

      // Pre-flight validation if enabled
      if (this.preflightValidator) {
        const validationResult = await this.preflightValidator.validateCreate(sobject, data);
        
        if (!validationResult.valid) {
          const summary = this.preflightValidator.getSummary(validationResult);
          throw new ValidationError(`Pre-flight validation failed:\n${summary}`);
        }

        // Log warnings even if validation passed
        if (validationResult.warnings.length > 0 || validationResult.suggestions.length > 0) {
          console.warn('\n⚠️  Pre-flight Warnings:');
          console.warn(this.preflightValidator.getSummary(validationResult));
        }
      }
      
      const result = await this.conn.sobject(sobject).create(data);
      return result as SaveResult;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new Error(`Failed to create record: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update an existing record
   */
  async updateRecord(sobject: string, id: string, data: Record<string, any>): Promise<SaveResult> {
    try {
      validateSObjectName(sobject);
      validateRecordId(id);
      validateRecordData(data);

      // Pre-flight validation if enabled
      if (this.preflightValidator) {
        const validationResult = await this.preflightValidator.validateUpdate(sobject, id, data);
        
        if (!validationResult.valid) {
          const summary = this.preflightValidator.getSummary(validationResult);
          throw new ValidationError(`Pre-flight validation failed:\n${summary}`);
        }

        // Log warnings even if validation passed
        if (validationResult.warnings.length > 0 || validationResult.suggestions.length > 0) {
          console.warn('\n⚠️  Pre-flight Warnings:');
          console.warn(this.preflightValidator.getSummary(validationResult));
        }
      }
      
      const updateData = { Id: id, ...data };
      const result = await this.conn.sobject(sobject).update(updateData);
      return result as SaveResult;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new Error(`Failed to update record: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete a record
   */
  async deleteRecord(sobject: string, id: string): Promise<SaveResult> {
    try {
      validateSObjectName(sobject);
      validateRecordId(id);
      const result = await this.conn.sobject(sobject).destroy(id);
      return result as SaveResult;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new Error(`Failed to delete record: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Describe an SObject (get metadata)
   */
  async describeObject(sobject: string): Promise<DescribeSObjectResult> {
    try {
      validateSObjectName(sobject);
      const result = await this.conn.sobject(sobject).describe();
      return result as DescribeSObjectResult;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new Error(`Failed to describe object: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all available SObjects in the org
   */
  async describeGlobal(): Promise<DescribeGlobalResult> {
    try {
      const result = await this.conn.describeGlobal();
      return result as DescribeGlobalResult;
    } catch (error) {
      throw new Error(`Failed to describe global: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Execute a SOSL search
   */
  async search(searchString: string): Promise<any> {
    try {
      validateQuery(searchString);
      return await this.conn.search(searchString);
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new Error(`Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get org limits
   */
  async getOrgLimits(): Promise<any> {
    try {
      const result = await this.conn.request<any>(
        `/services/data/v${this.conn.version || '65.0'}/limits`
      );
      return result;
    } catch (error) {
      throw new Error(`Failed to get org limits: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
