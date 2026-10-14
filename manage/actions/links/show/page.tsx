import { css, type Handle, type RemixNode } from "remix/component";
import type { Person } from "../../../../src/people.ts";
import {
  SHORT_DOMAIN,
  type ClickSeries,
  type HistoryEntry,
  type Link,
} from "../../../../src/links.ts";
import { routes } from "../../../routes.ts";
import { ClickChart } from "../../../ui/click-chart.tsx";
import { ChangeRow, changeList } from "../../../ui/history.tsx";
import { ConfirmDialog } from "../../../ui/public/confirm-dialog.tsx";
import { CopyButton } from "../../../ui/public/copy-button.tsx";
import { LinkSwitcher } from "../../../ui/public/link-switcher.tsx";
import {
  formatDate,
  formatDateTime,
  formatNumber,
  relativeTime,
} from "../../../ui/public/format.ts";
import { Icon } from "../../../ui/public/icons.tsx";
import { button, fieldError, input, panel } from "../../../ui/public/styles.ts";
import { SubmitButton } from "../../../ui/public/submit-button.tsx";
import { QrDialog } from "../../../ui/public/qr-dialog.tsx";
import { QrCode, qrMatrix } from "../../../ui/qr.tsx";
import { PageHeader, Shell, pageBody, type ShellProps } from "../../../ui/shell.tsx";

export type LinkPageProps = Omit<ShellProps, "title" | "section" | "children"> & {
  slug: string;
  link: Link | null;
  history: HistoryEntry[];
  recent: { slug: string; destination: string }[];
  people: Record<string, Person>;
  clicks: ClickSeries | null;
  range: number;
  values?: { destination?: string };
  errors?: { destination?: string; form?: string };
};

const RANGES = [7, 30, 90];

const crumbStyle = css({
  display: "inline-flex",
  alignItems: "center",
  gap: "4px",
  marginBottom: "10px",
  fontSize: "var(--text-sm)",
  color: "var(--text-tertiary)",
  "& a:hover": { color: "var(--text)" },
});

const titleStyle = css({
  fontFamily: "var(--font-mono)",
  fontWeight: 500,
  letterSpacing: "-0.03em",
  "& .domain": { color: "var(--text-tertiary)" },
});

const layoutStyle = css({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 300px",
  gap: "20px",
  alignItems: "start",
  "@media (max-width: 1040px)": { gridTemplateColumns: "minmax(0, 1fr)" },
});

const cardStyle = css({
  "& > header": {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    minHeight: "48px",
    padding: "12px 16px",
    borderBottom: "1px solid var(--border-subtle)",
  },
  "& > header h2": { fontSize: "var(--text-base)", fontWeight: 600 },
  "& > .body": { padding: "16px" },
});

const metaStyle = css({
  display: "flex",
  flexWrap: "wrap",
  gap: "6px 18px",
  marginBottom: "18px",
  fontSize: "var(--text-sm)",
  color: "var(--text-secondary)",
  "& strong": { color: "var(--text)", fontWeight: 600, fontVariantNumeric: "tabular-nums" },
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
    height: "22px",
    padding: "0 8px",
    borderRadius: "5px",
    fontSize: "var(--text-xs)",
    fontWeight: 500,
    color: "var(--text-tertiary)",
  },
  "& a:hover": { color: "var(--text)" },
  "& a[aria-current='true']": {
    background: "var(--surface-raised)",
    color: "var(--text)",
    boxShadow: "var(--shadow-sm), inset 0 0 0 1px var(--border)",
  },
});

