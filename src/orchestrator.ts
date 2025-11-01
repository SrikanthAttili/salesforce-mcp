import { MetadataDatabase } from './database.js';
import { MetadataCacheManager } from './cache-manager.js';
import { DependencyResolver, RecordOperation } from './dependency-resolver.js';
import { PreflightValidator } from './preflight-validator.js';
import { SalesforceService } from './service.js';
import { SmartMatcher, MatchConfidence, MatchResult } from './smart-matcher.js';
import jsforce from 'jsforce';

/**
 * Operation Orchestrator - The Spider Brain 🕷️🧠
 * 
 * Coordinates all components of the intelligent Salesforce MCP server:
 * 1. Analyzes user operations
 * 2. Ensures metadata is cached
 * 3. Validates data before API calls
 * 4. Detects potential duplicates (NEW - Milestone 5)
 * 5. Resolves dependencies
 * 6. Executes with optimal parallelization
 * 7. Handles rollback on failure
 * 
 * This is the main entry point for complex multi-record operations.
 */
export class OperationOrchestrator {
  private db: MetadataDatabase;
  private cacheManager: MetadataCacheManager;
  private dependencyResolver: DependencyResolver;
  private preflightValidator: PreflightValidator;
  private smartMatcher: SmartMatcher;
  private service: SalesforceService;
  private debug: boolean;

  constructor(
    database: MetadataDatabase,
    connection: jsforce.Connection
  ) {
    this.db = database;
    this.cacheManager = new MetadataCacheManager(database, connection);
    this.service = new SalesforceService(connection, database);
    this.dependencyResolver = new DependencyResolver(database, this.service, this.cacheManager);
    this.preflightValidator = new PreflightValidator(database);
    this.smartMatcher = new SmartMatcher();
    this.debug = process.env.DEBUG_ORCHESTRATOR === 'true';
  }

  /**
   * Log debug messages if debug mode is enabled
   */
  private log(message: string): void {
    if (this.debug) {
      console.log(`[Orchestrator] ${message}`);
    }
  }

  /**
   * Initialize the orchestrator
   * Optionally pre-cache core objects for better performance
   */
  async initialize(): Promise<void> {
    this.log('Initializing orchestrator...');
    await this.cacheManager.initialize();
    this.log('✅ Orchestrator ready');
  }

  /**
   * Check for duplicate records before creation
   * Returns potential duplicates with confidence scores
   */
  async checkDuplicates(
    sobject: string,
    data: Record<string, any>,
    options?: {
      field?: string;
      limit?: number;
      minConfidence?: MatchConfidence;
    }
  ): Promise<MatchResult[]> {
    this.log(`Checking for duplicates in ${sobject}...`);

    // Determine which field to check (default to Name)
    const field = options?.field || 'Name';
    const searchValue = data[field];

    if (!searchValue) {
      this.log(`No value for field '${field}', skipping duplicate check`);
      return [];
    }

    // Get additional fields for better matching context
    const returnFields = ['Id', 'Name'];
    
    // Add common fields based on object type
    if (sobject === 'Account') {
      returnFields.push('Industry', 'BillingCity', 'Phone', 'Website');
    } else if (sobject === 'Contact') {
      returnFields.push('Email', 'Phone', 'AccountId', 'Title');
    } else if (sobject === 'Lead') {
      returnFields.push('Email', 'Phone', 'Company', 'Status');
    }

    try {
      const duplicates = await this.smartMatcher.findDuplicates(
        this.service.getConnection(),
        data,
        {
          sobject,
          field,
          returnFields,
          limit: options?.limit || 10,
          minConfidence: options?.minConfidence || MatchConfidence.MEDIUM
        }
      );

      this.log(`Found ${duplicates.length} potential duplicates`);
      return duplicates;
    } catch (error) {
      this.log(`Duplicate check failed: ${error}`);
      // Don't fail the operation if duplicate check fails
      return [];
    }
  }

