import { useState, useEffect, useCallback } from 'react';
import { goalService } from '../services/goalService';
import { cycleService } from '../services/index.js';
import { useToast } from '../components/common/Toast';
import { calculateScore, toDisplayPct, computeOverallScore } from '../utils/scoreCalc';

/**
 * useGoals — fetches and computes scored goals for the authenticated employee.
 * Returns goals enriched with computed scores + overall score.
 */
export function useGoals(options = {}) {
  const toast = useToast();
  const [goals, setGoals] = useState([]);
  const [cycle, setCycle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [goalsRes, cycleRes] = await Promise.all([
        goalService.getMyGoals(options.cycleId),
        cycleService.getActive(),
      ]);

      // FIX 4: Backend returns { data: { goals: [...], active_window, active_quarter, cycle_id } }
      const cycleInfo = goalsRes.data.data;
      const raw = cycleInfo?.goals || [];

      setCycle(cycleRes.data.data);

      // Enrich with computed scores
      const enriched = raw.map((g) => {
        const latest = g.achievements?.slice(-1)[0];
        const rawScore = latest
          ? calculateScore(
              g.uom_type,
              g.target_value,
              latest.actual_value,
              g.target_date,
              latest.completion_date
            )
          : null;
        return {
          ...g,
          score: rawScore,
          displayScore: rawScore !== null ? toDisplayPct(rawScore) : null,
          weightedScore: rawScore !== null ? rawScore * (parseFloat(g.weightage) / 100) : null,
        };
      });

      setGoals(enriched);

      // FIX 4: Also update cycle state with window info from goals response
      if (cycleInfo) {
        setCycle(prev => ({
          ...prev,
          active_window:        cycleInfo.active_window,
          active_quarter:       cycleInfo.active_quarter,
          is_goal_setting_open: cycleInfo.active_window === 'phase1',
          is_checkin_open:      ['q1', 'q2', 'q3', 'q4'].includes(cycleInfo.active_window),
        }));
      }
    } catch (err) {
      setError(err.message);
      if (options.silent !== true) toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [options.cycleId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Derived values
  const overallScore = computeOverallScore(
    goals.map((g) => ({ score: g.score, weightage: g.weightage }))
  );

  const approvedGoals = goals.filter((g) => g.status === 'approved');
  const submittedGoals = goals.filter((g) => g.status === 'submitted');
  const draftGoals = goals.filter((g) => g.status === 'draft');
  const reworkGoals = goals.filter((g) => g.status === 'rework');
  const totalWeightage = goals.reduce((s, g) => s + parseFloat(g.weightage || 0), 0);

  return {
    goals,
    cycle,
    loading,
    error,
    refresh: fetchAll,
    // Derived
    overallScore,
    approvedGoals,
    submittedGoals,
    draftGoals,
    reworkGoals,
    totalWeightage,
    isWeightageValid: Math.abs(totalWeightage - 100) < 0.01,
    canSubmit: cycle?.is_goal_setting_open && goals.length > 0 &&
               goals.every((g) => ['draft', 'rework'].includes(g.status)) &&
               Math.abs(totalWeightage - 100) < 0.01,
    canAddGoal: cycle?.is_goal_setting_open && goals.length < 8 &&
                !goals.some((g) => ['submitted', 'approved'].includes(g.status)),
  };
}