const detailsStyle = css({
  display: "grid",
  gridTemplateColumns: "auto minmax(0, 1fr)",
  gap: "10px 16px",
  margin: 0,
  fontSize: "var(--text-sm)",
  "& dt": { color: "var(--text-tertiary)" },
  "& dd": {
    margin: 0,
    textAlign: "right",
    color: "var(--text-secondary)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
});

function Card(
  handle: Handle<{ title: string; actions?: RemixNode; children?: RemixNode; flush?: boolean }>,
) {
  return () => {
    const { title, actions, children, flush } = handle.props;
    return (
      <section mix={[panel, cardStyle]} aria-label={title}>
        <header>
          <h2>{title}</h2>
          {actions}
        </header>
        <div class={flush ? undefined : "body"}>{children}</div>
      </section>
    );
  };
}

export function LinkPage(handle: Handle<LinkPageProps>) {
  return () => {
    const {
      slug,
      link,
      history,
      recent,
      people,
      clicks,
      range,
      values,
      errors = {},
      viewer,
      toast,
    } = handle.props;
    const shortUrl = `https://${SHORT_DOMAIN}/${slug}`;
    const matrix = qrMatrix(shortUrl);
    const action = routes.links.show.action.href({ slug });

    // The title doubles as a switcher for jumping between links, like Dub's
    const title = (
      <span mix={titleStyle}>
        <LinkSwitcher
          current={{ slug, destination: link?.destination ?? null }}
          recent={recent}
          listHref={routes.api.links.href()}
          linkHref={routes.links.show.index.href({ slug: "__SLUG__" })}
          shortDomain={SHORT_DOMAIN}
        />
      </span>
    );
    const crumb = (
      <nav aria-label="Breadcrumb" mix={crumbStyle}>
        <a href={routes.links.index.href()}>Links</a>
        <Icon name="chevronRight" size={13} />
      </nav>
    );

    if (!link) {
      return (
        <Shell title={`${SHORT_DOMAIN}/${slug}`} section="links" viewer={viewer} toast={toast}>
          <PageHeader
            above={crumb}
            title={title}
            description="This link was deleted. Visitors are sent to the Hack Club 404 page."
          />
          <div mix={pageBody}>
            <div mix={layoutStyle}>
              <Card title="History" flush>
                <ul mix={changeList} style={{ padding: "0 16px" }}>
                  {history.map((entry) => (
                    <ChangeRow key={entry.id} entry={entry} people={people} showSlug={false} />
                  ))}
                </ul>
              </Card>
              <Card title="Restore">
                <p
                  style={{
                    fontSize: "var(--text-sm)",
                    color: "var(--text-secondary)",
                    marginBottom: "14px",
                  }}
                >
                  Bring the link back with the destination it had when it was deleted.
                </p>
                <form method="post" action={action}>
                  <input type="hidden" name="intent" value="restore" />
                  <SubmitButton label="Restore link" pendingLabel="Restoring…" icon="restore" />
                </form>
                {errors.form ? <p mix={fieldError}>{errors.form}</p> : null}
              </Card>
            </div>
          </div>
        </Shell>
      );
    }

    return (
      <Shell title={`${SHORT_DOMAIN}/${slug}`} section="links" viewer={viewer} toast={toast}>
        <PageHeader
          above={crumb}
          title={title}
          actions={
            <>
              <CopyButton value={shortUrl} label="Copy link" shortcut="c" />
              <a
                href={shortUrl}
                target="_blank"
                rel="noreferrer"
                mix={button.ghost}
                title="Open in a new tab"
              >
                <Icon name="arrowUpRight" size={14} />
                Open
              </a>
            </>
          }
        />
        <div mix={pageBody}>
          <div mix={layoutStyle}>
            <div style={{ display: "grid", gap: "20px", minWidth: 0 }}>
              <Card title="Destination">
                <form method="post" action={action}>
                  <input type="hidden" name="intent" value="destination" />
                  <div style={{ display: "flex", gap: "8px" }}>
                    <input
                      name="destination"
                      defaultValue={values?.destination ?? link.destination}
                      aria-label="Destination URL"
                      aria-invalid={errors.destination ? true : undefined}
                      aria-describedby={errors.destination ? "destination-error" : undefined}
                      autocomplete="off"
                      spellcheck={false}
                      required
                      mix={input}
                      style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-sm)" }}
                    />
                    <SubmitButton label="Save" pendingLabel="Saving…" />
                  </div>
                  {errors.destination ? (
                    <p mix={fieldError} id="destination-error">
                      <Icon name="alert" size={14} />
                      {errors.destination}
                    </p>
                  ) : null}
                </form>
              </Card>

              <Card
                title="Clicks"
                actions={
                  <nav aria-label="Date range" mix={segmentedStyle}>
                    {RANGES.map((days) => (
                      <a
                        key={days}
                        href={routes.links.show.index.href(
                          { slug },
                          days === 30 ? undefined : { searchParams: { range: String(days) } },
                        )}
                        aria-current={days === range ? "true" : undefined}
                        data-rmx-reset-scroll="false"
                      >
                        {days}d
                      </a>
                    ))}
                  </nav>
                }
              >
                <div mix={metaStyle}>
                  {clicks ? (
                    <span>
                      <strong>{formatNumber(clicks.total)}</strong> in the last {range} days
                    </span>
                  ) : null}
                  <span>
                    <strong>{formatNumber(link.clicks)}</strong> all time
                  </span>
                  {clicks?.lastClickAt ? (
                    <span title={formatDateTime(clicks.lastClickAt)}>
                      Last click {relativeTime(clicks.lastClickAt)}
                    </span>
                  ) : null}
                </div>
                {clicks ? (
                  <ClickChart series={clicks} />
                ) : (
                  <p style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>
                    Click history couldn’t be loaded.
                  </p>
                )}
              </Card>

              <Card title="History" flush>
                {history.length === 0 ? (
                  <p
                    style={{
                      padding: "16px",
                      fontSize: "var(--text-sm)",
                      color: "var(--text-tertiary)",
                    }}
                  >
                    No recorded changes. This link predates change history.
                  </p>
                ) : (
                  <ul mix={changeList} style={{ padding: "0 16px" }}>
                    {history.map((entry) => (
                      <ChangeRow key={entry.id} entry={entry} people={people} showSlug={false} />
                    ))}
                  </ul>
                )}
              </Card>
            </div>

            <div style={{ display: "grid", gap: "20px", minWidth: 0 }}>
              <Card
                title="QR code"
                actions={
                  <QrDialog
                    matrix={matrix}
                    label={`${SHORT_DOMAIN}/${slug}`}
                    filename={`${SHORT_DOMAIN}-${slug}`.replace(/[^a-z0-9._-]+/gi, "-")}
                  />
                }
              >
                <div
                  style={{
                    maxWidth: "260px",
                    margin: "0 auto",
                    padding: "10px",
                    borderRadius: "12px",
                    background: "#fff",
                    border: "1px solid var(--border)",
                  }}
                >
                  <QrCode matrix={matrix} label={`QR code for ${SHORT_DOMAIN}/${slug}`} />
                </div>
              </Card>

              <Card title="Details">
                <dl mix={detailsStyle}>
                  <dt>Created</dt>
                  <dd title={link.createdAt ? formatDateTime(link.createdAt) : undefined}>
                    {link.createdAt ? formatDate(link.createdAt) : "Before history"}
                  </dd>
                  {link.createdBy ? (
                    <>
                      <dt>Created by</dt>
                      <dd>{people[link.createdBy]?.name ?? link.createdBy}</dd>
                    </>
                  ) : null}
                  <dt>Record ID</dt>
                  <dd style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)" }}>
                    {link.recordId}
                  </dd>
                </dl>
                <div
                  style={{
                    marginTop: "16px",
                    paddingTop: "16px",
                    borderTop: "1px solid var(--border-subtle)",
                  }}
                >
                  <ConfirmDialog
                    triggerLabel="Delete link"
                    triggerIcon="trash"
                    triggerSize="sm"
                    title={`Delete ${SHORT_DOMAIN}/${slug}?`}
                    description="Anyone who visits it will land on the Hack Club 404 page. You can restore it later from its history."
                    confirmLabel="Delete link"
                    action={action}
                    fields={{ intent: "delete" }}
                    confirmText={slug}
                  />
                </div>
              </Card>
            </div>
          </div>
        </div>
      </Shell>
    );
  };
}
