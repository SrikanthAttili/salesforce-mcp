# 🕸️ Spider Web Intelligence Architecture

## The Real Flow: Lazy + Iterative + Smart

### Phase 1: Prompt Analysis (Lightweight)
```
User Prompt: "Create 3 accounts with contacts and opportunities"
              ↓
┌─────────────────────────────────────┐
│   Prompt Analyzer (NEW!)            │
│   - Extract object types mentioned  │
│   - Extract operation types         │
│   - Extract relationships implied   │
└─────────────────────────────────────┘
              ↓
Objects detected: [Account, Contact, Opportunity]
Operations: [Create, Create, Create]
Implied relationships: Contact→Account, Opportunity→Account
```

### Phase 2: Metadata Cache Check (Fast)
```
              ↓
┌─────────────────────────────────────┐
│   Metadata Cache Manager (NEW!)    │
│   - Check if objects in cache       │
│   - Check if cache is stale (TTL)   │
│   - Decide what to sync             │
└─────────────────────────────────────┘
              ↓
Cache status:
  Account: ✅ Cached (age: 2 hours)
  Contact: ✅ Cached (age: 2 hours)
  Opportunity: ❌ Missing → Need to sync
```

### Phase 3: Lazy Metadata Sync (On-Demand)
```
              ↓
┌─────────────────────────────────────┐
│   Metadata Sync (ENHANCED)          │
│   - Sync ONLY missing objects       │
│   - Include their relationships     │
│   - Update cache timestamp          │
└─────────────────────────────────────┘
              ↓
Synced: Opportunity (+ relationships to Account, Campaign, etc.)
Cache now: Account ✅, Contact ✅, Opportunity ✅
```

### Phase 4: Dependency Resolution (Graph Analysis)
```
              ↓
┌─────────────────────────────────────┐
│   Dependency Resolver               │
│   - Query metadata-db for relations │
│   - Build dependency graph          │
│   - Calculate execution order       │
│   - Detect circular dependencies    │
└─────────────────────────────────────┘
              ↓
Execution Plan:
  Batch 1: Create Accounts (parallel)
  Batch 2: Create Contacts (parallel, using Account IDs)
  Batch 3: Create Opportunities (parallel, using Account IDs)
```

### Phase 5: Pre-flight Validation (Error Prevention)
```
              ↓
┌─────────────────────────────────────┐
│   Pre-flight Validator              │
│   - Validate each operation         │
│   - Check required fields           │
│   - Verify picklist values          │
│   - Check CRUD permissions          │
└─────────────────────────────────────┘
              ↓
Validation results:
  Account create: ✅ Valid
  Contact create: ❌ Missing LastName
  Opportunity create: ✅ Valid (with warnings)
```

### Phase 6: Execution with Rollback (Safe)
```
              ↓
┌─────────────────────────────────────┐
│   Execution Engine                  │
│   - Execute batch by batch          │
│   - Track created IDs               │
│   - Resolve references (@account_1) │
│   - Rollback on failure             │
└─────────────────────────────────────┘
              ↓
Results:
  3 Accounts created: [001xxx, 001yyy, 001zzz]
  0 Contacts created: Failed validation
  0 Opportunities created: Dependency failed
  Rollback: Delete created accounts
```

## 🔑 Key Components to Build

### 1. Prompt Analyzer (NEW)
```typescript
class PromptAnalyzer {
  extractObjects(prompt: string): string[] {
    // Parse natural language or structured input
    // Return: ['Account', 'Contact', 'Opportunity']
  }
  
  extractOperations(operations: any[]): OperationPlan {
    // Analyze what user wants to do
    // Return: { creates: [...], updates: [...], deletes: [...] }
  }
  
  inferRelationships(operations: any[]): RelationshipHint[] {
    // Detect implicit relationships from data
    // Example: If Contact has "account": "Acme" → Need Account lookup
  }
}
```

### 2. Metadata Cache Manager (NEW)
```typescript
class MetadataCacheManager {
  private TTL = 24 * 60 * 60 * 1000; // 24 hours
  
  async ensureMetadata(objects: string[]): Promise<void> {
    const missing = this.findMissingOrStale(objects);
    
    if (missing.length > 0) {
      await this.syncObjects(missing);
    }
  }
  
  findMissingOrStale(objects: string[]): string[] {
    // Check metadata-db for each object
    // Return objects that are missing or expired
  }
  
  async syncObjects(objects: string[]): Promise<void> {
    // Call MetadataSyncService for ONLY these objects
    // Include their relationships automatically
  }
}
```

### 3. Enhanced Dependency Resolver
```typescript
class DependencyResolver {
  constructor(
    private db: MetadataDatabase,
    private cacheManager: MetadataCacheManager
  ) {}
  
  async resolve(operations: Operation[]): Promise<ExecutionPlan> {
    // Step 1: Ensure we have metadata
    const objects = operations.map(op => op.sobject);
    await this.cacheManager.ensureMetadata(objects);
    
    // Step 2: Build dependency graph using cached metadata
    const graph = this.buildGraph(operations);
    
    // Step 3: Calculate execution order
    const plan = this.topologicalSort(graph);
    
    return plan;
  }
  
  private buildGraph(operations: Operation[]): DependencyGraph {
    // Query metadata-db for relationships
    // Build directed graph
    // Detect circular dependencies
  }
}
```