  /**
   * Execute a single record operation
   * Simple path without dependency resolution
   */
  async executeSingleOperation(operation: SingleRecordOperation): Promise<SingleOperationResult> {
    this.log(`Executing single ${operation.type} operation on ${operation.sobject}`);

    const startTime = Date.now();
    const result: SingleOperationResult = {
      success: false,
      duration: 0,
      recordId: null,
      errors: [],
      warnings: [],
    };

    try {
      // Step 1: Ensure metadata is cached
      this.log(`Ensuring metadata for ${operation.sobject}...`);
      await this.cacheManager.ensureMetadata([operation.sobject]);

      // Step 2: Check for duplicates (CREATE operations only)
      if (operation.type === 'create') {
        const duplicates = await this.checkDuplicates(
          operation.sobject,
          operation.data
        );

        if (duplicates.length > 0) {
          // Add duplicate warnings to result
          const highConfidence = duplicates.filter(d => d.confidence === MatchConfidence.HIGH);
          const mediumConfidence = duplicates.filter(d => d.confidence === MatchConfidence.MEDIUM);

          if (highConfidence.length > 0) {
            result.warnings.push(
              `⚠️ POTENTIAL DUPLICATE: Found ${highConfidence.length} high-confidence match(es):`
            );
            highConfidence.forEach((dup, i) => {
              result.warnings.push(
                `  ${i + 1}. ${dup.record.Name || dup.record.Id} (${(dup.score * 100).toFixed(1)}% match)`
              );
            });
          }

          if (mediumConfidence.length > 0) {
            result.warnings.push(
              `ℹ️ Possible duplicates: Found ${mediumConfidence.length} medium-confidence match(es)`
            );
          }

          this.log(`Duplicate check completed: ${highConfidence.length} HIGH, ${mediumConfidence.length} MEDIUM`);
        }
      }

      // Step 3: Pre-flight validation
      if (operation.type === 'create') {
        const validation = await this.preflightValidator.validateCreate(
          operation.sobject,
          operation.data
        );

        if (!validation.valid) {
          result.errors = validation.errors.map(e => e.message);
          result.warnings = [...result.warnings, ...validation.warnings.map(w => w.message)];
          result.duration = Date.now() - startTime;
          return result;
        }

        result.warnings = [...result.warnings, ...validation.warnings.map(w => w.message)];
      } else if (operation.type === 'update' && operation.recordId) {
        const validation = await this.preflightValidator.validateUpdate(
          operation.sobject,
          operation.recordId,
          operation.data
        );

        if (!validation.valid) {
          result.errors = validation.errors.map(e => e.message);
          result.warnings = [...result.warnings, ...validation.warnings.map(w => w.message)];
          result.duration = Date.now() - startTime;
          return result;
        }

        result.warnings = [...result.warnings, ...validation.warnings.map(w => w.message)];
      }

      // Step 4: Execute operation
      let apiResult: any;
      switch (operation.type) {
        case 'create':
          apiResult = await this.service.createRecord(operation.sobject, operation.data);
          result.recordId = apiResult.id;
          result.success = apiResult.success;
          break;

        case 'update':
          if (!operation.recordId) {
            throw new Error('Record ID required for update operation');
          }
          apiResult = await this.service.updateRecord(
            operation.sobject,
            operation.recordId,
            operation.data
          );
          result.recordId = operation.recordId;
          result.success = apiResult.success;
          break;

        case 'delete':
          if (!operation.recordId) {
            throw new Error('Record ID required for delete operation');
          }
          apiResult = await this.service.deleteRecord(operation.sobject, operation.recordId);
          result.recordId = operation.recordId;
          result.success = apiResult.success;
          break;

        default:
          throw new Error(`Unknown operation type: ${operation.type}`);
      }

      if (!result.success && apiResult.errors) {
        result.errors = apiResult.errors.map((e: any) => e.message || String(e));
      }

    } catch (error) {
      result.success = false;
      result.errors.push(error instanceof Error ? error.message : String(error));
    }

    result.duration = Date.now() - startTime;
    this.log(`Single operation completed in ${result.duration}ms (success: ${result.success})`);

    return result;
  }

