import { IsEnum, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export enum NotificationChannelDto {
  SMS = 'sms',
  EMAIL = 'email',
  PUSH = 'push',
}

export class SendNotificationDto {
  @IsEnum(NotificationChannelDto)
  channel: NotificationChannelDto;

  @IsString()
  @MaxLength(500)
  recipient: string;

  @IsString()
  @MaxLength(200)
  template: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string;

  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}
