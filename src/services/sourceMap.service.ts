// src/services/sourceMap.service.ts

import { Types } from "mongoose";
import { SourceMapModel, ISourceMap } from "../models/sourceMap.model";

// Custom error classes following existing codebase patterns
export class SourceMapValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SourceMapValidationError";
  }
}

export class SourceMapServiceError extends Error {
  constructor(message: string, public context?: any) {
    super(message);
    this.name = "SourceMapServiceError";
  }
}

export class SourceMapNotFoundError extends Error {
  constructor(id: string) {
    super(`Source map with ID ${id} not found`);
    this.name = "SourceMapNotFoundError";
  }
}

/**
 * Resolved stack frame returned by resolveStackTrace
 */
interface ResolvedFrame {
  original?: {
    source: string | null;
    line: number | null;
    column: number | null;
    name: string | null;
  };
  minified: {
    file: string;
    line: number;
    column: number;
  };
  functionName?: string;
  resolved: boolean;
}

/**
 * Dynamic import of source-map package to avoid hard dependency.
 * Returns null if the package is not installed.
 */
async function getSourceMapConsumer(rawSourceMap: string) {
  try {
    const { SourceMapConsumer } = await import("source-map");
    return await new SourceMapConsumer(JSON.parse(rawSourceMap));
  } catch {
    return null;
  }
}

/**
 * Extracts the filename from a URL or path string.
 * e.g. "https://example.com/static/js/main.abc123.js" -> "main.abc123.js"
 */
function extractFileName(fileOrUrl: string): string {
  try {
    const url = new URL(fileOrUrl);
    const pathParts = url.pathname.split("/");
    return pathParts[pathParts.length - 1] || fileOrUrl;
  } catch {
    // Not a valid URL, try splitting by /
    const parts = fileOrUrl.split("/");
    return parts[parts.length - 1] || fileOrUrl;
  }
}

export class SourceMapService {
  /**
   * Validates if a given string is a valid MongoDB ObjectId.
   */
  private static validateObjectId(id: string): void {
    if (!Types.ObjectId.isValid(id)) {
      throw new SourceMapValidationError(`Invalid ID format: ${id}`);
    }
  }

  /**
   * Uploads (or updates) a source map for a project release.
   * Uses upsert to avoid duplicates based on { projectId, release, originalFileName }.
   */
  static async uploadSourceMap(
    projectId: string,
    data: {
      release: string;
      fileName: string;
      originalFileName: string;
      sourceMapData: string;
      uploadedBy?: string;
    }
  ): Promise<ISourceMap> {
    try {
      this.validateObjectId(projectId);

      // Validate that sourceMapData is valid JSON
      try {
        JSON.parse(data.sourceMapData);
      } catch {
        throw new SourceMapValidationError(
          "sourceMapData must be valid JSON"
        );
      }

      const fileSize = Buffer.byteLength(data.sourceMapData, "utf-8");

      const sourceMap = await SourceMapModel.findOneAndUpdate(
        {
          projectId,
          release: data.release,
          originalFileName: data.originalFileName,
        },
        {
          projectId,
          release: data.release,
          fileName: data.fileName,
          originalFileName: data.originalFileName,
          sourceMapData: data.sourceMapData,
          uploadedBy: data.uploadedBy,
          fileSize,
        },
        { upsert: true, new: true, runValidators: true }
      );

      return sourceMap;
    } catch (error) {
      if (
        error instanceof SourceMapValidationError ||
        error instanceof SourceMapServiceError
      ) {
        throw error;
      }
      throw new SourceMapServiceError(
        `Failed to upload source map: ${(error as Error).message}`,
        { projectId, release: data.release, originalError: error }
      );
    }
  }

