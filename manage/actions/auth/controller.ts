import {
  completeAuth,
  createOIDCAuthProvider,
  finishExternalAuth,
  startExternalAuth,
  type OIDCAuthProfile,
} from "remix/auth";
import { redirect } from "remix/response/redirect";
import { createController } from "remix/router";
import { findStaff } from "../../../src/staff.ts";
import { devLoginEnabled, hackClubAuth, isDevelopment, manageHost } from "../../env.ts";
import { safeReturnTo, type SessionUser } from "../../middleware/auth.ts";
import { routes } from "../../routes.ts";

type HackClubProfile = OIDCAuthProfile & { slack_id?: string };

const origin =
  Bun.env.MANAGE_ORIGIN ??
  (isDevelopment ? `http://${manageHost}:${Bun.env.PORT ?? 3000}` : `https://${manageHost}`);

const provider = hackClubAuth
  ? createOIDCAuthProvider<HackClubProfile, "hackclub">({
      name: "hackclub",
      issuer: hackClubAuth.issuer,
      clientId: hackClubAuth.clientId,
      clientSecret: hackClubAuth.clientSecret,
      redirectUri: new URL(routes.auth.callback.href(), origin),
      // slack_id lets us match the same allowlist the Slack bot uses
      scopes: ["openid", "profile", "email", "slack_id"],
    })
  : null;

export default createController(routes.auth, {
  actions: {
    async start(context) {
      if (!provider) return redirect(routes.login.href());
      try {
        return await startExternalAuth(provider, context, {
          returnTo: safeReturnTo(context.url.searchParams.get("returnTo")),
        });
      } catch (error) {
        console.error("Failed to start Hack Club Auth login:", error);
        context.session.flash(
          "loginError",
          "We couldn’t reach Hack Club Auth. Try again in a moment.",
        );
        return redirect(routes.login.href());
      }
    },

    async callback(context) {
      if (!provider) return redirect(routes.login.href());

      let profile: HackClubProfile;
      let returnTo: string | undefined;
      try {
        const finished = await finishExternalAuth(provider, context);
        profile = finished.result.profile;
        returnTo = safeReturnTo(finished.returnTo);
      } catch (error) {
        console.error("Failed to finish Hack Club Auth login:", error);
        context.session.flash("loginError", "Signing in with Hack Club didn’t finish. Try again.");
        return redirect(routes.login.href());
      }

      // Only trust an email Hack Club Auth has verified
      const user: SessionUser = {
        sub: profile.sub,
        name: profile.name ?? profile.nickname ?? "Hack Clubber",
        slackId: profile.slack_id ?? null,
        email: profile.email_verified ? (profile.email?.toLowerCase() ?? null) : null,
      };

      const member = await findStaff({ slackId: user.slackId, email: user.email });
      if (!member) {
        const who = [user.slackId, user.email].filter(Boolean).join(" / ") || "your account";
        context.session.flash(
          "loginError",
          `You’re signed in to Hack Club as ${user.name} (${who}), but that account isn’t on the hack.af access list.`,
        );
        return redirect(routes.login.href());
      }

      const session = completeAuth(context);
      session.set("user", user);
      return redirect(returnTo ?? routes.links.index.href());
    },

    async dev(context) {
      if (!devLoginEnabled) return new Response("Not found", { status: 404 });

      const slackId = String(context.formData.get("slackId") ?? "").trim();
      const returnTo = safeReturnTo(String(context.formData.get("returnTo") ?? ""));
      const member = await findStaff({ slackId, email: null });
      if (!member) {
        context.session.flash("loginError", `${slackId || "That ID"} isn’t on the access list.`);
        return redirect(routes.login.href());
      }

      const session = completeAuth(context);
      session.set("user", {
        sub: `dev:${slackId}`,
        name: member.id === 0 ? slackId : member.name,
        slackId,
        email: member.email,
      } satisfies SessionUser);
      return redirect(returnTo ?? routes.links.index.href());
    },

    logout(context) {
      context.session.unset("user");
      context.session.regenerateId(true);
      return redirect(routes.login.href());
    },
  },
});
