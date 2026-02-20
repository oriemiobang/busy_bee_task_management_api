import { IsEnum, IsOptional, IsArray, ValidateNested, IsDateString, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { Status_Enum, Recurrence_Type, Day_Of_Week } from '@prisma/client';
import { SubTaskDto } from './sub_task.dto';

export class TasksDto {
  @IsOptional()
  title?: string;

  @IsOptional()
  description?: string;

  @IsOptional()
  @IsDateString()
  start_time?: string;

  @IsOptional()
  @IsDateString()
  deadline?: string;

  @IsOptional()
  @IsEnum(Status_Enum)
  status?: Status_Enum;

  // ✅ RECURRENCE FIELDS
  @IsOptional()
  @IsEnum(Recurrence_Type)
  recurrenceType?: Recurrence_Type;

  @IsOptional()
  @Min(1)
  @Max(365)
  recurrenceInterval?: number;

  @IsOptional()
  @IsArray()
  @IsEnum(Day_Of_Week, { each: true })
  recurrenceDays?: Day_Of_Week[];

  @IsOptional()
  @Min(1)
  @Max(31)
  recurrenceDayOfMonth?: number;

  @IsOptional()
  @IsDateString()
  recurrenceEndDate?: string;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => SubTaskDto)
  subtasks?: SubTaskDto[];
}