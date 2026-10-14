import { css, type Handle } from "remix/component";
import type { Person } from "../../../src/people.ts";
import { SHORT_DOMAIN, type LinkSort, type LinkSummary } from "../../../src/links.ts";
import { routes } from "../../routes.ts";
import { Avatar } from "../../ui/public/avatar.tsx";
import { Favicon } from "../../ui/public/favicon.tsx";
import {
  formatCompact,
  formatDateTime,
  formatNumber,
  relativeTime,
  splitUrl,
} from "../../ui/public/format.ts";
import { Icon } from "../../ui/public/icons.tsx";
import { LinkComposer } from "../../ui/public/link-composer.tsx";
import { SearchBox } from "../../ui/public/search-box.tsx";
import { button, buttonSize, panel } from "../../ui/public/styles.ts";
import { PageHeader, Shell, pageBody, type ShellProps } from "../../ui/shell.tsx";

export type LinksPageProps = Omit<ShellProps, "title" | "section" | "children"> & {
  links: LinkSummary[];
  total: number;
  totals: { links: number; clicks: number };
  q: string;
  sort: LinkSort;
  page: number;
  perPage: number;
  people: Record<string, Person>;
  composer: {
    values?: { slug: string; destination: string };
    errors?: { slug?: string; destination?: string; form?: string };
  };
};

const SORTS: { value: LinkSort; label: string }[] = [
  { value: "recent", label: "Recent" },
  { value: "clicks", label: "Most clicked" },
  { value: "slug", label: "A–Z" },
];

const toolbarStyle = css({
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  margin: "28px 0 12px",
});

const segmentedStyle = css({
  display: "inline-flex",
  padding: "2px",
  gap: "2px",
  borderRadius: "var(--radius)",
  background: "var(--bg-subtle)",
  border: "1px solid var(--border-subtle)",
  "& a": {
    display: "inline-flex",
    alignItems: "center",
    height: "26px",
    padding: "0 10px",
    borderRadius: "6px",
    fontSize: "var(--text-sm)",
    fontWeight: 500,
    color: "var(--text-tertiary)",
    transition: "color 120ms, background-color 120ms",
  },
  "& a:hover": { color: "var(--text)" },
  "& a[aria-current='true']": {
    background: "var(--surface-raised)",
    color: "var(--text)",
    boxShadow: "var(--shadow-sm), inset 0 0 0 1px var(--border)",
  },
});

const GRID = "minmax(160px, 1fr) minmax(0, 1.9fr) 88px 148px 20px";

const headRowStyle = css({
  display: "grid",
  gridTemplateColumns: GRID,
  gap: "16px",
  padding: "10px 16px",
  borderBottom: "1px solid var(--border)",
  fontSize: "var(--text-xs)",
  fontWeight: 500,
  color: "var(--text-tertiary)",
  "& .num": { textAlign: "right" },
  "@media (max-width: 860px)": { display: "none" },
});

const listStyle = css({ listStyle: "none", margin: 0, padding: 0 });

const rowStyle = css({
  display: "grid",
  gridTemplateColumns: GRID,
  alignItems: "center",
  gap: "16px",
  minHeight: "48px",
  padding: "8px 16px",
  fontSize: "var(--text-sm)",
  borderBottom: "1px solid var(--border-subtle)",
  transition: "background-color 100ms",
  "li:last-child > &": { borderBottom: 0 },
  "&:hover": { background: "var(--surface-hover)" },
  "&:hover .chev": { opacity: 1, transform: "translateX(0)" },
  "&:focus-visible": {
    outline: "none",
    background: "var(--surface-hover)",
    boxShadow: "inset 2px 0 0 var(--accent)",
  },
  "& .slug": {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    minWidth: 0,
    fontFamily: "var(--font-mono)",
    fontSize: "var(--text-sm)",
  },
  "& .slug .text": { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  "& .domain": { color: "var(--text-tertiary)" },
  "& .dest": {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color: "var(--text-tertiary)",
  },
  "& .dest .host": { color: "var(--text-secondary)" },
  "& .num": {
    textAlign: "right",
    fontVariantNumeric: "tabular-nums",
    color: "var(--text-secondary)",
  },
  "& .when": {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    color: "var(--text-tertiary)",
    fontSize: "var(--text-xs)",
    whiteSpace: "nowrap",
    minWidth: 0,
  },
  "& .chev": {
    color: "var(--text-tertiary)",
    opacity: 0,
    transform: "translateX(-4px)",
    transition: "opacity 120ms, transform 120ms var(--ease-out)",
  },
  "@media (max-width: 860px)": {
    gridTemplateColumns: "minmax(0, 1fr) auto",
    gap: "4px 12px",
    "& .dest": { gridColumn: "1 / -1", gridRow: 2 },
    "& .when, & .chev": { display: "none" },
  },
});

const footerStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  padding: "10px 16px",
  borderTop: "1px solid var(--border)",
  fontSize: "var(--text-xs)",
  color: "var(--text-tertiary)",
  fontVariantNumeric: "tabular-nums",
});

