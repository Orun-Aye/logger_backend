import {
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from "class-validator";
import { LogLevel } from "../models/log.model";

/**
 * DTO for creating a log entry.
 */
export class CreateLogDto {
  @IsEnum(LogLevel, {
    message: "Level must be one of: INFO, WARN, ERROR, DEBUG",
  })
  level!: LogLevel;

  @IsString({ message: "Message must be a string" })
  @IsNotEmpty({ message: "Message cannot be empty" })
  message!: string;

  @IsOptional()
  @IsObject({ message: "Metadata must be an object" })
  metadata?: Record<string, any>;
}
