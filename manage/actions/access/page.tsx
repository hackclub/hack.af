import { css, type Handle } from "remix/component";
import type { Person } from "../../../src/people.ts";
import type { StaffAuditEntry, StaffMember } from "../../../src/staff.ts";
import type { Viewer } from "../../middleware/auth.ts";
import { routes } from "../../routes.ts";
import { Avatar } from "../../ui/public/avatar.tsx";
import { ConfirmDialog } from "../../ui/public/confirm-dialog.tsx";
import { formatDateTime, formatNumber, relativeTime } from "../../ui/public/format.ts";
import { Icon } from "../../ui/public/icons.tsx";
import { fieldError, input, label, panel } from "../../ui/public/styles.ts";
import { SubmitButton } from "../../ui/public/submit-button.tsx";
import { PageHeader, Shell, pageBody, type ShellProps } from "../../ui/shell.tsx";

export type AccessPageProps = Omit<ShellProps, "title" | "section" | "children"> & {
  staff: StaffMember[];
  audit: StaffAuditEntry[];
  people: Record<string, Person>;
  values?: { name: string; slackId: string; email: string };
  error?: string;
};

const layoutStyle = css({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 320px",
  gap: "20px",
  alignItems: "start",
  "@media (max-width: 1040px)": { gridTemplateColumns: "minmax(0, 1fr)" },
});

const GRID = "minmax(0, 1.3fr) minmax(0, 1fr) minmax(0, 1.2fr) 120px 84px";

const headStyle = css({
  display: "grid",
  gridTemplateColumns: GRID,
  gap: "14px",
  padding: "10px 16px",
  borderBottom: "1px solid var(--border)",
  fontSize: "var(--text-xs)",
  fontWeight: 500,
  color: "var(--text-tertiary)",
  "@media (max-width: 760px)": { display: "none" },
});

