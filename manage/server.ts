import { createRequestListener } from "remix/node-fetch-server";
import { isDevelopment } from "./env.ts";
import { router } from "./router.ts";

// Plugged into Express for requests on MANAGE_HOST. Behind the production proxy,
// trust X-Forwarded-* so URLs, secure cookies and the OAuth callback use https.
export const manageListener = createRequestListener(router.fetch, {
  trustProxy: !isDevelopment,
  onError(error) {
    console.error("Dashboard error:", error);
    return new Response("Something went wrong. Try again.", { status: 500 });
  },
});
