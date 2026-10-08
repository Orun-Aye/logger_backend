/**
 * FingerprintService — stable error signatures for grouping.
 *
 * Errors are grouped by a hash of (error name + normalized message template +
 * normalized top stack frames). Normalization strips values that vary between
 * occurrences of the same bug (ids, numbers, urls, line/column positions)
 * while keeping enough structure that distinct bugs stay distinct.
 *
 * Grouping is intentionally conservative: wrong merges are worse than
 * wrong splits.
 */
import crypto from "crypto";

const MAX_FRAMES = 5;

export interface FingerprintInput {
  errorName?: string;
  message: string;
  stack?: string;
}

export class FingerprintService {
  static compute(input: FingerprintInput): string {
    const name = (input.errorName || "Error").trim();
    const messageTemplate = this.normalizeMessage(input.message || "");
    const frames = this.normalizeStack(input.stack || "");

    const material = [name, messageTemplate, ...frames].join("|");
    return crypto.createHash("sha1").update(material).digest("hex");
  }

  /** Human-readable group title: "TypeError: Cannot read properties of undefined". */
  static buildTitle(input: FingerprintInput): string {
    const name = (input.errorName || "Error").trim();
    const message = (input.message || "").split("\n")[0].slice(0, 200);
    if (!message) return name;
    // Avoid "Error: Error: something" doubling
    if (message.startsWith(`${name}:`)) return message;
    return `${name}: ${message}`;
  }

  /**
   * Replace occurrence-specific values with placeholders so the same bug
   * always produces the same template.
   */
  static normalizeMessage(message: string): string {
    return message
      .split("\n")[0]
      // UUIDs
      .replace(
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
        "<id>"
      )
      // Long hex identifiers (object ids, hashes)
      .replace(/\b[0-9a-f]{8,}\b/gi, "<id>")
      // ISO timestamps
      .replace(/\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}[^\s"']*/g, "<time>")
      // URLs (keep host, drop path/query variance)
      .replace(/(https?:\/\/[^\s/"']+)[^\s"']*/gi, "$1/<path>")
      // Query strings on relative paths ("/api/items?page=2"): keep the path
      .replace(/(\/[^\s?"'#]*)\?[^\s"'#]+/g, "$1?<query>")
      // Numbers with 2+ digits (ports, sizes, counts)
      .replace(/\b\d{2,}\b/g, "<n>")
      .trim()
      .slice(0, 300);
  }

  /**
   * Extract and normalize the top stack frames. Handles V8 ("at fn (file)")
   * and Firefox/Safari ("fn@file") formats. Positions, bundle hashes, and
   * machine-specific path prefixes are stripped.
   */
  static normalizeStack(stack: string): string[] {
    if (!stack) return [];
    const frames: string[] = [];

    for (const rawLine of stack.split("\n")) {
      const line = rawLine.trim();
      if (!line) continue;

      let fn = "";
      let location = "";

      const v8 = line.match(/^at\s+(?:(.+?)\s+\()?(.+?)\)?$/);
      const gecko = line.match(/^(.*?)@(.+)$/);

      if (line.startsWith("at ") && v8) {
        fn = v8[1] || "<anonymous>";
        location = v8[2] || "";
      } else if (gecko) {
        fn = gecko[1] || "<anonymous>";
        location = gecko[2] || "";
      } else {
        continue;
      }

      frames.push(`${this.normalizeFunction(fn)}@${this.normalizeLocation(location)}`);
      if (frames.length >= MAX_FRAMES) break;
    }

    return frames;
  }

  private static normalizeFunction(fn: string): string {
    return fn
      .replace(/^async\s+/, "")
      .replace(/^Object\./, "")
      .trim()
      .slice(0, 100);
  }

  private static normalizeLocation(location: string): string {
    let loc = location.trim();
    // Strip :line:col suffixes
    loc = loc.replace(/:\d+:\d+$/, "").replace(/:\d+$/, "");
    // Strip query strings / bundle cache-busters
    loc = loc.replace(/\?.*$/, "");
    // Strip origins so the same app on different domains groups together
    loc = loc.replace(/^https?:\/\/[^/]+/i, "");
    // Strip webpack/vite internal prefixes
    loc = loc.replace(/^webpack(-internal)?:\/\/\/?/, "");
    // Content-hashed bundle names: main.abc12345.js → main.<hash>.js
    loc = loc.replace(/\.[0-9a-f]{8,}\.(js|mjs|css)/i, ".<hash>.$1");
    // Keep only the last 3 path segments (drops machine-specific prefixes)
    const segments = loc.split("/").filter(Boolean);
    return segments.slice(-3).join("/");
  }

  /** File paths referenced by the stack (used for suspect-commit matching). */
  static stackFilePaths(stack: string): string[] {
    if (!stack) return [];
    const paths = new Set<string>();
    for (const frame of this.normalizeStack(stack)) {
      const location = frame.split("@")[1];
      if (!location || location === "<anonymous>") continue;
      paths.add(location);
    }
    return Array.from(paths);
  }
}
