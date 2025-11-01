import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

export class MetadataDatabase {
  private db: Database.Database;
  private dbPath: string;

  constructor(dbPath?: string) {
    // Default to storing in user's home directory or project directory
    this.dbPath = dbPath || path.join(process.cwd(), 'salesforce-metadata.db');
    
    // Ensure directory exists
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(this.dbPath);
    this.initialize();
    this.runMigrations(); // Run migrations after schema
  }

  private initialize(): void {
    // Enable foreign keys
    this.db.pragma('foreign_keys = ON');

    // Create tables for metadata storage
    this.db.exec(`
      -- Store Salesforce org information
      CREATE TABLE IF NOT EXISTS org_info (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        org_id TEXT NOT NULL UNIQUE,
        instance_url TEXT NOT NULL,
        org_name TEXT,
        last_synced_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      -- Store SObject metadata
      CREATE TABLE IF NOT EXISTS sobjects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        label TEXT NOT NULL,
        label_plural TEXT,
        api_name TEXT NOT NULL,
        key_prefix TEXT,
        is_custom INTEGER DEFAULT 0,
        is_queryable INTEGER DEFAULT 1,
        is_createable INTEGER DEFAULT 0,
        is_updateable INTEGER DEFAULT 0,
        is_deletable INTEGER DEFAULT 0,
        is_retrieveable INTEGER DEFAULT 0,
        is_searchable INTEGER DEFAULT 0,
        synced_at TEXT DEFAULT CURRENT_TIMESTAMP,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      -- Store field metadata
      CREATE TABLE IF NOT EXISTS fields (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sobject_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        label TEXT NOT NULL,
        api_name TEXT NOT NULL,
        type TEXT NOT NULL,
        length INTEGER,
        precision_val INTEGER,
        scale INTEGER,
        is_required INTEGER DEFAULT 0,
        is_nillable INTEGER DEFAULT 1,
        is_unique INTEGER DEFAULT 0,
        is_external_id INTEGER DEFAULT 0,
        is_auto_number INTEGER DEFAULT 0,
        is_calculated INTEGER DEFAULT 0,
        default_value TEXT,
        picklist_values TEXT, -- JSON array of picklist values
        reference_to TEXT, -- JSON array of reference object names
        relationship_name TEXT,
        help_text TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sobject_id) REFERENCES sobjects(id) ON DELETE CASCADE,
        UNIQUE(sobject_id, name)
      );

      -- Store validation rules
      CREATE TABLE IF NOT EXISTS validation_rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sobject_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        api_name TEXT NOT NULL,
        active INTEGER DEFAULT 1,
        error_message TEXT NOT NULL,
        error_display_field TEXT,
        formula TEXT NOT NULL,
        description TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sobject_id) REFERENCES sobjects(id) ON DELETE CASCADE,
        UNIQUE(sobject_id, name)
      );

      -- Store relationships (lookup and master-detail)
      CREATE TABLE IF NOT EXISTS relationships (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_sobject_id INTEGER NOT NULL,
        to_sobject_id INTEGER NOT NULL,
        field_id INTEGER NOT NULL,
        relationship_name TEXT NOT NULL,
        relationship_type TEXT NOT NULL, -- 'lookup', 'master-detail', 'external-lookup'
        is_cascade_delete INTEGER DEFAULT 0,
        is_restricted_delete INTEGER DEFAULT 0,
        is_required INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (from_sobject_id) REFERENCES sobjects(id) ON DELETE CASCADE,
        FOREIGN KEY (to_sobject_id) REFERENCES sobjects(id) ON DELETE CASCADE,
        FOREIGN KEY (field_id) REFERENCES fields(id) ON DELETE CASCADE,
        UNIQUE(from_sobject_id, field_id)
      );

      -- Store record types
      CREATE TABLE IF NOT EXISTS record_types (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sobject_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        developer_name TEXT NOT NULL,
        record_type_id TEXT NOT NULL UNIQUE,
        is_active INTEGER DEFAULT 1,
        is_default INTEGER DEFAULT 0,
        description TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sobject_id) REFERENCES sobjects(id) ON DELETE CASCADE,
        UNIQUE(sobject_id, developer_name)
      );

      -- Store field dependencies (controlling/dependent picklists)
      CREATE TABLE IF NOT EXISTS field_dependencies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sobject_id INTEGER NOT NULL,
        controlling_field_id INTEGER NOT NULL,
        dependent_field_id INTEGER NOT NULL,
        dependency_matrix TEXT, -- JSON object mapping controlling values to dependent values
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sobject_id) REFERENCES sobjects(id) ON DELETE CASCADE,
        FOREIGN KEY (controlling_field_id) REFERENCES fields(id) ON DELETE CASCADE,
        FOREIGN KEY (dependent_field_id) REFERENCES fields(id) ON DELETE CASCADE,
        UNIQUE(controlling_field_id, dependent_field_id)
      );

      -- Store triggers (for awareness of custom logic)
      CREATE TABLE IF NOT EXISTS triggers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sobject_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        api_name TEXT NOT NULL,
        active INTEGER DEFAULT 1,
        trigger_events TEXT NOT NULL, -- JSON array: ['before insert', 'after update', etc.]
        description TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sobject_id) REFERENCES sobjects(id) ON DELETE CASCADE,
        UNIQUE(sobject_id, name)
      );

      -- Create indexes for better query performance
      CREATE INDEX IF NOT EXISTS idx_fields_sobject ON fields(sobject_id);
      CREATE INDEX IF NOT EXISTS idx_fields_required ON fields(is_required);
      CREATE INDEX IF NOT EXISTS idx_validation_sobject ON validation_rules(sobject_id);
      CREATE INDEX IF NOT EXISTS idx_validation_active ON validation_rules(active);
      CREATE INDEX IF NOT EXISTS idx_relationships_from ON relationships(from_sobject_id);
      CREATE INDEX IF NOT EXISTS idx_relationships_to ON relationships(to_sobject_id);
      CREATE INDEX IF NOT EXISTS idx_record_types_sobject ON record_types(sobject_id);
      CREATE INDEX IF NOT EXISTS idx_triggers_sobject ON triggers(sobject_id);
    `);

    // Only log in debug mode
    if (process.env.DEBUG_DB === 'true') {
      console.log(`Database initialized at: ${this.dbPath}`);
    }
  }

