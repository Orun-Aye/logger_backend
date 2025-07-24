import { IsEnum, IsOptional, IsPositive, IsString } from "class-validator";
import { Type } from "class-transformer";
import { LogLevel } from "../models/log.model";

/**
 * DTO to validate and transform query parameters for fetching logs.
 */
export class LogQueryDto {
  @IsOptional()
  @IsEnum(LogLevel, {
    message: "Level must be one of: INFO, WARN, ERROR, DEBUG",
  })
  level?: LogLevel;

  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @Type(() => Number)
  @IsPositive({ message: "Page must be a positive number" })
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsPositive({ message: "Limit must be a positive number" })
  limit?: number;
}
