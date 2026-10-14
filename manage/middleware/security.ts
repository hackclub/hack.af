import type { Middleware } from "remix/router";
import { isDevelopment } from "../env.ts";

const IMPORT_MAP_TAG = "<script data-rmx-import-map";

// Only our own scripts run: modules from this origin, plus the one inline import map,
// which carries a per-response nonce. Remix copies that nonce onto import maps it adds
// during client navigation. Styles stay 'unsafe-inline' because Remix emits inline
// style tags and attributes; that's a far smaller risk than inline script.
function contentSecurityPolicy(nonce: string) {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    "style-src 'self' 'unsafe-inline'",
    // Slack photos (cachet), destination favicons (Google), and the inline SVG favicon
    "img-src 'self' data: https:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");
}

export function securityHeaders(): Middleware {
  return async (_context, next) => {
    let response = await next();

    if (response.headers.get("Content-Type")?.startsWith("text/html")) {
      // Pages are small, so buffering one to stamp the nonce costs nothing noticeable
      const nonce = crypto.randomUUID().replaceAll("-", "");
      const html = (await response.text()).replace(
        IMPORT_MAP_TAG,
        `${IMPORT_MAP_TAG} nonce="${nonce}"`,
      );
      const headers = new Headers(response.headers);
      headers.delete("Content-Length");
      headers.set("Content-Security-Policy", contentSecurityPolicy(nonce));
      response = new Response(html, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }

    try {
      response.headers.set("X-Frame-Options", "DENY");
      response.headers.set("X-Content-Type-Options", "nosniff");
      response.headers.set("Referrer-Policy", "same-origin");
      response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
      if (!isDevelopment) {
        response.headers.set("Strict-Transport-Security", "max-age=31536000");
      }
      if (!response.headers.has("Cache-Control")) {
        response.headers.set("Cache-Control", "private, no-store");
      }
    } catch {
      // Some responses, like Response.redirect(), have immutable headers
    }
    return response;
  };
}
