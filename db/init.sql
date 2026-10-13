BEGIN;

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
    "Timestamp" timestamptz NOT NULL,
    "Descriptive Timestamp" timestamptz NOT NULL,
    "Client IP" text,
    "Slug" text NOT NULL,
    "URL" text NOT NULL,
    "User Agent" text,
    "Counter" integer NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS slughistory (
    id bigserial PRIMARY KEY,
    slug text NOT NULL,
    new_url text NOT NULL,
    action_type text NOT NULL,
    note text NOT NULL DEFAULT '',
    version integer NOT NULL,
    changed_by text NOT NULL,
    changed_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMIT;