### 4. Orchestrator (NEW - THE SPIDER BRAIN)
```typescript
class OperationOrchestrator {
  constructor(
    private promptAnalyzer: PromptAnalyzer,
    private cacheManager: MetadataCacheManager,
    private dependencyResolver: DependencyResolver,
    private preflightValidator: PreflightValidator,
    private executionEngine: ExecutionEngine
  ) {}
  
  async execute(userInput: any): Promise<ExecutionResult> {
    // Step 1: Analyze prompt
    const analysis = this.promptAnalyzer.analyze(userInput);
    
    // Step 2: Ensure metadata is cached
    await this.cacheManager.ensureMetadata(analysis.objects);
    
    // Step 3: Resolve dependencies
    const plan = await this.dependencyResolver.resolve(analysis.operations);
    
    // Step 4: Validate all operations
    const validationResults = await this.preflightValidator.validatePlan(plan);
    
    if (!validationResults.allValid) {
      return { success: false, errors: validationResults.errors };
    }
    
    // Step 5: Execute with rollback
    const result = await this.executionEngine.execute(plan);
    
    return result;
  }
}
```

## 🎯 The Answer to Your Questions

### Q: When does Dependency Resolver run?
**A:** AFTER ensuring metadata is cached (lazy sync of only needed objects)

### Q: How much metadata to cache?
**A:** Start minimal, expand as needed:
```
Initial sync: Account, Contact, User, Opportunity (common objects)
On-demand: Any object mentioned in prompt
Relationship expansion: When building dependency graph, auto-sync related objects
```

### Q: Does Dependency Resolver query metadata-db or Salesforce?
**A:** metadata-db ONLY! Here's the flow:
```
Dependency Resolver → Queries metadata-db
                   → If missing → Cache Manager → Sync from Salesforce
                   → Cache Manager → Stores in metadata-db
                   → Dependency Resolver → Now has data in metadata-db
```

### Q: Does it update parent records?
**A:** YES, but intelligently:
```
Scenario: User creates Contact, references "Acme Corp" by name
         ↓
Dependency Resolver detects: Contact needs Account lookup
         ↓
Cache Manager checks: Is Account metadata cached?
         ↓
If yes → Continue
If no → Sync Account metadata first
         ↓
Pre-flight Validator: "Account field expects ID, but got name 'Acme Corp'"
         ↓
Smart Resolution (NEW feature):
  Option 1: Query for Account WHERE Name='Acme Corp'
           → If found: Use that ID
           → If not found: Error OR auto-create (depending on config)
  
  Option 2: Create Account first, then Contact
           → Dependency Resolver already planned this in execution order
```

## 🕷️ The Spider Web in Action

```
Example: "Create account TechCorp with 2 contacts"

1. Prompt Analyzer
   Objects: Account, Contact
   Operations: 1 Account create, 2 Contact creates
   
2. Cache Manager
   Check metadata-db: Account ✅ (cached 1hr ago), Contact ✅
   No sync needed
   
3. Dependency Resolver
   Query metadata-db: Contact has AccountId → Account relationship
   Build graph: Account → Contact1, Contact2
   Execution plan: Batch 1 (Account), Batch 2 (Contacts parallel)
   
4. Pre-flight Validator
   Validate Account: ✅ Name provided
   Validate Contacts: ✅ LastName provided, AccountId will be resolved
   
5. Execution Engine
   Batch 1: Create Account → Get ID (001xxx)
   Batch 2: Create Contact1 (AccountId=001xxx), Contact2 (AccountId=001xxx)
   Success!
```

## 🎨 Visual Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     USER PROMPT                              │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────┐
│                  ORCHESTRATOR                                │
│  (The Spider Brain - Coordinates Everything)                 │
└──┬────────┬──────────┬──────────┬──────────┬────────────────┘
   │        │          │          │          │
   ↓        ↓          ↓          ↓          ↓
┌──────┐ ┌──────┐ ┌──────────┐ ┌──────┐ ┌──────────┐
│Prompt│ │Cache │ │Dependency│ │Pre-  │ │Execution │
│Analyze│ │Mgr  │ │Resolver  │ │flight│ │Engine    │
└──┬───┘ └──┬───┘ └────┬─────┘ └──┬───┘ └────┬─────┘
   │        │          │          │          │
   └────────┴──────────┴──────────┴──────────┘
                       ↓
         ┌─────────────────────────┐
         │   METADATA-DB (SQLite)  │
         │   - Objects             │
         │   - Fields              │
         │   - Relationships       │
         │   - Validation Rules    │
         │   - Cache Timestamps    │
         └─────────────────────────┘
                       ↓
              ┌────────────────┐
              │  SALESFORCE    │
              └────────────────┘
```

## 🚀 Implementation Plan

### Phase 1: Metadata Cache Manager ⭐ CRITICAL
- Add TTL to metadata-db
- Lazy sync only needed objects
- Relationship auto-expansion

### Phase 2: Enhanced Dependency Resolver
- Query metadata-db for relationships
- Ensure metadata before graph building
- Handle missing metadata gracefully

### Phase 3: Orchestrator (Spider Brain)
- Coordinate all components
- Smart decision making
- Error recovery

### Phase 4: Smart Reference Resolution
- Detect name vs ID in relationships
- Auto-query to resolve
- Optional auto-create

---

**This is the REAL spider web!** Does this architecture match your vision? Should we start implementing the **Metadata Cache Manager** first?
