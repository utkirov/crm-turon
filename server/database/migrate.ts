import type { Database } from 'better-sqlite3'

/** Creates all tables if they don't exist (idempotent) */
export function createTables(sqlite: Database) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS staff (
      id             TEXT PRIMARY KEY,
      name           TEXT NOT NULL,
      role           TEXT NOT NULL,
      specialization TEXT NOT NULL,
      position       TEXT NOT NULL,
      initials       TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS projects (
      id              TEXT PRIMARY KEY,
      name            TEXT NOT NULL,
      client          TEXT NOT NULL,
      location        TEXT NOT NULL,
      type            TEXT NOT NULL,
      pm_id           TEXT NOT NULL REFERENCES staff(id),
      contract_amount REAL NOT NULL DEFAULT 0,
      status          TEXT NOT NULL DEFAULT 'active',
      contact_person  TEXT,
      contact_phone   TEXT,
      contact_email   TEXT,
      start_date      TEXT,
      planned_end_date TEXT,
      created_at      TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS client_milestones (
      id         TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      label      TEXT NOT NULL,
      percent    REAL NOT NULL,
      amount     REAL NOT NULL,
      status     TEXT NOT NULL DEFAULT 'pending',
      due_date   TEXT,
      paid_at    TEXT
    );

    CREATE TABLE IF NOT EXISTS project_tasks (
      id               TEXT PRIMARY KEY,
      project_id       TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      task_id          TEXT NOT NULL,
      stage            TEXT NOT NULL,
      role             TEXT NOT NULL,
      staff_id         TEXT REFERENCES staff(id),
      price            REAL NOT NULL DEFAULT 0,
      status           TEXT NOT NULL DEFAULT 'todo',
      deadline         TEXT,
      note             TEXT,
      assigned_at      TEXT,
      pending_change_id TEXT
    );

    CREATE TABLE IF NOT EXISTS payment_splits (
      id       TEXT PRIMARY KEY,
      task_id  TEXT NOT NULL REFERENCES project_tasks(id) ON DELETE CASCADE,
      label    TEXT NOT NULL,
      percent  REAL NOT NULL,
      amount   REAL NOT NULL,
      status   TEXT NOT NULL DEFAULT 'pending',
      paid_at  TEXT
    );

    CREATE TABLE IF NOT EXISTS project_documents (
      id             TEXT PRIMARY KEY,
      project_id     TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      template_id    TEXT NOT NULL,
      name           TEXT NOT NULL,
      stage          TEXT NOT NULL,
      status         TEXT NOT NULL DEFAULT 'pending',
      received_date  TEXT,
      pending_reason TEXT
    );

    CREATE TABLE IF NOT EXISTS change_requests (
      id           TEXT PRIMARY KEY,
      project_id   TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      task_id      TEXT NOT NULL,
      type         TEXT NOT NULL,
      proposed_by  TEXT NOT NULL,
      proposed_at  TEXT NOT NULL,
      reason       TEXT NOT NULL,
      changes_json TEXT NOT NULL,
      status       TEXT NOT NULL DEFAULT 'pending'
    );

    CREATE TABLE IF NOT EXISTS change_approvals (
      id         TEXT PRIMARY KEY,
      request_id TEXT NOT NULL REFERENCES change_requests(id) ON DELETE CASCADE,
      role       TEXT NOT NULL,
      staff_id   TEXT NOT NULL,
      status     TEXT NOT NULL DEFAULT 'pending',
      date       TEXT,
      comment    TEXT
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id          TEXT PRIMARY KEY,
      project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      type        TEXT NOT NULL,
      amount      REAL NOT NULL,
      description TEXT NOT NULL,
      date        TEXT NOT NULL,
      category    TEXT NOT NULL,
      staff_id    TEXT REFERENCES staff(id),
      milestone_id TEXT,
      task_id     TEXT
    );
  `)
}
