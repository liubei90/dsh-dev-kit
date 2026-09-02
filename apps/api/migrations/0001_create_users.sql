-- User accounts for the auth feature (proposed/feature/2026-09-02-user-accounts-and-login).
-- Emails are stored normalized (lowercase, trimmed) by the repository layer;
-- the unique index is the EMAIL_TAKEN enforcement point.
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX users_email_unique ON users (email);