  /**
   * Run database migrations
   * This allows us to update the schema without breaking existing databases
   */
  private runMigrations(): void {
    // Migration 1: Add synced_at column to sobjects table (for cache TTL)
    try {
      // Check if column exists
      const columns = this.db.pragma('table_info(sobjects)') as any[];
      const hasSyncedAt = columns.some((col: any) => col.name === 'synced_at');
      
      if (!hasSyncedAt) {
        this.db.exec('ALTER TABLE sobjects ADD COLUMN synced_at TEXT DEFAULT CURRENT_TIMESTAMP');
        if (process.env.DEBUG_DB === 'true') {
          console.log('Migration: Added synced_at column to sobjects table');
        }
      }
    } catch (error) {
      // Column might already exist, ignore error
      if (process.env.DEBUG_DB === 'true') {
        console.log('Migration: synced_at column already exists or migration failed');
      }
    }
  }

  /**
   * Get the database instance
   */
  getDb(): Database.Database {
    return this.db;
  }

  /**
   * Get database path
   */
  getDbPath(): string {
    return this.dbPath;
  }

  /**
   * Update org info
   */
  updateOrgInfo(orgId: string, instanceUrl: string, orgName?: string): void {
    const stmt = this.db.prepare(`
      INSERT INTO org_info (id, org_id, instance_url, org_name, last_synced_at, updated_at)
      VALUES (1, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        org_id = excluded.org_id,
        instance_url = excluded.instance_url,
        org_name = excluded.org_name,
        last_synced_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    `);
    stmt.run(orgId, instanceUrl, orgName || null);
  }

  /**
   * Get org info
   */
  getOrgInfo(): any {
    const stmt = this.db.prepare('SELECT * FROM org_info WHERE id = 1');
    return stmt.get();
  }

