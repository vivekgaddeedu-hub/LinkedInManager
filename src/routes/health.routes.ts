import { Router, Request, Response } from 'express';
import { oauthService } from '../services/oauth.service.js';

export const healthRouter = Router();

healthRouter.get('/health', async (_req: Request, res: Response) => {
  const isAuth = await oauthService.isAuthenticated();

  res.status(200).json({
    status: 'ok',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    linkedInConnected: isAuth,
    mcpTransport: 'StreamableHTTP & SSE',
    server: 'linkedin-personal-manager-mcp',
    version: '1.0.0',
  });
});
