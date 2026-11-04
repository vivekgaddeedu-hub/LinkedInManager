import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { healthRouter } from './routes/health.routes.js';
import { authRouter } from './routes/auth.routes.js';
import { dashboardRouter } from './routes/dashboard.routes.js';
import { mcpRouter } from './routes/mcp.routes.js';
import { logger } from './logger.js';

export function createApp() {
  const app = express();

  // Enable Cross-Origin Resource Sharing
  app.use(
    cors({
      origin: true,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
    })
  );

  // Parse JSON and URL-encoded request bodies
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Request logging middleware (excluding health checks to avoid noise)
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (req.path !== '/health') {
      logger.info(`${req.method} ${req.path}`);
    }
    next();
  });

  // Mount Application Routes
  app.use(healthRouter);
  app.use(authRouter);
  app.use(dashboardRouter);
  app.use(mcpRouter);

  // 404 Not Found Handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      error: 'Not Found',
      path: req.path,
      message: `The requested path ${req.path} does not exist on this MCP server.`,
    });
  });

  // Global Error Handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    logger.error('Unhandled Server Error:', err);
    if (!res.headersSent) {
      res.status(err.status || 500).json({
        error: 'Internal Server Error',
        message: err.message || 'An unexpected error occurred.',
      });
    }
  });

  return app;
}

