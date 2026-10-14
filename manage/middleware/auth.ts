import { auth, createSessionAuthScheme, requireAuth } from "remix/middleware/auth";
import { redirect } from "remix/response/redirect";
import * as s from "remix/data-schema";
import { resolvePerson } from "../../src/people.ts";
import { findStaff } from "../../src/staff.ts";
import { readTheme, type Theme } from "../ui/public/theme.ts";
import { routes } from "../routes.ts";

export type SessionUser = {
  sub: string;
  name: string;
  slackId: string | null;
  email: string | null;
};

export type Viewer = SessionUser & {
  // What history and audit rows record as the person who made a change
  actor: string;
  staffId: number;
  image: string | null;
  theme: Theme;
};

const sessionUserSchema = s.object({
  sub: s.string(),
  name: s.string(),
  slackId: s.nullable(s.string()),
  email: s.nullable(s.string()),
});

export function loadViewer() {
  return auth({
    schemes: [
      createSessionAuthScheme<Viewer, SessionUser>({
        read(session) {
          const result = s.parseSafe(sessionUserSchema, session.get("user"));
          return result.success ? result.value : null;
        },
        async verify(user, context) {
          const member = await findStaff({ slackId: user.slackId, email: user.email });
          if (!member) return null;
          // Cached for hours, so this only reaches Slack occasionally
          const person = await resolvePerson(user.slackId);
          return {
            image: person?.image ?? null,
            theme: readTheme(context.headers.get("Cookie")),
            ...user,
            name: member.id === 0 ? user.name : member.name,
            actor: user.slackId ?? user.email ?? user.sub,
            staffId: member.id,
          };
        },
        invalidate(session) {
          session.unset("user");
        },
      }),
    ],
  });
}

export function requireViewer() {
  return requireAuth<Viewer>({
    onFailure(context) {
      const returnTo = context.url.pathname + context.url.search;
      return redirect(
        routes.login.href(undefined, returnTo === "/" ? undefined : { searchParams: { returnTo } }),
      );
    },
  });
}

// Only same-origin paths. Browsers treat "\" like "/", so "/\evil.com" would leave the
// site; resolving against a placeholder origin catches that and similar tricks at once.
export function safeReturnTo(value: string | null | undefined): string | undefined {
  if (!value || !value.startsWith("/") || value.length > 2000) return undefined;
  if (value.includes("\\") || [...value].some((char) => char.charCodeAt(0) < 0x20)) {
    return undefined;
  }
  try {
    const url = new URL(value, "https://manage.invalid");
    if (url.origin !== "https://manage.invalid") return undefined;
    return url.pathname + url.search + url.hash;
  } catch {
    return undefined;
  }
}
