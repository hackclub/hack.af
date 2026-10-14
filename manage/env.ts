const nodeEnv = Bun.env.NODE_ENV;

export const isDevelopment = nodeEnv === "development";
export const isTest = nodeEnv === "test";

// Comma-separated so a dev machine can answer on localhost and a LAN or Tailscale name.
// The first host is canonical (used for the Hack Club Auth callback).
export const manageHosts = (
  Bun.env.MANAGE_HOST ?? (isDevelopment || isTest ? "manage.localhost" : "")
)
  .split(",")
  .map((host) => host.trim().toLowerCase())
  .filter(Boolean);

export const manageHost = manageHosts[0];

export const sessionSecret = (() => {
  const secret = Bun.env.MANAGE_SESSION_SECRET;
  if (secret) return secret;
  if (isDevelopment || isTest) return "hack.af-dev-session-secret";
  return undefined;
})();

export const hackClubAuth =
  Bun.env.HCA_CLIENT_ID && Bun.env.HCA_CLIENT_SECRET
    ? {
        issuer: Bun.env.HCA_ISSUER ?? "https://auth.hackclub.com",
        clientId: Bun.env.HCA_CLIENT_ID,
        clientSecret: Bun.env.HCA_CLIENT_SECRET,
      }
    : null;

// Lets you sign in locally without Hack Club Auth credentials. Never honored in production.
export const devLoginEnabled = isDevelopment && Bun.env.MANAGE_DEV_LOGIN === "1";

if (devLoginEnabled) {
  console.warn(
    "MANAGE_DEV_LOGIN is on: anyone who can reach the dashboard can sign in as any staff Slack ID.",
  );
}
