import { client } from "./db.ts";

export type StaffMember = {
  id: number;
  name: string;
  slackId: string | null;
  email: string | null;
  addedBy: string;
  addedAt: Date | null;
  // Listed in MANAGE_BOOTSTRAP_ADMINS: always allowed in and can't be removed from the UI
  bootstrap: boolean;
};

export type StaffAuditEntry = {
  id: number;
  action: "added" | "removed";
  name: string;
  slackId: string | null;
  email: string | null;
  actor: string;
  at: Date;
};

// Errors whose message is safe and useful to show to the person making the change
export class StaffError extends Error {}

const SLACK_ID_PATTERN = /^[UW][A-Z0-9]{6,}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CACHE_TTL_MS = 30_000;

// Break-glass access that survives an empty or wiped staff table
const bootstrapIds = new Set(
  (Bun.env.MANAGE_BOOTSTRAP_ADMINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => (value.includes("@") ? value.toLowerCase() : value)),
);

function isBootstrap(slackId: string | null, email: string | null) {
  return (
    (slackId !== null && bootstrapIds.has(slackId)) ||
    (email !== null && bootstrapIds.has(email.toLowerCase()))
  );
}

type StaffRow = {
  id: number;
  name: string;
  slack_id: string | null;
  email: string | null;
  added_by: string;
  added_at: Date;
};

function toMember(row: StaffRow): StaffMember {
  return {
    id: row.id,
    name: row.name,
    slackId: row.slack_id,
    email: row.email,
    addedBy: row.added_by,
    addedAt: row.added_at,
    bootstrap: isBootstrap(row.slack_id, row.email),
  };
}

// The Slack bot checks staff on every command, so keep a short-lived copy of the Slack IDs
let slackIdCache: { ids: Set<string>; loadedAt: number } | null = null;

function invalidateCache() {
  slackIdCache = null;
}

export async function isStaffMember(slackId: string): Promise<boolean> {
  if (bootstrapIds.has(slackId)) return true;

  if (!slackIdCache || Date.now() - slackIdCache.loadedAt > CACHE_TTL_MS) {
    const res = await client.query<{ slack_id: string }>(
      "SELECT slack_id FROM staff WHERE slack_id IS NOT NULL",
    );
    slackIdCache = { ids: new Set(res.rows.map((row) => row.slack_id)), loadedAt: Date.now() };
  }

  return slackIdCache.ids.has(slackId);
}

// Used by the dashboard on every request, uncached, so removals take effect immediately
export async function findStaff(identity: {
  slackId: string | null;
  email: string | null;
}): Promise<StaffMember | null> {
  const email = identity.email?.toLowerCase() ?? null;
  const res = await client.query<StaffRow>(
    `SELECT * FROM staff
     WHERE ($1::text IS NOT NULL AND slack_id = $1) OR ($2::text IS NOT NULL AND email = $2)
     ORDER BY (slack_id = $1) DESC NULLS LAST
     LIMIT 1`,
    [identity.slackId, email],
  );

  const row = res.rows[0];
  if (row) return toMember(row);

  if (isBootstrap(identity.slackId, email)) {
    return {
      id: 0,
      name: "Bootstrap admin",
      slackId: identity.slackId,
      email,
      addedBy: "MANAGE_BOOTSTRAP_ADMINS",
      addedAt: null,
      bootstrap: true,
    };
  }

  return null;
}

export async function listStaff(): Promise<StaffMember[]> {
  const res = await client.query<StaffRow>("SELECT * FROM staff ORDER BY lower(name)");
  const members = res.rows.map(toMember);

  // Show break-glass admins even when they have no row of their own
  for (const id of bootstrapIds) {
    const covered = members.some((member) => member.slackId === id || member.email === id);
    if (!covered) {
      members.unshift({
        id: 0,
        name: id,
        slackId: id.includes("@") ? null : id,
        email: id.includes("@") ? id : null,
        addedBy: "MANAGE_BOOTSTRAP_ADMINS",
        addedAt: null,
        bootstrap: true,
      });
    }
  }

  return members;
}

