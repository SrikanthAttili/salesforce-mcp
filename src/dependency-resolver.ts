import { MetadataDatabase } from './database.js';
import { SalesforceService } from './service.js';
import { MetadataCacheManager } from './cache-manager.js';

/**
 * Graph-based Dependency Resolver
 * Analyzes multi-record operations and generates optimal execution plans
 */
export class DependencyResolver {
  private db: MetadataDatabase;
  private service: SalesforceService;
  private cacheManager: MetadataCacheManager;
  private debug: boolean;

  constructor(
    database: MetadataDatabase, 
    service: SalesforceService,
    cacheManager: MetadataCacheManager
  ) {
    this.db = database;
    this.service = service;
    this.cacheManager = cacheManager;
    this.debug = process.env.DEBUG_RESOLVER === 'true';
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
   * Analyze and execute multi-record operations with dependency resolution
   */
  async executeWithDependencies(operations: RecordOperation[]): Promise<ExecutionResult> {
    this.log(`🔍 Analyzing ${operations.length} operations for dependencies...`);

    const startTime = Date.now();
    const result: ExecutionResult = {
      success: true,
      operations: [],
      totalDuration: 0,
      executionPlan: [],
      errors: [],
    };

    try {
      // Step 0: Ensure metadata is cached for all objects involved
      const objectNames = Array.from(new Set(operations.map(op => op.sobject)));
      this.log(`📥 Ensuring metadata for objects: ${objectNames.join(', ')}`);
      await this.cacheManager.ensureMetadata(objectNames);
      
      // Step 1: Build dependency graph
      const graph = await this.buildDependencyGraph(operations);
      this.log(`📊 Dependency graph built with ${graph.nodes.length} nodes`);

      // Step 2: Detect circular dependencies
      const circular = this.detectCircularDependencies(graph);
      if (circular.length > 0) {
        this.log(`🔄 Detected ${circular.length} circular dependencies`);
        // We'll handle these by breaking the cycle
      }

      // Step 3: Generate execution plan (topological sort)
      const executionPlan = this.generateExecutionPlan(graph, circular);
      result.executionPlan = executionPlan;
      this.log(`📋 Execution plan generated: ${executionPlan.length} batches`);

      // Step 4: Execute plan in order
      const executed = await this.executePlan(executionPlan);
      result.operations = executed.operations;
      result.success = executed.success;
      result.errors = executed.errors;

      result.totalDuration = Date.now() - startTime;
      this.log(`✅ Execution complete in ${result.totalDuration}ms`);

      return result;

    } catch (error) {
      result.success = false;
      result.errors.push({
        message: error instanceof Error ? error.message : 'Unknown error',
        phase: 'analysis',
      });
      result.totalDuration = Date.now() - startTime;
      return result;
    }
  }

  /**
   * Build dependency graph from operations
   */
  private async buildDependencyGraph(operations: RecordOperation[]): Promise<DependencyGraph> {
    // Ensure related objects are also cached (depth=1 for direct relationships)
    const objectNames = Array.from(new Set(operations.map(op => op.sobject)));
    for (const objName of objectNames) {
      await this.cacheManager.ensureMetadataWithRelationships(objName, 1);
    }
    
    const graph: DependencyGraph = {
      nodes: [],
      edges: [],
    };

    // Create nodes for each operation
    for (let i = 0; i < operations.length; i++) {
      const op = operations[i];
      const node: GraphNode = {
        id: `op_${i}`,
        operation: op,
        dependencies: [],
        dependents: [],
        level: 0,
        executed: false,
        tempId: op.tempId, // Temporary ID for reference (e.g., "@account1")
      };
      graph.nodes.push(node);
    }

    // Analyze relationships to build edges
    for (const node of graph.nodes) {
      const relationships = this.db.getRelationships(node.operation.sobject);
      
      // Check if this operation references other operations
      for (const [fieldName, value] of Object.entries(node.operation.data)) {
        // Check if value is a temporary reference (e.g., "@account1")
        if (typeof value === 'string' && value.startsWith('@')) {
          const referencedNode = graph.nodes.find(n => n.tempId === value);
          if (referencedNode) {
            // This node depends on referencedNode
            const edge: DependencyEdge = {
              from: referencedNode.id,
              to: node.id,
              field: fieldName,
              type: 'required',
            };
            graph.edges.push(edge);
            node.dependencies.push(referencedNode.id);
            referencedNode.dependents.push(node.id);
            this.log(`  📎 ${node.id} depends on ${referencedNode.id} via ${fieldName}`);
          }
        }

        // Check if field is a required relationship
        const relationship = relationships.find(r => r.field_name === fieldName);
        if (relationship && relationship.is_required && !value) {
          // Mark as dependency that needs resolution
          this.log(`  ⚠️  ${node.id} has required field ${fieldName} that's empty`);
        }
      }
    }

    return graph;
  }

  /**
   * Detect circular dependencies using DFS
   */
  private detectCircularDependencies(graph: DependencyGraph): CircularDependency[] {
    const circular: CircularDependency[] = [];
    const visited = new Set<string>();
    const recStack = new Set<string>();

    const dfs = (nodeId: string, path: string[]): boolean => {
      visited.add(nodeId);
      recStack.add(nodeId);
      path.push(nodeId);

      const node = graph.nodes.find(n => n.id === nodeId);
      if (!node) return false;

      for (const depId of node.dependencies) {
        if (!visited.has(depId)) {
          if (dfs(depId, [...path])) return true;
        } else if (recStack.has(depId)) {
          // Found a cycle
          const cycleStart = path.indexOf(depId);
          const cycle = path.slice(cycleStart);
          circular.push({
            nodes: cycle,
            path: cycle,
          });
          return true;
        }
      }

      recStack.delete(nodeId);
      return false;
    };

    for (const node of graph.nodes) {
      if (!visited.has(node.id)) {
        dfs(node.id, []);
      }
    }

    return circular;
  }

  /**
   * Generate execution plan using topological sort
   */
  private generateExecutionPlan(
    graph: DependencyGraph,
    circular: CircularDependency[]
  ): ExecutionBatch[] {
    const batches: ExecutionBatch[] = [];
    const executed = new Set<string>();
    const inProgress = new Set<string>();

    // Break circular dependencies by identifying break points
    const breakPoints = this.identifyCircularBreakPoints(graph, circular);

    // Calculate levels for topological ordering
    this.calculateNodeLevels(graph, breakPoints);

    // Group nodes by level for parallel execution
    const levelGroups = new Map<number, GraphNode[]>();
    for (const node of graph.nodes) {
      if (!levelGroups.has(node.level)) {
        levelGroups.set(node.level, []);
      }
      levelGroups.get(node.level)!.push(node);
    }

    // Create batches from level groups
    const sortedLevels = Array.from(levelGroups.keys()).sort((a, b) => a - b);
    for (const level of sortedLevels) {
      const nodes = levelGroups.get(level)!;
      const batch: ExecutionBatch = {
        level,
        operations: nodes.map(n => n.operation),
        nodeIds: nodes.map(n => n.id),
        canParallelize: nodes.length > 1,
        breakPoints: breakPoints.filter(bp => nodes.some(n => n.id === bp.nodeId)),
      };
      batches.push(batch);
    }

    return batches;
  }

  /**
   * Identify where to break circular dependencies
   */
  private identifyCircularBreakPoints(
    graph: DependencyGraph,
    circular: CircularDependency[]
  ): BreakPoint[] {
    const breakPoints: BreakPoint[] = [];

    for (const cycle of circular) {
      // Strategy: Break at the first nullable relationship in the cycle
      for (let i = 0; i < cycle.nodes.length; i++) {
        const fromNodeId = cycle.nodes[i];
        const toNodeId = cycle.nodes[(i + 1) % cycle.nodes.length];
        
        const edge = graph.edges.find(e => e.from === fromNodeId && e.to === toNodeId);
        if (edge) {
          const toNode = graph.nodes.find(n => n.id === toNodeId)!;
          const relationships = this.db.getRelationships(toNode.operation.sobject);
          const rel = relationships.find(r => r.field_name === edge.field);
          
          // If relationship is nullable, we can break here
          if (rel && !rel.is_required) {
            breakPoints.push({
              nodeId: toNodeId,
              field: edge.field,
              strategy: 'create-then-update',
            });
            this.log(`  🔓 Breaking circular dependency at ${toNodeId}.${edge.field}`);
            break;
          }
        }
      }
    }

    return breakPoints;
  }

  /**
   * Calculate execution levels for nodes
   */
  private calculateNodeLevels(graph: DependencyGraph, breakPoints: BreakPoint[]): void {
    const breakNodeIds = new Set(breakPoints.map(bp => bp.nodeId));
    
    // Initialize all nodes to level 0
    for (const node of graph.nodes) {
      node.level = 0;
    }

    // Calculate levels using modified topological sort
    let changed = true;
    while (changed) {
      changed = false;
      for (const node of graph.nodes) {
        for (const depId of node.dependencies) {
          // Skip dependencies that are break points
          if (breakNodeIds.has(node.id)) continue;
          
          const depNode = graph.nodes.find(n => n.id === depId);
          if (depNode && node.level <= depNode.level) {
            node.level = depNode.level + 1;
            changed = true;
          }
        }
      }
    }
  }

  /**
   * Execute the plan in batches
   */
  private async executePlan(batches: ExecutionBatch[]): Promise<{
    success: boolean;
    operations: OperationResult[];
    errors: ExecutionError[];
  }> {
    const results: OperationResult[] = [];
    const errors: ExecutionError[] = [];
    const idMap = new Map<string, string>(); // tempId -> realId

    try {
      for (const batch of batches) {
        this.log(`\n📦 Executing batch at level ${batch.level} (${batch.operations.length} operations)`);

        // Handle break points first (create with null values)
        for (const breakPoint of batch.breakPoints) {
          const op = batch.operations.find(o => o.tempId === breakPoint.nodeId);
          if (op) {
            this.log(`  🔓 Creating ${op.sobject} with null ${breakPoint.field} (will update later)`);
          }
        }

        // Execute operations in batch
        if (batch.canParallelize && batch.operations.length > 1) {
          // Parallel execution
          this.log(`  ⚡ Executing ${batch.operations.length} operations in parallel`);
          const promises = batch.operations.map(op => this.executeOperation(op, idMap));
          const batchResults = await Promise.allSettled(promises);
          
          for (let i = 0; i < batchResults.length; i++) {
            const result = batchResults[i];
            if (result.status === 'fulfilled') {
              results.push(result.value);
              if (batch.operations[i].tempId && result.value.id) {
                idMap.set(batch.operations[i].tempId!, result.value.id);
              }
            } else {
              errors.push({
                message: result.reason,
                phase: 'execution',
                operation: batch.operations[i],
              });
            }
          }
        } else {
          // Sequential execution
          this.log(`  📝 Executing ${batch.operations.length} operations sequentially`);
          for (const op of batch.operations) {
            try {
              const result = await this.executeOperation(op, idMap);
              results.push(result);
              if (op.tempId && result.id) {
                idMap.set(op.tempId, result.id);
              }
            } catch (error) {
              errors.push({
                message: error instanceof Error ? error.message : 'Unknown error',
                phase: 'execution',
                operation: op,
              });
              throw error; // Stop execution on error
            }
          }
        }

        // Update break points (set the null fields)
        for (const breakPoint of batch.breakPoints) {
          const realId = idMap.get(breakPoint.nodeId);
          if (realId) {
            this.log(`  🔄 Updating ${breakPoint.nodeId} with resolved ${breakPoint.field}`);
            // TODO: Execute update operation
          }
        }
      }

      return {
        success: errors.length === 0,
        operations: results,
        errors,
      };

    } catch (error) {
      return {
        success: false,
        operations: results,
        errors: [...errors, {
          message: error instanceof Error ? error.message : 'Unknown error',
          phase: 'execution',
        }],
      };
    }
  }

  /**
   * Execute a single operation with ID resolution
   */
  private async executeOperation(
    operation: RecordOperation,
    idMap: Map<string, string>
  ): Promise<OperationResult> {
    this.log(`    ➤ ${operation.type}: ${operation.sobject} (${operation.tempId || 'no-ref'})`);

    // Resolve temporary IDs to real IDs
    const resolvedData = { ...operation.data };
    for (const [field, value] of Object.entries(resolvedData)) {
      if (typeof value === 'string' && value.startsWith('@')) {
        const realId = idMap.get(value);
        if (realId) {
          resolvedData[field] = realId;
          this.log(`      🔗 Resolved ${field}: ${value} → ${realId}`);
        } else {
          throw new Error(`Cannot resolve reference ${value} in ${field}`);
        }
      }
    }

    // Execute based on operation type
    let result;
    switch (operation.type) {
      case 'create':
        result = await this.service.createRecord(operation.sobject, resolvedData);
        break;
      case 'update':
        if (!operation.recordId) {
          throw new Error('Update operation requires recordId');
        }
        result = await this.service.updateRecord(operation.sobject, operation.recordId, resolvedData);
        break;
      case 'delete':
        if (!operation.recordId) {
          throw new Error('Delete operation requires recordId');
        }
        result = await this.service.deleteRecord(operation.sobject, operation.recordId);
        break;
      default:
        throw new Error(`Unknown operation type: ${operation.type}`);
    }

    this.log(`      ✅ ${result.success ? 'Success' : 'Failed'}: ${result.id || result.errors?.[0]?.message}`);

    return {
      tempId: operation.tempId,
      sobject: operation.sobject,
      type: operation.type,
      success: result.success,
      id: result.id,
      errors: result.errors,
    };
  }
}

/**
 * Record operation definition
 */
export interface RecordOperation {
  type: 'create' | 'update' | 'delete';
  sobject: string;
  data: Record<string, any>;
  tempId?: string; // Temporary ID for referencing (e.g., "@account1")
  recordId?: string; // Real Salesforce ID for update/delete
}

/**
 * Dependency graph structure
 */
export interface DependencyGraph {
  nodes: GraphNode[];
  edges: DependencyEdge[];
}

export interface GraphNode {
  id: string;
  operation: RecordOperation;
  dependencies: string[]; // IDs of nodes this depends on
  dependents: string[]; // IDs of nodes that depend on this
  level: number; // Execution level (0 = no dependencies)
  executed: boolean;
  tempId?: string;
}

export interface DependencyEdge {
  from: string; // Node ID
  to: string; // Node ID
  field: string; // Field name that creates dependency
  type: 'required' | 'optional';
}

/**
 * Circular dependency detection
 */
export interface CircularDependency {
  nodes: string[];
  path: string[];
}

export interface BreakPoint {
  nodeId: string;
  field: string;
  strategy: 'create-then-update' | 'skip';
}

/**
 * Execution plan
 */
export interface ExecutionBatch {
  level: number;
  operations: RecordOperation[];
  nodeIds: string[];
  canParallelize: boolean;
  breakPoints: BreakPoint[];
}

/**
 * Execution results
 */
export interface ExecutionResult {
  success: boolean;
  operations: OperationResult[];
  executionPlan: ExecutionBatch[];
  totalDuration: number;
  errors: ExecutionError[];
}

export interface OperationResult {
  tempId?: string;
  sobject: string;
  type: string;
  success: boolean;
  id?: string;
  errors?: any[];
}

export interface ExecutionError {
  message: string;
  phase: 'analysis' | 'execution';
  operation?: RecordOperation;
}