const emptyStyle = css({
  display: "grid",
  justifyItems: "center",
  gap: "8px",
  padding: "56px 24px",
  textAlign: "center",
  "& .icon": {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "40px",
    height: "40px",
    borderRadius: "12px",
    border: "1px solid var(--border)",
    background: "var(--bg-subtle)",
    color: "var(--text-tertiary)",
    marginBottom: "6px",
  },
  "& p": { color: "var(--text-secondary)", fontSize: "var(--text-sm)", maxWidth: "42ch" },
});

function linksHref(params: { q?: string; sort?: LinkSort; page?: number }) {
  const searchParams: Record<string, string> = {};
  if (params.q) searchParams.q = params.q;
  if (params.sort && params.sort !== "recent") searchParams.sort = params.sort;
  if (params.page && params.page > 1) searchParams.page = String(params.page);
  return routes.links.index.href(undefined, { searchParams });
}

export function LinksPage(handle: Handle<LinksPageProps>) {
  return () => {
    const { links, total, totals, q, sort, page, perPage, people, composer, viewer, toast } =
      handle.props;
    const first = total === 0 ? 0 : (page - 1) * perPage + 1;
    const last = Math.min(page * perPage, total);

    return (
      <Shell title="Links" section="links" viewer={viewer} toast={toast}>
        <PageHeader
          title="Links"
          description={
            <>
              {formatNumber(totals.links)} links · {formatCompact(totals.clicks)} clicks all time
            </>
          }
        />
        <div mix={pageBody}>
          <div id="new">
            <LinkComposer
              action={routes.links.create.href()}
              checkHref={routes.api.slug.href()}
              linkHref={routes.links.show.index.href({ slug: "__SLUG__" })}
              shortDomain={SHORT_DOMAIN}
              values={composer.values}
              errors={composer.errors}
            />
          </div>

          <div mix={toolbarStyle}>
            <SearchBox action={routes.links.index.href()} q={q} sort={sort} />
            <nav aria-label="Sort links" mix={segmentedStyle}>
              {SORTS.map((option) => (
                <a
                  key={option.value}
                  href={linksHref({ q, sort: option.value })}
                  aria-current={option.value === sort ? "true" : undefined}
                  data-rmx-reset-scroll="false"
                >
                  {option.label}
                </a>
              ))}
            </nav>
          </div>

          <div mix={panel} style={{ overflow: "clip" }}>
            {links.length === 0 ? (
              <EmptyState q={q} />
            ) : (
              <>
                <div mix={headRowStyle} aria-hidden="true">
                  <span>Short link</span>
                  <span>Destination</span>
                  <span class="num">Clicks</span>
                  <span>Last change</span>
                  <span />
                </div>
                <ul mix={listStyle} aria-label="Links">
                  {links.map((link) => (
                    <li key={link.slug}>
                      <LinkRow link={link} people={people} />
                    </li>
                  ))}
                </ul>
                <div mix={footerStyle}>
                  <span>
                    {formatNumber(first)}–{formatNumber(last)} of {formatNumber(total)}
                    {q ? ` matching “${q}”` : " custom links · search to find random ones"}
                  </span>
                  <span style={{ display: "flex", gap: "6px" }}>
                    <PageLink
                      href={page > 1 ? linksHref({ q, sort, page: page - 1 }) : null}
                      label="Previous"
                      icon="chevronLeft"
                    />
                    <PageLink
                      href={last < total ? linksHref({ q, sort, page: page + 1 }) : null}
                      label="Next"
                      icon="chevronRight"
                    />
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </Shell>
    );
  };
}

function LinkRow(handle: Handle<{ link: LinkSummary; people: Record<string, Person> }>) {
  return () => {
    const { link, people } = handle.props;
    const { host, rest } = splitUrl(link.destination);
    const actorName = link.lastChangedBy
      ? (people[link.lastChangedBy]?.name ?? link.lastChangedBy)
      : null;

    return (
      <a
        href={routes.links.show.index.href({ slug: link.slug })}
        mix={rowStyle}
        aria-label={`${SHORT_DOMAIN}/${link.slug} goes to ${link.destination}`}
      >
        <span class="slug">
          <Favicon destination={link.destination} seed={link.slug} size={18} />
          <span class="text">
            <span class="domain">{SHORT_DOMAIN}/</span>
            <span>{link.slug}</span>
          </span>
        </span>
        <span class="dest" title={link.destination}>
          <span class="host">{host}</span>
          {rest}
        </span>
        <span class="num">{formatNumber(link.clicks)}</span>
        <span class="when">
          {link.lastChangedAt ? (
            <>
              {actorName ? (
                <Avatar
                  name={actorName}
                  id={link.lastChangedBy}
                  image={link.lastChangedBy ? people[link.lastChangedBy]?.image : null}
                  size={18}
                />
              ) : null}
              <time
                datetime={link.lastChangedAt.toISOString()}
                title={`${formatDateTime(link.lastChangedAt)}${actorName ? ` by ${actorName}` : ""}`}
              >
                {relativeTime(link.lastChangedAt)}
              </time>
            </>
          ) : (
            <span title="Changed before history was recorded">—</span>
          )}
        </span>
        <span class="chev">
          <Icon name="chevronRight" size={14} />
        </span>
      </a>
    );
  };
}

function PageLink(
  handle: Handle<{ href: string | null; label: string; icon: "chevronLeft" | "chevronRight" }>,
) {
  return () => {
    const { href, label, icon } = handle.props;
    if (!href) {
      return (
        <span mix={[button.secondary, buttonSize.iconSm]} aria-disabled="true" aria-label={label}>
          <Icon name={icon} size={14} />
        </span>
      );
    }
    return (
      <a href={href} mix={[button.secondary, buttonSize.iconSm]} aria-label={label} title={label}>
        <Icon name={icon} size={14} />
      </a>
    );
  };
}

function EmptyState(handle: Handle<{ q: string }>) {
  return () => {
    const { q } = handle.props;
    if (q) {
      return (
        <div mix={emptyStyle}>
          <span class="icon">
            <Icon name="search" size={18} />
          </span>
          <strong style={{ fontWeight: 500 }}>No links match “{q}”</strong>
          <p>Search looks at slugs and destination URLs.</p>
          {!/[\s?#%\\]/.test(q) ? (
            <a
              href={routes.links.index.href(undefined, { searchParams: { slug: q } }) + "#new"}
              mix={[button.secondary, buttonSize.sm]}
              style={{ marginTop: "8px" }}
            >
              <Icon name="plus" size={13} />
              Create {SHORT_DOMAIN}/{q}
            </a>
          ) : null}
        </div>
      );
    }
    return (
      <div mix={emptyStyle}>
        <span class="icon">
          <Icon name="link" size={18} />
        </span>
        <strong style={{ fontWeight: 500 }}>No links yet</strong>
        <p>
          Use the bar above to create the first one. Leave the slug blank and you’ll get a random
          one.
        </p>
      </div>
    );
  };
}
