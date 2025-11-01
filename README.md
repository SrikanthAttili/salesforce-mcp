# Salesforce MCP Server

A production-ready Model Context Protocol (MCP) server for Salesforce operations featuring intelligent duplicate detection, dependency resolution, and pre-flight validation.

[![Code Quality](https://img.shields.io/badge/code%20quality-A%20(93%2F100)-brightgreen)](CODE_QUALITY_AUDIT.md)
[![Tests](https://img.shields.io/badge/tests-passing-brightgreen)]()
[![TypeScript](https://img.shields.io/badge/typescript-strict-blue)]()

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

## 📦 Installation

```bash
npm install
npm run build
```

### Prerequisites
- Node.js 18+
- Salesforce org with OAuth2 configured
- Environment variables (see Configuration)

## 🚀 Quick Start

### 1. Configure Environment

Create `.env` file from `.env.example`:

```bash
SF_LOGIN_URL=https://login.salesforce.com
SF_CLIENT_ID=your_client_id
SF_CLIENT_SECRET=your_client_secret
SF_API_VERSION=65.0
```

### 2. Build the Project

```bash
npm install
npm run build
```

### 3. Run the Server

```bash
node build/index.js
```

## 📄 License

MIT License - See LICENSE file for details

## 🙏 Acknowledgments

- **Model Context Protocol** - Anthropic's MCP specification
- **Salesforce** - Salesforce API and developer resources
- **better-sqlite3** - Fast SQLite implementation
- **jsforce** - Salesforce JavaScript SDK

---

**Built with ❤️ for the Salesforce and AI communities**
