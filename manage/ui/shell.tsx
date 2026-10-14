import { css, type Handle, type RemixNode } from "remix/component";
import { SHORT_DOMAIN } from "../../src/links.ts";
import type { Viewer } from "../middleware/auth.ts";
import type { Toast } from "../middleware/session.ts";
import { routes } from "../routes.ts";
import { Document } from "./document.tsx";
import { Avatar } from "./public/avatar.tsx";
import { CommandPalette } from "./public/command-palette.tsx";
import { Icon, Logo, type IconName } from "./public/icons.tsx";
import { Toaster } from "./public/toaster.tsx";

export type Section = "links" | "activity" | "access";

export type ShellProps = {
  title: string;
  section: Section;
  viewer: Viewer;
  toast?: (Toast & { id: string }) | null;
  children?: RemixNode;
};

const layoutStyle = css({
  display: "grid",
  gridTemplateColumns: "var(--sidebar-width) minmax(0, 1fr)",
  minHeight: "100dvh",
  // Paint the sidebar column the full height of long pages, not just the sticky viewport
  background:
    "linear-gradient(to right, var(--sidebar) calc(var(--sidebar-width) - 1px), var(--border-subtle) 0 var(--sidebar-width), transparent 0)",
  "@media (max-width: 860px)": { gridTemplateColumns: "minmax(0, 1fr)", background: "none" },
});

const sidebarStyle = css({
  position: "sticky",
  top: 0,
  height: "100dvh",
  display: "flex",
  flexDirection: "column",
  gap: "16px",
  padding: "14px 12px",
  background: "var(--sidebar)",
  borderRight: "1px solid var(--border-subtle)",
  "@media (max-width: 860px)": {
    zIndex: 10,
    height: "auto",
    flexDirection: "row",
    alignItems: "center",
    gap: "8px",
    padding: "8px 12px",
    borderRight: 0,
    borderBottom: "1px solid var(--border-subtle)",
    background: "color-mix(in srgb, var(--sidebar) 88%, transparent)",
    backdropFilter: "saturate(1.4) blur(12px)",
  },
});

const brandStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "10px",
  padding: "4px 6px",
  borderRadius: "var(--radius)",
  "& .name": { fontWeight: 600, fontSize: "var(--text-base)", letterSpacing: "-0.01em" },
  "& .scope": { color: "var(--text-tertiary)", fontSize: "var(--text-sm)" },
  "@media (max-width: 860px)": { "& .scope": { display: "none" } },
});

const navStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "2px",
  "@media (max-width: 860px)": { flexDirection: "row", flex: 1, justifyContent: "center" },
});

const navItemStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "10px",
  height: "32px",
  padding: "0 10px",
  borderRadius: "var(--radius)",
  color: "var(--text-secondary)",
  fontSize: "var(--text-sm)",
  fontWeight: 500,
  transition: "background-color 120ms var(--ease-out), color 120ms var(--ease-out)",
  "&:hover": { background: "var(--surface-hover)", color: "var(--text)" },
  "&[aria-current='page']": {
    background: "var(--surface)",
    color: "var(--text)",
    boxShadow: "var(--shadow-sm), inset 0 0 0 1px var(--border)",
  },
  "&[aria-current='page'] svg": { color: "var(--accent-text)" },
  "@media (max-width: 860px)": { "& .label": { display: "none" }, padding: "0 9px" },
});

