import { Module } from '@nestjs/common';
import { InsightsService } from '../insights/insights.service';
import { PrismaModule } from '../prisma/prisma.module';

// Minimal context for the MCP process: database access and the Store Agent
// tools only, without HTTP controllers, auth guards, or the JWT secret.
@Module({
  imports: [PrismaModule],
  providers: [InsightsService],
})
export class McpModule {}
