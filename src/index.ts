#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { SalesforceAuth } from './auth.js';
import { SalesforceService } from './service.js';
import { ValidationError, SalesforceError } from './errors.js';
import { getDatabase } from './database.js';
import { MetadataSyncService } from './metadata-sync.js';

const auth = new SalesforceAuth();

// Define available tools
const TOOLS: Tool[] = [
  {
    name: 'sf_query',
    description: 'Execute a SOQL query against Salesforce. Returns records matching the query.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'SOQL query string (e.g., "SELECT Id, Name FROM Account LIMIT 10")',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'sf_get_record',
    description: 'Retrieve a single Salesforce record by ID',
    inputSchema: {
      type: 'object',
      properties: {
        sobject: {
          type: 'string',
          description: 'SObject type (e.g., "Account", "Contact", "Opportunity")',
        },
        id: {
          type: 'string',
          description: 'Record ID (18-character Salesforce ID)',
        },
        fields: {
          type: 'string',
          description: 'Comma-separated field names to retrieve (optional, defaults to all)',
        },
      },
      required: ['sobject', 'id'],
    },
  },
  {
    name: 'sf_create_record',
    description: 'Create a new Salesforce record',
    inputSchema: {
      type: 'object',
      properties: {
        sobject: {
          type: 'string',
          description: 'SObject type (e.g., "Account", "Contact")',
        },
        data: {
          type: 'object',
          description: 'Field values as key-value pairs (e.g., {"Name": "Acme Corp", "Industry": "Technology"})',
        },
      },
      required: ['sobject', 'data'],
    },
  },
  {
    name: 'sf_update_record',
    description: 'Update an existing Salesforce record',
    inputSchema: {
      type: 'object',
      properties: {
        sobject: {
          type: 'string',
          description: 'SObject type (e.g., "Account", "Contact")',
        },
        id: {
          type: 'string',
          description: 'Record ID to update',
        },
        data: {
          type: 'object',
          description: 'Field values to update as key-value pairs',
        },
      },
      required: ['sobject', 'id', 'data'],
    },
  },
  {
    name: 'sf_delete_record',
    description: 'Delete a Salesforce record',
    inputSchema: {
      type: 'object',
      properties: {
        sobject: {
          type: 'string',
          description: 'SObject type (e.g., "Account", "Contact")',
        },
        id: {
          type: 'string',
          description: 'Record ID to delete',
        },
      },
      required: ['sobject', 'id'],
    },
  },
  {
    name: 'sf_describe_object',
    description: 'Get metadata information about a Salesforce object (fields, relationships, etc.)',
    inputSchema: {
      type: 'object',
      properties: {
        sobject: {
          type: 'string',
          description: 'SObject type to describe (e.g., "Account", "Contact")',
        },
      },
      required: ['sobject'],
    },
  },
  {
    name: 'sf_describe_global',
    description: 'Get metadata for all available SObjects in the org',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'sf_search',
    description: 'Execute a SOSL (Salesforce Object Search Language) search',
    inputSchema: {
      type: 'object',
      properties: {
        searchString: {
          type: 'string',
          description: 'SOSL search string (e.g., "FIND {Acme} IN ALL FIELDS RETURNING Account(Id, Name), Contact(Id, Name)")',
        },
      },
      required: ['searchString'],
    },
  },
  {
    name: 'sf_get_org_limits',
    description: 'Get current org limits and usage statistics',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'sf_test_connection',
    description: 'Test the Salesforce connection and get current user info',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'sf_sync_metadata',
    description: 'Sync Salesforce metadata to local database for intelligent pre-flight validation. Fetches objects, fields, validation rules, and relationships.',
    inputSchema: {
      type: 'object',
      properties: {
        objects: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional: Specific object names to sync (e.g., ["Account", "Contact"]). If omitted, syncs common standard objects.',
        },
      },
    },
  },
  {
    name: 'sf_get_sync_stats',
    description: 'Get metadata sync statistics and database information',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

// Create server instance
const server = new Server(
  {
    name: 'salesforce-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (!args) {
      throw new ValidationError('Missing arguments');
    }

    const conn = await auth.getConnection();
    const db = getDatabase();
    const service = new SalesforceService(conn, db);

    switch (name) {
      case 'sf_query': {
        const result = await service.query(args.query as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'sf_get_record': {
        const result = await service.getRecord(
          args.sobject as string,
          args.id as string
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'sf_create_record': {
        const result = await service.createRecord(
          args.sobject as string,
          args.data as Record<string, any>
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'sf_update_record': {
        const result = await service.updateRecord(
          args.sobject as string,
          args.id as string,
          args.data as Record<string, any>
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'sf_delete_record': {
        const result = await service.deleteRecord(
          args.sobject as string,
          args.id as string
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'sf_describe_object': {
        const result = await service.describeObject(args.sobject as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'sf_describe_global': {
        const result = await service.describeGlobal();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'sf_search': {
        const result = await service.search(args.searchString as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'sf_get_org_limits': {
        const result = await service.getOrgLimits();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'sf_test_connection': {
        const result = await auth.testConnection();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'sf_sync_metadata': {
        const db = getDatabase();
        const syncService = new MetadataSyncService(conn, db);
        const objects = args.objects as string[] | undefined;
        const result = await syncService.syncAll({ objects });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'sf_get_sync_stats': {
        const db = getDatabase();
        const stats = db.getStats();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(stats, null, 2),
            },
          ],
        };
      }

      default:
        throw new ValidationError(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const isValidationError = error instanceof ValidationError;
    const isSalesforceError = error instanceof SalesforceError;
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorResponse = isSalesforceError 
      ? (error as SalesforceError).toJSON()
      : { error: errorMessage };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(errorResponse, null, 2),
        },
      ],
      isError: true,
    };
  }
});

// Graceful shutdown handler
function cleanup() {
  try {
    const db = getDatabase();
    db.close();
    console.error('Database connection closed');
  } catch (error) {
    // Database may not be initialized
  }
  process.exit(0);
}

// Register cleanup handlers
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
