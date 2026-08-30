import "server-only";

import { Pool } from "pg";

const DATABASE_URL = process.env.DATABASE_URL;

// Reuse the pool across Next.js dev HMR reloads.
const globalForPg = globalThis as unknown as {
  __pgPool?: Pool;
  __pgSchemaReady?: Promise<void>;
};

function createPool(): Pool {
  if (!DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is not set. The app requires a Postgres connection string."
    );
  }
  return new Pool({ connectionString: DATABASE_URL, max: 10 });
}

export function getPool(): Pool {
  if (!globalForPg.__pgPool) {
    globalForPg.__pgPool = createPool();
  }
  return globalForPg.__pgPool;
}

// Idempotent schema bootstrap. The Postgres container's
// /docker-entrypoint-initdb.d/ also creates this on a fresh volume; this
// runtime safety net covers pre-existing volumes.
const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS app_users (
  clerk_user_id        TEXT PRIMARY KEY,
  name                 TEXT        NOT NULL,
  email                TEXT        NOT NULL,
  picture              TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS songs (
  id                   SERIAL PRIMARY KEY,
  source               TEXT        NOT NULL CONSTRAINT songs_source_check CHECK (source IN ('airtable', 'app')),
  airtable_record_id   TEXT        UNIQUE,
  submitter_user_id    TEXT        REFERENCES app_users(clerk_user_id) ON DELETE SET NULL,
  submitter_name       TEXT        NOT NULL,
  submitter_email      TEXT,
  artist_name          TEXT,
  song_title           TEXT,
  description          TEXT,
  youtube_url          TEXT        NOT NULL,
  youtube_video_id     TEXT        NOT NULL CONSTRAINT songs_youtube_video_id_check CHECK (youtube_video_id ~ '^[A-Za-z0-9_-]{11}$'),
  submitted_date       DATE        NOT NULL,
  month                SMALLINT    NOT NULL CONSTRAINT songs_month_check CHECK (month BETWEEN 1 AND 12),
  year                 INTEGER     NOT NULL CONSTRAINT songs_year_check CHECK (year BETWEEN 2000 AND 2100),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  ALTER TABLE songs ADD COLUMN IF NOT EXISTS submitter_user_id TEXT;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'songs_submitter_user_id_fkey') THEN
    ALTER TABLE songs ADD CONSTRAINT songs_submitter_user_id_fkey FOREIGN KEY (submitter_user_id) REFERENCES app_users(clerk_user_id) ON DELETE SET NULL NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'songs_source_check') THEN
    ALTER TABLE songs ADD CONSTRAINT songs_source_check CHECK (source IN ('airtable', 'app')) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'songs_youtube_video_id_check') THEN
    ALTER TABLE songs ADD CONSTRAINT songs_youtube_video_id_check CHECK (youtube_video_id ~ '^[A-Za-z0-9_-]{11}$') NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'songs_month_check') THEN
    ALTER TABLE songs ADD CONSTRAINT songs_month_check CHECK (month BETWEEN 1 AND 12) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'songs_year_check') THEN
    ALTER TABLE songs ADD CONSTRAINT songs_year_check CHECK (year BETWEEN 2000 AND 2100) NOT VALID;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS song_likes (
  song_id              INTEGER     NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  user_id              TEXT        NOT NULL REFERENCES app_users(clerk_user_id) ON DELETE CASCADE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (song_id, user_id)
);