  /**
   * Insert or update SObject metadata
   */
  upsertSObject(sobject: any): number {
    const stmt = this.db.prepare(`
      INSERT INTO sobjects (
        name, label, label_plural, api_name, key_prefix,
        is_custom, is_queryable, is_createable, is_updateable,
        is_deletable, is_retrieveable, is_searchable, synced_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(name) DO UPDATE SET
        label = excluded.label,
        label_plural = excluded.label_plural,
        api_name = excluded.api_name,
        key_prefix = excluded.key_prefix,
        is_custom = excluded.is_custom,
        is_queryable = excluded.is_queryable,
        is_createable = excluded.is_createable,
        is_updateable = excluded.is_updateable,
        is_deletable = excluded.is_deletable,
        is_retrieveable = excluded.is_retrieveable,
        is_searchable = excluded.is_searchable,
        synced_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    `);

    const info = stmt.run(
      sobject.name,
      sobject.label,
      sobject.labelPlural || sobject.label,
      sobject.name,
      sobject.keyPrefix || null,
      sobject.custom ? 1 : 0,
      sobject.queryable ? 1 : 0,
      sobject.createable ? 1 : 0,
      sobject.updateable ? 1 : 0,
      sobject.deletable ? 1 : 0,
      sobject.retrieveable ? 1 : 0,
      sobject.searchable ? 1 : 0
    );

    // Get the ID of the inserted/updated record
    const getId = this.db.prepare('SELECT id FROM sobjects WHERE name = ?');
    const result = getId.get(sobject.name) as { id: number };
    return result.id;
  }

  /**
   * Get SObject by name
   */
  getSObject(name: string): any {
    const stmt = this.db.prepare('SELECT * FROM sobjects WHERE name = ?');
    return stmt.get(name);
  }

  /**
   * Check if SObject metadata is stale (older than TTL)
   */
  isMetadataStale(name: string, ttlMs: number): boolean {
    const sobject = this.getSObject(name);
    if (!sobject) return true; // Missing = stale
    
    if (!sobject.synced_at) return true; // Never synced = stale
    
    const syncedTime = new Date(sobject.synced_at).getTime();
    const age = Date.now() - syncedTime;
    return age > ttlMs;
  }

  /**
   * Get multiple SObjects by names
   */
  getSObjects(names: string[]): any[] {
    if (names.length === 0) return [];
    
    const placeholders = names.map(() => '?').join(',');
    const stmt = this.db.prepare(`SELECT * FROM sobjects WHERE name IN (${placeholders})`);
    return stmt.all(...names) as any[];
  }

  /**
   * Insert or update field metadata
   */
  upsertField(sobjectId: number, field: any): void {
    const stmt = this.db.prepare(`
      INSERT INTO fields (
        sobject_id, name, label, api_name, type, length,
        precision_val, scale, is_required, is_nillable, is_unique,
        is_external_id, is_auto_number, is_calculated, default_value,
        picklist_values, reference_to, relationship_name, help_text, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(sobject_id, name) DO UPDATE SET
        label = excluded.label,
        api_name = excluded.api_name,
        type = excluded.type,
        length = excluded.length,
        precision_val = excluded.precision_val,
        scale = excluded.scale,
        is_required = excluded.is_required,
        is_nillable = excluded.is_nillable,
        is_unique = excluded.is_unique,
        is_external_id = excluded.is_external_id,
        is_auto_number = excluded.is_auto_number,
        is_calculated = excluded.is_calculated,
        default_value = excluded.default_value,
        picklist_values = excluded.picklist_values,
        reference_to = excluded.reference_to,
        relationship_name = excluded.relationship_name,
        help_text = excluded.help_text,
        updated_at = CURRENT_TIMESTAMP
    `);

    stmt.run(
      sobjectId,
      field.name,
      field.label,
      field.name,
      field.type,
      field.length || null,
      field.precision || null,
      field.scale || null,
      field.nillable === false ? 1 : 0, // Required if not nillable
      field.nillable ? 1 : 0,
      field.unique ? 1 : 0,
      field.externalId ? 1 : 0,
      field.autoNumber ? 1 : 0,
      field.calculated ? 1 : 0,
      field.defaultValue || null,
      field.picklistValues ? JSON.stringify(field.picklistValues) : null,
      field.referenceTo && field.referenceTo.length > 0 ? JSON.stringify(field.referenceTo) : null,
      field.relationshipName || null,
      field.inlineHelpText || null
    );
  }

  /**
   * Get required fields for an SObject
   */
  getRequiredFields(sobjectName: string): any[] {
    const stmt = this.db.prepare(`
      SELECT f.* FROM fields f
      JOIN sobjects s ON f.sobject_id = s.id
      WHERE s.name = ? AND f.is_required = 1
    `);
    return stmt.all(sobjectName);
  }

