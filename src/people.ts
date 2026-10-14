import { client } from "./db.ts";

// Turns the Slack IDs (and emails) stored on history, audit and staff rows into
// display names and profile photos for the dashboard, via cachet
// (https://tangled.org/dunkirk.sh/cachet), a Slack profile cache for Hack Club.

export type Person = { name: string; image: string | null };

const SLACK_ID_PATTERN = /^[UW][A-Z0-9]{6,}$/;
const CACHET_URL = Bun.env.CACHET_URL ?? "https://cachet.dunkirk.sh";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const MISS_TTL_MS = 10 * 60 * 1000;
const LOOKUP_CONCURRENCY = 8;

type Profile = { name: string | null; image: string | null; fetchedAt: number };
const profileCache = new Map<string, Profile>();

export async function resolvePeople(
  ids: Iterable<string | null | undefined>,
): Promise<Record<string, Person>> {
  const wanted = [...new Set([...ids].filter((id): id is string => Boolean(id)))];
  const people: Record<string, Person> = {};
  if (wanted.length === 0) return people;

  // The staff table holds the names people chose for each other, so it wins over Slack
  const res = await client.query<{ name: string; slack_id: string | null; email: string | null }>(
    "SELECT name, slack_id, email FROM staff WHERE slack_id = ANY($1) OR email = ANY($1)",
    [wanted],
  );
  const staffNames = new Map<string, string>();
  for (const row of res.rows) {
    if (row.slack_id) staffNames.set(row.slack_id, row.name);
    if (row.email) staffNames.set(row.email, row.name);
  }

  const profiles = await lookupProfiles(wanted.filter((id) => SLACK_ID_PATTERN.test(id)));

  for (const id of wanted) {
    const profile = profiles.get(id);
    const name = staffNames.get(id) ?? profile?.name ?? null;
    if (name || profile?.image) people[id] = { name: name ?? id, image: profile?.image ?? null };
  }
  return people;
}

export async function resolvePerson(id: string | null): Promise<Person | null> {
  if (!id) return null;
  return (await resolvePeople([id]))[id] ?? null;
}

async function lookupProfiles(ids: string[]): Promise<Map<string, Profile>> {
  const result = new Map<string, Profile>();
  const stale: string[] = [];

  for (const id of ids) {
    const cached = profileCache.get(id);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) result.set(id, cached);
    else stale.push(id);
  }
  if (stale.length === 0) return result;

  // A small worker pool keeps the first load of a long list quick without hammering cachet
  let next = 0;
  const workers = Array.from({ length: Math.min(LOOKUP_CONCURRENCY, stale.length) }, async () => {
    while (next < stale.length) {
      const id = stale[next++]!;
      const profile = await fetchProfile(id);
      if (profile) {
        profileCache.set(id, profile);
        result.set(id, profile);
      } else {
        // Remember misses for a few minutes so unknown IDs don't cost a request every page load
        profileCache.set(id, {
          name: null,
          image: null,
          fetchedAt: Date.now() - CACHE_TTL_MS + MISS_TTL_MS,
        });
      }
    }
  });
  await Promise.all(workers);
  return result;
}

async function fetchProfile(id: string): Promise<Profile | null> {
  try {
    const res = await fetch(`${CACHET_URL}/users/${encodeURIComponent(id)}`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      displayName?: string;
      realName?: string;
      imageUrl?: string;
    };
    return {
      name: body.displayName || body.realName || null,
      // Only ever an https image URL; anything else from the cache is ignored
      image: body.imageUrl?.startsWith("https://") ? body.imageUrl : null,
      fetchedAt: Date.now(),
    };
  } catch {
    return null;
  }
}
