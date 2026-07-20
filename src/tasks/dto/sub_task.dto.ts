import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class SubTaskDto {
  @IsOptional()
  @IsString()
  title: string;

  @IsOptional()
  @IsBoolean()
  isDone?: boolean;
}
