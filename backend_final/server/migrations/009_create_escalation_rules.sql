-- ============================================================
-- 009_create_escalation_rules.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS escalation_rules (
  id              UUID       PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_type       VARCHAR(50) NOT NULL
                  CHECK (rule_type IN ('goal_not_submitted', 'goal_not_approved', 'checkin_not_done')),
  days_threshold  INTEGER    NOT NULL DEFAULT 7,
  is_active       BOOLEAN    DEFAULT TRUE,
  created_by      UUID       REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS escalation_logs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id          UUID REFERENCES escalation_rules(id) ON DELETE SET NULL,
  target_user_id   UUID REFERENCES users(id) ON DELETE CASCADE,
  notified_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  reason           TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_esc_logs_target   ON escalation_logs(target_user_id);
CREATE INDEX IF NOT EXISTS idx_esc_logs_created  ON escalation_logs(created_at DESC);