  /**
   * Execute multiple operations with dependency resolution
   * This is the main intelligence - analyzes dependencies and optimizes execution
   */
  async executeMultipleOperations(operations: RecordOperation[]): Promise<MultiOperationResult> {
    this.log(`Executing ${operations.length} operations with dependency resolution...`);

    const startTime = Date.now();
    const result: MultiOperationResult = {
      success: false,
      duration: 0,
      totalOperations: operations.length,
      successfulOperations: 0,
      failedOperations: 0,
      createdRecords: [],
      errors: [],
      warnings: [],
      executionPlan: [],
    };

    try {
      // Step 1: Analyze operations and extract object types
      const objectTypes = Array.from(new Set(operations.map(op => op.sobject)));
      this.log(`Operations involve ${objectTypes.length} object types: ${objectTypes.join(', ')}`);

      // Step 2: Ensure metadata is cached (with relationship expansion)
      this.log('Ensuring metadata with relationships...');
      await this.cacheManager.ensureMetadata(objectTypes);

      // Step 3: Use dependency resolver for intelligent execution
      this.log('Resolving dependencies and creating execution plan...');
      const resolverResult = await this.dependencyResolver.executeWithDependencies(operations);

      // Step 4: Aggregate results
      result.success = resolverResult.success;
      result.executionPlan = resolverResult.executionPlan;
      result.createdRecords = resolverResult.operations
        .filter(op => op.success && op.id)
        .map(op => ({
          tempId: op.tempId || '',
          recordId: op.id!,
          sobject: op.sobject,
        }));

      result.successfulOperations = resolverResult.operations.filter(op => op.success).length;
      result.failedOperations = resolverResult.operations.filter(op => !op.success).length;
      result.errors = resolverResult.errors.map(e => e.message);

    } catch (error) {
      result.success = false;
      result.errors.push(error instanceof Error ? error.message : String(error));
    }

    result.duration = Date.now() - startTime;
    this.log(`Multi-operation completed in ${result.duration}ms (${result.successfulOperations}/${operations.length} successful)`);

    return result;
  }

  /**
   * Smart operation executor
   * Automatically determines whether to use single or multi-operation path
   */
  async execute(input: OperationInput): Promise<OperationResult> {
    this.log('Analyzing input and determining execution strategy...');

    // Single operation path
    if ('sobject' in input && 'type' in input) {
      const singleResult = await this.executeSingleOperation(input as SingleRecordOperation);
      return {
        type: 'single',
        result: singleResult,
      };
    }

    // Multi-operation path
    if (Array.isArray(input)) {
      // Check if operations have dependencies
      const hasDependencies = input.some(op =>
        Object.values(op.data).some(val => typeof val === 'string' && val.startsWith('@'))
      );

      if (hasDependencies || input.length > 1) {
        this.log('Detected dependencies or multiple operations - using dependency resolver');
        const multiResult = await this.executeMultipleOperations(input);
        return {
          type: 'multi',
          result: multiResult,
        };
      } else if (input.length === 1) {
        // Single operation in array format
        const op = input[0];
        const singleOp: SingleRecordOperation = {
          type: op.type,
          sobject: op.sobject,
          data: op.data,
          recordId: 'recordId' in op ? (op as any).recordId : undefined,
        };
        const singleResult = await this.executeSingleOperation(singleOp);
        return {
          type: 'single',
          result: singleResult,
        };
      }
    }

    throw new Error('Invalid operation input format');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return this.cacheManager.getCacheStats();
  }

  /**
   * Force refresh metadata for specific objects
   */
  async refreshMetadata(objects: string[]): Promise<void> {
    this.log(`Force refreshing metadata for ${objects.length} objects...`);
    await this.cacheManager.refreshMetadata(objects);
  }

  /**
   * Clear all cached metadata
   */
  clearCache(): void {
    this.log('Clearing all cached metadata...');
    this.cacheManager.clearCache();
  }
}

/**
 * Single record operation (create, update, delete)
 */
export interface SingleRecordOperation {
  type: 'create' | 'update' | 'delete';
  sobject: string;
  data: Record<string, any>;
  recordId?: string; // Required for update/delete
}

/**
 * Result of a single operation
 */
export interface SingleOperationResult {
  success: boolean;
  duration: number;
  recordId: string | null;
  errors: string[];
  warnings: string[];
}

/**
 * Result of multiple operations
 */
export interface MultiOperationResult {
  success: boolean;
  duration: number;
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  createdRecords: CreatedRecord[];
  errors: string[];
  warnings: string[];
  executionPlan: any[];
}

/**
 * Created record info
 */
export interface CreatedRecord {
  tempId: string;
  recordId: string;
  sobject: string;
}

/**
 * Operation input (single or multiple)
 */
export type OperationInput = SingleRecordOperation | RecordOperation[];

/**
 * Operation result (single or multiple)
 */
export interface OperationResult {
  type: 'single' | 'multi';
  result: SingleOperationResult | MultiOperationResult;
}
