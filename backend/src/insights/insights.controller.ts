import { Controller, Get, Post, Body, UseGuards, Request } from '@nestjs/common';
import { PermissionGuard } from '../access-control/permission.guard';
import { RequirePermissions } from '../access-control/require-permissions.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AskInsightDto } from './dto/ask-insight.dto';
import { InsightsService } from './insights.service';

@Controller('api/insights')
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermissions('insights-view')
export class InsightsController {
  constructor(private readonly insightsService: InsightsService) {}

  @Get('reorder')
  async getReorderSuggestions() {
    return this.insightsService.getReorderSuggestions();
  }

  @Get('top-sellers')
  async getTopSellers() {
    return this.insightsService.getTopSellers();
  }

  @Get('slow-movers')
  async getSlowMovers() {
    return this.insightsService.getSlowMovers();
  }

  @Post('ask')
  async ask(
    @Body() body: AskInsightDto,
    @Request() req: { user: { id: number; email: string } },
  ) {
    return this.insightsService.ask(body.question, body.language, req.user);
  }
}
