import { MetadataDatabase } from './database.js';
import { MetadataSyncService } from './metadata-sync.js';
import jsforce from 'jsforce';

/**
 * Metadata Cache Manager
 * 
 * Intelligent caching layer that:
 * - Manages metadata TTL (Time To Live)
 * - Lazy-loads only needed objects
 * - Auto-syncs stale metadata
 * - Expands relationships automatically
 * 
 * This solves the chicken-and-egg problem:
 * - Dependency Resolver needs metadata
 * - Cache Manager ensures metadata is available
 * - Syncs only what's needed, when needed
 */
export class MetadataCacheManager {
  private db: MetadataDatabase;
  private syncService: MetadataSyncService;
  private debug: boolean;
  
  // Core objects that are always cached on startup
  private static readonly CORE_OBJECTS = [
    'Account',
    'Contact',
    'Lead',
    'Opportunity',
    'User',
    'Case'
  ];
  
  // TTL: 24 hours (metadata doesn't change often)
  private static readonly DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
  
  constructor(
    database: MetadataDatabase,
    connection: jsforce.Connection,
    ttlMs: number = MetadataCacheManager.DEFAULT_TTL_MS
  ) {
    this.db = database;
    this.syncService = new MetadataSyncService(connection, database);
    this.debug = process.env.DEBUG_CACHE === 'true';
    this.ttl = ttlMs;
  }
  
  private ttl: number;
  
  /**
   * Log debug messages if debug mode is enabled
   */
  private log(message: string): void {
    if (this.debug) {
      console.log(`[MetadataCacheManager] ${message}`);
    }
  }
  
  /**
   * Initialize cache with core objects
   * Call this on server startup for optimal performance
   */
  async initialize(): Promise<void> {
    this.log('Initializing cache with core objects...');
    
    const missing = this.findMissingOrStale(MetadataCacheManager.CORE_OBJECTS);
    
    if (missing.length > 0) {
      this.log(`Syncing ${missing.length} core objects: ${missing.join(', ')}`);
      await this.syncObjects(missing);
    } else {
      this.log('All core objects already cached');
    }
  }
  
  /**
   * Ensure metadata for specified objects is cached and fresh
   * This is the main entry point used by other components
   */
  async ensureMetadata(objects: string[]): Promise<void> {
    if (objects.length === 0) return;
    
    this.log(`Ensuring metadata for: ${objects.join(', ')}`);
    
    const missing = this.findMissingOrStale(objects);
    
    if (missing.length > 0) {
      this.log(`Need to sync ${missing.length} objects: ${missing.join(', ')}`);
      await this.syncObjects(missing);
    } else {
      this.log('All requested objects already cached and fresh');
    }
  }
  
  /**
   * Ensure metadata for an object and its relationships
   * This recursively expands to include related objects
   */
  async ensureMetadataWithRelationships(sobject: string, depth: number = 1): Promise<void> {
    this.log(`Ensuring metadata with relationships for ${sobject} (depth: ${depth})`);
    
    // First, ensure the object itself is cached
    await this.ensureMetadata([sobject]);
    
    if (depth <= 0) return;
    
    // Get relationships for this object
    const relationships = this.db.getRelationships(sobject);
    
    if (relationships.length === 0) {
      this.log(`No relationships found for ${sobject}`);
      return;
    }
    
    // Extract related object names
    const relatedObjects = Array.from(
      new Set(relationships.map(r => r.to_sobject))
    );
    
    this.log(`Found ${relatedObjects.length} related objects: ${relatedObjects.join(', ')}`);
    
    // Recursively ensure related objects (with reduced depth)
    for (const relatedObj of relatedObjects) {
      await this.ensureMetadataWithRelationships(relatedObj, depth - 1);
    }
  }
  
  /**
   * Find objects that are missing from cache or stale (expired TTL)
   */
  private findMissingOrStale(objects: string[]): string[] {
    const missing: string[] = [];
    
    for (const obj of objects) {
      if (this.db.isMetadataStale(obj, this.ttl)) {
        missing.push(obj);
      }
    }
    
    return missing;
  }
  
  /**
   * Sync specified objects from Salesforce
   */
  private async syncObjects(objects: string[]): Promise<void> {
    if (objects.length === 0) return;
    
    this.log(`Starting sync for ${objects.length} objects...`);
    const startTime = Date.now();
    
    try {
      // Use the metadata sync service to fetch and store
      const result = await this.syncService.syncObjects(objects);
      
      const duration = Date.now() - startTime;
      this.log(`✅ Synced ${objects.length} objects in ${duration}ms`);
      this.log(`   Fields: ${result.fieldsSynced}, Relationships: ${result.relationshipsSynced}`);
      
    } catch (error) {
      this.log(`❌ Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }
  
  /**
   * Force refresh metadata for specified objects (ignore TTL)
   */
  async refreshMetadata(objects: string[]): Promise<void> {
    this.log(`Force refreshing metadata for: ${objects.join(', ')}`);
    await this.syncObjects(objects);
  }
  
  /**
   * Clear all cached metadata (for testing or manual refresh)
   */
  clearCache(): void {
    this.log('Clearing all cached metadata...');
    this.db.clearMetadata();
  }
  
  /**
   * Get cache statistics
   */
  getCacheStats(): CacheStats {
    const stats = this.db.getStats();
    
    return {
      totalObjects: (stats.sobjects as any).count || 0,
      totalFields: (stats.fields as any).count || 0,
      totalRelationships: (stats.relationships as any).count || 0,
      coreObjectsCached: this.countCachedObjects(MetadataCacheManager.CORE_OBJECTS),
      ttlMs: this.ttl,
      ttlHours: this.ttl / (1000 * 60 * 60),
    };
  }
  
  /**
   * Count how many objects from a list are currently cached
   */
  private countCachedObjects(objects: string[]): number {
    return objects.filter(obj => !this.db.isMetadataStale(obj, this.ttl)).length;
  }
  
  /**
   * Check if a specific object is cached and fresh
   */
  isCached(sobject: string): boolean {
    return !this.db.isMetadataStale(sobject, this.ttl);
  }
  
  /**
   * Get age of cached metadata for an object (in milliseconds)
   */
  getMetadataAge(sobject: string): number | null {
    const obj = this.db.getSObject(sobject);
    if (!obj || !obj.synced_at) return null;
    
    const syncedTime = new Date(obj.synced_at).getTime();
    return Date.now() - syncedTime;
  }
  
  /**
   * Set custom TTL (useful for testing or different environments)
   */
  setTTL(ttlMs: number): void {
    this.log(`Setting TTL to ${ttlMs}ms (${ttlMs / (1000 * 60 * 60)} hours)`);
    this.ttl = ttlMs;
  }
}

/**
 * Cache statistics
 */
export interface CacheStats {
  totalObjects: number;
  totalFields: number;
  totalRelationships: number;
  coreObjectsCached: number;
  ttlMs: number;
  ttlHours: number;
}
