CREATE TABLE IF NOT EXISTS projects (
  id         SERIAL PRIMARY KEY,
  key        TEXT UNIQUE NOT NULL,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS feedback (
  id              SERIAL PRIMARY KEY,
  project_id      INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title           TEXT,
  comment         TEXT,
  category        TEXT NOT NULL DEFAULT 'bug',        -- bug | cosmetic | enhancement | content | question
  status          TEXT NOT NULL DEFAULT 'open',      -- open | in_progress | done | wontfix
  priority        TEXT NOT NULL DEFAULT 'normal',    -- low | normal | high
  assignee        TEXT,
  url             TEXT,
  viewport_w      INTEGER,
  viewport_h      INTEGER,
  user_agent      TEXT,
  reporter        TEXT,
  screenshot_path TEXT,
  annotations     JSONB NOT NULL DEFAULT '[]'::jsonb,
  meta            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Mevcut tabloya kolon ekle (yeni alanlar için self-healing)
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'bug';
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS votes INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_feedback_project ON feedback(project_id);
CREATE INDEX IF NOT EXISTS idx_feedback_status  ON feedback(status);

CREATE TABLE IF NOT EXISTS feedback_comments (
  id          SERIAL PRIMARY KEY,
  feedback_id INTEGER NOT NULL REFERENCES feedback(id) ON DELETE CASCADE,
  author      TEXT,
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fc_feedback ON feedback_comments(feedback_id);

-- Örnek projeler (yalnızca yoksa)
INSERT INTO projects (key, name) VALUES ('metaworks', 'Metaworks')
  ON CONFLICT (key) DO NOTHING;
INSERT INTO projects (key, name) VALUES ('app2', 'App 2')
  ON CONFLICT (key) DO NOTHING;
