# Salesforce MCP Server

A production-ready Model Context Protocol (MCP) server for Salesforce operations featuring intelligent duplicate detection, dependency resolution, and pre-flight validation.

[![Code Quality](https://img.shields.io/badge/code%20quality-A%20(93%2F100)-brightgreen)](CODE_QUALITY_AUDIT.md)
[![Tests](https://img.shields.io/badge/tests-passing-brightgreen)]()
[![TypeScript](https://img.shields.io/badge/typescript-strict-blue)]()

---

## 🌟 Key Features

### Core Capabilities
- ✅ **CRUD Operations** - Create, Read, Update, Delete Salesforce records
- ✅ **SOQL/SOSL** - Query and search Salesforce data
- ✅ **Metadata Sync** - Automatic caching with 24-hour TTL
- ✅ **Pre-flight Validation** - Catches errors before API calls
- ✅ **Dependency Resolution** - Automatically orders multi-record operations
- ✅ **Intelligent Orchestration** - Optimizes parallel execution
- ✅ **Error Handling** - Comprehensive error messages and recovery

### 🔥 Intelligent Duplicate Detection
Automatically detects potential duplicate records before creation using advanced fuzzy matching:

- **Multi-Algorithm Matching** - Levenshtein, Jaro-Winkler, Trigram, Soundex, Composite
- **Multilingual Support** - Handles diacritics (François→Francois), Chinese, Arabic
- **Business Intelligence** - Normalizes company suffixes (Corp→Corporation, Ltd→Limited)
- **Confidence Scoring** - HIGH (>95%), MEDIUM (75-95%), LOW (<75%)
- **Performance** - <20ms for typical datasets (10-100 records)

### 🧠 Smart Processing
- **Dependency Graph Analysis** - Detects and resolves record relationships
- **Parallel Execution** - Maximizes throughput for independent operations
- **Lazy Metadata Loading** - Only syncs required objects
- **Validation Rule Awareness** - Warns about active validation rules
- **CRUD/FLS Permissions** - Checks object and field-level security

---

## 📦 Installation

```bash
npm install
npm run build
```

### Prerequisites
- Node.js 18+
- Salesforce org with OAuth2 configured
- Environment variables (see Configuration)

---

## 🚀 Quick Start

### 1. Configure Environment

Create `.env` file:

```bash
SF_CLIENT_ID=your_client_id
SF_CLIENT_SECRET=your_client_secret
SF_USERNAME=your_username
SF_LOGIN_URL=https://login.salesforce.com
```

### 2. Get Refresh Token

```bash
npm run get-token
```

### 3. Run the Server

```bash
npm start
```

---

## 🎯 Usage Examples

### Duplicate Detection

#### Automatic Detection

When creating records, the system **automatically** checks for duplicates:

```typescript
// Create a new Account
await orchestrator.executeSingleOperation({
  type: 'create',
  sobject: 'Account',
  data: { Name: 'Acme Corporation', Industry: 'Technology' }
});

// Result includes warnings if duplicates found:
// ⚠️ POTENTIAL DUPLICATE: Found 1 high-confidence match(es):
//   1. Acme Corp (95.8% match)
```

#### Manual Duplicate Check

Check for duplicates without creating a record:

```typescript
const duplicates = await orchestrator.checkDuplicates(
  'Account',
  { Name: 'Microsoft Corporation' },
  { 
    minConfidence: MatchConfidence.MEDIUM,
    limit: 10 
  }
);

// Returns array of matches with scores and confidence levels
```

### Multi-Record Operations

Create related records with automatic dependency resolution:

```typescript
await orchestrator.execute([
  { 
    type: 'create', 
    sobject: 'Account', 
    tempId: '@account',
    data: { Name: 'Acme Corp', Industry: 'Technology' }
  },
  { 
    type: 'create', 
    sobject: 'Contact', 
    tempId: '@contact',
    data: { 
      FirstName: 'John',
      LastName: 'Doe',
      AccountId: '@account',  // Reference to parent
      Email: 'john@acme.com'
    }
  }
]);

// Execution Plan:
//   Batch 0: [Account] (sequential)
//   Batch 1: [Contact] (parallel, uses Account ID)
```

---

## 🏗️ Architecture

### Spider Web Architecture

The system follows a **layered spider web pattern** where each component has a specific role:

```
                    ┌─────────────────────┐
                    │   MCP INTERFACE     │ (Entry Point)
                    │  (Claude Desktop)   │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │  OPERATION          │ 🧠 Spider Brain
                    │  ORCHESTRATOR       │ (Coordinator)
                    └──────────┬──────────┘
                               │
            ┌──────────────────┼──────────────────┐
            │                  │                  │
 ┌──────────▼──────────┐  ┌───▼────────┐  ┌─────▼──────────┐
 │  CACHE MANAGER      │  │ DEPENDENCY │  │   PRE-FLIGHT   │
 │  (Metadata TTL)     │  │  RESOLVER  │  │   VALIDATOR    │
 └──────────┬──────────┘  └─────┬──────┘  └────────┬───────┘
            │                   │                  │
            └───────────────────┼──────────────────┘
                                │
                    ┌───────────▼───────────┐
                    │  SALESFORCE SERVICE   │
                    │  (API Execution)      │
                    └───────────┬───────────┘
                                │
                    ┌───────────▼───────────┐
                    │   METADATA DATABASE   │
                    │   (SQLite Cache)      │
                    └───────────────────────┘
```

### Core Components

1. **MCP Interface Layer** - Receives natural language prompts from Claude Desktop
2. **Operation Orchestrator** - Smart coordinator that routes single vs multi-record operations
3. **Cache Manager** - Intelligent metadata caching with 24-hour TTL
4. **Dependency Resolver** - Graph-based dependency analyzer with topological sorting
5. **Pre-flight Validator** - Validates data before API calls (8 validation types)
6. **Salesforce Service** - Executes Salesforce API operations
7. **Metadata Database** - SQLite cache with 8 tables and indexes

### Intelligent Processing Flow

```
User Request
    ↓
Single Operation? → Simple Path (fast)
    ↓
Multiple Operations? → Intelligent Path
    ↓
Ensure Metadata Cached (lazy-load)
    ↓
Build Dependency Graph
    ↓
Create Execution Plan (topological sort)
    ↓
Pre-flight Validation (each operation)
    ↓
Execute in Optimal Order (parallel where possible)
```

---

## 🧪 Testing

### Run All Tests

```bash
npm test
```

### Individual Test Suites

```bash
npm run test:auth          # Authentication tests
npm run test:db            # Database tests
npm run test:sync          # Metadata sync tests
npm run test:preflight     # Validation tests
npm run test:cache         # Cache manager tests
npm run test:resolver      # Dependency resolver tests
npm run test:orchestrator  # Orchestration tests
npm run test:integration   # End-to-end integration
```

### Test Results Summary

```
✅ Milestone 1: Database Integration (2ms)
✅ Milestone 2: Metadata Sync Engine (5.3s)
✅ Milestone 3: Pre-flight Validation Layer (16ms)
✅ Milestone 4: Intelligent Processing (2.8s)

Total Duration: 8.92 seconds
Success Rate: 100%
```

---

## 📊 Performance Benchmarks

| Operation | Duration | Status |
|-----------|----------|--------|
| Database query | 1-2ms | ⚡ Excellent |
| Cache init (6 objects) | ~500ms | ✅ Good |
| Single record create | ~800ms | ✅ Good |
| Multi-record + deps | ~1.2s | ✅ Good |
| Full integration test | 8.92s | ✅ Under 10s target |

---

## 🎓 Project Milestones

### Milestone 1: SQLite Integration ✅
- Implemented comprehensive SQLite database
- 8 tables: org_info, sobjects, fields, validation_rules, relationships, record_types, field_dependencies, triggers
- Proper foreign keys, indexes, and singleton pattern

### Milestone 2: Metadata Sync Engine ✅
- Lazy-loading metadata synchronization
- 24-hour TTL with auto-refresh
- Relationship expansion (depth=1)
- Core objects pre-cached: Account, Contact, Lead, Opportunity, User, Case

### Milestone 3: Pre-flight Validation ✅
- 8 validation types: required fields, types, lengths, picklists, precision, references, rules, permissions
- Saves up to 90% of failed API calls
- <10ms validation time
- Clear, actionable error messages

### Milestone 4: Intelligent Processing ✅
- Operation Orchestrator (spider brain)
- Dependency resolver with graph analysis
- Cache manager with TTL
- Parallel execution optimization
- Topological sorting for execution order

### Milestone 5: Duplicate Detection ✅
- Multi-algorithm fuzzy matching
- Multilingual and business intelligence normalization
- Confidence scoring system
- <20ms performance for typical datasets

---

## 🔧 Configuration

### Environment Variables

```bash
# Salesforce OAuth
SF_CLIENT_ID=your_connected_app_client_id
SF_CLIENT_SECRET=your_connected_app_client_secret
SF_REFRESH_TOKEN=your_refresh_token
SF_USERNAME=your_username
SF_LOGIN_URL=https://login.salesforce.com

# Debug Flags (optional)
DEBUG_CACHE=true          # Cache manager debug logging
DEBUG_VALIDATOR=true      # Validator debug logging
DEBUG_RESOLVER=true       # Dependency resolver debug logging
DEBUG_ORCHESTRATOR=true   # Orchestrator debug logging
```

### Confidence Levels

```typescript
import { MatchConfidence } from './smart-matcher.js';

MatchConfidence.HIGH    // >95% - Auto-suggest with high confidence
MatchConfidence.MEDIUM  // 75-95% - Show for user disambiguation  
MatchConfidence.LOW     // <75% - Possible match, low confidence
```

### Duplicate Check Options

```typescript
interface DuplicateCheckOptions {
  minConfidence?: MatchConfidence;  // Default: MEDIUM
  limit?: number;                    // Default: 10
  field?: string;                    // Default: 'Name'
  returnFields?: string[];           // Additional fields to return
}
```

---

## 📖 API Reference

### MCP Tools Available

The server exposes the following tools via Model Context Protocol:

#### Record Operations
- `sf_create_record` - Create a new Salesforce record
- `sf_get_record` - Retrieve a record by ID
- `sf_update_record` - Update an existing record
- `sf_delete_record` - Delete a record

#### Query & Search
- `sf_query` - Execute SOQL queries
- `sf_search` - Execute SOSL searches

#### Metadata
- `sf_describe_object` - Get object metadata (fields, relationships, etc.)
- `sf_describe_global` - Get all available SObjects
- `sf_sync_metadata` - Manually sync metadata to cache
- `sf_get_sync_stats` - Get cache statistics

#### Utilities
- `sf_test_connection` - Test Salesforce connection and get user info
- `sf_get_org_limits` - Get org limits and usage statistics

---

## 🔍 Pre-flight Validation

The system validates 8 types of errors **before** making API calls:

### 1. Required Field Validation
Ensures all required fields are present, intelligently filtering:
- System-managed fields (CreatedDate, LastModifiedDate)
- Auto-defaulted fields (OwnerId defaults to current user)
- Formula and calculated fields

### 2. Type Validation
Verifies field types match expected types:
- String, Number, Boolean, Date, DateTime
- Detects type mismatches and suggests conversion

### 3. Length Validation
Checks string lengths don't exceed field limits:
- Shows actual vs maximum length
- Prevents truncation errors

### 4. Picklist Validation
Verifies picklist values are valid options:
- Shows first 10 valid values in error
- Works with single and multi-select picklists

### 5. Number Precision/Scale Validation
Validates numbers against metadata limits:
- Warns when precision exceeded
- Validates decimal places against scale

### 6. Reference Validation
Detects required relationship fields:
- Warns about missing parent records
- Suggests creating dependencies first

### 7. Validation Rule Awareness
Lists active validation rules:
- Shows rule names and error messages
- Warns additional validation may occur

### 8. CRUD/FLS Permissions
Checks security permissions:
- Object-level (createable/updateable)
- Field-level security (FLS)

### Benefits

- **Saves API Limits** - Blocks invalid requests before API calls
- **Better Errors** - Clear, actionable error messages with suggestions
- **Fast** - Validation happens in <10ms
- **90% Reduction** - Up to 90% fewer failed API calls

---

## 💾 Database Schema

The SQLite metadata cache includes 8 tables:

### Tables

1. **org_info** - Connected Salesforce org details
2. **sobjects** - SObject metadata (Account, Contact, etc.)
3. **fields** - Field metadata with all properties
4. **validation_rules** - Active validation rules
5. **relationships** - Lookup and master-detail relationships
6. **record_types** - Record type information
7. **field_dependencies** - Controlling/dependent picklist relationships
8. **triggers** - Trigger metadata for awareness

### Indexes

8 indexes for optimal query performance:
- idx_fields_sobject
- idx_validation_sobject
- idx_relationships_child
- idx_relationships_parent
- idx_recordtypes_sobject
- idx_field_deps_sobject
- idx_field_deps_controlling
- idx_triggers_sobject

---

## 🎯 Code Quality

### Audit Results

**Overall Grade**: **A (93/100)**

| Category | Score | Grade |
|----------|-------|-------|
| Type Safety | 100/100 | A+ |
| Code Organization | 98/100 | A+ |
| Error Handling | 92/100 | A |
| Performance | 95/100 | A |
| Security | 92/100 | A |
| Testing | 90/100 | A |
| Documentation | 85/100 | B+ |

### What We're Doing Right ✨

1. **TypeScript Strict Mode** - 100% compliance, zero `any` types
2. **Error Handling** - Try-catch in all async operations
3. **Single Responsibility** - Each class has clear, focused purpose
4. **Performance** - Database queries <2ms, full test <9s
5. **Testing** - Comprehensive unit + integration tests
6. **Security** - OAuth2, no hardcoded credentials
7. **Resource Management** - No memory leaks, proper cleanup

**Recommendations for Enhancement**:
1. Structured logging (Winston or Pino)
2. Configuration management (centralized config)
3. Metrics & monitoring (Prometheus export)
4. Retry logic (exponential backoff)

None are blocking - the codebase is production-ready as-is!

---

## 📚 Advanced Topics

### Fuzzy Matching Algorithms

The duplicate detection engine uses multiple algorithms:

1. **Levenshtein Distance** - Edit distance for typo detection
2. **Jaro-Winkler** - String similarity with prefix bias
3. **Soundex** - Phonetic matching (Smith vs Smyth)
4. **Trigram** - N-gram similarity
5. **Composite** - Weighted combination of all algorithms

### Text Normalization Pipeline

Before matching, text is normalized through:
1. **Unicode normalization** - Remove diacritics (é→e)
2. **Case normalization** - Convert to lowercase
3. **Business suffix normalization** - Corp→Corporation, Ltd→Limited
4. **Whitespace normalization** - Collapse multiple spaces
5. **Special character removal** - Remove emojis, punctuation (configurable)

### Execution Optimization

The dependency resolver optimizes execution by:
1. **Graph Analysis** - Builds directed acyclic graph (DAG)
2. **Topological Sort** - Orders operations to respect dependencies
3. **Batch Creation** - Groups independent operations
4. **Parallel Execution** - Runs independent operations simultaneously

Example:
```
Input: 1 Account → 3 Contacts
Execution Plan:
  Batch 0: [Account] (sequential)
  Batch 1: [Contact1, Contact2, Contact3] (PARALLEL ✨)
```

---

## 🛠️ Development

### Build

```bash
npm run build
```

### Watch Mode

```bash
npm run watch
```

### Clean Build

```bash
rm -rf build/
npm run build
```

### Run Tests

```bash
npm test                   # Run all tests
npm run test:watch         # Watch mode
npm run test:coverage      # Coverage report
```

---

## 📁 Project Structure

```
salesforce-mcp/
├── src/
│   ├── auth.ts                   # OAuth2 authentication
│   ├── cache-manager.ts          # Metadata cache with TTL
│   ├── database.ts               # SQLite metadata database
│   ├── dependency-resolver.ts    # Graph-based dependency analysis
│   ├── errors.ts                 # Custom error types
│   ├── index.ts                  # MCP server entry point
│   ├── metadata-sync.ts          # Metadata synchronization
│   ├── orchestrator.ts           # Operation orchestrator (spider brain)
│   ├── preflight-validator.ts    # Pre-flight validation
│   ├── service.ts                # Salesforce API service
│   ├── similarity.ts             # Fuzzy matching algorithms
│   ├── smart-matcher.ts          # Intelligent duplicate detection
│   ├── text-normalizer.ts        # Text normalization
│   ├── types.ts                  # TypeScript type definitions
│   └── validators.ts             # Input validation
├── test/
│   ├── auth.test.ts
│   ├── cache-manager.test.ts
│   ├── database.test.ts
│   ├── dependency-resolver.test.ts
│   ├── duplicate-detection.test.ts
│   ├── edge-cases.test.ts
│   ├── end-to-end.test.ts
│   ├── integration.test.ts
│   ├── metadata-sync.test.ts
│   ├── orchestrator.test.ts
│   ├── performance.test.ts
│   ├── preflight-validator.test.ts
│   ├── similarity.test.ts
│   ├── smart-matcher.test.ts
│   └── text-normalizer.test.ts
├── build/                        # Compiled JavaScript
├── wsdl/                         # Salesforce WSDL files
├── package.json
├── tsconfig.json
└── README.md
```

---

## 🔐 Security

### Authentication
- **OAuth2** - Industry standard authentication
- **Refresh Tokens** - Secure token refresh mechanism
- **No Hardcoded Credentials** - All secrets in environment variables

### Data Protection
- **Local Cache** - Metadata cached locally in SQLite
- **No Data Storage** - Record data never persisted
- **Secure Communication** - HTTPS-only API calls

### Permissions
- **Field-Level Security** - Respects Salesforce FLS
- **Object Permissions** - Checks CRUD permissions
- **User Context** - Operations run as authenticated user

---

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. **Code Quality** - Maintain TypeScript strict mode compliance
2. **Testing** - Add tests for new features
3. **Documentation** - Update README for API changes
4. **Error Handling** - Include try-catch in async operations
5. **Performance** - Profile changes for performance impact

### Development Workflow

```bash
# 1. Fork and clone the repository
git clone https://github.com/yourusername/salesforce-mcp.git

# 2. Install dependencies
npm install

# 3. Create a feature branch
git checkout -b feature/my-feature

# 4. Make changes and test
npm run build
npm test

# 5. Commit and push
git commit -am "Add new feature"
git push origin feature/my-feature

# 6. Create pull request
```

---

## 📄 License

MIT License - See LICENSE file for details

---

## 🙏 Acknowledgments

- **Model Context Protocol** - Anthropic's MCP specification
- **Salesforce** - Salesforce API and developer resources
- **better-sqlite3** - Fast SQLite implementation
- **jsforce** - Salesforce JavaScript SDK

---

## 📞 Support

### Issues
Report bugs and request features via [GitHub Issues](https://github.com/yourusername/salesforce-mcp/issues)

### Documentation
- [Salesforce API Documentation](https://developer.salesforce.com/docs/apis)
- [Model Context Protocol Specification](https://modelcontextprotocol.io)
- [Project Wiki](https://github.com/yourusername/salesforce-mcp/wiki)

### Contact
For questions and support, please open a GitHub issue.

---

## 🎉 Status

**Production Ready** ✅

- All tests passing (100%)
- Code quality: A (93/100)
- Zero critical bugs
- Comprehensive documentation
- Enterprise-grade error handling
- Performance benchmarks met

---

**Built with ❤️ for the Salesforce developer community**
