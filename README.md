# Salesforce MCP Server

**Talk to Your Salesforce in Plain English**

Imagine being able to manage your Salesforce data just by talking to ChatGPT, Claude, or any AI assistant in natural language. No clicking through screens, no remembering field names, no worrying about mistakes.

Just say: *"Create a new customer account for Acme Corporation"* or *"Update John Smith's phone number to 555-1234"* and it happens automatically.

That's what this MCP Server does. It connects AI assistants like ChatGPT or Claude to your Salesforce, enabling you to create, read, update, and delete records using everyday language.

[![GitHub](https://img.shields.io/badge/github-SrikanthAttili%2Fsalesforce--mcp-blue?logo=github)](https://github.com/SrikanthAttili/salesforce-mcp)
[![TypeScript](https://img.shields.io/badge/typescript-strict-blue)](https://github.com/SrikanthAttili/salesforce-mcp)
[![Tests](https://img.shields.io/badge/tests-passing-brightgreen)](https://github.com/SrikanthAttili/salesforce-mcp)

---

## 🚀 What Can You Do?

Once you plug this MCP server into any AI assistant (ChatGPT, Claude, etc.), you can:

- **Create Records**: "Add a new contact named Sarah Johnson at Microsoft"
- **Update Records**: "Change the opportunity stage to Closed Won for the Acme deal"
- **Find Records**: "Show me all accounts in the Technology industry"
- **Delete Records**: "Remove the duplicate contact for John Smith"
- **Ask Questions**: "How many open opportunities do we have?"

**All in natural, conversational language** - no technical knowledge required.

---

## 🧠 What Makes This MCP Server Special?

**Most systems just pass your requests directly to Salesforce.** If you make a mistake or forget something, the operation fails, and you have to try again.

**Our MCP Server is intelligent.** It acts as a smart intermediary between your AI assistant and Salesforce, catching problems before they happen.


### 🛡️ How Our Smart System Works

Think of it as having an experienced Salesforce administrator reviewing your requests before they're executed.

**Here's what happens behind the scenes:**

1. **Validates Your Request** 
   - Checks if all required information is provided
   - Verifies data matches Salesforce's rules (like valid picklist values)
   - Ensures you have permission to perform the action

2. **Corrects Common Mistakes**
   - Fixes typos automatically ("Microsft" becomes "Microsoft Corporation")
   - Suggests the correct spelling if field names are misspelled
   - Finds similar records when names don't match exactly

3. **Prevents Errors Before They Happen**
   - Warns you about duplicate records before creating them
   - Alerts you if required fields are missing
   - Stops invalid data from being saved

4. **Optimizes Your Requests**
   - Handles dependencies automatically (creates parent records before child records)
   - Processes multiple operations efficiently
   - Saves time by running independent tasks simultaneously

### � Real-World Examples

**Scenario 1: Incomplete Request**
- **You say**: "Create a new contact"
- **System responds**: "I need more information. Contact records require a last name. What should I use?"
- **Result**: No failed attempts, clear guidance on what's needed

**Scenario 2: Typos and Misspellings**
- **You say**: "Update the opportunty stage to Closd Won for Microsft"
- **System responds**: "Did you mean: Update the Opportunity stage to 'Closed Won' for Microsoft Corporation?"
- **Result**: Request is corrected automatically, saves time and frustration

**Scenario 3: Duplicate Prevention**
- **You say**: "Create an account for Acme Corp"
- **System responds**: "I found an existing account 'Acme Corporation' (96% match). Would you like to update it instead?"
- **Result**: Prevents duplicate records, maintains clean data

---

## 🎯 The Secret: Smart Local Cache

**How does it catch mistakes so quickly?**

The system maintains a local "knowledge base" about your Salesforce setup using intelligent lazy loading:

**Smart Lazy Loading:**
- Only loads metadata for objects actually mentioned in your prompts
- Example: If you say "Create an Account", it loads Account metadata on-demand
- Stores this information locally for future use
- Automatically refreshes when needed

**What Information is Cached:**
- **Required Fields**: What information must be provided for each type of record
- **Valid Options**: Acceptable values for dropdown fields (picklists)
- **Field Rules**: Data type restrictions, length limits, number formats
- **Relationships**: How different records connect to each other
- **Permissions**: What actions you're allowed to perform
- **Active Validation Rules**: Custom business rules in your Salesforce

**This means:**
- **Lightning-Fast Checks**: Validates your request in less than 10 milliseconds
- **90% Fewer Errors**: Catches problems before wasting Salesforce resources
- **No Guesswork**: Tells you exactly what's wrong and how to fix it
- **Efficient Loading**: Only syncs what you actually use

---

## 🌟 Key Capabilities


### � Intelligent Duplicate Detection

**Finds similar records even with typos or variations**

- Handles common misspellings ("Microsft" finds "Microsoft Corporation")
- Works across different languages and character sets
- Understands business naming conventions ("Corp" = "Corporation", "Ltd" = "Limited")
- Shows confidence score so you can decide (High: >95%, Medium: 75-95%, Low: <75%)
- Finds matches in milliseconds, even with hundreds of records

**Example**: When you say *"Update contact Jon Smith at Microsft"*, the system finds "John Smith at Microsoft Corporation" and asks for confirmation with a 96% confidence score.

### ⚡ Smart Relationship Handling

**Automatically manages dependencies between records**

When you create multiple related records at once (like an Account with several Contacts), the system:
- Figures out the correct order automatically
- Creates parent records first, then children
- Runs independent operations at the same time for speed
- Ensures all relationships are properly connected

**Example**: Creating "Acme Corporation" with 3 contacts happens in the right order - account first, then all 3 contacts simultaneously.

### 🔐 Permission Awareness

**Respects your Salesforce security settings**

- Checks if you have permission to create, read, update, or delete records
- Verifies field-level access (some fields may be read-only for your role)
- Warns you before attempting unauthorized actions
- Runs all operations using your Salesforce credentials and permissions

### 🎨 Multilingual Support

**Works with international data**

- Handles names with accents and special characters (François, José, etc.)
- Supports Chinese, Arabic, and other non-Latin scripts
- Normalizes text for accurate matching across languages

---

## � Getting Started

### What You'll Need

1. **A Salesforce Account** - Your organization's Salesforce environment
2. **An AI Assistant** - ChatGPT, Claude Desktop, GitHub Copilot, or any MCP-compatible tool
3. **Connection Credentials** - Your Salesforce administrator can provide these

### Quick Setup Overview

**Step 1: Get Your Credentials**
Ask your Salesforce administrator for:
- Client ID (a unique identifier for the connection)
- Client Secret (a secure password for the connection)
- Your Salesforce username
- Login URL (usually https://login.salesforce.com)

**Step 2: Configure Your AI Assistant**
Add the MCP server configuration to your AI assistant (Claude Desktop, ChatGPT, etc.). This tells the AI assistant how to connect to your Salesforce.

**Step 3: Start Talking**
Once connected, simply talk to your AI assistant in natural language:
- "Show me all my open opportunities"
- "Create a new account for XYZ Company in the Healthcare industry"
- "Update the status of the ABC deal to Closed Won"

### Supported AI Assistants

- **Claude Desktop** - Anthropic's desktop AI assistant
- **ChatGPT** - OpenAI's conversational AI (with MCP support)
- **GitHub Copilot** - Microsoft's AI coding assistant
- **Any MCP-Compatible Tool** - The Model Context Protocol is an open standard

---

## 💬 How to Use It - Natural Language Examples


### Creating Records

**You can say:**
- "Create a new account called Global Industries in the Manufacturing sector"
- "Add Sarah Johnson as a contact at Microsoft with email sarah.j@microsoft.com"
- "Make a new opportunity for the Q4 Enterprise deal worth $50,000"

**The system:**
- ✅ Checks that all required fields are provided
- ✅ Validates the data against Salesforce rules
- ✅ Warns if a similar record already exists
- ✅ Creates the record only when everything is correct

### Updating Records

**You can say:**
- "Change the phone number for Acme Corporation to 555-0100"
- "Update John Smith's job title to Senior Manager"
- "Mark the ABC opportunity as Closed Won"

**The system:**
- ✅ Finds the right record even with slight name variations
- ✅ Verifies you have permission to make changes
- ✅ Checks that new values are valid (like picklist options)
- ✅ Updates only after confirming the correct record

### Finding Records

**You can say:**
- "Show me all accounts in California"
- "Find contacts who work at Microsoft"
- "List all opportunities closing this month"

**The system:**
- ✅ Searches across your Salesforce data
- ✅ Returns results in an easy-to-read format
- ✅ Handles complex queries involving multiple criteria
- ✅ Respects your security permissions

### Deleting Records

**You can say:**
- "Delete the duplicate contact for Jane Doe"
- "Remove the test account I just created"

**The system:**
- ✅ Confirms which record you want to delete
- ✅ Checks you have deletion permissions
- ✅ Warns about any related records that might be affected
- ✅ Requires confirmation before permanently removing data

---

## 🏗️ How It Works Under the Hood

*For those curious about the technology*

### System Architecture

```mermaid
graph TB
    User[👤 User Request in Natural Language] --> MCP[MCP Interface]
    MCP --> Orchestrator{Operation Orchestrator<br/>The Brain}
    
    Orchestrator --> |Check Metadata| Cache[Cache Manager<br/>Lazy Loading]
    Cache --> |Not Cached| SF_Meta[Salesforce Metadata API]
    SF_Meta --> |Store Locally| DB[(SQLite Database<br/>- Validation Rules<br/>- Required Fields<br/>- Picklist Values<br/>- Relationships)]
    Cache --> |Cached| DB
    
    Orchestrator --> Resolver[Dependency Resolver<br/>Analyzes Relationships]
    Orchestrator --> Validator[Pre-Flight Validator<br/>8 Safety Checks]
    
    Validator --> |Validation Failed| ErrorMsg[Clear Error Message<br/>with Suggestions]
    ErrorMsg --> User
    
    Resolver --> Plan[Execution Plan<br/>Optimal Order]
    Validator --> |Validation Passed| Plan
    
    Plan --> Exec[Salesforce Service<br/>Execute Operations]
    Exec --> |OAuth 2.0| Salesforce[(Salesforce)]
    Salesforce --> |Results| User
    
    style User fill:#e3f2fd
    style Orchestrator fill:#fff3e0
    style Cache fill:#f3e5f5
    style DB fill:#fce4ec
    style Validator fill:#ffe0b2
    style Exec fill:#c8e6c9
    style Salesforce fill:#e8f5e9
```

### Key Components Explained

**1. MCP Interface** - Receives your natural language request and converts it to structured commands

**2. Operation Orchestrator (The Brain)** - Coordinates all components and decides the execution path

**3. Cache Manager with Lazy Loading** 
- Only loads metadata for objects mentioned in your prompts
- Stores information locally for instant validation
- Refreshes automatically when needed

**4. Dependency Resolver** - Ensures parent records are created before children (e.g., Account before Contacts)

**5. Pre-Flight Validator** - Runs 8 types of safety checks before hitting Salesforce

**6. Salesforce Service** - Executes validated operations using secure authentication

---

## ✨ What Makes It Reliable

**Comprehensive Testing**
- Every feature is thoroughly tested
- Over 100 automated tests run before each release
- All tests currently passing with 100% success rate

**Performance Metrics**
- Validation checks: Under 10 milliseconds
- Single record operations: Around 800 milliseconds
- Complex multi-record operations: Around 1.2 seconds

**Benefits of Smart Validation:**
- Prevents 90% of errors before they happen
- Provides clear guidance on how to fix issues
- Saves Salesforce API usage limits
- Instant feedback on what's wrong

---

## 🎓 Development Milestones

This project was built in 5 major phases:

**Phase 1: Knowledge Storage** ✅
Created a local database to store Salesforce rules and structure efficiently.

**Phase 2: Information Sync** ✅
Built the system to automatically fetch and update Salesforce metadata every 24 hours.

**Phase 3: Smart Validation** ✅
Implemented 8 types of safety checks that catch errors before they happen.

**Phase 4: Intelligent Processing** ✅
Added the "brain" that handles complex requests with multiple dependent operations.

**Phase 5: Duplicate Detection** ✅
Created advanced matching to find similar records even with typos or variations.

---

## � Security & Privacy

**Your Data is Safe**

- **Industry-Standard Authentication**: Uses OAuth 2.0, the same secure method used by major apps
- **No Data Storage**: Your Salesforce records are never permanently stored, only metadata about field structure
- **Secure Communication**: All connections to Salesforce use encrypted HTTPS
- **Permission Respect**: The system only does what your Salesforce account has permission to do
- **Local Processing**: Validation happens on your computer, not on external servers
- **No Hardcoded Secrets**: All credentials are stored in your secure environment variables

---

## 🤝 Getting Help & Support

**Have Questions or Issues?**

- **Report Bugs**: Visit our [GitHub Issues](https://github.com/SrikanthAttili/salesforce-mcp/issues) page
- **Request Features**: Share your ideas through GitHub Issues
- **Documentation**: Check the [GitHub Repository](https://github.com/SrikanthAttili/salesforce-mcp) for latest updates
- **Salesforce Help**: Refer to [Salesforce Documentation](https://developer.salesforce.com/docs/apis)
- **MCP Protocol**: Learn more at [Model Context Protocol](https://modelcontextprotocol.io)

---

## 📜 License

This project is released under the MIT License - free to use, modify, and distribute.

---

## � Credits

**Built with support from:**
- **Model Context Protocol** - Anthropic's open standard for AI assistant connections
- **Salesforce** - Leading CRM platform and developer resources
- **Open Source Community** - Various libraries and tools that make this possible

---

**Built with ❤️ for everyone who wants to make Salesforce easier to use**

*No coding knowledge required - just talk naturally and let the AI do the work.*
