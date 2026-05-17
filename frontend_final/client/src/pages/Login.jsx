import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/common/Toast';

const DEMO_CREDS = [
  { label: 'Login as Admin', email: 'admin@goalsynce.com', password: 'Admin@123', role: 'admin', color: 'text-violet-400 border-violet-500/30 hover:bg-violet-900/20' },
  { label: 'Login as Manager', email: 'manager@goalsynce.com', password: 'Manager@123', role: 'manager', color: 'text-amber-400 border-amber-500/30 hover:bg-amber-900/20' },
  { label: 'Login as Employee', email: 'employee@goalsynce.com', password: 'Employee@123', role: 'employee', color: 'text-blue-400 border-blue-500/30 hover:bg-blue-900/20' },
  { label: 'Employee 2', email: 'employee2@goalsynce.com', password: 'Employee@123', role: 'employee', color: 'text-emerald-400 border-emerald-500/30 hover:bg-emerald-900/20' },
];

function getRoleHome(role) {
  if (role === 'admin') return '/admin';
  if (role === 'manager') return '/manager';
  return '/employee';
}

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const from = location.state?.from?.pathname;

  async function handleSubmit(e) {
    e?.preventDefault();
    if (!email || !password) { setError('Email and password are required'); return; }
    setError('');
    setLoading(true);
    try {
      const user = await login(email, password);
      navigate(from || getRoleHome(user.role), { replace: true });
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleDemo(cred) {
    setEmail(cred.email);
    setPassword(cred.password);
    setError('');
    setLoading(true);
    try {
      const user = await login(cred.email, cred.password);
      navigate(getRoleHome(user.role), { replace: true });
    } catch (err) {
      setError(err.message || 'Demo login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#060d1f] gs-grid-bg flex items-center justify-center p-4">
      {/* Background radial glow */}
      <div className="fixed inset-0 bg-radial-glow pointer-events-none" />

      <div className="w-full max-w-md relative">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#0a1628] border border-[#162d58] shadow-glow mb-4">
            <svg className="w-7 h-7 text-[#2563eb]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="9" />
              <circle cx="12" cy="12" r="4" />
              <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
              <line x1="12" y1="2" x2="12" y2="5.5" strokeLinecap="round" />
              <line x1="12" y1="18.5" x2="12" y2="22" strokeLinecap="round" />
              <line x1="2" y1="12" x2="5.5" y2="12" strokeLinecap="round" />
              <line x1="18.5" y1="12" x2="22" y2="12" strokeLinecap="round" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">GoalSync</h1>
          <p className="text-sm text-slate-500 mt-1">In-house goal setting & tracking</p>
        </div>

        {/* Login card */}
        <div className="gs-card p-8 shadow-glow">
          <h2 className="text-base font-semibold text-slate-200 mb-6">Sign in to your account</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="gs-label">Email</label>
              <input
                type="email"
                className="gs-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                autoComplete="email"
                autoFocus
              />
            </div>
            <div>
              <label className="gs-label">Password</label>
              <input
                type="password"
                className="gs-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="px-3 py-2 bg-red-900/20 border border-red-500/30 rounded text-sm text-red-400">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="gs-btn w-full py-2.5 text-sm font-semibold"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in…
                </span>
              ) : 'Sign In'}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-[#162d58]" />
            <span className="text-xs text-slate-600 font-mono">DEMO ACCOUNTS</span>
            <div className="flex-1 h-px bg-[#162d58]" />
          </div>

          {/* Demo buttons */}
          <div className="grid grid-cols-2 gap-2">
            {DEMO_CREDS.map((cred) => (
              <button
                key={cred.email}
                onClick={() => handleDemo(cred)}
                disabled={loading}
                className={`px-3 py-2 text-xs font-medium rounded-gs border transition-all disabled:opacity-40 ${cred.color}`}
              >
                {cred.label}
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-600 mt-6">
          AtomQuest Hackathon 1.0 · GoalSync v1.0
        </p>
      </div>
    </div>
  );
}
