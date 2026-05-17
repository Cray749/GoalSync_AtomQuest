import api from './api';

// ── Achievements ──────────────────────────────────────────────────────────────
export const achievementService = {
  getAchievements: (goalId) =>
    api.get(`/achievements/${goalId}`),

  submitAchievement: (data) =>
    api.post('/achievements', data),

  updateAchievement: (id, data) =>
    api.put(`/achievements/${id}`, data),
};

// ── Manager ───────────────────────────────────────────────────────────────────
export const managerService = {
  getTeam: () =>
    api.get('/manager/team'),

  getEmployeeGoals: (employeeId, cycleId) =>
    api.get(`/manager/team/${employeeId}/goals`, { params: cycleId ? { cycle_id: cycleId } : {} }),

  getApprovalQueue: (cycleId) =>
    api.get('/manager/approval-queue', { params: cycleId ? { cycle_id: cycleId } : {} }),

  approveGoal: (goalId) =>
    api.put(`/manager/goals/${goalId}/approve`),

  returnForRework: (goalId, comment) =>
    api.put(`/manager/goals/${goalId}/rework`, { comment }),

  inlineEditGoal: (goalId, data) =>
    api.put(`/manager/goals/${goalId}/edit`, data),

  // FIX 7: Changed from api.post to api.put with employeeId in URL
  approveAllGoals: (employeeId, cycleId) =>
    api.put(`/manager/goals/approve-all/${employeeId}`, cycleId ? { cycle_id: cycleId } : {}),

  submitCheckin: (data) =>
    api.post('/manager/checkin', data),

  getCheckins: (employeeId, quarter) =>
    api.get(`/manager/checkin/${employeeId}/${quarter}`),

  getTeamProgress: (cycleId) =>
    api.get('/manager/team-progress', { params: cycleId ? { cycle_id: cycleId } : {} }),
};

// ── Admin ─────────────────────────────────────────────────────────────────────
export const adminService = {
  // Cycles
  getCycles: () => api.get('/admin/cycles'),
  createCycle: (data) => api.post('/admin/cycles', data),
  updateCycle: (id, data) => api.put(`/admin/cycles/${id}`, data),
  activateCycle: (id) => api.put(`/admin/cycles/${id}/activate`),

  // Thrust areas
  getThrustAreas: (cycleId) =>
    api.get('/admin/thrust-areas', { params: cycleId ? { cycle_id: cycleId } : {} }),
  createThrustArea: (data) => api.post('/admin/thrust-areas', data),
  updateThrustArea: (id, data) => api.put(`/admin/thrust-areas/${id}`, data),
  deleteThrustArea: (id) => api.delete(`/admin/thrust-areas/${id}`),

  // Users
  getUsers: (params) => api.get('/admin/users', { params }),
  createUser: (data) => api.post('/admin/users', data),
  updateUser: (id, data) => api.put(`/admin/users/${id}`, data),
  deactivateUser: (id) => api.put(`/admin/users/${id}/deactivate`),
  assignManager: (id, managerId) => api.put(`/admin/users/${id}/manager`, { manager_id: managerId }),

  // Shared goals
  pushSharedGoal: (data) => api.post('/admin/shared-goals', data),

  // Goal unlock
  unlockGoal: (id, reason) => api.post(`/admin/goals/${id}/unlock`, { reason }),

  // Dashboard
  getOrgStats: (cycleId) =>
    api.get('/admin/stats', { params: cycleId ? { cycle_id: cycleId } : {} }),
  getCompletionDashboard: (cycleId) =>
    api.get('/admin/completion', { params: cycleId ? { cycle_id: cycleId } : {} }),
  getAuditLogs: (params) => api.get('/admin/audit-logs', { params }),
};

// ── Reports ───────────────────────────────────────────────────────────────────
export const reportService = {
  getAchievement: (params) => api.get('/reports/achievement', { params }),
  downloadAchievement: (format, cycleId) =>
    api.get('/reports/achievement', {
      params: { format, cycle_id: cycleId },
      responseType: 'blob',
    }),
  getCompletionRate: (cycleId) =>
    api.get('/reports/completion-rate', { params: cycleId ? { cycle_id: cycleId } : {} }),
  getGoalDistribution: (cycleId) =>
    api.get('/reports/goal-distribution', { params: cycleId ? { cycle_id: cycleId } : {} }),
  getQoQTrend: (params) => api.get('/reports/qoq-trend', { params }),
  getManagerEffectiveness: (cycleId) =>
    api.get('/reports/manager-effectiveness', { params: cycleId ? { cycle_id: cycleId } : {} }),
};

// ── Active Cycle ──────────────────────────────────────────────────────────────
// FIX 1: Changed from '/cycle/active' to '/goals/cycle'
export const cycleService = {
  getActive: () => api.get('/goals/cycle'),
};
