import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import NotificationBell from './NotificationBell';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [userOpen, setUserOpen] = useState(false);

  // Determine active context from URL
  const isManagerView = location.pathname.startsWith('/manager');
  const isAdminView = location.pathname.startsWith('/admin');

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  const roleInitial = user?.name?.[0]?.toUpperCase() || '?';

  return (
    <header className="fixed top-0 left-0 right-0 z-40 h-14 border-b border-[#162d58] bg-[#060d1f]/95 backdrop-blur-sm">
      <div className="flex items-center justify-between h-full px-4 lg:px-6">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 shrink-0">
          <svg className="w-6 h-6 text-[#2563eb]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="9" />
            <circle cx="12" cy="12" r="4" />
            <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
            <line x1="12" y1="2" x2="12" y2="5" strokeLinecap="round" />
            <line x1="12" y1="19" x2="12" y2="22" strokeLinecap="round" />
            <line x1="2" y1="12" x2="5" y2="12" strokeLinecap="round" />
            <line x1="19" y1="12" x2="22" y2="12" strokeLinecap="round" />
          </svg>
          <span className="font-semibold text-slate-100 tracking-tight">Nucleas</span>
          <span className="hidden sm:block text-xs text-slate-600 font-mono pl-2 border-l border-[#162d58]">
            FY 2025-26
          </span>
        </Link>

        {/* Role context switcher — only for manager */}
        {user?.role === 'manager' && (
          <div className="flex items-center gap-1 bg-[#0a1628] border border-[#162d58] rounded-gs p-1">
            <button
              onClick={() => navigate('/employee')}
              className={`px-3 py-1 text-xs font-medium rounded transition-all ${
                !isManagerView && !isAdminView
                  ? 'bg-[#2563eb] text-white shadow-glow-sm'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              My Goals
            </button>
            <button
              onClick={() => navigate('/manager')}
              className={`px-3 py-1 text-xs font-medium rounded transition-all ${
                isManagerView
                  ? 'bg-[#2563eb] text-white shadow-glow-sm'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              My Team
            </button>
          </div>
        )}

        {/* Right actions */}
        <div className="flex items-center gap-2">

          {/* FIX 10: NotificationBell component (replaces inline notification code) */}
          <NotificationBell />

          {/* User menu */}
          <div className="relative">
            <button
              onClick={() => setUserOpen((o) => !o)}
              className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-gs hover:bg-[#0f2040] transition-colors border border-transparent hover:border-[#162d58]"
            >
              <div className="w-7 h-7 rounded-full bg-[#2563eb]/20 border border-[#2563eb]/40 flex items-center justify-center text-xs font-bold text-[#60a5fa]">
                {roleInitial}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-medium text-slate-200 leading-none">{user?.name}</p>
                <p className="text-[10px] text-slate-500 mt-0.5 capitalize">{user?.role}</p>
              </div>
              <svg className="w-3 h-3 text-slate-500 hidden sm:block" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {userOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setUserOpen(false)} />
                <div className="absolute right-0 top-full mt-2 z-20 w-52 gs-card shadow-glow-lg py-1">
                  <div className="px-4 py-2.5 border-b border-[#162d58]">
                    <p className="text-sm font-medium text-slate-200">{user?.name}</p>
                    <p className="text-xs text-slate-500">{user?.email}</p>
                    <p className="text-xs text-[#3b82f6] mt-0.5 capitalize">{user?.department} · {user?.role}</p>
                  </div>
                  {user?.role === 'admin' && (
                    <Link
                      to="/admin"
                      onClick={() => setUserOpen(false)}
                      className="flex items-center gap-2 w-full px-4 py-2 text-sm text-slate-300 hover:bg-[#0f2040] transition-colors"
                    >
                      Admin Panel
                    </Link>
                  )}
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-400 hover:bg-red-900/20 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Sign Out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
