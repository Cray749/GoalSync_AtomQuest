import api from './api';

export const goalService = {
  getMyGoals: (cycleId) =>
    api.get('/goals', { params: cycleId ? { cycle_id: cycleId } : {} }),

  getGoalById: (id) =>
    api.get(`/goals/${id}`),

  createGoal: (data) =>
    api.post('/goals', data),

  updateGoal: (id, data) =>
    api.put(`/goals/${id}`, data),

  deleteGoal: (id) =>
    api.delete(`/goals/${id}`),

  submitGoals: (cycleId) =>
    api.post('/goals/submit', cycleId ? { cycle_id: cycleId } : {}),

  getGoalAuditTrail: (id) =>
    api.get(`/goals/${id}/audit`),
};
