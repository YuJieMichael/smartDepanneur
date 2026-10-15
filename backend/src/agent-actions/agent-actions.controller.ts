import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AgentActionStatus } from '@prisma/client';
import { PermissionGuard } from '../access-control/permission.guard';
import { RequirePermissions } from '../access-control/require-permissions.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AgentActionsService } from './agent-actions.service';

const STATUSES = new Set<string>(Object.values(AgentActionStatus));

@Controller('api/agent-actions')
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermissions('insights-view')
export class AgentActionsController {
  constructor(private readonly agentActionsService: AgentActionsService) {}

  @Get()
  list(@Query('status') status?: string) {
    return this.agentActionsService.list(
      status && STATUSES.has(status) ? (status as AgentActionStatus) : undefined,
    );
  }

  @Post('min-stock')
  proposeMinStock(
    @Body() body: { productId?: number; newMinStock?: number },
    @Request() req: { user: { id: number; email: string } },
  ) {
    return this.agentActionsService.proposeMinStock(body, req.user);
  }

  // Only roles with agent-actions-approve (Store Owner) can let an agent
  // proposal change store data.
  @Post(':id/approve')
  @RequirePermissions('agent-actions-approve')
  approve(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: { user: { id: number; email: string } },
  ) {
    return this.agentActionsService.approve(id, req.user);
  }

  @Post(':id/reject')
  @RequirePermissions('agent-actions-approve')
  reject(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { reason?: string | null },
    @Request() req: { user: { id: number; email: string } },
  ) {
    return this.agentActionsService.reject(id, req.user, body?.reason);
  }
}
