import type pg from "pg";
import { cache } from "./cache.ts";
import { client, withTransaction } from "./db.ts";

// Every write to "Links" goes through here so the Slack bot and the dashboard
// share validation, history and cache invalidation.

export const SHORT_DOMAIN = Bun.env.SHORT_DOMAIN ?? "hack.club";

export class LinkError extends Error {
  constructor(
    message: string,
    readonly field?: "slug" | "destination" | "note",
  ) {
    super(message);
  }
}

export type LinkSummary = {
  slug: string;
  destination: string;
  clicks: number;
  notes: string;
  lastChangedAt: Date | null;
  lastChangedBy: string | null;
  lastAction: string | null;
};

export type Link = LinkSummary & {
  recordId: string;
  createdAt: Date | null;
  createdBy: string | null;
};

export type HistoryEntry = {
  id: number;
  slug: string;
  version: number;
  action: string;
  url: string | null;
  previousUrl: string | null;
  note: string | null;
  actor: string | null;
  at: Date;
};

export type ClickSeries = {
  days: { day: string; clicks: number }[];
  total: number;
  lastClickAt: Date | null;
};

export type LinkSort = "recent" | "clicks" | "slug";

// Paths the Express routes answer before the database is consulted, so a slug
// there would never resolve
const RESERVED_EXACT = new Set(["ping", "glitch", "programs", "favicon.ico", "robots.txt"]);
const RESERVED_PREFIXES = [
  "vip/",
  "gib/",
  "hcb/",
  "gh/",
  "join/",
  "haven/",
  "f/",
  "pkg!",
  "ltr!",
  "odr!",
];

export function reservedReason(slug: string): string | null {
  const lower = slug.toLowerCase();
  if (RESERVED_EXACT.has(lower)) return `${SHORT_DOMAIN}/${slug} is a built-in route.`;
  const prefix = RESERVED_PREFIXES.find((p) => lower.startsWith(p));
  if (prefix) return `Links starting with “${prefix}” are handled by a built-in route.`;
  return null;
}

export function validateSlug(raw: string): string {
  const slug = raw.trim().replace(/^\/+|\/+$/g, "");
  if (!slug) throw new LinkError("Pick a slug.", "slug");
  if (slug.length > 200) throw new LinkError("Keep slugs under 200 characters.", "slug");
  if (/[\s?#%\\]/.test(slug)) {
    throw new LinkError("Slugs can’t contain spaces or ? # % \\ characters.", "slug");
  }
  const reserved = reservedReason(slug);
  if (reserved) throw new LinkError(reserved, "slug");
  return slug;
}

export function normalizeDestination(raw: string): string {
  // Slack formatting sometimes wraps pasted URLs in <>, *, _ or `
  let value = raw.trim().replace(/^[<*_`]+|[>*_`]+$/g, "");
  if (!value) throw new LinkError("Paste the URL this link should go to.", "destination");
  if (value.length > 2048) throw new LinkError("Keep URLs under 2,048 characters.", "destination");
  if (!/^[a-z][a-z0-9+.-]*:/i.test(value)) value = `https://${value}`;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new LinkError("That isn’t a valid URL.", "destination");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new LinkError("Only http and https links are allowed.", "destination");
  }
  if (!url.hostname.includes(".") && url.hostname !== "localhost") {
    throw new LinkError("That URL is missing a domain.", "destination");
  }
  return value;
}

// Older rows were stored URL-encoded; the redirect decodes them, so display does too
export function decodeDestination(stored: string): string {
  try {
    return decodeURIComponent(stored);
  } catch {
    return stored;
  }
}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

function randomSlug() {
  const alphabet = "abcdefghijkmnpqrstuvwxyz23456789";
  let slug = "";
  for (const byte of crypto.getRandomValues(new Uint8Array(6))) {
    slug += alphabet[byte % alphabet.length];
  }
  return slug;
}

function newRecordId() {
  return Math.random().toString(36).substring(2, 15);
}

const SUMMARY_COLUMNS = `
  l.slug,
  l.destination,
  COALESCE(l."Clicks", 0)::int AS clicks,
  COALESCE(l."Notes", '') AS notes,
  h.changed_at AS last_changed_at,
  h.changed_by AS last_changed_by,
  h.action_type AS last_action`;

const LAST_CHANGE_JOIN = `
  LEFT JOIN LATERAL (
    SELECT changed_at, changed_by, action_type FROM slughistory s
    WHERE s.slug = l.slug ORDER BY version DESC LIMIT 1
  ) h ON true`;

function toSummary(row: any): LinkSummary {
  return {
    slug: row.slug,
    destination: decodeDestination(row.destination),
    clicks: row.clicks,
    notes: row.notes,
    lastChangedAt: row.last_changed_at,
    lastChangedBy: row.last_changed_by,
    lastAction: row.last_action,
  };
}

