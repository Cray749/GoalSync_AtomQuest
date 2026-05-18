import AppShell from '../components/common/AppShell';
import { useNotifications } from '../hooks/useNotifications';
import { useNavigate } from 'react-router-dom';
import { PageLoader } from '../components/common/LoadingSpinner';

function relativeTime(isoString) {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return 'just now';
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7)   return `${days}d ago`;
  return new Date(isoString).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getIcon(title = '') {
  if (title.includes('approved') || title.includes('✅')) return '✅';
  if (title.includes('rework') || title.includes('revision')) return '✏️';
  if (title.includes('check-in') || title.includes('window')) return '📊';
  if (title.includes('submitted')) return '📋';
  if (title.includes('escalation') || title.includes('⚠')) return '⚠️';
  if (title.includes('Shared') || title.includes('shared')) return '🔗';
  if (title.includes('unlocked')) return '🔓';
  return '🔔';
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { notifications, unreadCount, loading, markOne, markAll, remove } = useNotifications();

  if (loading && notifications.length === 0) {
    return <AppShell><PageLoader /></AppShell>;
  }

  return (
    <AppShell>
      <div className="gs-page-header flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Notifications</h1>
          <p className="text-sm text-slate-400 mt-1">
            {notifications.length} total · {unreadCount} unread
          </p>
        </div>
        {unreadCount > 0 && (
          <button onClick={markAll} className="gs-btn-ghost text-xs py-1.5 px-4">
            Mark all as read
          </button>
        )}
      </div>

      <div className="gs-card overflow-hidden">
        {notifications.length === 0 ? (
          <div className="py-20 text-center">
            <div className="text-4xl mb-3">🎉</div>
            <p className="text-slate-300 font-medium">You're all caught up!</p>
            <p className="text-slate-500 text-sm mt-1">No notifications yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-[#162d58]">
            {notifications.map((n) => (
              <div
                key={n.id}
                role="button"
                tabIndex={0}
                onClick={() => {
                  if (!n.is_read) markOne(n.id);
                  if (n.link && n.link !== '/notifications') navigate(n.link);
                }}
                onKeyDown={(e) => e.key === 'Enter' && (() => {
                  if (!n.is_read) markOne(n.id);
                  if (n.link && n.link !== '/notifications') navigate(n.link);
                })()}
                className={`flex items-start gap-4 px-5 py-4 transition-colors cursor-pointer hover:bg-[#0f2040] ${
                  !n.is_read ? 'bg-[#0a1e40]' : ''
                }`}
              >
                {/* Unread dot */}
                <div className="w-2 mt-2 shrink-0">
                  {!n.is_read && (
                    <div className="w-2 h-2 rounded-full bg-[#2563eb]" />
                  )}
                </div>

                {/* Icon */}
                <div className="w-9 h-9 rounded-lg bg-[#162d58] flex items-center justify-center text-base shrink-0">
                  {getIcon(n.title)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${n.is_read ? 'text-slate-300 font-normal' : 'text-slate-100 font-medium'}`}>
                    {n.title}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{n.message}</p>
                  <p className="text-[10px] text-slate-600 mt-1 font-mono">{relativeTime(n.created_at)}</p>
                </div>

                {/* Delete */}
                <button
                  onClick={(e) => { e.stopPropagation(); remove(n.id); }}
                  className="shrink-0 w-7 h-7 rounded flex items-center justify-center text-slate-600 hover:text-red-400 hover:bg-red-900/20 transition-colors"
                  aria-label="Delete notification"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
