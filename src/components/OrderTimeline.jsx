import React, { useEffect, useState } from 'react';
import { X, Clock, ArrowRight, User, MessageSquare, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import axios from 'axios';

const DEPT_COLORS = {
  draft:          'bg-zinc-500/20 text-zinc-300 border-zinc-500/30',
  created:        'bg-zinc-500/20 text-zinc-300 border-zinc-500/30',
  admin_review:   'bg-amber-500/20 text-amber-300 border-amber-500/30',
  pending_review: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  submitted:      'bg-blue-500/20 text-blue-300 border-blue-500/30',
  concierge:      'bg-purple-500/20 text-purple-300 border-purple-500/30',
  operation:      'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  operations:     'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  procurement:    'bg-orange-500/20 text-orange-300 border-orange-500/30',
  inventory:      'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
  logistics:      'bg-blue-400/20 text-blue-300 border-blue-400/30',
  approved:       'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  completed:      'bg-green-500/20 text-green-300 border-green-500/30',
  rejected:       'bg-red-500/20 text-red-300 border-red-500/30',
  cancelled:      'bg-red-700/20 text-red-400 border-red-700/30',
};

const getDeptColor = (dept) =>
  DEPT_COLORS[String(dept || '').toLowerCase()] || 'bg-white/10 text-white/60 border-white/10';

const formatTime = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
    hour12: true,
  });
};

const DeptBadge = ({ label }) => (
  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${getDeptColor(label)}`}>
    {String(label || 'unknown').replace(/_/g, ' ')}
  </span>
);

const OrderTimeline = ({ orderId, orderNumber, isOpen, onClose }) => {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  useEffect(() => {
    if (!isOpen || !orderId) return;
    setLoading(true);
    setError(null);
    setData(null);
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    const base  = import.meta.env.VITE_API_URL || '/api';
    axios
      .get(`${base}/orders/${orderId}/timeline`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      .then((r) => setData(r.data?.data || r.data))
      .catch((e) => setError(e?.response?.data?.message || e.message || 'Failed to load timeline'))
      .finally(() => setLoading(false));
  }, [isOpen, orderId]);

  if (!isOpen) return null;

  const timeline = data?.timeline || [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      <div
        className="relative z-10 w-full max-w-lg bg-[#0f1117] border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <div>
            <h2 className="text-lg font-bold text-white">Order Timeline</h2>
            <p className="text-xs text-white/40 mt-0.5 font-mono">
              {orderNumber || `#${orderId}`}
            </p>
          </div>

          {data?.currentDepartment && (
            <div className="flex items-center gap-2 mr-8">
              <span className="text-[10px] text-white/40 uppercase tracking-widest">Now in</span>
              <DeptBadge label={data.currentDepartment} />
            </div>
          )}

          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading && (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-white/40">
              <Loader2 size={28} className="animate-spin" />
              <span className="text-sm">Loading timeline…</span>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm p-4 bg-red-500/10 rounded-xl border border-red-500/20">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          {!loading && !error && timeline.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-white/30">
              <Clock size={32} />
              <p className="text-sm text-center">
                No workflow history yet.<br />
                Status changes will appear here.
              </p>
            </div>
          )}

          {!loading && !error && timeline.length > 0 && (
            <ol className="relative pl-6">
              {/* Vertical connector line */}
              <div className="absolute left-[11px] top-2 bottom-2 w-px bg-white/10" />

              {timeline.map((entry, idx) => {
                const isLast = idx === timeline.length - 1;
                return (
                  <li key={idx} className="relative mb-6 last:mb-0">
                    {/* Dot */}
                    <div
                      className={`absolute -left-[22px] top-1.5 w-3 h-3 rounded-full border-2 ${
                        isLast
                          ? 'border-emerald-400 bg-emerald-400/30'
                          : 'border-white/30 bg-white/5'
                      }`}
                    />

                    <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 space-y-2.5">
                      {/* Transition arrow */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {entry.previousDepartment && (
                          <>
                            <DeptBadge label={entry.previousDepartment} />
                            <ArrowRight size={12} className="text-white/30 shrink-0" />
                          </>
                        )}
                        <DeptBadge label={entry.department} />
                        {isLast && (
                          <CheckCircle2 size={13} className="text-emerald-400 ml-1" />
                        )}
                      </div>

                      {/* Meta: time + user */}
                      <div className="flex items-center gap-4 flex-wrap text-[11px] text-white/40">
                        <span className="flex items-center gap-1.5">
                          <Clock size={11} className="text-white/30" />
                          {formatTime(entry.movedAt)}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <User size={11} className="text-white/30" />
                          {entry.moverName || `User #${entry.movedBy}`}
                        </span>
                      </div>

                      {/* Optional remarks */}
                      {entry.remarks && (
                        <div className="flex items-start gap-1.5 text-[11px] text-white/50 bg-white/5 rounded-lg px-3 py-2 border border-white/5">
                          <MessageSquare size={11} className="text-white/30 mt-0.5 shrink-0" />
                          <span>{entry.remarks}</span>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="p-4 border-t border-white/10 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold uppercase tracking-wider rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white border border-white/10 transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default OrderTimeline;
