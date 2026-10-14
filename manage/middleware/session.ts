import { createCookie } from "remix/cookie";
import { createCookieSessionStorage } from "remix/session-storage/cookie";
import { isDevelopment, isTest, sessionSecret } from "../env.ts";

if (!sessionSecret) {
  throw new Error("MANAGE_SESSION_SECRET must be set to run the dashboard in production.");
}

// The session only holds who signed in. Access is re-checked against the staff
// table on every request, so revoking someone doesn't wait for the cookie to expire.
export const sessionCookie = createCookie("hackaf_manage", {
  secrets: [sessionSecret],
  httpOnly: true,
  // Explicit rather than inferred from the request URL, so a proxy misconfiguration
  // can't quietly drop it
  secure: !isDevelopment && !isTest,
  sameSite: "Lax",
  path: "/",
  maxAge: 60 * 60 * 24 * 14,
});

export const sessionStorage = createCookieSessionStorage();

export type Toast = { kind: "success" | "error"; message: string };