  /**
   * Lists source maps for a project, optionally filtered by release.
   * Excludes sourceMapData from the result for performance.
   */
  static async listSourceMaps(
    projectId: string,
    release?: string
  ): Promise<ISourceMap[]> {
    try {
      this.validateObjectId(projectId);

      const filter: any = { projectId };
      if (release) {
        filter.release = release;
      }

      const sourceMaps = await SourceMapModel.find(filter)
        .select("-sourceMapData")
        .sort({ release: -1, fileName: 1 })
        .lean();

      return sourceMaps as ISourceMap[];
    } catch (error) {
      if (error instanceof SourceMapValidationError) {
        throw error;
      }
      throw new SourceMapServiceError(
        `Failed to list source maps: ${(error as Error).message}`,
        { projectId, release, originalError: error }
      );
    }
  }

  /**
   * Resolves a minified stack trace to original source positions using uploaded source maps.
   *
   * Parses frames from the stack trace, looks up source maps by project/release/filename,
   * and uses the source-map package to map back to original positions.
   */
  static async resolveStackTrace(
    projectId: string,
    release: string,
    stackTrace: string
  ): Promise<ResolvedFrame[]> {
    try {
      this.validateObjectId(projectId);

      // Parse stack trace into frames
      const frameRegex =
        /at\s+(?:(.+?)\s+\()?(?:(.+?):(\d+):(\d+))\)?/g;
      const frames: Array<{
        functionName?: string;
        file: string;
        line: number;
        column: number;
      }> = [];

      let match;
      while ((match = frameRegex.exec(stackTrace)) !== null) {
        frames.push({
          functionName: match[1] || undefined,
          file: match[2],
          line: parseInt(match[3], 10),
          column: parseInt(match[4], 10),
        });
      }

      if (frames.length === 0) {
        return [];
      }

      const resolvedFrames: ResolvedFrame[] = [];

      for (const frame of frames) {
        // Try to find a source map matching this frame's file
        // First try with the full file path/URL, then just the filename
        const fileName = extractFileName(frame.file);

        const sourceMap = await SourceMapModel.findOne({
          projectId,
          release,
          $or: [
            { originalFileName: frame.file },
            { originalFileName: fileName },
          ],
        });

        if (!sourceMap) {
          // No source map found for this frame
          resolvedFrames.push({
            minified: {
              file: frame.file,
              line: frame.line,
              column: frame.column,
            },
            functionName: frame.functionName,
            resolved: false,
          });
          continue;
        }

        // Attempt to resolve using source-map package
        const consumer = await getSourceMapConsumer(
          sourceMap.sourceMapData
        );

        if (!consumer) {
          // source-map package not available
          resolvedFrames.push({
            minified: {
              file: frame.file,
              line: frame.line,
              column: frame.column,
            },
            functionName: frame.functionName,
            resolved: false,
          });
          continue;
        }

        try {
          const originalPos = consumer.originalPositionFor({
            line: frame.line,
            column: frame.column,
          });

          resolvedFrames.push({
            original: {
              source: originalPos.source,
              line: originalPos.line,
              column: originalPos.column,
              name: originalPos.name,
            },
            minified: {
              file: frame.file,
              line: frame.line,
              column: frame.column,
            },
            functionName: frame.functionName,
            resolved: originalPos.source !== null,
          });
        } finally {
          if (typeof (consumer as any).destroy === "function") {
            (consumer as any).destroy();
          }
        }
      }

      return resolvedFrames;
    } catch (error) {
      if (
        error instanceof SourceMapValidationError ||
        error instanceof SourceMapServiceError
      ) {
        throw error;
      }
      throw new SourceMapServiceError(
        `Failed to resolve stack trace: ${(error as Error).message}`,
        { projectId, release, originalError: error }
      );
    }
  }

  /**
   * Deletes a source map by its ID.
   */
  static async deleteSourceMap(id: string): Promise<void> {
    try {
      this.validateObjectId(id);

      const deleted = await SourceMapModel.findByIdAndDelete(id);

      if (!deleted) {
        throw new SourceMapNotFoundError(id);
      }
    } catch (error) {
      if (
        error instanceof SourceMapValidationError ||
        error instanceof SourceMapNotFoundError ||
        error instanceof SourceMapServiceError
      ) {
        throw error;
      }
      throw new SourceMapServiceError(
        `Failed to delete source map: ${(error as Error).message}`,
        { id, originalError: error }
      );
    }
  }
}
