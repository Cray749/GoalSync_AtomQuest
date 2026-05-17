-- ============================================================
-- 003_create_thrust_areas.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS thrust_areas (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(150) NOT NULL,
  description TEXT,
  cycle_id    UUID        REFERENCES goal_cycles(id) ON DELETE CASCADE,
  created_by  UUID        REFERENCES users(id) ON DELETE SET NULL,
  is_active   BOOLEAN     DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_thrust_cycle_id ON thrust_areas(cycle_id);
