import { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import { useToast } from '../common/Toast';
import { goalService } from '../../services/goalService';
import api from '../../services/api';
import { UOM_LABELS } from '../../utils/formatters';

const EMPTY = {
  title: '',
  description: '',
  uom_type: 'min',
  target_value: '',
  target_date: '',
  weightage: '',
  thrust_area_id: '',
};

export default function GoalForm({ isOpen, onClose, onSuccess, editGoal = null, cycleId }) {
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [thrustAreas, setThrustAreas] = useState([]);

  const isEdit = !!editGoal;
  const isSharedChild = editGoal?.is_shared && editGoal?.parent_goal_id;

  useEffect(() => {
    fetchThrustAreas();
  }, [cycleId]);

  useEffect(() => {
    if (isOpen) {
      if (editGoal) {
        setForm({
          title: editGoal.title || '',
          description: editGoal.description || '',
          uom_type: editGoal.uom_type || 'min',
          target_value: editGoal.target_value || '',
          target_date: editGoal.target_date ? editGoal.target_date.split('T')[0] : '',
          weightage: editGoal.weightage || '',
          thrust_area_id: editGoal.thrust_area_id || '',
        });
      } else {
        setForm(EMPTY);
      }
      setErrors({});
    }
  }, [isOpen, editGoal]);

  // FIX 3: Fetch thrust areas from employee-accessible endpoint
  async function fetchThrustAreas() {
    try {
      const res = await api.get('/goals/thrust-areas', { params: { cycle_id: cycleId } });
      setThrustAreas(res.data.data || []);
    } catch { /* silent */ }
  }

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: '' }));
  }

  function validate() {
    const errs = {};
    if (!form.title.trim()) errs.title = 'Goal title is required';
    if (form.title.trim().length < 3) errs.title = 'Title must be at least 3 characters';
    if (!form.uom_type) errs.uom_type = 'Select a unit of measurement';
    if (!form.thrust_area_id) errs.thrust_area_id = 'Please select a thrust area';
    if (['min', 'max'].includes(form.uom_type)) {
      if (!form.target_value || parseFloat(form.target_value) <= 0)
        errs.target_value = 'Target must be a positive number';
    }
    if (form.uom_type === 'timeline') {
      if (!form.target_date) errs.target_date = 'Target date is required';
      else if (new Date(form.target_date) <= new Date()) errs.target_date = 'Target date must be in the future';
    }
    if (!form.weightage) errs.weightage = 'Weightage is required';
    else if (parseFloat(form.weightage) < 10) errs.weightage = 'Minimum weightage is 10%';
    else if (parseFloat(form.weightage) > 90) errs.weightage = 'Maximum weightage is 90%';
    return errs;
  }

  async function handleSubmit() {
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setSubmitting(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        uom_type: form.uom_type,
        target_value: ['min', 'max'].includes(form.uom_type) ? parseFloat(form.target_value) : null,
        target_date: form.uom_type === 'timeline' ? form.target_date : null,
        weightage: parseFloat(form.weightage),
        thrust_area_id: form.thrust_area_id || null,
        cycle_id: cycleId,
      };

      if (isEdit) {
        await goalService.updateGoal(editGoal.id, payload);
        toast('Goal updated successfully', 'success');
      } else {
        await goalService.createGoal(payload);
        toast('Goal created successfully', 'success');
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  }

  const needsTarget = ['min', 'max'].includes(form.uom_type);
  const needsDate = form.uom_type === 'timeline';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Edit Goal' : 'Add New Goal'}
      size="md"
      footer={
        <>
          <button onClick={onClose} className="gs-btn-ghost">Cancel</button>
          <button onClick={handleSubmit} disabled={submitting} className="gs-btn">
            {submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Goal'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {isSharedChild && (
          <div className="px-3 py-2 bg-violet-900/15 border border-violet-500/20 rounded text-xs text-violet-300">
            🔗 Shared goal: only <strong>weightage</strong> can be edited.
          </div>
        )}

        {/* Title */}
        <div>
          <label className="gs-label">Goal Title *</label>
          <input
            className="gs-input"
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="e.g. Achieve ₹50L in new sales revenue"
            disabled={isSharedChild}
          />
          {errors.title && <p className="gs-field-error">{errors.title}</p>}
        </div>

        {/* Description */}
        <div>
          <label className="gs-label">Description</label>
          <textarea
            className="gs-textarea"
            rows={2}
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            placeholder="Optional: add context or success criteria"
            disabled={isSharedChild}
          />
        </div>

        {/* Row: Thrust Area + UoM */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="gs-label">Thrust Area *</label>
            <select
              className="gs-select"
              value={form.thrust_area_id}
              onChange={(e) => set('thrust_area_id', e.target.value)}
              disabled={isSharedChild}
            >
              <option value="">Select area…</option>
              {thrustAreas.map((ta) => (
                <option key={ta.id} value={ta.id}>{ta.name}</option>
              ))}
            </select>
            {errors.thrust_area_id && <p className="gs-field-error">{errors.thrust_area_id}</p>}
          </div>
          <div>
            <label className="gs-label">Unit of Measurement *</label>
            <select
              className="gs-select"
              value={form.uom_type}
              onChange={(e) => set('uom_type', e.target.value)}
              disabled={isSharedChild}
            >
              {Object.entries(UOM_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
        </div>

        {/* UoM hint */}
        <div className="px-3 py-2 bg-[#0a1628] border border-[#162d58] rounded text-xs text-slate-400">
          {form.uom_type === 'min' && '↑ Higher actual = better score. Formula: actual ÷ target'}
          {form.uom_type === 'max' && '↓ Lower actual = better score. Formula: target ÷ actual'}
          {form.uom_type === 'timeline' && '📅 Completed on or before deadline = 100%'}
          {form.uom_type === 'zero' && '✓ Zero incidents/defects = 100% score'}
        </div>

        {/* Target value / date */}
        <div className="grid grid-cols-2 gap-3">
          {needsTarget && (
            <div>
              <label className="gs-label">Target Value *</label>
              <input
                type="number"
                min="0"
                className="gs-input font-mono"
                value={form.target_value}
                onChange={(e) => set('target_value', e.target.value)}
                placeholder="e.g. 5000000"
                disabled={isSharedChild}
              />
              {errors.target_value && <p className="gs-field-error">{errors.target_value}</p>}
            </div>
          )}
          {needsDate && (
            <div>
              <label className="gs-label">Target Date *</label>
              <input
                type="date"
                className="gs-input font-mono"
                value={form.target_date}
                onChange={(e) => set('target_date', e.target.value)}
                disabled={isSharedChild}
              />
              {errors.target_date && <p className="gs-field-error">{errors.target_date}</p>}
            </div>
          )}
          <div className={needsTarget || needsDate ? '' : 'col-span-2'}>
            <label className="gs-label">Weightage (%) *</label>
            <input
              type="number"
              min="10"
              max="90"
              step="1"
              className="gs-input font-mono"
              value={form.weightage}
              onChange={(e) => set('weightage', e.target.value)}
              placeholder="10–90"
            />
            {errors.weightage && <p className="gs-field-error">{errors.weightage}</p>}
            <p className="text-xs text-slate-600 mt-1">Min 10%, max 90% per goal</p>
          </div>
        </div>
      </div>
    </Modal>
  );
}
