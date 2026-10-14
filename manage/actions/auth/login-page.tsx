import { css, type Handle } from "remix/component";
import { routes } from "../../routes.ts";
import { Document } from "../../ui/document.tsx";
import { Icon, Logo } from "../../ui/public/icons.tsx";
import { button, buttonSize, input, label } from "../../ui/public/styles.ts";
import type { Theme } from "../../ui/public/theme.ts";

export type LoginPageProps = {
  returnTo?: string;
  error?: string;
  hackClubAuthEnabled: boolean;
  devLogin?: { slackId: string } | null;
  theme: Theme;
};

const pageStyle = css({
  position: "relative",
  display: "grid",
  placeItems: "center",
  minHeight: "100dvh",
  padding: "24px",
  overflow: "hidden",
  "&::before": {
    content: '""',
    position: "absolute",
    inset: 0,
    background:
      "radial-gradient(60% 45% at 50% 0%, light-dark(rgb(255 140 55 / 0.16), rgb(255 140 55 / 0.12)), transparent 70%), radial-gradient(40% 35% at 70% 10%, light-dark(rgb(236 55 80 / 0.12), rgb(236 55 80 / 0.14)), transparent 70%)",
    pointerEvents: "none",
  },
  "&::after": {
    content: '""',
    position: "absolute",
    inset: 0,
    backgroundImage:
      "radial-gradient(light-dark(rgb(20 25 35 / 0.09), rgb(255 255 255 / 0.06)) 1px, transparent 1px)",
    backgroundSize: "22px 22px",
    maskImage: "radial-gradient(70% 55% at 50% 30%, black, transparent)",
    pointerEvents: "none",
  },
});

const cardStyle = css({
  position: "relative",
  zIndex: 1,
  width: "min(380px, 100%)",
  padding: "32px 28px 24px",
  borderRadius: "var(--radius-xl)",
  border: "1px solid var(--border)",
  background: "color-mix(in srgb, var(--surface-raised) 92%, transparent)",
  backdropFilter: "blur(8px)",
  boxShadow: "var(--shadow-lg)",
  animation: "enter-up 320ms var(--ease-out)",
  "& h1": { marginTop: "20px", fontSize: "var(--text-lg)", fontWeight: 600 },
  "& .lede": {
    marginTop: "6px",
    color: "var(--text-secondary)",
    fontSize: "var(--text-sm)",
    lineHeight: 1.55,
  },
});

const errorStyle = css({
  display: "flex",
  gap: "10px",
  marginTop: "20px",
  padding: "10px 12px",
  borderRadius: "var(--radius)",
  border: "1px solid rgb(236 55 80 / 0.25)",
  background: "var(--danger-soft)",
  color: "var(--danger)",
  fontSize: "var(--text-sm)",
  lineHeight: 1.5,
  "& svg": { marginTop: "2px" },
});

const dividerStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "10px",
  margin: "20px 0 14px",
  color: "var(--text-tertiary)",
  fontSize: "var(--text-xs)",
  "&::before, &::after": { content: '""', flex: 1, height: "1px", background: "var(--border)" },
});

export function LoginPage(handle: Handle<LoginPageProps>) {
  return () => {
    const { returnTo, error, hackClubAuthEnabled, devLogin, theme } = handle.props;
    const startHref = routes.auth.start.href(
      undefined,
      returnTo ? { searchParams: { returnTo } } : undefined,
    );

    return (
      <Document title="Sign in" theme={theme}>
        <main mix={pageStyle}>
          <div mix={cardStyle}>
            <Logo size={40} />
            <h1>Sign in to hack.af</h1>
            <p class="lede">
              Manage Hack Club’s short links. Only people on the access list can sign in.
            </p>

            {error ? (
              <div mix={errorStyle} role="alert">
                <Icon name="alert" size={15} />
                <span>{error}</span>
              </div>
            ) : null}

            <div style={{ marginTop: "24px" }}>
              {hackClubAuthEnabled ? (
                <a
                  href={startHref}
                  mix={[button.primary, buttonSize.lg]}
                  style={{ width: "100%", height: "40px" }}
                >
                  Continue with Hack Club
                  <Icon name="arrowRight" size={15} />
                </a>
              ) : (
                <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
                  Hack Club Auth isn’t configured. Set <code>HCA_CLIENT_ID</code> and{" "}
                  <code>HCA_CLIENT_SECRET</code>.
                </p>
              )}
            </div>

            {devLogin ? (
              <form method="post" action={routes.auth.dev.href()}>
                <div mix={dividerStyle}>Local development</div>
                <input type="hidden" name="returnTo" value={returnTo ?? ""} />
                <label for="dev-slack-id" mix={label}>
                  Sign in as Slack ID
                </label>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    id="dev-slack-id"
                    name="slackId"
                    defaultValue={devLogin.slackId}
                    mix={input}
                    style={{ fontFamily: "var(--font-mono)" }}
                  />
                  <button type="submit" mix={button.secondary} style={{ height: "34px" }}>
                    Sign in
                  </button>
                </div>
              </form>
            ) : null}

            <p
              style={{
                marginTop: "24px",
                fontSize: "var(--text-xs)",
                color: "var(--text-tertiary)",
                lineHeight: 1.55,
              }}
            >
              Not on the list? Ask someone who is to add you from the Access page.
            </p>
          </div>
        </main>
      </Document>
    );
  };
}
