import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { Notification_Type } from '@prisma/client';

export class NotificationsDto {
  @IsString()
  title: string;

  @IsString()
  description: string;

  @IsOptional()
  @IsBoolean()
  isRead?: boolean;

  @IsOptional()
  @IsEnum(Notification_Type)
  type?: Notification_Type;

  @IsOptional()
  @IsNumber()
  taskId?: number;

  @IsOptional()
  @IsDateString()
  triggerTime?: string;

  @IsOptional()
  @IsString()
  actionUrl?: string;

  @IsOptional()
  @IsString()
  actionType?: string;
}