// Slugs the bot generates for `shorten` (and blank slugs in the dashboard) are short
// mixes of letters and digits. Nothing records which links were random, so this is a heuristic.
const RANDOM_SLUG_SQL = `(l.slug ~ '^[a-z0-9]{4,8}$' AND l.slug ~ '[0-9]' AND l.slug ~ '[a-z]')`;

export async function listLinks(options: {
  q?: string;
  customOnly?: boolean;
  sort?: LinkSort;
  page?: number;
  perPage?: number;
}): Promise<{ links: LinkSummary[]; total: number }> {
  const q = options.q?.trim().slice(0, 200) ?? "";
  const perPage = options.perPage ?? 50;
  const page = Math.max(1, options.page ?? 1);
  const order = {
    recent: "h.changed_at DESC NULLS LAST, l.slug",
    clicks: `COALESCE(l."Clicks", 0) DESC, l.slug`,
    slug: "l.slug",
  }[options.sort ?? "recent"];

  const res = await client.query(
    `SELECT ${SUMMARY_COLUMNS}, count(*) OVER () AS total
     FROM "Links" l ${LAST_CHANGE_JOIN}
     WHERE ($1 = '' OR l.slug ILIKE $2 OR l.destination ILIKE $2)
       ${options.customOnly ? `AND NOT ${RANDOM_SLUG_SQL}` : ""}
     ORDER BY ${order}
     LIMIT $3 OFFSET $4`,
    [q, `%${escapeLike(q)}%`, perPage, (page - 1) * perPage],
  );

  let total = Number(res.rows[0]?.total ?? 0);
  if (res.rows.length === 0 && page > 1) {
    const count = await client.query(
      `SELECT count(*) FROM "Links" l
       WHERE ($1 = '' OR l.slug ILIKE $2 OR l.destination ILIKE $2)
         ${options.customOnly ? `AND NOT ${RANDOM_SLUG_SQL}` : ""}`,
      [q, `%${escapeLike(q)}%`],
    );
    total = Number(count.rows[0]?.count ?? 0);
  }

  return { links: res.rows.map(toSummary), total };
}

export async function getTotals(): Promise<{ links: number; clicks: number }> {
  const res = await client.query(
    `SELECT count(*)::int AS links, COALESCE(sum("Clicks"), 0)::bigint AS clicks FROM "Links"`,
  );
  return { links: res.rows[0].links, clicks: Number(res.rows[0].clicks) };
}

// Ranked for the command palette: exact match, then prefix, then most clicked
export async function searchLinks(q: string, limit = 8): Promise<LinkSummary[]> {
  const term = q.trim().slice(0, 200);
  if (!term) return [];
  const res = await client.query(
    `SELECT ${SUMMARY_COLUMNS}
     FROM "Links" l ${LAST_CHANGE_JOIN}
     WHERE l.slug ILIKE $1 OR l.destination ILIKE $1
     ORDER BY (lower(l.slug) = lower($2)) DESC, (l.slug ILIKE $3) DESC,
              COALESCE(l."Clicks", 0) DESC
     LIMIT $4`,
    [`%${escapeLike(term)}%`, term, `${escapeLike(term)}%`, limit],
  );
  return res.rows.map(toSummary);
}

export async function getLink(slug: string): Promise<Link | null> {
  const res = await client.query(
    `SELECT ${SUMMARY_COLUMNS}, l."Record Id" AS record_id, c.changed_at AS created_at, c.changed_by AS created_by
     FROM "Links" l ${LAST_CHANGE_JOIN}
     LEFT JOIN LATERAL (
       SELECT changed_at, changed_by FROM slughistory s
       WHERE s.slug = l.slug AND s.action_type = 'Created' ORDER BY version DESC LIMIT 1
     ) c ON true
     WHERE l.slug = $1`,
    [slug],
  );
  const row = res.rows[0];
  if (!row) return null;
  return {
    ...toSummary(row),
    recordId: row.record_id,
    createdAt: row.created_at,
    createdBy: row.created_by,
  };
}

export type SlugCheck =
  | { status: "available"; slug: string }
  | { status: "taken"; slug: string; destination: string }
  | { status: "invalid"; message: string };

export async function checkSlug(raw: string): Promise<SlugCheck> {
  let slug: string;
  try {
    slug = validateSlug(raw);
  } catch (error) {
    if (error instanceof LinkError) return { status: "invalid", message: error.message };
    throw error;
  }
  const res = await client.query(`SELECT destination FROM "Links" WHERE slug = $1`, [slug]);
  if (res.rows[0]) {
    return { status: "taken", slug, destination: decodeDestination(res.rows[0].destination) };
  }
  return { status: "available", slug };
}

async function lockSlug(tx: pg.PoolClient, slug: string) {
  await tx.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`hackaf:slug:${slug}`]);
}

