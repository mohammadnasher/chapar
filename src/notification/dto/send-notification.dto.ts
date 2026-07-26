import {
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

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

  /**
   * Sender identity — for SMS, the line number to send from (e.g. "10004346").
   * Must be one of the lines configured on the server (KAVEHNEGAR_LINES).
   * Omit to use the default (first configured) line.
   */
  @IsOptional()
  @IsString()
  @Matches(/^\+?\d+$/, {
    message: 'sender must be a numeric line number, e.g. "10004346"',
  })
  @MaxLength(50)
  sender?: string;

  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}
