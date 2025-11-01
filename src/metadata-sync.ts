import jsforce from 'jsforce';
import { MetadataDatabase } from './database.js';

/**
 * Metadata Sync Service
 * Fetches and stores Salesforce metadata using REST APIs only
 * Following the modern approach: Describe API + UI API + Tooling API
 */
export class MetadataSyncService {
  private db: MetadataDatabase;
  private conn: jsforce.Connection;
  private debug: boolean;

  constructor(connection: jsforce.Connection, database: MetadataDatabase) {
    this.conn = connection;
    this.db = database;
    this.debug = process.env.DEBUG_SYNC === 'true';
  }

  /**
   * Log debug messages if debug mode is enabled
   */
  private log(message: string): void {
    if (this.debug) {
      console.log(message);
    }
  }

  /**
   * Log errors (always shown)
   */
  private logError(message: string): void {
    console.error(message);
  }

  /**
   * Full sync: Fetch all metadata from Salesforce and store in SQLite
   */
  async syncAll(options?: { objects?: string[] }): Promise<SyncResult> {
    const startTime = Date.now();
    const result: SyncResult = {
      success: true,
      objectsSynced: 0,
      fieldsSynced: 0,
      validationRulesSynced: 0,
      relationshipsSynced: 0,
      errors: [],
      duration: 0,
    };

    try {
      this.log('🔄 Starting metadata sync...\n');

      // Update org info
      await this.syncOrgInfo();
      this.log('✅ Org info synced');

      // Get list of objects to sync
      const objectsToSync = options?.objects || await this.getStandardObjects();
      this.log(`📋 Syncing ${objectsToSync.length} objects...\n`);

      // Sync each object
      for (const objectName of objectsToSync) {
        try {
          await this.syncObject(objectName);
          result.objectsSynced++;
          this.log(`✅ Synced: ${objectName}`);
        } catch (error) {
          const errorMsg = `Failed to sync ${objectName}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          result.errors.push(errorMsg);
          this.logError(`❌ ${errorMsg}`);
        }
      }

      // Sync validation rules via Tooling API
      this.log('\n📏 Syncing validation rules...');
      const vrCount = await this.syncValidationRules();
      result.validationRulesSynced = vrCount;
      this.log(`✅ Synced ${vrCount} validation rules`);

      // Get field and relationship counts
      const stats = this.db.getStats();
      result.fieldsSynced = stats.fields.count;
      result.relationshipsSynced = stats.relationships.count;

      result.duration = Date.now() - startTime;
      this.log(`\n✅ Sync complete in ${result.duration}ms`);

      return result;
    } catch (error) {
      result.success = false;
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
      result.duration = Date.now() - startTime;
      throw error;
    }
  }

  /**
   * Sync org information
   */
  private async syncOrgInfo(): Promise<void> {
    const identity = await this.conn.identity();
    this.db.updateOrgInfo(
      identity.organization_id,
      this.conn.instanceUrl,
      identity.organization_id || 'Unknown'
    );
  }

  /**
   * Get list of commonly used standard objects
   */
  private async getStandardObjects(): Promise<string[]> {
    const describe = await this.conn.describeGlobal();
    
    // Filter to standard objects that are commonly used
    const standardObjects = describe.sobjects
      .filter(obj => 
        obj.queryable && 
        obj.createable &&
        !obj.custom // Only standard objects
      )
      .map(obj => obj.name);

    // Prioritize most common objects
    const priority = ['Account', 'Contact', 'Lead', 'Opportunity', 'Case', 'Task', 'Event'];
    const prioritized = priority.filter(name => standardObjects.includes(name));
    const others = standardObjects.filter(name => !priority.includes(name)).slice(0, 20); // Limit to 20 additional

    return [...prioritized, ...others];
  }

  /**
   * Sync a single object's metadata using Describe API
   */
  async syncObject(objectName: string): Promise<void> {
    // Get full describe via REST API
    const describe = await this.conn.sobject(objectName).describe();

    // Store object metadata
    const sobjectId = this.db.upsertSObject({
      name: describe.name,
      label: describe.label,
      labelPlural: describe.labelPlural,
      keyPrefix: describe.keyPrefix,
      custom: describe.custom,
      queryable: describe.queryable,
      createable: describe.createable,
      updateable: describe.updateable,
      deletable: describe.deletable,
      retrieveable: describe.retrieveable,
      searchable: describe.searchable,
    });

    // Store field metadata
    for (const field of describe.fields) {
      this.db.upsertField(sobjectId, {
        name: field.name,
        label: field.label,
        type: field.type,
        length: field.length,
        precision: field.precision,
        scale: field.scale,
        nillable: field.nillable,
        unique: field.unique,
        externalId: field.externalId,
        autoNumber: field.autoNumber,
        calculated: field.calculated,
        defaultValue: field.defaultValue !== null ? String(field.defaultValue) : null,
        picklistValues: field.picklistValues,
        referenceTo: field.referenceTo,
        relationshipName: field.relationshipName,
        inlineHelpText: field.inlineHelpText,
      });

      // Store relationships if this is a reference field
      if (field.referenceTo && field.referenceTo.length > 0) {
        for (const refObject of field.referenceTo) {
          const refSobject = this.db.getSObject(refObject);
          if (refSobject) {
            const fieldRecord = this.db.getFields(objectName).find(f => f.name === field.name);
            if (fieldRecord) {
              this.db.upsertRelationship(sobjectId, refSobject.id, fieldRecord.id, {
                relationshipName: field.relationshipName || field.name,
                type: field.type === 'reference' ? 'lookup' : field.type,
                cascadeDelete: field.cascadeDelete || false,
                restrictedDelete: field.restrictedDelete || false,
                required: !field.nillable,
              });
            }
          }
        }
      }
    }
  }

  /**
   * Sync validation rules using Tooling API (REST)
   */
  private async syncValidationRules(): Promise<number> {
    try {
      // Query validation rules via Tooling API
      // Note: We can't use Metadata field in bulk queries, so we query basic info only
      const query = `
        SELECT Id, EntityDefinitionId, ValidationName, Active, 
               Description, ErrorMessage, ErrorDisplayField
        FROM ValidationRule
        WHERE Active = true
        LIMIT 200
      `;

      const result = await this.conn.tooling.query(query);
      let count = 0;

      // Get entity definition names separately
      const entityIds = [...new Set((result.records as any[])
        .map(r => r.EntityDefinitionId)
        .filter(id => id && id.startsWith('01I')))]; // Filter valid EntityDefinition IDs

      const entityMap = new Map<string, string>();

      if (entityIds.length > 0) {
        const entityQuery = `
          SELECT Id, QualifiedApiName 
          FROM EntityDefinition 
          WHERE Id IN ('${entityIds.join("','")}')
        `;
        const entityResult = await this.conn.tooling.query(entityQuery);
        for (const entity of entityResult.records as any[]) {
          entityMap.set(entity.Id, entity.QualifiedApiName);
        }
      }

      for (const record of result.records as any[]) {
        const objectName = entityMap.get(record.EntityDefinitionId);
        if (!objectName) continue;

        const sobject = this.db.getSObject(objectName);
        if (!sobject) continue;

        this.db.upsertValidationRule(sobject.id, {
          fullName: record.ValidationName,
          active: record.Active,
          errorMessage: record.ErrorMessage,
          errorDisplayField: record.ErrorDisplayField,
          errorConditionFormula: 'See Salesforce Setup', // Formula requires separate Metadata API call
          description: record.Description,
        });
        count++;
      }

      return count;
    } catch (error) {
      this.logError('⚠️ Failed to sync validation rules: ' + (error instanceof Error ? error.message : 'Unknown error'));
      return 0;
    }
  }

  /**
   * Sync specific objects only
   */
  async syncObjects(objectNames: string[]): Promise<SyncResult> {
    const result = await this.syncAll({ objects: objectNames });
    return result;
  }

  /**
   * Get sync status/statistics
   */
  getSyncStats(): any {
    return this.db.getStats();
  }
}

/**
 * Result of a metadata sync operation
 */
export interface SyncResult {
  success: boolean;
  objectsSynced: number;
  fieldsSynced: number;
  validationRulesSynced: number;
  relationshipsSynced: number;
  errors: string[];
  duration: number;
}
