-- Local stand-in for the production tables that predate db/migrations.
-- Production was never dumped into the repo, so these are reconstructed from
-- how the code reads and writes them. Used by `bun run db:dev`, never in prod.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS "Links" (
  "Record Id" text PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  destination text NOT NULL,
  "Log" text[] NOT NULL DEFAULT '{}',
  "Clicks" integer NOT NULL DEFAULT 0,
  "QR URL" text,
  "Visitor IPs" text[] NOT NULL DEFAULT '{}',
  "Notes" text NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS "Log" (
  "Record Id" text PRIMARY KEY,
  "Timestamp" text,
  "Descriptive Timestamp" timestamptz,
  "Client IP" text,
  "Slug" text,
  "URL" text,
  "User Agent" text,
  "Counter" integer
);

CREATE TABLE IF NOT EXISTS slughistory (
  id serial PRIMARY KEY,
  slug text NOT NULL,
  new_url text,
  action_type text NOT NULL,
  note text,
  version integer NOT NULL,
  changed_by text,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS links_slug_trgm ON "Links" USING gin (slug gin_trgm_ops);
CREATE INDEX IF NOT EXISTS links_destination_trgm ON "Links" USING gin (destination gin_trgm_ops);
CREATE INDEX IF NOT EXISTS log_slug_time ON "Log" ("Slug", "Descriptive Timestamp");
CREATE INDEX IF NOT EXISTS slughistory_slug_version ON slughistory (slug, version);
CREATE INDEX IF NOT EXISTS slughistory_changed_at ON slughistory (changed_at);
