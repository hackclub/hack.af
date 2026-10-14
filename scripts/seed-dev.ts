// Fills a local database with realistic demo data for working on the dashboard.
//   bun run db:dev           create tables and seed if empty
//   bun run db:dev --reset   wipe the demo tables and reseed
// Refuses to touch anything that isn't a local database.
import pg from "pg";
import { runMigrations } from "../src/migrate.ts";

const url = Bun.env.DATABASE_URL ?? "";
if (!/@(localhost|127\.0\.0\.1|db)(:\d+)?\//.test(url)) {
  console.error("Refusing to seed: DATABASE_URL doesn't point at a local database.");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: url });
const reset = process.argv.includes("--reset");

// Deterministic so screenshots and tests see the same data every run
let seed = 20261013;
function random() {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
}
const pick = <T>(items: T[]) => items[Math.floor(random() * items.length)]!;
const DAY = 86_400_000;
const now = Date.now();

const ORPHEUS = "U0ORPHEUS1";
const STAFF = [
  ORPHEUS,
  "U04QH1TTMBP",
  "U0C7B14Q3",
  "U0266FRGP",
  "U032A2PMSE9",
  "U013B6CPV62",
  "U041FQB8VK2",
  "U04BBP8H9FA",
  "U06QK6AG3RD",
];

type SeedLink = {
  slug: string;
  destination: string;
  previous?: string[];
  note?: string;
  // Relative popularity and an optional launch-day spike (days ago)
  weight: number;
  spike?: number;
};

const LINKS: SeedLink[] = [
  {
    slug: "slack",
    destination: "https://hackclub.slack.com",
    weight: 40,
    note: "Main Slack invite. Linked from the website footer.",
  },
  { slug: "join", destination: "https://hackclub.com/slack/", weight: 32 },
  { slug: "donate", destination: "https://hcb.hackclub.com/donations/start/hq", weight: 12 },
  { slug: "jobs", destination: "https://hackclub.com/jobs/", weight: 8 },
  { slug: "brand", destination: "https://hackclub.com/brand/", weight: 4 },
  { slug: "philosophy", destination: "https://hackclub.com/philosophy/", weight: 3 },
  { slug: "conduct", destination: "https://hackclub.com/conduct/", weight: 6 },
  { slug: "hcb", destination: "https://hcb.hackclub.com", weight: 14 },
  { slug: "scrapbook", destination: "https://scrapbook.hackclub.com", weight: 9 },
  { slug: "sprig", destination: "https://sprig.hackclub.com", weight: 11 },
  { slug: "blot", destination: "https://blot.hackclub.com", weight: 5 },
  { slug: "workshops", destination: "https://workshops.hackclub.com", weight: 7 },
  { slug: "toolbox", destination: "https://toolbox.hackclub.com", weight: 5 },
  {
    slug: "summer",
    destination: "https://summer.hackclub.com",
    previous: ["https://hackclub.com/summer/"],
    weight: 22,
    spike: 18,
    note: "Points at whatever this summer's program is. Repoint each May.",
  },
  { slug: "som", destination: "https://summer.hackclub.com/shop", weight: 9, spike: 18 },
  { slug: "highseas", destination: "https://highseas.hackclub.com", weight: 6 },
  { slug: "arcade", destination: "https://hackclub.com/arcade/", weight: 6 },
  { slug: "counterspell", destination: "https://counterspell.hackclub.com", weight: 10, spike: 41 },
  { slug: "juice", destination: "https://juice.hackclub.com", weight: 7 },
  { slug: "neighborhood", destination: "https://neighborhood.hackclub.com", weight: 6 },
  { slug: "shipwrecked", destination: "https://shipwrecked.hackclub.com", weight: 8 },
  { slug: "athena", destination: "https://athena.hackclub.com", weight: 5 },
  { slug: "ysws", destination: "https://ysws.hackclub.com", weight: 9 },
  { slug: "hackatime", destination: "https://hackatime.hackclub.com", weight: 15 },
  { slug: "clubs", destination: "https://hackclub.com/clubs/", weight: 8 },
  { slug: "start", destination: "https://hackclub.com/start/", weight: 6 },
  {
    slug: "apply",
    destination: "https://apply.hackclub.com",
    previous: ["https://hackclub.com/apply/"],
    weight: 7,
  },
  { slug: "leaders", destination: "https://leaders.hackclub.com", weight: 4 },
  { slug: "hackathons", destination: "https://hackathons.hackclub.com", weight: 9 },
  { slug: "events", destination: "https://events.hackclub.com", weight: 4 },
  {
    slug: "ama",
    destination: "https://www.youtube.com/@HackClubHQ/streams",
    weight: 3,
    note: "Livestream page for AMAs.",
  },
  { slug: "newsletter", destination: "https://hackclub.com/newsletter/", weight: 3 },
  { slug: "stickers", destination: "https://forms.hackclub.com/stickers", weight: 5 },
  {
    slug: "office-hours",
    destination: "https://calendar.app.google/9F7Uq3PcXvD2bW1a8",
    previous: ["https://calendar.app.google/2Qe8mWkT7hzNcY4d6"],
    weight: 2,
  },
  { slug: "onboard", destination: "https://onboard.hackclub.com", weight: 4 },
  { slug: "pcb", destination: "https://jams.hackclub.com/batch/sprig-pcb", weight: 2 },
  { slug: "jams", destination: "https://jams.hackclub.com", weight: 4 },
  { slug: "hq", destination: "https://github.com/hackclub", weight: 3 },
  { slug: "site", destination: "https://github.com/hackclub/site", weight: 2 },
  { slug: "dino", destination: "https://github.com/hackclub/dinosaurs", weight: 3 },
  { slug: "the-bin", destination: "https://bin.hackclub.com", weight: 3 },
  {
    slug: "wom",
    destination: "https://forms.hackclub.com/t/wom-2026-interest",
    weight: 2,
    spike: 3,
  },
  {
    slug: "fall-ama",
    destination: "https://www.youtube.com/watch?v=4gS8rHk2ZQc",
    weight: 1,
    spike: 5,
  },
  { slug: "nyc", destination: "https://hackclub.com/events/nyc-2026/", weight: 2, spike: 9 },
  { slug: "flagship", destination: "https://hackclub.com/flagship/", weight: 1 },
  { slug: "hcb/open-source", destination: "https://hcb.hackclub.com/open-source", weight: 1 },
  { slug: "spring-term/apply", destination: "https://forms.hackclub.com/t/spring-term", weight: 1 },
];

