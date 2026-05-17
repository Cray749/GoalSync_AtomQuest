import { useState } from 'react';
import { downloadBlob } from '../../utils/formatters';
import { useToast } from './Toast';

export default function ExportButton({ onExport, label = 'Export', className = '' }) {
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const toast = useToast();

  async function handleExport(format) {
    setOpen(false);
    setLoading(true);
    try {
      const { blob, filename } = await onExport(format);
      downloadBlob(blob, filename);
      toast(`${format.toUpperCase()} exported successfully`, 'success');
    } catch (err) {
      toast(err.message || 'Export failed', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={loading}
        className="gs-btn-ghost text-sm flex items-center gap-2"
      >
        {loading ? (
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        )}
        {label}
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 gs-card shadow-glow min-w-[140px] py-1">
            <button
              onClick={() => handleExport('csv')}
              className="w-full px-4 py-2 text-sm text-left text-slate-300 hover:bg-[#0f2040] flex items-center gap-2"
            >
              <span className="text-xs font-mono text-slate-500">CSV</span>
              Download CSV
            </button>
            <button
              onClick={() => handleExport('excel')}
              className="w-full px-4 py-2 text-sm text-left text-slate-300 hover:bg-[#0f2040] flex items-center gap-2"
            >
              <span className="text-xs font-mono text-slate-500">XLS</span>
              Download Excel
            </button>
          </div>
        </>
      )}
    </div>
  );
}
