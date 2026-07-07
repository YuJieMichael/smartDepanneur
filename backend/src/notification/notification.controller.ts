import { Controller, Get, Patch, Param, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotificationService } from './notification.service';

@Controller('api/notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(private readonly service: NotificationService) {}

  @Get()
  async findAll(@Request() req: { user: { id: number } }) {
    return this.service.findByUser(req.user.id);
  }

  @Patch(':id/reviewed')
  async markAsReviewed(@Param('id') id: string) {
    return this.service.markAsReviewed(parseInt(id, 10));
  }

  @Patch('reviewed-all')
  async markAllAsReviewed(@Request() req: { user: { id: number } }) {
    return this.service.markAllAsReviewed(req.user.id);
  }
}
