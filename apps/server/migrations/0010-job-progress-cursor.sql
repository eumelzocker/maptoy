ALTER TABLE jobs ADD COLUMN progress_cursor TEXT;

CREATE TABLE job_errors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  message TEXT NOT NULL,
  item TEXT,
  created_at TEXT NOT NULL
) STRICT;

CREATE INDEX job_errors_job_index ON job_errors(job_id, id DESC);
