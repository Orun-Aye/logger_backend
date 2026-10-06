/**
 * Coarse device, browser and OS from a User-Agent string. No dependency: the
 * dashboard only needs a label and an icon, not full UA parsing. iPadOS 13+
 * reports itself as macOS, so it reads as a desktop.
 */
export interface ParsedUserAgent {
  device: "desktop" | "mobile" | "tablet" | "unknown";
  browser?: string;
  os?: string;
}

export function parseUserAgent(ua?: string | null): ParsedUserAgent {
  if (!ua) return { device: "unknown" };

  const device = /ipad|tablet|playbook|silk|android(?!.*mobile)/i.test(ua)
    ? "tablet"
    : /mobi|iphone|ipod|windows phone/i.test(ua)
      ? "mobile"
      : "desktop";

  // Order matters: Edge and Opera also say Chrome, and Chrome also says Safari
  const browser = /edg\//i.test(ua)
    ? "Edge"
    : /opr\/|opera/i.test(ua)
      ? "Opera"
      : /samsungbrowser/i.test(ua)
        ? "Samsung Internet"
        : /firefox|fxios/i.test(ua)
          ? "Firefox"
          : /chrome|crios|chromium/i.test(ua)
            ? "Chrome"
            : /safari/i.test(ua)
              ? "Safari"
              : undefined;

  const os = /windows/i.test(ua)
    ? "Windows"
    : /iphone|ipad|ipod/i.test(ua)
      ? "iOS"
      : /android/i.test(ua)
        ? "Android"
        : /cros/i.test(ua)
          ? "ChromeOS"
          : /mac os x|macintosh/i.test(ua)
            ? "macOS"
            : /linux/i.test(ua)
              ? "Linux"
              : undefined;

  return { device, browser, os };
}
