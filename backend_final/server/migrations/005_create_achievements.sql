-- ============================================================
-- 005_create_achievements.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS goal_achievements (
  id               UUID       PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id          UUID       NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  quarter          VARCHAR(5) NOT NULL CHECK (quarter IN ('Q1', 'Q2', 'Q3', 'Q4')),
  planned_value    NUMERIC,
  actual_value     NUMERIC,
  completion_date  DATE,
  goal_status      VARCHAR(20) DEFAULT 'not_started'
                               CHECK (goal_status IN ('not_started', 'on_track', 'completed', 'at_risk')),
  submitted_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (goal_id, quarter)
);

CREATE INDEX IF NOT EXISTS idx_achievements_goal_id ON goal_achievements(goal_id);
CREATE INDEX IF NOT EXISTS idx_achievements_quarter ON goal_achievements(quarter);

DROP TRIGGER IF EXISTS trg_achievements_updated_at ON goal_achievements;
CREATE TRIGGER trg_achievements_updated_at
  BEFORE UPDATE ON goal_achievements
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