CREATE TABLE IF NOT EXISTS song_comments (
  id                   SERIAL PRIMARY KEY,
  song_id              INTEGER     NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  parent_comment_id    INTEGER     REFERENCES song_comments(id) ON DELETE CASCADE,
  user_id              TEXT        NOT NULL REFERENCES app_users(clerk_user_id) ON DELETE CASCADE,
  body                 TEXT        NOT NULL CONSTRAINT song_comments_body_check CHECK (char_length(btrim(body)) BETWEEN 1 AND 500),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS song_bookmarks (
  song_id              INTEGER NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  user_id              TEXT    NOT NULL REFERENCES app_users(clerk_user_id) ON DELETE CASCADE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (song_id, user_id)
);

CREATE TABLE IF NOT EXISTS app_notifications (
  id                   SERIAL PRIMARY KEY,
  recipient_user_id    TEXT NOT NULL REFERENCES app_users(clerk_user_id) ON DELETE CASCADE,
  actor_user_id        TEXT REFERENCES app_users(clerk_user_id) ON DELETE SET NULL,
  song_id              INTEGER NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  comment_id           INTEGER REFERENCES song_comments(id) ON DELETE CASCADE,
  type                 TEXT NOT NULL CONSTRAINT app_notifications_type_check CHECK (type IN ('comment', 'reply')),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at              TIMESTAMPTZ
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'song_comments_body_check') THEN
    ALTER TABLE song_comments ADD CONSTRAINT song_comments_body_check CHECK (char_length(btrim(body)) BETWEEN 1 AND 500) NOT VALID;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS reminder_runs (
  id                   SERIAL PRIMARY KEY,
  job_name             TEXT        NOT NULL,
  idempotency_key      TEXT        NOT NULL UNIQUE,
  period_start         DATE        NOT NULL,
  period_end           DATE        NOT NULL,
  status               TEXT        NOT NULL CONSTRAINT reminder_runs_status_check CHECK (status IN ('started', 'sent', 'failed')),
  message_text         TEXT        NOT NULL,
  google_chat_response JSONB,
  error_message        TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at              TIMESTAMPTZ,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reminder_runs_status_check') THEN
    ALTER TABLE reminder_runs ADD CONSTRAINT reminder_runs_status_check CHECK (status IN ('started', 'sent', 'failed')) NOT VALID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS app_users_email_idx
  ON app_users (lower(email));

CREATE INDEX IF NOT EXISTS songs_submitted_date_idx
  ON songs (submitted_date DESC);
CREATE INDEX IF NOT EXISTS songs_year_month_idx
  ON songs (year, month);
CREATE INDEX IF NOT EXISTS songs_youtube_video_id_idx
  ON songs (youtube_video_id);
CREATE INDEX IF NOT EXISTS songs_submitter_user_id_idx
  ON songs (submitter_user_id);

CREATE INDEX IF NOT EXISTS song_likes_user_id_idx
  ON song_likes (user_id);
CREATE INDEX IF NOT EXISTS song_likes_created_at_idx
  ON song_likes (created_at DESC);

CREATE INDEX IF NOT EXISTS song_comments_song_parent_created_idx
  ON song_comments (song_id, parent_comment_id, created_at, id);
CREATE INDEX IF NOT EXISTS song_comments_user_created_idx
  ON song_comments (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS song_comments_parent_comment_id_idx
  ON song_comments (parent_comment_id);
CREATE INDEX IF NOT EXISTS song_bookmarks_user_created_idx
  ON song_bookmarks (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS app_notifications_recipient_created_idx
  ON app_notifications (recipient_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS reminder_runs_job_created_idx
  ON reminder_runs (job_name, created_at DESC);
CREATE INDEX IF NOT EXISTS reminder_runs_period_idx
  ON reminder_runs (job_name, period_start, period_end);

CREATE OR REPLACE FUNCTION app_users_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS app_users_set_updated_at ON app_users;
CREATE TRIGGER app_users_set_updated_at
  BEFORE UPDATE ON app_users
  FOR EACH ROW EXECUTE FUNCTION app_users_set_updated_at();

CREATE OR REPLACE FUNCTION songs_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS songs_set_updated_at ON songs;
CREATE TRIGGER songs_set_updated_at
  BEFORE UPDATE ON songs
  FOR EACH ROW EXECUTE FUNCTION songs_set_updated_at();

CREATE OR REPLACE FUNCTION song_comments_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS song_comments_set_updated_at ON song_comments;
CREATE TRIGGER song_comments_set_updated_at
  BEFORE UPDATE ON song_comments
  FOR EACH ROW EXECUTE FUNCTION song_comments_set_updated_at();

CREATE OR REPLACE FUNCTION reminder_runs_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS reminder_runs_set_updated_at ON reminder_runs;
CREATE TRIGGER reminder_runs_set_updated_at
  BEFORE UPDATE ON reminder_runs
  FOR EACH ROW EXECUTE FUNCTION reminder_runs_set_updated_at();
`;

export function ensureSchema(): Promise<void> {
  if (!globalForPg.__pgSchemaReady) {
    globalForPg.__pgSchemaReady = getPool()
      .query(SCHEMA_SQL)
      .then(() => undefined)
      .catch((err) => {
        // Let the next call retry if this one fails.
        globalForPg.__pgSchemaReady = undefined;
        throw err;
      });
  }
  return globalForPg.__pgSchemaReady;
}
