-- ============================================================
-- 004_create_goals.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS goals (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id    UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cycle_id       UUID          NOT NULL REFERENCES goal_cycles(id) ON DELETE CASCADE,
  thrust_area_id UUID          REFERENCES thrust_areas(id) ON DELETE SET NULL,
  title          VARCHAR(255)  NOT NULL,
  description    TEXT,
  uom_type       VARCHAR(20)   NOT NULL CHECK (uom_type IN ('min', 'max', 'timeline', 'zero')),
  target_value   NUMERIC,
  target_date    DATE,
  weightage      NUMERIC(5,2)  NOT NULL,
  status         VARCHAR(20)   DEFAULT 'draft'
                               CHECK (status IN ('draft', 'submitted', 'approved', 'rework')),
  rework_comment TEXT,
  is_locked      BOOLEAN       DEFAULT FALSE,
  is_shared      BOOLEAN       DEFAULT FALSE,
  parent_goal_id UUID          REFERENCES goals(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ   DEFAULT NOW(),
  updated_at     TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_goals_employee_id ON goals(employee_id);
CREATE INDEX IF NOT EXISTS idx_goals_cycle_id    ON goals(cycle_id);
CREATE INDEX IF NOT EXISTS idx_goals_status      ON goals(status);
CREATE INDEX IF NOT EXISTS idx_goals_parent_id   ON goals(parent_goal_id);

DROP TRIGGER IF EXISTS trg_goals_updated_at ON goals;
CREATE TRIGGER trg_goals_updated_at
  BEFORE UPDATE ON goals
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