async function recordHistory(
  tx: pg.PoolClient,
  entry: { slug: string; url: string; action: string; note?: string; actor: string },
) {
  // Callers hold the slug lock, so MAX(version) + 1 can't race
  const res = await tx.query(
    "SELECT COALESCE(MAX(version), 0) + 1 AS next FROM slughistory WHERE slug = $1",
    [entry.slug],
  );
  await tx.query(
    `INSERT INTO slughistory (slug, new_url, action_type, note, version, changed_by, changed_at)
     VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
    [entry.slug, entry.url, entry.action, entry.note ?? "", res.rows[0].next, entry.actor],
  );
}

async function findDestination(tx: pg.PoolClient, slug: string): Promise<string | null> {
  const res = await tx.query(`SELECT destination FROM "Links" WHERE slug = $1`, [slug]);
  return res.rows[0]?.destination ?? null;
}

export async function createLink(
  input: { slug?: string; destination: string; note?: string },
  actor: string,
): Promise<{ slug: string; destination: string }> {
  const destination = normalizeDestination(input.destination);
  const wantsRandom = !input.slug?.trim();

  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = wantsRandom ? randomSlug() : validateSlug(input.slug!);

    const created = await withTransaction(async (tx) => {
      await lockSlug(tx, slug);
      if ((await findDestination(tx, slug)) !== null) return false;

      await tx.query(`INSERT INTO "Links" ("Record Id", slug, destination) VALUES ($1, $2, $3)`, [
        newRecordId(),
        slug,
        destination,
      ]);
      if (input.note?.trim()) {
        await tx.query(`UPDATE "Links" SET "Notes" = $1 WHERE slug = $2`, [
          input.note.trim(),
          slug,
        ]);
      }
      await recordHistory(tx, { slug, url: destination, action: "Created", actor });
      return true;
    });

    if (created) {
      cache.delete(slug);
      return { slug, destination };
    }
    if (!wantsRandom) {
      throw new LinkError(`${SHORT_DOMAIN}/${slug} is already taken.`, "slug");
    }
  }

  throw new LinkError("Couldn’t find a free random slug. Try again.", "slug");
}

export async function updateDestination(
  slug: string,
  rawDestination: string,
  actor: string,
): Promise<{ previous: string }> {
  const destination = normalizeDestination(rawDestination);

  const previous = await withTransaction(async (tx) => {
    await lockSlug(tx, slug);
    const current = await findDestination(tx, slug);
    if (current === null) throw new LinkError(`${SHORT_DOMAIN}/${slug} doesn’t exist.`);

    await tx.query(`UPDATE "Links" SET destination = $1 WHERE slug = $2`, [destination, slug]);
    await recordHistory(tx, { slug, url: destination, action: "Updated", actor });
    return decodeDestination(current);
  });

  cache.delete(slug);
  return { previous };
}

// The Slack bot's `set` command: create the slug or repoint it
export async function setLink(
  rawSlug: string,
  rawDestination: string,
  actor: string,
): Promise<{ created: boolean; previous: string | null }> {
  const slug = validateSlug(rawSlug);
  const existing = await client.query(`SELECT 1 FROM "Links" WHERE slug = $1`, [slug]);
  if (existing.rows.length > 0) {
    const { previous } = await updateDestination(slug, rawDestination, actor);
    return { created: false, previous };
  }
  await createLink({ slug, destination: rawDestination }, actor);
  return { created: true, previous: null };
}

export async function updateNote(slug: string, note: string, actor: string): Promise<void> {
  await withTransaction(async (tx) => {
    await lockSlug(tx, slug);
    const current = await findDestination(tx, slug);
    if (current === null) throw new LinkError(`${SHORT_DOMAIN}/${slug} doesn’t exist.`);

    await tx.query(`UPDATE "Links" SET "Notes" = $1 WHERE slug = $2`, [note.trim(), slug]);
    await recordHistory(tx, { slug, url: current, action: "Note", note: note.trim(), actor });
  });
}

export async function deleteLink(slug: string, actor: string): Promise<{ destination: string }> {
  const destination = await withTransaction(async (tx) => {
    await lockSlug(tx, slug);
    const current = await findDestination(tx, slug);
    if (current === null) throw new LinkError(`${SHORT_DOMAIN}/${slug} doesn’t exist.`);

    await tx.query(`DELETE FROM "Links" WHERE slug = $1`, [slug]);
    // Keep the old destination in history so the link can be restored
    await recordHistory(tx, { slug, url: current, action: "Deleted", actor });
    return decodeDestination(current);
  });

  cache.delete(slug);
  return { destination };
}

export async function restoreLink(slug: string, actor: string): Promise<{ destination: string }> {
  const destination = await withTransaction(async (tx) => {
    await lockSlug(tx, slug);
    if ((await findDestination(tx, slug)) !== null) {
      throw new LinkError(`${SHORT_DOMAIN}/${slug} already exists.`);
    }
    const last = await tx.query(
      `SELECT new_url FROM slughistory WHERE slug = $1 AND action_type = 'Deleted'
       ORDER BY version DESC LIMIT 1`,
      [slug],
    );
    const url = last.rows[0]?.new_url;
    if (!url)
      throw new LinkError(`There’s no deleted version of ${SHORT_DOMAIN}/${slug} to restore.`);

    await tx.query(`INSERT INTO "Links" ("Record Id", slug, destination) VALUES ($1, $2, $3)`, [
      newRecordId(),
      slug,
      url,
    ]);
    await recordHistory(tx, { slug, url, action: "Restored", actor });
    return decodeDestination(url);
  });

  cache.delete(slug);
  return { destination };
}

const HISTORY_COLUMNS = `
  s.id, s.slug, s.version, s.action_type, s.new_url, s.note, s.changed_by, s.changed_at,
  p.new_url AS previous_url`;

const PREVIOUS_JOIN = `
  LEFT JOIN LATERAL (
    SELECT new_url FROM slughistory p
    WHERE p.slug = s.slug AND p.version < s.version AND p.action_type IN ('Created', 'Updated', 'Restored')
    ORDER BY p.version DESC LIMIT 1
  ) p ON true`;

function toHistory(row: any): HistoryEntry {
  return {
    id: row.id,
    slug: row.slug,
    version: row.version,
    action: row.action_type,
    url: row.new_url === null ? null : decodeDestination(row.new_url),
    previousUrl: row.previous_url === null ? null : decodeDestination(row.previous_url),
    note: row.note || null,
    actor: row.changed_by || null,
    at: row.changed_at,
  };
}

// Note edits come from the Slack bot's `note` command; the dashboard doesn't show notes
export async function getHistory(slug: string, limit = 50): Promise<HistoryEntry[]> {
  const res = await client.query(
    `SELECT ${HISTORY_COLUMNS} FROM slughistory s ${PREVIOUS_JOIN}
     WHERE s.slug = $1 AND s.action_type <> 'Note' ORDER BY s.version DESC LIMIT $2`,
    [slug, limit],
  );
  return res.rows.map(toHistory);
}

export async function getActivity(options: {
  before?: Date;
  actor?: string;
  action?: string;
  limit?: number;
}): Promise<HistoryEntry[]> {
  const res = await client.query(
    `SELECT ${HISTORY_COLUMNS} FROM slughistory s ${PREVIOUS_JOIN}
     WHERE s.action_type <> 'Note'
       AND ($1::timestamptz IS NULL OR s.changed_at < $1)
       AND ($2::text IS NULL OR s.changed_by = $2)
       AND ($3::text IS NULL OR s.action_type = $3)
     ORDER BY s.changed_at DESC, s.id DESC
     LIMIT $4`,
    [options.before ?? null, options.actor ?? null, options.action ?? null, options.limit ?? 60],
  );
  return res.rows.map(toHistory);
}

export async function getActivityActors(): Promise<string[]> {
  const res = await client.query(
    `SELECT changed_by FROM slughistory WHERE changed_by IS NOT NULL AND changed_by <> ''
     GROUP BY changed_by ORDER BY max(changed_at) DESC LIMIT 200`,
  );
  return res.rows.map((row) => row.changed_by);
}

export async function getClicks(slug: string, days: number): Promise<ClickSeries | null> {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - (days - 1));

  try {
    const [series, last] = await Promise.all([
      client.query(
        `SELECT to_char(date_trunc('day', "Descriptive Timestamp" AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS day,
                count(*)::int AS clicks
         FROM "Log" WHERE "Slug" = $1 AND "Descriptive Timestamp" >= $2
         GROUP BY 1`,
        [slug, since],
      ),
      client.query(`SELECT max("Descriptive Timestamp") AS at FROM "Log" WHERE "Slug" = $1`, [
        slug,
      ]),
    ]);

    const counts = new Map<string, number>(series.rows.map((row) => [row.day, row.clicks]));
    const result: ClickSeries["days"] = [];
    for (let i = 0; i < days; i++) {
      const day = new Date(since);
      day.setUTCDate(since.getUTCDate() + i);
      const key = day.toISOString().slice(0, 10);
      result.push({ day: key, clicks: counts.get(key) ?? 0 });
    }

    return {
      days: result,
      total: result.reduce((sum, day) => sum + day.clicks, 0),
      lastClickAt: last.rows[0]?.at ? new Date(last.rows[0].at) : null,
    };
  } catch (error) {
    // The production "Log" schema isn't in the repo; don't take the page down if it differs
    console.error("Failed to load click history:", error);
    return null;
  }
}