export async function addStaff(
  input: { name: string; slackId: string; email: string },
  actor: string,
): Promise<StaffMember> {
  const name = input.name.trim();
  const slackId = input.slackId.trim().toUpperCase() || null;
  const email = input.email.trim().toLowerCase() || null;

  if (!name) throw new StaffError("Give them a name so others know who this is.");
  if (name.length > 100) throw new StaffError("Keep names under 100 characters.");
  if (!slackId && !email) throw new StaffError("Add a Slack ID, an email, or both.");
  if (slackId && !SLACK_ID_PATTERN.test(slackId)) {
    throw new StaffError(
      "That doesn’t look like a Slack ID. They start with U and look like U04QH1TTMBP.",
    );
  }
  if (email && !EMAIL_PATTERN.test(email)) throw new StaffError("That email address isn’t valid.");

  const existing = await client.query<StaffRow>(
    "SELECT * FROM staff WHERE slack_id = $1 OR email = $2 LIMIT 1",
    [slackId, email],
  );
  if (existing.rows[0]) {
    throw new StaffError(`${existing.rows[0].name} already has access with that identity.`);
  }

  const res = await client.query<StaffRow>(
    "INSERT INTO staff (name, slack_id, email, added_by) VALUES ($1, $2, $3, $4) RETURNING *",
    [name, slackId, email, actor],
  );
  await client.query(
    "INSERT INTO staff_audit (action, name, slack_id, email, actor) VALUES ('added', $1, $2, $3, $4)",
    [name, slackId, email, actor],
  );
  invalidateCache();
  void announce(
    `${mention(actor)} gave *${escapeSlack(name)}* (${describe(slackId, email)}) access to hack.af`,
  );

  return toMember(res.rows[0]!);
}

export async function removeStaff(id: number, actor: string): Promise<StaffMember> {
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new StaffError("That person isn’t on the access list anymore.");
  }
  const res = await client.query<StaffRow>("SELECT * FROM staff WHERE id = $1", [id]);
  const row = res.rows[0];
  if (!row) throw new StaffError("That person isn’t on the access list anymore.");

  const member = toMember(row);
  if (member.slackId === actor || member.email === actor) {
    throw new StaffError("You can’t remove yourself. Ask someone else on the list.");
  }
  if (member.bootstrap) {
    throw new StaffError(
      `${member.name} is a break-glass admin. Remove them from MANAGE_BOOTSTRAP_ADMINS first.`,
    );
  }

  const count = await client.query<{ count: string }>("SELECT count(*) FROM staff");
  if (Number(count.rows[0]?.count) <= 1 && bootstrapIds.size === 0) {
    throw new StaffError("This is the last person with access. Add someone else first.");
  }

  await client.query("DELETE FROM staff WHERE id = $1", [id]);
  await client.query(
    "INSERT INTO staff_audit (action, name, slack_id, email, actor) VALUES ('removed', $1, $2, $3, $4)",
    [row.name, row.slack_id, row.email, actor],
  );
  invalidateCache();
  void announce(
    `${mention(actor)} removed *${escapeSlack(row.name)}* (${describe(row.slack_id, row.email)}) from hack.af`,
  );

  return member;
}

export async function listStaffAudit(limit = 20): Promise<StaffAuditEntry[]> {
  const res = await client.query(
    "SELECT id, action, name, slack_id, email, actor, at FROM staff_audit ORDER BY at DESC LIMIT $1",
    [limit],
  );
  return res.rows.map((row) => ({
    id: row.id,
    action: row.action,
    name: row.name,
    slackId: row.slack_id,
    email: row.email,
    actor: row.actor,
    at: row.at,
  }));
}

function mention(id: string) {
  return SLACK_ID_PATTERN.test(id) ? `<@${id}>` : escapeSlack(id);
}

function describe(slackId: string | null, email: string | null) {
  return [slackId ? mention(slackId) : null, email ? escapeSlack(email) : null]
    .filter(Boolean)
    .join(", ");
}

// Names and emails are typed by staff; escaped so one can't smuggle in <!channel> or a fake link
function escapeSlack(text: string) {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

// Allowlist changes skip code review now, so make every change visible in Slack instead
async function announce(text: string) {
  const token = Bun.env.SLACK_BOT_TOKEN;
  const channel = Bun.env.STAFF_AUDIT_CHANNEL;
  if (!token || !channel) return;

  try {
    await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ channel, text }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (error) {
    console.error("Failed to post staff change to Slack:", error);
  }
}
