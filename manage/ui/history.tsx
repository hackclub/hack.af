import { css, type Handle } from "remix/component";
import type { Person } from "../../src/people.ts";
import { SHORT_DOMAIN, type HistoryEntry } from "../../src/links.ts";
import { routes } from "../routes.ts";
import { Avatar } from "./public/avatar.tsx";
import { formatDateTime, formatTime, relativeTime } from "./public/format.ts";

const ACTION_VERBS: Record<string, string> = {
  Created: "created",
  Updated: "changed",
  Deleted: "deleted",
  Restored: "restored",
  Used: "exported visitor data for",
};

const ACTION_COLORS: Record<string, string> = {
  Created: "var(--success)",
  Updated: "var(--blue)",
  Deleted: "var(--danger)",
  Restored: "var(--success)",
  Used: "var(--warning)",
};

const rowStyle = css({
  position: "relative",
  display: "grid",
  gridTemplateColumns: "28px minmax(0, 1fr) auto",
  gap: "12px",
  padding: "12px 0",
  "& + &": { borderTop: "1px solid var(--border-subtle)" },
  "& .line": { fontSize: "var(--text-sm)", color: "var(--text-secondary)", lineHeight: 1.5 },
  "& .line strong": { color: "var(--text)", fontWeight: 500 },
  "& .slug": {
    fontFamily: "var(--font-mono)",
    color: "var(--text)",
    textDecoration: "none",
    borderRadius: "4px",
    "&:hover": { color: "var(--accent-text)" },
  },
  "& .time": {
    fontSize: "var(--text-xs)",
    color: "var(--text-tertiary)",
    whiteSpace: "nowrap",
    paddingTop: "2px",
  },
});

const detailStyle = css({
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "6px",
  marginTop: "6px",
  fontFamily: "var(--font-mono)",
  fontSize: "var(--text-xs)",
  lineHeight: 1.5,
  "& .from": {
    color: "var(--text-tertiary)",
    textDecoration: "line-through",
    textDecorationColor: "var(--border-strong)",
    wordBreak: "break-all",
  },
  "& .to": { color: "var(--text-secondary)", wordBreak: "break-all" },
  "& .arrow": { color: "var(--text-tertiary)" },
});

export function ChangeRow(
  handle: Handle<{
    entry: HistoryEntry;
    people: Record<string, Person>;
    showSlug?: boolean;
    timeStyle?: "relative" | "clock";
  }>,
) {
  return () => {
    const { entry, people, showSlug = true, timeStyle = "relative" } = handle.props;
    const actorName = entry.actor ? (people[entry.actor]?.name ?? entry.actor) : "Someone";
    const verb = ACTION_VERBS[entry.action] ?? entry.action.toLowerCase();
    const slugHref = routes.links.show.index.href({ slug: entry.slug });

    return (
      <li mix={rowStyle}>
        <span style={{ position: "relative", display: "flex", width: "28px", height: "28px" }}>
          <Avatar
            name={actorName}
            id={entry.actor}
            image={entry.actor ? people[entry.actor]?.image : null}
            size={28}
          />
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              right: "-2px",
              bottom: "-2px",
              width: "10px",
              height: "10px",
              borderRadius: "999px",
              background: ACTION_COLORS[entry.action] ?? "var(--text-tertiary)",
              border: "2px solid var(--surface)",
            }}
          />
        </span>
        <div style={{ minWidth: 0 }}>
          <p class="line">
            <strong>{actorName}</strong> {verb}{" "}
            {showSlug ? (
              <a class="slug" href={slugHref}>
                {SHORT_DOMAIN}/{entry.slug}
              </a>
            ) : (
              "this link"
            )}
          </p>
          <ChangeDetail entry={entry} />
        </div>
        <time class="time" datetime={entry.at.toISOString()} title={formatDateTime(entry.at)}>
          {timeStyle === "clock" ? formatTime(entry.at) : relativeTime(entry.at)}
        </time>
      </li>
    );
  };
}

function ChangeDetail(handle: Handle<{ entry: HistoryEntry }>) {
  return () => {
    const { entry } = handle.props;
    if (entry.action === "Used" || !entry.url) return null;
    if (entry.action === "Updated" && entry.previousUrl && entry.previousUrl !== entry.url) {
      return (
        <p mix={detailStyle}>
          <span class="from">{entry.previousUrl}</span>
          <span class="arrow">→</span>
          <span class="to">{entry.url}</span>
        </p>
      );
    }
    if (entry.action === "Deleted") {
      return (
        <p mix={detailStyle}>
          <span class="from">{entry.url}</span>
        </p>
      );
    }
    return (
      <p mix={detailStyle}>
        <span class="arrow">→</span>
        <span class="to">{entry.url}</span>
      </p>
    );
  };
}

export const changeList = css({ listStyle: "none", margin: 0, padding: 0 });
