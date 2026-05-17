/**
 * NotificationBell.jsx
 * GoalSync — In-app notification bell with dropdown panel.
 *
 * Features:
 *   • Animated badge showing unread count (caps at 99+)
 *   • Dropdown panel with grouped notifications (new / earlier)
 *   • Per-notification: mark read on click, delete button
 *   • "Mark all read" button
 *   • Relative time display ("2 min ago", "1 day ago")
 *   • Click outside to close
 *   • Accessible: keyboard navigable, aria labels
 *   • Deep-link navigation on notification click
 *
 * Usage in Navbar.jsx:
 *   import NotificationBell from '../common/NotificationBell';
 *   <NotificationBell />
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../../hooks/useNotifications';

// ─── Relative time formatter ───────────────────────────────────────────────────
function relativeTime(isoString) {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7)  return `${days}d ago`;
  return new Date(isoString).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

// ─── Notification icon mapper ──────────────────────────────────────────────────
function getIcon(title = '') {
  if (title.includes('approved') || title.includes('✅')) return { icon: '✅', bg: '#EAF3DE', color: '#3B6D11' };
  if (title.includes('rework') || title.includes('revision')) return { icon: '✏️', bg: '#FAEEDA', color: '#854F0B' };
  if (title.includes('check-in') || title.includes('window')) return { icon: '📊', bg: '#E6F1FB', color: '#185FA5' };
  if (title.includes('submitted')) return { icon: '📋', bg: '#E6F1FB', color: '#185FA5' };
  if (title.includes('escalation') || title.includes('⚠')) return { icon: '⚠️', bg: '#FAECE7', color: '#993C1D' };
  return { icon: '🔔', bg: '#EEEDFE', color: '#534AB7' };
}

// ─── Single notification row ───────────────────────────────────────────────────
function NotificationRow({ notif, onRead, onDelete, onNavigate }) {
  const { icon, bg, color } = getIcon(notif.title);
  const [hovered, setHovered] = useState(false);

  const handleClick = () => {
    if (!notif.is_read) onRead(notif.id);
    if (notif.link) onNavigate(notif.link);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={e => e.key === 'Enter' && handleClick()}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '10px 14px',
        cursor: notif.link ? 'pointer' : 'default',
        background: hovered
          ? 'var(--color-background-secondary)'
          : notif.is_read
            ? 'transparent'
            : 'var(--color-background-info)',
        borderBottom: '0.5px solid var(--color-border-tertiary)',
        transition: 'background 0.12s',
        position: 'relative',
        outline: 'none',
      }}
    >
      {/* Unread dot */}
      {!notif.is_read && (
        <span style={{
          position: 'absolute',
          left: 4,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 5,
          height: 5,
          borderRadius: '50%',
          background: '#185FA5',
        }} />
      )}

      {/* Icon */}
      <div style={{
        width: 32,
        height: 32,
        borderRadius: 8,
        background: bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 15,
        flexShrink: 0,
      }}>
        {icon}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          margin: '0 0 2px',
          fontSize: 13,
          fontWeight: notif.is_read ? 400 : 500,
          color: 'var(--color-text-primary)',
          lineHeight: 1.35,
        }}>
          {notif.title}
        </p>
        <p style={{
          margin: '0 0 4px',
          fontSize: 11,
          color: 'var(--color-text-secondary)',
          lineHeight: 1.5,
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
        }}>
          {notif.message}
        </p>
        <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>
          {relativeTime(notif.created_at)}
        </span>
      </div>

      {/* Delete button — visible on hover */}
      {hovered && (
        <button
          onClick={e => { e.stopPropagation(); onDelete(notif.id); }}
          aria-label="Delete notification"
          style={{
            width: 20,
            height: 20,
            borderRadius: 4,
            border: 'none',
            background: 'var(--color-background-danger)',
            color: 'var(--color-text-danger)',
            cursor: 'pointer',
            fontSize: 11,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            alignSelf: 'center',
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}

// ─── Main bell component ───────────────────────────────────────────────────────
export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const panelRef  = useRef(null);
  const buttonRef = useRef(null);
  const navigate  = useNavigate?.() || { push: () => {} };

  const { notifications, unreadCount, loading, markOne, markAll, remove } =
    useNotifications();

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (
        panelRef.current  && !panelRef.current.contains(e.target) &&
        buttonRef.current && !buttonRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const handleNavigate = useCallback((link) => {
    setOpen(false);
    if (typeof navigate === 'function') navigate(link);
    else if (navigate?.push) navigate.push(link);
  }, [navigate]);

  // Group: today vs earlier
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todayNotifs   = notifications.filter(n => new Date(n.created_at) >= todayStart);
  const earlierNotifs = notifications.filter(n => new Date(n.created_at) < todayStart);

  const badgeCount = Math.min(unreadCount, 99);

  return (
    <div style={{ position: 'relative' }}>
      {/* Bell button */}
      <button
        ref={buttonRef}
        onClick={() => setOpen(o => !o)}
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
        aria-expanded={open}
        aria-haspopup="true"
        style={{
          position: 'relative',
          width: 36,
          height: 36,
          borderRadius: 'var(--border-radius-md)',
          border: open
            ? '1px solid var(--color-border-info)'
            : '0.5px solid var(--color-border-tertiary)',
          background: open
            ? 'var(--color-background-info)'
            : 'var(--color-background-secondary)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.15s',
          fontSize: 16,
        }}
      >
        🔔
        {/* Unread badge */}
        {unreadCount > 0 && (
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: -4,
              right: -4,
              minWidth: 16,
              height: 16,
              borderRadius: 8,
              background: '#E24B4A',
              color: '#ffffff',
              fontSize: 9,
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 4px',
              border: '1.5px solid var(--color-background-primary)',
              animation: 'badgePop 0.2s ease',
            }}
          >
            {badgeCount}{unreadCount > 99 ? '+' : ''}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Notifications"
          style={{
            position: 'absolute',
            top: 44,
            right: 0,
            width: 340,
            maxHeight: 520,
            background: 'var(--color-background-primary)',
            border: '0.5px solid var(--color-border-secondary)',
            borderRadius: 'var(--border-radius-lg)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.10)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            zIndex: 1000,
            animation: 'dropIn 0.15s ease',
          }}
        >
          {/* Panel header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 14px',
            borderBottom: '0.5px solid var(--color-border-tertiary)',
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                fontSize: 14,
                fontWeight: 500,
                color: 'var(--color-text-primary)',
              }}>
                Notifications
              </span>
              {unreadCount > 0 && (
                <span style={{
                  background: '#E6F1FB',
                  color: '#185FA5',
                  fontSize: 11,
                  fontWeight: 500,
                  padding: '1px 7px',
                  borderRadius: 10,
                }}>
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAll}
                style={{
                  fontSize: 11,
                  color: '#185FA5',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '2px 0',
                }}
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Notifications list */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {loading && notifications.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center' }}>
                <div style={{ fontSize: 20, marginBottom: 8 }}>🔔</div>
                <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>Loading…</p>
              </div>
            ) : notifications.length === 0 ? (
              <div style={{ padding: '32px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🎉</div>
                <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: 0 }}>
                  You're all caught up!
                </p>
                <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)', margin: '4px 0 0' }}>
                  No notifications yet
                </p>
              </div>
            ) : (
              <>
                {todayNotifs.length > 0 && (
                  <>
                    <SectionLabel>Today</SectionLabel>
                    {todayNotifs.map(n => (
                      <NotificationRow
                        key={n.id}
                        notif={n}
                        onRead={markOne}
                        onDelete={remove}
                        onNavigate={handleNavigate}
                      />
                    ))}
                  </>
                )}
                {earlierNotifs.length > 0 && (
                  <>
                    <SectionLabel>Earlier</SectionLabel>
                    {earlierNotifs.map(n => (
                      <NotificationRow
                        key={n.id}
                        notif={n}
                        onRead={markOne}
                        onDelete={remove}
                        onNavigate={handleNavigate}
                      />
                    ))}
                  </>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div style={{
              padding: '8px 14px',
              borderTop: '0.5px solid var(--color-border-tertiary)',
              textAlign: 'center',
              flexShrink: 0,
            }}>
              <button
                onClick={() => { setOpen(false); handleNavigate('/notifications'); }}
                style={{
                  fontSize: 12,
                  color: 'var(--color-text-secondary)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                View all notifications →
              </button>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes badgePop {
          0%  { transform: scale(0.5); opacity: 0; }
          70% { transform: scale(1.2); }
          100%{ transform: scale(1);   opacity: 1; }
        }
        @keyframes dropIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{
      padding: '8px 14px 4px',
      fontSize: 10,
      fontWeight: 500,
      color: 'var(--color-text-tertiary)',
      textTransform: 'uppercase',
      letterSpacing: '0.6px',
      background: 'var(--color-background-secondary)',
    }}>
      {children}
    </div>
  );
}
