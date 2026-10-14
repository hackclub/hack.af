import { css, type Handle } from "remix/component";
import type { Person } from "../../../src/people.ts";
import type { HistoryEntry } from "../../../src/links.ts";
import { routes } from "../../routes.ts";
import { ChangeRow, changeList } from "../../ui/history.tsx";
import { FilterSelect } from "../../ui/public/filter-select.tsx";
import { dayKey } from "../../ui/public/format.ts";
import { Icon } from "../../ui/public/icons.tsx";
import { button, buttonSize, panel } from "../../ui/public/styles.ts";
import { PageHeader, Shell, pageBody, type ShellProps } from "../../ui/shell.tsx";

export type ActivityPageProps = Omit<ShellProps, "title" | "section" | "children"> & {
  entries: HistoryEntry[];
  people: Record<string, Person>;
  actors: string[];
  filters: { actor: string; action: string };
  nextCursor: string | null;
};

const ACTIONS = [
  { value: "", label: "All changes" },
  { value: "Created", label: "Created" },
  { value: "Updated", label: "Changed" },
  { value: "Deleted", label: "Deleted" },
  { value: "Restored", label: "Restored" },
];

const filtersStyle = css({
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "8px",
  marginBottom: "16px",
});

const dayStyle = css({
  padding: "4px 20px 4px",
  "& + &": { borderTop: "1px solid var(--border)" },
  "& h2": {
    position: "sticky",
    top: 0,
    padding: "14px 0 4px",
    fontSize: "var(--text-xs)",
    fontWeight: 500,
    color: "var(--text-tertiary)",
    background: "var(--surface)",
  },
});

function dayLabel(key: string) {
  const today = dayKey(new Date());
  const yesterday = dayKey(new Date(Date.now() - 86_400_000));
  if (key === today) return "Today";
  if (key === yesterday) return "Yesterday";
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day!, 12));
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: year === new Date().getFullYear() ? undefined : "numeric",
    timeZone: "UTC",
  });
}

export function ActivityPage(handle: Handle<ActivityPageProps>) {
  return () => {
    const { entries, people, actors, filters, nextCursor, viewer, toast } = handle.props;

    const days = new Map<string, HistoryEntry[]>();
    for (const entry of entries) {
      const key = dayKey(entry.at);
      days.set(key, [...(days.get(key) ?? []), entry]);
    }

    const actorOptions = [
      { value: "", label: "Everyone" },
      ...actors.map((actor) => ({ value: actor, label: people[actor]?.name ?? actor })),
    ];
    const filtered = Boolean(filters.actor || filters.action);
    const nextHref = nextCursor
      ? routes.activity.href(undefined, {
          searchParams: {
            ...(filters.actor ? { actor: filters.actor } : {}),
            ...(filters.action ? { action: filters.action } : {}),
            before: nextCursor,
          },
        })
      : null;

    return (
      <Shell title="Activity" section="activity" viewer={viewer} toast={toast}>
        <PageHeader title="Activity" />
        <div mix={pageBody}>
          <form method="get" action={routes.activity.href()} mix={filtersStyle}>
            <FilterSelect
              name="actor"
              label="Changed by"
              value={filters.actor}
              options={actorOptions}
            />
            <FilterSelect
              name="action"
              label="Type of change"
              value={filters.action}
              options={ACTIONS}
            />
            <noscript>
              <button type="submit" mix={button.secondary}>
                Apply
              </button>
            </noscript>
            {filtered ? (
              <a href={routes.activity.href()} mix={[button.ghost, buttonSize.sm]}>
                <Icon name="x" size={13} />
                Clear filters
              </a>
            ) : null}
          </form>

          {entries.length === 0 ? (
            <div mix={panel} style={{ padding: "48px 24px", textAlign: "center" }}>
              <p style={{ fontWeight: 500 }}>
                {filtered ? "No changes match these filters" : "No changes yet"}
              </p>
              <p
                style={{
                  marginTop: "6px",
                  color: "var(--text-secondary)",
                  fontSize: "var(--text-sm)",
                }}
              >
                {filtered
                  ? "Try someone else, or a different kind of change."
                  : "Creating, editing or deleting a link shows up here."}
              </p>
            </div>
          ) : (
            <div mix={panel} style={{ overflow: "clip" }}>
              {[...days].map(([key, dayEntries]) => (
                <section key={key} mix={dayStyle} aria-label={dayLabel(key)}>
                  <h2>{dayLabel(key)}</h2>
                  <ul mix={changeList}>
                    {dayEntries.map((entry) => (
                      <ChangeRow key={entry.id} entry={entry} people={people} timeStyle="clock" />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}

          {nextHref ? (
            <div style={{ display: "flex", justifyContent: "center", marginTop: "16px" }}>
              <a href={nextHref} mix={button.secondary}>
                Older changes
                <Icon name="chevronRight" size={14} />
              </a>
            </div>
          ) : null}
        </div>
      </Shell>
    );
  };
}
