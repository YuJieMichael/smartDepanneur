import { NestFactory } from '@nestjs/core';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { InsightsService } from '../insights/insights.service';
import { McpModule } from './mcp.module';
import { createStoreMcpServer } from './store-mcp.server';

async function bootstrap() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required to start the MCP server');
  }

  // stdout carries the MCP protocol. Nest writes only errors to stderr, so
  // every other log level stays off.
  const app = await NestFactory.createApplicationContext(McpModule, {
    logger: ['error'],
  });
  app.enableShutdownHooks();

  const server = createStoreMcpServer(app.get(InsightsService));
  await server.connect(new StdioServerTransport());
}

bootstrap().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
