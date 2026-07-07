import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller('api')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  async getHealth(): Promise<{ status: string; database: string; timestamp: string }> {
    return this.appService.getHealth();
  }
}
