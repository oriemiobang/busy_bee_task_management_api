import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { NotificationsDto } from './dto/notifications.dto';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private notificationService: NotificationsService) {}

  @Post('/')
  async AddNotification(@Body() body: NotificationsDto, @Req() req) {
    return await this.notificationService.AddNotification(body, req.user.id);
  }

  // GET /notifications?page=1&limit=20
  @Get('/')
  async GetNotifications(
    @Req() req,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return await this.notificationService.GetNotifications(
      req.user.id,
      +page,
      +limit,
    );
  }

  // PATCH /notifications/:id/read
  @Patch('/:id/read')
  async ReadNotification(
    @Req() req,
    @Param('id') id: number,
    @Body('isRead') isRead = true,
  ) {
    return await this.notificationService.ReadNotification(
      +id,
      isRead,
      req.user.id,
    );
  }

  // PATCH /notifications/read-all
  @Patch('/read-all')
  async MarkAllRead(@Req() req) {
    return await this.notificationService.MarkAllRead(req.user.id);
  }

  @Delete('/:id')
  async DeleteNotification(@Req() req, @Param('id') id: number) {
    return await this.notificationService.DeleteNotification(+id, req.user.id);
  }
}