const rowStyle = css({
  display: "grid",
  gridTemplateColumns: GRID,
  alignItems: "center",
  gap: "14px",
  minHeight: "52px",
  padding: "8px 16px",
  borderBottom: "1px solid var(--border-subtle)",
  fontSize: "var(--text-sm)",
  "&:last-child": { borderBottom: 0 },
  "& .person": { display: "flex", alignItems: "center", gap: "10px", minWidth: 0, fontWeight: 500 },
  "& .person span.name": { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  "& .mono": {
    fontFamily: "var(--font-mono)",
    fontSize: "var(--text-xs)",
    color: "var(--text-secondary)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  "& .muted": { color: "var(--text-tertiary)" },
  "& .added": {
    fontSize: "var(--text-xs)",
    color: "var(--text-tertiary)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  "& .act": {
    display: "flex",
    justifyContent: "flex-end",
    opacity: 0,
    transition: "opacity 120ms",
  },
  // Keep 80 remove buttons out of the way until you point at a row
  "&:hover .act, &:focus-within .act": { opacity: 1 },
  "@media (hover: none)": { "& .act": { opacity: 1 } },
  "@media (max-width: 760px)": {
    gridTemplateColumns: "minmax(0, 1fr) auto",
    gap: "2px 12px",
    padding: "10px 16px",
    "& .mono, & .added": { gridColumn: 1, paddingLeft: "36px" },
    "& .mono.muted": { display: "none" },
    "& .act": { gridColumn: 2, gridRow: "1 / span 3" },
  },
});

const badgeStyle = css({
  display: "inline-flex",
  alignItems: "center",
  gap: "4px",
  height: "20px",
  padding: "0 7px",
  borderRadius: "999px",
  fontSize: "11px",
  fontWeight: 500,
  whiteSpace: "nowrap",
  border: "1px solid var(--border)",
  color: "var(--text-secondary)",
  background: "var(--bg-subtle)",
  "&[data-tone='accent']": {
    color: "var(--accent-text)",
    background: "var(--accent-soft)",
    borderColor: "transparent",
  },
});

const sideColumn = css({
  display: "grid",
  gap: "20px",
  // On narrow screens, adding someone shouldn't mean scrolling past everyone
  "@media (max-width: 1040px)": { order: -1 },
});

const sideCard = css({
  "& > header": { padding: "14px 16px 0" },
  "& > header h2": { fontSize: "var(--text-base)", fontWeight: 600 },
  "& > header p": {
    marginTop: "4px",
    fontSize: "var(--text-xs)",
    color: "var(--text-tertiary)",
    lineHeight: 1.5,
  },
  "& > .body": { padding: "14px 16px 16px" },
});

const auditStyle = css({
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "grid",
  gap: "12px",
  fontSize: "var(--text-sm)",
  color: "var(--text-secondary)",
  "& li": { display: "grid", gridTemplateColumns: "16px minmax(0, 1fr)", gap: "10px" },
  "& strong": { color: "var(--text)", fontWeight: 500 },
  "& time": {
    display: "block",
    fontSize: "var(--text-xs)",
    color: "var(--text-tertiary)",
    marginTop: "2px",
  },
});

function isViewer(member: StaffMember, viewer: Viewer) {
  return (
    (member.slackId !== null && member.slackId === viewer.slackId) ||
    (member.email !== null && member.email === viewer.email)
  );
}

// People from the original allowlist have no meaningful "added" date
function addedLabel(member: StaffMember, people: Record<string, Person>) {
  if (member.addedBy === "migration" || !member.addedAt) return { text: "—", title: undefined };
  const addedBy = people[member.addedBy]?.name ?? member.addedBy;
  return {
    text: relativeTime(member.addedAt),
    title: `${formatDateTime(member.addedAt)} by ${addedBy}`,
  };
}

function StaffRow(
  handle: Handle<{
    member: StaffMember;
    viewer: Viewer;
    people: Record<string, Person>;
    action: string;
  }>,
) {
  return () => {
    const { member, viewer, people, action } = handle.props;
    const identity = member.slackId ?? member.email;
    const isYou = isViewer(member, viewer);
    const added = addedLabel(member, people);
    const removable = member.id !== 0 && !isYou && !member.bootstrap;

    return (
      <li mix={rowStyle}>
        <span class="person">
          <Avatar
            name={member.name}
            id={identity}
            image={people[identity ?? ""]?.image}
            size={26}
          />
          <span class="name">{member.name}</span>
          {isYou ? (
            <span mix={badgeStyle} data-tone="accent">
              You
            </span>
          ) : null}
          {member.bootstrap ? (
            <span mix={badgeStyle} title="Set in MANAGE_BOOTSTRAP_ADMINS. Always has access.">
              <Icon name="lock" size={10} />
              Break-glass
            </span>
          ) : null}
        </span>
        <IdentityCell value={member.slackId} />
        <IdentityCell value={member.email} />
        <span class="added" title={added.title}>
          {added.text}
        </span>
        <span class="act">
          {removable ? (
            <ConfirmDialog
              triggerLabel="Remove"
              triggerVariant="ghost"
              triggerSize="sm"
              title={`Remove ${member.name}?`}
              description="They’ll be signed out of the dashboard right away and lose the staff-only Slack commands. This is posted to the audit channel."
              confirmLabel="Remove access"
              action={action}
              fields={{ intent: "remove", id: String(member.id) }}
            />
          ) : null}
        </span>
      </li>
    );
  };
}

function IdentityCell(handle: Handle<{ value: string | null }>) {
  return () => (
    <span class={handle.props.value ? "mono" : "mono muted"}>{handle.props.value ?? "—"}</span>
  );
}

export function AccessPage(handle: Handle<AccessPageProps>) {
  return () => {
    const { staff, audit, people, values, error, viewer, toast } = handle.props;
    const action = routes.access.action.href();

    return (
      <Shell title="Access" section="access" viewer={viewer} toast={toast}>
        <PageHeader
          title="Access"
          description={`${formatNumber(staff.length)} people can sign in here and use the staff-only Slack commands.`}
        />
        <div mix={pageBody}>
          <div mix={layoutStyle}>
            <section mix={panel} aria-label="People with access" style={{ overflow: "clip" }}>
              <div mix={headStyle} aria-hidden="true">
                <span>Person</span>
                <span>Slack ID</span>
                <span>Email</span>
                <span>Added</span>
                <span />
              </div>
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {staff.map((member) => (
                  <StaffRow
                    key={`${member.id}:${member.slackId ?? member.email}`}
                    member={member}
                    viewer={viewer}
                    people={people}
                    action={action}
                  />
                ))}
              </ul>
            </section>

            <div mix={sideColumn}>
              <section mix={[panel, sideCard]} aria-label="Give someone access">
                <header>
                  <h2>Give someone access</h2>
                  <p>
                    A Slack ID covers the dashboard and the bot. An email works for Hack Club Auth
                    accounts without Slack.
                  </p>
                </header>
                <form
                  method="post"
                  action={action}
                  class="body"
                  style={{ display: "grid", gap: "12px" }}
                >
                  <input type="hidden" name="intent" value="add" />
                  <div>
                    <label for="staff-name" mix={label}>
                      Name
                    </label>
                    <input
                      id="staff-name"
                      name="name"
                      required
                      defaultValue={values?.name ?? ""}
                      placeholder="Their name"
                      autocomplete="off"
                      mix={input}
                    />
                  </div>
                  <div>
                    <label for="staff-slack" mix={label}>
                      Slack ID
                    </label>
                    <input
                      id="staff-slack"
                      name="slackId"
                      defaultValue={values?.slackId ?? ""}
                      placeholder="Starts with U"
                      autocomplete="off"
                      autocapitalize="characters"
                      spellcheck={false}
                      mix={input}
                      style={{ fontFamily: "var(--font-mono)" }}
                    />
                  </div>
                  <div>
                    <label for="staff-email" mix={label}>
                      Email{" "}
                      <span style={{ color: "var(--text-tertiary)", fontWeight: 400 }}>
                        (optional)
                      </span>
                    </label>
                    <input
                      id="staff-email"
                      name="email"
                      type="email"
                      defaultValue={values?.email ?? ""}
                      placeholder="name@hackclub.com"
                      autocomplete="off"
                      mix={input}
                    />
                  </div>
                  {error ? (
                    <p mix={fieldError} role="alert">
                      <Icon name="alert" size={14} />
                      {error}
                    </p>
                  ) : null}
                  <SubmitButton label="Give access" pendingLabel="Adding…" icon="userPlus" />
                </form>
              </section>

              <section mix={[panel, sideCard]} aria-label="Recent access changes">
                <header>
                  <h2>Recent changes</h2>
                </header>
                <div class="body">
                  {audit.length === 0 ? (
                    <p style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>
                      No changes since the list moved here.
                    </p>
                  ) : (
                    <ul mix={auditStyle}>
                      {audit.map((entry) => (
                        <li key={entry.id}>
                          <span
                            style={{
                              color: entry.action === "added" ? "var(--success)" : "var(--danger)",
                              display: "flex",
                              paddingTop: "2px",
                            }}
                          >
                            <Icon name={entry.action === "added" ? "userPlus" : "x"} size={14} />
                          </span>
                          <span>
                            <strong>{people[entry.actor]?.name ?? entry.actor}</strong>{" "}
                            {entry.action === "added" ? "added" : "removed"}{" "}
                            <strong>{entry.name}</strong>
                            <time
                              datetime={entry.at.toISOString()}
                              title={formatDateTime(entry.at)}
                            >
                              {relativeTime(entry.at)}
                            </time>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>
            </div>
          </div>
        </div>
      </Shell>
    );
  };
}
