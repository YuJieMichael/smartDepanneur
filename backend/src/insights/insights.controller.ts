import { Controller, Get, Post, Body, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AskInsightDto } from './dto/ask-insight.dto';
import { InsightsService } from './insights.service';

@Controller('api/insights')
export class InsightsController {
  constructor(private readonly insightsService: InsightsService) {}

  @UseGuards(JwtAuthGuard)
  @Get('reorder')
  async getReorderSuggestions() {
    return this.insightsService.getReorderSuggestions();
  }

  @UseGuards(JwtAuthGuard)
  @Get('top-sellers')
  async getTopSellers() {
    return this.insightsService.getTopSellers();
  }

  @UseGuards(JwtAuthGuard)
  @Get('slow-movers')
  async getSlowMovers() {
    return this.insightsService.getSlowMovers();
  }

  @UseGuards(JwtAuthGuard)
  @Post('ask')
  async ask(
    @Body() body: AskInsightDto,
    @Request() req: { user: { id: number; email: string } },
  ) {
    return this.insightsService.ask(body.question, body.language, req.user);
  }
}