  /**
   * Get all fields for an SObject
   */
  getFields(sobjectName: string): any[] {
    const stmt = this.db.prepare(`
      SELECT f.* FROM fields f
      JOIN sobjects s ON f.sobject_id = s.id
      WHERE s.name = ?
    `);
    return stmt.all(sobjectName);
  }

  /**
   * Insert validation rule
   */
  upsertValidationRule(sobjectId: number, rule: any): void {
    const stmt = this.db.prepare(`
      INSERT INTO validation_rules (
        sobject_id, name, api_name, active, error_message,
        error_display_field, formula, description, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(sobject_id, name) DO UPDATE SET
        api_name = excluded.api_name,
        active = excluded.active,
        error_message = excluded.error_message,
        error_display_field = excluded.error_display_field,
        formula = excluded.formula,
        description = excluded.description,
        updated_at = CURRENT_TIMESTAMP
    `);

    stmt.run(
      sobjectId,
      rule.fullName,
      rule.fullName,
      rule.active ? 1 : 0,
      rule.errorMessage,
      rule.errorDisplayField || null,
      rule.errorConditionFormula,
      rule.description || null
    );
  }

  /**
   * Get validation rules for an SObject
   */
  getValidationRules(sobjectName: string): any[] {
    const stmt = this.db.prepare(`
      SELECT vr.* FROM validation_rules vr
      JOIN sobjects s ON vr.sobject_id = s.id
      WHERE s.name = ? AND vr.active = 1
    `);
    return stmt.all(sobjectName);
  }

  /**
   * Insert relationship
   */
  upsertRelationship(fromSobjectId: number, toSobjectId: number, fieldId: number, relationship: any): void {
    const stmt = this.db.prepare(`
      INSERT INTO relationships (
        from_sobject_id, to_sobject_id, field_id, relationship_name,
        relationship_type, is_cascade_delete, is_restricted_delete, is_required, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(from_sobject_id, field_id) DO UPDATE SET
        to_sobject_id = excluded.to_sobject_id,
        relationship_name = excluded.relationship_name,
        relationship_type = excluded.relationship_type,
        is_cascade_delete = excluded.is_cascade_delete,
        is_restricted_delete = excluded.is_restricted_delete,
        is_required = excluded.is_required,
        updated_at = CURRENT_TIMESTAMP
    `);

    stmt.run(
      fromSobjectId,
      toSobjectId,
      fieldId,
      relationship.relationshipName,
      relationship.type,
      relationship.cascadeDelete ? 1 : 0,
      relationship.restrictedDelete ? 1 : 0,
      relationship.required ? 1 : 0
    );
  }

  /**
   * Get relationships for an SObject
   */
  getRelationships(sobjectName: string): any[] {
    const stmt = this.db.prepare(`
      SELECT 
        r.*,
        s1.name as from_sobject,
        s2.name as to_sobject,
        f.name as field_name
      FROM relationships r
      JOIN sobjects s1 ON r.from_sobject_id = s1.id
      JOIN sobjects s2 ON r.to_sobject_id = s2.id
      JOIN fields f ON r.field_id = f.id
      WHERE s1.name = ?
    `);
    return stmt.all(sobjectName);
  }

  /**
   * Clear all metadata (useful for full resync)
   */
  clearMetadata(): void {
    this.db.exec(`
      DELETE FROM field_dependencies;
      DELETE FROM triggers;
      DELETE FROM record_types;
      DELETE FROM relationships;
      DELETE FROM validation_rules;
      DELETE FROM fields;
      DELETE FROM sobjects;
    `);
  }

  /**
   * Get database statistics
   */
  getStats(): any {
    const stats = {
      sobjects: this.db.prepare('SELECT COUNT(*) as count FROM sobjects').get(),
      fields: this.db.prepare('SELECT COUNT(*) as count FROM fields').get(),
      validationRules: this.db.prepare('SELECT COUNT(*) as count FROM validation_rules').get(),
      relationships: this.db.prepare('SELECT COUNT(*) as count FROM relationships').get(),
      orgInfo: this.getOrgInfo(),
    };
    return stats;
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }
}

// Export singleton instance
let dbInstance: MetadataDatabase | null = null;

export function getDatabase(dbPath?: string): MetadataDatabase {
  if (!dbInstance) {
    dbInstance = new MetadataDatabase(dbPath);
  }
  return dbInstance;
}