const userStyle = css({
  marginTop: "auto",
  display: "flex",
  alignItems: "center",
  gap: "10px",
  padding: "8px 6px 2px",
  borderTop: "1px solid var(--border-subtle)",
  "& .who": { flex: 1, minWidth: 0, lineHeight: 1.3 },
  "& .who strong": {
    display: "block",
    fontSize: "var(--text-sm)",
    fontWeight: 500,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  "& .who span": {
    display: "block",
    fontSize: "var(--text-xs)",
    color: "var(--text-tertiary)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontFamily: "var(--font-mono)",
  },
  "@media (max-width: 860px)": {
    marginTop: 0,
    padding: 0,
    borderTop: 0,
    "& .who": { display: "none" },
  },
});

const signOutStyle = css({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "28px",
  height: "28px",
  border: 0,
  borderRadius: "7px",
  background: "transparent",
  color: "var(--text-tertiary)",
  cursor: "pointer",
  "&:hover": { background: "var(--surface-hover)", color: "var(--text)" },
});

const mainStyle = css({
  minWidth: 0,
  paddingBottom: "64px",
});

const NAV: { section: Section; label: string; icon: IconName; href: string }[] = [
  { section: "links", label: "Links", icon: "link", href: routes.links.index.href() },
  { section: "activity", label: "Activity", icon: "history", href: routes.activity.href() },
  { section: "access", label: "Access", icon: "shield", href: routes.access.index.href() },
];

export function Shell(handle: Handle<ShellProps>) {
  return () => {
    const { title, section, viewer, toast, children } = handle.props;
    return (
      <Document title={title} theme={viewer.theme}>
        <div mix={layoutStyle}>
          <aside mix={sidebarStyle}>
            <a href={routes.links.index.href()} mix={brandStyle} aria-label="hack.af links">
              <Logo size={26} />
              <span>
                <span class="name">hack.af</span> <span class="scope">manage</span>
              </span>
            </a>
            <CommandPalette
              searchHref={routes.api.search.href()}
              linkHref={routes.links.show.index.href({ slug: "__SLUG__" })}
              shortDomain={SHORT_DOMAIN}
              theme={viewer.theme}
              actions={[
                { label: "Create a link", icon: "plus", href: `${routes.links.index.href()}#new` },
                ...NAV.map(({ label, icon, href }) => ({ label: `Go to ${label}`, icon, href })),
              ]}
            />
            <nav aria-label="Main" mix={navStyle}>
              {NAV.map((item) => (
                <a
                  key={item.section}
                  href={item.href}
                  mix={navItemStyle}
                  aria-current={item.section === section ? "page" : undefined}
                >
                  <Icon name={item.icon} size={16} />
                  <span class="label">{item.label}</span>
                </a>
              ))}
            </nav>
            <div mix={userStyle}>
              <Avatar
                name={viewer.name}
                id={viewer.slackId ?? viewer.email}
                image={viewer.image}
                size={28}
              />
              <div class="who">
                <strong>{viewer.name}</strong>
                <span>{viewer.slackId ?? viewer.email}</span>
              </div>
              <form method="post" action={routes.auth.logout.href()}>
                <button type="submit" mix={signOutStyle} aria-label="Sign out" title="Sign out">
                  <Icon name="logOut" size={15} />
                </button>
              </form>
            </div>
          </aside>
          <main mix={mainStyle}>{children}</main>
        </div>
        {toast ? (
          <Toaster key={toast.id} toast={{ kind: toast.kind, message: toast.message }} />
        ) : null}
      </Document>
    );
  };
}

const headerStyle = css({
  display: "flex",
  flexWrap: "wrap",
  alignItems: "flex-end",
  justifyContent: "space-between",
  gap: "16px",
  padding: "32px 32px 20px",
  maxWidth: "1180px",
  margin: "0 auto",
  "& h1": { fontSize: "var(--text-xl)", fontWeight: 600, lineHeight: 1.2 },
  "& p": { marginTop: "6px", color: "var(--text-secondary)", fontSize: "var(--text-sm)" },
  "@media (max-width: 860px)": { padding: "20px 16px 16px" },
});

export function PageHeader(
  handle: Handle<{
    title: RemixNode;
    description?: RemixNode;
    actions?: RemixNode;
    above?: RemixNode;
  }>,
) {
  return () => {
    const { title, description, actions, above } = handle.props;
    return (
      <header mix={headerStyle}>
        <div style={{ minWidth: 0, flex: "1 1 auto" }}>
          {above}
          <h1>{title}</h1>
          {description ? <p>{description}</p> : null}
        </div>
        {actions ? (
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>{actions}</div>
        ) : null}
      </header>
    );
  };
}

export const pageBody = css({
  maxWidth: "1180px",
  margin: "0 auto",
  padding: "0 32px",
  "@media (max-width: 860px)": { padding: "0 16px" },
});
