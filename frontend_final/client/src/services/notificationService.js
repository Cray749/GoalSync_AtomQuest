/**
 * notificationService.js
 * GoalSync frontend — API calls for the notification system.
 * Uses the shared Axios instance from services/api.js (JWT interceptor already attached).
 */

import api from './api';

/**
 * Fetch current user's notifications.
 * @param {object} opts
 * @param {number}  opts.limit       - default 20
 * @param {number}  opts.offset      - for pagination
 * @param {boolean} opts.unreadOnly
 * @returns {Promise<{notifications: object[], unreadCount: number}>}
 */
export async function getNotifications({ limit = 20, offset = 0, unreadOnly = false } = {}) {
  const params = new URLSearchParams({ limit, offset });
  if (unreadOnly) params.set('unread', 'true');
  const res = await api.get(`/notifications?${params}`);
  return res.data.data; // { notifications, unreadCount }
}

/**
 * Mark a single notification as read.
 * @param {string} notificationId
 */
export async function markAsRead(notificationId) {
  await api.patch(`/notifications/${notificationId}/read`);
}

/**
 * Mark all notifications as read.
 * @returns {Promise<number>} count updated
 */
export async function markAllAsRead() {
  const res = await api.patch('/notifications/read-all');
  return res.data.data?.count || 0;
}

/**
 * Delete a single notification.
 * @param {string} notificationId
 */
export async function deleteNotification(notificationId) {
  await api.delete(`/notifications/${notificationId}`);
}
