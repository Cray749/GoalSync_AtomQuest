import { useState, useEffect } from 'react';
import AppShell from '../../components/common/AppShell';
import { PageLoader } from '../../components/common/LoadingSpinner';
import { useToast } from '../../components/common/Toast';
import Modal from '../../components/common/Modal';
import { adminService } from '../../services/index.js';
import { fmtDate, fmtDateTime } from '../../utils/formatters';

const TABS = ['Cycles', 'Thrust Areas', 'Users'];

export default function AdminSettings() {
  const toast = useToast();
  const [tab, setTab] = useState('Cycles');
  const [cycles, setCycles] = useState([]);
  const [thrustAreas, setThrustAreas] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  // Modals
  const [cycleModal, setCycleModal] = useState(false);
  const [taModal, setTaModal] = useState(false);
  const [userModal, setUserModal] = useState(false);
  const [unlockModal, setUnlockModal] = useState(null); // { goalId, title }

  // Forms
  const [cycleForm, setCycleForm] = useState({});
  const [taForm, setTaForm] = useState({ name: '', description: '', cycle_id: '' });
  const [userForm, setUserForm] = useState({ name: '', email: '', password: '', role: 'employee', department: '', manager_id: '' });
  const [unlockReason, setUnlockReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchData(); }, [tab]);

  async function fetchData() {
    setLoading(true);
    try {
      if (tab === 'Cycles') {
        const res = await adminService.getCycles();
        setCycles(res.data.data || []);
      } else if (tab === 'Thrust Areas') {
        const [taRes, cycleRes] = await Promise.all([
          adminService.getThrustAreas(),
          adminService.getCycles(),
        ]);
        setThrustAreas(taRes.data.data || []);
        setCycles(cycleRes.data.data || []);
      } else if (tab === 'Users') {
        const res = await adminService.getUsers({ is_active: 'true' });
        setUsers(res.data.data || []);
      }
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleActivateCycle(id) {
    try {
      await adminService.activateCycle(id);
      toast('Cycle activated', 'success');
      fetchData();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function handleCreateCycle() {
    setSaving(true);
    try {
      await adminService.createCycle(cycleForm);
      toast('Cycle created', 'success');
      setCycleModal(false);
      setCycleForm({});
      fetchData();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateThrustArea() {
    if (!taForm.name || !taForm.cycle_id) { toast('Name and cycle are required', 'error'); return; }
    setSaving(true);
    try {
      await adminService.createThrustArea(taForm);
      toast('Thrust area created', 'success');
      setTaModal(false);
      setTaForm({ name: '', description: '', cycle_id: '' });
      fetchData();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateUser() {
    setSaving(true);
    try {
      await adminService.createUser(userForm);
      toast('User created', 'success');
      setUserModal(false);
      setUserForm({ name: '', email: '', password: '', role: 'employee', department: '', manager_id: '' });
      fetchData();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivateUser(id) {
    try {
      await adminService.deactivateUser(id);
      toast('User deactivated', 'success');
      fetchData();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  const managers = users.filter((u) => ['manager', 'admin'].includes(u.role));

  return (
    <AppShell>
      <div className="gs-page-header flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Settings</h1>
          <p className="text-sm text-slate-400 mt-1">Manage cycles, thrust areas, and users</p>
        </div>
        <button
          onClick={() => {
            if (tab === 'Cycles') setCycleModal(true);
            else if (tab === 'Thrust Areas') setTaModal(true);
            else setUserModal(true);
          }}
          className="gs-btn"
        >
          + Add {tab === 'Cycles' ? 'Cycle' : tab === 'Thrust Areas' ? 'Thrust Area' : 'User'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-[#0a1628] border border-[#162d58] rounded-gs-lg mb-6 w-fit">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 text-xs font-medium rounded-gs transition-all ${
              tab === t ? 'bg-[#2563eb] text-white' : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {loading ? <PageLoader /> : (
        <>
          {/* Cycles */}
          {tab === 'Cycles' && (
            <div className="space-y-3">
              {cycles.map((c) => (
                <div key={c.id} className={`gs-card p-5 ${c.is_active ? 'border-emerald-500/30 bg-emerald-900/5' : ''}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-slate-100">{c.name}</h3>
                        {c.is_active && (
                          <span className="gs-badge text-emerald-400 bg-emerald-900/20 border border-emerald-500/30">
                            Active
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1 text-xs text-slate-500 mt-2">
                        <span>Phase 1: {fmtDate(c.phase1_start)} – {fmtDate(c.phase1_end)}</span>
                        <span>Q1: {fmtDate(c.q1_start)} – {fmtDate(c.q1_end)}</span>
                        <span>Q2: {fmtDate(c.q2_start)} – {fmtDate(c.q2_end)}</span>
                        <span>Q3: {fmtDate(c.q3_start)} – {fmtDate(c.q3_end)}</span>
                      </div>
                    </div>
                    {!c.is_active && (
                      <button onClick={() => handleActivateCycle(c.id)} className="gs-btn-ghost text-xs py-1 px-3 shrink-0">
                        Set Active
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {cycles.length === 0 && (
                <div className="gs-card p-8 text-center text-sm text-slate-500">
                  No cycles created yet.
                </div>
              )}
            </div>
          )}

          {/* Thrust Areas */}
          {tab === 'Thrust Areas' && (
            <div className="gs-card overflow-hidden">
              <table className="gs-table">
                <thead>
                  <tr><th>Name</th><th>Description</th><th>Cycle</th><th>Status</th><th /></tr>
                </thead>
                <tbody>
                  {thrustAreas.map((ta) => (
                    <tr key={ta.id}>
                      <td className="font-medium text-slate-200">{ta.name}</td>
                      <td className="text-slate-400 text-xs max-w-[200px] truncate">{ta.description || '—'}</td>
                      <td className="text-xs text-slate-500">{ta.cycle_name || '—'}</td>
                      <td>
                        <span className={`gs-badge ${ta.is_active ? 'text-emerald-400 bg-emerald-900/20 border-emerald-500/30' : 'text-slate-500 bg-slate-800/40 border-slate-600/30'}`}>
                          {ta.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <button
                          onClick={async () => {
                            await adminService.deleteThrustArea(ta.id);
                            toast('Thrust area deactivated', 'success');
                            fetchData();
                          }}
                          className="text-xs text-slate-500 hover:text-red-400"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                  {thrustAreas.length === 0 && (
                    <tr><td colSpan={5} className="text-center py-8 text-slate-500 text-sm">No thrust areas.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Users */}
          {tab === 'Users' && (
            <div className="gs-card overflow-hidden">
              <table className="gs-table">
                <thead>
                  <tr><th>Name</th><th>Role</th><th>Department</th><th>Manager</th><th>Created</th><th /></tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <p className="font-medium text-slate-200">{u.name}</p>
                        <p className="text-xs text-slate-500">{u.email}</p>
                      </td>
                      <td>
                        <span className={`gs-badge capitalize ${
                          u.role === 'admin' ? 'text-violet-400 bg-violet-900/20 border-violet-500/30'
                          : u.role === 'manager' ? 'text-amber-400 bg-amber-900/20 border-amber-500/30'
                          : 'text-blue-400 bg-blue-900/20 border-blue-500/30'
                        }`}>{u.role}</span>
                      </td>
                      <td className="text-xs text-slate-400">{u.department || '—'}</td>
                      <td className="text-xs text-slate-400">{u.manager_name || '—'}</td>
                      <td className="text-xs text-slate-500">{fmtDate(u.created_at)}</td>
                      <td>
                        <button
                          onClick={() => handleDeactivateUser(u.id)}
                          className="text-xs text-slate-500 hover:text-red-400"
                        >
                          Deactivate
                        </button>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-8 text-slate-500 text-sm">No users.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Create Cycle Modal */}
      <Modal isOpen={cycleModal} onClose={() => setCycleModal(false)} title="Create Goal Cycle" size="lg"
        footer={<><button onClick={() => setCycleModal(false)} className="gs-btn-ghost">Cancel</button><button onClick={handleCreateCycle} disabled={saving} className="gs-btn">{saving ? 'Creating…' : 'Create Cycle'}</button></>}>
        <div className="grid grid-cols-2 gap-3">
          {[['name','Cycle Name','text','e.g. FY 2026-27'],['year','Year','number','2026'],
            ['phase1_start','Phase 1 Start','date',''],['phase1_end','Phase 1 End','date',''],
            ['q1_start','Q1 Start','date',''],['q1_end','Q1 End','date',''],
            ['q2_start','Q2 Start','date',''],['q2_end','Q2 End','date',''],
            ['q3_start','Q3 Start','date',''],['q3_end','Q3 End','date',''],
            ['q4_start','Q4 Start','date',''],['q4_end','Q4 End','date',''],
          ].map(([k, label, type, ph]) => (
            <div key={k}>
              <label className="gs-label">{label}</label>
              <input type={type} className="gs-input font-mono text-sm" placeholder={ph}
                value={cycleForm[k] || ''} onChange={(e) => setCycleForm((f) => ({ ...f, [k]: e.target.value }))} />
            </div>
          ))}
        </div>
      </Modal>

      {/* Create Thrust Area Modal */}
      <Modal isOpen={taModal} onClose={() => setTaModal(false)} title="Add Thrust Area" size="sm"
        footer={<><button onClick={() => setTaModal(false)} className="gs-btn-ghost">Cancel</button><button onClick={handleCreateThrustArea} disabled={saving} className="gs-btn">{saving ? 'Creating…' : 'Create'}</button></>}>
        <div className="space-y-3">
          <div><label className="gs-label">Name *</label><input className="gs-input" value={taForm.name} onChange={(e) => setTaForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Sales Growth" /></div>
          <div><label className="gs-label">Description</label><textarea className="gs-textarea" rows={2} value={taForm.description} onChange={(e) => setTaForm((f) => ({ ...f, description: e.target.value }))} /></div>
          <div><label className="gs-label">Cycle *</label>
            <select className="gs-select" value={taForm.cycle_id} onChange={(e) => setTaForm((f) => ({ ...f, cycle_id: e.target.value }))}>
              <option value="">Select cycle…</option>
              {cycles.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
      </Modal>

      {/* Create User Modal */}
      <Modal isOpen={userModal} onClose={() => setUserModal(false)} title="Create User" size="md"
        footer={<><button onClick={() => setUserModal(false)} className="gs-btn-ghost">Cancel</button><button onClick={handleCreateUser} disabled={saving} className="gs-btn">{saving ? 'Creating…' : 'Create User'}</button></>}>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className="gs-label">Full Name *</label><input className="gs-input" value={userForm.name} onChange={(e) => setUserForm((f) => ({ ...f, name: e.target.value }))} placeholder="Priya Sharma" /></div>
          <div><label className="gs-label">Email *</label><input type="email" className="gs-input" value={userForm.email} onChange={(e) => setUserForm((f) => ({ ...f, email: e.target.value }))} placeholder="priya@company.com" /></div>
          <div><label className="gs-label">Password *</label><input type="password" className="gs-input" value={userForm.password} onChange={(e) => setUserForm((f) => ({ ...f, password: e.target.value }))} placeholder="Min 8 characters" /></div>
          <div><label className="gs-label">Role *</label>
            <select className="gs-select" value={userForm.role} onChange={(e) => setUserForm((f) => ({ ...f, role: e.target.value }))}>
              <option value="employee">Employee</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div><label className="gs-label">Department</label><input className="gs-input" value={userForm.department} onChange={(e) => setUserForm((f) => ({ ...f, department: e.target.value }))} placeholder="Sales" /></div>
          <div className="col-span-2"><label className="gs-label">Manager</label>
            <select className="gs-select" value={userForm.manager_id} onChange={(e) => setUserForm((f) => ({ ...f, manager_id: e.target.value }))}>
              <option value="">No manager</option>
              {managers.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.role})</option>)}
            </select>
          </div>
        </div>
      </Modal>
    </AppShell>
  );
}
