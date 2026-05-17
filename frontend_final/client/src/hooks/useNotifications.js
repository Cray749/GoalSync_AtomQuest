/**
 * useNotifications.js
 * GoalSync — Custom hook for the notification bell.
 *
 * Features:
 *   • Fetches notifications on mount
 *   • Polls every 30 seconds for new notifications
 *   • Exposes unread count, list, loading state
 *   • markOne / markAll / remove helpers
 *   • Stops polling when tab is not visible (performance optimization)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} from '../services/notificationService';

const POLL_INTERVAL_MS = 30_000; // 30 seconds

// Demo/mock data for when API is unavailable
const MOCK_NOTIFICATIONS = [
  {
    id: 'n1',
    title: 'Your goals have been approved ✅',
    message: 'Rahul Verma approved 4 goals for FY 2025-26',
    link: '/employee/goals',
    is_read: false,
    created_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(), // 15 min ago
  },
  {
    id: 'n2',
    title: 'Q1 check-in window is open',
    message: 'Log your achievements for FY 2025-26 before the deadline',
    link: '/employee/checkin',
    is_read: false,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2h ago
  },
  {
    id: 'n3',
    title: 'Goal returned for revision',
    message: 'Rahul Verma returned "Increase Sales Revenue" — please revise and resubmit',
    link: '/employee/goals',
    is_read: true,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(), // 1 day ago
  },
  {
    id: 'n4',
    title: '⚠ Escalation alert',
    message: 'Meera Patel has not submitted their goals',
    link: '/manager/team',
    is_read: true,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 50).toISOString(), // 2 days ago
  },
];

const USE_MOCK = import.meta.env.VITE_USE_MOCK_DATA === 'true' || !import.meta.env.VITE_API_URL;

export function useNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount]     = useState(0);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState(null);
  const pollRef = useRef(null);

  const fetchNotifications = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      if (USE_MOCK) {
        // Simulate latency
        await new Promise(r => setTimeout(r, 300));
        setNotifications(MOCK_NOTIFICATIONS);
        setUnreadCount(MOCK_NOTIFICATIONS.filter(n => !n.is_read).length);
        setError(null);
        return;
      }

      const data = await getNotifications({ limit: 30 });
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
      setError(null);
    } catch (err) {
      if (!silent) setError(err.message);
      // On silent poll failure, keep existing state
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Polling — pause when tab hidden
  useEffect(() => {
    const startPoll = () => {
      pollRef.current = setInterval(() => {
        if (!document.hidden) {
          fetchNotifications(true); // silent = don't show loading
        }
      }, POLL_INTERVAL_MS);
    };

    const stopPoll = () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };

    startPoll();
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stopPoll();
      else {
        fetchNotifications(true);
        startPoll();
      }
    });

    return () => {
      stopPoll();
      document.removeEventListener('visibilitychange', () => {});
    };
  }, [fetchNotifications]);

  // ─── Actions ─────────────────────────────────────────────────────────────

  const markOne = useCallback(async (id) => {
    // Optimistic update
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, is_read: true } : n)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));

    if (!USE_MOCK) {
      try { await markAsRead(id); } catch { /* revert on error */ fetchNotifications(true); }
    }
  }, [fetchNotifications]);

  const markAll = useCallback(async () => {
    // Optimistic update
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);

    if (!USE_MOCK) {
      try { await markAllAsRead(); } catch { fetchNotifications(true); }
    }
  }, [fetchNotifications]);

  const remove = useCallback(async (id) => {
    // Optimistic update
    const removed = notifications.find(n => n.id === id);
    setNotifications(prev => prev.filter(n => n.id !== id));
    if (removed && !removed.is_read) {
      setUnreadCount(prev => Math.max(0, prev - 1));
    }

    if (!USE_MOCK) {
      try { await deleteNotification(id); } catch { fetchNotifications(true); }
    }
  }, [notifications, fetchNotifications]);

  return {
    notifications,
    unreadCount,
    loading,
    error,
    refetch: fetchNotifications,
    markOne,
    markAll,
    remove,
  };
}
