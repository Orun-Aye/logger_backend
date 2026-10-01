import logger from "../utils/logger";

const PING_TIMEOUT_MS = 30_000;

/**
 * Ping our own public URL so the hosting platform sees inbound traffic.
 * Render's free tier spins a web service down after 15 minutes without
 * inbound requests; a self-ping through the public URL counts as one.
 */
export async function runKeepAliveJob(url: string): Promise<void> {
  const start = Date.now();

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "apperio-keep-alive" },
      signal: AbortSignal.timeout(PING_TIMEOUT_MS),
    });

    if (!res.ok) {
      logger.warn(`KeepAliveJob: ${url} responded ${res.status}`);
      return;
    }

    logger.debug(`KeepAliveJob: Pinged ${url} in ${Date.now() - start}ms`);
  } catch (error) {
    logger.warn(`KeepAliveJob: Ping to ${url} failed`, {
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
