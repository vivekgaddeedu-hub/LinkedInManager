import { Router, Request, Response, NextFunction } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { createMcpServer } from '../mcp/server.js';
import { config } from '../config.js';
import { logger } from '../logger.js';

export const mcpRouter = Router();

// Track legacy SSE transports by session ID
const sseTransports = new Map<string, SSEServerTransport>();

/**
 * Authentication middleware for MCP endpoint
 * Allows securing the endpoint with an optional Bearer token configured in Claude Custom Connector
 */
function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (config.MCP_AUTH_TOKEN) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing or invalid Authorization header. Provide Bearer token.',
      });
      return;
    }

    const token = authHeader.slice(7).trim();
    if (token !== config.MCP_AUTH_TOKEN) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Invalid MCP authentication token.',
      });
      return;
    }
  }

  next();
}

/**
 * Ensure Accept header contains application/json and text/event-stream
 * as required by the MCP Streamable HTTP transport
 */
function normalizeAcceptHeader(req: Request, _res: Response, next: NextFunction): void {
  if (!req.headers.accept || !req.headers.accept.includes('text/event-stream')) {
    req.headers.accept = 'application/json, text/event-stream';
  }
  next();
}

/**
 * 1. Streamable HTTP Endpoint (POST /mcp)
 * Primary MCP endpoint used by Claude custom connectors
 */
mcpRouter.post('/mcp', authMiddleware, normalizeAcceptHeader, async (req: Request, res: Response) => {
  try {
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    const server = createMcpServer();
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err: any) {
    logger.error('Error handling Streamable HTTP request on /mcp:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal MCP Error', message: err.message });
    }
  }
});

/**
 * 2. Streamable HTTP SSE Endpoint (GET /mcp)
 * For streaming notifications or persistent stream connection
 */
mcpRouter.get('/mcp', authMiddleware, normalizeAcceptHeader, async (req: Request, res: Response) => {
  try {
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    const server = createMcpServer();
    await server.connect(transport);
    await transport.handleRequest(req, res);
  } catch (err: any) {
    logger.error('Error handling Streamable HTTP GET on /mcp:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal MCP Error', message: err.message });
    }
  }
});

/**
 * 3. Legacy / Alternative SSE Endpoint (GET /sse)
 * For clients explicitly expecting standard Server-Sent Events
 */
mcpRouter.get('/sse', authMiddleware, async (req: Request, res: Response) => {
  try {
    const sseTransport = new SSEServerTransport('/messages', res);
    const sessionServer = createMcpServer();
    await sessionServer.connect(sseTransport);

    const sessionId = sseTransport.sessionId;
    sseTransports.set(sessionId, sseTransport);

    sseTransport.onclose = () => {
      sseTransports.delete(sessionId);
      logger.info(`SSE session ${sessionId} closed`);
    };

    logger.info(`New SSE client connected with session ID: ${sessionId}`);
    await sseTransport.start();
  } catch (err: any) {
    logger.error('Error initializing SSE transport on /sse:', err);
    if (!res.headersSent) {
      res.status(500).send('Failed to establish SSE stream');
    }
  }
});

/**
 * 4. Message Endpoint for SSE (POST /messages)
 */
mcpRouter.post('/messages', authMiddleware, async (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string;
  if (!sessionId) {
    res.status(400).send('Missing sessionId query parameter');
    return;
  }

  const transport = sseTransports.get(sessionId);
  if (!transport) {
    res.status(404).send(`SSE session "${sessionId}" not found or expired`);
    return;
  }

  try {
    await transport.handlePostMessage(req, res, req.body);
  } catch (err: any) {
    logger.error(`Error processing message for SSE session ${sessionId}:`, err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to process message', message: err.message });
    }
  }
});
