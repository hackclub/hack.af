import { redirect } from "remix/response/redirect";
import { createController } from "remix/router";
import { getActivity, getActivityActors } from "../../src/links.ts";
import { resolvePeople } from "../../src/people.ts";
import { findStaff } from "../../src/staff.ts";
import { assets } from "../assets.ts";
import { devLoginEnabled, hackClubAuth } from "../env.ts";
import { requireViewer, safeReturnTo } from "../middleware/auth.ts";
import { routes } from "../routes.ts";
import { ActivityPage } from "./activity/page.tsx";
import { LoginPage } from "./auth/login-page.tsx";
import { readTheme } from "../ui/public/theme.ts";
import { takeToast } from "./toast.ts";

const ACTIVITY_PAGE_SIZE = 60;

export default createController(routes, {
  actions: {
    async assets(context) {
      return (await assets.fetch(context.request)) ?? new Response("Not found", { status: 404 });
    },

    home(context) {
      return redirect(context.auth.ok ? routes.links.index.href() : routes.login.href());
    },

    async login(context) {
      const returnTo = safeReturnTo(context.url.searchParams.get("returnTo"));
      if (context.auth.ok) return redirect(returnTo ?? routes.links.index.href());

      const error = context.session.get("loginError");
      let devLogin = null;
      if (devLoginEnabled) {
        const fallback = Bun.env.MANAGE_DEV_LOGIN_AS ?? "";
        devLogin = {
          slackId: (await findStaff({ slackId: fallback, email: null })) ? fallback : "",
        };
      }

      return context.render(
        <LoginPage
          returnTo={returnTo}
          error={typeof error === "string" ? error : undefined}
          hackClubAuthEnabled={hackClubAuth !== null}
          devLogin={devLogin}
          theme={readTheme(context.headers.get("Cookie"))}
        />,
      );
    },

    activity: {
      middleware: [requireViewer()],
      async handler(context) {
        // requireViewer() already redirected anonymous visitors
        if (!context.auth.ok) return redirect(routes.login.href());
        const params = context.url.searchParams;
        const actor = params.get("actor") ?? "";
        const action = params.get("action") ?? "";
        const before = params.get("before");
        const beforeDate =
          before && !Number.isNaN(Date.parse(before)) ? new Date(before) : undefined;

        const [entries, actors] = await Promise.all([
          getActivity({
            actor: actor || undefined,
            action: action || undefined,
            before: beforeDate,
            limit: ACTIVITY_PAGE_SIZE,
          }),
          getActivityActors(),
        ]);
        const people = await resolvePeople([
          ...actors,
          ...entries.map((entry) => entry.actor ?? ""),
        ]);
        const last = entries.at(-1);

        return context.render(
          <ActivityPage
            viewer={context.auth.identity}
            toast={takeToast(context.session)}
            entries={entries}
            people={people}
            actors={actors}
            filters={{ actor, action }}
            nextCursor={
              entries.length === ACTIVITY_PAGE_SIZE && last ? last.at.toISOString() : null
            }
          />,
        );
      },
    },
  },
});
