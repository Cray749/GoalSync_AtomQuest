-- ============================================================
-- 006_create_checkins.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS manager_checkins (
  id          UUID       PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id     UUID       NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  manager_id  UUID       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quarter     VARCHAR(5) NOT NULL CHECK (quarter IN ('Q1', 'Q2', 'Q3', 'Q4')),
  comment     TEXT       NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (goal_id, manager_id, quarter)
);

CREATE INDEX IF NOT EXISTS idx_checkins_goal_id    ON manager_checkins(goal_id);
CREATE INDEX IF NOT EXISTS idx_checkins_manager_id ON manager_checkins(manager_id);
