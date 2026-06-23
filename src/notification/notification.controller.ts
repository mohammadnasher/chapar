import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { NotificationService } from './notification.service';
import { SendNotificationDto } from './dto/send-notification.dto';
import { QueryLogsDto } from './dto/query-logs.dto';
import { ApiKeyGuard } from '../common/guards/api-key.guard';

@Controller()
@UseGuards(ThrottlerGuard, ApiKeyGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Post('notify')
  @HttpCode(HttpStatus.ACCEPTED)
  async notify(@Body() dto: SendNotificationDto) {
    return this.notificationService.dispatch(dto);
  }

  @Get('logs')
  async logs(@Query() query: QueryLogsDto) {
    return this.notificationService.getLogs(query);
  }
}
