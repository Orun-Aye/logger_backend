import { Request, Response, NextFunction } from "express";
import { ProjectModel } from "../models/project.model";
import NodeCache from "node-cache";

// Cache sampling configs for 60 seconds to avoid DB lookups on every request
const samplingCache = new NodeCache({ stdTTL: 60 });

// In-memory counters for rate-based sampling (per project)
const rateCounters = new Map<string, number>();

export async function samplingMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const projectId = req.projectId;
    if (!projectId) {
      return next(); // No project context, skip sampling
    }

    // Check cache first
    let config = samplingCache.get<{
      enabled: boolean;
      mode: string;
      value: number;
      alwaysKeepLevels: string[];
    }>(`sampling:${projectId}`);

    if (config === undefined) {
      // Fetch from DB
      const project = await ProjectModel.findById(projectId).select("samplingConfig").lean();
      config = project?.samplingConfig || { enabled: false, mode: "percentage", value: 100, alwaysKeepLevels: ["error", "fatal"] };
      samplingCache.set(`sampling:${projectId}`, config);
    }

    // If sampling is not enabled, pass through
    if (!config.enabled) {
      return next();
    }

    // Always keep critical log levels
    const logLevel = req.body?.level?.toLowerCase();
    if (logLevel && config.alwaysKeepLevels.includes(logLevel)) {
      return next();
    }

    let shouldKeep = true;

    if (config.mode === "rate") {
      // Rate-based: keep every Nth log
      const counter = (rateCounters.get(projectId) || 0) + 1;
      rateCounters.set(projectId, counter);
      shouldKeep = counter % config.value === 0;

      // Reset counter periodically to prevent overflow
      if (counter > 1000000) {
        rateCounters.set(projectId, 0);
      }
    } else {
      // Percentage-based: keep X% of logs
      shouldKeep = Math.random() * 100 < config.value;
    }

    if (!shouldKeep) {
      req.sampled = false;
      return res.status(202).json({
        status: "success",
        message: "Log sampled out",
        meta: { sampled: false },
      });
    }

    req.sampled = true;
    return next();
  } catch (error) {
    // On error, let the request through (fail open)
    return next();
  }
}
