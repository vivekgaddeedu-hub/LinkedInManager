import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  CallToolResult,
} from '@modelcontextprotocol/sdk/types.js';
import { getAllToolDefinitions, executeTool } from '../tools/index.js';
import { logger } from '../logger.js';

export function createMcpServer(): Server {
  const server = new Server(
    {
      name: 'linkedin-personal-manager-mcp',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // 1. Tool discovery: Handle ListToolsRequestSchema
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    logger.info('Received tools/list request from MCP client');
    const tools = getAllToolDefinitions();
    return { tools };
  });

  // 2. Tool execution: Handle CallToolRequestSchema
  server.setRequestHandler(CallToolRequestSchema, async (request): Promise<CallToolResult> => {
    const { name, arguments: args } = request.params;
    logger.info(`Received tools/call request for tool: ${name}`);

    try {
      const result = await executeTool(name, args || {});
      const textResult =
        typeof result === 'string'
          ? result
          : JSON.stringify(result, null, 2);

      return {
        content: [
          {
            type: 'text',
            text: textResult,
          },
        ],
        isError: false,
      };
    } catch (err: any) {
      logger.error(`Error executing tool "${name}":`, err.message);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                error: true,
                tool: name,
                message: err.message,
                details: err.stack,
              },
              null,
              2
            ),
          },
        ],
        isError: true,
      };
    }
  });

  return server;
}
