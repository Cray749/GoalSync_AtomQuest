import { useState, useEffect } from 'react';
import { cycleService } from '../services/index.js';

/**
 * useCycle — fetches the active goal cycle from the server.
 * Includes window state (phase1, q1–q4, null).
 */
export function useCycle() {
  const [cycle, setCycle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function fetch() {
      setLoading(true);
      try {
        const res = await cycleService.getActive();
        if (!cancelled) setCycle(res.data.data);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetch();
    return () => { cancelled = true; };
  }, []);

  return {
    cycle,
    loading,
    error,
    isGoalSettingOpen: cycle?.is_goal_setting_open ?? false,
    isCheckinOpen: cycle?.is_checkin_open ?? false,
    activeWindow: cycle?.active_window ?? null,
    activeQuarter: cycle?.active_quarter ?? null,
  };
}