const DELETED = [
  { slug: "spring-ama-2025", destination: "https://www.youtube.com/watch?v=k2Xn8mBf3Ys" },
  { slug: "outernet-signup", destination: "https://forms.hackclub.com/t/outernet-2025" },
];

function randomSlug() {
  const alphabet = "abcdefghijkmnpqrstuvwxyz23456789";
  return Array.from({ length: 6 }, () => pick([...alphabet])).join("");
}

const RANDOM_DESTINATIONS = [
  "https://docs.google.com/forms/d/e/1FAIpQLSc9xV2kR8mWq4tYh7nBz3pLd6gJ/viewform",
  "https://docs.google.com/document/d/1kP8vR3mXq2tYb7nW9zLc4hJf6dGs5aQ/edit",
  "https://github.com/hackclub/sprig/blob/main/docs/tutorial.md",
  "https://www.figma.com/design/Xq9mT2vRb8kWz4LcN7pD/Summer-Banners",
  "https://hackclub.notion.site/Event-Playbook-8c2f9e4b1a7d",
  "https://www.youtube.com/watch?v=dQ8vR2mXk4s",
  "https://forms.hackclub.com/t/club-check-in",
  "https://airtable.com/appR8vW2mXq4tYb7n/shrK9zLc4hJf6dGs5",
  "https://hackclub.com/fiscal-sponsorship/",
  "https://jams.hackclub.com/jam/spotify-wrapped",
];

