import AppShell from '../components/common/AppShell';
import { useAuth } from '../hooks/useAuth';

export default function ProfilePage() {
  const { user } = useAuth();

  if (!user) return null;

  const roleInitial = user?.name?.[0]?.toUpperCase() || '?';

  return (
    <AppShell>
      <div className="gs-page-header">
        <h1 className="text-2xl font-bold text-slate-100">My Profile</h1>
        <p className="text-sm text-slate-400 mt-1">View your account details and role</p>
      </div>

      <div className="max-w-2xl">
        <div className="gs-card overflow-hidden">
          {/* Header banner */}
          <div className="h-32 bg-gradient-to-r from-[#162d58] to-[#0f2040]" />
          
          <div className="px-8 pb-8 relative">
            {/* Avatar */}
            <div className="absolute -top-12 left-8">
              <div className="w-24 h-24 rounded-xl bg-[#060d1f] p-1.5">
                <div className="w-full h-full rounded-lg bg-[#2563eb]/20 border border-[#2563eb]/40 flex items-center justify-center text-4xl font-bold text-[#60a5fa] shadow-glow-lg">
                  {roleInitial}
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="pt-16">
              <h2 className="text-2xl font-bold text-slate-100">{user.name}</h2>
              <p className="text-slate-400 text-sm mt-1">{user.email}</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Role</p>
                  <p className="text-sm font-medium text-slate-200 capitalize bg-[#0f2040] inline-block px-3 py-1.5 rounded-md border border-[#162d58]">
                    {user.role}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Department</p>
                  <p className="text-sm font-medium text-slate-200 bg-[#0f2040] inline-block px-3 py-1.5 rounded-md border border-[#162d58]">
                    {user.department || 'Not specified'}
                  </p>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-[#162d58]">
                <p className="text-xs text-slate-500">
                  To update your profile details or change your password, please contact your system administrator.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
