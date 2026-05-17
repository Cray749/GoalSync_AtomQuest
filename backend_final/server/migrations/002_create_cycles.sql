-- ============================================================
-- 002_create_cycles.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS goal_cycles (
  id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(100) NOT NULL,
  year          INTEGER NOT NULL,
  phase1_start  DATE    NOT NULL,
  phase1_end    DATE    NOT NULL,
  q1_start      DATE    NOT NULL,
  q1_end        DATE    NOT NULL,
  q2_start      DATE    NOT NULL,
  q2_end        DATE    NOT NULL,
  q3_start      DATE    NOT NULL,
  q3_end        DATE    NOT NULL,
  q4_start      DATE    NOT NULL,
  q4_end        DATE    NOT NULL,
  is_active     BOOLEAN DEFAULT FALSE,
  created_by    UUID    REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cycles_is_active ON goal_cycles(is_active);
CREATE INDEX IF NOT EXISTS idx_cycles_year      ON goal_cycles(year);