async function main() {
  const schema = await Bun.file(new URL("../db/dev-schema.sql", import.meta.url)).text();

  if (reset) {
    await pool.query(
      `DROP TABLE IF EXISTS "Links", "Log", slughistory, staff, staff_audit, schema_migrations CASCADE`,
    );
  }
  await pool.query(schema);
  await runMigrations(pool);

  const existing = await pool.query(`SELECT count(*)::int AS count FROM "Links"`);
  if (existing.rows[0].count > 0) {
    console.log(`Links already has ${existing.rows[0].count} rows. Use --reset to reseed.`);
    return;
  }

  await pool.query(
    `INSERT INTO staff (name, slack_id, email, added_by) VALUES ('Orpheus', $1, 'orpheus@hackclub.com', 'seed')
     ON CONFLICT DO NOTHING`,
    [ORPHEUS],
  );

  const links: SeedLink[] = [...LINKS];
  for (let i = 0; i < 70; i++) {
    links.push({
      slug: randomSlug(),
      destination: pick(RANDOM_DESTINATIONS),
      weight: random() * 0.8,
    });
  }

  const history: [string, string, string, string, number, string, Date][] = [];
  const logIds: string[] = [];
  const logTimes: Date[] = [];
  const logSlugs: string[] = [];
  const logIps: string[] = [];

  for (const link of links) {
    const ageDays = 40 + Math.floor(random() * 700);
    let at = now - ageDays * DAY;
    const versions = [...(link.previous ?? []), link.destination];
    let version = 1;

    versions.forEach((destination, index) => {
      history.push([
        link.slug,
        destination,
        index === 0 ? "Created" : "Updated",
        "",
        version++,
        pick(STAFF),
        new Date(at),
      ]);
      at += Math.floor(random() * (now - at) * 0.6);
    });
    if (link.note) {
      history.push([
        link.slug,
        link.destination,
        "Note",
        link.note,
        version++,
        pick(STAFF),
        new Date(at + DAY),
      ]);
    }

    // Clicks per day for the last 120 days, with weekly rhythm and launch spikes
    for (let daysAgo = 119; daysAgo >= 0; daysAgo--) {
      const weekday = new Date(now - daysAgo * DAY).getUTCDay();
      const weekly = weekday === 0 || weekday === 6 ? 0.55 : 1;
      const spike =
        link.spike !== undefined ? Math.max(0, 8 - Math.abs(daysAgo - link.spike) * 1.6) : 0;
      const expected = link.weight * weekly * (1 + spike) * (0.6 + random() * 0.8);
      const count = Math.floor(expected + random());
      for (let c = 0; c < count; c++) {
        logIds.push(Math.random().toString(36).slice(2, 15));
        logTimes.push(new Date(now - daysAgo * DAY - Math.floor(random() * DAY * 0.95)));
        logSlugs.push(link.slug);
        logIps.push(`203.0.113.${Math.floor(random() * 254) + 1}`);
      }
    }
  }

  // A busy last couple of days so the activity feed has something to show
  const recent: [string, string, string, string][] = [
    ["summer", "https://summer.hackclub.com", "Updated", "U04QH1TTMBP"],
    ["wom", "https://forms.hackclub.com/t/wom-2026-interest", "Created", ORPHEUS],
    ["fall-ama", "https://www.youtube.com/watch?v=4gS8rHk2ZQc", "Created", "U0266FRGP"],
    ["nyc", "https://hackclub.com/events/nyc-2026/", "Created", "U032A2PMSE9"],
  ];
  recent.forEach(([slug, destination, action, actor], index) => {
    const version = history.filter((row) => row[0] === slug).length + 1;
    history.push([
      slug,
      destination,
      action,
      "",
      version,
      actor,
      new Date(now - (index * 5 + 1) * 3_600_000),
    ]);
  });

  for (const deleted of DELETED) {
    history.push([
      deleted.slug,
      deleted.destination,
      "Created",
      "",
      1,
      pick(STAFF),
      new Date(now - 200 * DAY),
    ]);
    history.push([
      deleted.slug,
      deleted.destination,
      "Deleted",
      "",
      2,
      pick(STAFF),
      new Date(now - 2 * DAY - 7_200_000),
    ]);
  }

  for (const link of links) {
    await pool.query(
      `INSERT INTO "Links" ("Record Id", slug, destination, "Notes") VALUES ($1, $2, $3, $4)`,
      [Math.random().toString(36).slice(2, 15), link.slug, link.destination, link.note ?? ""],
    );
  }

  for (const row of history) {
    await pool.query(
      `INSERT INTO slughistory (slug, new_url, action_type, note, version, changed_by, changed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      row,
    );
  }

  for (let i = 0; i < logIds.length; i += 5000) {
    await pool.query(
      `INSERT INTO "Log" ("Record Id", "Timestamp", "Descriptive Timestamp", "Client IP", "Slug", "URL", "User Agent", "Counter")
       SELECT id, to_char(t AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), t, ip, slug, 'https://hack.club/' || slug, 'Mozilla/5.0', 1
       FROM unnest($1::text[], $2::timestamptz[], $3::text[], $4::text[]) AS u(id, t, slug, ip)`,
      [
        logIds.slice(i, i + 5000),
        logTimes.slice(i, i + 5000),
        logSlugs.slice(i, i + 5000),
        logIps.slice(i, i + 5000),
      ],
    );
  }

  // All-time clicks include years of traffic from before the Log table existed
  await pool.query(`
    UPDATE "Links" l SET "Clicks" = c.count + (c.count * (2 + (abs(hashtext(l.slug)) % 9)))
    FROM (SELECT "Slug", count(*)::int AS count FROM "Log" GROUP BY "Slug") c
    WHERE c."Slug" = l.slug`);

  console.log(
    `Seeded ${links.length} links, ${history.length} history rows and ${logIds.length} clicks.`,
  );
}

try {
  await main();
} finally {
  await pool.end();
}
