import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './components/common/Toast';
import { ProtectedRoute, RoleGuard } from './components/common/ProtectedRoute';
import ErrorBoundary, { SectionErrorBoundary } from './components/common/ErrorBoundary';
import { PageLoader } from './components/common/LoadingSpinner';
import { useAuth } from './hooks/useAuth';

// ── Lazy-load all pages for code splitting ─────────────────────────────────
const Login = lazy(() => import('./pages/Login'));

// Employee
const EmployeeDashboard = lazy(() => import('./pages/employee/Dashboard'));
const GoalsPage         = lazy(() => import('./pages/employee/GoalsPage'));
const CheckinPage       = lazy(() => import('./pages/employee/CheckinPage'));

// Manager
const TeamDashboard = lazy(() => import('./pages/manager/TeamDashboard'));
const ApprovalQueue = lazy(() => import('./pages/manager/ApprovalQueue'));
const CheckinView   = lazy(() => import('./pages/manager/CheckinView'));

// Admin
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const Reports        = lazy(() => import('./pages/admin/Reports'));
const AdminSettings  = lazy(() => import('./pages/admin/Settings'));
const AuditLog       = lazy(() => import('./pages/admin/AuditLog'));
const Analytics      = lazy(() => import('./pages/admin/Analytics'));

// ── Lazy suspense + error boundary wrapper ─────────────────────────────────
function Page({ component: Component }) {
  return (
    <SectionErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <Component />
      </Suspense>
    </SectionErrorBoundary>
  );
}

// ── Smart root redirect ────────────────────────────────────────────────────
function RootRedirect() {
  const { user, isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role === 'admin') return <Navigate to="/admin" replace />;
  if (user?.role === 'manager') return <Navigate to="/manager" replace />;
  return <Navigate to="/employee" replace />;
}

// ── App with providers ────────────────────────────────────────────────────
export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <ToastProvider>
            <Routes>
              {/* Public */}
              <Route path="/login" element={<Page component={Login} />} />

              {/* Root: smart redirect */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <RootRedirect />
                  </ProtectedRoute>
                }
              />

              {/* ── Employee Routes ────────────────────────────── */}
              <Route
                path="/employee"
                element={
                  <ProtectedRoute>
                    <RoleGuard
                      roles={['employee', 'manager', 'admin']}
                      fallback={<Navigate to="/login" replace />}
                    >
                      <Page component={EmployeeDashboard} />
                    </RoleGuard>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/employee/goals"
                element={
                  <ProtectedRoute>
                    <RoleGuard
                      roles={['employee', 'manager', 'admin']}
                      fallback={<Navigate to="/login" replace />}
                    >
                      <Page component={GoalsPage} />
                    </RoleGuard>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/employee/checkin"
                element={
                  <ProtectedRoute>
                    <RoleGuard
                      roles={['employee', 'manager', 'admin']}
                      fallback={<Navigate to="/login" replace />}
                    >
                      <Page component={CheckinPage} />
                    </RoleGuard>
                  </ProtectedRoute>
                }
              />

              {/* ── Manager Routes ─────────────────────────────── */}
              <Route
                path="/manager"
                element={
                  <ProtectedRoute>
                    <RoleGuard
                      roles={['manager', 'admin']}
                      fallback={<Navigate to="/employee" replace />}
                    >
                      <Page component={TeamDashboard} />
                    </RoleGuard>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/manager/approvals"
                element={
                  <ProtectedRoute>
                    <RoleGuard
                      roles={['manager', 'admin']}
                      fallback={<Navigate to="/employee" replace />}
                    >
                      <Page component={ApprovalQueue} />
                    </RoleGuard>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/manager/checkins"
                element={
                  <ProtectedRoute>
                    <RoleGuard
                      roles={['manager', 'admin']}
                      fallback={<Navigate to="/employee" replace />}
                    >
                      <Page component={CheckinView} />
                    </RoleGuard>
                  </ProtectedRoute>
                }
              />

              {/* ── Admin Routes ───────────────────────────────── */}
              <Route
                path="/admin"
                element={
                  <ProtectedRoute>
                    <RoleGuard
                      roles={['admin']}
                      fallback={<Navigate to="/employee" replace />}
                    >
                      <Page component={AdminDashboard} />
                    </RoleGuard>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/reports"
                element={
                  <ProtectedRoute>
                    <RoleGuard
                      roles={['admin']}
                      fallback={<Navigate to="/employee" replace />}
                    >
                      <Page component={Reports} />
                    </RoleGuard>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/settings"
                element={
                  <ProtectedRoute>
                    <RoleGuard
                      roles={['admin']}
                      fallback={<Navigate to="/employee" replace />}
                    >
                      <Page component={AdminSettings} />
                    </RoleGuard>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/audit"
                element={
                  <ProtectedRoute>
                    <RoleGuard
                      roles={['admin']}
                      fallback={<Navigate to="/employee" replace />}
                    >
                      <Page component={AuditLog} />
                    </RoleGuard>
                  </ProtectedRoute>
                }
              />
              {/* FIX 12: /admin/analytics route preserved from Session 5 */}
              <Route
                path="/admin/analytics"
                element={
                  <ProtectedRoute>
                    <RoleGuard
                      roles={['admin']}
                      fallback={<Navigate to="/employee" replace />}
                    >
                      <Page component={Analytics} />
                    </RoleGuard>
                  </ProtectedRoute>
                }
              />

              {/* Catch-all → smart redirect */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
