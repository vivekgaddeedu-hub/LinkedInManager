import { createApp } from './app.js';
import { config } from './config.js';
import { logger } from './logger.js';

async function main() {
  const app = createApp();

  const server = app.listen(config.PORT, config.HOST, () => {
    logger.info('===========================================================');
    logger.info('🚀 LinkedIn AI Personal Manager – MCP Server is running!');
    logger.info(`🌐 Local Server URL:       http://${config.HOST}:${config.PORT}`);
    logger.info(`🔌 MCP Streamable Endpoint: http://${config.HOST}:${config.PORT}/mcp`);
    logger.info(`📡 MCP SSE Endpoint:        http://${config.HOST}:${config.PORT}/sse`);
    logger.info(`❤️ Health Check:           http://${config.HOST}:${config.PORT}/health`);
    logger.info(`🔐 LinkedIn OAuth Login:   http://${config.HOST}:${config.PORT}/auth/login`);
    logger.info(`🌍 Configured Public URL:  ${config.PUBLIC_BASE_URL}`);
    logger.info('===========================================================');
  });

  // Graceful shutdown handling
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Shutting down LinkedIn MCP server gracefully...`);
    server.close(() => {
      logger.info('HTTP server closed. Exiting process.');
      process.exit(0);
    });

    // Force exit after 5 seconds if not closed
    setTimeout(() => {
      logger.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 5000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error('Fatal initialization error:', err);
  process.exit(1);
});

